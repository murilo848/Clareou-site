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
// Aceita segredos colados com espaços, quebras de linha ou texto a mais: pega só o ID e o token.
const linhas = v => String(v || '').split(/\r?\n/).filter(l => l.trim()).length;
const achados = (v, re) => String(v || '').match(re) || [];
// O ID da conta não é segredo (aparece no endereço do painel do Cloudflare); fica aqui como reserva.
const ID_CONTA_PADRAO = '1ca1ac9176eec7358e43aa034661365b';
const CF_ACCOUNT_ID = achados(process.env.CF_ACCOUNT_ID, /[a-f0-9]{32}/gi)[0] || ID_CONTA_PADRAO;
const tokens = achados(process.env.CF_API_TOKEN, /[A-Za-z0-9_-]{30,}/g);
const CF_API_TOKEN = tokens.find(t => !/^[a-f0-9]{32}$/i.test(t)) || tokens[0] || '';
// FLUX.2 klein 9B: a melhor qualidade que cabe na cota gratuita (~1.370 neurons por imagem de 1280x800).
const MODELO_IMAGEM = '@cf/black-forest-labs/flux-2-klein-9b';
const NOME_MODELO = 'flux-2-klein-9b';
const LARGURA = 1280, ALTURA = 800; // 8:5, o mesmo formato dos cards e das capas
const MODELO_TEXTO = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
// A cota grátis é de 10.000 neurons/dia. 3 imagens por execução (~4.100 neurons) e 2 execuções por dia cabem nela.
const LIMITE_POR_EXECUCAO = Number(process.env.LIMITE || 3);
const REGISTRO = path.join(IMG, 'modelos.json'); // qual modelo gerou cada imagem

// Linguagem fotográfica do brandbook (em inglês: o FLUX entende melhor).
// Só descrições positivas: o FLUX não entende "não" e tende a desenhar o que é citado.
const ESTILO = 'Editorial documentary photograph, natural window light, warm soft tones, slightly desaturated colors, medium contrast, open shadows, calm and welcoming mood, shallow depth of field, real-looking Brazilian people of diverse ages and skin tones, simple uncluttered scene with plain surfaces, wooden furniture and green potted plants.';

const BANNERS = {
  'ciencia-e-pesquisa': 'A Brazilian female researcher in her 40s working at a clean university laboratory bench with a pipette, wooden shelves and green plants in the background, soft daylight.',
  'cuidado-e-rotina': 'A Brazilian grandmother and her adult daughter smiling and talking at a bare wooden kitchen table in the morning, each holding a white ceramic coffee cup, a small potted plant on the windowsill, sunlight coming through the window.',
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
  const multipart = body instanceof FormData;
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${model}`, {
    method: 'POST',
    headers: multipart ? { Authorization: `Bearer ${CF_API_TOKEN}` } : { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: multipart ? body : JSON.stringify(body),
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
        { role: 'system', content: 'You turn Portuguese photo briefs into one concise English image-generation prompt (max 60 words). Describe only the people, setting, light and objects that should be visible, using positive descriptions only. Do not mention anything that should be absent, and drop any words that negate or forbid things. Reply with the prompt only.' },
        { role: 'user', content: pt },
      ], max_tokens: 160,
    });
    const t = String(res.response || '').trim().replace(/^["']|["']$/g, '');
    return t.length > 20 ? t : pt;
  } catch (e) { console.warn('  tradução falhou, usando o texto original:', e.message); return pt; }
}

async function gerar(arquivo, cena, registro) {
  const prompt = `${cena} ${ESTILO}`.slice(0, 2000);
  if (SIMULAR) { console.log(`  [simulação] ${path.basename(arquivo)}\n    ${prompt.slice(0, 160)}…`); return; }
  const form = new FormData();
  form.append('prompt', prompt); form.append('width', String(LARGURA)); form.append('height', String(ALTURA));
  const res = await cf(MODELO_IMAGEM, form);
  const b64 = typeof res === 'string' ? res : res && res.image;
  if (!b64) throw new Error('resposta sem imagem: ' + JSON.stringify(res).slice(0, 200));
  fs.writeFileSync(arquivo, Buffer.from(b64, 'base64'));
  registro[path.basename(arquivo)] = NOME_MODELO;
  fs.writeFileSync(REGISTRO, JSON.stringify(registro, null, 2) + '\n');
  console.log(`  ✓ ${path.relative(ROOT, arquivo)}`);
}

(async () => {
  if (!SIMULAR) {
    console.log(`Segredos: CF_ACCOUNT_ID ${CF_ACCOUNT_ID ? 'ok' : 'não encontrado'} (${linhas(process.env.CF_ACCOUNT_ID)} linha/s), CF_API_TOKEN ${CF_API_TOKEN ? 'ok' : 'não encontrado'} (${linhas(process.env.CF_API_TOKEN)} linha/s)`);
    if (!CF_ACCOUNT_ID || !CF_API_TOKEN) { console.error('Confira os segredos CF_ACCOUNT_ID (32 letras e números) e CF_API_TOKEN no GitHub.'); process.exit(1); }
  }
  fs.mkdirSync(IMG, { recursive: true });
  let registro = {}; try { registro = JSON.parse(fs.readFileSync(REGISTRO, 'utf8')); } catch (e) {}
  const fila = [], melhorar = [];
  const antigo = f => registro[path.basename(f)] !== NOME_MODELO;
  const dir = path.join(ROOT, 'posts');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().reverse()) {
    const meta = frontmatter(fs.readFileSync(path.join(dir, f), 'utf8'));
    const destino = path.join(IMG, slugDe(f, meta) + '.jpg');
    if (!meta.sugestao_de_imagem) continue;
    if (!fs.existsSync(destino)) fila.push({ destino, pt: meta.sugestao_de_imagem });
    else if (antigo(destino)) melhorar.push({ destino, pt: meta.sugestao_de_imagem });
  }
  for (const [nome, cena] of Object.entries(BANNERS)) {
    const destino = path.join(IMG, `banner-${nome}.jpg`);
    if (!fs.existsSync(destino)) fila.push({ destino, en: cena });
    else if (antigo(destino)) melhorar.push({ destino, en: cena });
  }
  // Primeiro as imagens que faltam; depois refaz, com o modelo novo, as feitas pelo modelo antigo.
  fila.push(...melhorar);
  console.log(`Modelo: ${NOME_MODELO}. Na fila: ${fila.length - melhorar.length} novas e ${melhorar.length} para refazer${fila.length > LIMITE_POR_EXECUCAO ? ` (fazendo ${LIMITE_POR_EXECUCAO} agora)` : ''}`);
  let falhas = 0;
  for (const item of fila.slice(0, LIMITE_POR_EXECUCAO)) {
    try { const cena = item.en || (SIMULAR ? item.pt : await paraIngles(item.pt)); await gerar(item.destino, cena, registro); }
    catch (e) { falhas++; console.error(`  ✗ ${path.basename(item.destino)}: ${e.message}`); }
  }
  if (falhas) process.exitCode = 1;
})();
