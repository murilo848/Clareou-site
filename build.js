#!/usr/bin/env node
// Gerador do site do Clareou. Sem dependências: só Node 18+.
// Uso: node build.js            -> gera dist/ para publicar
//      node build.js --preview  -> links com index.html (para abrir sem servidor)
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./config.js');

const ROOT = __dirname, OUT = path.join(ROOT, 'dist');
const PREVIEW = process.argv.includes('--preview');

/* ---------- territórios ---------- */
const CATS = {
  'ciencia-e-pesquisa': { n: 'Ciência & Pesquisa', c: '#475C6B', fg: '#FFFFFF', d: 'Como a cannabis age no corpo, o que os estudos mostram e o que ainda está em aberto.', sky: ['#DDE4E6', '#AFC0C9', '#475C6B'] },
  'cuidado-e-rotina': { n: 'Cuidado & Rotina', c: '#E0A63A', fg: '#1E231C', d: 'A vida real de quem trata e de quem cuida: consulta, efeitos, sono, dor, família.', sky: ['#F7EEDB', '#F0D49A', '#9DB08C'] },
  'acesso-e-direitos': { n: 'Acesso & Direitos', c: '#9DB08C', fg: '#1E231C', d: 'Receita, regras da Anvisa, importação, associações e caminhos legais, passo a passo.', sky: ['#EEF2E4', '#C8D6AE', '#7F9670'] },
};
const EVK = { forte: 'forte', moderada: 'moderada', limitada: 'limitada', 'em estudo': 'estudo' };
const GLOSSARIO = [
  ['Canabidiol (CBD)', 'Substância da cannabis sem efeito intoxicante, estudada para epilepsia, ansiedade, dor e sono.'],
  ['Tetra-hidrocanabinol (THC)', 'Substância da cannabis que ativa o receptor CB1 e causa o efeito intoxicante. Também é estudada para dor e náusea.'],
  ['Sistema endocanabinoide', 'Rede de sinais do próprio corpo, formada por receptores, mensageiros e enzimas, que ajuda a regular dor, sono, humor e apetite.'],
  ['CB1', 'Receptor do sistema endocanabinoide presente sobretudo no sistema nervoso.'],
  ['CB2', 'Receptor do sistema endocanabinoide presente sobretudo nas células de defesa.'],
  ['Endocanabinoides', 'Mensageiros que o próprio corpo produz, como a anandamida e o 2-AG.'],
  ['Espectro completo', 'Extrato que mantém vários compostos da planta, o que pode incluir pequenas quantidades de THC.'],
  ['Isolado', 'Produto com uma única substância purificada, como o CBD isolado.'],
  ['Certificado de análise (COA)', 'Laudo de laboratório que informa a composição de um lote de produto.'],
  ['Efeito entourage', 'Hipótese de que compostos da planta agem melhor juntos. A comprovação em humanos ainda é limitada.'],
  ['Ensaio clínico randomizado', 'Estudo em que os participantes são sorteados entre grupos, por exemplo tratamento e placebo, para comparar resultados de forma justa.'],
  ['Placebo', 'Substância sem efeito esperado, usada como comparação para separar o efeito real da expectativa.'],
  ['Duplo-cego', 'Desenho em que nem participantes nem pesquisadores sabem quem recebe o tratamento ou o placebo.'],
  ['Metanálise', 'Estudo que combina estatisticamente os resultados de vários outros estudos sobre a mesma pergunta.'],
  ['Mediana', 'O valor do meio quando os resultados são postos em ordem. Metade fica acima, metade abaixo.'],
  ['Nível de evidência', 'O quanto a ciência confia num resultado. No Clareou: forte, moderada, limitada ou em estudo.'],
];

/* ---------- utilidades ---------- */
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const slugify = s => norm(s).replace(/&/g, 'e').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hs = s => { let x = 7; for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x; };
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataLonga = d => { const [y, m, dd] = d.split('-').map(Number); return `${dd} de ${MESES[m - 1]} de ${y}`; };
const dataCurta = d => { const [y, m, dd] = d.split('-'); return `${dd}.${m}.${y}`; };
const write = (rel, content) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };

/* ---------- frontmatter + markdown ---------- */
function frontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':'); if (i < 1) continue;
    const k = line.slice(0, i).trim(); let v = line.slice(i + 1).trim();
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map(x => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else v = v.replace(/^["']|["']$/g, '');
    meta[k] = v;
  }
  return { meta, body: m[2] };
}
function inline(t) {
  let s = esc(t);
  const links = [];
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, (_, txt, url) => { links.push(`<a href="${url}"${url.startsWith('http') && !url.startsWith(C.url) ? ' rel="noopener" target="_blank"' : ''}>${txt}</a>`); return `\u0000${links.length - 1}\u0000`; });
  s = s.replace(/https?:\/\/[^\s<]+/g, u => { const tail = u.match(/[.,;:)]+$/)?.[0] || ''; const url = tail ? u.slice(0, -tail.length) : u; links.push(`<a href="${url}" rel="noopener" target="_blank">${url}</a>`); return `\u0000${links.length - 1}\u0000${tail}`; });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
  s = s.replace(/\[(\d+(?:\s*[,–-]\s*\d+)*)\]/g, (_, n) => `<sup class="cit">[${n.split(/\s*,\s*/).map(x => { const f = x.split(/[–-]/)[0].trim(); return `<a href="#ref-${f}">${x}</a>`; }).join(', ')}]</sup>`);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => links[+i]);
}
function markdown(src) {
  const lines = src.replace(/\r/g, '').split('\n');
  const out = [], toc = []; let i = 0, inRefs = false, pCount = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{2,4})\s+(.*)$/))) {
      const lvl = m[1].length, txt = m[2].trim(), id = slugify(txt);
      inRefs = norm(txt).replace(/[^a-z]/g, '') === 'referencias';
      if (lvl === 2) toc.push([id, txt]);
      out.push({ t: 'h', html: `<h${lvl} id="${id}">${inline(txt)}</h${lvl}>` }); i++; continue;
    }
    if (/^\s*(?:[-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l); const items = [];
      while (i < lines.length && /^\s*(?:[-*]|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, '')); i++; }
      const tag = ordered ? 'ol' : 'ul';
      out.push({ t: 'l', html: `<${tag}${inRefs ? ' class="refs"' : ''}>${items.map((x, k) => `<li${inRefs ? ` id="ref-${k + 1}"` : ''}>${inline(x)}</li>`).join('')}</${tag}>` }); continue;
    }
    if (/^>\s?/.test(l)) {
      const q = []; while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push({ t: 'q', html: `<blockquote>${inline(q.join(' '))}</blockquote>` }); continue;
    }
    const para = []; while (i < lines.length && lines[i].trim() && !/^(#{2,4}\s|>\s?|\s*(?:[-*]|\d+\.)\s+)/.test(lines[i])) { para.push(lines[i].trim()); i++; }
    const text = para.join(' ');
    if (/^\*?conte[uú]do educativo\./i.test(text)) continue; // o aviso é inserido pelo layout
    pCount++; out.push({ t: 'p', n: pCount, html: `<p>${inline(text)}</p>` });
  }
  return { blocks: out, toc };
}

/* ---------- posts ---------- */
function loadPosts() {
  const dir = path.join(ROOT, 'posts');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const { meta, body } = frontmatter(fs.readFileSync(path.join(dir, f), 'utf8'));
    const data = meta.data || f.slice(0, 10);
    const slug = meta.slug || f.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/^(ciencia|atual|cuidado|acesso|nota)-/, '');
    let cat = slugify(meta.categoria || 'Ciência & Pesquisa'); if (!CATS[cat]) cat = 'ciencia-e-pesquisa';
    const nivel = meta.nivel_de_evidencia || '';
    const md = markdown(body);
    const words = body.split(/\s+/).length;
    return {
      file: f, slug, data, cat,
      titulo: meta.titulo || slug, linha: meta.linha_fina || '', nivel, evk: EVK[norm(nivel)] || '',
      tempo: meta.tempo_de_leitura || `${Math.max(1, Math.round(words / 200))} min`,
      tags: Array.isArray(meta.tags) ? meta.tags : [], desc: meta.meta_descricao || meta.linha_fina || '',
      resumo: Array.isArray(meta.resumo) ? meta.resumo : [], tipo: meta.tipo || 'artigo',
      destaque: /^(sim|true)$/i.test(meta.destaque || ''), comece: /^(sim|true)$/i.test(meta.comece || ''),
      md, url: `artigos/${slug}/`,
    };
  }).sort((a, b) => b.data.localeCompare(a.data) || b.file.localeCompare(a.file));
}

/* ---------- ilustração em arco (substitui foto enquanto não houver imagens) ---------- */
let artN = 0;
function art(p) {
  const k = hs(p.slug), P = CATS[p.cat].sky, sx = 90 + k % 220, sy = 146 + (k >> 4) % 26, id = 'g' + (artN++);
  let ex = '';
  if (p.cat === 'ciencia-e-pesquisa') { const cx = 60 + (k >> 5) % 60, cy = 58; ex = `<g fill="none" stroke="#475C6B" stroke-width="2" opacity=".7"><path d="M${cx} ${cy - 16}l14 8v16l-14 8l-14-8v-16zM${cx + 14} ${cy - 8}l22-10M${cx + 36} ${cy - 18}l12 8"/></g><g fill="#475C6B" opacity=".8"><circle cx="${cx + 36}" cy="${cy - 18}" r="4"/><circle cx="${cx + 48}" cy="${cy - 10}" r="3"/></g>`; }
  if (p.cat === 'cuidado-e-rotina') { const x = 250 + (k >> 6) % 90; ex = `<g fill="#C8D6AE" stroke="#C8D6AE" stroke-width="4" stroke-linecap="round"><path d="M${x} 214v-30" fill="none"/><path d="M${x} 196c0-14 10-22 24-22 0 13-10 22-24 22zM${x} 204c0-12-9-19-21-19 0 11 9 19 21 19z"/></g>`; }
  if (p.cat === 'acesso-e-direitos') ex = `<path d="M150 250C180 228 236 222 222 204S246 186 ${sx + 30} 176" fill="none" stroke="#F4F6EF" stroke-width="7" stroke-linecap="round" opacity=".85"/>`;
  return `<svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P[0]}"/><stop offset="1" stop-color="${P[1]}"/></linearGradient></defs><rect width="400" height="250" fill="url(#${id})"/><circle cx="${400 - sx}" cy="160" r="${118 + k % 40}" fill="none" stroke="#fff" stroke-width="2.5" opacity=".6" stroke-dasharray="${520 + k % 180} 220"/><circle cx="${sx}" cy="${sy}" r="80" fill="#E0A63A" opacity=".2"/><circle cx="${sx}" cy="${sy}" r="44" fill="#E0A63A"/><path d="M0 ${166 + k % 14}C90 ${140 + k % 30} 170 190 260 165S360 ${150 + k % 20} 400 160V250H0Z" fill="${P[2]}"/><path d="M0 208C120 ${184 + k % 20} 220 226 400 ${194 + k % 15}V250H0Z" fill="#2D3B27"/>${ex}</svg>`;
}

/* ---------- peças de layout ---------- */
function ctx(depth) {
  const pre = '../'.repeat(depth);
  const L = p => { if (p === '' || p === '/') return PREVIEW ? pre + 'index.html' : (pre || './'); return pre + p + (PREVIEW && p.endsWith('/') ? 'index.html' : ''); };
  return { pre, L };
}
const SYM = `<svg aria-hidden="true"><use href="#sym"/></svg>`;
const ICONS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
<symbol id="sym" viewBox="5 9 90 90"><path d="M69.5 27.15A34 34 0 1 1 30.5 27.15" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round"/><circle cx="50" cy="20" r="8.5" fill="#E0A63A"/><path d="M50 36C58 45 58 56 50 64C42 56 42 45 50 36Z" fill="currentColor"/><path d="M50 62V74" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></symbol>
<symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"/></symbol>
<symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></symbol>
<symbol id="i-link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></symbol>
<symbol id="i-chat" viewBox="0 0 24 24"><path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></symbol>
</svg>`;

function ad(kind, slotKey) {
  const slot = C.adsenseSlots?.[slotKey];
  if (C.adsenseClient && slot) {
    const fixed = { mr: 'width:300px;height:250px', hp: 'width:300px;height:600px' }[kind];
    return `<div class="ad ${kind}"><span>Publicidade</span><ins class="adsbygoogle" style="display:${fixed ? 'inline-block;' + fixed : 'block'}" data-ad-client="${esc(C.adsenseClient)}" data-ad-slot="${esc(slot)}"${fixed ? '' : ' data-ad-format="auto" data-full-width-responsive="true"'}></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`;
  }
  if (!C.mostrarEspacosDeAnuncio) return '';
  const z = { lb: '728×90 · celular 320×50', mr: '300×250', hp: '300×600', bb: '970×250 · celular 300×250' }[kind];
  return `<div class="ad ${kind}"><span>Publicidade</span><div class="adbox"><b>${z}</b><small>${slotKey}</small></div></div>`;
}
const catTag = (k, x) => `<a class="cat kick" href="${x.L('categoria/' + k + '/')}"><i style="background:${CATS[k].c}"></i>${CATS[k].n}</a>`;
const catSpan = k => `<span class="cat kick"><i style="background:${CATS[k].c}"></i>${CATS[k].n}</span>`;
const ev = p => p.nivel ? `<span class="ev ${p.evk}">Evidência · ${esc(p.nivel)}</span>` : '';
const meta = p => `<div class="meta"><span>Redação Clareou</span><time class="mono" datetime="${p.data}">${dataCurta(p.data)}</time><span class="mono">${esc(p.tempo)}</span>${ev(p)}</div>`;
function cardA(p, x) {
  if (p.tipo === 'nota') { const first = p.md.blocks.find(b => b.t === 'p'); return `<article class="qp"><div class="qh">${catTag(p.cat, x)}<span>Nota rápida</span><time class="mono">${dataCurta(p.data)}</time></div><div class="qt">${first ? first.html : ''}</div><a class="btn" href="${x.L(p.url)}">Ler a nota</a></article>`; }
  return `<article class="card"><a class="arch" href="${x.L(p.url)}" tabindex="-1" aria-hidden="true">${art(p)}</a><div>${catTag(p.cat, x)}<a class="lnk" href="${x.L(p.url)}"><h3>${esc(p.titulo)}</h3></a><p>${esc(p.linha)}</p>${meta(p)}</div></article>`;
}
const tile = (p, x) => `<a class="tile lnk" href="${x.L(p.url)}"><div class="arch">${art(p)}</div>${catSpan(p.cat)}<h3>${esc(p.titulo)}</h3><p>${esc(p.linha)}</p><div class="meta"><span class="mono">${esc(p.tempo)}</span>${ev(p)}</div></a>`;
function river(list, x, slot) {
  if (!list.length) return `<p class="empty">Os primeiros textos chegam em breve.</p>`;
  return list.map((p, i) => cardA(p, x) + ((i + 1) % 4 === 0 && i + 1 < list.length ? ad('mr', slot) : '')).join('');
}
function newsBox(x, id) {
  return `<div class="news"><span class="kick" style="color:var(--broto)">Newsletter · toda quinta</span><h2>A carta do Clareou</h2><p>O que a ciência descobriu na semana, e o que isso muda na prática.</p><form data-form="news"${C.newsletterAction ? ` action="${esc(C.newsletterAction)}" method="post" target="_blank"` : ''}><label for="${id}">Seu e-mail</label><input id="${id}" name="email" type="email" required placeholder="nome@email.com" autocomplete="email"><button>Assinar a newsletter</button><small class="ok">Sem spam. Cancele quando quiser.</small></form></div>`;
}
function rail(x, posts, pfx) {
  let pick = posts.filter(p => p.destaque || p.evk === 'forte'); if (pick.length < 3) pick = posts; pick = pick.filter(p => p.tipo !== 'nota').slice(0, 5);
  return `<aside class="rail">${ad('mr', 'lateral')}${pick.length ? `<div class="box"><h2>Leituras essenciais</h2><ol class="pop">${pick.map(p => `<li><a href="${x.L(p.url)}">${esc(p.titulo)}</a></li>`).join('')}</ol></div>` : ''}${newsBox(x, pfx + '-em')}<div class="stick">${ad('hp', 'lateralFixo')}</div></aside>`;
}
const tabs = (x, cur) => `<div class="tabs"><div class="wrap scroll">${[['', 'Destaques'], ['recentes/', 'Recentes'], ['seguindo/', 'Seguindo']].map(([h, l]) => `<a class="kick" href="${x.L(h)}"${cur === h ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</div></div>`;

function layout({ x, title, desc, body, canonical, navCur, depth, og, jsonld }) {
  const full = title ? `${title} · ${C.nome}` : `${C.nome} · ${C.assinatura}`;
  const can = C.url + '/' + (canonical || '');
  const nav = Object.keys(CATS).map(k => `<a href="${x.L('categoria/' + k + '/')}"${navCur === k ? ' aria-current="page"' : ''}>${CATS[k].n}</a>`).join('') + `<a href="${x.L('glossario/')}"${navCur === 'glossario' ? ' aria-current="page"' : ''}>Glossário</a><a href="${x.L('pergunte/')}"${navCur === 'pergunte' ? ' aria-current="page"' : ''}>Pergunte</a>`;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc || C.descricao)}">
<link rel="canonical" href="${esc(can)}">
<meta property="og:site_name" content="${esc(C.nome)}"><meta property="og:title" content="${esc(title || C.nome)}"><meta property="og:description" content="${esc(desc || C.descricao)}"><meta property="og:type" content="${og || 'website'}"><meta property="og:url" content="${esc(can)}"><meta property="og:locale" content="pt_BR">
<meta name="theme-color" content="#2D3B27">
<link rel="icon" href="${x.pre}assets/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(C.nome)}" href="${x.pre}feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,500;0,700;1,400&family=Atkinson+Hyperlegible+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${x.pre}assets/style.css">
${C.adsenseClient ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(C.adsenseClient)}" crossorigin="anonymous"></script>` : ''}
${C.analytics ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(C.analytics)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied'});gtag('js',new Date());gtag('config','${esc(C.analytics)}');</script>` : ''}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body data-base="${x.pre}" data-preview="${PREVIEW ? 1 : 0}" data-news="${C.newsletterAction ? 1 : 0}" data-ask="${C.perguntaAction ? 1 : 0}">
${ICONS}
<a class="skip" href="#main">Pular para o conteúdo</a>
<header class="hd"><div class="wrap">
  <a class="logo" href="${x.L('')}" aria-label="${esc(C.nome)}, página inicial">${SYM}clareou</a>
  <nav class="nav scroll" aria-label="Principal">${nav}</nav>
  <div class="tools">
    <button class="ib" data-act="search" aria-label="Buscar"><svg aria-hidden="true"><use href="#i-search"/></svg></button>
    <button class="ib" data-act="bell" aria-label="Novidades" aria-expanded="false"><svg aria-hidden="true"><use href="#i-bell"/></svg><span class="dot" id="bdot" hidden></span></button>
    <button class="ib cta hide-s" data-act="news">Assinar a newsletter</button>
    <button class="ib" data-act="menu" aria-label="Abrir menu" aria-expanded="false"><svg aria-hidden="true"><use href="#i-menu"/></svg></button>
  </div>
</div></header>
<main id="main">${body}</main>
<div class="scrim" id="scrim"></div>
<aside class="drawer" id="drawer" aria-label="Menu">
  <div class="dhead"><span class="kick">Menu</span><button class="btn" data-act="close" aria-label="Fechar menu"><svg aria-hidden="true"><use href="#i-x"/></svg></button></div>
  <label class="kick" for="dq">Buscar</label>
  <input id="dq" class="fld" type="search" placeholder="Dor, Anvisa, sono…" autocomplete="off">
  <div id="dres" aria-live="polite"></div>
  <nav aria-label="Menu" class="dnav">${Object.keys(CATS).map(k => `<a class="solo" href="${x.L('categoria/' + k + '/')}">${CATS[k].n}</a>`).join('')}<a class="solo" href="${x.L('recentes/')}">Recentes</a><a class="solo" href="${x.L('seguindo/')}">Seguindo</a><a class="solo" href="${x.L('glossario/')}">Glossário</a><a class="solo" href="${x.L('pergunte/')}">Pergunte</a><a class="solo" href="${x.L('sobre/')}">Quem somos</a></nav>
  <div class="dctas"><button class="btn pri" data-act="news">Assinar a newsletter</button></div>
  <span class="kick">Aparência</span>
  <div class="seg" role="group" aria-label="Tema"><button data-theme-set="light">Claro</button><button data-theme-set="system">Sistema</button><button data-theme-set="dark">Escuro</button></div>
</aside>
<div class="pop-n" id="popn" role="dialog" aria-label="Novidades"></div>
<div class="modal" id="modal" role="dialog" aria-modal="true" aria-label="Newsletter"><button class="btn mclose" data-act="close" aria-label="Fechar"><svg aria-hidden="true"><use href="#i-x"/></svg></button>${newsBox(x, 'm-em')}</div>
<div id="cookie"></div>
<footer class="ft"><div class="wrap">
  <div class="fg">
    <div><a class="logo" href="${x.L('')}">${SYM}clareou</a><p class="tag">${esc(C.assinatura)}</p><p class="small">Blog independente e educativo. Não vende, não indica e não promove produtos, marcas ou doses.</p></div>
    <div><h3 class="kick">Territórios</h3><ul>${Object.keys(CATS).map(k => `<li><a href="${x.L('categoria/' + k + '/')}">${CATS[k].n}</a></li>`).join('')}</ul></div>
    <div><h3 class="kick">Aprenda</h3><ul><li><a href="${x.L('recentes/')}">Todos os artigos</a></li><li><a href="${x.L('glossario/')}">Glossário</a></li><li><a href="${x.L('pergunte/')}">Pergunte</a></li><li><a href="${x.pre}feed.xml">RSS</a></li></ul></div>
    <div><h3 class="kick">Sobre</h3><ul><li><a href="${x.L('sobre/')}">Quem somos</a></li><li><a href="${x.L('politica-editorial/')}">Política editorial</a></li><li><a href="${x.L('privacidade/')}">Privacidade e cookies</a></li><li><a href="mailto:${esc(C.email)}">${esc(C.email)}</a></li></ul></div>
    ${newsBox(x, 'f-em')}
  </div>
  <p class="legal">Conteúdo exclusivamente educativo. Não substitui consulta médica e não indica produtos, marcas ou doses. O Clareou não vende produtos de cannabis. © ${new Date().getFullYear()} ${esc(C.nome)}</p>
</div></footer>
<script src="${x.pre}assets/site.js" defer></script>
</body>
</html>`;
}

/* ---------- páginas ---------- */
function home(posts) {
  const x = ctx(0), arts = posts.filter(p => p.tipo !== 'nota');
  const lead = arts[0], side = arts.slice(1, 4);
  const startPick = (posts.filter(p => p.comece).length >= 3 ? posts.filter(p => p.comece) : arts.filter(p => p.evk === 'forte')).slice(0, 3);
  const shelves = Object.keys(CATS).map((k, i) => {
    const l = arts.filter(p => p.cat === k);
    return `<section class="band tight"><div class="wrap"><div class="sechead"><h2 class="h2">Mais recentes em ${CATS[k].n}</h2><a href="${x.L('categoria/' + k + '/')}">Ver mais →</a></div>${l.length ? `<div class="shelf">${tile(l[0], x)}<div class="mini">${l.slice(1, 4).map(p => `<a class="lnk" href="${x.L(p.url)}"><h3>${esc(p.titulo)}</h3><div class="meta"><time class="mono">${dataCurta(p.data)}</time>${ev(p)}</div></a>`).join('') || '<p class="meta">Mais textos deste território chegam em breve.</p>'}</div></div>` : '<p class="empty">Os primeiros textos deste território chegam em breve.</p>'}${i === 1 ? ad('mr', 'feed') : ''}</div></section>`;
  }).join('');
  const top = lead ? `<section class="band top"><div class="wrap"><div class="topgrid">
  <a class="lead lnk" href="${x.L(lead.url)}"><div class="arch">${art(lead)}</div><span class="cat kick light"><i style="background:${CATS[lead.cat].c}"></i>${CATS[lead.cat].n}</span><h1>${esc(lead.titulo)}</h1><p class="dek">${esc(lead.linha)}</p>${meta(lead)}</a>
  <div><h2 class="kick light" style="margin:0 0 8px">Em destaque</h2>${side.map(p => `<a class="si lnk" href="${x.L(p.url)}"><div class="arch">${art(p)}</div><div>${catSpan(p.cat)}<h3>${esc(p.titulo)}</h3><div class="meta"><time class="mono">${dataCurta(p.data)}</time>${ev(p)}</div></div></a>`).join('') || '<p class="meta">Novos destaques todos os dias.</p>'}</div>
 </div></div></section>` : `<section class="band top"><div class="wrap"><h1 class="h2" style="color:var(--manha)">${esc(C.assinatura)}</h1><p class="dek">Os primeiros textos chegam em breve.</p></div></section>`;
  const body = `${tabs(x, '')}<div class="wrap">${ad('lb', 'topo')}</div>${top}
 <section class="band"><div class="wrap cols"><div><div class="sechead"><div><h2 class="h2">Mais recentes</h2><p>Tudo o que saiu, em ordem.</p></div><a href="${x.L('recentes/')}">Ver todos →</a></div>${river(posts.filter(p => p !== lead).slice(0, 12), x, 'feed')}</div>${rail(x, posts, 'h')}</div></section>
 ${startPick.length === 3 ? `<section class="band tight"><div class="wrap"><div class="pack"><span class="kick">Especial</span><h2 class="h2" style="margin:8px 0 6px">Comece por aqui</h2><p class="dek mute">Três leituras para quem está chegando agora.</p><div class="g3">${startPick.map(p => tile(p, x)).join('')}</div></div></div></section>` : ''}
 ${shelves}<div class="wrap">${ad('bb', 'rodape')}</div>`;
  write('index.html', layout({ x, body, canonical: '', jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: C.nome, url: C.url, description: C.descricao, inLanguage: 'pt-BR' } }));
}
function recentes(posts) {
  const x = ctx(1);
  write('recentes/index.html', layout({ x, title: 'Recentes', desc: 'Todos os artigos e notas do Clareou, do mais novo ao mais antigo.', canonical: 'recentes/', body: `${tabs(x, 'recentes/')}<section class="band"><div class="wrap cols"><div><div class="sechead"><div><h1 class="h2">Recentes</h1><p>Artigos e notas rápidas, do mais novo ao mais antigo.</p></div></div>${river(posts, x, 'feed')}</div>${rail(x, posts, 'r')}</div></section>` }));
}
function seguindo(posts) {
  const x = ctx(1);
  const tags = [...new Set(posts.flatMap(p => p.tags))].sort((a, b) => a.localeCompare(b, 'pt'));
  write('seguindo/index.html', layout({ x, title: 'Seguindo', desc: 'Escolha temas e monte o seu próprio fluxo de leitura.', canonical: 'seguindo/', body: `${tabs(x, 'seguindo/')}<section class="band"><div class="wrap cols"><div><div class="sechead"><div><h1 class="h2">Seguindo</h1><p>Escolha temas para montar o seu próprio fluxo. Fica salvo neste navegador.</p></div></div>
  <div class="chips" id="chips">${Object.keys(CATS).map(k => `<button class="btn fol" data-k="${k}" aria-pressed="false">${CATS[k].n}</button>`).join('')}${tags.map(t => `<button class="btn fol" data-k="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join('')}</div>
  <div id="follow-list"><p class="empty">Você ainda não segue nenhum tema. Toque em um acima.</p></div></div>${rail(x, posts, 's')}</div></section>` }));
}
function categoria(posts, k) {
  const x = ctx(2), c = CATS[k], list = posts.filter(p => p.cat === k);
  write(`categoria/${k}/index.html`, layout({ x, title: c.n, desc: c.d, canonical: `categoria/${k}/`, navCur: k, body: `<section class="ch" style="background:${c.c};color:${c.fg}"><div class="wrap"><span class="kick">Território</span><h1>${c.n}</h1><p>${c.d}</p><button class="btn fol ghost" data-k="${k}" aria-pressed="false">Seguir tema</button></div></section><div class="wrap">${ad('lb', 'topo')}</div><section class="band"><div class="wrap cols"><div>${river(list, x, 'feed')}</div>${rail(x, posts, 'c' + k)}</div></section>` }));
}
function artigo(posts, p) {
  const x = ctx(2);
  const rel3 = posts.filter(q => q !== p && q.cat === p.cat).concat(posts.filter(q => q.cat !== p.cat)).filter(q => q.tipo !== 'nota').slice(0, 3);
  let body = '', placed = false;
  for (const b of p.md.blocks) { body += b.html; if (!placed && b.t === 'p' && b.n === 3) { body += ad('mr', 'artigo'); placed = true; } }
  const share = encodeURIComponent(`${p.titulo} — ${C.url}/${p.url}`);
  const html = `<section class="band"><div class="wrap ag"><article class="ah">
 <div class="crumb"><a href="${x.L('')}">Início</a> / <a href="${x.L('categoria/' + p.cat + '/')}">${CATS[p.cat].n}</a></div>
 <div class="mt">${catTag(p.cat, x)}</div><h1>${esc(p.titulo)}</h1><p class="dek mute">${esc(p.linha)}</p>
 <div class="rev">${ev(p)}<span class="mono">Publicado · ${dataCurta(p.data)}</span><span class="mono">Leitura · ${esc(p.tempo)}</span><span>Redação Clareou</span></div>
 <div class="arch">${art(p)}</div>
 ${p.resumo.length ? `<div class="sum"><span class="kick">Resumo em 30 segundos</span><ul>${p.resumo.map(r => `<li>${inline(r)}</li>`).join('')}</ul></div>` : ''}
 <div class="acts share"><button class="btn copy" data-url="${esc(C.url + '/' + p.url)}"><svg aria-hidden="true"><use href="#i-link"/></svg><span>Copiar link</span></button><a class="btn" href="https://wa.me/?text=${share}" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-chat"/></svg>Enviar no WhatsApp</a><button class="btn fol" data-k="${p.cat}" aria-pressed="false">Seguir ${CATS[p.cat].n}</button></div>
 <div class="prose">${body}</div>
 <div class="aviso"><b>Conteúdo educativo.</b> Não substitui consulta médica e não indica produtos ou doses. Converse com um profissional de saúde.</div>
 ${p.tags.length ? `<div class="chips">${p.tags.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
 ${rel3.length ? `<section class="mt40"><div class="sechead"><h2 class="h2 s26">Leia também</h2></div>${rel3.map(q => cardA(q, x)).join('')}</section>` : ''}
 </article><aside class="rail">${p.md.toc.length ? `<nav class="box toc" aria-label="Neste artigo"><span class="kick">Neste artigo</span>${p.md.toc.map(([id, t]) => `<a href="#${id}">${inline(t)}</a>`).join('')}</nav>` : ''}
 <div class="ask"><h2>Ficou alguma dúvida?</h2><p>Mande sua pergunta. Respondemos com fontes, sem julgamento.</p><a class="btn pri" href="${x.L('pergunte/')}">Enviar pergunta</a></div>
 <div class="stick">${ad('mr', 'lateralFixo')}</div></aside></div></section>`;
  write(`${p.url}index.html`, layout({ x, title: p.titulo, desc: p.desc, canonical: p.url, navCur: p.cat, og: 'article', body: html,
    jsonld: { '@context': 'https://schema.org', '@type': 'Article', headline: p.titulo, description: p.desc, datePublished: p.data, dateModified: p.data, inLanguage: 'pt-BR', articleSection: CATS[p.cat].n, keywords: p.tags.join(', '), author: { '@type': 'Organization', name: C.nome }, publisher: { '@type': 'Organization', name: C.nome }, mainEntityOfPage: C.url + '/' + p.url } }));
}
function simples(slug, title, desc, inner, navCur, posts, head) {
  const x = ctx(1);
  write(`${slug}/index.html`, layout({ x, title, desc, canonical: slug + '/', navCur, body: `<section class="ch" style="${head || 'background:var(--nevoa)'}"><div class="wrap"><span class="kick">${esc(title === 'Pergunte' ? 'Pergunte' : C.nome)}</span><h1>${esc(title)}</h1><p>${esc(desc)}</p></div></section><section class="band"><div class="wrap cols"><div class="prose">${inner}</div>${rail(x, posts, slug)}</div></section>` }));
}
function paginas(posts) {
  const dir = path.join(ROOT, 'paginas');
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md'))) {
    const { meta: m, body } = frontmatter(fs.readFileSync(path.join(dir, f), 'utf8'));
    const txt = body.replace(/\{\{email\}\}/g, C.email).replace(/\{\{nome\}\}/g, C.nome).replace(/\{\{url\}\}/g, C.url);
    simples(f.replace(/\.md$/, ''), m.titulo || f, m.descricao || '', markdown(txt).blocks.map(b => b.html).join(''), '', posts);
  }
  simples('glossario', 'Glossário', 'Os termos que mais aparecem nas consultas e nos estudos, explicados em uma linha.', `<dl class="gl">${GLOSSARIO.map(([t, d]) => `<dt id="${slugify(t)}">${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>`, 'glossario', posts);
  simples('pergunte', 'Pergunte', 'Nenhuma pergunta é boba. Respondemos com fontes, sem julgamento, em textos públicos e sem identificar você.',
    `<form data-form="ask" class="askform"${C.perguntaAction ? ` action="${esc(C.perguntaAction)}" method="post" target="_blank"` : ''}><label class="kick" for="pq">Sua pergunta</label><textarea id="pq" name="pergunta" required placeholder="Ex.: o CBD interage com antidepressivos?"></textarea><label class="kick" for="pt">Território</label><select id="pt" name="territorio" class="fld">${Object.values(CATS).map(c => `<option>${c.n}</option>`).join('')}</select><label class="kick" for="pe">E-mail para avisarmos quando responder (opcional)</label><input id="pe" name="email" class="fld" type="email" autocomplete="email"><div><button class="btn pri">Enviar pergunta</button></div><p class="meta">Não respondemos com indicação de produto, marca ou dose.</p><p class="ok" aria-live="polite"></p></form>`,
    'pergunte', posts, 'background:var(--musgo);color:var(--manha)');
  const x = ctx(0);
  write('404.html', layout({ x: { pre: '/', L: p => '/' + p }, title: 'Página não encontrada', body: `<section class="band"><div class="wrap" style="max-width:720px"><span class="kick">Erro 404</span><h1 class="h2" style="font-size:44px;margin:12px 0">Essa página não clareou.</h1><p class="dek mute">O endereço pode ter mudado. Tente a busca no menu ou volte para o início.</p><a class="btn pri" href="/">Ir para o início</a></div></section>` }));
}
function extras(posts) {
  const urls = ['', 'recentes/', 'glossario/', 'pergunte/', 'sobre/', 'politica-editorial/', 'privacidade/', ...Object.keys(CATS).map(k => `categoria/${k}/`)];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${C.url}/${u}</loc></url>`).join('\n')}\n${posts.map(p => `<url><loc>${C.url}/${p.url}</loc><lastmod>${p.data}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(C.nome)}</title><link>${C.url}/</link><description>${esc(C.descricao)}</description><language>pt-BR</language>\n${posts.slice(0, 30).map(p => `<item><title>${esc(p.titulo)}</title><link>${C.url}/${p.url}</link><guid>${C.url}/${p.url}</guid><pubDate>${new Date(p.data + 'T08:00:00-03:00').toUTCString()}</pubDate><category>${esc(CATS[p.cat].n)}</category><description>${esc(p.linha)}</description></item>`).join('\n')}\n</channel></rss>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${C.url}/sitemap.xml\n`);
  if (C.adsenseClient) write('ads.txt', `google.com, ${C.adsenseClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);
  write('search.json', JSON.stringify(posts.map(p => ({ u: p.url, t: p.titulo, l: p.linha, c: p.cat, cn: CATS[p.cat].n, d: p.data, e: p.nivel, g: p.tags, x: norm([p.titulo, p.linha, p.tags.join(' '), p.md.blocks.map(b => b.html.replace(/<[^>]+>/g, '')).join(' ')].join(' ')).slice(0, 4000) }))));
  for (const f of fs.readdirSync(path.join(ROOT, 'assets'))) fs.copyFileSync(path.join(ROOT, 'assets', f), path.join(OUT, 'assets', f));
}

/* ---------- executar ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
const posts = loadPosts();
home(posts); recentes(posts); seguindo(posts);
Object.keys(CATS).forEach(k => categoria(posts, k));
posts.forEach(p => artigo(posts, p));
paginas(posts); extras(posts);
console.log(`Clareou: ${posts.length} posts → ${path.relative(process.cwd(), OUT) || 'dist'}/${PREVIEW ? ' (modo prévia)' : ''}`);
