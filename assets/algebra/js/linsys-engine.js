/* ==========================================================================
   Amatly.com — çyzykly deňlemeler ulgamynyň motory (DOM ulanmaýar): window.AmatlyLinSys

   • Girizme: deňlemeler tekst görnüşinde (2x + 3y − z = 5 …) ýa-da koeffisiýentleriň tablisasy (A | b).
   • Usullar: Gauss (yzygider aýyrmak + yza goýmak), Gauss–Žordan (iň ýönekeý basgançakly görnüş),
     Kramer (kesgitleýjiler; diňe kwadrat ulgam we Δ ≠ 0).
   • Ýagdaýlar (Kroneker–Kapelli teoremasy): ýeke-täk çözgüt, tükeniksiz köp çözgüt (umumy çözgüt — erkin
     üýtgeýänler bilen), çözgüt ýok. Her netije deňlemelere goýlup barlanýar.
   • Ähli hasaplamalar math.js droblarynda (math.fraction) — tegeleklenme ýalňyşy ýok.
   Synaglar: tests/linsys.test.mjs (Node).
   ========================================================================== */
(function (root) {
  'use strict';

  function LinSysError(message, line) { this.name = 'LinSysError'; this.message = message; this.line = line || 0; }
  LinSysError.prototype = Object.create(Error.prototype);
  LinSysError.prototype.constructor = LinSysError;
  function M() {
    const m = root.math;
    if (!m || typeof m.fraction !== 'function' || typeof m.parse !== 'function') throw new LinSysError('math.js ýüklenmedi. assets/vendor/math.js faýlynyň ýerindedigini barlaň.');
    return m;
  }
  const F = (a, b) => (b === undefined ? M().fraction(a) : M().fraction(a, b));
  const Z = () => F(0);
  const isZ = (f) => f.compare(0) === 0;
  const sgn = (f) => f.compare(0);
  const MAXN = 6;
  const MINUS = '−';
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (n) => String(n).split('').map((d) => SUB[+d]).join('');

  /* ------------------------------------------------------------------ format */
  function fText(f) { return f.toFraction().replace(/-/g, MINUS); }
  function fHtml(f) {
    const s = sgn(f) < 0 ? MINUS : '', a = f.abs();
    if (String(a.d) === '1') return s + String(a.n);
    return s + '<span class="fr"><span class="fr-n">' + String(a.n) + '</span><span class="fr-d">' + String(a.d) + '</span></span>';
  }
  function fDec(f, digits) {
    const v = f.valueOf(), d = digits || 4;
    let s = (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toString();
    if (s === '-0') s = '0';
    return s.replace(/-/g, MINUS);
  }
  function ordinal(n) {
    const d = n % 10, t = Math.floor(n / 10) % 10;
    const back = d !== 0 ? (d === 6 || d === 9) : [1, 3, 4, 6, 9].indexOf(t) >= 0;
    return n + (back ? '-njy' : '-nji');
  }
  const ord = ordinal;

  /* ------------------------------------------------------------------ okamak */
  function normalize(s) {
    return String(s)
      .replace(/ /g, ' ')
      .replace(/[−‒–—]/g, '-')
      .replace(/[·×∙⋅]/g, '*')
      .replace(/÷/g, '/')
      .replace(/[₀-₉]/g, (d) => String(SUB.indexOf(d)))
      .replace(/(\d),(\d)/g, '$1.$2')
      .trim();
  }
  /* aňlatmany droblar bilen hasaplamak (sanlar, üýtgeýänler, + − * / we bitin dereje) */
  function fracEval(node, scope) {
    if (node.isParenthesisNode) return fracEval(node.content, scope);
    if (node.isConstantNode) {
      if (typeof node.value !== 'number' || !isFinite(node.value)) return null;
      const s = String(node.value);
      return /e/i.test(s) ? F(node.value) : F(s);
    }
    if (node.isSymbolNode) return Object.prototype.hasOwnProperty.call(scope, node.name) ? scope[node.name] : null;
    if (node.isOperatorNode) {
      const a = node.args.map((x) => fracEval(x, scope));
      if (a.some((x) => x === null)) return null;
      switch (node.fn) {
        case 'unaryMinus': return a[0].neg();
        case 'unaryPlus': return a[0];
        case 'add': return a[0].add(a[1]);
        case 'subtract': return a[0].sub(a[1]);
        case 'multiply': return a[0].mul(a[1]);
        case 'divide': return isZ(a[1]) ? null : a[0].div(a[1]);
        case 'pow': return String(a[1].d) === '1' && Math.abs(a[1].valueOf()) <= 4 && !(isZ(a[0]) && sgn(a[1]) <= 0) ? a[0].pow(a[1]) : null;
        default: return null;
      }
    }
    return null;
  }
  function parseSide(str, line) {
    const s = normalize(str);
    if (!s) throw new LinSysError(ord(line) + ' setir: deňligiň bir tarapy boş.', line);
    let node;
    try { node = M().parse(s); } catch (e) { throw new LinSysError(ord(line) + ' setir: «' + s + '» ýazgyny okap bolmady. Mysal: 2x + 3y − z = 5.', line); }
    const names = [];
    node.traverse((n, path, parent) => {
      if (n.isSymbolNode && !(parent && parent.isFunctionNode && path === 'fn') && names.indexOf(n.name) < 0) names.push(n.name);
      if (n.isFunctionNode) throw new LinSysError(ord(line) + ' setir: funksiýa (' + n.fn.name + ') çyzykly ulgamda bolmaly däl.', line);
      if (n.isAssignmentNode || n.isBlockNode || n.isRangeNode || n.isArrayNode || n.isObjectNode || n.isAccessorNode || n.isConditionalNode) throw new LinSysError(ord(line) + ' setir: bu görnüşdäki ýazgy goldanmaýar.', line);
    });
    names.forEach((v) => { if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(v) || v === 'pi' || v === 'e') throw new LinSysError(ord(line) + ' setir: «' + v + '» näbelliniň ady bolup bilmeýär. Latyn harpy ulanyň: x, y, z ýa-da x1, x2 …', line); });
    return { node, names, text: s };
  }
  function linearize(side, vars, line) {
    const zero = {}; vars.forEach((v) => { zero[v] = Z(); });
    const c0 = fracEval(side.node, zero);
    if (c0 === null) throw new LinSysError(ord(line) + ' setir: «' + side.text + '» aňlatmany hasaplap bolmady (diňe sanlar we näbelliler: 2x, x/3, 1,5y …).', line);
    const coef = {};
    vars.forEach((v) => {
      const sc = Object.assign({}, zero); sc[v] = F(1);
      const val = fracEval(side.node, sc);
      if (val === null) throw new LinSysError(ord(line) + ' setir: «' + side.text + '» çyzykly aňlatma däl.', line);
      coef[v] = val.sub(c0);
    });
    const probes = [vars.map((_, k) => F(k + 2)), vars.map((_, k) => F((k % 2 ? -1 : 1) * (2 * k + 3), k + 5)), vars.map((_, k) => F(7 - 3 * k, 2))];
    for (const p of probes) {
      const sc = {}; vars.forEach((v, k) => { sc[v] = p[k]; });
      const val = fracEval(side.node, sc);
      let lin = c0; vars.forEach((v, k) => { lin = lin.add(coef[v].mul(p[k])); });
      if (val === null || !val.equals(lin)) throw new LinSysError(ord(line) + ' setir: «' + side.text + '» çyzykly däl: x·y, x², 1/x ýaly agzalar bolmaly däl.', line);
    }
    return { coef, c0 };
  }
  const ORDER = ['x', 'y', 'z', 't', 'u', 'v', 'w', 'a', 'b', 'c', 'd'];
  function sortVars(names) {
    const pre = names.map((v) => v.match(/^([A-Za-z]+_?)(\d+)$/));
    if (names.length > 1 && pre.every((m) => m && m[1] === pre[0][1])) return names.slice().sort((a, b) => +a.match(/\d+$/)[0] - +b.match(/\d+$/)[0]);
    if (names.every((v) => ORDER.indexOf(v) >= 0)) return names.slice().sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    return names;
  }
  function parseEquations(text) {
    const lines = String(text || '').split(/\r?\n|;/).map((l, i) => ({ s: l.trim(), no: i + 1 })).filter((l) => l.s);
    if (!lines.length) throw new LinSysError('Deňlemeleri ýazyň: her setirde bir deňleme, mysal üçin 2x + 3y − z = 5.');
    if (lines.length > MAXN) throw new LinSysError('Iň köp ' + MAXN + ' deňleme ýazyp bolýar.');
    const parsed = lines.map((L) => {
      const s = normalize(L.s);
      const parts = s.split('=');
      if (parts.length !== 2 || /[<>]/.test(s)) throw new LinSysError(ord(L.no) + ' setir: deňlemede bir «=» belgisi bolmaly: «' + L.s + '».', L.no);
      return { L: parseSide(parts[0], L.no), R: parseSide(parts[1], L.no), no: L.no, text: L.s };
    });
    let names = [];
    parsed.forEach((p) => p.L.names.concat(p.R.names).forEach((v) => { if (names.indexOf(v) < 0) names.push(v); }));
    names = sortVars(names);
    if (!names.length) throw new LinSysError('Ulgamda näbelli ýok. Näbellileri x, y, z ýa-da x1, x2 … bilen belläň.');
    if (names.length > MAXN) throw new LinSysError('Iň köp ' + MAXN + ' näbelli bolup biler (tapyldy: ' + names.length + ').');
    const A = [], b = [];
    parsed.forEach((p) => {
      const l = linearize(p.L, names, p.no), r = linearize(p.R, names, p.no);
      A.push(names.map((v) => l.coef[v].sub(r.coef[v])));
      b.push(r.c0.sub(l.c0));
    });
    return { vars: names, A, b, lines: parsed.map((p) => p.text) };
  }
  function parseCell(s, where) {
    const t = normalize(s == null ? '' : s);
    if (t === '') return Z();
    let node;
    try { node = M().parse(t); } catch (e) { throw new LinSysError(where + ': «' + t + '» san däl (mysal: 3, −2, 1/2, 2.5).'); }
    const v = fracEval(node, {});
    if (v === null) throw new LinSysError(where + ': «' + t + '» san däl (mysal: 3, −2, 1/2, 2.5).');
    return v;
  }
  function fromGrid(rows, rhs) {
    const m = rows.length, n = m ? rows[0].length : 0;
    if (m < 1 || n < 1) throw new LinSysError('Tablisa boş.');
    if (m > MAXN || n > MAXN) throw new LinSysError('Iň köp ' + MAXN + '×' + MAXN + ' ulgam.');
    const vars = Array.from({ length: n }, (_, j) => 'x' + (j + 1));
    const A = rows.map((r, i) => r.map((c, j) => parseCell(c, ord(i + 1) + ' deňleme, a' + sub(i + 1) + sub(j + 1))));
    const b = rhs.map((c, i) => parseCell(c, ord(i + 1) + ' deňleme, b' + sub(i + 1)));
    return { vars, A, b };
  }

  /* ------------------------------------------------------------------ kömekçi */
  const clone = (Mx) => Mx.map((r) => r.slice());
  function augmented(sys) { return sys.A.map((r, i) => r.concat([sys.b[i]])); }
  function snap(Mx, extra) { return Object.assign({ M: clone(Mx) }, extra || {}); }
  function rowName(i) { return 'S' + sub(i + 1); }
  function coefStr(f) {
    /* "2·S₁", "(1/2)·S₁", "S₁" */
    const a = f.abs();
    if (a.equals(1)) return '';
    return (String(a.d) === '1' ? fText(a) : '(' + fText(a) + ')') + '·';
  }

  /* ------------------------------------------------------------------ Gauss / Gauss–Žordan */
  function eliminate(sys, jordan) {
    const m = sys.A.length, n = sys.vars.length;
    const Mx = augmented(sys);
    const steps = [snap(Mx, { title: 'Giňeldilen matrisa (A | b)', ops: [] })];
    const pivots = [];
    let row = 0;
    for (let col = 0; col < n && row < m; col++) {
      let r = -1;
      if (!isZ(Mx[row][col])) r = row;
      else for (let i = row + 1; i < m; i++) if (!isZ(Mx[i][col])) { r = i; break; }
      if (r < 0) continue;
      const ops = [];
      if (r !== row) { const tmp = Mx[r]; Mx[r] = Mx[row]; Mx[row] = tmp; ops.push(rowName(row) + ' ↔ ' + rowName(r)); }
      if (jordan && !Mx[row][col].equals(1)) {
        const p = Mx[row][col];
        Mx[row] = Mx[row].map((x) => x.div(p));
        ops.push(rowName(row) + ' ← ' + rowName(row) + ' : ' + (sgn(p) < 0 ? '(' + fText(p) + ')' : fText(p)));
      }
      const start = jordan ? 0 : row + 1;
      for (let i = start; i < m; i++) {
        if (i === row || isZ(Mx[i][col])) continue;
        const fct = Mx[i][col].div(Mx[row][col]);
        Mx[i] = Mx[i].map((x, j) => x.sub(fct.mul(Mx[row][j])));
        ops.push(rowName(i) + ' ← ' + rowName(i) + (sgn(fct) > 0 ? ' − ' : ' + ') + coefStr(fct) + rowName(row));
      }
      pivots.push({ row, col });
      const onlySwap = ops.length === 1 && ops[0].indexOf('↔') > 0;
      if (ops.length) {
        steps.push(snap(Mx, {
          title: ord(steps.length) + ' ädim: ' + (onlySwap ? 'setirleriň ornuny çalyşýarys (' + sys.vars[col] + ' sütüninde baş element nol bolmaly däl)' : sys.vars[col] + ' näbellini ' + (jordan ? 'beýleki' : 'aşakdaky') + ' deňlemelerden aýyrýarys'),
          ops, pivot: { row, col },
        }));
      }
      row++;
    }
    return { Mx, steps, pivots };
  }
  function analyse(sys, Mx, pivots) {
    const m = Mx.length, n = sys.vars.length;
    const rankA = pivots.length;
    let bad = -1;
    for (let i = 0; i < m; i++) if (Mx[i].slice(0, n).every(isZ) && !isZ(Mx[i][n])) { bad = i; break; }
    const rankAb = bad >= 0 ? rankA + 1 : rankA;
    return { rankA, rankAb, bad, status: bad >= 0 ? 'none' : rankA === n ? 'unique' : 'infinite' };
  }
  /* RREF-den umumy çözgüt: x_basic = c + Σ d·t */
  function generalFromRref(sys, R, pivots) {
    const n = sys.vars.length;
    const pivCols = pivots.map((p) => p.col);
    const free = [];
    for (let j = 0; j < n; j++) if (pivCols.indexOf(j) < 0) free.push(j);
    const expr = sys.vars.map((_, j) => ({ c: Z(), d: free.map(() => Z()), free: free.indexOf(j) >= 0 }));
    free.forEach((j, k) => { expr[j].d[k] = F(1); });
    pivots.forEach((p) => {
      const rowv = R[p.row];
      const e = expr[p.col];
      e.c = rowv[n].div(rowv[p.col]);
      free.forEach((j, k) => { e.d[k] = rowv[j].neg().div(rowv[p.col]); });
    });
    return { free, expr };
  }
  function rref(sys) {
    const r = eliminate(sys, true);
    return r;
  }
  function backSub(sys, Mx, pivots) {
    const n = sys.vars.length;
    const x = new Array(n).fill(null);
    const lines = [];
    for (let k = pivots.length - 1; k >= 0; k--) {
      const { row, col } = pivots[k];
      const a = Mx[row][col];
      let rhs = Mx[row][n];
      const terms = [];
      for (let j = col + 1; j < n; j++) {
        if (isZ(Mx[row][j])) continue;
        rhs = rhs.sub(Mx[row][j].mul(x[j]));
        terms.push({ j, a: Mx[row][j] });
      }
      x[col] = rhs.div(a);
      lines.push({ col, a, b: Mx[row][n], terms, x: x[col] });
    }
    return { x, lines };
  }
  function check(sys, x) {
    return sys.A.map((r, i) => {
      let lhs = Z();
      r.forEach((a, j) => { lhs = lhs.add(a.mul(x[j])); });
      return { i, lhs, rhs: sys.b[i], ok: lhs.equals(sys.b[i]) };
    });
  }

  /* ------------------------------------------------------------------ kesgitleýjiler */
  function det(A) {
    const n = A.length;
    if (n === 1) return A[0][0];
    if (n === 2) return A[0][0].mul(A[1][1]).sub(A[0][1].mul(A[1][0]));
    const Mx = clone(A);
    let d = F(1);
    for (let c = 0; c < n; c++) {
      let r = -1;
      for (let i = c; i < n; i++) if (!isZ(Mx[i][c])) { r = i; break; }
      if (r < 0) return Z();
      if (r !== c) { const t = Mx[r]; Mx[r] = Mx[c]; Mx[c] = t; d = d.neg(); }
      d = d.mul(Mx[c][c]);
      for (let i = c + 1; i < n; i++) {
        if (isZ(Mx[i][c])) continue;
        const f = Mx[i][c].div(Mx[c][c]);
        Mx[i] = Mx[i].map((x, j) => x.sub(f.mul(Mx[c][j])));
      }
    }
    return d;
  }
  /* kesgitleýjini hasaplamagyň ädimi (mugallym üçin): 2×2 — ad − bc; 3×3 — Sarrus düzgüni; uly — Gauss bilen üçburç görnüşe */
  function detExplain(A) {
    const n = A.length, f = (x) => (sgn(x) < 0 ? '(' + fText(x) + ')' : fText(x));
    if (n === 1) return { value: A[0][0], text: fText(A[0][0]) };
    if (n === 2) return { value: det(A), text: f(A[0][0]) + '·' + f(A[1][1]) + ' − ' + f(A[0][1]) + '·' + f(A[1][0]) + ' = ' + fText(det(A)) };
    if (n === 3) {
      const a = A;
      const p = [[0, 0, 1, 1, 2, 2], [0, 1, 1, 2, 2, 0], [0, 2, 1, 0, 2, 1]], q = [[0, 2, 1, 1, 2, 0], [0, 0, 1, 2, 2, 1], [0, 1, 1, 0, 2, 2]];
      const ps = p.map((t) => f(a[t[0]][t[1]]) + '·' + f(a[t[2]][t[3]]) + '·' + f(a[t[4]][t[5]]));
      const qs = q.map((t) => f(a[t[0]][t[1]]) + '·' + f(a[t[2]][t[3]]) + '·' + f(a[t[4]][t[5]]));
      const v = det(A);
      return { value: v, text: ps.join(' + ') + ' − ' + qs.join(' − ') + ' = ' + fText(v), rule: 'sarrus' };
    }
    return { value: det(A), text: 'Gauss usuly bilen üçburç görnüşe getirip, diagonal elementleri köpeldýäris: ' + fText(det(A)), rule: 'gauss' };
  }

  /* ------------------------------------------------------------------ esasy funksiýa */
  function solve(sys, opts) {
    const method = (opts && opts.method) || 'gauss';
    const m = sys.A.length, n = sys.vars.length;
    if (!m || !n) throw new LinSysError('Ulgam boş.');
    const res = { sys, method, m, n };
    if (method === 'cramer') {
      if (m !== n) { res.status = 'cramer-na'; res.reason = 'Kramer usuly diňe kwadrat ulgam (deňlemeleriň sany = näbellileriň sany) üçin. Bu ulgamda ' + m + ' deňleme we ' + n + ' näbelli bar — Gauss usulyny ulanyň.'; return Object.assign(res, gaussPart(sys)); }
      const D = detExplain(sys.A);
      res.det = D;
      if (isZ(D.value)) {
        res.cramerZero = true;
        const g = gaussPart(sys);
        Object.assign(res, g);
        res.reason = 'Δ = 0 — Kramer formulalary ulanylmaýar: ulgamyň ýa-da tükeniksiz köp çözgüdi bar, ýa-da çözgüdi ýok. Gauss usuly bilen anykladyk.';
        return res;
      }
      res.dets = sys.vars.map((_, j) => {
        const Aj = sys.A.map((r, i) => r.map((x, k) => (k === j ? sys.b[i] : x)));
        return Object.assign({ j, A: Aj }, detExplain(Aj));
      });
      res.x = res.dets.map((d) => d.value.div(D.value));
      res.status = 'unique';
      res.rankA = res.rankAb = n;
      res.check = check(sys, res.x);
      return res;
    }
    const jordan = method === 'jordan';
    const e = eliminate(sys, jordan);
    res.steps = e.steps;
    res.echelon = e.Mx;
    Object.assign(res, analyse(sys, e.Mx, e.pivots));
    res.pivots = e.pivots;
    if (res.status === 'unique') {
      if (jordan) res.x = sys.vars.map((_, j) => { const p = e.pivots.find((q) => q.col === j); return e.Mx[p.row][n].div(e.Mx[p.row][j]); });
      else { const bs = backSub(sys, e.Mx, e.pivots); res.x = bs.x; res.back = bs.lines; }
      res.check = check(sys, res.x);
    } else if (res.status === 'infinite') {
      const R = jordan ? { Mx: e.Mx, pivots: e.pivots } : rref(sys);
      res.general = generalFromRref(sys, R.Mx, R.pivots);
      /* barlag: parametrleriň iki dürli bahasynda (0 we 1) */
      const at = (t) => res.general.expr.map((x) => x.c.add(x.d.reduce((s2, d) => s2.add(d.mul(F(t))), Z())));
      res.check = check(sys, at(1));
      res.check0 = check(sys, at(0));
    }
    return res;
  }
  function gaussPart(sys) {
    const e = eliminate(sys, false);
    const out = { steps: e.steps, echelon: e.Mx, pivots: e.pivots };
    Object.assign(out, analyse(sys, e.Mx, e.pivots));
    if (out.status === 'unique') { const bs = backSub(sys, e.Mx, e.pivots); out.x = bs.x; out.back = bs.lines; out.check = check(sys, out.x); }
    else if (out.status === 'infinite') { const R = rref(sys); out.general = generalFromRref(sys, R.Mx, R.pivots); }
    return out;
  }

  /* ulgamy tekst görnüşinde ýazmak */
  function termText(f, v, first) {
    const neg = sgn(f) < 0, a = f.abs();
    const k = a.equals(1) ? '' : (String(a.d) === '1' ? fText(a) : '(' + fText(a) + ')');
    return (first ? (neg ? MINUS : '') : (neg ? ' ' + MINUS + ' ' : ' + ')) + k + v;
  }
  function eqText(row, b, vars) {
    let s = '';
    row.forEach((a, j) => { if (!isZ(a)) s += termText(a, vars[j], !s); });
    return (s || '0') + ' = ' + fText(b);
  }
  function toText(sys) { return sys.A.map((r, i) => eqText(r, sys.b[i], sys.vars).replace(/−/g, '-')).join('\n'); }

  root.AmatlyLinSys = { LinSysError, MAXN, parseEquations, fromGrid, solve, det, detExplain, check, eqText, toText, fText, fHtml, fDec, ordinal, sub };
})(typeof window !== 'undefined' ? window : globalThis);
