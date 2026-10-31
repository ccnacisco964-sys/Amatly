/* ==========================================================================
   Amatly.com — Amal barlagynyň täze sahypalary üçin umumy kömekçiler (window.AmatlyORUI).
   Sanlary görkezmek, girizme tablisalary, ýalňyşlyk habarlary, ýatda saklamak, SVG, «Amatly AI bilen düşündir».
   ========================================================================== */
(function () {
  'use strict';
  const root = document.documentElement;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const minus = (s) => String(s).replace(/-/g, '−');
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (n) => String(n).split('').map((d) => (/\d/.test(d) ? SUB[+d] : d)).join('');

  let numMode = 'frac';
  /* drob ýa-da onluk görnüş (Fraction) */
  function fmtF(f, mode) {
    if (f === null || f === undefined) return 'M';
    if ((mode || numMode) === 'dec') {
      const v = Math.round(f.valueOf() * 10000) / 10000;
      return minus(String(Object.is(v, -0) ? 0 : v));
    }
    return minus(f.toFraction());
  }
  /* takyk + takmyn: 7/3 ≈ 2.3333 */
  function fmtBoth(f) {
    const exact = minus(f.toFraction());
    if (exact.indexOf('/') < 0) return exact;
    const v = Math.round(f.valueOf() * 10000) / 10000;
    return numMode === 'dec' ? minus(String(v)) + ' <span class="or-muted">(' + exact + ')</span>' : exact + ' <span class="or-muted">≈ ' + minus(String(v)) + '</span>';
  }
  /* onluk san (CPM, ýollar) */
  function fmtN(v, d) {
    if (v === Infinity) return '∞';
    if (v === -Infinity) return '−∞';
    if (typeof v !== 'number' || !isFinite(v)) return '—';
    const k = Math.pow(10, d === undefined ? 2 : d);
    let r = Math.round(v * k) / k;
    if (Object.is(r, -0)) r = 0;
    return minus(String(r));
  }
  function vn(name) {
    const m = /^([A-Za-z]+)_?(\d+)$/.exec(name);
    return m ? '<i>' + esc(m[1]) + '</i><sub>' + m[2] + '</sub>' : '<i>' + esc(name) + '</i>';
  }
  function setNumMode(m) { numMode = m === 'dec' ? 'dec' : 'frac'; }
  /* çyzykly aňlatma: 3x₁ − x₂ + (1/2)·x₃ (Fraction koeffisiýentler) */
  function coefTerm(f, name, first) {
    const neg = f.compare(0) < 0, ab = f.abs();
    let k = ab.equals(1) ? '' : fmtF(ab);
    if (/[/.]/.test(k)) k += '·';
    return (first ? (neg ? '−' : '') : (neg ? ' − ' : ' + ')) + k + vn(name);
  }
  function lin(a, names) {
    let s = '';
    a.forEach((f, j) => { if (f.compare(0) !== 0) s += coefTerm(f, names[j], !s); });
    return s || '0';
  }
  const OP = { '<=': '≤', '>=': '≥', '=': '=' };

  /* ------------------------------------------------------------------ ýalňyşlyk */
  function showError(msg) {
    const box = $('errorBox');
    if (!box) return;
    if (!msg) { box.hidden = true; box.textContent = ''; return; }
    box.hidden = false;
    box.textContent = '⚠ ' + msg;
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------ ýatda saklamak (diňe şu brauzerde) */
  function store(key, obj) { try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) { /* hökman däl */ } }
  function restore(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } }

  /* ------------------------------------------------------------------ matrisa girizme tablisasy
     opts: {id, rows, cols, data (string[][]), rowNames, colNames, rowLabel(i), colLabel(j), cellLabel(i, j), names: bool, corner} */
  function matrixInput(wrap, o) {
    let h = '<table class="grid or-in"><caption class="sr-only">' + esc(o.caption || 'Girizme tablisasy') + '</caption><thead><tr><th scope="col" class="or-corner">' + (o.corner || '') + '</th>';
    for (let j = 0; j < o.cols; j++) {
      const nm = o.colNames && o.colNames[j] !== undefined ? o.colNames[j] : o.colLabel(j);
      h += '<th scope="col">' + (o.names ? '<input type="text" class="or-name" data-col-name="' + j + '" value="' + esc(nm) + '" aria-label="' + esc(o.colAria(j)) + '" maxlength="14" spellcheck="false">' : esc(nm)) + '</th>';
    }
    h += '</tr></thead><tbody>';
    for (let i = 0; i < o.rows; i++) {
      const nm = o.rowNames && o.rowNames[i] !== undefined ? o.rowNames[i] : o.rowLabel(i);
      h += '<tr><th scope="row">' + (o.names ? '<input type="text" class="or-name" data-row-name="' + i + '" value="' + esc(nm) + '" aria-label="' + esc(o.rowAria(i)) + '" maxlength="14" spellcheck="false">' : esc(nm)) + '</th>';
      for (let j = 0; j < o.cols; j++) {
        const v = o.data && o.data[i] && o.data[i][j] !== undefined ? o.data[i][j] : '';
        h += '<td><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-i="' + i + '" data-j="' + j + '" value="' + esc(minus(v)) + '" aria-label="' + esc(o.cellLabel(i, j)) + '"></td>';
      }
      h += '</tr>';
    }
    wrap.innerHTML = h + '</tbody></table>';
    wrap.dataset.rows = o.rows; wrap.dataset.cols = o.cols;
  }
  function readMatrixInput(wrap) {
    const m = +wrap.dataset.rows, n = +wrap.dataset.cols;
    const data = [], rowNames = [], colNames = [];
    for (let i = 0; i < m; i++) {
      data.push([]);
      for (let j = 0; j < n; j++) data[i].push(wrap.querySelector('input[data-i="' + i + '"][data-j="' + j + '"]').value);
      const rn = wrap.querySelector('input[data-row-name="' + i + '"]');
      rowNames.push(rn ? rn.value.trim() : '');
    }
    for (let j = 0; j < n; j++) { const cn = wrap.querySelector('input[data-col-name="' + j + '"]'); colNames.push(cn ? cn.value.trim() : ''); }
    return { data, rowNames, colNames, m, n };
  }
  /* Enter → indiki öýjük; ok düwmeleri bilen tablisada hereket */
  function gridKeys(wrap) {
    wrap.addEventListener('keydown', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement) || t.dataset.i === undefined) return;
      const i = +t.dataset.i, j = +t.dataset.j;
      let ni = i, nj = j;
      if (e.key === 'Enter') { e.preventDefault(); nj = j + 1; if (nj >= +wrap.dataset.cols) { nj = 0; ni = i + 1; } }
      else if (e.key === 'ArrowDown') ni = i + 1;
      else if (e.key === 'ArrowUp') ni = i - 1;
      else if (e.key === 'ArrowRight' && t.selectionStart === t.value.length) nj = j + 1;
      else if (e.key === 'ArrowLeft' && t.selectionStart === 0) nj = j - 1;
      else return;
      const next = wrap.querySelector('input[data-i="' + ni + '"][data-j="' + nj + '"]');
      if (next) { e.preventDefault(); next.focus(); next.select(); }
    });
  }

  /* ------------------------------------------------------------------ «Algoritma we düşündiriş» */
  function algoToggle() {
    const a = $('algoToggle'), box = $('algoInfo');
    if (!a || !box) return;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      box.hidden = !box.hidden;
      a.setAttribute('aria-expanded', String(!box.hidden));
      if (!box.hidden) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
  /* ------------------------------------------------------------------ mysallar (çipler) */
  function presets(list, onPick) {
    const wrap = $('presetList');
    if (!wrap) return;
    wrap.innerHTML = list.map((p) => '<button type="button" class="chip" data-preset="' + esc(p.id) + '" aria-pressed="false">' + esc(p.title) + '</button>').join('');
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-preset]');
      if (!b) return;
      wrap.querySelectorAll('[data-preset]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const p = list.find((x) => x.id === b.dataset.preset);
      const story = $('presetStory');
      if (story) { story.hidden = !p.story; story.textContent = p.story || ''; }
      onPick(p);
    });
  }
  function unmarkPresets() {
    document.querySelectorAll('#presetList [data-preset]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    const story = $('presetStory');
    if (story) story.hidden = true;
  }

  /* ------------------------------------------------------------------ SVG */
  const NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k]));
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* ------------------------------------------------------------------ Amatly AI */
  function askAI(question) {
    if (typeof window.AmatlyAsk === 'function') return window.AmatlyAsk(question);
    if (window.AmatlyAI && typeof window.AmatlyAI.ask === 'function') return window.AmatlyAI.ask(question);
    return false;
  }
  function aiButton(question, label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'classic-btn or-ai-btn';
    b.innerHTML = '<span aria-hidden="true">✦</span> ' + esc(label || 'Amatly AI bilen düşündir');
    b.addEventListener('click', () => { if (askAI(question) === false) b.textContent = 'Amatly AI häzir elýeterli däl'; });
    return b;
  }

  /* ------------------------------------------------------------------ tema üýtgände täzeden çyzmak */
  const redraws = new Map();
  new MutationObserver(() => redraws.forEach((f) => { try { f(); } catch (e) { /* */ } })).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => redraws.forEach((f) => { try { f(); } catch (e) { /* */ } }), 150); });
  const cssVar = (name, fb) => { const v = getComputedStyle(root).getPropertyValue(name).trim(); return v || fb; };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', algoToggle, { once: true });
  else algoToggle();

  window.AmatlyORUI = {
    $, esc, minus, sub, fmtF, fmtBoth, fmtN, vn, lin, OP, setNumMode, getNumMode: () => numMode,
    showError, store, restore, matrixInput, readMatrixInput, gridKeys, presets, unmarkPresets,
    svgEl, askAI, aiButton, redraws, cssVar,
  };
})();
