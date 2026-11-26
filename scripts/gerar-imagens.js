#!/usr/bin/env node
// Gera as imagens do Clareou com o Cloudflare Workers AI (modelo FLUX).
// - Uma imagem por artigo em assets/img/<slug>.jpg, a partir de "sugestao_de_imagem".
// - Banners fixos do site em assets/img/banner-<nome>.jpg.
// Só gera o que ainda não existe. Para refazer uma imagem, apague o arquivo.
//
// Variáveis de ambiente (segredos do GitHub):
//   CF_ACCOUNT_ID  -> ID da conta Cloudflare
//   CF_API_TOKEN   -> token com permissão "Workers AI"
// Uso: node scripts/gerar-imagens.js            (gera)
//      node scripts/gerar-imagens.js --simular  (só mostra o que faria)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IMG = path.join(ROOT, 'assets', 'img');
const SIMULAR = process.argv.includes('--simular');
const { CF_ACCOUNT_ID, CF_API_TOKEN } = process.env;
const MODELO_IMAGEM = '@cf/black-forest-labs/flux-1-schnell';
const MODELO_TEXTO = '@cf/meta/llama-3.1-8b-instruct';
const LIMITE_POR_EXECUCAO = 12; // protege a cota gratuita diária

// Linguagem fotográfica do brandbook (em inglês: o FLUX entende melhor).
const ESTILO = 'editorial documentary photograph, natural window light, warm soft tones, slightly desaturated colors, medium contrast, open shadows, calm and welcoming mood, shallow depth of field, real-looking Brazilian people of diverse ages and skin tones, clean uncluttered background. No text, no letters, no logos, no labels, no bottles, no products, no smoke, no cigarettes, no cannabis leaves, no neon colors.';

const BANNERS = {
  'ciencia-e-pesquisa': 'A Brazilian female researcher in her 40s working at a clean university laboratory bench with a pipette, wooden shelves and green plants in the background, soft daylight.',
  'cuidado-e-rotina': 'A Brazilian grandmother and her adult daughter talking at a kitchen table in the morning, hands around coffee cups, sunlight coming through the window.',
  'acesso-e-direitos': 'A Brazilian woman and a lawyer reviewing documents together at a simple office desk, calm conversation, folders and a notebook, warm daylight.',
  glossario: 'Close-up of an open notebook with handwritten notes beside a cup of tea and reading glasses on a wooden table, morning light, botanical herbarium sheets in the background.',
  pergunte: 'A Brazilian man in his 50s sitting on a sofa at home, thoughtfully writing a question in a notebook, warm afternoon light.',
  sobre: 'Wide view of a sunrise over a green Brazilian forest horizon, golden light breaking through morning mist, peaceful.',
};

function frontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/); const meta = {};
  if (m) for (const line of m[1].split(/\r?\n/)) { const i = line.indexOf(':'); if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  return meta;
}
const slugDe = (f, meta) => meta.slug || f.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/^(ciencia|atual|cuidado|acesso|nota)-/, '');

async function cf(model, body) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${model}`, {
    method: 'POST', headers: { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(`${model}: HTTP ${r.status} ${JSON.stringify(j.errors || j).slice(0, 300)}`);
  return j.result;
}

// Traduz a sugestão (em português) para uma descrição visual curta em inglês.
async function paraIngles(pt) {
  try {
    const res = await cf(MODELO_TEXTO, {
      messages: [
        { role: 'system', content: 'You turn Portuguese photo briefs into one concise English image-generation prompt (max 60 words). Describe only what is visible. Never add text, products, bottles, smoke or cannabis leaves. Reply with the prompt only.' },
        { role: 'user', content: pt },
      ], max_tokens: 160,
    });
    const t = String(res.response || '').trim().replace(/^["']|["']$/g, '');
    return t.length > 20 ? t : pt;
  } catch (e) { console.warn('  tradução falhou, usando o texto original:', e.message); return pt; }
}

async function gerar(arquivo, cena) {
  const prompt = `${cena} ${ESTILO}`.slice(0, 2000);
  if (SIMULAR) { console.log(`  [simulação] ${path.basename(arquivo)}\n    ${prompt.slice(0, 160)}…`); return; }
  const res = await cf(MODELO_IMAGEM, { prompt, steps: 8, seed: Math.floor(Math.random() * 1e9) });
  if (!res || !res.image) throw new Error('resposta sem imagem');
  fs.writeFileSync(arquivo, Buffer.from(res.image, 'base64'));
  console.log(`  ✓ ${path.relative(ROOT, arquivo)}`);
}

(async () => {
  if (!SIMULAR && (!CF_ACCOUNT_ID || !CF_API_TOKEN)) { console.error('Faltam CF_ACCOUNT_ID e CF_API_TOKEN.'); process.exit(1); }
  fs.mkdirSync(IMG, { recursive: true });
  const fila = [];
  const dir = path.join(ROOT, 'posts');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().reverse()) {
    const meta = frontmatter(fs.readFileSync(path.join(dir, f), 'utf8'));
    const destino = path.join(IMG, slugDe(f, meta) + '.jpg');
    if (!fs.existsSync(destino) && meta.sugestao_de_imagem) fila.push({ destino, pt: meta.sugestao_de_imagem });
  }
  for (const [nome, cena] of Object.entries(BANNERS)) {
    const destino = path.join(IMG, `banner-${nome}.jpg`);
    if (!fs.existsSync(destino)) fila.push({ destino, en: cena });
  }
  console.log(`Imagens a gerar: ${fila.length}${fila.length > LIMITE_POR_EXECUCAO ? ` (fazendo ${LIMITE_POR_EXECUCAO} agora)` : ''}`);
  let falhas = 0;
  for (const item of fila.slice(0, LIMITE_POR_EXECUCAO)) {
    try { const cena = item.en || (SIMULAR ? item.pt : await paraIngles(item.pt)); await gerar(item.destino, cena); }
    catch (e) { falhas++; console.error(`  ✗ ${path.basename(item.destino)}: ${e.message}`); }
  }
  if (falhas) process.exitCode = 1;
})();
