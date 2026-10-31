/* ==========================================================================
   Amatly.com — Trigonometriýa sahypasynyň interfeýsi (trigonometriya/index.html).
   Hasaplamalary trig-engine.js (window.AmatlyTrig, math.js bilen) edýär; bu faýl diňe girizmäni okaýar we
   netijäni görkezýär: birlik töwerek (SVG), geçiriji, bahalar, grafik (kanwas), toždestwo barlaýjy,
   ters funksiýalar, deňleme çözüji we türgenleşik.
   ========================================================================== */
(function () {
  'use strict';
  const T = window.AmatlyTrig;
  if (!T || !window.math) return;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PI = Math.PI;
  const root = document.documentElement;
  const NS = 'http://www.w3.org/2000/svg';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* hökman däl */ } },
  };
  function showErr(el, msg) { if (!el) return; el.textContent = msg || ''; el.hidden = !msg; }
  function cssVar(n, d) { return (getComputedStyle(root).getPropertyValue(n) || '').trim() || d; }
  const FN_NAME = { sin: 'sin', cos: 'cos', tg: 'tg', ctg: 'ctg', sec: 'sec', cosec: 'cosec' };
  const exactHtml = (v) => (v.defined ? v.html : v.html);
  function radHtml(a) { return a.q ? T.qHtml(a.q) : '≈ ' + T.fmtNum(a.rad, 6); }

  /* ------------------------------------------------------------------ 1) birlik töwerek */
  const uc = (function () {
    const svg = $('ucSvg');
    if (!svg) return null;
    const R = 140;
    let deg = 150, angle = T.parseAngle('150', 'deg'), drag = false;
    const el = (tag, attrs, parent) => {
      const n = document.createElementNS(NS, tag);
      Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k]));
      (parent || svg).appendChild(n);
      return n;
    };
    /* statik bölek */
    const gStatic = el('g', { 'aria-hidden': 'true' });
    [-140, -70, 70, 140].forEach((v) => {
      el('line', { class: 'uc-grid', x1: v, y1: -190, x2: v, y2: 190 }, gStatic);
      el('line', { class: 'uc-grid', x1: -190, y1: v, x2: 190, y2: v }, gStatic);
    });
    const quad = el('path', { class: 'uc-quad', d: '' }, gStatic);
    el('line', { class: 'uc-axis', x1: -192, y1: 0, x2: 192, y2: 0 }, gStatic);
    el('line', { class: 'uc-axis', x1: 0, y1: -192, x2: 0, y2: 192 }, gStatic);
    el('path', { class: 'uc-axis', d: 'M186 -4 192 0 186 4M-4 -186 0 -192 4 -186', fill: 'none' }, gStatic);
    const tx = (x, y, t, cls, anchor) => { const n = el('text', { x, y, class: cls || '', 'text-anchor': anchor || 'middle' }, gStatic); n.textContent = t; return n; };
    tx(184, 18, 'x', 'uc-lab'); tx(-12, -180, 'y', 'uc-lab'); tx(-10, 17, 'O', 'uc-lab');
    tx(134, 16, '1', '', 'end'); tx(-134, 16, '−1', '', 'start'); tx(6, -126, '1', '', 'start'); tx(6, 134, '−1', '', 'start');
    el('circle', { class: 'uc-circle', cx: 0, cy: 0, r: R }, gStatic);
    const tline = el('line', { class: 'uc-tline', x1: R, y1: -195, x2: R, y2: 195 }, gStatic);
    const cline = el('line', { class: 'uc-cline', x1: -195, y1: -R, x2: 195, y2: -R }, gStatic);
    for (let d = 0; d < 360; d += 15) {
      const c = Math.cos(d * PI / 180), s = Math.sin(d * PI / 180);
      const big = d % 30 === 0 || d % 45 === 0;
      el('line', { class: 'uc-tick', x1: (R - (big ? 7 : 4)) * c, y1: -(R - (big ? 7 : 4)) * s, x2: (R + (big ? 7 : 4)) * c, y2: -(R + (big ? 7 : 4)) * s }, gStatic);
    }
    const gLabels = el('g', { 'aria-hidden': 'true' });
    const LABS = [[30, 'π/6'], [45, 'π/4'], [60, 'π/3'], [90, 'π/2'], [120, '2π/3'], [135, '3π/4'], [150, '5π/6'], [180, 'π'], [210, '7π/6'], [225, '5π/4'], [240, '4π/3'], [270, '3π/2'], [300, '5π/3'], [315, '7π/4'], [330, '11π/6']];
    LABS.forEach(([d, t]) => {
      const c = Math.cos(d * PI / 180), s = Math.sin(d * PI / 180);
      const rr = d % 90 === 0 ? 162 : 170;
      const dx = d === 90 || d === 270 ? 14 : 0, dy = d === 180 ? -8 : 0;
      const n = el('text', { x: (rr * c + dx).toFixed(1), y: (-rr * s + 4 + dy).toFixed(1), 'text-anchor': d === 90 || d === 270 ? 'start' : 'middle' }, gLabels);
      n.textContent = t;
      n.setAttribute('style', 'font-size:11.5px');
      el('circle', { class: 'uc-tickdot', cx: (R * c).toFixed(1), cy: (-R * s).toFixed(1), r: 2.6 }, gLabels);
    });
    /* dinamiki bölek */
    const g = el('g', {});
    const arc = el('path', { class: 'uc-arc', d: '' }, g);
    const auxT = el('line', { class: 'uc-aux' }, g);
    const auxC = el('line', { class: 'uc-aux' }, g);
    const radius = el('line', { class: 'uc-radius', x1: 0, y1: 0 }, g);
    const tgSeg = el('line', { class: 'uc-tg' }, g);
    const ctgSeg = el('line', { class: 'uc-ctg' }, g);
    const cosSeg = el('line', { class: 'uc-cos', x1: 0, y1: 0 }, g);
    const sinSeg = el('line', { class: 'uc-sin' }, g);
    const pLab = el('text', { class: 'uc-lab' }, g); pLab.textContent = 'P';
    const aLab = el('text', { class: 'uc-lab' }, g); aLab.textContent = 'α';
    const hit = el('circle', { class: 'uc-hit', cx: 0, cy: 0, r: 190 });
    const handle = el('g', { class: 'uc-handle', tabindex: '0', role: 'slider', 'aria-label': 'α burç', 'aria-valuemin': '-720', 'aria-valuemax': '720' });
    const ring = el('circle', { class: 'uc-ring', r: 15 }, handle);
    const pt = el('circle', { class: 'uc-pt', r: 9 }, handle);

    const showTg = $('ucShowTg'), showCtg = $('ucShowCtg'), showLab = $('ucShowLabels'), snap = $('ucSnap');
    function set(a, fromUser) {
      angle = a;
      deg = a.deg;
      draw();
      readout();
      if (fromUser !== 'input') { const i = $('ucInput'); if (i && document.activeElement !== i) { i.value = String(Math.round(deg * 1e4) / 1e4); $('ucUnit').value = 'deg'; } }
    }
    function draw() {
      const r = deg * PI / 180, c = Math.cos(r), s = Math.sin(r);
      const X = R * c, Y = -R * s;
      radius.setAttribute('x2', X); radius.setAttribute('y2', Y);
      cosSeg.setAttribute('x2', X); cosSeg.setAttribute('y2', 0);
      sinSeg.setAttribute('x1', X); sinSeg.setAttribute('y1', 0); sinSeg.setAttribute('x2', X); sinSeg.setAttribute('y2', Y);
      pt.setAttribute('cx', X); pt.setAttribute('cy', Y); ring.setAttribute('cx', X); ring.setAttribute('cy', Y);
      /* P harpy töweregiň içinde, radiusyň ýanynda */
      const lx = 0.8 * X - 14 * s - 4, ly = 0.8 * Y - 14 * c + 5;
      pLab.setAttribute('x', lx.toFixed(1)); pLab.setAttribute('y', ly.toFixed(1));
      /* duga: [−360°; 360°] aralykda alamaty bilen */
      let a = deg % 360;
      if (Math.abs(a) < 1e-9 && Math.abs(deg) > 1e-9) a = 0;
      const ar = 34, steps = Math.max(2, Math.ceil(Math.abs(a) / 4));
      let d = 'M0 0 L' + ar + ' 0';
      for (let i = 1; i <= steps; i++) { const t = a * i / steps * PI / 180; d += ' L' + (ar * Math.cos(t)).toFixed(2) + ' ' + (-ar * Math.sin(t)).toFixed(2); }
      arc.setAttribute('d', Math.abs(a) < 0.5 ? '' : d + ' Z');
      const mid = a / 2 * PI / 180;
      aLab.setAttribute('x', (50 * Math.cos(mid) - 4).toFixed(1)); aLab.setAttribute('y', (-50 * Math.sin(mid) + 5).toFixed(1));
      aLab.style.display = Math.abs(a) < 12 ? 'none' : '';
      /* çärýek */
      const red = T.reduce(angle);
      const qd = red.axis === null || red.axis === undefined ? red.quad : 0;
      const QP = { 1: 'M0 0 L140 0 A140 140 0 0 0 0 -140 Z', 2: 'M0 0 L0 -140 A140 140 0 0 0 -140 0 Z', 3: 'M0 0 L-140 0 A140 140 0 0 0 0 140 Z', 4: 'M0 0 L0 140 A140 140 0 0 0 140 0 Z' };
      quad.setAttribute('d', QP[qd] || '');
      /* tg: x = 1 göni çyzykda; ctg: y = 1 göni çyzykda */
      const tOn = showTg && showTg.checked && Math.abs(c) > 1e-9, cOn = showCtg && showCtg.checked && Math.abs(s) > 1e-9;
      tline.style.display = showTg && showTg.checked ? '' : 'none';
      cline.style.display = showCtg && showCtg.checked ? '' : 'none';
      const lim = (v) => Math.max(-600, Math.min(600, v));
      if (tOn) {
        const ty = lim(-R * s / c);
        tgSeg.setAttribute('x1', R); tgSeg.setAttribute('y1', 0); tgSeg.setAttribute('x2', R); tgSeg.setAttribute('y2', ty);
        auxT.setAttribute('x1', 0); auxT.setAttribute('y1', 0); auxT.setAttribute('x2', R); auxT.setAttribute('y2', ty);
      }
      tgSeg.style.display = auxT.style.display = tOn ? '' : 'none';
      if (cOn) {
        const cx = lim(R * c / s);
        ctgSeg.setAttribute('x1', 0); ctgSeg.setAttribute('y1', -R); ctgSeg.setAttribute('x2', cx); ctgSeg.setAttribute('y2', -R);
        auxC.setAttribute('x1', 0); auxC.setAttribute('y1', 0); auxC.setAttribute('x2', cx); auxC.setAttribute('y2', -R);
      }
      ctgSeg.style.display = auxC.style.display = cOn ? '' : 'none';
      gLabels.style.display = showLab && showLab.checked ? '' : 'none';
      handle.setAttribute('aria-valuenow', String(Math.round(deg)));
      handle.setAttribute('aria-valuetext', T.degText(angle) + ' (' + T.radText(angle) + ')');
    }
    function readout() {
      const v = T.values(angle);
      $('ucDeg').textContent = T.degText(angle);
      $('ucRad').innerHTML = '= ' + radHtml(angle);
      const red = v.reduce;
      const meta = [];
      const axisName = ['položitel Ox oky', 'položitel Oy oky', 'otrisatel Ox oky', 'otrisatel Oy oky'];
      if (red.exact && red.axis !== null) meta.push('Ýagdaýy: <b>' + axisName[red.axis] + '</b>');
      else meta.push('Çärýek: <b>' + ['I', 'II', 'III', 'IV'][red.quad - 1] + '</b>');
      if (red.exact && red.axis === null) meta.push('Ýiti burç: <b class="mx">' + T.degText(T.angleQ(red.ref)) + '</b>');
      meta.push('<span class="mx"><i>P</i>(' + (v.cos.exact ? v.cos.html : v.cos.approx) + '; ' + (v.sin.exact ? v.sin.html : v.sin.approx) + ')</span>');
      $('ucMeta').innerHTML = meta.join('');
      [['sin', 'ucSin'], ['cos', 'ucCos'], ['tg', 'ucTg'], ['ctg', 'ucCtg']].forEach(([k, id]) => {
        const x = v[k];
        $(id).innerHTML = x.exact || !x.defined ? x.html : '<span class="muted">' + x.html + '</span>';
        $(id + 'A').textContent = x.defined && x.exact ? '≈ ' + x.approx : '';
      });
      document.querySelectorAll('#ucSpecial button').forEach((b) => b.setAttribute('aria-pressed', String(Math.abs(+b.dataset.deg - deg) < 1e-9)));
    }
    function fromPointer(e) {
      const pt0 = svg.createSVGPoint();
      pt0.x = e.clientX; pt0.y = e.clientY;
      const m = svg.getScreenCTM();
      if (!m) return;
      const p = pt0.matrixTransform(m.inverse());
      if (Math.hypot(p.x, p.y) < 6) return;
      let d = Math.atan2(-p.y, p.x) * 180 / PI;
      if (d < 0) d += 360;
      if (snap && snap.checked) { const s15 = Math.round(d / 15) * 15; if (Math.abs(s15 - d) < 5) d = s15; }
      d = Math.round(d) % 360;
      set(T.angleQ(window.math.fraction(d, 180)), 'drag');
    }
    hit.addEventListener('pointerdown', (e) => { drag = true; svg.classList.add('is-drag'); svg.setPointerCapture && svg.setPointerCapture(e.pointerId); fromPointer(e); handle.focus({ preventScroll: true }); });
    handle.addEventListener('pointerdown', (e) => { drag = true; svg.classList.add('is-drag'); svg.setPointerCapture && svg.setPointerCapture(e.pointerId); e.preventDefault(); handle.focus({ preventScroll: true }); });
    svg.addEventListener('pointermove', (e) => { if (drag) fromPointer(e); });
    const stop = () => { drag = false; svg.classList.remove('is-drag'); };
    svg.addEventListener('pointerup', stop); svg.addEventListener('pointercancel', stop);
    handle.addEventListener('keydown', (e) => {
      let step = 0;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step = e.shiftKey ? 15 : 1;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step = e.shiftKey ? -15 : -1;
      else if (e.key === 'PageUp') step = 15; else if (e.key === 'PageDown') step = -15;
      else if (e.key === 'Home') { e.preventDefault(); set(T.angleQ(window.math.fraction(0)), 'key'); return; }
      if (!step) return;
      e.preventDefault();
      const base = Number.isInteger(Math.round(deg * 1e6) / 1e6) ? Math.round(deg) : Math.round(deg);
      set(T.angleQ(window.math.fraction(base + step, 180)), 'key');
    });
    [showTg, showCtg, showLab].forEach((c) => c && c.addEventListener('change', draw));
    /* esasy burçlar */
    const sp = $('ucSpecial');
    [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330].forEach((d) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.deg = d; b.textContent = d + '°';
      b.addEventListener('click', () => set(T.angleQ(window.math.fraction(d, 180)), 'btn'));
      sp.appendChild(b);
    });
    $('ucForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const i = $('ucInput');
      try {
        const a = T.parseAngle(i.value, $('ucUnit').value);
        showErr($('ucErr'), ''); i.removeAttribute('aria-invalid');
        set(a, 'input');
      } catch (err) { showErr($('ucErr'), err.message); i.setAttribute('aria-invalid', 'true'); }
    });
    set(angle, 'init');
    return { set, get: () => angle };
  })();

  /* ------------------------------------------------------------------ 2) gradus ⇄ radian */
  (function () {
    const f = $('cvForm');
    if (!f) return;
    function run() {
      const inp = $('cvInput'), dir = $('cvDir').value, out = $('cvOut');
      try {
        const a = T.parseAngle(inp.value, dir);
        showErr($('cvErr'), '');
        let h;
        if (dir === 'deg') {
          h = '<div class="tg-final"><b class="mx">' + esc(T.degText(a)) + ' = ' + radHtml(a) + (a.q ? '' : '') + '</b>' + (a.q ? ' <span class="muted">≈ ' + T.fmtNum(a.rad, 6) + ' rad</span>' : ' rad') + '</div>';
          if (a.q) {
            const d = window.math.fraction(a.q).mul(180);
            h += '<p class="muted mx" style="white-space:normal">' + esc(T.degText(a)) + ' · <span class="fr"><span class="fr-n">π</span><span class="fr-d">180°</span></span> = <span class="fr"><span class="fr-n">' + esc(d.toFraction()) + 'π</span><span class="fr-d">180</span></span> = ' + T.qHtml(a.q) + '</p>';
          }
        } else {
          h = '<div class="tg-final"><b class="mx">' + radHtml(a) + ' rad = ' + esc(T.degText(a)) + '</b></div>';
          h += '<p class="muted mx" style="white-space:normal">' + radHtml(a) + ' · <span class="fr"><span class="fr-n">180°</span><span class="fr-d">π</span></span> = ' + esc(T.degText(a)) + '</p>';
        }
        out.innerHTML = h;
      } catch (err) { showErr($('cvErr'), err.message); out.innerHTML = ''; }
    }
    f.addEventListener('submit', (e) => { e.preventDefault(); run(); });
    run();
  })();

  /* ------------------------------------------------------------------ 3) bahalar */
  (function () {
    const f = $('valForm');
    if (!f) return;
    function run() {
      const out = $('valOut');
      try {
        const a = T.parseAngle($('valInput').value, $('valUnit').value);
        showErr($('valErr'), '');
        const v = T.values(a), fn = $('valFn').value;
        let h = '<div class="tg-res">';
        ['sin', 'cos', 'tg', 'ctg', 'sec', 'cosec'].forEach((k) => {
          const x = v[k];
          h += '<div><span class="k">' + FN_NAME[k] + ' α</span><span class="v mx">' + exactHtml(x) + '</span>' + (x.defined && x.exact ? '<span class="a">≈ ' + esc(x.approx) + '</span>' : '') + '</div>';
        });
        h += '</div>';
        const steps = T.reductionSteps(a, fn);
        const red = v.reduce, x = v[fn];
        let last = '';
        if (red.exact && x.exact) {
          if (red.axis === null && red.quad > 1) {
            const sgn = x.defined && x.v < 0 ? '−' : '';
            last = fn + ' ' + T.degText(a) + ' = ' + sgn + fn + ' ' + T.degText(T.angleQ(red.ref)) + ' = ';
          } else last = fn + ' ' + T.degText(a) + ' = ';
          steps.push('Tablisadan: <b class="mx">' + esc(last) + x.html + '</b>' + (x.defined ? '' : ' (bu burçda ' + fn + ' kesgitlenmedik: ' + (fn === 'tg' ? 'cos α = 0' : 'sin α = 0') + ')') + '.');
        } else if (!red.exact || !x.exact) {
          steps.push('Kalkulýator bilen: ' + fn + ' α ' + esc(x.html) + '.');
        }
        h += '<h4 style="margin:4px 0 6px">Ädimme-ädim (' + fn + ')</h4><ol class="tg-steps">' + steps.map((s) => '<li>' + (s.indexOf('<') >= 0 ? s : esc(s)) + '</li>').join('') + '</ol>';
        h += '<div class="tg-actions"><button type="button" class="tg-btn tg-btn--ghost" id="valShow">Birlik töwerekde görkez</button></div>';
        out.innerHTML = h;
        $('valShow').addEventListener('click', () => { if (uc) { uc.set(a); $('birlik-towerek').scrollIntoView({ behavior: root.getAttribute('data-motion') === 'reduce' ? 'auto' : 'smooth' }); } });
      } catch (err) { showErr($('valErr'), err.message); out.innerHTML = ''; }
    }
    f.addEventListener('submit', (e) => { e.preventDefault(); run(); });
    $('valFn').addEventListener('change', run);
    document.querySelectorAll('[data-val]').forEach((b) => b.addEventListener('click', () => {
      const [v, u] = b.dataset.val.split('|');
      $('valInput').value = v; $('valUnit').value = u; run();
    }));
    run();
  })();

  /* ------------------------------------------------------------------ kanwas grafik (umumy) */
  function makePlot(canvas, opts) {
    const o = Object.assign({ x0: -2 * PI, x1: 2 * PI, y0: -3, y1: 3 }, opts || {});
    function size() {
      const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth || 600, h = canvas.clientHeight || 300;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { g, w, h };
    }
    function piLabel(k) {
      /* k — π/2-niň kratnysy */
      if (k === 0) return '0';
      const q = window.math.fraction(k, 2), n = Number(q.n), d = Number(q.d), s = q.s < 0 ? '−' : '';
      return s + (n === 1 ? '' : n) + 'π' + (d === 1 ? '' : '/' + d);
    }
    return function draw(fns, marks, view) {
      const v = Object.assign({}, o, view || {});
      const { g, w, h } = size();
      const C = { grid: cssVar('--tg-grid', '#e3e9f4'), axis: cssVar('--tg-axis', '#8a96b2'), ink: cssVar('--amx-ink-2', '#4a5878'), bg: cssVar('--amx-surface', '#fff') };
      g.fillStyle = C.bg; g.fillRect(0, 0, w, h);
      const X = (x) => (x - v.x0) / (v.x1 - v.x0) * w, Y = (y) => h - (y - v.y0) / (v.y1 - v.y0) * h;
      g.lineWidth = 1; g.strokeStyle = C.grid;
      for (let k = Math.ceil(v.x0 / (PI / 2)); k * PI / 2 <= v.x1; k++) { const px = Math.round(X(k * PI / 2)) + 0.5; g.beginPath(); g.moveTo(px, 0); g.lineTo(px, h); g.stroke(); }
      const ys = Math.max(1, Math.ceil((v.y1 - v.y0) / 10));
      for (let y = Math.ceil(v.y0 / ys) * ys; y <= v.y1; y += ys) { const py = Math.round(Y(y)) + 0.5; g.beginPath(); g.moveTo(0, py); g.lineTo(w, py); g.stroke(); }
      g.strokeStyle = C.axis; g.lineWidth = 1.3;
      if (v.y0 < 0 && v.y1 > 0) { g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(w, Y(0)); g.stroke(); }
      if (v.x0 < 0 && v.x1 > 0) { g.beginPath(); g.moveTo(X(0), 0); g.lineTo(X(0), h); g.stroke(); }
      g.fillStyle = C.ink; g.font = '12px ' + cssVar('--amx-font', 'sans-serif'); g.textAlign = 'center';
      const y0px = v.y0 < 0 && v.y1 > 0 ? Y(0) : h - 4;
      const stepK = (v.x1 - v.x0) > 9 * PI ? 2 : 1;
      for (let k = Math.ceil(v.x0 / (PI / 2)); k * PI / 2 <= v.x1; k++) { if (k === 0 || k % stepK) continue; g.fillText(piLabel(k), X(k * PI / 2), Math.min(h - 4, y0px + 16)); }
      g.textAlign = 'right';
      for (let y = Math.ceil(v.y0 / ys) * ys; y <= v.y1; y += ys) { if (y === 0) continue; g.fillText(String(y).replace('-', '−'), (v.x0 < 0 && v.x1 > 0 ? X(0) : 30) - 5, Y(y) + 4); }
      fns.forEach((f) => {
        g.strokeStyle = f.color; g.lineWidth = f.width || 2.4; g.setLineDash(f.dash || []);
        g.beginPath();
        let pen = false, prev = null;
        const N = Math.max(400, Math.round(w * 1.5));
        for (let i = 0; i <= N; i++) {
          const x = v.x0 + (v.x1 - v.x0) * i / N;
          let y; try { y = f.f(x); } catch (e) { y = NaN; }
          if (!isFinite(y) || Math.abs(y) > 1e6 || (prev !== null && Math.abs(y - prev) > (v.y1 - v.y0) * 3)) { pen = false; prev = isFinite(y) ? y : null; continue; }
          const py = Math.max(-2000, Math.min(h + 2000, Y(y)));
          if (!pen) { g.moveTo(X(x), py); pen = true; } else g.lineTo(X(x), py);
          prev = y;
        }
        g.stroke(); g.setLineDash([]);
      });
      (marks || []).forEach((m) => {
        if (m.vline) { g.strokeStyle = m.color || C.axis; g.setLineDash([4, 4]); g.lineWidth = 1; g.beginPath(); g.moveTo(X(m.x), 0); g.lineTo(X(m.x), h); g.stroke(); g.setLineDash([]); return; }
        g.fillStyle = m.color; g.strokeStyle = C.bg; g.lineWidth = 2;
        g.beginPath(); g.arc(X(m.x), Y(m.y), 5, 0, 2 * PI); g.fill(); g.stroke();
      });
    };
  }
  const redraws = [];
  new MutationObserver(() => redraws.forEach((f) => f())).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => redraws.forEach((f) => f()), 120); });

  /* ------------------------------------------------------------------ 5) grafikler */
  (function () {
    const cv = $('grCanvas');
    if (!cv) return;
    const draw = makePlot(cv);
    const F = { sin: Math.sin, cos: Math.cos, tan: Math.tan, cot: (x) => 1 / Math.tan(x) };
    const NAME = { sin: 'sin', cos: 'cos', tan: 'tg', cot: 'ctg' };
    const ids = ['grA', 'grB', 'grC', 'grD'];
    function num(x) { return T.fmtNum(x, 2); }
    function cLabel(k) { return k === 0 ? '0' : T.qText(window.math.fraction(k, 12)); }
    function render() {
      const fn = $('grFn').value;
      const Av = +$('grA').value, B = +$('grB').value || 0.25, k = +$('grC').value, D = +$('grD').value, C = k * PI / 12;
      $('grAo').textContent = num(Av); $('grBo').textContent = num(B); $('grCo').textContent = cLabel(k); $('grDo').textContent = num(D);
      const f = F[fn];
      const lab = 'y = ' + (Av === 1 ? '' : Av === -1 ? '−' : num(Av) + '·') + NAME[fn] + '(' + (B === 1 ? '' : num(B)) + 'x' + (k ? (k > 0 ? ' + ' : ' − ') + cLabel(Math.abs(k)) : '') + ')' + (D ? (D > 0 ? ' + ' : ' − ') + num(Math.abs(D)) : '');
      $('grLab').textContent = lab;
      const span = Math.max(3, Math.abs(Av) + Math.abs(D) + 1);
      const marks = [];
      if (fn === 'tan' || fn === 'cot') {
        /* asimptotalar: Bx + C = π/2 + πn (tg) ýa-da πn (ctg) */
        for (let n = -12; n <= 12; n++) { const x = ((fn === 'tan' ? PI / 2 : 0) + PI * n - C) / B; if (x > -2 * PI && x < 2 * PI) marks.push({ vline: true, x }); }
      }
      const fs = [
        { f: (x) => f(x), color: cssVar('--amx-line-2', '#c7d2e6'), width: 1.6, dash: [5, 4] },
        { f: (x) => Av * f(B * x + C) + D, color: cssVar('--amx-lapis', '#2047c4'), width: 2.6 },
      ];
      draw(fs, marks, { y0: -span, y1: span });
      try {
        const wv = T.waveInfo(fn, Av, B, C, D);
        const props = [];
        if (wv.amplitude !== null) props.push('Amplituda: <b>' + num(wv.amplitude) + '</b>');
        props.push('Period: <b>T = ' + esc(wv.periodLabel) + '</b>');
        props.push('Faza süýşmesi: <b>' + esc(wv.shiftLabel === '0' ? '0' : (wv.shift > 0 ? 'saga ' : 'çepe ') + T.valueLabelPi(Math.abs(wv.shift))) + '</b>');
        props.push('Dik süýşme: <b>' + num(D) + '</b>');
        if (wv.range) props.push('Bahalar ýaýlasy: <b>[' + num(wv.range[0]) + '; ' + num(wv.range[1]) + ']</b>');
        $('grProps').innerHTML = props.join('');
      } catch (e) { $('grProps').textContent = e.message; }
    }
    ids.concat(['grFn']).forEach((id) => $(id).addEventListener('input', render));
    $('grFn').addEventListener('change', render);
    $('grReset').addEventListener('click', () => { $('grA').value = 1; $('grB').value = 1; $('grC').value = 0; $('grD').value = 0; render(); });
    redraws.push(render);
    render();
  })();

  /* ------------------------------------------------------------------ 6) toždestwo barlaýjy */
  (function () {
    const f = $('idForm');
    if (!f) return;
    function run() {
      const out = $('idOut');
      try {
        const r = T.checkIdentity($('idInput').value);
        showErr($('idErr'), '');
        if (!r.ok) { showErr($('idErr'), r.error); out.innerHTML = ''; return; }
        out.innerHTML = '<p><span class="tg-badge ' + (r.identity ? 'ok' : 'warn') + '">' + (r.identity ? '✓ Toždestwo' : '✗ Toždestwo däl') + '</span></p><p>' + esc(r.text) + '</p>' +
          (r.identity ? '<p class="muted" style="font-size:.88rem">San barlagy subutnama däl, ýöne ýalňyş formulany ynamly tapýar. Subut etmek üçin ýokardaky formulalardan peýdalanyň.</p>' : '');
      } catch (err) { showErr($('idErr'), err.message); out.innerHTML = ''; }
    }
    f.addEventListener('submit', (e) => { e.preventDefault(); run(); });
    document.querySelectorAll('.tg-f .chk').forEach((b) => b.addEventListener('click', () => {
      $('idInput').value = b.dataset.id.replace(/\btg\b/g, 'tg').replace(/\bctg\b/g, 'ctg');
      run();
      $('tozdestwo-barlayjy').scrollIntoView({ behavior: root.getAttribute('data-motion') === 'reduce' ? 'auto' : 'smooth', block: 'start' });
    }));
  })();

  /* ------------------------------------------------------------------ 7) ters funksiýalar */
  (function () {
    const f = $('invForm');
    if (!f) return;
    function run() {
      const out = $('invOut'), fn = $('invFn').value, inp = $('invInput');
      try {
        const r = T.inverse(fn, inp.value);
        showErr($('invErr'), ''); inp.removeAttribute('aria-invalid');
        if (!r.ok) { out.innerHTML = '<p class="tg-err">' + esc(r.error) + '</p>'; return; }
        const lab = T.valueLabel(r.v);
        let h = '<div class="tg-final"><b class="mx">' + fn + '(' + esc(lab) + ') = ' + (r.exact ? T.qHtml(r.angle.q) : '≈ ' + T.fmtNum(r.angle.rad, 6)) + '</b> <span class="muted">= ' + esc(T.degText(r.angle)) + '</span></div>';
        h += '<ol class="tg-steps">' + r.steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>';
        const back = { arcsin: 'sin', arccos: 'cos', arctg: 'tg', arcctg: 'ctg' }[fn];
        const val = T.values(r.angle)[back];
        h += '<p class="tg-check">✓ Barlag: ' + back + ' ' + esc(r.exact ? T.qText(r.angle.q) : T.fmtNum(r.angle.rad, 6)) + ' = ' + (val.exact ? val.html : esc(val.approx)) + '; burç ' + esc(r.range) + ' aralykda.</p>';
        out.innerHTML = h;
      } catch (err) { showErr($('invErr'), err.message); inp.setAttribute('aria-invalid', 'true'); out.innerHTML = ''; }
    }
    f.addEventListener('submit', (e) => { e.preventDefault(); run(); });
    document.querySelectorAll('[data-inv]').forEach((b) => b.addEventListener('click', () => { const [fn, v] = b.dataset.inv.split('|'); $('invFn').value = fn; $('invInput').value = v; run(); }));
    run();
  })();

  /* ------------------------------------------------------------------ 8) deňleme çözüji */
  (function () {
    const f = $('eqForm');
    if (!f) return;
    const METHOD = {
      basic: 'Iň ýönekeý deňleme', quadratic: 'Ornuna goýma: kwadrat deňleme', homogeneous: 'Bir jynsly deňleme', auxiliary: 'Kömekçi burç usuly',
      linear: 'Birinji derejeli bir jynsly deňleme', factor: 'Köpeldijilere dagytmak', equal: 'Bir atly funksiýalar', numeric: 'San usuly', identity: 'Toždestwo', none: 'Çözgüt ýok',
    };
    let plotDraw = null, lastRun = null;
    function interval() {
      const [a, b] = $('eqRange').value.split(',');
      const ev = (s) => window.math.evaluate(s);
      return { lo: ev(a), hi: ev(b), label: $('eqRange').selectedOptions[0].textContent };
    }
    function run() {
      const out = $('eqOut'), inp = $('eqInput');
      const iv = interval();
      let r;
      try { r = T.solveEquation(inp.value, { lo: iv.lo, hi: iv.hi }); }
      catch (err) { showErr($('eqErr'), err.message); inp.setAttribute('aria-invalid', 'true'); out.innerHTML = ''; return; }
      showErr($('eqErr'), ''); inp.removeAttribute('aria-invalid');
      const v = r.v;
      let h = '<p><span class="tg-badge">' + esc(METHOD[r.method] || r.method) + '</span></p>';
      if (r.steps.length) h += '<ol class="tg-steps">' + r.steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>';
      const all = [];
      if (r.identity) {
        h += '<div class="tg-final"><b>Jogap: ' + esc(v) + ' — islendik san</b> (deňleme toždestwo).</div>';
      } else if (r.method !== 'numeric') {
        if (r.branches.length) {
          h += '<h4 style="margin:6px 0">Umumy çözgüt</h4><div class="tg-gen">';
          r.branches.forEach((b) => {
            if (b.none) { h += '<div class="tg-branch none"><div class="why mx">' + esc(b.why || '') + '</div><div>' + esc(b.note || 'Çözgüt ýok.') + '</div></div>'; return; }
            if (b.all) { h += '<div class="tg-branch"><div class="why mx">' + esc(b.why || '') + '</div><div>' + esc(b.note) + '</div></div>'; return; }
            const ser = (b.x || []).map((s) => T.seriesHtml(s, v));
            ser.forEach((s) => all.push(s));
            h += '<div class="tg-branch"><div class="why mx">' + esc(b.why || '') + (b.special ? ' <span class="muted">(' + esc(b.special) + ')</span>' : '') + '</div>' +
              ser.map((s) => '<div class="ser mx">' + s + '</div>').join('') +
              (b.compact ? '<div class="cmp">Gysga ýazgy: <span class="mx">' + b.compact.html + '</span></div>' : '') + '</div>';
          });
          h += '</div>';
        }
        h += '<div class="tg-final"><b>Jogap:</b> ' + (all.length ? '<span class="mx" style="white-space:normal">' + all.join(';&nbsp; ') + ',&nbsp; <i>n</i> ∈ ℤ</span>' : 'çözgüt ýok') + '</div>';
      }
      if (r.method === 'numeric') {
        h += '<div class="tg-final"><b>Takmyny kökler (' + esc(iv.label) + '):</b> ' + (r.particular.length ? r.particular.map((p) => '<span class="mx">' + esc(v) + ' ≈ ' + T.fmtNum(p.x, 6) + '</span>').join(', ') : 'bu aralykda kök tapylmady') + '</div>';
        if (r.periodic) h += '<p class="muted">Deňlemedäki funksiýalaryň umumy periody 2π: beýleki kökler tapylanlara 2πn goşup alynýar.</p>';
      }
      if (!r.identity && r.particular.length && r.method !== 'numeric') {
        h += '<h4 style="margin:10px 0 6px">' + esc(iv.label) + ' aralykdaky çözgütler</h4><div class="tg-scroll"><table class="tg-tab"><thead><tr><th scope="col">№</th><th scope="col">' + esc(v) + ' (radian)</th><th scope="col">gradus</th><th scope="col">|çep − sag|</th></tr></thead><tbody>' +
          r.particular.map((p, i) => {
            const a = p.q ? T.angleQ(p.q) : T.angleRad(p.x);
            return '<tr><td>' + (i + 1) + '</td><td class="mx">' + (a.q ? T.qHtml(a.q) + ' <span class="muted">≈ ' + T.fmtNum(p.x, 4) + '</span>' : '≈ ' + T.fmtNum(p.x, 6)) + '</td><td>' + esc(T.degText(a)) + '</td><td>' + (isFinite(p.check) ? (p.check < 1e-12 ? '0' : p.check.toExponential(1)) : '—') + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      if (!r.identity && r.check && r.check.n) h += '<p class="tg-check">✓ Barlag: tapylan ' + r.check.n + ' bahanyň hemmesi deňlemä goýuldy — iki tarapyň tapawudy 10⁻⁹-dan kiçi.</p>';
      if (r.warnings) h += r.warnings.map((w) => '<p class="tg-note">' + esc(w) + '</p>').join('');
      if (!r.identity && r.method !== 'none') h += '<div class="tg-plot small" style="margin-top:12px"><canvas id="eqCanvas" role="img" aria-label="Deňlemäniň iki tarapynyň grafikleri we kesişme nokatlary"></canvas></div><div class="tg-legend"><span><i style="background:var(--amx-lapis)"></i>çep tarap</span><span><i style="background:var(--amx-madder)"></i>sag tarap</span><span><i style="background:var(--amx-saffron);height:9px;width:9px;border-radius:50%"></i>çözgütler</span></div>';
      h += '<div class="tg-actions"><button type="button" class="tg-btn tg-btn--ghost" id="eqAsk">Amatly AI bilen düşündir</button></div>';
      out.innerHTML = h;
      const cv = $('eqCanvas');
      if (cv) {
        const eq = T.parseEquation(inp.value);
        const cL = eq.L.compile(), cR = eq.R.compile();
        const ev = (c) => (x) => { const sc = {}; sc[eq.v] = x; try { const y = c.evaluate(sc); return typeof y === 'number' ? y : NaN; } catch (e) { return NaN; } };
        const fl = ev(cL), fr = ev(cR);
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i <= 200; i++) { const x = iv.lo + (iv.hi - iv.lo) * i / 200; [fl(x), fr(x)].forEach((y) => { if (isFinite(y) && Math.abs(y) < 50) { lo = Math.min(lo, y); hi = Math.max(hi, y); } }); }
        if (!isFinite(lo)) { lo = -2; hi = 2; }
        const pad = Math.max(0.5, (hi - lo) * 0.15);
        plotDraw = makePlot(cv, { x0: iv.lo, x1: iv.hi });
        lastRun = () => plotDraw([{ f: fl, color: cssVar('--amx-lapis', '#2047c4') }, { f: fr, color: cssVar('--amx-madder', '#b23a2e'), dash: [6, 4] }],
          r.particular.map((p) => ({ x: p.x, y: fl(p.x), color: cssVar('--amx-saffron', '#e9a23b') })), { y0: lo - pad, y1: hi + pad });
        lastRun();
      } else lastRun = null;
      $('eqAsk').addEventListener('click', () => {
        const q = inp.value.trim() + ' deňlemäni ädimme-ädim çözüň we umumy çözgüdi düşündiriň.';
        if (window.AmatlyAsk) window.AmatlyAsk(q);
        else if (window.AmatlyAI) window.AmatlyAI.ask(q);
      });
    }
    redraws.push(() => { if (lastRun) lastRun(); });
    f.addEventListener('submit', (e) => { e.preventDefault(); run(); });
    $('eqRange').addEventListener('change', run);
    document.querySelectorAll('[data-eq]').forEach((b) => b.addEventListener('click', () => {
      $('eqInput').value = b.dataset.eq;
      document.querySelectorAll('[data-eq]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      run();
    }));
    run();
  })();

  /* ------------------------------------------------------------------ 10) türgenleşik */
  (function () {
    const qEl = $('qzQ');
    if (!qEl) return;
    const BEST = 'amatly_trig_best';
    let ok = 0, all = 0, streak = 0, best = +(store.get(BEST) || 0) || 0, cur = null;
    $('qzBest').textContent = best;
    const LV = {
      1: [0, 30, 45, 60, 90],
      2: [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330],
      3: [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330],
    };
    const POOL = ['0', '1/2', '-1/2', 'sqrt(2)/2', '-sqrt(2)/2', 'sqrt(3)/2', '-sqrt(3)/2', '1', '-1', 'sqrt(3)', '-sqrt(3)', 'sqrt(3)/3', '-sqrt(3)/3', 'undef'];
    function htmlOf(key) {
      if (key === 'undef') return '<span class="undef">kesgitlenmedik</span>';
      const v = window.math.evaluate(key);
      /* tablisadan şol bahanyň owadan görnüşi */
      const html = { '0': '0', '1': '1', '-1': '−1' }[key];
      if (html) return html;
      const s = T.valueLabel(v);
      return esc(s).replace(/√(\d)/g, '<span class="sq">√<span class="sq-in">$1</span></span>').replace(/^(−?)(.+)\/(\d)$/, (m, sg, n, d) => sg + '<span class="fr"><span class="fr-n">' + n + '</span><span class="fr-d">' + d + '</span></span>');
    }
    function keyOf(val) {
      if (!val.defined) return 'undef';
      for (const k of POOL) if (k !== 'undef' && Math.abs(window.math.evaluate(k) - val.v) < 1e-12) return k;
      return null;
    }
    function next() {
      const lv = $('qzLevel').value;
      const angles = LV[lv];
      const d = angles[Math.floor(Math.random() * angles.length)];
      const fn = ['sin', 'cos', 'tg', 'ctg'][Math.floor(Math.random() * 4)];
      const a = T.angleQ(window.math.fraction(d, 180));
      const val = T.values(a)[fn];
      const key = keyOf(val);
      if (!key) return next();
      const opts = [key];
      const pool = POOL.filter((k) => k !== key);
      while (opts.length < 4) { const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; opts.push(k); }
      opts.sort(() => Math.random() - 0.5);
      cur = { a, fn, key, done: false };
      qEl.innerHTML = fn + ' ' + (lv === '3' ? T.qHtml(a.q) : esc(T.degText(a))) + ' = ?';
      $('qzOpts').innerHTML = opts.map((k) => '<button type="button" class="mx" data-k="' + k + '">' + htmlOf(k) + '</button>').join('');
      $('qzFb').textContent = '';
    }
    $('qzOpts').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-k]');
      if (!b || !cur || cur.done) return;
      cur.done = true; all++;
      const right = b.dataset.k === cur.key;
      if (right) { ok++; streak++; if (streak > best) { best = streak; store.set(BEST, String(best)); } } else streak = 0;
      $('qzOpts').querySelectorAll('button').forEach((x) => { x.disabled = true; if (x.dataset.k === cur.key) x.classList.add('ok'); else if (x === b) x.classList.add('bad'); });
      const st = T.reductionSteps(cur.a, cur.fn);
      $('qzFb').innerHTML = (right ? '<b class="tg-ok">Dogry!</b> ' : '<b style="color:var(--amx-madder)">Ýalňyş.</b> ') + esc(st[st.length - 1] || '');
      $('qzOk').textContent = ok; $('qzAll').textContent = all; $('qzStreak').textContent = streak; $('qzBest').textContent = best;
    });
    $('qzNew').addEventListener('click', next);
    $('qzLevel').addEventListener('change', next);
    next();
  })();
})();
