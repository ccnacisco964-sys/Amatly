/* ==========================================================================
   Amatly.com — Simpleks usulynyň motory (DOM ulanmaýar).

   Çyzykly programmirleme meselesini çözýär:
     max / min  Z = c1·x1 + … + cn·xn (+ c0)
     çäklendirmeler  ai1·x1 + … + ain·xn  (≤ | ≥ | =)  bi,      ähli xj ≥ 0.

   math.js (assets/vendor/math.js) şu ýerlerde ulanylýar:
     • math.parse / compile — formula görnüşinde ýazylan maksat funksiýasyny we çäklendirmeleri okamak
       (3x1 + 5x2, x1/2, 2(x1 − x2), 1,5x1 …: gizlin köpeltmek hem düşünilýär) we çyzyklylygy barlamak;
     • math.fraction — ähli hasaplamalar takyk droblarda: 1/3 ýaly bahalar tegeleklenmeýär;
     • math.inv, math.multiply — optimal bazisiň ters matrisasy B⁻¹ arkaly ikilenji (kölege) bahalar y = C_B·B⁻¹;
     • math.det, math.lusolve — grafiki usulda göni çyzyklaryň kesişme (burç) nokatlary.

   Usullar: emeli bazis (M-usuly) we iki tapgyrly usul; Danzigiň düzgüni, aýlanma ýüze çyksa — Blendiň düzgüni.
   Brauzerde: window.AmatlySimplex. Synaglar: tests/simplex.test.mjs (Node).
   ========================================================================== */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ math.js */
  function SimplexError(message, line) {
    this.name = 'SimplexError';
    this.message = message;
    this.line = line || 0;
  }
  SimplexError.prototype = Object.create(Error.prototype);
  SimplexError.prototype.constructor = SimplexError;

  function mathjs() {
    const m = root.math;
    if (!m || typeof m.fraction !== 'function' || typeof m.parse !== 'function') {
      throw new SimplexError('math.js ýüklenmedi. assets/vendor/math.js faýlynyň ýerindedigini barlaň.');
    }
    return m;
  }
  function F(x, y) { return y === undefined ? mathjs().fraction(x) : mathjs().fraction(x, y); }
  let ZERO = null, ONE = null;
  function zero() { return ZERO || (ZERO = F(0)); }
  function one() { return ONE || (ONE = F(1)); }
  function isFrac(v) { return v !== null && typeof v === 'object' && mathjs().typeOf(v) === 'Fraction'; }
  /* math.js käbir ýagdaýda (lusolve, inv) nol üçin adaty 0 sanyny gaýtarýar — ony hem drob edýäris */
  function toF(v) { return isFrac(v) ? v : F(v); }
  function sgn(f) { return f.compare(0); }
  function isZ(f) { return f.compare(0) === 0; }

  /* r + m·M görnüşli bahalar (M-usuly üçin). Iki tapgyrly usulda m hemişe 0. */
  function mv(r, m) { return { r: r || zero(), m: m || zero() }; }
  function mvAdd(a, b) { return { r: a.r.add(b.r), m: a.m.add(b.m) }; }
  function mvSub(a, b) { return { r: a.r.sub(b.r), m: a.m.sub(b.m) }; }
  function mvMul(a, f) { return { r: a.r.mul(f), m: a.m.mul(f) }; }
  function mvCmp(a, b) { const c = a.m.compare(b.m); return c !== 0 ? c : a.r.compare(b.r); }
  function mvSign(a) { const s = a.m.compare(0); return s !== 0 ? s : a.r.compare(0); }
  function mvIsZero(a) { return isZ(a.m) && isZ(a.r); }

  /* ------------------------------------------------------------------ okamak */
  const LIMITS = { vars: 10, cons: 12 };
  const CONST_NAMES = new Set(['pi', 'e', 'PI', 'E', 'tau', 'phi', 'Infinity', 'NaN', 'i', 'true', 'false', 'null']);
  const SUBS = '₀₁₂₃₄₅₆₇₈₉';

  function normalize(s) {
    return String(s)
      .replace(/ /g, ' ')
      .replace(/[−‒–—]/g, '-')
      .replace(/[·×∙⋅]/g, '*')
      .replace(/÷/g, '/')
      .replace(/[₀-₉]/g, (d) => String(SUBS.indexOf(d)))
      .replace(/(\d),(\d)/g, '$1.$2')           // türkmen onluk otury: 1,5 → 1.5
      .trim();
  }

  /* türkmen tertip san goşulmasy: 1-nji, 6-njy, 9-njy, 10-njy, 20-nji … */
  function ordinal(n) {
    const d = n % 10, t = Math.floor(n / 10) % 10;
    const back = d !== 0 ? (d === 6 || d === 9) : [1, 3, 4, 6, 9].indexOf(t) >= 0;
    return n + (back ? '-njy' : '-nji');
  }
  function lineTag(line) { return line ? ordinal(line) + ' setir: ' : ''; }

  /* Sanlary takyk drob görnüşine geçirýär (0.1 → 1/10, 2.5 → 5/2) */
  function fracTree(node) {
    const math = mathjs();
    return node.transform((n) => {
      if (n.isConstantNode) {
        if (typeof n.value === 'number') {
          if (!isFinite(n.value)) throw new SimplexError('Tükeniksiz san ulanyp bolmaýar.');
          const s = String(n.value);
          return new math.ConstantNode(/e/i.test(s) ? F(n.value) : F(s));
        }
        if (typeof n.value !== 'object') throw new SimplexError('Ýazgyda san däl baha bar: «' + n.value + '».');
      }
      return n;
    });
  }

  function parseExpr(str, line, what) {
    const math = mathjs();
    const s = normalize(str);
    if (!s) throw new SimplexError(lineTag(line) + what + ' boş.', line);
    if (/[<>=≤≥]/.test(s)) throw new SimplexError(lineTag(line) + 'deňsizlik belgisi artykmaç ýa-da nädogry ýerde.', line);
    let node;
    try { node = math.parse(s); } catch (e) {
      throw new SimplexError(lineTag(line) + '«' + s + '» ýazgyny okap bolmady. Amallary barlaň (mysal: 3x1 + 2x2, 1/2 x1, 2*(x1 - x2)).', line);
    }
    const names = [];
    node.traverse((n, path, parent) => {
      if (n.isSymbolNode && !(parent && parent.isFunctionNode && path === 'fn') && !CONST_NAMES.has(n.name) && names.indexOf(n.name) < 0) names.push(n.name);
      if (n.isAssignmentNode || n.isFunctionAssignmentNode || n.isBlockNode || n.isRangeNode || n.isArrayNode || n.isObjectNode || n.isAccessorNode || n.isConditionalNode) {
        throw new SimplexError(lineTag(line) + '«' + s + '» — bu görnüşdäki ýazgy goldanmaýar.', line);
      }
    });
    for (const v of names) {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(v)) throw new SimplexError(lineTag(line) + '«' + v + '» üýtgeýäniň ady nädogry. Latyn harpy bilen başlaň: x1, x2, y …', line);
    }
    return { node: fracTree(node), names, text: s };
  }

  /* Çyzykly aňlatmanyň koeffisiýentleri: f(x) = c0 + Σ coef[v]·v. Çyzyklylyk birnäçe nokatda takyk barlanýar. */
  function linearize(parsed, line) {
    const fn = parsed.node.compile();
    const names = parsed.names;
    const ev = (scope) => {
      let r;
      try { r = fn.evaluate(scope); } catch (e) { return null; }
      if (typeof r === 'number' && Number.isInteger(r) && Math.abs(r) < 1e15) r = F(r);
      return isFrac(r) ? r : null;
    };
    const at = (vals) => { const sc = {}; names.forEach((v, i) => { sc[v] = vals[i]; }); return sc; };
    const z = names.map(() => zero());
    const c0 = ev(at(z));
    if (!c0) {
      throw new SimplexError(lineTag(line) + '«' + parsed.text + '» aňlatmany hasaplap bolmady. Diňe san koeffisiýentli çyzykly aňlatma ýazyň (√, π, sin ýaly bahalar takyk drob däl).', line);
    }
    const coef = {};
    names.forEach((v, k) => {
      const p = z.slice(); p[k] = one();
      const val = ev(at(p));
      if (!val) throw new SimplexError(lineTag(line) + '«' + parsed.text + '» çyzykly aňlatma däl.', line);
      coef[v] = val.sub(c0);
    });
    /* çyzyklylyk barlagy: x1·x2, x1², 1/x1 ýaly agzalar bolmaly däl */
    const probes = [
      names.map((_, k) => F(k + 2)),
      names.map((_, k) => F((k % 2 ? -1 : 1) * (2 * k + 3), k + 5)),
      names.map((_, k) => F(7 - 3 * k, 2)),
    ];
    for (const p of probes) {
      const val = ev(at(p));
      let lin = c0;
      names.forEach((v, k) => { lin = lin.add(coef[v].mul(p[k])); });
      if (!val || !val.equals(lin)) {
        throw new SimplexError(lineTag(line) + '«' + parsed.text + '» çyzykly aňlatma däl: x1·x2, x1², 1/x1 ýaly agzalar simpleks usulynda bolmaly däl.', line);
      }
    }
    return { coef, c0 };
  }

  const SENSE_MAX = /^(maximize|maximise|maximum|maksimum|maks|max|iň\s+uly)$/i;
  function senseOf(word) { return SENSE_MAX.test(word.replace(/\s+/g, ' ').trim()) ? 'max' : 'min'; }
  const SENSE_WORD = '(maximize|maximise|maximum|maksimum|maks|max|minimize|minimise|minimum|min|iň\\s+uly|iň\\s+kiçi)';

  function parseObjectiveLine(line) {
    let s = line, sense = null, m;
    m = s.match(new RegExp('(?:→|->|=>|⟶|—>)\\s*' + SENSE_WORD + '\\s*\\.?\\s*$', 'i'));
    if (m) { sense = senseOf(m[1]); s = s.slice(0, m.index); }
    else {
      /* "max Z = …", "Max: …", "maxZ = …" (uly harp — funksiýanyň ady); "maxim…", "mint" ýaly sözler däl */
      m = s.match(new RegExp('^\\s*' + SENSE_WORD, 'i'));
      if (m && !/[a-zäçöüžňşý_]/.test(s.charAt(m[0].length))) {
        sense = senseOf(m[1]);
        s = s.slice(m[0].length).replace(/^\s*[:.]?\s*/, '');
      }
    }
    if (!sense) return null;
    let name = 'Z';
    m = s.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*(\([^)]*\))?\s*=(?!=)/);
    if (m) { name = m[1]; s = s.slice(m[0].length); }
    return { sense, name, expr: s.trim() };
  }

  const CMP_RE = /<=|>=|=<|=>|==|≤|≥|⩽|⩾|=|<|>/g;
  function normOp(t) {
    if (t === '<=' || t === '=<' || t === '≤' || t === '⩽' || t === '<') return '<=';
    if (t === '>=' || t === '=>' || t === '≥' || t === '⩾' || t === '>') return '>=';
    return '=';
  }
  const NONNEG_RE = /^\s*[A-Za-z][A-Za-z0-9_]*(\s*,\s*[A-Za-z][A-Za-z0-9_]*)*\s*(>=|≥|=>|⩾)\s*0\s*[.;]?\s*$/;
  const NONNEG_LIST_RE = /^(\s*[A-Za-z][A-Za-z0-9_]*\s*(>=|≥|=>|⩾)\s*0\s*[,;]?\s*)+$/;
  const SKIP_RE = /^\s*(s\.?\s*t\.?|subject\s+to|çäklendirmeler|şertler|şertlerde|we)\s*:?\s*$/i;

  function natCmp(a, b) {
    const ma = a.match(/^(.*?)(\d*)$/), mb = b.match(/^(.*?)(\d*)$/);
    if (ma[1] !== mb[1]) return ma[1] < mb[1] ? -1 : 1;
    const na = ma[2] === '' ? -1 : +ma[2], nb = mb[2] === '' ? -1 : +mb[2];
    return na - nb;
  }

  /* Tekst → mesele. max/min ýazylan setir (islendik ýerde) — maksat funksiýasy, galanlary — çäklendirmeler.
     Bir setirde birnäçe ýazgy «;» bilen aýrylyp bilner. */
  function parseText(text) {
    const raw = String(text || '').split(/\r?\n/);
    const lines = [];
    raw.forEach((l, i) => { normalize(l).split(';').forEach((p) => { if (p.trim()) lines.push({ s: p.trim(), no: i + 1 }); }); });
    if (!lines.length) throw new SimplexError('Meseläni ýazyň: birinji setirde maksat funksiýasy (mysal: max Z = 3x1 + 5x2), aşakda çäklendirmeler.');

    let obj = null;
    const cons = [], notes = [];
    for (const L of lines) {
      const o = parseObjectiveLine(L.s);
      if (o) {
        if (obj) throw new SimplexError(lineTag(L.no) + 'maksat funksiýasy diňe bir gezek ýazylýar (max ýa-da min diňe bir setirde bolmaly).', L.no);
        obj = Object.assign(o, { line: L.no, src: L });
      }
    }
    if (!obj) throw new SimplexError('Maksat funksiýasy tapylmady. Bir setirde max ýa-da min ýazyň: max Z = 3x1 + 5x2 ýa-da Z = 2x1 + x2 → min.');
    for (const L of lines) {
      if (L === obj.src || SKIP_RE.test(L.s)) continue;
      if (NONNEG_RE.test(L.s) || NONNEG_LIST_RE.test(L.s)) { notes.push({ type: 'nonneg-line', line: L.no }); continue; }
      const ops = [];
      const parts = [];
      let last = 0, m;
      CMP_RE.lastIndex = 0;
      while ((m = CMP_RE.exec(L.s))) { parts.push(L.s.slice(last, m.index)); ops.push(m[0]); last = m.index + m[0].length; }
      parts.push(L.s.slice(last));
      if (!ops.length) throw new SimplexError(lineTag(L.no) + 'deňsizlik belgisi (≤, ≥ ýa-da =) tapylmady: «' + L.s + '».', L.no);
      if (ops.length > 2) throw new SimplexError(lineTag(L.no) + 'bir setirde iň köp iki deňsizlik belgisi bolup biler (mysal: 2 ≤ x1 + x2 ≤ 8).', L.no);
      if (ops.some((o) => o === '<' || o === '>')) notes.push({ type: 'strict', line: L.no });
      if (ops.length === 2 && ops.some((o) => normOp(o) === '=')) throw new SimplexError(lineTag(L.no) + 'bir setirde deňlik belgisi diňe bir gezek bolup biler; iki taraply çäklendirme ≤ ýa-da ≥ bilen ýazylýar (mysal: 2 <= x1 + x2 <= 8).', L.no);
      const sides = parts.map((p, k) => parseExpr(p, L.no, k === 0 ? 'çep tarapy' : 'sag tarapy'));
      for (let k = 0; k < ops.length; k++) {
        cons.push({ lhs: sides[k], rhs: sides[k + 1], op: normOp(ops[k]), line: L.no, text: L.s });
      }
    }
    const objParsed = parseExpr(obj.expr, obj.line, 'maksat funksiýasy');
    return build(obj, objParsed, cons, notes);
  }

  function build(obj, objParsed, consRaw, notes) {
    const objLin = linearize(objParsed, obj.line);
    const consLin = consRaw.map((c) => {
      const L = linearize(c.lhs, c.line), R = linearize(c.rhs, c.line);
      const coef = {};
      Object.keys(L.coef).forEach((v) => { coef[v] = L.coef[v]; });
      Object.keys(R.coef).forEach((v) => { coef[v] = (coef[v] || zero()).sub(R.coef[v]); });
      return { coef, b: R.c0.sub(L.c0), op: c.op, line: c.line, text: c.text };
    });
    const names = [];
    const addName = (v) => { if (names.indexOf(v) < 0) names.push(v); };
    objParsed.names.forEach(addName);
    consRaw.forEach((c) => { c.lhs.names.forEach(addName); c.rhs.names.forEach(addName); });
    /* x1, x2, …, x10 — san tertibinde; başga atlar (x, y ýa-da s, o …) — ilkinji ýazylyşy boýunça */
    const pre = names.map((v) => v.match(/^([A-Za-z]+_?)(\d+)$/));
    if (names.length > 1 && pre.every((m) => m && m[1] === pre[0][1])) names.sort(natCmp);
    if (!names.length) throw new SimplexError('Meselede üýtgeýän ýok. Üýtgeýänleri x1, x2 … görnüşinde ýazyň.');
    if (names.length > LIMITS.vars) throw new SimplexError('Üýtgeýänleriň sany ' + names.length + ': bu kalkulýator iň köp ' + LIMITS.vars + ' üýtgeýäni goldaýar.');

    const vec = (coef) => names.map((v) => (coef[v] ? coef[v] : zero()));
    const c = vec(objLin.coef);
    if (c.every(isZ)) throw new SimplexError(lineTag(obj.line) + 'maksat funksiýasynda üýtgeýän ýok (ähli koeffisiýentler 0).', obj.line);

    const cons = [];
    consLin.forEach((k) => {
      const a = vec(k.coef);
      const nz = a.map((x, j) => (isZ(x) ? -1 : j)).filter((j) => j >= 0);
      if (!nz.length) {
        const ok = k.op === '<=' ? sgn(k.b) >= 0 : k.op === '>=' ? sgn(k.b) <= 0 : isZ(k.b);
        if (ok) { notes.push({ type: 'trivial', line: k.line }); return; }
        throw new SimplexError(lineTag(k.line) + 'çäklendirmede üýtgeýän ýok we ol ýalňyş deňsizlik: «' + k.text + '».', k.line);
      }
      /* x1 ≥ 0 (ýa-da −x1 ≤ 0) — otrisatel däl şerti, ol eýýäm göz öňünde tutulýar */
      if (nz.length === 1 && isZ(k.b) && ((k.op === '>=' && sgn(a[nz[0]]) > 0) || (k.op === '<=' && sgn(a[nz[0]]) < 0))) {
        notes.push({ type: 'nonneg-line', line: k.line });
        return;
      }
      cons.push({ a, op: k.op, b: k.b, line: k.line, text: k.text });
    });
    if (!cons.length) throw new SimplexError('Iň azyndan bir çäklendirme ýazyň (mysal: x1 + x2 <= 10). x ≥ 0 şertleri özi goşulýar.');
    if (cons.length > LIMITS.cons) throw new SimplexError('Çäklendirmeleriň sany ' + cons.length + ': bu kalkulýator iň köp ' + LIMITS.cons + ' çäklendirmäni goldaýar.');
    return { sense: obj.sense, objName: obj.name, vars: names, c, c0: objLin.c0, cons, notes };
  }

  /* Tablisa görnüşindäki girizme → mesele. Öýjükler: 3, -2, 1/2, 2.5, 1,5 (boş — 0). */
  function parseCell(str, where) {
    const s = normalize(str == null ? '' : str);
    if (s === '') return zero();
    const p = parseExpr(s, 0, where);
    if (p.names.length) throw new SimplexError(where + ': «' + s + '» san däl. Öýjüge san ýazyň (mysal: 3, -2, 1/2, 2.5).');
    const v = linearize(p, 0).c0;
    return v;
  }
  function fromTable(t) {
    const n = t.c.length;
    if (n < 1) throw new SimplexError('Iň azyndan bir üýtgeýän gerek.');
    if (n > LIMITS.vars) throw new SimplexError('Bu kalkulýator iň köp ' + LIMITS.vars + ' üýtgeýäni goldaýar.');
    const names = Array.from({ length: n }, (_, j) => 'x' + (j + 1));
    const c = t.c.map((s, j) => parseCell(s, 'Maksat funksiýasy, c' + (j + 1)));
    if (c.every(isZ)) throw new SimplexError('Maksat funksiýasynyň ähli koeffisiýentleri 0 — iň bolmanda birini ýazyň.');
    const cons = [], notes = [];
    t.rows.forEach((r, i) => {
      const a = r.a.map((s, j) => parseCell(s, ordinal(i + 1) + ' çäklendirme, a' + (j + 1)));
      const b = parseCell(r.b, ordinal(i + 1) + ' çäklendirme, b');
      const op = normOp(r.op);
      if (a.every(isZ)) {
        const ok = op === '<=' ? sgn(b) >= 0 : op === '>=' ? sgn(b) <= 0 : isZ(b);
        if (ok) { notes.push({ type: 'trivial', line: i + 1 }); return; }
        throw new SimplexError(ordinal(i + 1) + ' çäklendirmäniň ähli koeffisiýentleri 0, ýöne deňsizlik ýerine ýetmeýär.');
      }
      cons.push({ a, op, b, line: i + 1, text: '' });
    });
    if (!cons.length) throw new SimplexError('Iň azyndan bir çäklendirme gerek.');
    if (cons.length > LIMITS.cons) throw new SimplexError('Bu kalkulýator iň köp ' + LIMITS.cons + ' çäklendirmäni goldaýar.');
    return { sense: t.sense === 'min' ? 'min' : 'max', objName: 'Z', vars: names, c, c0: zero(), cons, notes };
  }

  /* Mesele → tekst (tablisadan formula görnüşine geçende) */
  function fracStr(f) { return f.toFraction(); }
  function linText(a, vars) {
    let s = '';
    a.forEach((x, j) => {
      if (isZ(x)) return;
      const neg = sgn(x) < 0, ab = x.abs();
      const k = ab.equals(1) ? '' : (ab.d === undefined || String(ab.d) === '1' ? fracStr(ab) : '(' + fracStr(ab) + ')');
      s += (s ? (neg ? ' - ' : ' + ') : (neg ? '-' : '')) + k + vars[j];
    });
    return s || '0';
  }
  function toText(p) {
    const sym = { '<=': '<=', '>=': '>=', '=': '=' };
    const lines = [p.sense + ' ' + (p.objName || 'Z') + ' = ' + linText(p.c, p.vars) + (isZ(p.c0) ? '' : (sgn(p.c0) < 0 ? ' - ' : ' + ') + fracStr(p.c0.abs()))];
    p.cons.forEach((k) => lines.push(linText(k.a, p.vars) + ' ' + sym[k.op] + ' ' + fracStr(k.b)));
    return lines.join('\n');
  }

  /* ------------------------------------------------------------------ kanoniki görnüş */
  function freePrefix(vars, list) {
    for (const p of list) if (!vars.some((v) => new RegExp('^' + p + '\\d+$').test(v))) return p;
    return list[list.length - 1] + '_';
  }

  function standardize(p, method) {
    const n = p.vars.length, m = p.cons.length;
    const sP = freePrefix(p.vars, ['s', 'u', 'v']);
    const aP = freePrefix(p.vars, ['a', 'r', 'w']);
    const rows = [];
    const steps = [];
    p.cons.forEach((k, i) => {
      let a = k.a.slice(), b = k.b, op = k.op, sign = 1;
      if (sgn(b) < 0) {
        a = a.map((x) => x.neg()); b = b.neg(); sign = -1;
        op = op === '<=' ? '>=' : op === '>=' ? '<=' : '=';
        steps.push({ type: 'flip', row: i, reason: 'negative' });
      } else if (op === '>=' && isZ(b)) {
        a = a.map((x) => x.neg()); sign = -1; op = '<=';
        steps.push({ type: 'flip', row: i, reason: 'zero' });
      }
      rows.push({ a, b, op, sign, orig: k.op });
    });
    const cols = [];
    p.vars.forEach((v, j) => cols.push({ name: v, kind: 'x', j }));
    rows.forEach((r, i) => {
      if (r.op === '<=') { cols.push({ name: sP + (i + 1), kind: 's', row: i, coef: 1 }); steps.push({ type: 'slack', row: i }); }
      else if (r.op === '>=') { cols.push({ name: sP + (i + 1), kind: 's', row: i, coef: -1 }); steps.push({ type: 'surplus', row: i }); }
    });
    rows.forEach((r, i) => {
      if (r.op !== '<=') { cols.push({ name: aP + (i + 1), kind: 'a', row: i, coef: 1 }); steps.push({ type: 'artificial', row: i }); }
    });
    const N = cols.length;
    const A = rows.map((r, i) => cols.map((col) => {
      if (col.kind === 'x') return r.a[col.j];
      return col.row === i ? F(col.coef) : zero();
    }));
    const b = rows.map((r) => r.b);
    const basis = rows.map((r, i) => cols.findIndex((col) => col.row === i && (r.op === '<=' ? col.kind === 's' : col.kind === 'a')));
    const hasArt = cols.some((col) => col.kind === 'a');
    return { n, m, N, cols, rows, A, b, basis, steps, hasArt, method: hasArt ? (method === 'twoPhase' ? 'twoPhase' : 'bigM') : 'none', sP, aP };
  }

  /* ------------------------------------------------------------------ simpleks */
  function snapshotOf(T, extra) {
    return Object.assign({
      phase: T.phase, sense: T.sense,
      visible: T.cols.map((_, j) => j).filter((j) => !T.removed[j]),
      rowIds: T.rowIds.slice(),
      basis: T.basis.slice(),
      A: T.A.map((r) => r.slice()), b: T.b.slice(),
      cost: T.cost.slice(),
    }, extra);
  }

  function evaluate(T) {
    const cb = T.basis.map((j) => T.cost[j]);
    const delta = T.cols.map((_, j) => {
      let z = mv();
      T.A.forEach((row, i) => { if (!isZ(row[j])) z = mvAdd(z, mvMul(cb[i], row[j])); });
      return mvSub(z, T.cost[j]);
    });
    let Z = mv();
    T.b.forEach((bi, i) => { Z = mvAdd(Z, mvMul(cb[i], bi)); });
    return { cb, delta, Z };
  }

  function pivot(T, r, k) {
    const pr = T.A[r], pe = pr[k];
    T.A[r] = pr.map((x) => x.div(pe));
    T.b[r] = T.b[r].div(pe);
    for (let i = 0; i < T.A.length; i++) {
      if (i === r) continue;
      const f = T.A[i][k];
      if (isZ(f)) continue;
      T.A[i] = T.A[i].map((x, j) => x.sub(f.mul(T.A[r][j])));
      T.b[i] = T.b[i].sub(f.mul(T.b[r]));
    }
    T.basis[r] = k;
  }

  const MAX_PIVOTS = 80;

  /* Bir tapgyr: optimal, çäksiz ýa-da çäge ýetýänçä. Her tablisa snapshots-a ýazylýar. */
  function runPhase(T, snaps, info) {
    const seen = new Set([T.basis.slice().sort((x, y) => x - y).join(',')]);
    let bland = false;
    for (let it = 0; it <= MAX_PIVOTS; it++) {
      const ev = evaluate(T);
      const better = (d) => (T.sense === 'max' ? mvSign(d) < 0 : mvSign(d) > 0);
      const cand = [];
      ev.delta.forEach((d, j) => { if (!T.removed[j] && T.basis.indexOf(j) < 0 && better(d)) cand.push(j); });
      const snap = snapshotOf(T, { cb: ev.cb, delta: ev.delta, Z: ev.Z, entering: -1, leaving: -1, theta: T.A.map(() => null), rule: bland ? 'bland' : 'dantzig' });
      snaps.push(snap);
      if (!cand.length) { snap.status = 'optimal'; return 'optimal'; }
      if (it === MAX_PIVOTS) { snap.status = 'limit'; return 'limit'; }
      let k = cand[0];
      if (!bland) {
        for (const j of cand) {
          const c = mvCmp(ev.delta[j], ev.delta[k]);
          if (T.sense === 'max' ? c < 0 : c > 0) k = j;
        }
        snap.enterTie = cand.filter((j) => mvCmp(ev.delta[j], ev.delta[k]) === 0).length > 1;
      }
      snap.entering = k;
      let best = null, r = -1;
      const ties = [];
      T.A.forEach((row, i) => {
        if (sgn(row[k]) > 0) {
          const th = T.b[i].div(row[k]);
          snap.theta[i] = th;
          const c = best === null ? -1 : th.compare(best);
          if (c < 0) { best = th; r = i; ties.length = 0; ties.push(i); }
          else if (c === 0) ties.push(i);
        }
      });
      if (r < 0) { snap.status = 'unbounded'; return 'unbounded'; }
      if (ties.length > 1) {
        snap.thetaTie = true;
        /* deň θ: ilki emeli üýtgeýäni çykarýarys (Blendiň düzgüninde — diňe iň kiçi indeks) */
        const art = bland ? [] : ties.filter((i) => T.cols[T.basis[i]].kind === 'a');
        const pool = art.length ? art : ties;
        r = pool.reduce((p, i) => (T.basis[i] < T.basis[p] ? i : p), pool[0]);
      }
      snap.leaving = r;
      snap.status = 'pivot';
      const leavingCol = T.basis[r];
      pivot(T, r, k);
      if (T.cols[leavingCol].kind === 'a') { T.removed[leavingCol] = true; snap.dropped = leavingCol; }
      const key = T.basis.slice().sort((x, y) => x - y).join(',');
      if (seen.has(key) && !bland) { bland = true; info.bland = true; }
      seen.add(key);
    }
    return 'limit';
  }

  function solve(p, opts) {
    const method = (opts && opts.method) || 'bigM';
    const std = standardize(p, method);
    const T = {
      cols: std.cols, A: std.A.map((r) => r.slice()), b: std.b.slice(), basis: std.basis.slice(),
      rowIds: std.rows.map((_, i) => i), removed: std.cols.map(() => false), phase: 0, sense: p.sense, cost: null,
    };
    const snaps = [];
    const info = { bland: false };
    const res = { problem: p, std, method: std.method, snapshots: snaps, info };
    const realCost = (col) => (col.kind === 'x' ? mv(p.c[col.j]) : mv());

    if (std.method === 'twoPhase') {
      T.phase = 1; T.sense = 'min';
      T.cost = std.cols.map((col) => (col.kind === 'a' ? mv(one()) : mv()));
      const st = runPhase(T, snaps, info);
      if (st === 'limit') return Object.assign(res, { status: 'limit' });
      const last = snaps[snaps.length - 1];
      const W = last.Z.r;
      res.phase1 = { W, driveOut: [], redundant: [] };
      if (sgn(W) > 0) {
        res.status = 'infeasible';
        res.infeasibleBy = T.basis.map((j, i) => ({ j, i })).filter((o) => T.cols[o.j].kind === 'a' && sgn(T.b[o.i]) > 0).map((o) => ({ col: o.j, value: T.b[o.i] }));
        return res;
      }
      /* bazisde nol derejede galan emeli üýtgeýänleri çykarmak */
      for (let i = 0; i < T.A.length; i++) {
        if (T.cols[T.basis[i]].kind !== 'a') continue;
        const j = T.cols.findIndex((col, jj) => col.kind !== 'a' && !T.removed[jj] && T.basis.indexOf(jj) < 0 && !isZ(T.A[i][jj]));
        if (j >= 0) {
          res.phase1.driveOut.push({ row: T.rowIds[i], col: j, out: T.basis[i], pivot: T.A[i][j] });
          pivot(T, i, j);
        } else {
          res.phase1.redundant.push({ row: T.rowIds[i], col: T.basis[i] });
          T.A.splice(i, 1); T.b.splice(i, 1); T.basis.splice(i, 1); T.rowIds.splice(i, 1);
          i--;
        }
      }
      T.cols.forEach((col, j) => { if (col.kind === 'a') T.removed[j] = true; });
      T.phase = 2; T.sense = p.sense;
      T.cost = std.cols.map((col) => (col.kind === 'a' ? mv() : realCost(col)));
    } else {
      T.phase = 0;
      const bigM = mv(zero(), p.sense === 'max' ? F(-1) : one());
      T.cost = std.cols.map((col) => (col.kind === 'a' ? bigM : realCost(col)));
    }

    const st = runPhase(T, snaps, info);
    if (st === 'limit') return Object.assign(res, { status: 'limit' });
    const last = snaps[snaps.length - 1];
    if (st === 'unbounded') {
      res.status = 'unbounded';
      res.unboundedCol = last.entering;
      /* M-usulynda çäksizlik emeli üýtgeýän bazisde položitel galanda-da ýüze çykyp biler. Onda asyl meseläniň
         mümkin çözgüdi barmy — iki tapgyrly usulyň I tapgyry bilen barlaýarys. */
      const artPos = T.basis.some((j, i) => T.cols[j].kind === 'a' && sgn(T.b[i]) > 0);
      if (artPos) {
        const check = solve(p, { method: 'twoPhase', feasibilityOnly: true });
        res.unboundedArt = true;
        if (check.status === 'infeasible') { res.status = 'infeasible'; res.infeasibleBy = []; res.infeasibleViaCheck = check.phase1 ? check.phase1.W : null; }
      }
      return res;
    }
    /* optimal */
    const artPos = T.basis.map((j, i) => ({ j, i })).filter((o) => T.cols[o.j].kind === 'a' && sgn(T.b[o.i]) > 0);
    if (artPos.length) {
      res.status = 'infeasible';
      res.infeasibleBy = artPos.map((o) => ({ col: o.j, value: T.b[o.i] }));
      return res;
    }
    res.status = 'optimal';
    const val = std.cols.map(() => zero());
    T.basis.forEach((j, i) => { val[j] = T.b[i]; });
    res.values = val;
    res.x = p.vars.map((_, j) => val[j]);
    let Z = p.c0;
    p.c.forEach((cj, j) => { Z = Z.add(cj.mul(res.x[j])); });
    res.z = Z;
    res.degenerate = T.b.some((bi) => isZ(bi));
    res.alt = alternative(T, last, std);
    res.dual = dualValues(p, std, T);
    res.finalBasis = T.basis.slice();
    return res;
  }

  /* Δj = 0 bolan bazis däl üýtgeýän bar bolsa — alternatiw optimum */
  function alternative(T, last, std) {
    const cand = [];
    last.delta.forEach((d, j) => { if (!T.removed[j] && std.cols[j].kind !== 'a' && T.basis.indexOf(j) < 0 && mvIsZero(d)) cand.push(j); });
    if (!cand.length) return null;
    for (const k of cand) {
      let best = null, r = -1;
      T.A.forEach((row, i) => {
        if (sgn(row[k]) > 0) { const th = T.b[i].div(row[k]); if (best === null || th.compare(best) < 0) { best = th; r = i; } }
      });
      if (r < 0) return { kind: 'ray', col: k };
      if (sgn(best) === 0) continue;
      const T2 = { A: T.A.map((x) => x.slice()), b: T.b.slice(), basis: T.basis.slice() };
      pivot(T2, r, k);
      const val = std.cols.map(() => zero());
      T2.basis.forEach((j, i) => { val[j] = T2.b[i]; });
      return { kind: 'vertex', col: k, leaving: T.basis[r], x: std.cols.filter((c) => c.kind === 'x').map((c, j) => val[j]) };
    }
    return { kind: 'degenerate', col: cand[0] };
  }

  /* Ikilenji (kölege) bahalar: y = C_B · B⁻¹ (math.inv, math.multiply), soňra asyl çäklendirmeleriň alamatyna görä */
  function dualValues(p, std, T) {
    const math = mathjs();
    if (T.basis.some((j) => std.cols[j].kind === 'a')) return { ok: false, reason: 'artificial' };
    try {
      const rows = T.rowIds;
      const B = rows.map((i) => T.basis.map((j) => std.A[i][j]));
      const cB = T.basis.map((j) => (std.cols[j].kind === 'x' ? p.c[std.cols[j].j] : zero()));
      const Binv = math.inv(B).map((r) => r.map(toF));
      const yStd = math.multiply(cB, Binv).map(toF);
      const y = p.cons.map(() => zero());
      rows.forEach((i, k) => { y[i] = std.rows[i].sign < 0 ? yStd[k].neg() : yStd[k]; });
      let W = p.c0;
      p.cons.forEach((k, i) => { W = W.add(k.b.mul(y[i])); });
      /* barlag: ikilenji çäklendirmeler we alamatlar ýerine ýetýär, W = Z */
      const max = p.sense === 'max';
      const feasible = p.vars.every((_, j) => {
        let s = zero();
        p.cons.forEach((k, i) => { s = s.add(k.a[j].mul(y[i])); });
        return max ? s.compare(p.c[j]) >= 0 : s.compare(p.c[j]) <= 0;
      }) && p.cons.every((k, i) => {
        const want = k.op === '=' ? 0 : ((k.op === '<=') === max ? 1 : -1);
        return want === 0 || sgn(y[i]) === 0 || sgn(y[i]) === want;
      });
      const redundant = rows.length < p.cons.length;
      return { ok: true, y, W, feasible, redundant, Binv, basis: T.basis.slice(), rowIds: rows.slice() };
    } catch (e) {
      return { ok: false, reason: 'singular' };
    }
  }

  /* ------------------------------------------------------------------ grafiki usul (n = 2) */
  function graphData(p, res) {
    if (p.vars.length !== 2) return null;
    const math = mathjs();
    const lines = p.cons.map((k, i) => ({ a: k.a[0], b2: k.a[1], c: k.b, op: k.op, idx: i }));
    const all = lines.concat([{ a: one(), b2: zero(), c: zero(), op: 'axis', idx: -1 }, { a: zero(), b2: one(), c: zero(), op: 'axis', idx: -2 }]);
    const ok = (x, y) => sgn(x) >= 0 && sgn(y) >= 0 && lines.every((L) => {
      const v = L.a.mul(x).add(L.b2.mul(y)), c = v.compare(L.c);
      return L.op === '<=' ? c <= 0 : L.op === '>=' ? c >= 0 : c === 0;
    });
    const pts = [];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const P = all[i], Q = all[j];
        const M2 = [[P.a, P.b2], [Q.a, Q.b2]];
        const det = toF(math.det(M2));
        if (isZ(det)) continue;
        const sol = math.lusolve(M2, [P.c, Q.c]);
        const x = toF(sol[0][0]), y = toF(sol[1][0]);
        if (!ok(x, y)) continue;
        if (pts.some((q) => q.x.equals(x) && q.y.equals(y))) continue;
        pts.push({ x, y });
      }
    }
    const zOf = (x, y) => p.c0.add(p.c[0].mul(x)).add(p.c[1].mul(y));
    pts.forEach((q) => { q.z = zOf(q.x, q.y); });
    /* görkeziş meýdany */
    const xs = [], ys = [];
    pts.forEach((q) => { xs.push(q.x.valueOf()); ys.push(q.y.valueOf()); });
    lines.forEach((L) => {
      if (!isZ(L.a)) { const v = L.c.div(L.a).valueOf(); if (v > 0) xs.push(v); }
      if (!isZ(L.b2)) { const v = L.c.div(L.b2).valueOf(); if (v > 0) ys.push(v); }
    });
    if (res && res.status === 'optimal') { xs.push(res.x[0].valueOf()); ys.push(res.x[1].valueOf()); }
    let X = Math.max(1, ...xs), Y = Math.max(1, ...ys);
    X = niceCeil(X * 1.25); Y = niceCeil(Y * 1.25);
    /* mümkin ýaýlanyň köpburçlugy: [0, X] × [0, Y] gönüburçlugy her ýarym tekizlik bilen kesmek */
    let poly = [[0, 0], [X, 0], [X, Y], [0, Y]];
    lines.forEach((L) => {
      const a = L.a.valueOf(), b = L.b2.valueOf(), c = L.c.valueOf();
      if (L.op === '<=' || L.op === '=') poly = clip(poly, a, b, c);
      if (L.op === '>=' || L.op === '=') poly = clip(poly, -a, -b, -c);
    });
    const eps = 1e-9 * Math.max(X, Y);
    const unboundedRegion = poly.some((q) => Math.abs(q[0] - X) < eps || Math.abs(q[1] - Y) < eps);
    /* simpleks ýoly: mümkin bolan bazis çözgütleri */
    const path = [];
    if (res && res.snapshots) {
      res.snapshots.forEach((s) => {
        const val = res.std.cols.map(() => 0);
        s.basis.forEach((j, i) => { val[j] = s.b[i].valueOf(); });
        const artPos = s.basis.some((j, i) => res.std.cols[j].kind === 'a' && sgn(s.b[i]) > 0);
        if (artPos) return;
        const pt = [val[0], val[1]];
        const lastPt = path[path.length - 1];
        if (!lastPt || Math.abs(lastPt[0] - pt[0]) > 1e-12 || Math.abs(lastPt[1] - pt[1]) > 1e-12) path.push(pt);
      });
    }
    return { lines, vertices: sortPoly(pts), polygon: poly, X, Y, unboundedRegion, path, c: p.c, c0: p.c0 };
  }

  function niceCeil(v) {
    if (v <= 0) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * e >= v - 1e-12) return m * e;
    return 10 * e;
  }

  /* Sutherland–Hodgman: a·x + b·y ≤ c ýarym tekizligi bilen kesmek */
  function clip(poly, a, b, c) {
    const out = [];
    const inside = (q) => a * q[0] + b * q[1] <= c + 1e-12 * (Math.abs(c) + 1);
    for (let i = 0; i < poly.length; i++) {
      const P = poly[i], Q = poly[(i + 1) % poly.length];
      const pin = inside(P), qin = inside(Q);
      if (pin) out.push(P);
      if (pin !== qin) {
        const fp = a * P[0] + b * P[1] - c, fq = a * Q[0] + b * Q[1] - c;
        const t = fp / (fp - fq);
        out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]);
      }
    }
    return out;
  }

  function sortPoly(pts) {
    if (pts.length < 3) return pts;
    const cx = pts.reduce((s, q) => s + q.x.valueOf(), 0) / pts.length;
    const cy = pts.reduce((s, q) => s + q.y.valueOf(), 0) / pts.length;
    return pts.slice().sort((p, q) => Math.atan2(p.y.valueOf() - cy, p.x.valueOf() - cx) - Math.atan2(q.y.valueOf() - cy, q.x.valueOf() - cx));
  }

  /* ------------------------------------------------------------------ eksport */
  root.AmatlySimplex = {
    SimplexError, LIMITS, ordinal,
    parseText, fromTable, toText, standardize, solve, graphData,
    mv, mvSign, mvIsZero, isZero: isZ, sign: sgn, fraction: F,
  };
})(typeof window !== 'undefined' ? window : globalThis);
