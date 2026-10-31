/* ==========================================================================
   Amatly.com — Algebra: n×n çyzykly deňlemeler ulgamynyň kalkulýatory (interfeýs).
   Hasaplamalar: linsys-engine.js (window.AmatlyLinSys, math.js droblary).
   Goşmaça: salgydaky #bölüm ýapyk derejede (tab) bolsa, şol derejäni açýar (gözlegden gelende).
   ========================================================================== */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduceMotion = () => document.documentElement.getAttribute('data-motion') === 'reduce' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ------------------------------------------------ #bölüm ýapyk derejede bolsa — derejäni açmak */
  function revealHash() {
    const id = decodeURIComponent((location.hash || '').slice(1));
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    const panel = el.closest('.level-panel');
    if (panel && panel.hidden) {
      const tab = document.querySelector('.level-tab[data-target="' + panel.id + '"]');
      if (tab) tab.click();
      requestAnimationFrame(() => el.scrollIntoView({ behavior: 'auto', block: 'start' }));
    }
  }
  window.addEventListener('hashchange', revealHash);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', revealHash); else revealHash();

  const L = window.AmatlyLinSys;
  if (!L || !$('lsPanel')) return;
  const STORE = 'amatly_linsys_v1';
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) { /* hökman däl */ } },
  };
  const PRESETS = [
    { id: 'u3', t: '3×3 — ýeke-täk', text: '2x + y − z = 8\n−3x − y + 2z = −11\n−2x + y + 2z = −3' },
    { id: 'u2', t: '2×2', text: '3x + 2y = 7\nx − y = −1' },
    { id: 'u4', t: '4×4', text: 'x1 + x2 + x3 + x4 = 10\n2x1 − x2 + x3 − x4 = −1\nx1 + 2x2 − x3 + 3x4 = 14\n3x1 + x2 + 2x3 − 2x4 = 3' },
    { id: 'fr', t: 'Droblar', text: 'x/2 + y/3 = 1\nx − y = 1/2' },
    { id: 'inf', t: 'Tükeniksiz köp çözgüt', text: 'x + 2y − z = 3\n2x + 4y − 2z = 6\nx − y + z = 2' },
    { id: 'none', t: 'Çözgüt ýok', text: 'x + y + z = 6\nx + y + z = 7\nx − y = 0' },
  ];
  let mode = 'text', numMode = 'frac';
  const fmt = (f) => (numMode === 'dec' ? esc(L.fDec(f, 4)) : L.fHtml(f));
  const vn = (v) => { const m = /^([A-Za-z]+)_?(\d+)$/.exec(v); return m ? '<i>' + esc(m[1]) + '</i><sub>' + m[2] + '</sub>' : '<i>' + esc(v) + '</i>'; };

  /* ------------------------------------------------ girizme */
  function buildGrid(m, n, data) {
    const wrap = $('lsGrid');
    let h = '<table class="ls-in"><caption class="sr-only">Ulgamyň koeffisiýentleri</caption><thead><tr><th scope="col"></th>';
    for (let j = 0; j < n; j++) h += '<th scope="col">x' + L.sub(j + 1) + '</th>';
    h += '<th scope="col" class="ls-bar">b</th></tr></thead><tbody>';
    for (let i = 0; i < m; i++) {
      h += '<tr><th scope="row">' + (i + 1) + '</th>';
      for (let j = 0; j < n; j++) {
        const v = data && data.A[i] && data.A[i][j] !== undefined ? data.A[i][j] : (i === j ? '1' : '0');
        h += '<td><input type="text" inputmode="decimal" autocomplete="off" data-i="' + i + '" data-j="' + j + '" value="' + esc(v) + '" aria-label="a' + L.sub(i + 1) + L.sub(j + 1) + '"></td>';
      }
      const bv = data && data.b[i] !== undefined ? data.b[i] : '0';
      h += '<td class="ls-bar"><input type="text" inputmode="decimal" autocomplete="off" data-i="' + i + '" data-b="1" value="' + esc(bv) + '" aria-label="b' + L.sub(i + 1) + '"></td></tr>';
    }
    wrap.innerHTML = h + '</tbody></table>';
    wrap.dataset.m = m; wrap.dataset.n = n;
  }
  function readGrid() {
    const wrap = $('lsGrid'), m = +wrap.dataset.m, n = +wrap.dataset.n;
    const A = [], b = [];
    for (let i = 0; i < m; i++) {
      A.push([]);
      for (let j = 0; j < n; j++) A[i].push(wrap.querySelector('input[data-i="' + i + '"][data-j="' + j + '"]').value);
      b.push(wrap.querySelector('input[data-i="' + i + '"][data-b]').value);
    }
    return { A, b };
  }
  function sysToGrid(sys) {
    $('lsM').value = sys.A.length; $('lsN').value = sys.vars.length;
    buildGrid(sys.A.length, sys.vars.length, { A: sys.A.map((r) => r.map((x) => x.toFraction())), b: sys.b.map((x) => x.toFraction()) });
  }
  function setMode(next) {
    if (next === mode) return;
    showErr('');
    try {
      if (next === 'grid') sysToGrid(L.parseEquations($('lsText').value));
      else { const g = readGrid(); $('lsText').value = L.toText(L.fromGrid(g.A, g.b)).replace(/-/g, '−'); }
    } catch (e) { if (next === 'grid' && !$('lsGrid').dataset.m) buildGrid(3, 3); showErr('Öňki girizmede ýalňyşlyk bardy, şonuň üçin ol geçirilmedi: ' + e.message); }
    mode = next;
    const t = mode === 'text';
    $('lsTabText').setAttribute('aria-selected', String(t)); $('lsTabGrid').setAttribute('aria-selected', String(!t));
    $('lsTabText').tabIndex = t ? 0 : -1; $('lsTabGrid').tabIndex = t ? -1 : 0;
    $('lsTextPanel').hidden = !t; $('lsGridPanel').hidden = t;
  }
  function showErr(msg) { const e = $('lsErr'); e.textContent = msg || ''; e.hidden = !msg; }

  /* ------------------------------------------------ çykyş */
  function matHtml(Mx, opts) {
    const o = opts || {};
    const n = Mx[0].length - (o.noAug ? 0 : 1);
    let h = '<div class="ls-scroll"><table class="ls-mat' + (o.noAug ? ' ls-sq' : '') + '"><tbody>';
    Mx.forEach((row, i) => {
      h += '<tr>';
      row.forEach((x, j) => {
        const cls = [];
        if (!o.noAug && j === n) cls.push('ls-bar');
        if (o.pivot && o.pivot.row === i && o.pivot.col === j) cls.push('ls-piv');
        if (o.col !== undefined && o.col === j) cls.push('ls-col');
        if (o.badRow === i) cls.push('ls-badrow');
        h += '<td' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') + '>' + fmt(x) + '</td>';
      });
      h += '</tr>';
    });
    return h + '</tbody></table></div>';
  }
  function eqHtml(row, b, vars) {
    let s = '';
    row.forEach((a, j) => {
      if (a.compare(0) === 0) return;
      const neg = a.compare(0) < 0, ab = a.abs();
      const k = ab.equals(1) ? '' : fmt(ab) + (numMode === 'dec' ? '·' : '');
      s += (s ? (neg ? ' − ' : ' + ') : (neg ? '−' : '')) + k + vn(vars[j]);
    });
    return (s || '0') + ' = ' + fmt(b);
  }
  function paramName(k) { return ['t', 's', 'r', 'p', 'q'][k] || 't' + (k + 1); }
  function exprHtml(e, free) {
    let s = '';
    if (e.c.compare(0) !== 0) s = fmt(e.c);
    e.d.forEach((d, k) => {
      if (d.compare(0) === 0) return;
      const neg = d.compare(0) < 0, ab = d.abs();
      const k2 = ab.equals(1) ? '' : fmt(ab);
      s += (s ? (neg ? ' − ' : ' + ') : (neg ? '−' : '')) + k2 + '<i>' + paramName(k) + '</i>';
    });
    void free;
    return s || '0';
  }
  function statusHtml(r) {
    const n = r.n;
    const rk = r.rankA !== undefined ? 'rang <i>A</i> = ' + r.rankA + ', rang (<i>A</i> | <i>b</i>) = ' + r.rankAb + ', näbelliler: ' + n + '. ' : '';
    if (r.status === 'unique') return '<p class="ls-status ok">✓ Ulgamyň <b>ýeke-täk çözgüdi</b> bar. <span>' + rk + (r.rankA !== undefined ? 'Ranglar deň we näbellileriň sanyna deň (Kroneker–Kapelli teoremasy).' : '') + '</span></p>';
    if (r.status === 'infinite') return '<p class="ls-status inf">∞ Ulgamyň <b>tükeniksiz köp çözgüdi</b> bar. <span>' + rk + 'Ranglar deň, ýöne näbellileriň sanyndan kiçi: ' + (n - r.rankA) + ' näbelli erkin.</span></p>';
    return '<p class="ls-status bad">✗ Ulgamyň <b>çözgüdi ýok</b> (ylalaşyksyz ulgam). <span>' + rk + 'rang <i>A</i> &lt; rang (<i>A</i> | <i>b</i>).</span></p>';
  }
  function render(sys, r) {
    const out = $('lsOut');
    let h = '<div class="ls-sys"><span class="ls-brace" aria-hidden="true">{</span><div>' + sys.A.map((row, i) => '<div>' + eqHtml(row, sys.b[i], sys.vars) + '</div>').join('') + '</div></div>';
    if (r.reason) h += '<p class="ls-note">' + esc(r.reason) + '</p>';
    if (r.method === 'cramer' && r.det) {
      h += '<h4>Kramer usuly</h4>';
      h += '<p>Esasy kesgitleýji — näbellileriň koeffisiýentlerinden düzülen matrisanyň kesgitleýjisi:</p>' + matHtml(sys.A, { noAug: true });
      h += '<p class="ls-calc">Δ = ' + esc(r.det.text) + (r.det.rule === 'sarrus' ? ' <span class="ls-muted">(Sarrus düzgüni)</span>' : '') + '</p>';
      if (r.dets) {
        h += '<p>Δ ≠ 0, şonuň üçin ulgamyň ýeke-täk çözgüdi bar. Her näbelli üçin Δ<sub><i>i</i></sub> kesgitleýjisinde <i>i</i>-nji sütün azat agzalar (<i>b</i>) bilen çalşylýar:</p>';
        r.dets.forEach((d) => {
          h += '<div class="ls-det"><div class="ls-det-h">Δ<sub>' + (d.j + 1) + '</sub> (' + vn(sys.vars[d.j]) + ' sütüni çalşyldy)</div>' + matHtml(d.A, { noAug: true, col: d.j }) + '<p class="ls-calc">Δ<sub>' + (d.j + 1) + '</sub> = ' + esc(d.text) + '</p></div>';
        });
        h += '<p class="ls-calc">' + sys.vars.map((v, j) => vn(v) + ' = Δ<sub>' + (j + 1) + '</sub> / Δ = ' + fmt(r.dets[j].value) + ' / ' + (r.det.value.compare(0) < 0 ? '(' + fmt(r.det.value) + ')' : fmt(r.det.value)) + ' = <b>' + fmt(r.x[j]) + '</b>').join('<br>') + '</p>';
      }
    }
    if (r.steps) {
      if (r.method === 'cramer') h += '<h4>Gauss usuly bilen derňew</h4>';
      else h += '<h4>' + (r.method === 'jordan' ? 'Gauss–Žordan usuly' : 'Gauss usuly: göni ýöriş') + '</h4>';
      r.steps.forEach((s, k) => {
        h += '<div class="ls-step"><div class="ls-step-h">' + esc(k === 0 ? s.title : s.title) + '</div>';
        if (s.ops && s.ops.length) h += '<ul class="ls-ops">' + s.ops.map((o) => '<li>' + esc(o) + '</li>').join('') + '</ul>';
        const last = k === r.steps.length - 1;
        h += matHtml(s.M, { pivot: s.pivot, badRow: last && r.status === 'none' ? r.bad : undefined }) + '</div>';
      });
      if (r.status === 'none') {
        const n = sys.vars.length;
        h += '<p class="ls-calc bad">' + (r.bad + 1) + '-nji setir: 0·' + vn(sys.vars[0]) + (n > 1 ? ' + … + 0·' + vn(sys.vars[n - 1]) : '') + ' = ' + fmt(r.echelon[r.bad][n]) + ' — bu mümkin däl (0 ≠ ' + fmt(r.echelon[r.bad][n]) + '), diýmek ulgamyň çözgüdi ýok.</p>';
      }
      if (r.back && r.method !== 'jordan' && r.method !== 'cramer') {
        h += '<h4>Yza ýöriş: aşakdan ýokary näbellileri tapýarys</h4><ol class="ls-back">';
        r.back.forEach((b) => {
          const row = r.echelon[r.pivots.find((p) => p.col === b.col).row];
          h += '<li>' + eqHtml(row.slice(0, sys.vars.length), row[sys.vars.length], sys.vars) + ' ⇒ <b>' + vn(sys.vars[b.col]) + ' = ' + fmt(b.x) + '</b></li>';
        });
        h += '</ol>';
      }
    }
    h += statusHtml(r);
    if (r.status === 'unique') {
      h += '<div class="answer">Jogap: ' + sys.vars.map((v, j) => vn(v) + ' = ' + fmt(r.x[j])).join(', &nbsp;') + '</div>';
      if (r.check) h += '<div class="ls-check"><b>Barlag</b> (tapylan bahalary deňlemelere goýýarys):<ul>' + r.check.map((c) => '<li>' + (c.i + 1) + '-nji deňleme: ' + fmt(c.lhs) + ' = ' + fmt(c.rhs) + ' ' + (c.ok ? '✓' : '✗') + '</li>').join('') + '</ul></div>';
    } else if (r.status === 'infinite' && r.general) {
      const g = r.general;
      h += '<div class="answer">Umumy çözgüt: ' + g.free.map((j, k) => vn(sys.vars[j]) + ' = <i>' + paramName(k) + '</i>').join(', ') + ' (erkin), ' +
        sys.vars.map((v, j) => (g.expr[j].free ? '' : vn(v) + ' = ' + exprHtml(g.expr[j], g.free))).filter(Boolean).join(', &nbsp;') + ', &nbsp;' + g.free.map((_, k) => '<i>' + paramName(k) + '</i>').join(', ') + ' ∈ ℝ</div>';
      h += '<p class="ls-muted">Mysal üçin, ' + g.free.map((_, k) => '<i>' + paramName(k) + '</i> = 0').join(', ') + ' bolanda: ' + sys.vars.map((v, j) => vn(v) + ' = ' + fmt(g.expr[j].c)).join(', ') + '.</p>';
      if (r.check && r.check0) h += '<div class="ls-check">✓ Barlag: umumy çözgüt parametrleriň 0 we 1 bahalarynda ähli deňlemeleri kanagatlandyrýar.</div>';
    } else if (r.status === 'none') {
      h += '<div class="answer warn">Jogap: çözgüt ýok.</div>';
    }
    out.innerHTML = h;
    out.hidden = false;
  }

  /* ------------------------------------------------ çözmek */
  function run(scroll) {
    showErr('');
    let sys;
    try {
      if (mode === 'text') sys = L.parseEquations($('lsText').value);
      else { const g = readGrid(); sys = L.fromGrid(g.A, g.b); }
    } catch (e) { showErr(e.message); $('lsOut').hidden = true; return; }
    numMode = $('lsNum').value;
    const r = L.solve(sys, { method: $('lsMethod').value });
    render(sys, r);
    store.set({ text: mode === 'text' ? $('lsText').value : L.toText(sys), method: $('lsMethod').value, num: numMode });
    if (scroll) $('lsOut').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' });
  }

  function init() {
    const ms = $('lsM'), ns = $('lsN');
    [ms, ns].forEach((s) => { for (let k = 1; k <= L.MAXN; k++) { const o = document.createElement('option'); o.value = k; o.textContent = k; s.appendChild(o); } });
    ms.value = 3; ns.value = 3;
    const regrid = () => { let data = null; try { data = readGrid(); } catch (e) { data = null; } buildGrid(+ms.value, +ns.value, data); };
    ms.addEventListener('change', regrid); ns.addEventListener('change', regrid);
    $('lsTabText').addEventListener('click', () => setMode('text'));
    $('lsTabGrid').addEventListener('click', () => setMode('grid'));
    [$('lsTabText'), $('lsTabGrid')].forEach((t) => t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); const to = mode === 'text' ? 'grid' : 'text'; setMode(to); $(to === 'text' ? 'lsTabText' : 'lsTabGrid').focus();
    }));
    $('lsSolve').addEventListener('click', () => run(true));
    $('lsMethod').addEventListener('change', () => { if (!$('lsOut').hidden) run(false); });
    $('lsNum').addEventListener('change', () => { if (!$('lsOut').hidden) run(false); });
    $('lsText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(true); } });
    const pl = $('lsPresets');
    pl.innerHTML = '<span>Mysallar:</span>' + PRESETS.map((p) => '<button type="button" class="similar-btn ls-pre" data-p="' + p.id + '">' + esc(p.t) + '</button>').join('');
    pl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-p]');
      if (!b) return;
      const p = PRESETS.find((x) => x.id === b.dataset.p);
      if (mode !== 'text') setMode('text');
      $('lsText').value = p.text;
      run(true);
    });
    const saved = store.get();
    if (saved && typeof saved.text === 'string') {
      $('lsText').value = saved.text.replace(/-/g, '−');
      if (saved.method) $('lsMethod').value = saved.method;
      if (saved.num) $('lsNum').value = saved.num;
    }
    buildGrid(3, 3);
  }
  init();
})();
