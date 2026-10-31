/* ==========================================================================
   Amatly.com — Amal barlagynyň goşmaça usullary (DOM ulanmaýar). Brauzerde: window.AmatlyOR

   1) Bellemek meselesi — Wengr usuly: setir/sütün boýunça azaltmak, nollary iň az çyzyk bilen örtmek
      (Kýoniniň teoremasy), δ bilen düzetmek; ikilenji potensiallar (u, v) bilen optimallyk subutnamasy.
   2) Ikilenji simpleks usuly — ikilenji mümkin (optimallyk şerti ýerine ýetýän), ýöne B-de otrisatel
      bahaly tablisadan başlap; ikilenji meseläni gurmak we W* = Z* barlagy.
   3) Bitin sanly programmirleme — şahalar we araçäkler usuly (Land–Doig); her düwündäki ÇP meselesini
      simpleks motory (window.AmatlySimplex) çözýär.
   4) Oýunlar nazaryýeti — iki oýunçyly nol jemli matrisa oýny: eýer nokady, agdyklyk, 2×2 formula,
      umumy ýagdaýda çyzykly programmirleme (simpleks).
   5) Tor meýilnamasy — CPM (kritiki ýol) we PERT (üç baha, ähtimallyk).
   6) Iň gysga ýol — Deýkstra, Bellman–Ford we Floýd–Uorşell.

   Takyk hasaplamalar math.js droblarynda (math.fraction). Synaglar: tests/or.test.mjs (Node).
   ========================================================================== */
(function (root) {
  'use strict';

  function ORError(message) { this.name = 'ORError'; this.message = message; }
  ORError.prototype = Object.create(Error.prototype);
  ORError.prototype.constructor = ORError;

  function M() {
    const m = root.math;
    if (!m || typeof m.fraction !== 'function') throw new ORError('math.js ýüklenmedi. assets/vendor/math.js faýlynyň ýerindedigini barlaň.');
    return m;
  }
  function SX() {
    const s = root.AmatlySimplex;
    if (!s || typeof s.solve !== 'function') throw new ORError('Simpleks motory (assets/simpleks/js/simplex-engine.js) ýüklenmedi.');
    return s;
  }
  const F = (x, y) => (y === undefined ? M().fraction(x) : M().fraction(x, y));
  const isZ = (f) => f.compare(0) === 0;
  const isInt = (f) => String(f.d) === '1';
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (n) => String(n).split('').map((d) => (SUB[+d] !== undefined && d !== ' ' ? SUB[+d] : d)).join('');
  function ordinal(n) {
    const d = n % 10, t = Math.floor(n / 10) % 10;
    const back = d !== 0 ? (d === 6 || d === 9) : [1, 3, 4, 6, 9].indexOf(t) >= 0;
    return n + (back ? '-njy' : '-nji');
  }
  function fmin(list) { return list.reduce((a, b) => (b.compare(a) < 0 ? b : a)); }
  function fmax(list) { return list.reduce((a, b) => (b.compare(a) > 0 ? b : a)); }

  /* ------------------------------------------------------------------ sanlary okamak */
  function normalize(s) {
    return String(s == null ? '' : s).replace(/[  ]/g, ' ').replace(/[−‒–—]/g, '-').replace(/[·×∙⋅]/g, '*')
      .replace(/÷/g, '/').replace(/(\d),(\d)/g, '$1.$2').trim();
  }
  function fracEval(node) {
    if (node.isParenthesisNode) return fracEval(node.content);
    if (node.isConstantNode) {
      if (typeof node.value !== 'number' || !isFinite(node.value)) return null;
      const s = String(node.value);
      return /e/i.test(s) ? M().fraction(node.value) : M().fraction(s);
    }
    if (node.isOperatorNode) {
      const a = node.args.map(fracEval);
      if (a.some((x) => !x)) return null;
      switch (node.fn) {
        case 'unaryMinus': return a[0].neg();
        case 'unaryPlus': return a[0];
        case 'add': return a[0].add(a[1]);
        case 'subtract': return a[0].sub(a[1]);
        case 'multiply': return a[0].mul(a[1]);
        case 'divide': return isZ(a[1]) ? null : a[0].div(a[1]);
        case 'pow': return isInt(a[1]) && Math.abs(a[1].valueOf()) <= 6 && !(isZ(a[0]) && a[1].compare(0) <= 0) ? a[0].pow(a[1]) : null;
        default: return null;
      }
    }
    return null;
  }
  const FORBID = /^(m|∞|inf|infinity|x|—|–)$/i;
  /* bir san (Fraction). opts.forbid — «M» ýa-da «∞» ýazylsa null (gadagan öýjük); opts.empty — boş öýjügiň bahasy */
  function parseNum(str, where, opts) {
    const o = opts || {};
    const raw = String(str == null ? '' : str).trim();
    if (o.forbid && FORBID.test(raw)) return null;
    const s = normalize(raw);
    if (s === '') {
      if (o.empty !== undefined) return o.empty === null ? null : F(o.empty);
      throw new ORError(where + ': san ýazyň.');
    }
    let node;
    try { node = M().parse(s); } catch (e) { throw new ORError(where + ': «' + raw + '» san däl (mysal: 3, −2, 1/2, 2.5).'); }
    const f = fracEval(node);
    if (!f) throw new ORError(where + ': «' + raw + '» san däl (mysal: 3, −2, 1/2, 2.5).');
    return f;
  }
  function parseMatrix(rows, what, opts) {
    if (!rows.length || !rows[0].length) throw new ORError(what + ': tablisa boş.');
    return rows.map((r, i) => r.map((c, j) => parseNum(c, what + ', ' + ordinal(i + 1) + ' setir, ' + ordinal(j + 1) + ' sütün', opts)));
  }

  /* ==================================================================== 1) WENGR USULY */
  function copyM(W) { return W.map((r) => r.slice()); }
  /* nollar boýunça iň uly gabat gelme (Kuhnyň usuly, setirler tertibinde) */
  function maxMatching(W) {
    const N = W.length;
    const matchC = new Array(N).fill(-1);
    const zero = (i, j) => W[i][j] !== null && isZ(W[i][j]);
    function tryRow(i, seen) {
      for (let j = 0; j < N; j++) {
        if (!zero(i, j) || seen[j]) continue;
        seen[j] = true;
        if (matchC[j] < 0 || tryRow(matchC[j], seen)) { matchC[j] = i; return true; }
      }
      return false;
    }
    for (let i = 0; i < N; i++) tryRow(i, new Array(N).fill(false));
    const matchR = new Array(N).fill(-1);
    matchC.forEach((i, j) => { if (i >= 0) matchR[i] = j; });
    return { matchR, matchC, size: matchR.filter((j) => j >= 0).length };
  }
  /* iň az çyzyk: bellenmedik setirlerden başlap belgilemek (Kýoniniň teoremasy) */
  function minCover(W, mt) {
    const N = W.length;
    const markR = mt.matchR.map((j) => j < 0), markC = new Array(N).fill(false);
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < N; i++) {
        if (!markR[i]) continue;
        for (let j = 0; j < N; j++) {
          if (markC[j] || W[i][j] === null || !isZ(W[i][j])) continue;
          markC[j] = true; changed = true;
          const r = mt.matchC[j];
          if (r >= 0 && !markR[r]) markR[r] = true;
        }
      }
    }
    const rows = [], cols = [];
    for (let i = 0; i < N; i++) if (!markR[i]) rows.push(i);
    for (let j = 0; j < N; j++) if (markC[j]) cols.push(j);
    return { rows, cols };
  }
  function hungarian(C, opts) {
    const o = opts || {};
    const sense = o.sense === 'max' ? 'max' : 'min';
    const m = C.length, n = C[0].length;
    if (m < 2 || n < 2) throw new ORError('Iň azyndan 2×2 tablisa gerek.');
    if (m > 10 || n > 10) throw new ORError('Iň köp 10 setir we 10 sütün.');
    const fin = [];
    C.forEach((r) => r.forEach((v) => { if (v !== null) fin.push(v); }));
    if (!fin.length) throw new ORError('Tablisada san ýok.');
    C.forEach((r, i) => { if (n <= m && r.every((v) => v === null)) throw new ORError(ordinal(i + 1) + ' setirde mümkin öýjük ýok (hemmesi gadagan).'); });
    const N = Math.max(m, n);
    const steps = [];
    let base;
    if (sense === 'max') {
      const mx = fmax(fin);
      base = C.map((r) => r.map((v) => (v === null ? null : mx.sub(v))));
      steps.push({ type: 'max', mx, M: copyM(base) });
    } else base = copyM(C);
    let W = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => (i < m && j < n ? base[i][j] : F(0))));
    if (m !== n) steps.push({ type: 'pad', rows: N - m, cols: N - n, M: copyM(W) });
    const work = copyM(W);                     /* azaltmazdan öňki (özgerdilen) matrisa */
    const u = new Array(N).fill(null).map(() => F(0)), v = new Array(N).fill(null).map(() => F(0));
    const minOf = (arr) => { const f = arr.filter((x) => x !== null); return f.length ? fmin(f) : null; };
    const rowMin = W.map((r) => minOf(r));
    rowMin.forEach((x, i) => { if (x === null) throw new ORError(ordinal(i + 1) + ' setirde mümkin öýjük ýok.'); });
    W = W.map((r, i) => r.map((x) => (x === null ? null : x.sub(rowMin[i]))));
    rowMin.forEach((x, i) => { u[i] = x; });
    steps.push({ type: 'rows', mins: rowMin, M: copyM(W) });
    const colMin = Array.from({ length: N }, (_, j) => minOf(W.map((r) => r[j])));
    colMin.forEach((x, j) => { if (x === null) throw new ORError(ordinal(j + 1) + ' sütünde mümkin öýjük ýok.'); });
    W = W.map((r) => r.map((x, j) => (x === null ? null : x.sub(colMin[j]))));
    colMin.forEach((x, j) => { v[j] = x; });
    steps.push({ type: 'cols', mins: colMin, M: copyM(W) });
    let mt = null, status = 'optimal';
    for (let it = 0; it < 100; it++) {
      mt = maxMatching(W);
      const cover = minCover(W, mt);
      const lines = cover.rows.length + cover.cols.length;
      steps.push({ type: 'cover', M: copyM(W), rows: cover.rows, cols: cover.cols, lines, match: mt.matchR.slice() });
      if (lines >= N) break;
      const rc = new Array(N).fill(false), cc = new Array(N).fill(false);
      cover.rows.forEach((i) => { rc[i] = true; });
      cover.cols.forEach((j) => { cc[j] = true; });
      const unc = [];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (!rc[i] && !cc[j] && W[i][j] !== null) unc.push(W[i][j]);
      if (!unc.length) { status = 'infeasible'; break; }
      const delta = fmin(unc);
      W = W.map((r, i) => r.map((x, j) => {
        if (x === null) return null;
        if (!rc[i] && !cc[j]) return x.sub(delta);
        if (rc[i] && cc[j]) return x.add(delta);
        return x;
      }));
      for (let i = 0; i < N; i++) if (!rc[i]) u[i] = u[i].add(delta);
      for (let j = 0; j < N; j++) if (cc[j]) v[j] = v[j].sub(delta);
      steps.push({ type: 'adjust', delta, rows: cover.rows, cols: cover.cols, M: copyM(W) });
    }
    const res = { sense, m, n, N, steps, u, v, work, status };
    if (status !== 'optimal' || mt.size < N) { res.status = 'infeasible'; return res; }
    res.assign = mt.matchR.slice();                       /* setir → sütün (goşmaça bilen) */
    res.pairs = [];
    let total = F(0), dualSum = F(0), workTotal = F(0);
    res.assign.forEach((j, i) => {
      workTotal = workTotal.add(work[i][j]);
      if (i < m && j < n) { res.pairs.push([i, j]); total = total.add(C[i][j]); }
    });
    u.forEach((x) => { dualSum = dualSum.add(x); });
    v.forEach((x) => { dualSum = dualSum.add(x); });
    res.total = total;
    res.unassignedRows = []; res.unassignedCols = [];
    res.assign.forEach((j, i) => { if (i < m && j >= n) res.unassignedRows.push(i); if (i >= m && j < n) res.unassignedCols.push(j); });
    /* optimallyk subutnamasy: R = C' − u − v ≥ 0 we Σu + Σv = Σ C'(bellenen) */
    let feasible = true;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (work[i][j] !== null && work[i][j].sub(u[i]).sub(v[j]).compare(0) < 0) feasible = false;
    res.certificate = { feasible, dualSum, workTotal, ok: feasible && dualSum.equals(workTotal) };
    return res;
  }
  /* barlag üçin: ähli ýerleşdirmeleri gözden geçirmek (N ≤ 8) */
  function assignBrute(C, sense) {
    const m = C.length, n = C[0].length, N = Math.max(m, n);
    if (N > 8) return null;
    const val = (i, j) => (i < m && j < n ? C[i][j] : F(0));
    let best = null;
    const used = new Array(N).fill(false), perm = [];
    (function rec(i, acc) {
      if (i === N) { if (!best || (sense === 'max' ? acc.compare(best) > 0 : acc.compare(best) < 0)) best = acc; return; }
      for (let j = 0; j < N; j++) {
        if (used[j]) continue;
        const c = val(i, j);
        if (c === null) continue;
        used[j] = true; perm.push(j);
        rec(i + 1, acc.add(c));
        used[j] = false; perm.pop();
      }
    })(0, F(0));
    return best;
  }

  /* ==================================================================== 2) IKILENJI SIMPLEKS */
  function dualProblem(p) {
    const max = p.sense === 'max';
    const signs = p.cons.map((k) => (k.op === '=' ? 'free' : (k.op === '<=') === max ? '>=0' : '<=0'));
    return {
      sense: max ? 'min' : 'max', objName: 'W', vars: p.cons.map((_, i) => 'y' + (i + 1)),
      c: p.cons.map((k) => k.b), c0: p.c0,
      cons: p.vars.map((_, j) => ({ a: p.cons.map((k) => k.a[j]), op: max ? '>=' : '<=', b: p.c[j] })), signs,
    };
  }
  function dualSimplex(p, opts) {
    const o = Object.assign({ maxIter: 40 }, opts || {});
    const n = p.vars.length, max = p.sense === 'max';
    const bad = [];
    p.c.forEach((c, j) => { if (max ? c.compare(0) > 0 : c.compare(0) < 0) bad.push(j); });
    const res = { problem: p, sense: p.sense, dual: dualProblem(p) };
    if (bad.length) return Object.assign(res, { status: 'not-dual-feasible', bad });
    const rows = [];
    p.cons.forEach((k, i) => {
      if (k.op === '<=') rows.push({ a: k.a, b: k.b, from: i, how: 'keep' });
      else if (k.op === '>=') rows.push({ a: k.a.map((x) => x.neg()), b: k.b.neg(), from: i, how: 'neg' });
      else {
        rows.push({ a: k.a, b: k.b, from: i, how: 'eq1' });
        rows.push({ a: k.a.map((x) => x.neg()), b: k.b.neg(), from: i, how: 'eq2' });
      }
    });
    const m = rows.length;
    const sP = p.vars.some((v) => /^s\d+$/.test(v)) ? 'u' : 's';
    const cols = p.vars.map((name, j) => ({ name, kind: 'x', j })).concat(rows.map((_, i) => ({ name: sP + (i + 1), kind: 's', row: i })));
    const cost = p.c.concat(rows.map(() => F(0)));
    let A = rows.map((r, i) => r.a.concat(rows.map((_, k) => F(k === i ? 1 : 0))));
    let b = rows.map((r) => r.b);
    const basis = rows.map((_, i) => n + i);
    res.rows = rows; res.cols = cols; res.cost = cost;
    const snaps = [];
    const evaluate = () => {
      const cb = basis.map((j) => cost[j]);
      const delta = cols.map((_, j) => { let z = F(0); A.forEach((r, i) => { z = z.add(cb[i].mul(r[j])); }); return z.sub(cost[j]); });
      let Z = p.c0; b.forEach((bi, i) => { Z = Z.add(cb[i].mul(bi)); });
      return { cb, delta, Z };
    };
    let status = 'limit';
    for (let it = 0; it <= o.maxIter; it++) {
      const ev = evaluate();
      const snap = { basis: basis.slice(), A: copyM(A), b: b.slice(), cb: ev.cb, delta: ev.delta, Z: ev.Z, leaving: -1, entering: -1, ratios: null };
      snaps.push(snap);
      let r = -1;
      b.forEach((bi, i) => { if (bi.compare(0) < 0 && (r < 0 || bi.compare(b[r]) < 0)) r = i; });
      if (r < 0) { status = 'optimal'; snap.status = 'optimal'; break; }
      snap.leaving = r;
      const ratios = cols.map((_, j) => (A[r][j].compare(0) < 0 ? ev.delta[j].div(A[r][j]).abs() : null));
      snap.ratios = ratios;
      let k = -1;
      ratios.forEach((q, j) => { if (q !== null && basis.indexOf(j) < 0 && (k < 0 || q.compare(ratios[k]) < 0)) k = j; });
      if (k < 0) { status = 'infeasible'; snap.status = 'infeasible'; break; }
      snap.entering = k;
      if (it === o.maxIter) break;
      const pe = A[r][k];
      A[r] = A[r].map((x) => x.div(pe)); b[r] = b[r].div(pe);
      for (let i = 0; i < m; i++) {
        if (i === r || isZ(A[i][k])) continue;
        const f = A[i][k];
        A[i] = A[i].map((x, j) => x.sub(f.mul(A[r][j])));
        b[i] = b[i].sub(f.mul(b[r]));
      }
      basis[r] = k;
    }
    res.snapshots = snaps; res.status = status;
    if (status !== 'optimal') return res;
    const last = snaps[snaps.length - 1];
    const val = cols.map(() => F(0));
    basis.forEach((j, i) => { val[j] = b[i]; });
    res.x = p.vars.map((_, j) => val[j]);
    let Z = p.c0;
    p.c.forEach((c, j) => { Z = Z.add(c.mul(res.x[j])); });
    res.z = Z;
    /* ikilenji bahalar: goşmaça üýtgeýänleriň Δ bahalary → asyl çäklendirmeler */
    const y = p.cons.map(() => F(0));
    rows.forEach((row, i) => {
      const d = last.delta[n + i];
      y[row.from] = row.how === 'keep' || row.how === 'eq1' ? y[row.from].add(d) : y[row.from].sub(d);
    });
    let W = p.c0;
    p.cons.forEach((k, i) => { W = W.add(k.b.mul(y[i])); });
    res.y = y; res.W = W;
    return res;
  }

  /* ==================================================================== 3) ŞAHALAR WE ARAÇÄKLER */
  function frac(f) { return f.sub(f.floor()); }
  function branchAndBound(p, opts) {
    const o = Object.assign({ maxNodes: 60, method: 'bigM', intVars: null }, opts || {});
    const S = SX();
    const n = p.vars.length, max = p.sense === 'max';
    const intVars = (o.intVars || p.vars.map((_, j) => j)).slice().sort((a, b) => a - b);
    const better = (a, b) => (max ? a.compare(b) > 0 : a.compare(b) < 0);
    const unit = (j) => p.vars.map((_, k) => F(k === j ? 1 : 0));
    const nodes = [];
    function solveNode(bounds, parent, branch) {
      const cons = p.cons.slice();
      bounds.forEach((bd, j) => {
        if (bd.lo !== null && bd.lo.compare(0) > 0) cons.push({ a: unit(j), op: '>=', b: bd.lo, line: 0, text: '', bound: true });
        if (bd.hi !== null) cons.push({ a: unit(j), op: '<=', b: bd.hi, line: 0, text: '', bound: true });
      });
      const q = Object.assign({}, p, { cons });
      let r;
      try { r = S.solve(q, { method: o.method }); } catch (e) { r = { status: 'error', message: e.message }; }
      const node = { id: nodes.length + 1, parent: parent ? parent.id : null, depth: parent ? parent.depth + 1 : 0, branch, bounds, lp: r.status, children: [] };
      if (r.status === 'optimal') {
        node.x = r.x; node.z = r.z;
        node.fracVars = intVars.filter((j) => !isInt(r.x[j]));
      }
      nodes.push(node);
      if (parent) parent.children.push(node.id);
      return node;
    }
    const b0 = p.vars.map(() => ({ lo: null, hi: null }));
    const rootNode = solveNode(b0, null, null);
    const res = { problem: p, nodes, intVars, best: null, status: 'optimal', sense: p.sense };
    if (rootNode.lp !== 'optimal') {
      rootNode.state = rootNode.lp === 'unbounded' ? 'unbounded' : 'infeasible';
      res.status = rootNode.lp === 'unbounded' ? 'unbounded' : rootNode.lp === 'limit' ? 'limit' : 'infeasible';
      return res;
    }
    let best = null;
    const active = [rootNode];
    const classify = (node) => {
      if (node.lp !== 'optimal') { node.state = 'infeasible'; return false; }
      if (!node.fracVars.length) {
        if (!best || better(node.z, best.z)) {
          if (best) best.state = 'integer';
          best = node; node.state = 'best';
        } else node.state = 'integer';
        return false;
      }
      if (best && !better(node.z, best.z)) { node.state = 'pruned'; return false; }
      node.state = 'active';
      return true;
    };
    classify(rootNode);
    if (rootNode.state !== 'active') active.length = 0;
    while (active.length) {
      /* iň gowy araçäkli düwün (best-first) */
      active.sort((a, b) => (better(a.z, b.z) ? -1 : better(b.z, a.z) ? 1 : a.id - b.id));
      const node = active.shift();
      if (best && !better(node.z, best.z)) { node.state = 'pruned'; continue; }
      if (nodes.length + 2 > o.maxNodes) { res.status = 'limit'; active.unshift(node); break; }
      /* iň uly drob bölekli üýtgeýän */
      let j = node.fracVars[0], fj = frac(node.x[j]);
      node.fracVars.forEach((k) => {
        const fk = frac(node.x[k]), dk = fk.sub(F(1, 2)).abs(), dj = fj.sub(F(1, 2)).abs();
        if (dk.compare(dj) < 0) { j = k; fj = fk; }
      });
      const v = node.x[j];
      node.state = 'branched'; node.branchVar = j; node.branchVal = v;
      const lo = node.bounds.map((bd) => Object.assign({}, bd));
      const hi = node.bounds.map((bd) => Object.assign({}, bd));
      lo[j].hi = v.floor();
      hi[j].lo = v.ceil();
      const left = solveNode(lo, node, { j, op: '<=', v: v.floor() });
      const right = solveNode(hi, node, { j, op: '>=', v: v.ceil() });
      [left, right].forEach((c) => { if (classify(c)) active.push(c); });
      /* täze iň gowy çözgüt tapyldy — işjeň düwünleri gaýtadan barla */
      for (let i = active.length - 1; i >= 0; i--) if (best && !better(active[i].z, best.z)) { active[i].state = 'pruned'; active.splice(i, 1); }
    }
    active.forEach((a) => { if (a.state === 'active' && res.status === 'limit') a.state = 'open'; });
    res.best = best;
    if (!best && res.status !== 'limit') res.status = 'infeasible';
    res.rootZ = rootNode.z;
    return res;
  }

  /* barlag üçin: ähli bitin nokatlary gözden geçirmek (ähli üýtgeýänler bitin, n ≤ 4, nokatlaryň sany çäkli) */
  function bruteIP(p, opts) {
    const o = opts || {};
    const n = p.vars.length;
    if (n > 4) return null;
    const S = SX();
    const ub = [];
    for (let j = 0; j < n; j++) {
      const q = Object.assign({}, p, { sense: 'max', c: p.vars.map((_, k) => F(k === j ? 1 : 0)), c0: F(0) });
      let r;
      try { r = S.solve(q, { method: 'bigM' }); } catch (e) { return null; }
      if (r.status === 'infeasible') return { status: 'infeasible', count: 0, total: 0, ub: [] };
      if (r.status !== 'optimal') return null;
      ub.push(Math.floor(r.z.valueOf() + 1e-9));
    }
    let total = 1;
    ub.forEach((u) => { total *= u + 1; });
    if (total > (o.limit || 200000)) return null;
    const A = p.cons.map((k) => ({ a: k.a.map((v) => v.valueOf()), b: k.b.valueOf(), op: k.op }));
    const c = p.c.map((v) => v.valueOf()), c0 = p.c0.valueOf(), max = p.sense === 'max';
    let best = null, bestX = null, count = 0;
    const x = new Array(n).fill(0);
    (function rec(j) {
      if (j === n) {
        for (const k of A) {
          let l = 0;
          for (let t = 0; t < n; t++) l += k.a[t] * x[t];
          if (k.op === '<=' ? l > k.b + 1e-9 : k.op === '>=' ? l < k.b - 1e-9 : Math.abs(l - k.b) > 1e-9) return;
        }
        count++;
        let z = c0;
        for (let t = 0; t < n; t++) z += c[t] * x[t];
        if (best === null || (max ? z > best + 1e-9 : z < best - 1e-9)) { best = z; bestX = x.slice(); }
        return;
      }
      for (let v = 0; v <= ub[j]; v++) { x[j] = v; rec(j + 1); }
    })(0);
    return { status: best === null ? 'infeasible' : 'optimal', z: best, x: bestX, count, total, ub };
  }

  /* ==================================================================== 4) MATRISA OÝUNLARY */
  function matrixGame(A, opts) {
    const o = opts || {};
    const m = A.length, n = A[0].length;
    if (m < 1 || n < 1) throw new ORError('Töleg matrisasy boş.');
    if (m > 8 || n > 8) throw new ORError('Iň köp 8×8 matrisa.');
    if (A.some((r) => r.length !== n)) throw new ORError('Matrisanyň setirleri deň uzynlykda bolmaly.');
    if (A.some((r) => r.some((x) => x === null))) throw new ORError('Matrisada boş öýjük bar.');
    const rowMin = A.map((r) => fmin(r));
    const colMax = Array.from({ length: n }, (_, j) => fmax(A.map((r) => r[j])));
    const alpha = fmax(rowMin), beta = fmin(colMax);
    const res = { m, n, A, rowMin, colMax, alpha, beta, alphaRows: [], betaCols: [], steps: [] };
    rowMin.forEach((x, i) => { if (x.equals(alpha)) res.alphaRows.push(i); });
    colMax.forEach((x, j) => { if (x.equals(beta)) res.betaCols.push(j); });
    const saddles = [];
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) if (A[i][j].equals(rowMin[i]) && A[i][j].equals(colMax[j])) saddles.push([i, j]);
    res.saddles = saddles;
    const full = (len, idx, vals) => { const a = new Array(len).fill(null).map(() => F(0)); idx.forEach((k, t) => { a[k] = vals[t]; }); return a; };
    if (saddles.length) {
      const [i, j] = saddles[0];
      Object.assign(res, { method: 'saddle', v: A[i][j], p: full(m, [i], [F(1)]), q: full(n, [j], [F(1)]) });
      return finishGame(res);
    }
    /* agdyklyk boýunça kiçeltmek */
    let R = A.map((_, i) => i), Cc = A[0].map((_, j) => j);
    let changed = true;
    while (changed && (R.length > 1 || Cc.length > 1)) {
      changed = false;
      outerR: for (const i of R) {
        for (const k of R) {
          if (k === i) continue;
          const geq = Cc.every((j) => A[k][j].compare(A[i][j]) >= 0);
          const same = Cc.every((j) => A[k][j].equals(A[i][j]));
          if (geq && (!same || k < i)) {
            res.steps.push({ type: 'row', removed: i, by: k, same, strict: Cc.every((j) => A[k][j].compare(A[i][j]) > 0) });
            R = R.filter((x) => x !== i); changed = true; break outerR;
          }
        }
      }
      if (changed) continue;
      outerC: for (const j of Cc) {
        for (const l of Cc) {
          if (l === j) continue;
          const leq = R.every((i) => A[i][l].compare(A[i][j]) <= 0);
          const same = R.every((i) => A[i][l].equals(A[i][j]));
          if (leq && (!same || l < j)) {
            res.steps.push({ type: 'col', removed: j, by: l, same, strict: R.every((i) => A[i][l].compare(A[i][j]) < 0) });
            Cc = Cc.filter((x) => x !== j); changed = true; break outerC;
          }
        }
      }
    }
    res.rows = R; res.cols = Cc;
    const B = R.map((i) => Cc.map((j) => A[i][j]));
    if (R.length === 1 || Cc.length === 1) {
      /* bir setir ýa-da bir sütün galdy — arassa strategiýa */
      const i = R.length === 1 ? R[0] : R.reduce((a, k) => (A[k][Cc[0]].compare(A[a][Cc[0]]) > 0 ? k : a));
      const j = Cc.length === 1 ? Cc[0] : Cc.reduce((a, l) => (A[R[0]][l].compare(A[R[0]][a]) < 0 ? l : a));
      Object.assign(res, { method: 'reduced-pure', v: A[i][j], p: full(m, [i], [F(1)]), q: full(n, [j], [F(1)]) });
      return finishGame(res);
    }
    if (R.length === 2 && Cc.length === 2) {
      const [[a, b], [c, d]] = B;
      const D = a.add(d).sub(b).sub(c);
      if (!isZ(D)) {
        const p1 = d.sub(c).div(D), q1 = d.sub(b).div(D);
        const v = a.mul(d).sub(b.mul(c)).div(D);
        const ok = p1.compare(0) >= 0 && p1.compare(1) <= 0 && q1.compare(0) >= 0 && q1.compare(1) <= 0;
        if (ok) {
          Object.assign(res, { method: '2x2', D, v, p: full(m, R, [p1, F(1).sub(p1)]), q: full(n, Cc, [q1, F(1).sub(q1)]) });
          if (R.length === 2 || Cc.length === 2) res.graph = gameGraph(A, R, Cc);
          return finishGame(res);
        }
      }
    }
    /* umumy ýagdaý: çyzykly programmirleme */
    const S = SX();
    const minEl = fmin(B.flat());
    const k = minEl.compare(0) > 0 ? F(0) : F(1).sub(minEl);
    const Bp = B.map((r) => r.map((x) => x.add(k)));
    const lpB = { sense: 'max', objName: 'W', vars: Cc.map((_, t) => 'y' + (t + 1)), c: Cc.map(() => F(1)), c0: F(0),
      cons: R.map((_, s) => ({ a: Bp[s], op: '<=', b: F(1), line: s + 1, text: '' })), notes: [] };
    const lpA = { sense: 'min', objName: 'F', vars: R.map((_, s) => 'x' + (s + 1)), c: R.map(() => F(1)), c0: F(0),
      cons: Cc.map((_, t) => ({ a: R.map((_, s) => Bp[s][t]), op: '>=', b: F(1), line: t + 1, text: '' })), notes: [] };
    const rB = S.solve(lpB, { method: 'bigM' });
    const rA = S.solve(lpA, { method: 'twoPhase' });
    if (rB.status !== 'optimal' || rA.status !== 'optimal') throw new ORError('Çyzykly programmirleme meselesi çözülmedi (' + rB.status + ', ' + rA.status + ').');
    const vB = F(1).div(rB.z), vA = F(1).div(rA.z);
    const q = rB.x.map((y) => y.mul(vB)), p = rA.x.map((x) => x.mul(vA));
    Object.assign(res, { method: 'lp', shift: k, lp: { A: lpA, B: lpB, rA, rB, vPrime: vB, agree: vA.equals(vB) }, v: vB.sub(k), p: full(m, R, p), q: full(n, Cc, q) });
    if (R.length === 2 || Cc.length === 2) res.graph = gameGraph(A, R, Cc);
    return finishGame(res);
  }
  function gameGraph(A, R, Cc) {
    if (R.length === 2) return { kind: '2xn', lines: Cc.map((j) => ({ id: j, y1: A[R[0]][j], y0: A[R[1]][j] })), rows: R };
    return { kind: 'mx2', lines: R.map((i) => ({ id: i, y1: A[i][Cc[0]], y0: A[i][Cc[1]] })), cols: Cc };
  }
  function finishGame(res) {
    const { A, m, n, p, q, v } = res;
    const colPay = Array.from({ length: n }, (_, j) => { let s = F(0); for (let i = 0; i < m; i++) s = s.add(p[i].mul(A[i][j])); return s; });
    const rowPay = A.map((r) => { let s = F(0); r.forEach((x, j) => { s = s.add(q[j].mul(x)); }); return s; });
    res.check = { colPay, rowPay, ok: colPay.every((s) => s.compare(v) >= 0) && rowPay.every((s) => s.compare(v) <= 0) };
    return res;
  }

  /* ==================================================================== 5) CPM / PERT */
  const NAME_RE = /^[\p{L}\p{N}_.'’-]{1,12}$/u;
  function parseActivities(rows, mode) {
    const pert = mode === 'pert';
    const acts = [];
    const seen = new Map();
    rows.forEach((r, i) => {
      const name = String(r.name || '').trim();
      const blank = !name && !String(r.pred || '').trim() && !(pert ? [r.a, r.m, r.b] : [r.d]).some((x) => String(x == null ? '' : x).trim());
      if (blank) return;
      const where = ordinal(i + 1) + ' iş';
      if (!name) throw new ORError(where + ': adyny ýazyň (mysal: A).');
      if (!NAME_RE.test(name)) throw new ORError(where + ': «' + name + '» ady gysga bolmaly (harplar, sanlar, iň köp 12 belgi, boşluksyz).');
      const key = name.toLowerCase();
      if (seen.has(key)) throw new ORError('«' + name + '» işi iki gezek ýazylypdyr: atlar gaýtalanmaly däl.');
      seen.set(key, acts.length);
      const num = (x, label) => {
        const f = parseNum(x, where + ' (' + name + '), ' + label);
        if (f.compare(0) < 0) throw new ORError(where + ' (' + name + '): ' + label + ' otrisatel bolup bilmez.');
        return f.valueOf();
      };
      const act = { name, predText: String(r.pred || '').trim(), desc: String(r.desc || '').trim() };
      if (pert) {
        act.a = num(r.a, 'a (optimistik)'); act.m = num(r.m, 'm (iň ähtimal)'); act.b = num(r.b, 'b (pessimistik)');
        if (!(act.a <= act.m && act.m <= act.b)) throw new ORError(where + ' (' + name + '): a ≤ m ≤ b bolmaly (häzir ' + act.a + ', ' + act.m + ', ' + act.b + ').');
        act.d = (act.a + 4 * act.m + act.b) / 6;
        act.var = Math.pow((act.b - act.a) / 6, 2);
      } else act.d = num(r.d, 'dowamlylyk');
      acts.push(act);
    });
    if (!acts.length) throw new ORError('Iň azyndan bir işi ýazyň.');
    if (acts.length > 30) throw new ORError('Iň köp 30 iş.');
    acts.forEach((a) => {
      const parts = a.predText.split(/[\s,;]+/).map((x) => x.trim()).filter((x) => x && !/^[-–—]$/.test(x) && !/^(ýok|yok|none)$/i.test(x));
      a.pred = [];
      parts.forEach((pn) => {
        const k = seen.get(pn.toLowerCase());
        if (k === undefined) throw new ORError('«' + a.name + '» işiniň öňki işi «' + pn + '» tapylmady. Öňki işleri ady bilen otur arkaly ýazyň (mysal: A, B).');
        if (acts[k] === a) throw new ORError('«' + a.name + '» işi özünden soň gelip bilmez.');
        if (a.pred.indexOf(k) < 0) a.pred.push(k);
      });
    });
    return acts;
  }
  function phi(z) {
    /* standart normal paýlanyşyň funksiýasy Φ(z) (Abramowitz–Stegun 7.1.26, ýalňyşlyk < 1.5·10⁻⁷) */
    const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
  }
  const EPS = 1e-9;
  function network(acts, opts) {
    const o = opts || {};
    const N = acts.length;
    const succ = acts.map(() => []);
    acts.forEach((a, i) => a.pred.forEach((k) => succ[k].push(i)));
    /* topologik tertip (Kan) */
    const indeg = acts.map((a) => a.pred.length), order = [], queue = [];
    indeg.forEach((d, i) => { if (!d) queue.push(i); });
    while (queue.length) {
      queue.sort((x, y) => x - y);
      const i = queue.shift();
      order.push(i);
      succ[i].forEach((k) => { if (--indeg[k] === 0) queue.push(k); });
    }
    if (order.length < N) {
      const left = acts.map((_, i) => i).filter((i) => order.indexOf(i) < 0);
      throw new ORError('Işleriň arasynda tegelek (aýlaw) bar: ' + left.map((i) => acts[i].name).join(', ') + '. Her iş öňki işleri gutarandan soň başlamaly — öňki işleri barlaň.');
    }
    const ES = new Array(N).fill(0), EF = new Array(N).fill(0), LS = new Array(N), LF = new Array(N);
    order.forEach((i) => {
      ES[i] = acts[i].pred.reduce((mx, k) => Math.max(mx, EF[k]), 0);
      EF[i] = ES[i] + acts[i].d;
    });
    const T = Math.max(0, ...EF);
    for (let t = order.length - 1; t >= 0; t--) {
      const i = order[t];
      LF[i] = succ[i].length ? Math.min(...succ[i].map((k) => LS[k])) : T;
      LS[i] = LF[i] - acts[i].d;
    }
    const TF = acts.map((_, i) => LS[i] - ES[i]);
    const FF = acts.map((_, i) => (succ[i].length ? Math.min(...succ[i].map((k) => ES[k])) : T) - EF[i]);
    const crit = acts.map((_, i) => Math.abs(TF[i]) < EPS);
    /* ähli kritiki ýollar */
    const paths = [];
    const starts = order.filter((i) => crit[i] && Math.abs(ES[i]) < EPS);
    const walk = (i, path) => {
      if (paths.length >= 20) return;
      const nexts = succ[i].filter((k) => crit[k] && Math.abs(ES[k] - EF[i]) < EPS);
      if (!nexts.length) { if (Math.abs(EF[i] - T) < EPS) paths.push(path.concat(i)); return; }
      nexts.forEach((k) => walk(k, path.concat(i)));
    };
    starts.forEach((i) => walk(i, []));
    const level = new Array(N).fill(0);
    order.forEach((i) => { level[i] = acts[i].pred.reduce((mx, k) => Math.max(mx, level[k] + 1), 0); });
    const res = { acts, succ, order, ES, EF, LS, LF, TF, FF, crit, T, paths, level };
    if (o.mode === 'pert') {
      const varOf = (path) => path.reduce((s, i) => s + acts[i].var, 0);
      let best = paths[0] || [];
      paths.forEach((pth) => { if (varOf(pth) > varOf(best) + EPS) best = pth; });
      const variance = varOf(best);
      res.pert = { path: best, variance, sigma: Math.sqrt(variance) };
      if (o.target !== undefined && o.target !== null && o.target !== '') {
        const D = Number(o.target);
        const z = res.pert.sigma > 0 ? (D - T) / res.pert.sigma : (D >= T ? Infinity : -Infinity);
        res.pert.target = D; res.pert.z = z;
        res.pert.prob = z === Infinity ? 1 : z === -Infinity ? 0 : phi(z);
      }
    }
    return res;
  }

  /* ==================================================================== 6) IŇ GYSGA ÝOL */
  function parseGraph(text, opts) {
    const directed = !opts || opts.directed !== false;
    const lines = String(text || '').split(/\r?\n/);
    const nodes = [], idx = new Map(), edges = [];
    const node = (name) => {
      const key = name.toLowerCase();
      if (!idx.has(key)) { idx.set(key, nodes.length); nodes.push(name); }
      return idx.get(key);
    };
    lines.forEach((line, li) => {
      const s = line.replace(/#.*$/, '').trim();
      if (!s) return;
      const where = ordinal(li + 1) + ' setir';
      let t = s.replace(/->|→|⟶|=>|—>|–>/g, ' ').replace(/[;:]/g, ' ').replace(/,\s*/g, ' ').trim().split(/\s+/);
      if (t.length === 2) {
        const m = /^([^-]+)-([^-]+)$/.exec(t[0]);
        if (m) t = [m[1], m[2], t[1]];
      }
      if (t.length !== 3) throw new ORError(where + ': «' + s + '» — gyrany «A B 4» görnüşinde ýazyň (başy, soňy, agramy).');
      const [a, b, w] = t;
      if (!/^[\p{L}\p{N}_]{1,10}$/u.test(a) || !/^[\p{L}\p{N}_]{1,10}$/u.test(b)) throw new ORError(where + ': depe atlary gysga bolmaly (harplar we sanlar, mysal: A, B, 1, Aşgabat).');
      const wf = parseNum(w, where + ', agram');
      if (a.toLowerCase() === b.toLowerCase()) throw new ORError(where + ': gyra bir depäni özüne birikdirýär (' + a + ' → ' + a + ').');
      const e = { u: node(a), v: node(b), w: wf.valueOf(), wf, line: li + 1 };
      edges.push(e);
    });
    if (!edges.length) throw new ORError('Iň azyndan bir gyra ýazyň (mysal: A B 4).');
    if (nodes.length > 30) throw new ORError('Iň köp 30 depe.');
    if (edges.length > 150) throw new ORError('Iň köp 150 gyra.');
    if (!directed) {
      const neg = edges.find((e) => e.w < 0);
      if (neg) throw new ORError(ordinal(neg.line) + ' setir: ugrukdyrylmadyk grafda otrisatel agram bolup bilmez (A–B–A özi otrisatel aýlaw bolýar).');
    }
    const adj = nodes.map(() => []);
    edges.forEach((e, k) => {
      adj[e.u].push({ to: e.v, w: e.w, k });
      if (!directed) adj[e.v].push({ to: e.u, w: e.w, k });
    });
    return { nodes, edges, adj, directed, findNode: (name) => idx.get(String(name || '').trim().toLowerCase()) };
  }
  function dijkstra(G, s) {
    const N = G.nodes.length;
    const dist = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), done = new Array(N).fill(false);
    dist[s] = 0;
    const steps = [];
    for (let it = 0; it < N; it++) {
      let u = -1;
      for (let i = 0; i < N; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u] - EPS)) u = i;
      if (u < 0) break;
      done[u] = true;
      const updated = [];
      G.adj[u].forEach((e) => {
        if (done[e.to]) return;
        const nd = dist[u] + e.w;
        if (nd < dist[e.to] - EPS) { dist[e.to] = nd; prev[e.to] = u; updated.push(e.to); }
      });
      steps.push({ u, dist: dist.slice(), prev: prev.slice(), done: done.slice(), updated });
    }
    return { method: 'dijkstra', dist, prev, steps };
  }
  function bellmanFord(G, s) {
    const N = G.nodes.length;
    const dist = new Array(N).fill(Infinity), prev = new Array(N).fill(-1);
    dist[s] = 0;
    const rounds = [];
    const arcs = [];
    G.edges.forEach((e) => { arcs.push([e.u, e.v, e.w]); if (!G.directed) arcs.push([e.v, e.u, e.w]); });
    for (let r = 1; r < N; r++) {
      const updated = [];
      arcs.forEach(([u, v, w]) => { if (dist[u] < Infinity && dist[u] + w < dist[v] - EPS) { dist[v] = dist[u] + w; prev[v] = u; updated.push(v); } });
      rounds.push({ r, dist: dist.slice(), updated: Array.from(new Set(updated)) });
      if (!updated.length) break;
    }
    let cycle = null;
    for (const [u, v, w] of arcs) {
      if (dist[u] < Infinity && dist[u] + w < dist[v] - EPS) {
        /* otrisatel aýlawy tapmak: N gezek yza gaýdyp, aýlawyň içine düşýäris */
        prev[v] = u;
        let x = v;
        for (let i = 0; i < N; i++) x = prev[x];
        const cyc = [x];
        let y = prev[x];
        while (y !== x && cyc.length <= N) { cyc.push(y); y = prev[y]; }
        cycle = cyc.reverse();
        break;
      }
    }
    return { method: 'bellman-ford', dist, prev, rounds, cycle };
  }
  function floyd(G) {
    const N = G.nodes.length;
    const D = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => (i === j ? 0 : Infinity)));
    const nxt = Array.from({ length: N }, () => new Array(N).fill(-1));
    const put = (u, v, w) => { if (w < D[u][v]) { D[u][v] = w; nxt[u][v] = v; } };
    G.edges.forEach((e) => { put(e.u, e.v, e.w); if (!G.directed) put(e.v, e.u, e.w); });
    for (let i = 0; i < N; i++) nxt[i][i] = i;
    for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) {
      if (D[i][k] === Infinity) continue;
      for (let j = 0; j < N; j++) {
        if (D[k][j] === Infinity) continue;
        if (D[i][k] + D[k][j] < D[i][j] - EPS) { D[i][j] = D[i][k] + D[k][j]; nxt[i][j] = nxt[i][k]; }
      }
    }
    const negCycle = D.some((r, i) => r[i] < -EPS);
    return { D, next: nxt, negCycle };
  }
  function pathTo(prev, s, t) {
    if (s === t) return [s];
    if (prev[t] < 0) return null;
    const path = [t];
    let x = t, guard = 0;
    while (x !== s && guard++ < 1000) { x = prev[x]; if (x < 0) return null; path.push(x); }
    return path.reverse();
  }
  function shortestPaths(G, src, opts) {
    const o = opts || {};
    const neg = G.edges.some((e) => e.w < 0);
    const res = { G, src, neg };
    if (neg || o.method === 'bellman-ford') {
      const r = bellmanFord(G, src);
      Object.assign(res, r);
      if (r.cycle) { res.status = 'neg-cycle'; return res; }
    } else Object.assign(res, dijkstra(G, src));
    res.status = 'ok';
    res.paths = G.nodes.map((_, t) => pathTo(res.prev, src, t));
    res.all = floyd(G);
    return res;
  }

  root.AmatlyOR = {
    ORError, ordinal, sub, normalize, parseNum, parseMatrix,
    hungarian, assignBrute, maxMatching, minCover,
    dualProblem, dualSimplex,
    branchAndBound, bruteIP,
    matrixGame,
    parseActivities, network, phi,
    parseGraph, dijkstra, bellmanFord, floyd, pathTo, shortestPaths,
  };
})(typeof window !== 'undefined' ? window : globalThis);
