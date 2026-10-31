/* ==========================================================================
   Amatly.com — Trigonometriýa motory (DOM ulanmaýar): window.AmatlyTrig

   • Burçlary okamak: 150, 150°, -45°, 30°15'20", 5pi/6, 5π/6, 2.5 (radian) …
     Burç π-niň rasional paýy bolsa (gradusda rasional san), ähli hasaplamalar takyk droblarda (math.fraction).
   • Takyk bahalar: 15°, 18°, 22.5° we 30°-yň kratnylary üçin sin, cos, tg, ctg (√ we iç-içe kökler bilen),
     getiriş formulalary bilen ädimme-ädim (I–IV çärýek, ýiti burç, alamat).
   • Ters funksiýalar: arcsin, arccos, arctg, arcctg — takyk burç (π/3, 5π/6 …) ýa-da takmyny baha.
   • Deňlemeler: sin/cos/tg/ctg(kx + b) = a; sin, cos ýa-da tg boýunça kwadrat deňlemeler; bir jynsly deňlemeler;
     a·sin x + b·cos x = c (kömekçi burç); umumy köpeldijini çykarmak; iki esse burç (sin 2x, cos 2x).
     Galan ýagdaýlarda — aralykdaky kökler san usuly bilen. Her çözgüt deňlemä goýlup barlanýar.
   • Toždestwolary san taýdan barlamak.
   math.js (assets/vendor/math.js): parse / compile (aňlatmalar), fraction (takyk droblar).
   Synaglar: tests/trig.test.mjs (Node).
   ========================================================================== */
(function (root) {
  'use strict';

  function M() {
    const m = root.math;
    if (!m || typeof m.fraction !== 'function' || typeof m.parse !== 'function') throw new TrigError('math.js ýüklenmedi. assets/vendor/math.js faýlynyň ýerindedigini barlaň.');
    return m;
  }
  function TrigError(message) { this.name = 'TrigError'; this.message = message; }
  TrigError.prototype = Object.create(Error.prototype);
  TrigError.prototype.constructor = TrigError;

  const PI = Math.PI;
  const F = (a, b) => (b === undefined ? M().fraction(a) : M().fraction(a, b));
  const isF = (v) => v !== null && typeof v === 'object' && typeof v.toFraction === 'function';
  const fz = (f) => f.compare(0) === 0;
  /* položitel galyndy: q mod m ∈ [0, m) */
  function fmod(q, m) { return q.sub(m.mul(q.div(m).floor())); }
  const fnum = (f) => f.valueOf();
  const fstr = (f) => f.toFraction();
  function isInt(f) { return String(f.d) === '1'; }
  const MINUS = '−';
  const neg = (s) => String(s).replace(/-/g, MINUS);

  /* ------------------------------------------------------------------ sanlar */
  function fmtNum(v, digits) {
    if (v === null || v === undefined || typeof v !== 'number' || !isFinite(v)) return '—';
    const d = digits === undefined ? 6 : digits;
    const av = Math.abs(v);
    if (av !== 0 && (av < 1e-6 || av >= 1e9)) return neg(v.toExponential(4).replace(/\.?0+e/, 'e'));
    let s = v.toFixed(d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return neg(s);
  }
  /* takmyny san → ýönekeý drob (maýdalawjy ≤ maxDen), tapylmasa null */
  function rationalize(v, maxDen, tol) {
    if (!isFinite(v)) return null;
    const md = maxDen || 1000, t = tol === undefined ? 1e-11 : tol;
    let h0 = 0, h1 = 1, k0 = 1, k1 = 0, x = v;
    for (let i = 0; i < 40; i++) {
      const a = Math.floor(x);
      const h2 = a * h1 + h0, k2 = a * k1 + k0;
      if (k2 > md) break;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (Math.abs(v - h1 / k1) <= t * Math.max(1, Math.abs(v))) return F(h1, k1);
      const r = x - a;
      if (r < 1e-15) break;
      x = 1 / r;
    }
    return null;
  }
  function fracText(f) { return neg(fstr(f)); }
  function fracHtml(f) {
    const s = f.compare(0) < 0 ? MINUS : '';
    const a = f.abs();
    if (isInt(a)) return s + String(a.n);
    return s + '<span class="fr"><span class="fr-n">' + String(a.n) + '</span><span class="fr-d">' + String(a.d) + '</span></span>';
  }
  function fracTex(f) {
    const s = f.compare(0) < 0 ? '-' : '';
    const a = f.abs();
    return isInt(a) ? s + String(a.n) : s + '\\frac{' + String(a.n) + '}{' + String(a.d) + '}';
  }

  /* ------------------------------------------------------------------ takyk bahalar (kökli aňlatmalar) */
  /* baha = (Σ c·√r  ýa-da  √(Σ c·√r)) / d ; c — bitin, r — kwadratsyz, d — položitel bitin */
  function surd(terms, d, nested) { return { terms, d: d || 1, nested: !!nested }; }
  function surdValue(s) {
    const inner = s.terms.reduce((acc, t) => acc + t[0] * Math.sqrt(t[1]), 0);
    return (s.nested ? Math.sqrt(inner) : inner) / s.d;
  }
  function termsText(terms) {
    return terms.map((t, i) => {
      const c = t[0], r = t[1], ac = Math.abs(c);
      const body = r === 1 ? String(ac) : (ac === 1 ? '' : ac) + '√' + r;
      return (i === 0 ? (c < 0 ? MINUS : '') : (c < 0 ? ' ' + MINUS + ' ' : ' + ')) + body;
    }).join('');
  }
  function termsHtml(terms) {
    return terms.map((t, i) => {
      const c = t[0], r = t[1], ac = Math.abs(c);
      const body = r === 1 ? String(ac) : (ac === 1 ? '' : ac) + '<span class="sq">√<span class="sq-in">' + r + '</span></span>';
      return (i === 0 ? (c < 0 ? MINUS : '') : (c < 0 ? ' ' + MINUS + ' ' : ' + ')) + body;
    }).join('');
  }
  function termsTex(terms) {
    return terms.map((t, i) => {
      const c = t[0], r = t[1], ac = Math.abs(c);
      const body = r === 1 ? String(ac) : (ac === 1 ? '' : ac) + '\\sqrt{' + r + '}';
      return (i === 0 ? (c < 0 ? '-' : '') : (c < 0 ? '-' : '+')) + body;
    }).join('');
  }
  /* otrisatel köp agzaly (maýdalawjysyz, iç-içe däl) baha: alamaty agzalara paýlaýarys we položitel agzany öňe çykarýarys:
     −(2 − √3) → √3 − 2,  −(2 + √3) → −2 − √3 */
  function distribute(s, sign) {
    if (sign >= 0 || s.nested || s.d !== 1 || s.terms.length < 2) return null;
    const t = s.terms.map((x) => [-x[0], x[1]]);
    const pos = t.filter((x) => x[0] > 0), negs = t.filter((x) => x[0] < 0);
    return surd(pos.concat(negs), 1, false);
  }
  function surdText(s, sign) {
    const ds = distribute(s, sign);
    if (ds) return surdText(ds, 1);
    let core = termsText(s.terms);
    if (s.nested) core = '√(' + core + ')';
    if (s.d !== 1) core = (!s.nested && s.terms.length > 1 ? '(' + core + ')' : core) + '/' + s.d;
    return (sign < 0 ? MINUS : '') + core;
  }
  function surdHtml(s, sign) {
    const ds = distribute(s, sign);
    if (ds) return surdHtml(ds, 1);
    let core = termsHtml(s.terms);
    if (s.nested) core = '<span class="sq">√<span class="sq-in">' + core + '</span></span>';
    if (s.d !== 1) core = '<span class="fr"><span class="fr-n">' + core + '</span><span class="fr-d">' + s.d + '</span></span>';
    return (sign < 0 ? MINUS : '') + core;
  }
  function surdTex(s, sign) {
    const ds = distribute(s, sign);
    if (ds) return surdTex(ds, 1);
    let core = termsTex(s.terms);
    if (s.nested) core = '\\sqrt{' + core + '}';
    if (s.d !== 1) core = '\\frac{' + core + '}{' + s.d + '}';
    return (sign < 0 ? '-' : '') + core;
  }

  const Z0 = surd([[0, 1]]), ONE = surd([[1, 1]]);
  /* ýiti burçlar (π-niň paýy) */
  const REF = ['0', '1/12', '1/10', '1/8', '1/6', '1/5', '1/4', '3/10', '1/3', '3/8', '2/5', '5/12', '1/2'];
  const SIN_T = {
    '0': Z0,
    '1/12': surd([[1, 6], [-1, 2]], 4),
    '1/10': surd([[1, 5], [-1, 1]], 4),
    '1/8': surd([[2, 1], [-1, 2]], 2, true),
    '1/6': surd([[1, 1]], 2),
    '1/5': surd([[10, 1], [-2, 5]], 4, true),
    '1/4': surd([[1, 2]], 2),
    '3/10': surd([[1, 1], [1, 5]], 4),
    '1/3': surd([[1, 3]], 2),
    '3/8': surd([[2, 1], [1, 2]], 2, true),
    '2/5': surd([[10, 1], [2, 5]], 4, true),
    '5/12': surd([[1, 6], [1, 2]], 4),
    '1/2': ONE,
  };
  const TAN_T = {
    '0': Z0,
    '1/12': surd([[2, 1], [-1, 3]]),
    '1/10': surd([[25, 1], [-10, 5]], 5, true),
    '1/8': surd([[1, 2], [-1, 1]]),
    '1/6': surd([[1, 3]], 3),
    '1/5': surd([[5, 1], [-2, 5]], 1, true),
    '1/4': ONE,
    '3/10': surd([[25, 1], [10, 5]], 5, true),
    '1/3': surd([[1, 3]]),
    '3/8': surd([[1, 2], [1, 1]]),
    '2/5': surd([[5, 1], [2, 5]], 1, true),
    '5/12': surd([[2, 1], [1, 3]]),
    '1/2': null,
  };
  /* sec, cosec — diňe esasy burçlar üçin takyk */
  const SEC_T = { '0': ONE, '1/6': surd([[2, 3]], 3), '1/4': surd([[1, 2]]), '1/3': surd([[2, 1]]), '1/2': null };
  function compl(key) { return F(1, 2).sub(F(key)).toFraction(); }

  function exactVal(spec, sign) {
    if (spec === null) return { defined: false, exact: true, v: NaN, text: 'kesgitlenmedik', html: '<span class="undef">kesgitlenmedik</span>', tex: '\\text{kesgitlenmedik}' };
    const v0 = surdValue(spec);
    if (v0 === 0) return { defined: true, exact: true, v: 0, text: '0', html: '0', tex: '0' };
    const sg = sign < 0 ? -1 : 1;
    return { defined: true, exact: true, v: sg * v0, text: surdText(spec, sg), html: surdHtml(spec, sg), tex: surdTex(spec, sg) };
  }
  function numVal(v) {
    if (!isFinite(v) || Math.abs(v) > 1e14) return { defined: false, exact: false, v: NaN, text: 'kesgitlenmedik', html: '<span class="undef">kesgitlenmedik</span>', tex: '\\text{kesgitlenmedik}' };
    const t = fmtNum(v, 6);
    return { defined: true, exact: false, v, text: '≈ ' + t, html: '≈ ' + t, tex: '\\approx ' + t.replace(MINUS, '-') };
  }

  /* ------------------------------------------------------------------ burçlar */
  /* burç: { q: π-niň paýy (Fraction) ýa-da null, rad, deg, exact } */
  function angleQ(q) { return { q, rad: fnum(q) * PI, deg: fnum(q) * 180, exact: true }; }
  function angleRad(r) {
    const q = rationalize(r / PI, 720, 1e-13);
    return q ? angleQ(q) : { q: null, rad: r, deg: r * 180 / PI, exact: false };
  }
  function qText(q, sym) {
    const s = sym || 'π';
    if (fz(q)) return '0';
    const sg = q.compare(0) < 0 ? MINUS : '', a = q.abs(), n = String(a.n), d = String(a.d);
    return sg + (n === '1' ? '' : n) + s + (d === '1' ? '' : '/' + d);
  }
  function qHtml(q, sym) {
    const s = sym || 'π';
    if (fz(q)) return '0';
    const sg = q.compare(0) < 0 ? MINUS : '', a = q.abs(), n = String(a.n), d = String(a.d);
    const top = (n === '1' ? '' : n) + s;
    return sg + (d === '1' ? top : '<span class="fr"><span class="fr-n">' + top + '</span><span class="fr-d">' + d + '</span></span>');
  }
  function qTex(q, sym) {
    const s = sym || '\\pi';
    if (fz(q)) return '0';
    const sg = q.compare(0) < 0 ? '-' : '', a = q.abs(), n = String(a.n), d = String(a.d);
    const top = (n === '1' ? '' : n) + s;
    return sg + (d === '1' ? top : '\\frac{' + top + '}{' + d + '}');
  }
  function degText(a) {
    if (a.q) {
      const d = a.q.mul(180);
      if (isInt(d)) return neg(fstr(d)) + '°';
      const x = fnum(d), r = Math.round(x * 1e4) / 1e4;
      return (Math.abs(x - r) < 1e-12 ? '' : '≈ ') + fmtNum(r, 4) + '°';
    }
    return '≈ ' + fmtNum(a.deg, 4) + '°';
  }
  function radText(a) { return a.q ? qText(a.q) : '≈ ' + fmtNum(a.rad, 6); }
  function radHtml(a) { return a.q ? qHtml(a.q) : '≈ ' + fmtNum(a.rad, 6); }

  /* Ýazgy → burç. unit: 'deg' | 'rad' (ýazgyda π, rad, ° ýok bolsa ulanylýar) */
  function cleanExpr(s) {
    return String(s)
      .replace(/ /g, ' ')
      .replace(/[−‒–—]/g, '-')
      .replace(/[·×∙⋅]/g, '*')
      .replace(/÷/g, '/')
      .replace(/π/g, 'pi')
      .replace(/(\d),(\d)/g, '$1.$2')
      .replace(/√\s*\(/g, 'sqrt(')
      .replace(/√\s*([0-9.]+|[a-z]+)/gi, 'sqrt($1)')
      .trim();
  }
  /* aňlatmany takyk drob bilen hasaplamak: diňe sanlar, pi (π paýy), + − * / we bitin dereje */
  function fracEval(node, piVal) {
    const m = M();
    if (node.isParenthesisNode) return fracEval(node.content, piVal);
    if (node.isConstantNode) {
      if (typeof node.value !== 'number' || !isFinite(node.value)) return null;
      const s = String(node.value);
      return /e/i.test(s) ? null : F(s);
    }
    if (node.isSymbolNode) return node.name === 'pi' ? piVal : null;
    if (node.isOperatorNode) {
      const a = node.args.map((x) => fracEval(x, piVal));
      if (a.some((x) => x === null)) return null;
      switch (node.fn) {
        case 'unaryMinus': return a[0].neg();
        case 'unaryPlus': return a[0];
        case 'add': return a[0].add(a[1]);
        case 'subtract': return a[0].sub(a[1]);
        case 'multiply': return a[0].mul(a[1]);
        case 'divide': return fz(a[1]) ? null : a[0].div(a[1]);
        case 'pow': return isInt(a[1]) && Math.abs(fnum(a[1])) <= 6 && !(fz(a[0]) && a[1].compare(0) <= 0) ? a[0].pow(a[1]) : null;
        default: return null;
      }
    }
    void m;
    return null;
  }
  function parseAngle(input, unit) {
    let s = cleanExpr(input).toLowerCase();
    if (!s) throw new TrigError('Burçy ýazyň: mysal üçin 150, 150°, 5π/6 ýa-da -45°.');
    let u = unit === 'rad' ? 'rad' : 'deg';
    /* gradus, minut, sekunt: 30°15'20" */
    const dms = s.match(/^([+-]?\d+(?:\.\d+)?)\s*°\s*(?:(\d+(?:\.\d+)?)\s*['′]\s*)?(?:(\d+(?:\.\d+)?)\s*["″]\s*)?$/);
    if (dms && (dms[2] || dms[3])) {
      const sg = dms[1].startsWith('-') ? -1 : 1;
      let q = F(dms[1].replace('+', '')).abs().add(F(dms[2] || '0').div(60)).add(F(dms[3] || '0').div(3600));
      q = q.mul(sg).div(180);
      return angleQ(q);
    }
    if (/°|\bdeg\b|grad/.test(s)) { u = 'deg'; s = s.replace(/°|\bdeg\b|gradus|grad/g, ' '); }
    else if (/\brad\b|radian/.test(s)) { u = 'rad'; s = s.replace(/\brad\b|radian/g, ' '); }
    if (/pi/.test(s) && u === 'deg' && !/°/.test(String(input))) u = 'rad';
    s = s.trim();
    let node;
    try { node = M().parse(s); } catch (e) { throw new TrigError('«' + input + '» burçy okap bolmady. Mysal: 150, -45°, 5π/6, 2.5 rad.'); }
    let bad = null;
    node.traverse((n) => { if (n.isSymbolNode && n.name !== 'pi' && n.name !== 'e' && !bad) bad = n.name; });
    if (bad && !['sqrt'].includes(bad)) throw new TrigError('Burçda «' + bad + '» bar: diňe san, π we amallar ýazyň (mysal: 5π/6).');
    const q1 = fracEval(node, F(1));
    if (q1 !== null) {
      const q2 = fracEval(node, F(2));
      const lin = q2 !== null && q2.equals(q1.mul(2));
      const q0 = fracEval(node, F(0));
      if (u === 'deg' && !/pi/.test(s)) return angleQ(q1.div(180));
      if (u === 'rad' && /pi/.test(s) && lin && q0 !== null && fz(q0)) return angleQ(q1);
    }
    let v;
    try { v = node.evaluate({}); } catch (e) { throw new TrigError('«' + input + '» burçy hasaplap bolmady.'); }
    if (typeof v !== 'number' || !isFinite(v)) throw new TrigError('«' + input + '» san däl.');
    if (Math.abs(v) > 1e7) throw new TrigError('Burç örän uly.');
    return u === 'deg' ? (rationalize(v / 180, 720, 1e-13) ? angleQ(rationalize(v / 180, 720, 1e-13)) : { q: null, rad: v * PI / 180, deg: v, exact: false }) : angleRad(v);
  }

  /* ------------------------------------------------------------------ bahalar we getiriş formulalary */
  const QUAD_NAMES = ['I', 'II', 'III', 'IV'];
  function reduce(a) {
    /* burç [0; 2π) aralyga, çärýek, ýiti burç */
    if (a.q) {
      const r = fmod(a.q, F(2));
      const turns = a.q.sub(r).div(2);
      const half = F(1, 2);
      let quad = 0, ref, axis = null;
      if (fz(r)) axis = 0; else if (r.equals(half)) axis = 1; else if (r.equals(F(1))) axis = 2; else if (r.equals(F(3, 2))) axis = 3;
      if (r.compare(half) <= 0) { quad = 1; ref = r; }
      else if (r.compare(F(1)) <= 0) { quad = 2; ref = F(1).sub(r); }
      else if (r.compare(F(3, 2)) <= 0) { quad = 3; ref = r.sub(F(1)); }
      else { quad = 4; ref = F(2).sub(r); }
      return { exact: true, r, turns, quad, axis, ref, refKey: ref.toFraction() };
    }
    const r = ((a.rad % (2 * PI)) + 2 * PI) % (2 * PI);
    let quad, ref;
    if (r <= PI / 2) { quad = 1; ref = r; } else if (r <= PI) { quad = 2; ref = PI - r; } else if (r <= 1.5 * PI) { quad = 3; ref = r - PI; } else { quad = 4; ref = 2 * PI - r; }
    return { exact: false, rNum: r, turnsNum: Math.round((a.rad - r) / (2 * PI)), quad, axis: null, refNum: ref };
  }
  const SIGNS = { sin: [1, 1, -1, -1], cos: [1, -1, -1, 1], tg: [1, -1, 1, -1], ctg: [1, -1, 1, -1] };
  function values(a) {
    const red = reduce(a);
    const out = {};
    const numeric = { sin: Math.sin(a.rad), cos: Math.cos(a.rad) };
    numeric.tg = numeric.sin / numeric.cos; numeric.ctg = numeric.cos / numeric.sin;
    if (red.exact && SIN_T[red.refKey] !== undefined) {
      const k = red.refKey, kc = compl(k);
      const sgn = (fn) => SIGNS[fn][red.quad - 1];
      out.sin = exactVal(SIN_T[k], sgn('sin'));
      out.cos = exactVal(SIN_T[kc], sgn('cos'));
      out.tg = exactVal(TAN_T[k], sgn('tg'));
      out.ctg = exactVal(TAN_T[kc], sgn('ctg'));
      /* sec, cosec */
      out.sec = SEC_T[k] !== undefined ? exactVal(SEC_T[k], sgn('cos')) : numVal(1 / numeric.cos);
      out.cosec = SEC_T[kc] !== undefined ? exactVal(SEC_T[kc], sgn('sin')) : numVal(1 / numeric.sin);
      out.exact = true;
    } else {
      ['sin', 'cos', 'tg', 'ctg'].forEach((fn) => { out[fn] = numVal(Math.abs(numeric[fn]) < 1e-15 ? 0 : numeric[fn]); });
      if (Math.abs(numeric.cos) < 1e-13) out.tg = numVal(Infinity);
      if (Math.abs(numeric.sin) < 1e-13) out.ctg = numVal(Infinity);
      out.sec = numVal(Math.abs(numeric.cos) < 1e-13 ? Infinity : 1 / numeric.cos);
      out.cosec = numVal(Math.abs(numeric.sin) < 1e-13 ? Infinity : 1 / numeric.sin);
      out.exact = false;
    }
    /* takmyny bahalar hemişe */
    ['sin', 'cos', 'tg', 'ctg', 'sec', 'cosec'].forEach((fn) => { out[fn].approx = out[fn].defined ? fmtNum(out[fn].v, 6) : '—'; });
    out.reduce = red;
    return out;
  }
  /* getiriş formulasynyň ädimleri (mugallym ýaly) */
  function reductionSteps(a, fn) {
    const red = reduce(a);
    const steps = [];
    const NAME = { sin: 'sin', cos: 'cos', tg: 'tg', ctg: 'ctg' };
    const f = NAME[fn] || 'sin';
    const deg = (q) => degText(angleQ(q));
    if (red.exact) {
      if (!fz(red.turns)) {
        const tN = fnum(red.turns);
        const tStr = (tN > 0 ? ' + ' : ' ' + MINUS + ' ') + (Math.abs(tN) === 1 ? '' : Math.abs(tN) + '·') + '360°';
        steps.push('Doly aýlawlary taşlaýarys (360° — sin we cos-yň periody; tg we ctg-niň periody 180°, şonuň üçin 360° hem olaryň periody): ' + degText(a) + ' = ' + deg(red.r) + tStr + ', diýmek ' + f + ' ' + degText(a) + ' = ' + f + ' ' + deg(red.r) + '.');
      }
      if (red.axis !== null) {
        const names = ['položitel Ox ýarym okunyň', 'položitel Oy ýarym okunyň', 'otrisatel Ox ýarym okunyň', 'otrisatel Oy ýarym okunyň'];
        steps.push(deg(red.r) + ' burçuň ahyrky tarapy ' + names[red.axis] + ' üstünde ýatýar: birlik töwerekdäki nokat (' + ['1; 0', '0; 1', MINUS + '1; 0', '0; ' + MINUS + '1'][red.axis] + ').');
        return steps;
      }
      steps.push(deg(red.r) + ' — ' + QUAD_NAMES[red.quad - 1] + ' çärýekde. ' + (red.quad === 1 ? 'Bu eýýäm ýiti burç.' : 'Ýiti burç: θ = ' + ['', '180° ' + MINUS + ' ' + deg(red.r), deg(red.r) + ' ' + MINUS + ' 180°', '360° ' + MINUS + ' ' + deg(red.r)][red.quad - 1] + ' = ' + deg(red.ref) + '.'));
      if (red.quad > 1) {
        const sg = SIGNS[f][red.quad - 1];
        const form = ['', '180° − θ', '180° + θ', '360° − θ'][red.quad - 1];
        steps.push(QUAD_NAMES[red.quad - 1] + ' çärýekde ' + f + ' ' + (sg > 0 ? 'položitel' : 'otrisatel') + ', şonuň üçin getiriş formulasy: ' + f + '(' + form.replace('−', MINUS) + ') = ' + (sg > 0 ? '' : MINUS) + f + ' θ.');
      }
      return steps;
    }
    steps.push('Burç ' + QUAD_NAMES[red.quad - 1] + ' çärýekde (' + fmtNum(red.rNum * 180 / PI, 4) + '°). Bu burç üçin takyk baha tablisada ýok — baha takmyny hasaplanýar.');
    return steps;
  }

  /* ------------------------------------------------------------------ ters funksiýalar */
  const SIN_LIST = REF.map((k) => ({ q: F(k), v: surdValue(SIN_T[k]) }));
  const TAN_LIST = REF.filter((k) => TAN_T[k]).map((k) => ({ q: F(k), v: surdValue(TAN_T[k]) }));
  function matchList(list, v) {
    for (const e of list) if (Math.abs(e.v - v) < 1e-11 * Math.max(1, Math.abs(v))) return e.q;
    return null;
  }
  /* sin θ = v bolan [−π/2, π/2] burç (takyk bolsa q) */
  function asinQ(v) { const q = matchList(SIN_LIST, Math.abs(v)); return q ? (v < 0 ? q.neg() : q) : null; }
  function atanQ(v) { const q = matchList(TAN_LIST, Math.abs(v)); return q ? (v < 0 ? q.neg() : q) : null; }
  function evalNumber(input) {
    const s = cleanExpr(input).toLowerCase().replace(/\btg\b/g, 'tan').replace(/\bctg\b/g, 'cot');
    if (!s) throw new TrigError('Sany ýazyň (mysal: 1/2, √3/2, -0.6).');
    let v;
    try { v = M().evaluate(s); } catch (e) { throw new TrigError('«' + input + '» sany okap bolmady. Mysal: 1/2, sqrt(3)/2, √2/2, -0.6.'); }
    if (typeof v !== 'number' || !isFinite(v)) throw new TrigError('«' + input + '» hakyky san däl.');
    return v;
  }
  function inverse(fn, input) {
    const v = typeof input === 'number' ? input : evalNumber(input);
    const res = { fn, v, steps: [] };
    const nm = { arcsin: 'arcsin', arccos: 'arccos', arctg: 'arctg', arcctg: 'arcctg' }[fn];
    if (!nm) throw new TrigError('Näbelli funksiýa: ' + fn);
    if ((fn === 'arcsin' || fn === 'arccos') && Math.abs(v) > 1 + 1e-12) {
      res.ok = false;
      res.error = nm + ' diňe [' + MINUS + '1; 1] aralykdaky sanlar üçin kesgitlenen: |' + fmtNum(v) + '| > 1, sebäbi sinus we kosinus 1-den uly bolup bilmeýär.';
      return res;
    }
    let q = null, rad;
    if (fn === 'arcsin') {
      q = asinQ(v); rad = Math.asin(Math.max(-1, Math.min(1, v)));
      res.range = '[' + MINUS + 'π/2; π/2]';
      res.steps.push('arcsin a — sinusy a-a deň bolan [' + MINUS + 'π/2; π/2] aralykdaky ýeke-täk burç.');
      if (q) res.steps.push('sin ' + qText(q.abs()) + ' = ' + exactVal(SIN_T[q.abs().toFraction()], 1).text + (v < 0 ? '; arcsin täk funksiýa: arcsin(' + MINUS + 'a) = ' + MINUS + 'arcsin a.' : '.'));
    } else if (fn === 'arccos') {
      const qs = asinQ(v);
      q = qs ? F(1, 2).sub(qs) : null; rad = Math.acos(Math.max(-1, Math.min(1, v)));
      res.range = '[0; π]';
      res.steps.push('arccos a — kosinusy a-a deň bolan [0; π] aralykdaky ýeke-täk burç.');
      if (q) res.steps.push(v < 0 ? 'arccos(' + MINUS + 'a) = π ' + MINUS + ' arccos a formulasy boýunça: arccos(' + valueLabel(v) + ') = π ' + MINUS + ' ' + qText(F(1, 2).sub(qs.abs())) + ' = ' + qText(q) + '.' : 'cos ' + qText(q) + ' = ' + exactVal(SIN_T[F(1, 2).sub(q).toFraction()], 1).text + '.');
    } else if (fn === 'arctg') {
      q = atanQ(v); rad = Math.atan(v);
      res.range = '(' + MINUS + 'π/2; π/2)';
      res.steps.push('arctg a — tangensi a-a deň bolan (' + MINUS + 'π/2; π/2) aralykdaky ýeke-täk burç.');
      if (q) res.steps.push('tg ' + qText(q.abs()) + ' = ' + exactVal(TAN_T[q.abs().toFraction()], 1).text + (v < 0 ? '; arctg täk funksiýa.' : '.'));
    } else {
      const qt = atanQ(v);
      q = qt ? F(1, 2).sub(qt) : null; rad = PI / 2 - Math.atan(v);
      res.range = '(0; π)';
      res.steps.push('arcctg a — kotangensi a-a deň bolan (0; π) aralykdaky ýeke-täk burç: arcctg a = π/2 ' + MINUS + ' arctg a.');
      if (q) res.steps.push('arctg(' + valueLabel(v) + ') = ' + qText(qt) + ', diýmek arcctg(' + valueLabel(v) + ') = π/2 ' + MINUS + ' (' + qText(qt) + ') = ' + qText(q) + '.');
    }
    res.ok = true;
    res.angle = q ? angleQ(q) : { q: null, rad, deg: rad * 180 / PI, exact: false };
    res.exact = !!q;
    return res;
  }

  /* ------------------------------------------------------------------ deňlemeler: ýazgy */
  const FN_ALIAS = [[/arcctg/g, 'acot'], [/arctg/g, 'atan'], [/arcsin/g, 'asin'], [/arccos/g, 'acos'], [/(^|[^a-z])ctg/g, '$1cot'], [/(^|[^a-z])tg/g, '$1tan'], [/cosec/g, 'csc']];
  const TRIG_FN = ['sin', 'cos', 'tan', 'cot'];
  /* sin x, sin 2x, sin²x, sin^2 x … → sin(x), sin(2x), sin(x)^2 */
  function normalizeEquation(input) {
    let s = cleanExpr(input).toLowerCase()
      .replace(/²/g, '^2').replace(/³/g, '^3').replace(/⁴/g, '^4')
      .replace(/\*\*/g, '^');
    FN_ALIAS.forEach((p) => { s = s.replace(p[0], p[1]); });
    let out = '', i = 0;
    const re = /(asin|acos|atan|acot|sin|cos|tan|cot|sec|csc)/y;
    while (i < s.length) {
      re.lastIndex = i;
      const m = re.exec(s);
      const prev = i > 0 ? s[i - 1] : '';
      if (!m || /[a-z]/.test(prev)) { out += s[i]; i++; continue; }
      const name = m[1];
      let j = i + name.length, pow = '';
      const pm = /^\s*\^\s*(\d+)/.exec(s.slice(j));
      if (pm) { pow = pm[1]; j += pm[0].length; }
      while (s[j] === ' ') j++;
      let arg;
      if (s[j] === '(') {
        let depth = 0, k = j;
        for (; k < s.length; k++) { if (s[k] === '(') depth++; else if (s[k] === ')') { depth--; if (!depth) break; } }
        if (depth) throw new TrigError('Ýaýlar deň däl: «(» bilen «)» sanyny barlaň.');
        arg = s.slice(j + 1, k); j = k + 1;
        arg = normalizeEquation(arg);
      } else {
        const am = /^([0-9]*\.?[0-9]*)\s*\*?\s*(pi)?\s*\*?\s*([a-z](?![a-z]))?(\s*\/\s*[0-9]+(?:\.[0-9]+)?)?/.exec(s.slice(j));
        if (!am || !am[0].trim() || (!am[1] && !am[2] && !am[3])) throw new TrigError(name.replace('tan', 'tg').replace('cot', 'ctg') + ' funksiýasynyň argumentini ýaýda ýazyň: mysal üçin ' + name.replace('tan', 'tg').replace('cot', 'ctg') + '(x), ' + name.replace('tan', 'tg').replace('cot', 'ctg') + '(2x).');
        arg = am[0].trim(); j += am[0].length;
      }
      out += pow ? '(' + name + '(' + arg + '))^' + pow : name + '(' + arg + ')';
      i = j;
    }
    return out;
  }
  function parseEquation(input) {
    const norm = normalizeEquation(input);
    const parts = norm.split(/(?<![<>!=])=(?!=)/);
    if (parts.length > 2) throw new TrigError('Deňlemede «=» belgisi diňe bir gezek bolmaly.');
    if (/[<>]/.test(norm)) throw new TrigError('Bu gural deňlemeleri çözýär (=). Deňsizlikler entek goldanmaýar.');
    const lhsS = parts[0].trim(), rhsS = parts.length === 2 ? parts[1].trim() : '0';
    if (!lhsS || !rhsS) throw new TrigError('Deňlemäniň iki tarapyny hem ýazyň: mysal üçin sin(x) = 1/2.');
    let L, R;
    try { L = M().parse(lhsS); R = M().parse(rhsS); } catch (e) { throw new TrigError('«' + input + '» deňlemäni okap bolmady. Mysal: 2sin(x) = 1, 2cos²x − 3cos x + 1 = 0, tg(2x − π/4) = 1.'); }
    const names = new Set();
    const fns = new Set();
    [L, R].forEach((node) => node.traverse((n, path, parent) => {
      if (n.isSymbolNode) {
        if (parent && parent.isFunctionNode && path === 'fn') { fns.add(n.name); return; }
        if (!['pi', 'e'].includes(n.name)) names.add(n.name);
      }
      if (n.isAssignmentNode || n.isFunctionAssignmentNode || n.isBlockNode || n.isRangeNode || n.isArrayNode || n.isObjectNode || n.isAccessorNode || n.isConditionalNode) throw new TrigError('Bu görnüşdäki ýazgy goldanmaýar.');
    }));
    const allowed = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'asin', 'acos', 'atan', 'acot', 'sqrt', 'abs', 'exp', 'log', 'nthRoot', 'cbrt']);
    for (const f of fns) if (!allowed.has(f)) throw new TrigError('Näbelli funksiýa: «' + f + '». Ulanyp bolýanlar: sin, cos, tg, ctg, √ …');
    if (names.size === 0) throw new TrigError('Deňlemede näbelli ýok. Näbellini x bilen belläň: mysal üçin sin(x) = 1/2.');
    if (names.size > 1) throw new TrigError('Deňlemede diňe bir näbelli bolmaly (tapyldy: ' + Array.from(names).join(', ') + ').');
    const v = names.values().next().value;
    const diff = new (M().OperatorNode)('-', 'subtract', [L, R]);
    const fn = diff.compile();
    const f = (x) => { const sc = {}; sc[v] = x; try { const r = fn.evaluate(sc); return typeof r === 'number' ? r : (r && typeof r.re === 'number' && Math.abs(r.im) < 1e-12 ? r.re : NaN); } catch (e) { return NaN; } };
    return { input, norm, L, R, diff, v, f, lhs: lhsS, rhs: rhsS };
  }

  /* argument a·v + b — çyzykly bolsa {k, b} */
  function linearArg(argNode, v) {
    const c = argNode.compile();
    const at = (x) => { const sc = {}; sc[v] = x; try { const r = c.evaluate(sc); return typeof r === 'number' ? r : NaN; } catch (e) { return NaN; } };
    const b = at(0), k = at(1) - b;
    if (!isFinite(b) || !isFinite(k)) return null;
    for (const x of [2, -1.7, 0.37, 5.3]) { const y = at(x); if (!isFinite(y) || Math.abs(y - (k * x + b)) > 1e-9 * (1 + Math.abs(y))) return null; }
    if (Math.abs(k) < 1e-12) return null;
    return { k, b, kq: rationalize(k, 1000, 1e-12), bq: Math.abs(b) < 1e-15 ? F(0) : rationalize(b / PI, 1000, 1e-12) };
  }
  const near = (a, b, t) => Math.abs(a - b) <= (t || 1e-9) * (1 + Math.abs(a) + Math.abs(b));

  /* ------------------------------------------------------------------ çözgüt toparlary */
  /* topar: burç = base + period·n (u boýunça). base: {q|null, num}; period: q (π-niň paýy) */
  function A(q, num) { return q ? { q, num: fnum(q) * PI } : { q: null, num }; }
  function aAdd(a, b) { return a.q && b.q ? A(a.q.add(b.q)) : A(null, a.num + b.num); }
  function aNeg(a) { return a.q ? A(a.q.neg()) : A(null, -a.num); }
  function aMulF(a, f, fNum) { return a.q && f ? A(a.q.mul(f)) : A(null, a.num * fNum); }
  function aText(a) { return a.q ? qText(a.q) : fmtNum(a.num, 6); }
  function aHtml(a) { return a.q ? qHtml(a.q) : fmtNum(a.num, 6); }

  /* esasy deňleme → u boýunça toparlar */
  function basicSeries(fn, val) {
    /* val: {v, label}; netije: {ok, series:[{base, pq}], formula, note, theta} */
    const v = val.v;
    const out = { fn, v, series: [], label: val.label };
    if (fn === 'sin' || fn === 'cos') {
      if (Math.abs(v) > 1 + 1e-12) { out.none = true; out.note = '|' + val.label + '| > 1 — ' + fn + ' 1-den uly bolup bilmeýär, bu deňlemäniň çözgüdi ýok.'; return out; }
    }
    if (fn === 'sin') {
      const tq = asinQ(v), th = A(tq, Math.asin(Math.max(-1, Math.min(1, v))));
      out.theta = th; out.thetaName = 'arcsin(' + val.label + ')';
      if (near(v, 0, 1e-14)) { out.series.push({ base: A(F(0)), pq: F(1) }); out.special = 'sin u = 0 ⇒ u = πn'; }
      else if (near(Math.abs(v), 1, 1e-14)) { out.series.push({ base: A(F(v > 0 ? 1 : -1, 2)), pq: F(2) }); out.special = 'sin u = ' + (v > 0 ? '' : MINUS) + '1 ⇒ u = ' + (v > 0 ? '' : MINUS) + 'π/2 + 2πn'; }
      else { out.series.push({ base: th, pq: F(2) }); out.series.push({ base: aAdd(A(F(1)), aNeg(th)), pq: F(2) }); out.general = 'u = (−1)ⁿ·arcsin a + πn'; }
    } else if (fn === 'cos') {
      const sq = asinQ(v), tq = sq ? F(1, 2).sub(sq) : null, th = A(tq, Math.acos(Math.max(-1, Math.min(1, v))));
      out.theta = th; out.thetaName = 'arccos(' + val.label + ')';
      if (near(v, 0, 1e-14)) { out.series.push({ base: A(F(1, 2)), pq: F(1) }); out.special = 'cos u = 0 ⇒ u = π/2 + πn'; }
      else if (near(v, 1, 1e-14)) { out.series.push({ base: A(F(0)), pq: F(2) }); out.special = 'cos u = 1 ⇒ u = 2πn'; }
      else if (near(v, -1, 1e-14)) { out.series.push({ base: A(F(1)), pq: F(2) }); out.special = 'cos u = −1 ⇒ u = π + 2πn'; }
      else { out.series.push({ base: th, pq: F(2) }); out.series.push({ base: aNeg(th), pq: F(2) }); out.general = 'u = ±arccos a + 2πn'; }
    } else if (fn === 'tan') {
      const tq = atanQ(v), th = A(tq, Math.atan(v));
      out.theta = th; out.thetaName = 'arctg(' + val.label + ')';
      out.series.push({ base: th, pq: F(1) }); out.general = 'u = arctg a + πn';
    } else if (fn === 'cot') {
      const tq = atanQ(v), th = A(tq ? F(1, 2).sub(tq) : null, PI / 2 - Math.atan(v));
      out.theta = th; out.thetaName = 'arcctg(' + val.label + ')';
      out.series.push({ base: th, pq: F(1) }); out.general = 'u = arcctg a + πn';
    }
    return out;
  }
  /* u = k·x + b → x toparlary */
  function toX(ser, lin) {
    const kq = lin.kq, bq = lin.bq;
    return ser.map((s) => {
      const shifted = s.base.q && bq ? A(s.base.q.sub(bq)) : A(null, s.base.num - lin.b);
      const base = shifted.q && kq ? A(shifted.q.div(kq)) : A(null, shifted.num / lin.k);
      const pq = kq ? s.pq.div(kq.abs()) : null;
      return { base, pq, pnum: fnum(s.pq) * PI / Math.abs(lin.k) };
    });
  }
  function seriesText(s, x) {
    const per = s.pq ? perText(s.pq) : fmtNum(s.pnum, 6) + 'n';
    const b = aText(s.base);
    return x + ' = ' + (b === '0' ? per : b + ' + ' + per);
  }
  function perText(pq) {
    const n = String(pq.n), d = String(pq.d);
    return (n === '1' ? '' : n) + 'πn' + (d === '1' ? '' : '/' + d);
  }
  function perHtml(pq) {
    const n = String(pq.n), d = String(pq.d);
    const top = (n === '1' ? '' : n) + 'π<i>n</i>';
    return d === '1' ? top : '<span class="fr"><span class="fr-n">' + top + '</span><span class="fr-d">' + d + '</span></span>';
  }
  function seriesHtml(s, x) {
    const per = s.pq ? perHtml(s.pq) : fmtNum(s.pnum, 6) + '<i>n</i>';
    const b = aHtml(s.base);
    return '<i>' + x + '</i> = ' + (b === '0' ? per : b + ' + ' + per);
  }
  /* aralykdaky çözgütler */
  function inInterval(series, lo, hi, limit, closed) {
    const out = [];
    for (const s of series) {
      const P = s.pq ? fnum(s.pq) * PI : s.pnum;
      const b = s.base.num;
      const n0 = Math.ceil((lo - b) / P - 1e-9), n1 = Math.floor((hi - b) / P + 1e-9);
      for (let n = n0; n <= n1 && out.length < (limit || 200); n++) {
        const x = b + P * n;
        if (x < lo - 1e-9 || x > hi + 1e-9 || (!closed && x > hi - 1e-9)) continue;
        const q = s.base.q && s.pq ? s.base.q.add(s.pq.mul(n)) : null;
        out.push({ x: Math.abs(x) < 1e-13 ? 0 : x, q });
      }
    }
    out.sort((a, b) => a.x - b.x);
    const uniq = [];
    for (const r of out) if (!uniq.some((u) => Math.abs(u.x - r.x) < 1e-9)) uniq.push(r);
    return uniq;
  }

  /* Mekdep kitabyndaky gysga ýazgy: sin w = a ⇒ w = (−1)ⁿ·θ + πn; cos w = a ⇒ w = ±θ + 2πn, bu ýerde w = k′x + b′.
     Netije x üçin: {text, html} */
  function aDiv(a, kq, k) { return a.q && kq ? A(a.q.div(kq)) : A(null, a.num / k); }
  function compactX(fn, theta, lin, x) {
    const k = lin.k, kq = lin.kq;
    const absk = Math.abs(k), absq = kq ? kq.abs() : null;
    const c = fn === 'sin' ? aDiv(theta, kq, k) : aDiv(theta, absq, absk);
    const shift = aNeg(lin.bq ? aDiv(A(lin.bq), kq, k) : A(null, lin.b / k));
    const per = fn === 'sin' ? (absq ? F(1).div(absq) : null) : (absq ? F(2).div(absq) : null);
    const pnum = (fn === 'sin' ? PI : 2 * PI) / absk;
    const neg0 = c.q ? c.q.compare(0) < 0 : c.num < 0;
    const cAbs = neg0 ? aNeg(c) : c;
    const lead = fn === 'sin' ? (neg0 ? '(' + MINUS + '1)ⁿ⁺¹·' : '(' + MINUS + '1)ⁿ·') : '±';
    const leadH = fn === 'sin' ? (neg0 ? '(' + MINUS + '1)<sup><i>n</i>+1</sup>·' : '(' + MINUS + '1)<sup><i>n</i></sup>·') : '±';
    const sz = shift.q ? fz(shift.q) : Math.abs(shift.num) < 1e-15;
    const sNeg = shift.q ? shift.q.compare(0) < 0 : shift.num < 0;
    const sAbs = sNeg ? aNeg(shift) : shift;
    const shT = sz ? '' : (sNeg ? ' ' + MINUS + ' ' : ' + ') + aText(sAbs);
    const shH = sz ? '' : (sNeg ? ' ' + MINUS + ' ' : ' + ') + aHtml(sAbs);
    const pT = per ? perText(per) : fmtNum(pnum, 6) + 'n', pH = per ? perHtml(per) : fmtNum(pnum, 6) + '<i>n</i>';
    return { text: x + ' = ' + lead + aText(cAbs) + shT + ' + ' + pT, html: '<i>' + x + '</i> = ' + leadH + aHtml(cAbs) + shH + ' + ' + pH };
  }
  function shiftLin(lin, phi, mul) {
    /* w = mul·(k x + b) + φ */
    const m = mul || 1;
    const k = lin.k * m, kq = lin.kq ? lin.kq.mul(m) : null;
    let b = lin.b * m, bq = lin.bq ? lin.bq.mul(m) : null;
    if (phi) { b += phi.num; bq = bq && phi.q ? bq.add(phi.q) : null; }
    return { k, kq, b, bq };
  }

  /* f₁(A) = ±f₂(B) görnüş (sin we cos, dürli argumentler): sin A = sin B ⇔ A = B + 2πn ýa-da A = π − B + 2πn;
     cos A = cos B ⇔ A = ±B + 2πn */
  function constVal(node) {
    let bad = false;
    node.traverse((n, path, parent) => { if (n.isSymbolNode && !(parent && parent.isFunctionNode && path === 'fn') && n.name !== 'pi' && n.name !== 'e') bad = true; });
    if (bad) return null;
    try { const r = node.evaluate({}); return typeof r === 'number' && isFinite(r) ? r : null; } catch (e) { return null; }
  }
  function sideTrig(node, v) {
    let n = node;
    while (n.isParenthesisNode) n = n.content;
    if (n.isOperatorNode && n.fn === 'unaryMinus') { const r = sideTrig(n.args[0], v); return r ? Object.assign({}, r, { c: -r.c }) : null; }
    if (n.isOperatorNode && n.fn === 'multiply' && n.args.length === 2) {
      for (const [i, j] of [[0, 1], [1, 0]]) {
        const k = constVal(n.args[i]);
        if (k !== null) { const r = sideTrig(n.args[j], v); if (r) return Object.assign({}, r, { c: r.c * k }); }
      }
      return null;
    }
    if (n.isFunctionNode && (n.fn.name === 'sin' || n.fn.name === 'cos')) {
      const lin = linearArg(n.args[0], v);
      return lin ? { c: 1, fn: n.fn.name, lin } : null;
    }
    return null;
  }
  const wrapN = (t) => (/[ +]/.test(t) || (/−/.test(t) && t.indexOf('−') > 0) ? '(' + t + ')' : t);
  function linText(l, v) {
    if (Math.abs(l.k) < 1e-15) return l.bq ? qText(l.bq) : fmtNum(l.b);
    return uName(l, v);
  }
  function equalFunctions(eq, res) {
    const v = eq.v;
    const L = sideTrig(eq.L, v), R = sideTrig(eq.R, v);
    if (!L || !R || Math.abs(R.c) < 1e-12 || !near(Math.abs(L.c), Math.abs(R.c))) return false;
    const sgn = L.c / R.c > 0 ? 1 : -1;
    const half = F(1, 2);
    const mk = (k, kq, b, bq) => ({ k, kq, b, bq });
    const B = R.lin;
    let Bp, fn = L.fn, why;
    const nameB = linText(B, v), nameA = linText(L.lin, v);
    const bshift = (dq) => (B.bq ? B.bq.add(dq) : null);
    if (L.fn === R.fn) {
      if (sgn > 0) { Bp = B; why = null; }
      else if (fn === 'sin') { Bp = mk(-B.k, B.kq ? B.kq.neg() : null, -B.b, B.bq ? B.bq.neg() : null); why = MINUS + 'sin ' + wrapN(nameB) + ' = sin(' + MINUS + wrapN(nameB) + ')'; }
      else { Bp = mk(-B.k, B.kq ? B.kq.neg() : null, PI - B.b, B.bq ? F(1).sub(B.bq) : null); why = MINUS + 'cos ' + wrapN(nameB) + ' = cos(π ' + MINUS + ' ' + wrapN(nameB) + ')'; }
    } else if (L.fn === 'sin') {
      if (sgn > 0) { Bp = mk(-B.k, B.kq ? B.kq.neg() : null, PI / 2 - B.b, B.bq ? half.sub(B.bq) : null); why = 'cos ' + wrapN(nameB) + ' = sin(π/2 ' + MINUS + ' ' + wrapN(nameB) + ')'; }
      else { Bp = mk(B.k, B.kq, B.b - PI / 2, bshift(half.neg())); why = MINUS + 'cos ' + wrapN(nameB) + ' = sin(' + nameB + ' ' + MINUS + ' π/2)'; }
    } else {
      if (sgn > 0) { Bp = mk(-B.k, B.kq ? B.kq.neg() : null, PI / 2 - B.b, B.bq ? half.sub(B.bq) : null); why = 'sin ' + wrapN(nameB) + ' = cos(π/2 ' + MINUS + ' ' + wrapN(nameB) + ')'; }
      else { Bp = mk(B.k, B.kq, B.b + PI / 2, bshift(half)); why = MINUS + 'sin ' + wrapN(nameB) + ' = cos(π/2 + ' + nameB + ')'; }
    }
    res.method = 'equal';
    res.steps.push('Deňlemäniň iki tarapynda hem bir trigonometrik funksiýa (dürli argumentler bilen). ' + (why ? 'Getiriş formulasy bilen sag tarapy ' + fn + ' funksiýasyna getirýäris: ' + why + '.' : ''));
    const Ap = L.lin;
    const BpName = linText(Bp, v);
    res.steps.push(fn === 'sin'
      ? 'sin ' + wrapN(nameA) + ' = sin ' + wrapN(BpName) + ' deňligi diňe şu ýagdaýlarda ýerine ýetýär: argumentler 2πn tapawutlanýar ýa-da olaryň jemi π + 2πn.'
      : 'cos ' + wrapN(nameA) + ' = cos ' + wrapN(BpName) + ' deňligi diňe şu ýagdaýlarda ýerine ýetýär: argumentleriň tapawudy ýa-da jemi 2πn.');
    /* gatnaşyklar: A − s·B′ = c0 + 2πn */
    const rels = fn === 'sin' ? [{ s: 1, c0: F(0) }, { s: -1, c0: F(1) }] : [{ s: 1, c0: F(0) }, { s: -1, c0: F(0) }];
    rels.forEach((r) => {
      const K = Ap.k - r.s * Bp.k;
      const Kq = Ap.kq && Bp.kq ? Ap.kq.sub(Bp.kq.mul(r.s)) : null;
      const Cnum = r.s * Bp.b - Ap.b + fnum(r.c0) * PI;
      const Cq = Ap.bq && Bp.bq ? Bp.bq.mul(r.s).sub(Ap.bq).add(r.c0) : null;
      const label = nameA + ' = ' + (r.s > 0 ? BpName : (fn === 'sin' ? 'π ' + MINUS + ' ' : MINUS) + wrapN(BpName)) + ' + 2πn';
      const br = { why: label, x: [] };
      if (Math.abs(K) < 1e-12) {
        /* x-siz gatnaşyk: hemişelik 2π-niň kratnysy bolsa — islendik x */
        const mult = Cnum / (2 * PI);
        if (Math.abs(mult - Math.round(mult)) < 1e-9) { br.all = true; res.identity = true; br.note = 'Bu gatnaşyk x-iň islendik bahasynda ýerine ýetýär.'; }
        else { br.none = true; br.note = 'Bu gatnaşykda x gysgalýar we ol hiç bir x üçin ýerine ýetmeýär.'; }
        res.branches.push(br);
        return;
      }
      const base = Cq && Kq ? A(Cq.div(Kq)) : A(null, Cnum / K);
      const pq = Kq ? F(2).div(Kq.abs()) : null;
      br.x = [{ base, pq, pnum: 2 * PI / Math.abs(K) }];
      br.solve = (Kq ? (isInt(Kq) ? fstr(Kq) : '(' + fstr(Kq) + ')') : fmtNum(K)) + v + ' = ' + (Cq ? qText(Cq) : fmtNum(Cnum)) + ' + 2πn';
      res.branches.push(br);
    });
    return true;
  }

  /* ------------------------------------------------------------------ köpagza koeffisiýentleri */
  function subTrig(node, v, base, mode) {
    /* mode 'sc': sin(u) → s, cos(u) → c, sin(2u) → 2sc, cos(2u) → c²−s²;  mode 't': tan(u) → t, cot(u) → 1/t (ýa-da tersine) */
    const m = M();
    return node.transform((n) => {
      if (!n.isFunctionNode || !TRIG_FN.includes(n.fn.name)) return n;
      const lin = linearArg(n.args[0], v);
      const which = near(lin.k, base.k) && near(lin.b, base.b) ? 1 : 2;
      const S = new m.SymbolNode('__s'), C = new m.SymbolNode('__c'), T = new m.SymbolNode('__t');
      const name = n.fn.name;
      if (mode === 'sc') {
        if (which === 1) return name === 'sin' ? S : C;
        return name === 'sin' ? m.parse('2*__s*__c') : m.parse('(__c^2-__s^2)');
      }
      if (mode === 't') return name === 'tan' ? T : new m.OperatorNode('/', 'divide', [new m.ConstantNode(1), T]);
      return name === 'cot' ? T : new m.OperatorNode('/', 'divide', [new m.ConstantNode(1), T]);
    });
  }
  function fitSC(expr) {
    const c = expr.compile();
    const g = (s, cc) => { try { const r = c.evaluate({ __s: s, __c: cc }); return typeof r === 'number' ? r : NaN; } catch (e) { return NaN; } };
    const a00 = g(0, 0), gs1 = g(1, 0), gsm = g(-1, 0), gc1 = g(0, 1), gcm = g(0, -1), g11 = g(1, 1);
    const a10 = (gs1 - gsm) / 2, a20 = (gs1 + gsm) / 2 - a00, a01 = (gc1 - gcm) / 2, a02 = (gc1 + gcm) / 2 - a00;
    const a11 = g11 - a00 - a10 - a01 - a20 - a02;
    const P = { a00, a10, a01, a20, a11, a02 };
    if (Object.values(P).some((x) => !isFinite(x))) return null;
    const scale = 1 + Object.values(P).reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    for (const [s, cc] of [[0.7, -1.3], [2.1, 0.4], [-1.7, 2.6], [0.3, 0.9], [-2.2, -0.6]]) {
      const val = a00 + a10 * s + a01 * cc + a20 * s * s + a11 * s * cc + a02 * cc * cc;
      if (!near(val, g(s, cc), 1e-9 * scale)) return null;
    }
    return clean(P, scale);
  }
  function fitT(expr) {
    const c = expr.compile();
    const g = (t) => { try { const r = c.evaluate({ __t: t }); return typeof r === 'number' ? r : NaN; } catch (e) { return NaN; } };
    /* a_{-1}/t + a0 + a1 t + a2 t² */
    const ts = [1, -1, 2, -2];
    const ys = ts.map(g);
    if (ys.some((y) => !isFinite(y))) return null;
    /* çyzykly ulgam 4×4 */
    const A4 = ts.map((t) => [1 / t, 1, t, t * t]);
    const sol = gauss(A4, ys);
    if (!sol) return null;
    const P = { am1: sol[0], a0: sol[1], a1: sol[2], a2: sol[3] };
    const scale = 1 + Object.values(P).reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    for (const t of [0.6, -1.7, 3.1, 0.25, -0.4]) {
      const val = P.am1 / t + P.a0 + P.a1 * t + P.a2 * t * t;
      if (!near(val, g(t), 1e-9 * scale)) return null;
    }
    return clean(P, scale);
  }
  function gauss(A0, b0) {
    const n = b0.length, A1 = A0.map((r, i) => r.concat([b0[i]]));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A1[r][c]) > Math.abs(A1[p][c])) p = r;
      if (Math.abs(A1[p][c]) < 1e-14) return null;
      [A1[c], A1[p]] = [A1[p], A1[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = A1[r][c] / A1[c][c];
        for (let k = c; k <= n; k++) A1[r][k] -= f * A1[c][k];
      }
    }
    return A1.map((r, i) => r[n] / r[i]);
  }
  function clean(P, scale) {
    const out = {};
    Object.keys(P).forEach((k) => {
      let x = P[k];
      if (Math.abs(x) < 1e-10 * scale) x = 0;
      const q = rationalize(x, 10000, 1e-10);
      out[k] = q ? fnum(q) : x;
    });
    return out;
  }
  /* koeffisiýenti owadan ýazmak */
  function coefLabel(x) {
    const q = rationalize(x, 1000, 1e-10);
    if (q) return fracText(q);
    for (const r of [2, 3, 5, 6, 7]) {
      const qq = rationalize(x / Math.sqrt(r), 100, 1e-10);
      if (qq) { const a = qq.abs(); return (qq.compare(0) < 0 ? MINUS : '') + (a.equals(1) ? '' : (isInt(a) ? fstr(a) : '(' + fstr(a) + ')')) + '√' + r; }
    }
    return fmtNum(x, 6);
  }
  function valueLabel(v) {
    const q = rationalize(v, 1000, 1e-11);
    if (q) return fracText(q);
    const s = asinQ(v);
    if (s) return exactVal(SIN_T[s.abs().toFraction()], v < 0 ? -1 : 1).text;
    const t = atanQ(v);
    if (t) return exactVal(TAN_T[t.abs().toFraction()], v < 0 ? -1 : 1).text;
    for (const r of [2, 3, 5, 6, 7, 10]) {
      const qq = rationalize(v / Math.sqrt(r), 100, 1e-11);
      if (qq) { const a = qq.abs(); const num = (String(a.n) === '1' ? '' : String(a.n)) + '√' + r; return (qq.compare(0) < 0 ? MINUS : '') + num + (isInt(a) ? '' : '/' + String(a.d)); }
    }
    return fmtNum(v, 6);
  }
  function polyText(terms) {
    /* terms: [[coef, 'agza'], ...]; koeffisiýent bitin bolsa 2sin²x, drob ýa-da kök bolsa (1/4)·sin²x, √3·cos x */
    let s = '';
    terms.forEach(([c, t]) => {
      if (Math.abs(c) < 1e-12) return;
      const lab = coefLabel(Math.abs(c));
      let body;
      if (!t) body = lab;
      else if (lab === '1') body = t;
      else if (/^\d+$/.test(lab)) body = lab + t;
      else if (/^\d+\/\d+$/.test(lab)) body = '(' + lab + ')·' + t;
      else body = lab + '·' + t;
      s += s ? (c < 0 ? ' ' + MINUS + ' ' : ' + ') + body : (c < 0 ? MINUS : '') + body;
    });
    return s || '0';
  }
  /* sin²x, sin x, sin²(2x − π/4) */
  function trigTerm(name, pow, arg) {
    const simple = /^[a-z]$/.test(arg) || arg === 'u';
    const p = pow === 2 ? '²' : '';
    return simple ? name + p + (p ? '' : ' ') + arg : name + p + '(' + arg + ')';
  }
  /* kwadrat ýa-da çyzykly deňlemäniň hakyky kökleri */
  function quadRoots(a, b, c) {
    const steps = [];
    if (Math.abs(a) < 1e-12) {
      if (Math.abs(b) < 1e-12) return { roots: [], steps, degenerate: Math.abs(c) < 1e-12 ? 'all' : 'none' };
      return { roots: [-c / b], steps: ['Çyzykly deňleme: t = ' + valueLabel(-c / b) + '.'] };
    }
    const D = b * b - 4 * a * c;
    const Dl = coefLabel(D);
    steps.push('Diskriminant: D = b² − 4ac = ' + Dl + '.');
    if (D < -1e-12) { steps.push('D < 0 — hakyky kök ýok.'); return { roots: [], steps }; }
    if (Math.abs(D) < 1e-12) { const r = -b / (2 * a); steps.push('D = 0 — bir kök: t = ' + valueLabel(r) + '.'); return { roots: [r], steps }; }
    const sd = Math.sqrt(D);
    const r1 = (-b + sd) / (2 * a), r2 = (-b - sd) / (2 * a);
    steps.push('t₁,₂ = (−b ± √D) / (2a): t₁ = ' + valueLabel(Math.max(r1, r2)) + ', t₂ = ' + valueLabel(Math.min(r1, r2)) + '.');
    return { roots: [Math.max(r1, r2), Math.min(r1, r2)], steps };
  }

  /* ------------------------------------------------------------------ deňlemäni çözmek */
  const FN_TK = { sin: 'sin', cos: 'cos', tan: 'tg', cot: 'ctg' };
  function solveEquation(input, opts) {
    const o = opts || {};
    const eq = parseEquation(input);
    const v = eq.v;
    const res = { input, norm: eq.norm, v, steps: [], branches: [], method: null, ok: true };
    const lo = o.lo !== undefined ? o.lo : 0, hi = o.hi !== undefined ? o.hi : 2 * PI;
    res.closed = !!o.closed;
    res.interval = { lo, hi, closed: res.closed };

    /* trigonometrik çagyryşlar we olaryň argumentleri */
    const calls = [];
    let outside = false, other = false;
    eq.diff.traverse((n) => { if (n.isFunctionNode && TRIG_FN.includes(n.fn.name)) calls.push(n); });
    const stripped = eq.diff.transform((n) => (n.isFunctionNode && TRIG_FN.includes(n.fn.name) ? new (M().SymbolNode)('__T') : n));
    stripped.traverse((n) => { if (n.isSymbolNode && n.name === v) outside = true; if (n.isFunctionNode && ['sec', 'csc', 'asin', 'acos', 'atan', 'acot'].includes(n.fn.name)) other = true; });
    const lins = calls.map((n) => linearArg(n.args[0], v));
    let base = null, mode = null, plan = null;
    if (calls.length && !outside && !other && lins.every(Boolean)) {
      const classes = [];
      lins.forEach((l) => { if (!classes.some((c) => near(c.k, l.k) && near(c.b, l.b))) classes.push(l); });
      const names = new Set(calls.map((n) => n.fn.name));
      const hasT = names.has('tan') || names.has('cot'), hasSC = names.has('sin') || names.has('cos');
      if (classes.length === 1) base = classes[0];
      else if (classes.length === 2 && !hasT) {
        const [p, q] = classes;
        if (near(q.k, 2 * p.k) && near(q.b, 2 * p.b)) base = p;
        else if (near(p.k, 2 * q.k) && near(p.b, 2 * q.b)) base = q;
      }
      if (base) {
        if (hasT && !hasSC) mode = names.has('tan') ? 't' : 'ct';
        else if (!hasT) mode = 'sc';
      }
      if (base && mode) plan = { base, mode, double: classes.length === 2 };
    }
    if (plan) {
      const sub = subTrig(eq.diff, v, plan.base, plan.mode === 'sc' ? 'sc' : plan.mode);
      const P = plan.mode === 'sc' ? fitSC(sub) : fitT(sub);
      if (P) {
        const done = plan.mode === 'sc' ? solveSC(P, plan.base, res, eq, plan.double) : solveT(P, plan.base, plan.mode, res, eq);
        if (done) return finish(res, eq, lo, hi);
      }
    }
    /* iki tarapda bir funksiýa (dürli argumentler) */
    if (!outside && !other && equalFunctions(eq, res)) return finish(res, eq, lo, hi);
    /* san usuly */
    return numericSolve(eq, res, lo, hi, calls, lins, outside);
  }

  function uName(base, v) {
    const bL = Math.abs(base.b) < 1e-15 ? '' : (base.b > 0 ? ' + ' : ' ' + MINUS + ' ') + (base.bq ? qText(base.bq.abs()) : coefLabel(Math.abs(base.b)));
    let kx;
    if (base.kq) {
      const sg = base.kq.compare(0) < 0 ? MINUS : '', a = base.kq.abs(), n = String(a.n), d = String(a.d);
      kx = sg + (n === '1' ? '' : n) + v + (d === '1' ? '' : '/' + d);
    } else kx = coefLabel(base.k) + '·' + v;
    return kx + bL;
  }
  function addBasic(res, fn, val, base, why) {
    const b = basicSeries(fn, val);
    b.why = why;
    b.x = b.none ? [] : toX(b.series, base);
    if (!b.none && b.series.length === 2 && (fn === 'sin' || fn === 'cos')) b.compact = compactX(fn, b.theta, base, res.v || 'x');
    res.branches.push(b);
    return b;
  }
  function solveSC(P, base, res, eq, dbl) {
    const v = eq.v, u = uName(base, v);
    const uIsX = u === v;
    res.u = u; res.base = base;
    const { a00, a10, a01, a20, a11, a02 } = P;
    const Z = (x) => Math.abs(x) < 1e-12;
    const showPoly = polyText([[a20, trigTerm('sin', 2, u)], [a11, trigTerm('sin', 1, u) + '·' + trigTerm('cos', 1, u)], [a02, trigTerm('cos', 2, u)], [a10, trigTerm('sin', 1, u)], [a01, trigTerm('cos', 1, u)], [a00, '']]);
    if (!uIsX) res.steps.push('Ähli trigonometrik funksiýalaryň argumenti şol bir: u = ' + u + '. Ilki u boýunça çözüp, soňra ' + v + '-i tapýarys.');
    if (dbl) res.steps.push('Iki esse burçuň formulalary bilen hemme funksiýalary bir argumente getirýäris: sin 2u = 2 sin u·cos u, cos 2u = cos²u ' + MINUS + ' sin²u.');
    res.steps.push('Deňlemäni bir tarapa geçirýäris: ' + showPoly + ' = 0.');
    const allZero = [a00, a10, a01, a20, a11, a02].every(Z);
    /* sin² + cos² = 1 bilen ýönekeýleşdirilende hemişe dogry (toždestwo) */
    const idCheck = Z(a10) && Z(a01) && Z(a11) && Z(a20 - a02) && Z(a00 + a20);
    if (allZero || idCheck) { res.method = 'identity'; res.identity = true; res.steps.push('sin²u + cos²u = 1 bolany üçin deňleme ' + v + '-iň islendik bahasynda dogry (toždestwo).'); return true; }
    if (Z(a10) && Z(a01) && Z(a11) && Z(a20 - a02)) { res.method = 'none'; res.steps.push('sin²u + cos²u = 1 ulanylanda deňleme ' + fmtNum(a00 + a20) + ' = 0 bolýar — bu mümkin däl, çözgüt ýok.'); return true; }
    /* 1) diňe sin (cos² → 1 − sin²) */
    if (Z(a01) && Z(a11)) {
      const A2 = a20 - a02, B = a10, C0 = a00 + a02;
      if (!Z(a02)) res.steps.push('cos²u = 1 − sin²u ornuna goýýarys.');
      return quadPath(res, 'sin', A2, B, C0, base, 'sin u');
    }
    /* 2) diňe cos (sin² → 1 − cos²) */
    if (Z(a10) && Z(a11)) {
      const A2 = a02 - a20, B = a01, C0 = a00 + a20;
      if (!Z(a20)) res.steps.push('sin²u = 1 − cos²u ornuna goýýarys.');
      return quadPath(res, 'cos', A2, B, C0, base, 'cos u');
    }
    /* 3a) sin u·cos u = k  ⇒  sin 2u = 2k */
    if (Z(a10) && Z(a01) && Z(a20) && Z(a02) && !Z(a11)) {
      res.method = 'basic';
      const k = -a00 / a11;
      res.steps.push('sin u·cos u = ' + valueLabel(k) + '. Iki esse burçuň formulasy boýunça 2 sin u·cos u = sin 2u, diýmek sin 2u = ' + valueLabel(2 * k) + '.');
      const b2 = basicSeries('sin', { v: 2 * k, label: valueLabel(2 * k) });
      b2.why = 'sin 2u = ' + valueLabel(2 * k);
      b2.double = true;
      if (b2.none) { b2.x = []; res.branches.push(b2); return true; }
      const half = b2.series.map((x) => ({ base: aMulF(x.base, F(1, 2), 0.5), pq: x.pq.div(2) }));
      b2.useries = half;
      b2.x = toX(half, base);
      if (b2.series.length === 2) b2.compact = compactX('sin', b2.theta, shiftLin(base, null, 2), res.v || 'x');
      res.branches.push(b2);
      return true;
    }
    /* 3) bir jynsly: A sin² + B sin cos + C cos² = 0 (hemişelik agza = a00(sin² + cos²)) */
    if (Z(a10) && Z(a01)) {
      const A2 = a20 + a00, B = a11, C0 = a02 + a00;
      res.method = 'homogeneous';
      if (!Z(a00)) res.steps.push('Hemişelik agzany ' + coefLabel(a00) + '·(sin²u + cos²u) görnüşinde ýazýarys — deňleme ikinji derejeli bir jynsly bolýar: ' + polyText([[A2, 'sin²u'], [B, 'sin u·cos u'], [C0, 'cos²u']]) + ' = 0.');
      else res.steps.push('Bu ikinji derejeli bir jynsly deňleme (her agzanyň derejesi 2).');
      if (Z(A2)) {
        res.steps.push('sin²u agzasy ýok: cos u-ny ýaýdan çykarýarys — cos u·(' + polyText([[B, 'sin u'], [C0, 'cos u']]) + ') = 0.');
        addBasic(res, 'cos', { v: 0, label: '0' }, base, 'cos u = 0');
        if (!Z(B)) addBasic(res, 'tan', { v: -C0 / B, label: valueLabel(-C0 / B) }, base, polyText([[B, 'sin u'], [C0, 'cos u']]) + ' = 0 ⇒ tg u = ' + valueLabel(-C0 / B));
        return true;
      }
      if (Z(C0)) {
        res.steps.push('cos²u agzasy ýok: sin u-ny ýaýdan çykarýarys — sin u·(' + polyText([[A2, 'sin u'], [B, 'cos u']]) + ') = 0.');
        addBasic(res, 'sin', { v: 0, label: '0' }, base, 'sin u = 0');
        if (!Z(B)) addBasic(res, 'cot', { v: -A2 / B, label: valueLabel(-A2 / B) }, base, polyText([[A2, 'sin u'], [B, 'cos u']]) + ' = 0 ⇒ ctg u = ' + valueLabel(-A2 / B));
        else addBasic(res, 'sin', { v: 0, label: '0' }, base, 'sin u = 0');
        return true;
      }
      res.steps.push('cos u = 0 bolsa, sin²u = 1 we deňleme ' + coefLabel(A2) + ' = 0 bolardy — dogry däl. Diýmek cos u ≠ 0 we iki tarapy cos²u-a bölüp bolýar: tg u = sin u / cos u.');
      res.steps.push(polyText([[A2, 't²'], [B, 't'], [C0, '']]) + ' = 0, bu ýerde t = tg u.');
      const qr = quadRoots(A2, B, C0);
      qr.steps.forEach((s) => res.steps.push(s));
      if (!qr.roots.length) { res.steps.push('Kök ýok — deňlemäniň çözgüdi ýok.'); return true; }
      qr.roots.forEach((t) => addBasic(res, 'tan', { v: t, label: valueLabel(t) }, base, 'tg u = ' + valueLabel(t)));
      return true;
    }
    /* 4) çyzykly: a sin + b cos + c = 0 */
    if (Z(a20) && Z(a02) && Z(a11)) return linearSC(res, a10, a01, a00, base);
    /* 5) umumy köpeldiji: sin u·(...) = 0 ýa-da cos u·(...) = 0 */
    if (Z(a00) && Z(a01) && Z(a02)) {
      res.method = 'factor';
      res.steps.push('Umumy köpeldiji sin u-ny ýaýdan çykarýarys: sin u·(' + polyText([[a20, 'sin u'], [a11, 'cos u'], [a10, '']]) + ') = 0. Köpeltmek hasyly nola deň — köpeldijileriň iň bolmanda biri nola deň.');
      addBasic(res, 'sin', { v: 0, label: '0' }, base, 'sin u = 0');
      const sub = { branches: [], steps: [] };
      linearSC(sub, a20, a11, a10, base);
      sub.steps.forEach((s) => res.steps.push(s));
      sub.branches.forEach((b) => res.branches.push(b));
      return true;
    }
    if (Z(a00) && Z(a10) && Z(a20)) {
      res.method = 'factor';
      res.steps.push('Umumy köpeldiji cos u-ny ýaýdan çykarýarys: cos u·(' + polyText([[a11, 'sin u'], [a02, 'cos u'], [a01, '']]) + ') = 0. Köpeltmek hasyly nola deň — köpeldijileriň iň bolmanda biri nola deň.');
      addBasic(res, 'cos', { v: 0, label: '0' }, base, 'cos u = 0');
      const sub = { branches: [], steps: [] };
      linearSC(sub, a11, a02, a01, base);
      sub.steps.forEach((s) => res.steps.push(s));
      sub.branches.forEach((b) => res.branches.push(b));
      return true;
    }
    return false;
  }
  function quadPath(res, fn, A2, B, C0, base, tname) {
    const Z = (x) => Math.abs(x) < 1e-12;
    if (Z(A2) && Z(B)) { res.method = Z(C0) ? 'identity' : 'none'; res.identity = Z(C0); res.steps.push(Z(C0) ? 'Deňleme islendik ' + res.v + ' üçin dogry.' : 'Deňleme ' + coefLabel(C0) + ' = 0 bolýar — çözgüt ýok.'); return true; }
    if (Z(A2)) {
      res.method = 'basic';
      const t = -C0 / B;
      res.steps.push(polyText([[B, tname], [C0, '']]) + ' = 0 ⇒ ' + tname + ' = ' + valueLabel(t) + '.');
      addBasic(res, fn, { v: t, label: valueLabel(t) }, base, tname + ' = ' + valueLabel(t));
      return true;
    }
    res.method = 'quadratic';
    res.steps.push('t = ' + tname + ' ornuna goýýarys (' + (fn === 'sin' || fn === 'cos' ? '|t| ≤ 1' : 't — islendik san') + '): ' + polyText([[A2, 't²'], [B, 't'], [C0, '']]) + ' = 0.');
    const qr = quadRoots(A2, B, C0);
    qr.steps.forEach((s) => res.steps.push(s));
    if (!qr.roots.length) { res.steps.push('Kwadrat deňlemäniň hakyky köki ýok — berlen deňlemäniň çözgüdi ýok.'); return true; }
    qr.roots.forEach((t) => {
      if ((fn === 'sin' || fn === 'cos') && Math.abs(t) > 1 + 1e-12) { res.steps.push('t = ' + valueLabel(t) + ' kök ýaramaýar: |t| > 1, ' + fn + ' beýle baha almaýar.'); return; }
      addBasic(res, fn, { v: t, label: valueLabel(t) }, base, tname + ' = ' + valueLabel(t));
    });
    return true;
  }
  function linearSC(res, a, b, c, base) {
    const Z = (x) => Math.abs(x) < 1e-12;
    res.method = res.method || 'linear';
    if (Z(a) && Z(b)) { if (!Z(c)) res.steps.push('Deňleme ' + coefLabel(c) + ' = 0 bolýar — çözgüt ýok.'); return true; }
    if (Z(b)) { const t = -c / a; res.steps.push(polyText([[a, 'sin u'], [c, '']]) + ' = 0 ⇒ sin u = ' + valueLabel(t) + '.'); addBasic(res, 'sin', { v: t, label: valueLabel(t) }, base, 'sin u = ' + valueLabel(t)); return true; }
    if (Z(a)) { const t = -c / b; res.steps.push(polyText([[b, 'cos u'], [c, '']]) + ' = 0 ⇒ cos u = ' + valueLabel(t) + '.'); addBasic(res, 'cos', { v: t, label: valueLabel(t) }, base, 'cos u = ' + valueLabel(t)); return true; }
    if (Z(c)) {
      const t = -b / a;
      res.steps.push(polyText([[a, 'sin u'], [b, 'cos u']]) + ' = 0 — birinji derejeli bir jynsly deňleme. cos u = 0 bolsa sin u = ±1 we deňleme dogry bolmaýar, şonuň üçin cos u-a bölýäris: tg u = ' + valueLabel(t) + '.');
      addBasic(res, 'tan', { v: t, label: valueLabel(t) }, base, 'tg u = ' + valueLabel(t));
      return true;
    }
    /* kömekçi burç: a sin u + b cos u = R sin(u + φ) */
    res.method = res.method === 'factor' ? 'factor' : 'auxiliary';
    const R = Math.hypot(a, b), d = -c;
    const phi = Math.atan2(b, a);
    const phiQ = rationalize(phi / PI, 360, 1e-12);
    const phiA = A(phiQ && asinQ(b / R) !== null ? phiQ : null, phi);
    res.steps.push('Kömekçi burç usuly: ' + polyText([[a, 'sin u'], [b, 'cos u']]) + ' = R·sin(u + φ), bu ýerde R = √(a² + b²) = √(' + coefLabel(a * a) + ' + ' + coefLabel(b * b) + ') = ' + valueLabel(R) + ', cos φ = a/R = ' + valueLabel(a / R) + ', sin φ = b/R = ' + valueLabel(b / R) + ' ⇒ φ = ' + (phiA.q ? qText(phiA.q) : '≈ ' + fmtNum(phi, 6)) + '.');
    const t = d / R;
    res.steps.push('Diýmek ' + valueLabel(R) + '·sin(u + φ) = ' + valueLabel(d) + ' ⇒ sin(u + φ) = ' + valueLabel(t) + '.');
    const b0 = basicSeries('sin', { v: t, label: valueLabel(t) });
    b0.why = 'sin(u + φ) = ' + valueLabel(t);
    b0.shift = phiA;
    if (b0.none) { b0.x = []; res.branches.push(b0); return true; }
    /* u = (u + φ) − φ */
    const ser = b0.series.map((s) => ({ base: aAdd(s.base, aNeg(phiA)), pq: s.pq }));
    b0.useries = ser;
    b0.x = toX(ser, base);
    if (b0.series.length === 2) b0.compact = compactX('sin', b0.theta, shiftLin(base, phiA, 1), res.v || 'x');
    res.branches.push(b0);
    return true;
  }
  function solveT(P, base, mode, res, eq) {
    const v = eq.v, u = uName(base, v);
    res.u = u; res.base = base;
    const fn = mode === 't' ? 'tan' : 'cot', other = mode === 't' ? 'ctg' : 'tg', tn = FN_TK[fn] + ' u';
    if (u !== v) res.steps.push('Ähli funksiýalaryň argumenti şol bir: u = ' + u + '.');
    const Z = (x) => Math.abs(x) < 1e-12;
    const { am1, a0, a1, a2 } = P;
    if (!Z(am1)) {
      if (!Z(a2)) return false;
      res.steps.push(other + ' u = 1 / ' + tn + ' (' + tn + ' ≠ 0) ornuna goýup, deňlemäni t = ' + tn + '-a köpeldýäris: ' + polyText([[a1, 't²'], [a0, 't'], [am1, '']]) + ' = 0.');
      res.method = 'quadratic';
      const qr = quadRoots(a1, a0, am1);
      qr.steps.forEach((s) => res.steps.push(s));
      if (!qr.roots.length) { res.steps.push('Hakyky kök ýok — çözgüt ýok.'); return true; }
      qr.roots.forEach((t) => { if (Math.abs(t) < 1e-12) { res.steps.push('t = 0 ýaramaýar (' + other + ' u kesgitlenmedik).'); return; } addBasic(res, fn, { v: t, label: valueLabel(t) }, base, tn + ' = ' + valueLabel(t)); });
      return true;
    }
    return quadPath(res, fn, a2, a1, a0, base, tn);
  }
  function finish(res, eq, lo, hi) {
    /* argument diňe x bolsa, düşündirişlerde u-nyň ýerine x ýazylýar */
    if (res.u && res.u === res.v) {
      const fix = (t) => (typeof t === 'string' ? t.replace(/(^|[^A-Za-zÀ-ž_])u(?=$|[^A-Za-zÀ-ž_0-9])/g, '$1' + res.v) : t);
      res.steps = res.steps.map(fix);
      res.branches.forEach((b) => { b.why = fix(b.why); b.special = fix(b.special); b.note = fix(b.note); });
    }
    const xs = [];
    res.branches.forEach((b) => { (b.x || []).forEach((s) => xs.push(s)); });
    res.series = xs;
    res.particular = res.identity ? [] : inInterval(xs, lo, hi, 60, res.closed);
    /* barlag: deňlemä goýmak */
    let maxErr = 0, bad = [];
    res.particular.forEach((p) => {
      const val = eq.f(p.x);
      const err = Math.abs(val);
      p.check = isFinite(val) ? err : NaN;
      if (!isFinite(val) || err > 1e-7) bad.push(p);
      else maxErr = Math.max(maxErr, err);
    });
    if (bad.length) {
      res.particular = res.particular.filter((p) => bad.indexOf(p) < 0);
      res.warnings = (res.warnings || []).concat(['Käbir tapylan bahalar deňlemä goýlanda kanagatlandyrmady we aýryldy (funksiýa şol nokatlarda kesgitlenmedik bolup biler).']);
    }
    res.check = { maxErr, n: res.particular.length };
    res.ok = true;
    return res;
  }
  function numericSolve(eq, res, lo, hi, calls, lins, outside) {
    res.method = 'numeric';
    res.steps.push('Bu deňleme üçin umumy formula gurlup bilinmedi, şonuň üçin [' + fmtNum(lo, 4) + '; ' + fmtNum(hi, 4) + '] aralykdaky kökleri san usuly bilen tapýarys (alamatyň üýtgeýşi + ýarpylatma).');
    const f = eq.f, N = 6000, roots = [];
    const h = (hi - lo) / N;
    let xp = lo, fp = f(lo);
    const push = (r) => { if (r >= lo - 1e-9 && r <= hi + 1e-9 && (res.closed || r < hi - 1e-9) && !roots.some((q) => Math.abs(q - r) < 1e-7)) roots.push(r); };
    if (isFinite(fp) && Math.abs(fp) < 1e-12) push(lo);
    for (let i = 1; i <= N; i++) {
      const x = lo + i * h, fx = f(x);
      if (isFinite(fx) && Math.abs(fx) < 1e-12) push(x);
      else if (isFinite(fp) && isFinite(fx) && fp * fx < 0) {
        let a = xp, b = x, fa = fp;
        for (let k = 0; k < 80; k++) { const m = (a + b) / 2, fm = f(m); if (!isFinite(fm)) break; if (fa * fm <= 0) b = m; else { a = m; fa = fm; } }
        const r = (a + b) / 2, fr = f(r);
        if (isFinite(fr) && Math.abs(fr) < 1e-6) push(r);
      }
      xp = x; fp = fx;
    }
    /* galtaşma kökleri: |f| ýerli minimumlary */
    for (let i = 1; i < N; i++) {
      const x0 = lo + (i - 1) * h, x1 = lo + i * h, x2 = lo + (i + 1) * h;
      const f0 = Math.abs(f(x0)), f1 = Math.abs(f(x1)), f2 = Math.abs(f(x2));
      if (f1 <= f0 && f1 <= f2 && f1 < 1e-3) {
        let a = x0, b = x2;
        for (let k = 0; k < 100; k++) { const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3; if (Math.abs(f(m1)) < Math.abs(f(m2))) b = m2; else a = m1; }
        const r = (a + b) / 2;
        if (Math.abs(f(r)) < 1e-9) push(r);
      }
    }
    roots.sort((a, b) => a - b);
    res.particular = roots.slice(0, 60).map((x) => ({ x: Math.abs(x) < 1e-12 ? 0 : x, q: rationalize(x / PI, 360, 1e-9), approx: true }));
    res.series = [];
    const ints = !outside && lins.length && lins.every((l) => l && near(l.k, Math.round(l.k)) && Math.round(l.k) !== 0);
    if (ints) res.periodic = '2π';
    res.check = { maxErr: res.particular.reduce((m, p) => Math.max(m, Math.abs(f(p.x))), 0), n: res.particular.length };
    res.ok = true;
    return res;
  }

  /* ------------------------------------------------------------------ toždestwo barlagy */
  function checkIdentity(input) {
    const eq = parseEquation(input);
    if (!/=/.test(eq.norm)) throw new TrigError('Toždestwonyň iki tarapyny «=» bilen ýazyň: mysal üçin sin(2x) = 2sin(x)cos(x).');
    const cL = eq.L.compile(), cR = eq.R.compile();
    const ev = (c, x) => { const sc = {}; sc[eq.v] = x; try { const r = c.evaluate(sc); return typeof r === 'number' ? r : NaN; } catch (e) { return NaN; } };
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    let tested = 0, skipped = 0, worst = 0;
    for (let i = 0; i < 160 && tested < 60; i++) {
      const x = -3.1 + 6.2 * rnd() + (i % 7) * 0.013;
      const l = ev(cL, x), r = ev(cR, x);
      if (!isFinite(l) || !isFinite(r) || Math.abs(l) > 1e8 || Math.abs(r) > 1e8) { skipped++; continue; }
      tested++;
      const err = Math.abs(l - r) / (1 + Math.abs(l) + Math.abs(r));
      if (err > 1e-9) return { ok: true, identity: false, v: eq.v, x, l, r, tested, text: 'Toždestwo däl: ' + eq.v + ' = ' + fmtNum(x, 4) + ' bolanda çep tarap ≈ ' + fmtNum(l, 6) + ', sag tarap ≈ ' + fmtNum(r, 6) + '.' };
      worst = Math.max(worst, err);
    }
    if (!tested) return { ok: false, error: 'Aňlatmany hasaplap bolmady: iki tarap hem kesgitlenen nokat tapylmady.' };
    return { ok: true, identity: true, v: eq.v, tested, skipped, worst, text: 'Toždestwo: ' + tested + ' tötänleýin nokatda iki tarap deň' + (skipped ? ' (' + skipped + ' nokatda aňlatma kesgitlenmedik — ol nokatlar toždestwonyň ýaýlasyna girmeýär)' : '') + '.' };
  }

  /* ------------------------------------------------------------------ grafik kömekçisi */
  /* y = A·f(Bx + C) + D häsiýetleri */
  function waveInfo(fn, Aamp, B, C, D) {
    if (!isFinite(Aamp) || !isFinite(B) || !isFinite(C) || !isFinite(D)) throw new TrigError('Parametrler san bolmaly.');
    if (Math.abs(B) < 1e-12) throw new TrigError('B ≠ 0 bolmaly.');
    const per = (fn === 'tan' || fn === 'cot' ? PI : 2 * PI) / Math.abs(B);
    return {
      period: per, periodLabel: valueLabelPi(per),
      amplitude: fn === 'sin' || fn === 'cos' ? Math.abs(Aamp) : null,
      shift: -C / B, shiftLabel: valueLabelPi(-C / B),
      vshift: D,
      range: fn === 'sin' || fn === 'cos' ? [D - Math.abs(Aamp), D + Math.abs(Aamp)] : null,
    };
  }
  function valueLabelPi(x) {
    const q = rationalize(x / PI, 360, 1e-10);
    return q ? qText(q) : fmtNum(x, 4);
  }

  /* ------------------------------------------------------------------ eksport */
  root.AmatlyTrig = {
    TrigError, REF, SIN_T, TAN_T,
    parseAngle, values, reduce, reductionSteps, inverse, evalNumber,
    normalizeEquation, parseEquation, solveEquation, checkIdentity, waveInfo,
    angleQ, angleRad, degText, radText, radHtml, qText, qHtml, qTex,
    seriesText, seriesHtml, compactX, exactVal, surdText, fmtNum, rationalize, valueLabel, valueLabelPi, fracHtml, fracTex,
  };
})(typeof window !== 'undefined' ? window : globalThis);
