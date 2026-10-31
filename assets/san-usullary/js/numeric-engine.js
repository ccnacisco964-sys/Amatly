/* ==========================================================================
   Amatly.com — San usullary: interpolýasiýa we çyzykly ulgamlaryň iterasiýa usullary (DOM ulanmaýar).
   window.AmatlyNumeric

   • Interpolýasiýa: Lagranžyň köpagzasy (bazis köpagzalary ℓᵢ(x)) we Nýutonyň bölünen tapawutlar köpagzasy.
     Nokatlar rasional bolsa (0.5, 1/3 …) — hasaplamalar takyk droblarda (math.fraction), köpagzanyň
     koeffisiýentleri takyk; f(x) funksiýadan alnan bahalarda — onluk sanlar.
   • Ýakobi we Gauss–Zeýdel usullary: diagonal agdyklygy barlamak (gerek bolsa setirleriň ornuny çalyşmak),
     iterasiýa tablisasy, duruş şerti max|xᵏ⁺¹ − xᵏ| < ε, iterasiýa matrisasynyň spektral radiusy (math.eigs).
   Synaglar: tests/numeric.test.mjs (Node).
   ========================================================================== */
(function (root) {
  'use strict';

  function NumError(message) { this.name = 'NumError'; this.message = message; }
  NumError.prototype = Object.create(Error.prototype);
  NumError.prototype.constructor = NumError;
  function M() {
    const m = root.math;
    if (!m || typeof m.fraction !== 'function') throw new NumError('math.js ýüklenmedi. assets/vendor/math.js faýlynyň ýerindedigini barlaň.');
    return m;
  }
  const MINUS = '−';
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (n) => String(n).split('').map((d) => SUB[+d]).join('');

  const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  function normalize(s) {
    return String(s).replace(/[\u00a0\u202f]/g, ' ').replace(/[−‒–—]/g, '-').replace(/[·×]/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi')
      .replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (m) => '^' + m.split('').map((c) => SUPS.indexOf(c)).join(''))
      .replace(/√\s*\(/g, 'sqrt(').replace(/√\s*([0-9.]+|[a-z])/g, 'sqrt($1)').trim();
  }
  /* bir san: takyk (Fraction) ýa-da onluk */
  function parseValue(str, where) {
    const s = normalize(str);
    if (!s) throw new NumError(where + ': san ýazyň.');
    let node;
    try { node = M().parse(s.replace(/(\d),(\d)/g, '$1.$2')); } catch (e) { throw new NumError(where + ': «' + str + '» san däl.'); }
    const fr = fracEval(node);
    if (fr) return { exact: true, f: fr, v: fr.valueOf() };
    let v;
    try { v = node.evaluate({}); } catch (e) { throw new NumError(where + ': «' + str + '» san däl.'); }
    if (typeof v !== 'number' || !isFinite(v)) throw new NumError(where + ': «' + str + '» hakyky san däl.');
    return { exact: false, v };
  }
  function fracEval(node) {
    if (node.isParenthesisNode) return fracEval(node.content);
    if (node.isConstantNode) { if (typeof node.value !== 'number' || !isFinite(node.value)) return null; const s = String(node.value); return /e/i.test(s) ? null : M().fraction(s); }
    if (node.isOperatorNode) {
      const a = node.args.map(fracEval);
      if (a.some((x) => !x)) return null;
      switch (node.fn) {
        case 'unaryMinus': return a[0].neg();
        case 'unaryPlus': return a[0];
        case 'add': return a[0].add(a[1]);
        case 'subtract': return a[0].sub(a[1]);
        case 'multiply': return a[0].mul(a[1]);
        case 'divide': return a[1].compare(0) === 0 ? null : a[0].div(a[1]);
        case 'pow': return String(a[1].d) === '1' && Math.abs(a[1].valueOf()) <= 6 && !(a[0].compare(0) === 0 && a[1].compare(0) <= 0) ? a[0].pow(a[1]) : null;
        default: return null;
      }
    }
    return null;
  }
  /* sanaw: "0, 1, 2.5; 4" ýa-da boşluk bilen */
  /* «0, 1, 2.5, 4» (otur bilen), «0 1 2.5 4» (boşluk bilen) ýa-da «0; 0,5; 1» (nokatly otur bilen —
     şonda onluk otur hem bolup biler: 0,5 = 0.5) */
  function splitList(s) {
    if (s.indexOf(';') >= 0) return s.split(';');
    if (s.indexOf(',') >= 0) return s.split(',');
    return s.split(/\s+/);
  }
  function parseList(str, what) {
    const s = String(str || '').trim().replace(/[;,]\s*$/, '');
    if (!s) throw new NumError(what + ': bahalary ýazyň (mysal: 0, 1, 2, 4).');
    const parts = splitList(s).map((x) => x.trim());
    if (parts.some((x) => !x)) throw new NumError(what + ': iki bölüjiniň arasynda baha ýok (mysal: «1, , 2»).');
    return parts.map((p, i) => parseValue(p, what + ', ' + (i + 1) + '-nji baha'));
  }

  /* ------------------------------------------------------------------ arifmetika: takyk ýa-da onluk */
  function field(exact) {
    if (exact) {
      return {
        exact: true, of: (x) => (x.f !== undefined ? x.f : M().fraction(x)),
        zero: () => M().fraction(0), one: () => M().fraction(1),
        add: (a, b) => a.add(b), sub: (a, b) => a.sub(b), mul: (a, b) => a.mul(b), div: (a, b) => a.div(b),
        isZero: (a) => a.compare(0) === 0, num: (a) => a.valueOf(), neg: (a) => a.neg(),
      };
    }
    return {
      exact: false, of: (x) => (typeof x === 'number' ? x : x.v),
      zero: () => 0, one: () => 1,
      add: (a, b) => a + b, sub: (a, b) => a - b, mul: (a, b) => a * b, div: (a, b) => a / b,
      isZero: (a) => Math.abs(a) < 1e-14, num: (a) => a, neg: (a) => -a,
    };
  }
  function fmtNum(v, d) {
    if (typeof v !== 'number' || !isFinite(v)) return '—';
    const av = Math.abs(v);
    if (av !== 0 && (av < 1e-5 || av >= 1e9)) return v.toExponential(4).replace('-', MINUS);
    let s = v.toFixed(d === undefined ? 6 : d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s.replace('-', MINUS);
  }
  function fmtK(K, a) { return K.exact ? a.toFraction().replace(/-/g, MINUS) : fmtNum(a); }
  function htmlK(K, a) {
    if (!K.exact) return fmtNum(a);
    const s = a.compare(0) < 0 ? MINUS : '', b = a.abs();
    return String(b.d) === '1' ? s + String(b.n) : s + '<span class="fr"><span class="fr-n">' + String(b.n) + '</span><span class="sr-only">/</span><span class="fr-d">' + String(b.d) + '</span></span>';
  }

  /* köpagzalar: koeffisiýentler [c0, c1, …] */
  function polyMul(K, p, q) {
    const r = new Array(p.length + q.length - 1).fill(null).map(() => K.zero());
    p.forEach((a, i) => q.forEach((b, j) => { r[i + j] = K.add(r[i + j], K.mul(a, b)); }));
    return r;
  }
  function polyAdd(K, p, q) {
    const n = Math.max(p.length, q.length), r = [];
    for (let i = 0; i < n; i++) r.push(K.add(i < p.length ? p[i] : K.zero(), i < q.length ? q[i] : K.zero()));
    return r;
  }
  function polyScale(K, p, c) { return p.map((a) => K.mul(a, c)); }
  function polyEval(K, p, x) { let r = K.zero(); for (let i = p.length - 1; i >= 0; i--) r = K.add(K.mul(r, x), p[i]); return r; }
  function polyTrim(K, p) { const r = p.slice(); while (r.length > 1 && K.isZero(r[r.length - 1])) r.pop(); return r; }
  function polyText(K, p, v) {
    const x = v || 'x';
    let s = '';
    for (let i = p.length - 1; i >= 0; i--) {
      const c = p[i];
      if (K.isZero(c)) continue;
      const neg = K.num(c) < 0, a = K.exact ? c.abs() : Math.abs(c);
      const one = K.exact ? a.equals(1) : Math.abs(a - 1) < 1e-15;
      let cs = fmtK(K, a);
      if (K.exact && cs.indexOf('/') > 0 && i > 0) cs = '(' + cs + ')';
      const term = i === 0 ? cs : (one ? '' : cs) + x + (i > 1 ? (i <= 9 ? '⁰¹²³⁴⁵⁶⁷⁸⁹'[i] : '^' + i) : '');
      s += s ? (neg ? ' ' + MINUS + ' ' : ' + ') + term : (neg ? MINUS : '') + term;
    }
    return s || '0';
  }

  /* ------------------------------------------------------------------ interpolýasiýa */
  function prepPoints(xs, ys) {
    if (xs.length !== ys.length) throw new NumError('x we y bahalarynyň sany deň bolmaly (x: ' + xs.length + ', y: ' + ys.length + ').');
    if (xs.length < 2) throw new NumError('Iň azyndan iki nokat gerek.');
    if (xs.length > 10) throw new NumError('Iň köp 10 nokat (köpagzanyň derejesi ≤ 9).');
    for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) if (Math.abs(xs[i].v - xs[j].v) < 1e-12) throw new NumError('x bahalary gaýtalanmaly däl: x' + sub(i) + ' = x' + sub(j) + ' = ' + fmtNum(xs[i].v) + '.');
    const exact = xs.every((p) => p.exact) && ys.every((p) => p.exact);
    return exact;
  }
  function lagrange(xsIn, ysIn, xStar) {
    const exact = prepPoints(xsIn, ysIn) && (!xStar || xStar.exact);
    const K = field(exact);
    const xs = xsIn.map(K.of), ys = ysIn.map(K.of), n = xs.length;
    const basis = [];
    let P = [K.zero()];
    for (let i = 0; i < n; i++) {
      let num = [K.one()], den = K.one();
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        num = polyMul(K, num, [K.neg(xs[j]), K.one()]);
        den = K.mul(den, K.sub(xs[i], xs[j]));
      }
      const li = polyScale(K, num, K.div(K.one(), den));
      const item = { i, den, li, factors: xs.map((x, j) => j).filter((j) => j !== i) };
      if (xStar) item.at = polyEval(K, li, K.of(xStar));
      basis.push(item);
      P = polyAdd(K, P, polyScale(K, li, ys[i]));
    }
    P = polyTrim(K, P);
    const res = { method: 'lagrange', K, exact, xs, ys, n, basis, P, degree: P.length - 1 };
    if (xStar) res.value = polyEval(K, P, K.of(xStar));
    return res;
  }
  function newton(xsIn, ysIn, xStar) {
    const exact = prepPoints(xsIn, ysIn) && (!xStar || xStar.exact);
    const K = field(exact);
    const xs = xsIn.map(K.of), ys = ysIn.map(K.of), n = xs.length;
    /* dd[k][i] = f[x_i, …, x_{i+k}] */
    const dd = [ys.slice()];
    for (let k = 1; k < n; k++) {
      const prev = dd[k - 1], row = [];
      for (let i = 0; i + k < n; i++) row.push(K.div(K.sub(prev[i + 1], prev[i]), K.sub(xs[i + k], xs[i])));
      dd.push(row);
    }
    const coef = dd.map((r) => r[0]);
    /* P(x) = c0 + c1(x − x0) + c2(x − x0)(x − x1) + … */
    let P = [K.zero()], prod = [K.one()];
    for (let k = 0; k < n; k++) {
      P = polyAdd(K, P, polyScale(K, prod, coef[k]));
      prod = polyMul(K, prod, [K.neg(xs[k]), K.one()]);
    }
    P = polyTrim(K, P);
    const res = { method: 'newton', K, exact, xs, ys, n, dd, coef, P, degree: P.length - 1 };
    if (xStar) {
      const x = K.of(xStar);
      /* Gorneriň (içe salnan) shemasy: (((c3)(x − x2) + c2)(x − x1) + c1)(x − x0) + c0 */
      let r = coef[n - 1];
      const nested = [];
      for (let k = n - 2; k >= 0; k--) { r = K.add(K.mul(r, K.sub(x, xs[k])), coef[k]); nested.push(r); }
      res.value = r; res.nested = nested;
    }
    return res;
  }
  function interpolate(opts) {
    /* opts: {x: '0, 1, 2', y: '1, 3, 2'} ýa-da {x: '…', f: 'sin(x)'}; at: '1.5' */
    const xs = parseList(opts.x, 'x bahalary');
    let ys, fFn = null, fText = null;
    if (opts.f) {
      fText = normalize(opts.f);
      let c;
      try { c = M().compile(fText.replace(/\bln\(/g, 'log(').replace(/\btg\(/g, 'tan(').replace(/\bctg\(/g, 'cot(')); } catch (e) { throw new NumError('f(x) funksiýany okap bolmady: «' + opts.f + '».'); }
      fFn = (x) => { const r = c.evaluate({ x }); return typeof r === 'number' ? r : NaN; };
      ys = xs.map((p, i) => {
        let v;
        try { v = fFn(p.v); } catch (e) { v = NaN; }
        if (!isFinite(v)) throw new NumError('f(x) funksiýa x' + sub(i) + ' = ' + fmtNum(p.v) + ' nokatda kesgitlenmedik.');
        /* f(x) bitin/rasional baha berse (x², 2x+1 …) — takyk saklaýarys */
        const fr = Number.isInteger(v) && Math.abs(v) < 1e12 ? M().fraction(v) : null;
        return fr && p.exact ? { exact: true, f: fr, v } : { exact: false, v };
      });
    } else ys = parseList(opts.y, 'y bahalary');
    const at = opts.at !== undefined && String(opts.at).trim() !== '' ? parseValue(opts.at, 'x*') : null;
    const L = lagrange(xs, ys, at), N = newton(xs, ys, at);
    const res = { lagrange: L, newton: N, at, xs, ys, fText };
    if (at && fFn) {
      const fv = fFn(at.v);
      res.f = fv;
      res.err = Math.abs(fv - L.K.num(L.value));
    }
    if (fFn) res.fFn = fFn;
    return res;
  }

  /* ------------------------------------------------------------------ Ýakobi we Gauss–Zeýdel */
  function parseMatrix(rows, rhs) {
    const n = rows.length;
    if (n < 2 || n > 6) throw new NumError('Ulgamyň ölçegi 2-den 6-a çenli bolmaly.');
    const A = rows.map((r, i) => {
      if (r.length !== n) throw new NumError('Matrisa kwadrat bolmaly.');
      return r.map((c, j) => parseValue(String(c).trim() === '' ? '0' : c, 'a' + sub(i + 1) + sub(j + 1)).v);
    });
    const b = rhs.map((c, i) => parseValue(String(c).trim() === '' ? '0' : c, 'b' + sub(i + 1)).v);
    return { A, b, n };
  }
  function dominance(A) {
    const rows = A.map((r, i) => {
      const d = Math.abs(r[i]), s = r.reduce((acc, a, j) => acc + (j === i ? 0 : Math.abs(a)), 0);
      return { i, d, s, strict: d > s + 1e-12, weak: d >= s - 1e-12 };
    });
    return { rows, strict: rows.every((r) => r.strict), weak: rows.every((r) => r.weak) && rows.some((r) => r.strict) };
  }
  function permutations(n) {
    const out = [], a = Array.from({ length: n }, (_, i) => i);
    (function rec(k) {
      if (k === n) { out.push(a.slice()); return; }
      for (let i = k; i < n; i++) { [a[k], a[i]] = [a[i], a[k]]; rec(k + 1); [a[k], a[i]] = [a[i], a[k]]; }
    })(0);
    return out;
  }
  /* diagonal agdyklyk üçin setirleriň tertibi (bar bolsa) */
  function findDominantOrder(A) {
    const n = A.length;
    let best = null;
    for (const p of permutations(n)) {
      const B = p.map((i) => A[i]);
      const d = dominance(B);
      if (d.strict) return { order: p, strict: true };
      if (d.weak && !best) best = { order: p, strict: false };
    }
    return best;
  }
  function spectralRadius(B) {
    try {
      const e = M().eigs(B);
      const vals = e.values && e.values.toArray ? e.values.toArray() : e.values;
      return Math.max(...vals.map((v) => (typeof v === 'number' ? Math.abs(v) : M().abs(v))));
    } catch (err) {
      /* güýç usuly (ätiýaçlyk) */
      let x = B.map(() => 1), lam = 0;
      for (let k = 0; k < 300; k++) {
        const y = B.map((r) => r.reduce((s, a, j) => s + a * x[j], 0));
        const nrm = Math.sqrt(y.reduce((s, v) => s + v * v, 0));
        if (!nrm) return 0;
        lam = nrm / Math.sqrt(x.reduce((s, v) => s + v * v, 0));
        x = y.map((v) => v / nrm);
      }
      return lam;
    }
  }
  function iterMatrices(A) {
    const n = A.length;
    const BJ = A.map((r, i) => r.map((a, j) => (i === j ? 0 : -a / r[i])));
    /* Zeýdel: B = −(D + L)⁻¹ U */
    let BS = null;
    try {
      const DL = A.map((r, i) => r.map((a, j) => (j <= i ? a : 0)));
      const U = A.map((r, i) => r.map((a, j) => (j > i ? a : 0)));
      const inv = M().inv(DL);
      BS = M().multiply(inv, U).map((r) => r.map((v) => -v));
      void n;
    } catch (e) { BS = null; }
    return { BJ, BS };
  }
  /* diagonalda nol bolmaz ýaly iň gowy tertip (Σ log|aᵢᵢ| iň uly) */
  function bestDiagonalOrder(A) {
    const n = A.length;
    let best = null, bestScore = -Infinity;
    for (const p of permutations(n)) {
      let score = 0, ok = true;
      for (let i = 0; i < n; i++) { const d = Math.abs(A[p[i]][i]); if (d < 1e-14) { ok = false; break; } score += Math.log(d); }
      if (ok && score > bestScore + 1e-12) { bestScore = score; best = p; }
    }
    return best;
  }
  const METHOD_NAME = { jacobi: 'Ýakobi', seidel: 'Gauss–Zeýdel' };
  function iterate(sys, opts) {
    const o = Object.assign({ method: 'jacobi', eps: 1e-6, maxIter: 100, x0: null, reorder: true }, opts || {});
    if (!(o.eps > 0)) throw new NumError('Ýalňyşlyk çägi ε položitel san bolmaly.');
    if (!(o.maxIter >= 1 && o.maxIter <= 1000)) throw new NumError('Iň köp gaýtalama sany 1 bilen 1000 aralykda bolmaly.');
    let A = sys.A.map((r) => r.slice()), b = sys.b.slice();
    const n = A.length;
    const res = { method: o.method, name: METHOD_NAME[o.method] || o.method, n, eps: o.eps };
    const dom0 = dominance(A);
    res.dominance0 = dom0;
    res.dominance = dom0;
    const apply = (order, why) => {
      res.reordered = order; res.reorderWhy = why;
      A = order.map((i) => sys.A[i].slice()); b = order.map((i) => sys.b[i]);
      res.dominance = dominance(A);
    };
    if (!dom0.strict) {
      const f = findDominantOrder(sys.A);
      if (f && f.order.some((v, i) => v !== i) && (f.strict || !dom0.weak)) {
        if (o.reorder) apply(f.order, f.strict ? 'dominance' : 'weak');
        else res.suggest = f.order;
      }
    }
    const zeroDiag = () => A.findIndex((r, i) => Math.abs(r[i]) < 1e-14);
    if (zeroDiag() >= 0 && o.reorder && !res.reordered) {
      const p = bestDiagonalOrder(sys.A);
      if (p) apply(p, 'zero');
    }
    const z = zeroDiag();
    if (z >= 0) {
      res.error = 'Diagonalda nol bar (a' + sub(z + 1) + sub(z + 1) + ' = 0): ' + res.name + ' usulynda her deňleme öz diagonal elementine bölünýär. ' +
        (o.reorder ? 'Deňlemeleriň tertibini çalşanda-da diagonaly nolsuz edip bolmady — ulgamyň kesgitleýjisi 0 bolmagy mümkin.' : 'Deňlemeleriň ornuny çalşyň (ýa-da «ornuny çalyş» belgisini goýuň).');
      return res;
    }
    res.A = A; res.b = b;
    try { res.det = M().det(A); } catch (e) { res.det = null; }
    const { BJ, BS } = iterMatrices(A);
    res.B = o.method === 'jacobi' ? BJ : (BS || BJ);
    res.rho = spectralRadius(res.B);
    let x = o.x0 && o.x0.length === n ? o.x0.slice() : new Array(n).fill(0);
    const rows = [{ k: 0, x: x.slice(), err: null }];
    let status = 'limit';
    for (let k = 1; k <= o.maxIter; k++) {
      const nx = x.slice();
      for (let i = 0; i < n; i++) {
        let s = b[i];
        for (let j = 0; j < n; j++) if (j !== i) s -= A[i][j] * (o.method === 'seidel' ? nx[j] : x[j]);
        nx[i] = s / A[i][i];
      }
      const err = Math.max(...nx.map((v, i) => Math.abs(v - x[i])));
      rows.push({ k, x: nx.slice(), err });
      x = nx;
      if (!isFinite(err) || err > 1e12) { status = 'diverge'; break; }
      if (err < o.eps) { status = 'converged'; break; }
      /* ρ(B) > 1 we ýalňyşlyk 10⁴ esse ulaldy — dargaýandygy belli, dowam etdirmegiň manysy ýok */
      if (res.rho > 1 + 1e-9 && k >= 6 && err > 1e4 * Math.max(rows[1].err, 1e-300)) { status = 'diverge'; break; }
    }
    if (status === 'limit' && res.rho > 1 + 1e-9 && rows.length > 3 && rows[rows.length - 1].err > rows[1].err) status = 'diverge';
    res.rows = rows; res.status = status; res.x = x; res.iterations = rows.length - 1;
    /* takyk çözgüt bilen deňeşdirmek (math.lusolve) */
    res.exact = null;
    if (res.det !== null && Math.abs(res.det) > 1e-12) {
      try {
        const ex = M().lusolve(A, b).map((r) => r[0]);
        if (ex.every((v) => isFinite(v))) { res.exact = ex; res.diff = Math.max(...ex.map((v, i) => Math.abs(v - x[i]))); }
      } catch (e) { res.exact = null; }
    }
    res.residual = x.every((v) => isFinite(v)) ? Math.max(...A.map((r, i) => Math.abs(r.reduce((s, a, j) => s + a * x[j], 0) - b[i]))) : Infinity;
    return res;
  }

  root.AmatlyNumeric = { NumError, normalize, parseValue, parseList, splitList, interpolate, lagrange, newton, polyText, polyEval, fmtNum, fmtK, htmlK, field, parseMatrix, dominance, findDominantOrder, bestDiagonalOrder, iterate, spectralRadius, sub, METHOD_NAME };
})(typeof window !== 'undefined' ? window : globalThis);
