/* ==========================================================================
   Amatly.com — San usullary: «Interpolýasiýa» (Lagranž, Nýuton) we «Ýakobi we Gauss–Zeýdel» panelleri.
   Hasaplaýyş: numeric-engine.js (window.AmatlyNumeric). Bu faýl girizmäni okaýar, netijäni,
   ädimleri we grafikleri görkezýär. Grafikler temanyň reňklerini CSS üýtgeýänlerinden alýar.
   ========================================================================== */
(function () {
  'use strict';
  const N = window.AmatlyNumeric;
  if (!N || !document.getElementById('panel-interp')) return;
  const root = document.documentElement;
  const $ = (id) => document.getElementById(id);
  const MINUS = '−';
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sub = N.sub;
  const sup = (n) => String(n).split('').map((d) => (d === '-' ? '⁻' : d === '+' ? '⁺' : SUP[+d])).join('');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cssVar = (name, fb) => { const v = getComputedStyle(root).getPropertyValue(name).trim(); return v || fb; };
  const fmt = (v, d) => N.fmtNum(v, d);
  /* kiçi we uly sanlar: 4.93·10⁻⁷, 10⁻⁶, 2.7·10⁹ */
  function sci(v, d) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e-3 && a < 1e7) return fmt(v, d === undefined ? 6 : d);
    let e = Math.floor(Math.log10(a));
    let m = (v / Math.pow(10, e)).toFixed(2).replace(/\.?0+$/, '');
    if (m === '10' || m === '-10') { m = m[0] === '-' ? '-1' : '1'; e += 1; }
    return (m === '1' ? '' : m === '-1' ? MINUS : m.replace('-', MINUS) + '·') + '10' + sup(e);
  }
  const big = (v, d) => (Math.abs(v) >= 1e7 ? sci(v) : fmt(v, d));
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function errBox(out, msg) {
    out.innerHTML = '';
    const b = el('div', 'result-box err'); b.setAttribute('role', 'alert'); b.textContent = '⚠ ' + msg;
    out.appendChild(b);
  }
  function table(headers, rows, cls) {
    let h = '<div class="iter-table-wrap' + (cls ? ' ' + cls : '') + '"><table class="iter-table"><thead><tr>' + headers.map((x) => '<th scope="col">' + x + '</th>').join('') + '</tr></thead><tbody>';
    rows.forEach((r) => { h += '<tr>' + r.map((c) => (typeof c === 'object' && c ? '<td class="' + (c.cls || '') + '">' + c.html + '</td>' : '<td>' + c + '</td>')).join('') + '</tr>'; });
    return h + '</tbody></table></div>';
  }
  const frac = (n, d) => '<span class="fr"><span class="fr-n">' + n + '</span><span class="sr-only">/</span><span class="fr-d">' + d + '</span></span>';

  /* ------------------------------------------------------------------ grafik (canvas) */
  const redraws = new Map();
  new MutationObserver(() => redraws.forEach((f) => f())).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => redraws.forEach((f) => f()), 150); });
  function niceStep(span, target) {
    const raw = span / target, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }
  /* cfg: {x0, x1, y0, y1, curves: [{f, color, width, dash}], series: [{pts: [[x, y]], color, dash, dots}],
          points: [{x, y, color, ring}], hlines: [{y, color, dash}], logY, intX} */
  function plot(canvas, cfg) {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(260, canvas.parentElement.clientWidth - 22), h = cfg.height || 260;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const C = { grid: cssVar('--nu-grid', '#e6e6e6'), axis: cssVar('--nu-axis', '#999'), ink: cssVar('--nu-ink', '#666'), bg: cssVar('--dk-bg-ffffff', '#fff') };
    const font = cssVar('--amx-font', 'sans-serif');
    const pad = { l: 52, r: 14, t: 12, b: 28 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    const { x0, x1, y0, y1 } = cfg;
    const X = (x) => pad.l + (x - x0) / (x1 - x0) * pw;
    const Y = (y) => pad.t + (1 - (y - y0) / (y1 - y0)) * ph;
    g.font = '11px ' + font;
    /* tor we bellikler */
    const xs = cfg.intX ? Math.max(1, Math.round(niceStep(x1 - x0, 8))) : niceStep(x1 - x0, 8);
    const ys = cfg.logY ? Math.max(1, Math.round(niceStep(y1 - y0, 6))) : niceStep(y1 - y0, 6);
    g.strokeStyle = C.grid; g.lineWidth = 1; g.fillStyle = C.ink;
    g.textAlign = 'center';
    for (let i = Math.ceil(x0 / xs - 1e-9); i * xs <= x1 + 1e-9; i++) {
      const x = +(i * xs).toPrecision(12), px = Math.round(X(x)) + 0.5;
      g.beginPath(); g.moveTo(px, pad.t); g.lineTo(px, pad.t + ph); g.stroke();
      g.fillText(fmt(x, 4), px, h - 9);
    }
    g.textAlign = 'right';
    for (let i = Math.ceil(y0 / ys - 1e-9); i * ys <= y1 + 1e-9; i++) {
      const y = +(i * ys).toPrecision(12), py = Math.round(Y(y)) + 0.5;
      g.beginPath(); g.moveTo(pad.l, py); g.lineTo(pad.l + pw, py); g.stroke();
      g.fillText(cfg.logY ? '10' + sup(Math.round(y)) : fmt(y, 4), pad.l - 6, py + 4);
    }
    g.strokeStyle = C.axis; g.lineWidth = 1.2;
    if (!cfg.logY && y0 < 0 && y1 > 0) { g.beginPath(); g.moveTo(pad.l, Y(0)); g.lineTo(pad.l + pw, Y(0)); g.stroke(); }
    if (x0 < 0 && x1 > 0) { g.beginPath(); g.moveTo(X(0), pad.t); g.lineTo(X(0), pad.t + ph); g.stroke(); }
    g.save();
    g.beginPath(); g.rect(pad.l, pad.t, pw, ph); g.clip();
    (cfg.hlines || []).forEach((l) => {
      g.strokeStyle = l.color; g.lineWidth = 1.2; g.setLineDash(l.dash || [5, 4]);
      g.beginPath(); g.moveTo(pad.l, Y(l.y)); g.lineTo(pad.l + pw, Y(l.y)); g.stroke(); g.setLineDash([]);
    });
    (cfg.curves || []).forEach((c) => {
      g.strokeStyle = c.color; g.lineWidth = c.width || 2.2; g.setLineDash(c.dash || []);
      g.beginPath();
      let pen = false;
      const M = Math.max(300, Math.round(pw * 1.5));
      for (let i = 0; i <= M; i++) {
        const x = x0 + (x1 - x0) * i / M;
        let y; try { y = c.f(x); } catch (e) { y = NaN; }
        if (!isFinite(y)) { pen = false; continue; }
        const py = Math.max(-4 * h, Math.min(5 * h, Y(y)));
        if (!pen) { g.moveTo(X(x), py); pen = true; } else g.lineTo(X(x), py);
      }
      g.stroke(); g.setLineDash([]);
    });
    (cfg.series || []).forEach((s) => {
      g.strokeStyle = s.color; g.lineWidth = s.width || 2; g.setLineDash(s.dash || []);
      g.beginPath();
      s.pts.forEach((p, i) => { if (i === 0) g.moveTo(X(p[0]), Y(p[1])); else g.lineTo(X(p[0]), Y(p[1])); });
      g.stroke(); g.setLineDash([]);
      if (s.dots !== false) {
        g.fillStyle = s.color;
        s.pts.forEach((p) => { g.beginPath(); g.arc(X(p[0]), Y(p[1]), 2.6, 0, 2 * Math.PI); g.fill(); });
      }
    });
    g.restore();
    (cfg.points || []).forEach((p) => {
      if (!isFinite(p.y) || p.y < y0 || p.y > y1) return;
      g.beginPath(); g.arc(X(p.x), Y(p.y), p.r || 5, 0, 2 * Math.PI);
      if (p.ring) { g.strokeStyle = p.color; g.lineWidth = 2.4; g.fillStyle = C.bg; g.fill(); g.stroke(); }
      else { g.fillStyle = p.color; g.strokeStyle = C.bg; g.lineWidth = 2; g.fill(); g.stroke(); }
    });
  }
  function graphBlock(id, legend, label) {
    return '<div class="graph-wrap"><canvas class="graph-canvas" id="' + id + '" role="img" aria-label="' + esc(label) + '"></canvas><div class="graph-legend">' + legend + '</div></div>';
  }
  const sw = (cls, color, text) => '<span><i class="swatch' + (cls ? ' ' + cls : '') + '" style="' + (cls === 'dashed' ? 'border-top-color:' : 'background:') + color + '"></i> ' + text + '</span>';

  /* ==================================================================== 1) INTERPOLÝASIÝA */
  /* takyk droblar gaty uzyn bolsa — onluk görnüşde görkezýäris */
  function viewOf(res) {
    const K = res.K;
    if (!K.exact) return { K, P: res.P, approx: false };
    const long = res.P.some((c) => String(c.d).length > 6 || String(c.n).length > 9);
    if (!long) return { K, P: res.P, approx: false };
    return { K: N.field(false), P: res.P.map((c) => c.valueOf()), approx: true };
  }
  const numH = (K, a) => N.htmlK(K, a);
  function absK(K, a) { return K.exact ? a.abs() : Math.abs(a); }
  function isOne(K, a) { return K.exact ? a.equals(1) : Math.abs(a - 1) < 1e-12; }
  function factorH(K, a) {
    if (K.isZero(a)) return 'x';
    return '(x ' + (K.num(a) < 0 ? '+' : MINUS) + ' ' + numH(K, absK(K, a)) + ')';
  }
  /* sanly (x* − xⱼ) ýa-da (xᵢ − xⱼ) */
  const wrapNeg = (K, a) => (K.num(a) < 0 ? '(' + numH(K, a) + ')' : numH(K, a));
  function diffH(K, a, b) { return '(' + numH(K, a) + ' ' + MINUS + ' ' + wrapNeg(K, b) + ')'; }
  function powH(i) { return i === 0 ? '' : i === 1 ? 'x' : 'x' + (i <= 9 ? SUP[i] : '<sup>' + i + '</sup>'); }
  function polyH(K, P) {
    let s = '';
    for (let i = P.length - 1; i >= 0; i--) {
      const c = P[i];
      if (K.isZero(c)) continue;
      const neg = K.num(c) < 0, a = absK(K, c);
      const term = i === 0 ? numH(K, a) : (isOne(K, a) ? '' : numH(K, a)) + powH(i);
      s += s ? ' ' + (neg ? MINUS : '+') + ' ' + term : (neg ? MINUS : '') + term;
    }
    return s || '0';
  }
  function valueH(K, v) {
    if (!K.exact) return fmt(v, 8);
    const isInt = String(v.d) === '1';
    return numH(K, v) + (isInt ? '' : ' ≈ ' + fmt(v.valueOf(), 8));
  }
  function samePoly(a, b) {
    const K = a.K;
    if (a.P.length !== b.P.length) return false;
    return a.P.every((c, i) => (K.exact ? c.equals(b.P[i]) : Math.abs(c - b.P[i]) <= 1e-9 * Math.max(1, Math.abs(c))));
  }

  function lagrangeSection(L, at) {
    const K = L.K;
    let h = '<section class="nu-sec" aria-labelledby="ip-lag-h"><h3 id="ip-lag-h">Lagranžyň usuly</h3>';
    h += '<p class="theory-text">Her nokat üçin bazis köpagzasy ℓᵢ(x) gurulýar: ol öz nokadynda 1-e, beýleki nokatlarda 0-a deň. Soňra P(x) = Σ yᵢ·ℓᵢ(x).</p>';
    h += '<details class="step-explain nu-basis"' + (L.n <= 4 ? ' open' : '') + '><summary>Bazis köpagzalary ℓ' + sub(0) + '(x), …, ℓ' + sub(L.n - 1) + '(x)</summary><ol class="nu-list">';
    L.basis.forEach((b) => {
      const num = b.factors.map((j) => factorH(K, L.xs[j])).join('');
      const den = b.factors.map((j) => diffH(K, L.xs[b.i], L.xs[j])).join('');
      h += '<li><span class="nu-math">ℓ' + sub(b.i) + '(x) = ' + frac(num, den) + ' = ' + frac(num, numH(K, b.den)) +
        (at ? ', &nbsp; ℓ' + sub(b.i) + '(' + numH(K, K.of(at)) + ') = ' + numH(K, b.at) : '') + '</span></li>';
    });
    h += '</ol></details>';
    const headers = ['i', 'xᵢ', 'yᵢ', 'ℓᵢ(x) — açylan görnüşi'].concat(at ? ['ℓᵢ(x*)', 'yᵢ·ℓᵢ(x*)'] : []);
    const rows = L.basis.map((b) => [String(b.i), numH(K, L.xs[b.i]), numH(K, L.ys[b.i]), polyH(K, b.li)].concat(at ? [numH(K, b.at), numH(K, K.mul(L.ys[b.i], b.at))] : []));
    h += table(headers, rows, 'nu-table');
    if (at) {
      const terms = L.basis.map((b) => wrapNeg(K, L.ys[b.i]) + '·' + wrapNeg(K, b.at)).join(' + ');
      h += '<p class="nu-math nu-sum">P(' + numH(K, K.of(at)) + ') = Σ yᵢ·ℓᵢ(x*) = ' + terms + ' = <b>' + numH(K, L.value) + '</b></p>';
    }
    return h + '</section>';
  }
  function newtonFormH(Nw) {
    const K = Nw.K;
    let s = '';
    Nw.coef.forEach((c, k) => {
      if (K.isZero(c)) return;
      const neg = K.num(c) < 0, a = absK(K, c);
      const fac = Array.from({ length: k }, (_, j) => factorH(K, Nw.xs[j])).join('');
      const term = k === 0 ? numH(K, a) : (isOne(K, a) ? '' : numH(K, a)) + fac;
      s += s ? ' ' + (neg ? MINUS : '+') + ' ' + term : (neg ? MINUS : '') + term;
    });
    return s || '0';
  }
  function newtonSection(Nw, at) {
    const K = Nw.K, n = Nw.n;
    let h = '<section class="nu-sec" aria-labelledby="ip-nw-h"><h3 id="ip-nw-h">Nýutonyň bölünen tapawutlar usuly</h3>';
    h += '<p class="theory-text">Bölünen tapawutlar tablisasynyň ýokarky setiri (sary öýjükler) Nýuton köpagzasynyň koeffisiýentleridir: c₀ = f[x₀], c₁ = f[x₀, x₁], c₂ = f[x₀, x₁, x₂], …</p>';
    const headers = ['i', 'xᵢ', 'f[xᵢ]'];
    for (let k = 1; k < n; k++) headers.push(k === 1 ? 'f[xᵢ, xᵢ₊₁]' : 'f[xᵢ, …, xᵢ₊' + sub(k) + ']');
    const rows = [];
    for (let i = 0; i < n; i++) {
      const r = [String(i), numH(K, Nw.xs[i])];
      for (let k = 0; k < n; k++) {
        if (i + k < n) r.push(i === 0 ? { cls: 'nu-coef', html: numH(K, Nw.dd[k][i]) } : numH(K, Nw.dd[k][i]));
        else r.push({ cls: 'nu-blank', html: '' });
      }
      rows.push(r);
    }
    h += table(headers, rows, 'nu-table');
    /* ilkinji tapawutlaryň hasaplanyşy */
    h += '<details class="step-explain"><summary>Bölünen tapawutlar nähili hasaplandy?</summary><ol>';
    for (let k = 1; k < n && k <= 4; k++) {
      const top = Nw.dd[k - 1][1], bot = Nw.dd[k - 1][0];
      const name = (i0, i1) => 'f[x' + sub(i0) + (i1 - i0 > 1 ? ', …, ' : ', ') + 'x' + sub(i1) + ']';
      const nameK = (i0, kk) => (kk === 0 ? 'f[x' + sub(i0) + ']' : name(i0, i0 + kk));
      h += '<li><span class="nu-math">' + name(0, k) + ' = ' + frac(nameK(1, k - 1) + ' ' + MINUS + ' ' + nameK(0, k - 1), 'x' + sub(k) + ' ' + MINUS + ' x' + sub(0)) +
        ' = ' + frac(numH(K, top) + ' ' + MINUS + ' ' + wrapNeg(K, bot), numH(K, Nw.xs[k]) + ' ' + MINUS + ' ' + wrapNeg(K, Nw.xs[0])) + ' = ' + numH(K, Nw.dd[k][0]) + '</span></li>';
    }
    h += '</ol>' + (n > 5 ? '<div class="step-more">Galan tapawutlar şol formula bilen hasaplanýar (tablisa serediň).</div>' : '') + '</details>';
    h += '<p class="nu-math">P(x) = ' + newtonFormH(Nw) + '</p>';
    if (at && Nw.nested) {
      const x = K.of(at);
      h += '<details class="step-explain"><summary>P(x*) bahasy içe salnan (Gorner) shema bilen</summary><ol>';
      h += '<li><span class="nu-math">b' + sub(n - 1) + ' = c' + sub(n - 1) + ' = ' + numH(K, Nw.coef[n - 1]) + '</span></li>';
      let prev = Nw.coef[n - 1];
      for (let t = 0; t < Nw.nested.length; t++) {
        const k = n - 2 - t;
        h += '<li><span class="nu-math">b' + sub(k) + ' = b' + sub(k + 1) + '·(x* ' + MINUS + ' x' + sub(k) + ') + c' + sub(k) + ' = ' + wrapNeg(K, prev) + '·' + diffH(K, x, Nw.xs[k]) + ' + ' + wrapNeg(K, Nw.coef[k]) + ' = ' + numH(K, Nw.nested[t]) + '</span></li>';
        prev = Nw.nested[t];
      }
      h += '</ol><div class="step-more">P(x*) = b₀ = ' + numH(K, Nw.value) + '. Bu shema köpagzany açmazdan, diňe n−1 köpeltmek bilen hasaplaýar.</div></details>';
    }
    return h + '</section>';
  }
  function interpPlot(res) {
    const L = res.lagrange, K = L.K;
    const xs = L.xs.map((v) => K.num(v)), ys = L.ys.map((v) => K.num(v));
    const P = L.P.map((c) => K.num(c));
    const Pf = (x) => { let r = 0; for (let i = P.length - 1; i >= 0; i--) r = r * x + P[i]; return r; };
    let lo = Math.min(...xs), hi = Math.max(...xs);
    if (res.at) { lo = Math.min(lo, res.at.v); hi = Math.max(hi, res.at.v); }
    const span = hi - lo || 1;
    const x0 = lo - span * 0.08, x1 = hi + span * 0.08;
    const sample = [];
    for (let i = 0; i <= 200; i++) { const x = x0 + (x1 - x0) * i / 200; sample.push(Pf(x)); if (res.fFn) { try { const v = res.fFn(x); if (isFinite(v)) sample.push(v); } catch (e) { /* */ } } }
    sample.push(...ys);
    let y0 = Math.min(...sample), y1 = Math.max(...sample);
    if (!isFinite(y0) || !isFinite(y1)) { y0 = -1; y1 = 1; }
    if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1; }
    const py = (y1 - y0) * 0.1; y0 -= py; y1 += py;
    const draw = () => {
      const c = $('ip-canvas');
      if (!c) { redraws.delete('ip'); return; }
      const C1 = cssVar('--nu-c1', '#2f77c9'), C2 = cssVar('--nu-c2', '#e8a33d'), C3 = cssVar('--nu-c3', '#4f9a3a'), INK = cssVar('--text', '#1a1a1a');
      const curves = [];
      if (res.fFn) curves.push({ f: res.fFn, color: C3, width: 2, dash: [6, 4] });
      curves.push({ f: Pf, color: C1, width: 2.4 });
      const points = xs.map((x, i) => ({ x, y: ys[i], color: C2 }));
      if (res.at) points.push({ x: res.at.v, y: K.num(L.value), color: INK, ring: true, r: 5.5 });
      plot(c, { x0, x1, y0, y1, curves, points });
    };
    redraws.set('ip', draw);
    draw();
  }
  function interpRender(res, mode) {
    const out = $('ip-output');
    const L = res.lagrange, Nw = res.newton, K = L.K;
    const view = viewOf(L);
    const at = res.at;
    const same = samePoly(L, Nw);
    let h = '<div class="result-box ok" role="status">';
    h += '<div class="result-root nu-poly">P(x) = ' + polyH(view.K, view.P) + '</div>';
    h += '<div class="result-meta">Nokat sany: ' + L.n + ' · köpagzanyň derejesi: ' + L.degree + ' · hasaplama: ' + (K.exact ? 'takyk droblarda' : 'onluk sanlarda') + (view.approx ? ' (koeffisiýentler gysgaldylyp görkezildi)' : '') + '</div>';
    if (at) {
      h += '<div class="result-info-line nu-big">P(' + numH(K, K.of(at)) + ') = <b>' + valueH(K, L.value) + '</b></div>';
      if (res.f !== undefined) h += '<div class="result-meta">f(x*) = ' + fmt(res.f, 8) + ' · hakyky ýalňyşlyk |f(x*) − P(x*)| ≈ ' + sci(res.err, 6) + '</div>';
      const xs = L.xs.map((v) => K.num(v));
      if (at.v < Math.min(...xs) || at.v > Math.max(...xs)) h += '<div class="result-warn-line">x* nokatlaryň aralygyndan daşarda: bu ekstrapolýasiýa, ýalňyşlyk uly bolup biler.</div>';
    }
    if (L.degree < L.n - 1) h += '<div class="result-info-line">Bu ' + L.n + ' nokat derejesi ' + L.degree + ' bolan köpagzanyň üstünde ýatýar, şonuň üçin dereje n − 1 = ' + (L.n - 1) + '-den kiçi.</div>';
    h += '<div class="result-info-line">' + (same ? '✓ Lagranž we Nýuton usullary şol bir köpagzany berdi (interpolýasiýa köpagzasy ýeke-täkdir).' : '⚠ Iki usulyň netijesi tegelekleme sebäpli birneme tapawutlanýar.') + '</div>';
    h += '</div>';
    const legend = sw('', cssVar('--nu-c1', '#2f77c9'), 'P(x)') + (res.fFn ? sw('dashed', cssVar('--nu-c3', '#4f9a3a'), 'f(x) = ' + esc(res.fText)) : '') +
      '<span><i class="swatch dot" style="background:' + cssVar('--nu-c2', '#e8a33d') + '"></i> berlen nokatlar</span>' + (at ? '<span><i class="swatch ring"></i> (x*, P(x*))</span>' : '');
    h += graphBlock('ip-canvas', legend, 'Interpolýasiýa köpagzasynyň grafigi we berlen nokatlar');
    if (mode !== 'newton') h += lagrangeSection(L, at);
    if (mode !== 'lagrange') h += newtonSection(Nw, at);
    out.innerHTML = h;
    interpPlot(res);
  }
  function interpRun() {
    const out = $('ip-output');
    try {
      const src = document.querySelector('input[name="ip-src"]:checked').value;
      const opts = { x: $('ip-x').value, at: $('ip-at').value };
      if (src === 'f') opts.f = $('ip-f').value; else opts.y = $('ip-y').value;
      if (src === 'f' && !String(opts.f).trim()) throw new N.NumError('f(x) funksiýany ýazyň (mysal: sin(x)).');
      const res = N.interpolate(opts);
      interpRender(res, $('ip-method').value);
    } catch (e) {
      if (!(e instanceof N.NumError)) console.error(e);
      errBox(out, e instanceof N.NumError ? e.message : 'Hasaplamada garaşylmadyk ýalňyşlyk: ' + e.message);
    }
  }
  function ipSource() {
    const f = document.querySelector('input[name="ip-src"]:checked').value === 'f';
    $('ip-y-wrap').hidden = f; $('ip-f-wrap').hidden = !f;
  }
  const IP_EX = {
    table: { x: '0, 1, 2, 4', y: '1, 3, 2, 5', at: '3', src: 'y' },
    sin: { x: '0, 0.5, 1, 1.5, 2', f: 'sin(x)', at: '1.2', src: 'f' },
    runge: { x: '-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1', f: '1/(1+25x^2)', at: '0.9', src: 'f' },
    frac: { x: '1/2, 1, 3/2, 2', y: '1/4, 1, 9/4, 4', at: '5/4', src: 'y' },
  };
  $('ip-form').addEventListener('submit', (e) => { e.preventDefault(); interpRun(); });
  document.querySelectorAll('input[name="ip-src"]').forEach((r) => r.addEventListener('change', ipSource));
  document.querySelectorAll('[data-ip-example]').forEach((b) => b.addEventListener('click', () => {
    const ex = IP_EX[b.dataset.ipExample];
    $('ip-x').value = ex.x; $('ip-at').value = ex.at || '';
    document.querySelector('input[name="ip-src"][value="' + ex.src + '"]').checked = true;
    if (ex.src === 'f') $('ip-f').value = ex.f; else $('ip-y').value = ex.y;
    ipSource();
    interpRun();
  }));
  ipSource();

  /* ==================================================================== 2) ÝAKOBI WE GAUSS–ZEÝDEL */
  const IT_EX = {
    d4: { A: [[10, -1, 2, 0], [-1, 11, -1, 3], [2, -1, 10, -1], [0, 3, -1, 8]], b: [6, 25, -11, 15] },
    d3: { A: [[4, -1, 1], [-1, 4, -2], [1, -2, 4]], b: [12, -1, 5] },
    swap: { A: [[1, 7, 1], [8, 1, 2], [1, 2, 9]], b: [-4, 11, 17] },
    div: { A: [[1, 2, 3], [2, 1, 2], [3, 2, 1]], b: [6, 5, 6] },
  };
  const numStr = (v) => String(v).replace('-', MINUS);
  function buildGrid(n, data) {
    const old = readGridRaw();
    let h = '<table class="nu-in"><caption class="sr-only">Ulgamyň koeffisiýentleri: A matrisa we b sütün</caption><thead><tr><th scope="col"><span class="sr-only">Deňleme</span></th>';
    for (let j = 0; j < n; j++) h += '<th scope="col">x' + sub(j + 1) + '</th>';
    h += '<th scope="col" class="nu-bar">b</th></tr></thead><tbody>';
    for (let i = 0; i < n; i++) {
      h += '<tr><th scope="row">' + (i + 1) + '</th>';
      for (let j = 0; j < n; j++) {
        const v = data ? data.A[i][j] : (old && old.A[i] && old.A[i][j] !== undefined ? old.A[i][j] : (i === j ? '1' : '0'));
        h += '<td><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-i="' + i + '" data-j="' + j + '" value="' + esc(numStr(v)) + '" aria-label="' + (i + 1) + '-nji deňleme, x' + sub(j + 1) + ' koeffisiýenti (a' + sub(i + 1) + sub(j + 1) + ')"></td>';
      }
      const bv = data ? data.b[i] : (old && old.b[i] !== undefined ? old.b[i] : '0');
      h += '<td class="nu-bar"><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-i="' + i + '" data-b="1" value="' + esc(numStr(bv)) + '" aria-label="' + (i + 1) + '-nji deňlemäniň sag tarapy (b' + sub(i + 1) + ')"></td></tr>';
    }
    $('it-grid').innerHTML = h + '</tbody></table>';
    $('it-grid').dataset.n = n;
    let x = '';
    for (let j = 0; j < n; j++) x += '<label class="nu-x0"><span>x' + sub(j + 1) + '⁽⁰⁾</span><input type="text" inputmode="decimal" autocomplete="off" data-x0="' + j + '" placeholder="0"></label>';
    $('it-x0').innerHTML = x;
  }
  function readGridRaw() {
    const g = $('it-grid'), n = +g.dataset.n;
    if (!n) return null;
    const A = [], b = [];
    for (let i = 0; i < n; i++) {
      A.push([]);
      for (let j = 0; j < n; j++) A[i].push(g.querySelector('input[data-i="' + i + '"][data-j="' + j + '"]').value);
      b.push(g.querySelector('input[data-i="' + i + '"][data-b]').value);
    }
    return { A, b };
  }
  function readNum(id, label) {
    const raw = $(id).value.trim().replace(',', '.').replace(MINUS, '-');
    const v = Number(raw);
    if (raw === '' || !isFinite(v)) throw new N.NumError('«' + label + '» meýdanyna dogry san ýazyň.');
    return v;
  }
  const supK = (t) => '⁽' + (typeof t === 'number' ? sup(t) : t) + '⁾';
  function coefTerm(a, j, first, tag) {
    /* − aᵢⱼ·xⱼ goşulyjysy (formula görnüşinde) */
    const neg = -a < 0, abs = Math.abs(a);
    const c = Math.abs(abs - 1) < 1e-15 ? '' : fmt(abs);
    return (first ? (neg ? MINUS : '') : (neg ? ' ' + MINUS + ' ' : ' + ')) + c + 'x' + sub(j + 1) + tag;
  }
  function formulaH(r, i) {
    const A = r.A, b = r.b, n = r.n;
    let num = fmt(b[i]);
    for (let j = 0; j < n; j++) {
      if (j === i || A[i][j] === 0) continue;
      const tag = r.method === 'seidel' && j < i ? supK('ᵏ⁺¹') : supK('ᵏ');
      num += coefTerm(A[i][j], j, false, tag);
    }
    return 'x' + sub(i + 1) + supK('ᵏ⁺¹') + ' = ' + frac(num, fmt(A[i][i]));
  }
  function substH(r, i, k) {
    /* k-njy ädimden k+1-e: sanlar goýlan görnüşi */
    const A = r.A, b = r.b, n = r.n, prev = r.rows[k].x, cur = r.rows[k + 1].x;
    let num = fmt(b[i]);
    for (let j = 0; j < n; j++) {
      if (j === i || A[i][j] === 0) continue;
      const v = r.method === 'seidel' && j < i ? cur[j] : prev[j];
      const neg = -A[i][j] < 0;
      num += (neg ? ' ' + MINUS + ' ' : ' + ') + fmt(Math.abs(A[i][j])) + '·' + (v < 0 ? '(' + fmt(v) + ')' : fmt(v));
    }
    return 'x' + sub(i + 1) + supK(k + 1) + ' = ' + frac(num, fmt(A[i][i])) + ' = ' + fmt(cur[i]);
  }
  function domTable(r) {
    const rows = r.dominance.rows.map((d) => [String((r.reordered ? r.reordered[d.i] : d.i) + 1) + (r.reordered ? ' → ' + (d.i + 1) : ''), fmt(d.d), fmt(d.s),
      d.strict ? { cls: 'nu-yes', html: '✓ |aᵢᵢ| &gt; Σ' } : d.weak ? { cls: 'nu-mid', html: '= deň' } : { cls: 'nu-no', html: '✗ |aᵢᵢ| &lt; Σ' }]);
    return table(['Setir', '|aᵢᵢ|', 'Σⱼ≠ᵢ |aᵢⱼ|', 'Netije'], rows, 'nu-table nu-dom');
  }
  const xVec = (x) => '(' + x.map((v) => big(v, 6)).join('; ') + ')';
  const ROW_LIMIT = 40;
  function iterRows(r) {
    const rows = [];
    const push = (row) => rows.push([String(row.k)].concat(row.x.map((v) => big(v, 7)), [row.err === null ? '—' : sci(row.err, 4)]));
    if (r.rows.length <= ROW_LIMIT) r.rows.forEach(push);
    else {
      r.rows.slice(0, 25).forEach(push);
      rows.push([{ cls: 'nu-gap', html: '⋮' }].concat(r.rows[0].x.map(() => ({ cls: 'nu-gap', html: '⋮' })), [{ cls: 'nu-gap', html: '⋮' }]));
      r.rows.slice(-10).forEach(push);
    }
    return rows;
  }
  function methodSection(r, idx) {
    const id = 'it-sec-' + r.method;
    let h = '<section class="nu-sec" aria-labelledby="' + id + '"><h3 id="' + id + '">' + (idx ? idx + '. ' : '') + r.name + ' usuly</h3>';
    const rho = isFinite(r.rho) ? fmt(r.rho, 4) : '—';
    if (r.status === 'converged') {
      h += '<div class="result-box ok" role="status"><div class="result-root">x ≈ ' + xVec(r.x) + '</div>';
      h += '<div class="result-meta">Gaýtalama sany: ' + r.iterations + ' · soňky max|Δ| ≈ ' + sci(r.rows[r.rows.length - 1].err, 4) + ' &lt; ε = ' + sci(r.eps) + ' · ρ(B) ≈ ' + rho + '</div>';
    } else if (r.status === 'diverge') {
      h += '<div class="result-box err" role="status"><div>Usul ýygnanmaýar — bahalar her ädimde ulalýar.</div>';
      h += '<div class="result-meta">ρ(B) ≈ ' + rho + ' ≥ 1: ' + r.iterations + ' ädimden soň max|Δ| ≈ ' + sci(r.rows[r.rows.length - 1].err, 4) + '. Diagonal agdyk ulgam alyň ýa-da deňlemeleriň tertibini üýtgediň; Gauss usuly bilen çözüp bolar.</div>';
    } else {
      h += '<div class="result-box warn" role="status"><div class="result-root">x ≈ ' + xVec(r.x) + '</div>';
      h += '<div class="result-warn-line">' + r.iterations + ' gaýtalamada ε çägine ýetilmedi (soňky max|Δ| ≈ ' + sci(r.rows[r.rows.length - 1].err, 4) + ').</div>';
      h += '<div class="result-meta">ρ(B) ≈ ' + rho + (r.rho < 1 ? ' &lt; 1 — usul ýygnanýar, ýöne haýal: gaýtalama sanyny artdyryň.' : ' ≥ 1 — usul ýygnanmaýar.') + '</div>';
    }
    if (r.exact && r.status !== 'diverge') h += '<div class="result-meta">Takyk çözgüt (Gauss): ' + xVec(r.exact) + ' · tapawut max|x − x*| ≈ ' + sci(r.diff, 4) + ' · galyndy max|Ax − b| ≈ ' + sci(r.residual, 4) + '</div>';
    h += '</div>';
    h += '<details class="step-explain"><summary>Iterasiýa formulalary we ilkinji ädimler</summary><ol>';
    for (let i = 0; i < r.n; i++) h += '<li><span class="nu-math">' + formulaH(r, i) + '</span></li>';
    h += '</ol>';
    const shown = Math.min(2, r.rows.length - 1);
    for (let k = 0; k < shown; k++) {
      h += '<div class="nu-step-k">k = ' + k + ' → ' + (k + 1) + (k === 0 ? ' (x⁽⁰⁾ = ' + xVec(r.rows[0].x) + ')' : '') + '</div><ol class="nu-sub">';
      for (let i = 0; i < r.n; i++) h += '<li><span class="nu-math">' + substH(r, i, k) + '</span></li>';
      h += '</ol>';
    }
    h += '<div class="step-more">' + (r.method === 'seidel' ? 'Gauss–Zeýdel usulynda şol ädimde täze tapylan x' + sub(1) + '⁽ᵏ⁺¹⁾, … bahalary derrew indiki deňlemä goýulýar.' : 'Ýakobi usulynda ähli täze bahalar diňe öňki ädimiň bahalaryndan hasaplanýar.') + '</div></details>';
    const headers = ['k'].concat(Array.from({ length: r.n }, (_, j) => 'x' + sub(j + 1) + '⁽ᵏ⁾'), ['max|Δ|']);
    h += table(headers, iterRows(r), 'nu-table nu-iter');
    return h + '</section>';
  }
  function convPlot(results, eps) {
    const ok = results.filter((r) => r.rows && r.rows.length > 1);
    if (!ok.length) return;
    const series = ok.map((r) => r.rows.slice(1).filter((row) => row.err > 0 && isFinite(row.err)).map((row) => [row.k, Math.log10(row.err)]));
    const all = series.flat().map((p) => p[1]).concat([Math.log10(eps)]);
    let y0 = Math.floor(Math.min(...all)) - 0.3, y1 = Math.ceil(Math.max(...all)) + 0.3;
    if (y1 - y0 < 2) y1 = y0 + 2;
    const kmax = Math.max(2, ...ok.map((r) => r.rows.length - 1));
    const draw = () => {
      const c = $('it-canvas');
      if (!c) { redraws.delete('it'); return; }
      const colors = { jacobi: cssVar('--nu-c1', '#2f77c9'), seidel: cssVar('--nu-c2', '#e8a33d') };
      plot(c, {
        x0: 0, x1: kmax + 0.5, y0, y1, logY: true, intX: true,
        series: ok.map((r, i) => ({ pts: series[i], color: colors[r.method], width: 2 })),
        hlines: [{ y: Math.log10(eps), color: cssVar('--nu-c4', '#b0413e'), dash: [5, 4] }],
      });
    };
    redraws.set('it', draw);
    draw();
  }
  function iterRun() {
    const out = $('it-output');
    try {
      const raw = readGridRaw();
      const sys = N.parseMatrix(raw.A, raw.b);
      const eps = readNum('it-tol', 'Ýalňyşlyk çägi (ε)');
      const maxIter = Math.round(readNum('it-iter', 'Iň köp gaýtalama sany'));
      const x0 = [...$('it-x0').querySelectorAll('input')].map((inp, j) => (inp.value.trim() === '' ? 0 : N.parseValue(inp.value, 'x' + sub(j + 1) + '⁽⁰⁾').v));
      const reorder = $('it-reorder').checked;
      const which = $('it-method').value;
      const methods = which === 'both' ? ['jacobi', 'seidel'] : [which];
      const results = methods.map((m) => N.iterate(sys, { method: m, eps, maxIter, x0, reorder }));
      const first = results[0];
      if (first.error) throw new N.NumError(first.error);
      let h = '<section class="nu-sec" aria-labelledby="it-dom-h"><h3 id="it-dom-h">Diagonal agdyklygy barlamak</h3>';
      const d0 = first.dominance0;
      if (first.reordered) {
        const why = first.reorderWhy === 'zero' ? 'Diagonalda nol bardy, şonuň üçin' : 'Berlen tertipde ulgam diagonal agdyk däldi, şonuň üçin';
        h += '<p class="theory-text">' + why + ' deňlemeleriň ornuny çalyşdyk: täze tertip — ' + first.reordered.map((i) => i + 1).join(', ') + '. (Deňlemeleriň ornuny çalyşmak çözgüdi üýtgetmeýär.)</p>';
      } else if (first.suggest) {
        h += '<p class="theory-text">Ulgam diagonal agdyk däl, ýöne deňlemeleri ' + first.suggest.map((i) => i + 1).join(', ') + ' tertibinde ýazsaňyz, agdyk bolýar — «ornuny çalyş» belgisini goýuň.</p>';
      }
      h += domTable(first);
      const dom = first.dominance;
      h += '<p class="nu-verdict ' + (dom.strict ? 'is-ok' : 'is-warn') + '">' + (dom.strict
        ? '✓ Ulgam diagonal agdyk: Ýakobi we Gauss–Zeýdel usullary islendik başlangyç bahada ýygnanýar.'
        : dom.weak ? '≈ Diagonal agdyklyk gowşak (käbir setirlerde deňlik). Ýygnanmak ρ(B) &lt; 1 şertine bagly.'
          : '✗ Ulgam diagonal agdyk däl. Bu ýeterlik şert däl, ýöne ýygnanmak indi diňe ρ(B) &lt; 1 şertine bagly.') + '</p>';
      void d0;
      h += '</section>';
      results.forEach((r, i) => { h += methodSection(r, methods.length > 1 ? i + 1 : 0); });
      if (results.length === 2) {
        const [J, S] = results;
        let cmp = '';
        if (J.status === 'converged' && S.status === 'converged') {
          const ratio = J.iterations / Math.max(1, S.iterations);
          cmp = S.iterations < J.iterations
            ? 'Gauss–Zeýdel ' + S.iterations + ' ädimde, Ýakobi ' + J.iterations + ' ädimde ýygnandy — Zeýdel ' + fmt(ratio, 1) + ' esse az ädim etdi.'
            : S.iterations === J.iterations ? 'Iki usul hem ' + S.iterations + ' ädimde ýygnandy.' : 'Bu gezek Ýakobi az ädim etdi: ' + J.iterations + ' we ' + S.iterations + '.';
        } else if (J.status !== 'converged' && S.status === 'converged') cmp = 'Ýakobi usuly ýygnanmady, Gauss–Zeýdel bolsa ' + S.iterations + ' ädimde ýygnandy.';
        else if (J.status === 'converged') cmp = 'Ýakobi ' + J.iterations + ' ädimde ýygnandy, Gauss–Zeýdel bolsa ýygnanmady.';
        else cmp = 'Iki usul hem ýygnanmady.';
        h += '<section class="nu-sec" aria-labelledby="it-cmp-h"><h3 id="it-cmp-h">Deňeşdirme</h3><p class="theory-text">' + cmp + ' Spektral radiuslar: ρ(B<sub>J</sub>) ≈ ' + fmt(J.rho, 4) + ', ρ(B<sub>GZ</sub>) ≈ ' + fmt(S.rho, 4) + ' — ρ näçe kiçi bolsa, ýalňyşlyk şonça çalt azalýar.</p>';
      } else h += '<section class="nu-sec" aria-labelledby="it-cmp-h"><h3 id="it-cmp-h">Ýygnanyş grafigi</h3>';
      const legend = results.map((r) => sw('', cssVar(r.method === 'jacobi' ? '--nu-c1' : '--nu-c2', '#2f77c9'), r.name)).join('') + sw('dashed', cssVar('--nu-c4', '#b0413e'), 'ε = ' + sci(eps));
      h += graphBlock('it-canvas', legend, 'Ýygnanyş grafigi: her ädimde max|Δ| (logarifmik şkala)') + '<p class="stop-note">Dik ok logarifmik: her bölek ýalňyşlygyň 10 esse azalmagyny aňladýar. Göni çyzyga golaý bolsa — çyzykly ýygnanyş, ýapgytlygy log₁₀ ρ(B).</p></section>';
      out.innerHTML = h;
      convPlot(results, eps);
    } catch (e) {
      if (!(e instanceof N.NumError)) console.error(e);
      errBox(out, e instanceof N.NumError ? e.message : 'Hasaplamada garaşylmadyk ýalňyşlyk: ' + e.message);
    }
  }
  $('it-n').addEventListener('change', () => buildGrid(+$('it-n').value));
  $('it-form').addEventListener('submit', (e) => { e.preventDefault(); iterRun(); });
  document.querySelectorAll('[data-it-example]').forEach((b) => b.addEventListener('click', () => {
    const ex = IT_EX[b.dataset.itExample];
    $('it-n').value = String(ex.A.length);
    buildGrid(ex.A.length, ex);
    $('it-reorder').checked = true;
    iterRun();
  }));
  buildGrid(3, IT_EX.d3);
})();
