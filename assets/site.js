/* Clareou — interações do site (menu, busca, novidades, temas seguidos, cookies). */
(() => {
  const B = document.body, base = B.dataset.base || '', preview = B.dataset.preview === '1';
  const $ = id => document.getElementById(id);
  const link = u => base + u + (preview && u.endsWith('/') ? 'index.html' : '');
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const dc = d => d.split('-').reverse().join('.');
  let F = load('cl-f', []), TH = load('cl-t', 'system'), CK = load('cl-c', null), SEEN = load('cl-seen', '');
  let DATA = null;
  const data = () => DATA ? Promise.resolve(DATA) : fetch(base + 'search.json').then(r => r.json()).then(d => (DATA = d)).catch(() => (DATA = []));

  /* tema */
  function applyTheme() {
    const r = document.documentElement; TH === 'system' ? r.removeAttribute('data-theme') : r.setAttribute('data-theme', TH);
    document.querySelectorAll('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', b.dataset.themeSet === TH));
  }

  /* camadas */
  const drawer = $('drawer'), scrim = $('scrim'), popn = $('popn'), modal = $('modal');
  function closeAll() { [drawer, popn, modal, scrim].forEach(e => e && e.classList.remove('on')); document.querySelectorAll('[aria-expanded]').forEach(b => b.setAttribute('aria-expanded', 'false')); }
  function openDrawer(search) { closeAll(); drawer.classList.add('on'); scrim.classList.add('on'); document.querySelector('[data-act=menu]').setAttribute('aria-expanded', 'true'); setTimeout(() => (search ? $('dq') : drawer.querySelector('button')).focus(), 60); if (search) data(); }

  /* busca */
  $('dq').addEventListener('input', () => {
    const v = norm($('dq').value.trim());
    if (!v) { $('dres').innerHTML = ''; return; }
    data().then(d => {
      const hits = d.filter(p => p.x.includes(v)).slice(0, 8);
      $('dres').innerHTML = hits.length ? hits.map(p => `<a href="${esc(link(p.u))}"><span class="kick mute">${esc(p.cn)}</span><b>${esc(p.t)}</b></a>`).join('') : '<p class="meta">Nenhum texto encontrado. Tente outra palavra.</p>';
    });
  });

  /* novidades (sino) */
  function bell() {
    data().then(d => {
      const latest = d[0]?.d || ''; $('bdot').hidden = !latest || latest <= SEEN;
      popn.innerHTML = `<span class="kick">Novidades</span>${d.slice(0, 5).map(p => `<a href="${esc(link(p.u))}"><span class="mono mute">${dc(p.d)} · ${esc(p.cn)}</span><br>${esc(p.t)}</a>`).join('') || '<p class="meta">Nada por aqui ainda.</p>'}<p class="meta" style="margin:10px 0 0">Siga temas em <a href="${esc(link('seguindo/'))}">Seguindo</a> para montar seu fluxo.</p>`;
    });
  }

  /* seguir temas */
  function syncFollow() {
    document.querySelectorAll('.fol').forEach(b => {
      const on = F.includes(b.dataset.k); b.setAttribute('aria-pressed', on);
      if (!b.closest('#chips')) b.textContent = b.textContent.replace(/^(Seguir|Seguindo)/, on ? 'Seguindo' : 'Seguir');
    });
    const fl = $('follow-list'); if (!fl) return;
    if (!F.length) { fl.innerHTML = '<p class="empty">Você ainda não segue nenhum tema. Toque em um acima.</p>'; return; }
    data().then(d => {
      const list = d.filter(p => F.includes(p.c) || (p.g || []).some(g => F.includes(g)));
      fl.innerHTML = list.length ? list.map(p => `<article class="card" style="grid-template-columns:minmax(0,1fr)"><div><span class="cat kick">${esc(p.cn)}</span><a class="lnk" href="${esc(link(p.u))}"><h3>${esc(p.t)}</h3></a><p>${esc(p.l)}</p><div class="meta"><time class="mono">${dc(p.d)}</time>${p.e ? `<span class="mono">Evidência · ${esc(p.e)}</span>` : ''}</div></div></article>`).join('') : '<p class="empty">Ainda não há textos nesses temas. Eles aparecem aqui assim que forem publicados.</p>';
    });
  }

  /* cookies (LGPD) */
  function consent(v) {
    if (typeof window.gtag === 'function') { const ok = v === 'todos'; window.gtag('consent', 'update', { analytics_storage: ok ? 'granted' : 'denied', ad_storage: ok ? 'granted' : 'denied', ad_user_data: ok ? 'granted' : 'denied', ad_personalization: ok ? 'granted' : 'denied' }); }
  }
  function cookie() {
    if (CK) { consent(CK); $('cookie').innerHTML = ''; return; }
    $('cookie').innerHTML = `<div class="cookie" role="region" aria-label="Aviso de privacidade"><p>Usamos cookies para o site funcionar, medir a audiência e exibir anúncios. Você escolhe. Saiba mais na <a href="${esc(link('privacidade/'))}">política de privacidade</a>.</p><div class="acts"><button class="btn" data-ck="essenciais">Só essenciais</button><button class="btn pri" data-ck="todos">Aceitar todos</button></div></div>`;
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('button,a'); if (!t) return; const act = t.dataset.act;
    if (act === 'menu') openDrawer(false);
    else if (act === 'search') openDrawer(true);
    else if (act === 'close') closeAll();
    else if (act === 'bell') { const on = !popn.classList.contains('on'); closeAll(); if (on) { popn.classList.add('on'); t.setAttribute('aria-expanded', 'true'); data().then(d => { SEEN = d[0]?.d || SEEN; save('cl-seen', SEEN); $('bdot').hidden = true; }); } }
    else if (act === 'news') { closeAll(); modal.classList.add('on'); scrim.classList.add('on'); setTimeout(() => modal.querySelector('input').focus(), 60); }
    else if (t.dataset.themeSet) { TH = t.dataset.themeSet; save('cl-t', TH); applyTheme(); }
    else if (t.dataset.ck) { CK = t.dataset.ck; save('cl-c', CK); cookie(); }
    else if (t.classList.contains('fol')) { const k = t.dataset.k; F = F.includes(k) ? F.filter(x => x !== k) : [...F, k]; save('cl-f', F); syncFollow(); }
    else if (t.classList.contains('copy')) {
      const sp = t.querySelector('span'), old = sp.textContent;
      Promise.resolve().then(() => navigator.clipboard.writeText(t.dataset.url)).then(() => { sp.textContent = 'Copiado'; }, () => { sp.textContent = 'Não foi possível copiar'; }).finally(() => setTimeout(() => { sp.textContent = old; }, 1800));
    }
    else if (t.tagName === 'A' && (drawer.contains(t) || popn.contains(t))) closeAll();
  });
  scrim.addEventListener('click', closeAll);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
  document.addEventListener('submit', e => {
    const f = e.target, kind = f.dataset.form; if (!kind) return;
    const live = (kind === 'news' && B.dataset.news === '1') || (kind === 'ask' && B.dataset.ask === '1');
    const o = f.querySelector('.ok');
    if (!live) { e.preventDefault(); if (o) o.textContent = kind === 'news' ? 'A newsletter abre em breve. Obrigado pelo interesse!' : 'O envio de perguntas abre em breve. Obrigado!'; return; }
    if (o) o.textContent = 'Enviado. Obrigado!';
  });

  applyTheme(); cookie(); syncFollow(); bell();
})();
