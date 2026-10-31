/* Amatly AI — «Amatly motory»: Claude API-syz jogaplar.
 *
 * Claude API sazlanmadyk (API açary goşulmadyk), serwer ýa-da internet elýeterli bolmadyk wagty Amatly AI soraglara saýtyň
 * öz hasaplaýyş motorlary bilen jogap berýär. Her jogap çatda «Amatly motory» diýip bellenýär: bu dil modeli däl — soragdaky
 * formulany we açar sözleri okaýar, meseläniň görnüşini anyklaýar we degişli motory işledýär:
 *   • limit, önüm, integral → solve_steps (assets/kalkulus/js/engine.js); kesgitli integralda boýalan meýdanly grafik
 *   • çyzykly we bitin sanly programmirleme → solve_lp (simpleks, şahalar we araçäkler)
 *   • deňlemeler (çyzykly, kwadrat, köpagzaly, islendik), deňsizlikler, grafik we funksiýany derňemek → math.js + plot_graph
 *   • deňlemeler ulgamy → assets/algebra/js/linsys-engine.js (Gauss, Gauss–Žordan, Kramer)
 *   • trigonometrik deňlemeler → assets/trigonometriya/js/trig-engine.js
 *   • statistika, matrisa, droblar, IUUB/IUKS, göterim, geometriýa, hereket meseleleri → takyk droblar (math.js)
 *   • düşündiriş soraglary (simpleks, MODI, t-test, Wengr usuly …) → gysga sapak + saýtyň degişli sahypasy
 * Jogaplar Claude API-nyň habar görnüşinde ({content, stop}) gaýtarylýar: ai.js olary şol bir ýol bilen görkezýär, gurallary
 * (kartalary) işledýär we taryhda saklaýar; gural netijelerinden soň reply() jemleýji teksti ýazýar.
 * API: window.AmatlyAILocal.reply(conv, env) → Promise<{content, stop}>;  .analyze(tekst, env) → Promise<meýilnama> (synaglar üçin).
 */
(function () {
  'use strict';
  if (window.AmatlyAILocal) return;

  var env = { mode: 'explain', page: '' };
  var plans = {};                     // tool_use id → meýilnama (jemleýji tekst üçin)
  var LET = 'A-Za-zÄÇÖÜŽŇŞÝäçöüžňşý';
  var isLetter = function (c) { return !!c && new RegExp('[' + LET + ']').test(c); };

  /* ============================================================ motorlary ýüklemek */
  var LIBS = {
    math: ['assets/vendor/math.js', 'math'],
    simplex: ['assets/simpleks/js/simplex-engine.js', 'AmatlySimplex'],
    linsys: ['assets/algebra/js/linsys-engine.js', 'AmatlyLinSys'],
    trig: ['assets/trigonometriya/js/trig-engine.js', 'AmatlyTrig']
  };
  function need(name) {
    var L = LIBS[name];
    if (window[L[1]]) return Promise.resolve(window[L[1]]);
    return (name === 'math' ? Promise.resolve() : need('math')).then(function () {
      if (window[L[1]]) return window[L[1]];
      if (typeof env.load !== 'function') throw new Error(L[0] + ' ýüklenmedi');
      return env.load(L[0]).then(function () {
        if (!window[L[1]]) throw new Error(L[0] + ' ýüklenmedi');
        return window[L[1]];
      });
    });
  }
  function M() { return window.math; }

  /* ============================================================ kömekçiler */
  var FOLD = { 'ä': 'a', 'ç': 'c', 'ö': 'o', 'ü': 'u', 'ž': 'z', 'ň': 'n', 'ş': 's', 'ý': 'y' };
  function fold(s) { return String(s || '').toLowerCase().replace(/[äçöüžňşý]/g, function (c) { return FOLD[c]; }); }
  function uid() { return 'toolu_amx' + Math.random().toString(36).slice(2, 12); }
  function isInt(v) { return isFinite(v) && Math.abs(v - Math.round(v)) < 1e-9 * Math.max(1, Math.abs(v)); }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; }
  function lcm(a, b) { return a && b ? Math.abs(a / gcd(a, b) * b) : 0; }
  function ratApprox(v, maxDen, tol) {
    if (!isFinite(v)) return null;
    for (var q = 1; q <= (maxDen || 1000); q++) {
      var p = Math.round(v * q);
      if (Math.abs(p / q - v) <= (tol || 1e-9) * Math.max(1, Math.abs(v))) return [p, q];
    }
    return null;
  }
  function squareFree(n) { for (var d = 2; d * d <= n; d++) if (n % (d * d) === 0) return false; return true; }
  /* san → onluk ýazgy (minus belgisi bilen) */
  function dec(v, d) {
    if (!isFinite(v)) return v > 0 ? '+∞' : v < 0 ? '−∞' : '—';
    if (Math.abs(v) < 1e-12) return '0';
    var a = Math.abs(v), s;
    if (a >= 1e9 || a < 1e-4) s = v.toPrecision(4);
    else s = String(+v.toFixed(d === undefined ? 4 : d));
    return s;
  }
  function decU(v, d) { return dec(v, d).replace('-', '−'); }
  /* san → takyk görnüş (bitin, drob, kπ/q, p√m/q) ýa-da onluk; {tex, txt, exact} */
  function nice(v) {
    if (!isFinite(v)) return { tex: v > 0 ? '+\\infty' : '-\\infty', txt: v > 0 ? '+∞' : '−∞', exact: true };
    if (Math.abs(v) < 1e-11) return { tex: '0', txt: '0', exact: true };
    var neg = v < 0, a = Math.abs(v), S = neg ? '-' : '', St = neg ? '−' : '';
    if (isInt(a)) { var n = String(Math.round(a)); return { tex: S + n, txt: St + n, exact: true }; }
    var r = ratApprox(a, 1000);
    if (r) return { tex: S + '\\frac{' + r[0] + '}{' + r[1] + '}', txt: St + r[0] + '/' + r[1], exact: true };
    for (var q = 1; q <= 12; q++) {
      var k = a * q / Math.PI;
      if (isInt(k) && Math.round(k) <= 48) {
        k = Math.round(k); var g = gcd(k, q), kk = k / g, qq = q / g, top = (kk === 1 ? '' : kk) + '\\pi';
        return { tex: S + (qq === 1 ? top : '\\frac{' + top + '}{' + qq + '}'), txt: St + (kk === 1 ? '' : kk) + 'π' + (qq === 1 ? '' : '/' + qq), exact: true };
      }
    }
    for (var m = 2; m <= 300; m++) {
      if (!squareFree(m)) continue;
      var rr = ratApprox(a / Math.sqrt(m), 60, 1e-10);
      if (rr) {
        var num = rr[0] === 1 ? '' : String(rr[0]);
        return { tex: S + (rr[1] === 1 ? num + '\\sqrt{' + m + '}' : '\\frac{' + num + '\\sqrt{' + m + '}}{' + rr[1] + '}'), txt: St + (num ? num : '') + '√' + m + (rr[1] === 1 ? '' : '/' + rr[1]), exact: true };
      }
    }
    return { tex: S + dec(a), txt: St + dec(a), exact: false };
  }
  function nt(v) { var n = nice(v); return n.exact ? n.tex : '\\approx ' + n.tex; }     // TeX: «= 1/2» ýa-da «≈ 1.5214»
  function eqT(v) { var n = nice(v); return (n.exact ? '= ' : '\\approx ') + n.tex; }
  function nTxt(v) { var n = nice(v); return n.exact ? n.txt : '≈ ' + n.txt; }
  function iTxt(v) { return nice(v).txt; }

  /* droblar (math.js fraction) */
  function F(a, b) { return b === undefined ? M().fraction(a) : M().fraction(a, b); }
  function toFrac(v) {
    if (v && typeof v.toFraction === 'function') return v;
    if (typeof v !== 'number' || !isFinite(v)) return null;
    if (isInt(v)) return F(Math.round(v));
    var r = ratApprox(v, 10000, 1e-12);
    return r ? F(r[0], r[1]) : null;
  }
  function fT(f) { var s = f.toFraction(), m = /^(-?)(\d+)\/(\d+)$/.exec(s); return m ? m[1] + '\\frac{' + m[2] + '}{' + m[3] + '}' : s; }
  function fP(f) { return f.compare(0) < 0 ? '(' + fT(f) + ')' : fT(f); }
  function fS(f) { return f.toFraction().replace('-', '−'); }
  function fInt(f) { return String(f.d) === '1'; }
  function fMixed(f) {
    var a = f.abs(), n = Number(a.n), d = Number(a.d);
    if (d === 1 || n < d) return null;
    return (f.compare(0) < 0 ? '-' : '') + Math.floor(n / d) + (n % d ? '\\frac{' + (n % d) + '}{' + d + '}' : '');
  }

  /* math.js aňlatmasy → TeX (2x, tg, ctg ...) */
  function texOf(e) {
    try {
      var node = typeof e === 'string' ? M().parse(e) : e;
      node = node.transform(function (n) {
        var A0 = n.args && n.args[0], A1 = n.args && n.args[1];
        if (n.isOperatorNode && n.fn === 'multiply' && !n.implicit && n.args.length === 2 && (A0.isConstantNode || (A0.isSymbolNode && !A1.isConstantNode) || ((A0.isFunctionNode || (A0.isOperatorNode && A0.fn === 'pow')) && A1.isParenthesisNode)) &&
          (A1.isSymbolNode || A1.isFunctionNode || A1.isParenthesisNode || (A1.isOperatorNode && A1.fn === 'pow' && A1.args[0].isSymbolNode))) {
          return new (M().OperatorNode)('*', 'multiply', n.args, true);
        }
        return n;
      });
      return node.toTex({ parenthesis: 'auto', implicit: 'hide' }).replace(/~/g, '')
        .replace(/\\tan\^\{-1\}/g, '\\operatorname{arctg}').replace(/\\cot\^\{-1\}/g, '\\operatorname{arcctg}')
        .replace(/\\sin\^\{-1\}/g, '\\arcsin').replace(/\\cos\^\{-1\}/g, '\\arccos')
        .replace(/\\tan(?![a-z])/g, '\\operatorname{tg}').replace(/\\cot(?![a-z])/g, '\\operatorname{ctg}');
    } catch (err) { return '\\text{' + String(e).replace(/[\\{}$&#%^_~]/g, ' ') + '}'; }
  }
  /* math.js aňlatmasy → gysga tekst (grafigiň ýazgysy üçin): x² − 4x + 3 */
  var SUPD = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function plain(e) {
    var s;
    try { s = (typeof e === 'string' ? M().parse(e) : e).toString({ parenthesis: 'auto', implicit: 'hide' }); } catch (err) { s = String(e); }
    return s.replace(/\s*\^\s*\(?(-?\d+)\)?(?![\d.(])/g, function (m, d) { return d.split('').map(function (c) { return SUPD[c]; }).join(''); })
      .replace(/\s*\^\s*/g, '^').replace(/\s*\*\s*/g, '·').replace(/(\d)[· ](?=[a-zπ(√|])/g, '$1')
      .replace(/\bpi\b/g, 'π').replace(/\bsqrt\(/g, '√(').replace(/\blog\(/g, 'ln(').replace(/\blog10\(/g, 'lg(')
      .replace(/\btan\(/g, 'tg(').replace(/\bcot\(/g, 'ctg(').replace(/\babs\(([^()]*)\)/g, '|$1|')
      .replace(/ - /g, ' − ').replace(/^-/, '−').replace(/\(-/g, '(−').replace(/\s+/g, ' ').trim();
  }
  function link(t, u) { return '[' + t + '](' + u + ')'; }
  /* motoryň jogaby («1/2 = 0.5», «e ≈ 2.71828», «≈ 0.746824», «e ^ x * (x - 1) + C») → TeX: «= \frac{1}{2} = 0.5» */
  function ansTeX(s) {
    s = String(s || '').replace(/−/g, '-').replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/∞/g, 'Infinity').trim();
    var parts = s.split(/\s*(=|≈)\s*/), out = [], prev = null;
    for (var i = 0; i < parts.length; i += 2) {
      var p = parts[i].trim(), op = i ? parts[i - 1] : '=';
      if (!p) continue;
      var plusC = /\+\s*C$/.test(p), nn = window.math ? (function () { try { return M().parse(p.replace(/\+\s*C$/, '')); } catch (e) { return null; } })() : null;
      var t = nn && !/[A-Za-z]{4,}/.test(p.replace(/Infinity|sqrt|atan|acot|asin|acos|log10|log/g, '')) ? texOf(nn).trim() + (plusC ? ' + C' : '') : '\\text{' + p.replace(/[\\{}$]/g, '') + '}';
      if (op === '≈' && t === prev) continue;
      out.push((op === '≈' ? '\\approx ' : '= ') + t);
      prev = t;
    }
    return out.join(' ');
  }

  /* ============================================================ teksti matematika ýazgysyna getirmek */
  var SUPC = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-', 'ˣ': 'x', 'ʸ': 'y', 'ⁿ': 'n', 'ᵗ': 't', 'ᵏ': 'k', 'ᵃ': 'a', 'ᵇ': 'b', '⁽': '(', '⁾': ')' };
  var SUBC = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₊': '+', '₋': '-' };
  var FNMAP = { arcsin: 'asin', arccos: 'acos', arctg: 'atan', arctan: 'atan', arcctg: 'acot', arccot: 'acot', tg: 'tan', ctg: 'cot', cotg: 'cot', ln: 'log', lg: 'log10' };
  var FNS = ['asinh', 'acosh', 'atanh', 'asin', 'acos', 'atan', 'acot', 'asec', 'acsc', 'sinh', 'cosh', 'tanh', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log10', 'log2', 'log', 'sqrt', 'cbrt', 'exp', 'abs'];
  var FNRX = new RegExp('(' + FNS.join('|') + ')', 'y');
  var MATHWORD = {}; FNS.concat(['pi', 'e', 'inf', 'Infinity', 'deg']).forEach(function (w) { MATHWORD[w] = 1; });

  /* funksiýa ýaýsyz ýazylanda: sin x → sin(x), sin²x → (sin(x))^(2) */
  function fnArgs(s) {
    var out = '', i = 0;
    while (i < s.length) {
      FNRX.lastIndex = i;
      var m = isLetter(s[i - 1]) ? null : FNRX.exec(s);
      if (!m) { out += s[i]; i++; continue; }
      var name = m[1], j = i + name.length, rest = s.slice(j);
      if (isLetter(rest[0]) && !/^[a-z](?![A-Za-zÄÇÖÜŽŇŞÝäçöüžňşý(])/.test(rest)) { out += name; i = j; continue; }
      var pow = '', pm = /^\s*\^\s*(\(\s*-?\d+\s*\)|\d+)/.exec(rest);
      if (pm && !/^\s*\(/.test(rest)) { pow = pm[1].replace(/[()\s]/g, ''); j += pm[0].length; rest = s.slice(j); }
      var ws = /^\s*/.exec(rest)[0], arg;
      if (rest.charAt(ws.length) === '(') {
        var depth = 0, k = j + ws.length;
        for (; k < s.length; k++) { if (s[k] === '(') depth++; else if (s[k] === ')') { depth--; if (!depth) break; } }
        if (depth) { out += s.slice(i); break; }
        arg = fnArgs(s.slice(j + ws.length + 1, k)); j = k + 1;
      } else {
        var am = /^\s*((?:\d+(?:\.\d+)?\s*\*?\s*)?(?:pi|[a-z])(?![A-Za-zÄÇÖÜŽŇŞÝäçöüžňşý(])(?:\s*\^\s*(?:\(\s*-?\d+\s*\)|\d+))?|\d+(?:\.\d+)?)/.exec(rest);
        if (!am) { out += name; i = j; continue; }
        arg = am[1].trim(); j += am[0].length;
      }
      out += pow ? '(' + name + '(' + arg + '))^(' + pow + ')' : name + '(' + arg + ')';
      i = j;
    }
    return out;
  }
  /* |x − 3| → abs(x - 3) */
  function absBars(s) {
    if (s.indexOf('|') < 0) return s;
    var out = '', open = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c !== '|') { out += c; continue; }
      var prev = out.replace(/\s+$/, '').slice(-1);
      if (open === 0 || prev === '' || /[-+*/^(,=<>!]/.test(prev)) { out += 'abs('; open++; } else { out += ')'; open--; }
    }
    while (open-- > 0) out += ')';
    return out;
  }
  /* ýaýlaryň daşyndaky onluk otur: 1,5 → 1.5 (sanlaryň sanawy 4,8,6 we matrisalar degilmeýär) */
  function decComma(s) {
    if (/\d,\d+,\d/.test(s)) return s;
    var out = '', depth = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if ('([{'.indexOf(c) >= 0) depth++; else if (')]}'.indexOf(c) >= 0) depth = Math.max(0, depth - 1);
      if (c === ',' && !depth && /\d/.test(s[i - 1] || '') && /\d/.test(s[i + 1] || '')) { out += '.'; continue; }
      out += c;
    }
    return out;
  }
  function norm(raw) {
    var s = String(raw || '').replace(/\r\n?/g, '\n').replace(/[\u00a0\u2007\u2009\u202f]/g, ' ')
      .replace(/[−–—‒﹣－]/g, '-').replace(/[×∙⋅·•]/g, '*').replace(/÷/g, '/').replace(/：/g, ':')
      .replace(/≤|⩽|=</g, '<=').replace(/≥|⩾|=>/g, '>=').replace(/≠/g, '!=')
      .replace(/→|⟶|➝|⟹|↦/g, '->').replace(/π/g, 'pi ').replace(/∞/g, 'inf ').replace(/\*\*/g, '^')
      .replace(/(\d+(?:[.,]\d+)?)\s*°/g, '($1 deg)')
      .replace(/[’‘`′ʹ]/g, "'").replace(/″/g, "''").replace(/[“”„«»]/g, '"');
    s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ˣʸⁿᵗᵏᵃᵇ⁽⁾]+/g, function (m) { return '^(' + m.split('').map(function (c) { return SUPC[c]; }).join('') + ')'; });
    s = s.replace(/[₀₁₂₃₄₅₆₇₈₉₊₋]+/g, function (m) { return m.split('').map(function (c) { return SUBC[c]; }).join(''); });
    s = s.replace(/√\s*\(/g, 'sqrt(').replace(/∛\s*\(/g, 'cbrt(').replace(/√\s*([A-Za-z0-9.]+)/g, 'sqrt($1)').replace(/∛\s*([A-Za-z0-9.]+)/g, 'cbrt($1)');
    s = s.replace(/\blog_?\{?(\d+)\}?\s*\(([^()]*)\)/g, function (m, b, a) { return b === '10' ? 'log10(' + a + ')' : b === '2' ? 'log2(' + a + ')' : 'log(' + a + ', ' + b + ')'; });
    s = s.replace(new RegExp('(^|[^' + LET + '])(arcsin|arccos|arctg|arctan|arcctg|arccot|ctg|cotg|tg|ln|lg)(?=$|[^' + LET + ']|[a-z](?![' + LET + ']))', 'gi'),
      function (m, pre, name) { return pre + FNMAP[name.toLowerCase()]; });
    s = decComma(s);
    s = s.replace(/([\d)])\s*:\s*(?=[\d(])/g, '$1/');
    s = fnArgs(s);
    s = absBars(s);
    s = s.replace(new RegExp('(^|[^' + LET + '0-9_])([a-ei-z])\\s*\\(', 'g'), '$1$2*(');
    return s;
  }

  /* sözlemdäki formulalar: türkmen sözleri, nokat, sorag belgisi we ýaýdan daşardaky otur formulany bölýär */
  var TOKRX = new RegExp('\\n|[ \\t]+|\\d+(?:\\.\\d+)?|[' + LET + '_][' + LET + '0-9_]*|<=|>=|!=|->|==|\\S', 'g');
  function isVar(w) { return /^[a-zA-Z]$/.test(w) || /^[a-zA-Z]_?\d{1,2}$/.test(w); }
  function tidy(t) {
    t = t.replace(/\s+/g, ' ').trim().replace(/^[,;:=+*\/^.!]+\s*/, '');
    while (/[\s,;:=+\-*\/^<>.]$/.test(t) || (/!$/.test(t) && !/\d!$/.test(t))) t = t.slice(0, -1).trim();
    var bal = 0, i;
    for (i = 0; i < t.length; i++) { if ('([{'.indexOf(t[i]) >= 0) bal++; else if (')]}'.indexOf(t[i]) >= 0) bal--; }
    while (bal < 0 && /[)\]}]$/.test(t)) { t = t.slice(0, -1).trim(); bal++; }
    while (bal < 0 && /^[)\]}]/.test(t)) { t = t.slice(1).trim(); bal++; }
    if (bal < 0) return '';
    while (bal-- > 0) t += ')';
    return /[0-9a-zA-Z]/.test(t) ? t : '';
  }
  function spans(s) {
    var toks = s.match(TOKRX) || [], out = [], cur = '', depth = 0;
    function flush() { var t = tidy(cur); if (t) out.push(t); cur = ''; depth = 0; }
    toks.forEach(function (t) {
      if (t === '\n') { flush(); return; }
      if (/^[ \t]+$/.test(t)) { if (cur) cur += ' '; return; }
      if (/^\d/.test(t)) { cur += t; return; }
      if (new RegExp('^[' + LET + '_]').test(t)) { if (MATHWORD[t] || isVar(t)) cur += t; else flush(); return; }
      if ('([{'.indexOf(t) >= 0) { depth++; cur += t; return; }
      if (')]}'.indexOf(t) >= 0) { depth = Math.max(0, depth - 1); cur += t; return; }
      if (t === ',' || t === ';') { if (depth) cur += t; else flush(); return; }
      if (/^(<=|>=|!=|->|==|[-+*\/^=<>!|%'])$/.test(t)) { cur += t; return; }
      flush();
    });
    flush();
    return out;
  }
  var CONSTS = { pi: 1, e: 1, PI: 1, E: 1, Infinity: 1, inf: 1, deg: 1, i: 0 };
  function P(expr) { try { return M().parse(String(expr).replace(/\binf\b/g, 'Infinity')); } catch (e) { return null; } }
  function varsOf(node) {
    var v = {};
    node.traverse(function (n, path, parent) { if (n.isSymbolNode && !(parent && parent.isFunctionNode && path === 'fn') && !CONSTS[n.name]) v[n.name] = 1; });
    return Object.keys(v);
  }
  function hasFn(node, names) {
    var hit = false;
    node.traverse(function (n) { if (n.isFunctionNode && names.indexOf(n.fn.name) >= 0) hit = true; });
    return hit;
  }
  function rename(node, from, to) {
    if (from === to) return node;
    return node.transform(function (n) { return n.isSymbolNode && n.name === from ? new (M().SymbolNode)(to) : n; });
  }
  /* «y = …», «f(x) = …» */
  function asDef(span) {
    var m = /^\s*([yfgh])\s*(?:\(\s*x\s*\))?\s*=(?!=)\s*([^=<>]+)$/.exec(span);
    if (!m || /^\s*$/.test(m[2])) return null;
    var node = P(m[2]);
    if (!node) return null;
    var vs = varsOf(node);
    if (vs.some(function (v) { return v !== 'x'; })) return null;
    return { name: m[1], label: m[1] === 'y' ? 'y' : m[1] + '(x)', expr: m[2], node: node };
  }
  function splitCmp(span) {
    var m = span.match(/<=|>=|!=|==|=|<|>/g);
    if (!m || m.length !== 1) return null;
    var op = m[0], i = span.indexOf(op);
    var L = span.slice(0, i).trim(), R = span.slice(i + op.length).trim();
    if (!L || !R) return null;
    var nl = P(L), nr = P(R);
    if (!nl || !nr) return null;
    return { op: op, L: L, R: R, nl: nl, nr: nr };
  }

  /* ============================================================ san usullary */
  function realOf(v) {
    if (typeof v === 'number') return v;
    if (v && typeof v.re === 'number') return Math.abs(v.im) < 1e-12 ? v.re : NaN;
    if (v && typeof v.valueOf === 'function') { var n = Number(v.valueOf()); return isFinite(n) ? n : NaN; }
    return NaN;
  }
  function fxOf(node) {
    var c = node.compile();
    return function (x) { try { return realOf(c.evaluate({ x: x })); } catch (e) { return NaN; } };
  }
  function bisect(f, a, b, fa) {
    for (var k = 0; k < 100; k++) {
      var m = (a + b) / 2, fm = f(m);
      if (!isFinite(fm)) return NaN;
      if (fm === 0) return m;
      if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else b = m;
    }
    return (a + b) / 2;
  }
  function polish(f, r, h) {
    var x = r;
    for (var k = 0; k < 40; k++) {
      var e = 1e-7 * Math.max(1, Math.abs(x)), d = (f(x + e) - f(x - e)) / (2 * e), y = f(x);
      if (!isFinite(d) || d === 0 || !isFinite(y) || y === 0) break;
      var x1 = x - y / d;
      if (!isFinite(x1) || Math.abs(x1 - r) > h) break;
      if (Math.abs(x1 - x) < 1e-15 * Math.max(1, Math.abs(x))) { x = x1; break; }
      x = x1;
    }
    return Math.abs(f(x)) <= Math.abs(f(r)) ? x : r;
  }
  function rootsIn(f, a, b, n) {
    n = n || 4000;
    var h = (b - a) / n, xs = [], ys = [], out = [], i;
    for (i = 0; i <= n; i++) { xs.push(a + i * h); ys.push(f(a + i * h)); }
    function add(r) {
      if (!isFinite(r)) return;
      r = polish(f, r, h);
      if (Math.abs(r) < 1e-10) r = 0;
      if (!out.some(function (q) { return Math.abs(q - r) < 1e-7 * Math.max(1, Math.abs(r)); })) out.push(r);
    }
    for (i = 0; i <= n; i++) {
      if (!isFinite(ys[i])) continue;
      if (ys[i] === 0) { add(xs[i]); continue; }
      if (i < n && isFinite(ys[i + 1]) && ys[i + 1] !== 0 && (ys[i] < 0) !== (ys[i + 1] < 0)) {
        var r = bisect(f, xs[i], xs[i + 1], ys[i]), fr = f(r);
        if (isFinite(fr) && Math.abs(fr) <= 1e-6 * Math.max(1, Math.abs(ys[i]), Math.abs(ys[i + 1]))) add(r);
      }
    }
    for (i = 1; i < n; i++) {                       // galtaşma kökleri (alamat üýtgemeýär): |f|-iň kiçi minimumlary
      var y0 = Math.abs(ys[i - 1]), y1 = Math.abs(ys[i]), y2 = Math.abs(ys[i + 1]);
      if (!(isFinite(y0) && isFinite(y1) && isFinite(y2)) || !(y1 <= y0 && y1 <= y2) || y1 > 1e-3) continue;
      var lo = xs[i - 1], hi = xs[i + 1];
      for (var k = 0; k < 100; k++) { var m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (Math.abs(f(m1)) < Math.abs(f(m2))) hi = m2; else lo = m1; }
      var t = (lo + hi) / 2;
      if (Math.abs(f(t)) < 1e-10) add(t);
    }
    return out.sort(function (p, q) { return p - q; }).slice(0, 30);
  }

  /* funksiýanyň kesgitlenmedik nokatlary we polýuslary (alamat nolsuz üýtgeýän ýerler) */
  function cutsIn(f, a, b, n) {
    n = n || 12000;
    var h = (b - a) / n, out = [], x0 = a, y0 = f(a);
    function push(r) { if (Math.abs(r - Math.round(r)) < 1e-7) r = Math.round(r); if (!out.some(function (q) { return Math.abs(q - r) < 1e-6; })) out.push(r); }
    for (var i = 1; i <= n; i++) {
      var x1 = a + i * h, y1 = f(x1), f0 = isFinite(y0), f1 = isFinite(y1);
      if (f0 !== f1) {
        var lo = x0, hi = x1;
        for (var k = 0; k < 70; k++) { var m = (lo + hi) / 2; if (isFinite(f(m)) === f0) lo = m; else hi = m; }
        push(f0 ? lo : hi);
      } else if (f0 && y0 !== 0 && y1 !== 0 && (y0 < 0) !== (y1 < 0)) {
        var r = bisect(f, x0, x1, y0), fr = f(r);
        if (!(isFinite(fr) && Math.abs(fr) <= 1e-6 * Math.max(1, Math.abs(y0), Math.abs(y1)))) push(r);
      }
      x0 = x1; y0 = y1;
    }
    return out.sort(function (p, q) { return p - q; });
  }

  /* takyk droblar bilen hasaplamak: + − · : we bitin dereje */
  function fracEval(node) {
    if (!node) return null;
    if (node.isParenthesisNode) return fracEval(node.content);
    if (node.isConstantNode) {
      var v = node.value;
      if (typeof v !== 'number' || !isFinite(v)) return null;
      return /e/i.test(String(v)) ? toFrac(v) : F(String(v));
    }
    if (node.isOperatorNode) {
      var a = node.args.map(fracEval);
      if (a.some(function (x) { return x === null; })) return null;
      switch (node.fn) {
        case 'unaryMinus': return a[0].neg();
        case 'unaryPlus': return a[0];
        case 'add': return a[0].add(a[1]);
        case 'subtract': return a[0].sub(a[1]);
        case 'multiply': return a[0].mul(a[1]);
        case 'divide': return a[1].equals(0) ? null : a[0].div(a[1]);
        case 'pow': return fInt(a[1]) && Math.abs(a[1].valueOf()) <= 64 && !(a[0].equals(0) && a[1].valueOf() <= 0) ? a[0].pow(a[1]) : null;
      }
      return null;
    }
    if (node.isFunctionNode && node.fn.name === 'abs' && node.args.length === 1) { var x = fracEval(node.args[0]); return x ? x.abs() : null; }
    return null;
  }

  /* ============================================================ köpagzalar */
  function polyOf(node) {
    try {
      var r = M().rationalize(node, {}, true);
      if (r.variables.length > 1 || (r.variables.length === 1 && r.variables[0] !== 'x')) return null;
      var coef = r.coefficients && r.coefficients.length ? r.coefficients : [realOf(node.compile().evaluate({}))];
      var fc = coef.map(toFrac);
      if (fc.some(function (c) { return !c; })) return null;
      while (fc.length > 1 && fc[fc.length - 1].equals(0)) fc.pop();
      return { c: fc, deg: fc.length - 1, den: r.denominator || null };
    } catch (e) { return null; }
  }
  function polyTeX(c, v) {
    v = v || 'x';
    var s = '';
    for (var k = c.length - 1; k >= 0; k--) {
      var a = c[k];
      if (a.equals(0)) continue;
      var neg = a.compare(0) < 0, ab = a.abs();
      var term = (k > 0 && ab.equals(1) ? '' : fT(ab)) + (k === 0 ? '' : k === 1 ? v : v + '^{' + k + '}');
      s += s ? (neg ? ' - ' : ' + ') + term : (neg ? '-' : '') + term;
    }
    return s || '0';
  }
  function polyStr(c) {
    var s = '';
    for (var k = c.length - 1; k >= 0; k--) {
      var a = c[k];
      if (a.equals(0)) continue;
      var neg = a.compare(0) < 0, ab = a.abs(), co = fInt(ab) ? String(ab.n) : '(' + ab.toFraction() + ')';
      var term = (k > 0 && ab.equals(1) ? '' : co + (k > 0 ? '*' : '')) + (k === 0 ? '' : k === 1 ? 'x' : 'x^' + k);
      s += s ? (neg ? ' - ' : ' + ') + term : (neg ? '-' : '') + term;
    }
    return s || '0';
  }
  function polyAt(c, x) { var r = F(0); for (var k = c.length - 1; k >= 0; k--) r = r.mul(x).add(c[k]); return r; }
  function deflate(c, r) {
    var n = c.length - 1, out = new Array(n), carry = F(0);
    for (var i = n; i >= 1; i--) { carry = c[i].add(carry.mul(r)); out[i - 1] = carry; }
    return out;
  }
  function divisors(n) {
    var out = [];
    n = Math.abs(n);
    if (!n || n > 1e9) return out;
    for (var d = 1; d * d <= n; d++) if (n % d === 0) { out.push(d); if (d * d !== n) out.push(n / d); }
    return out.sort(function (a, b) { return a - b; });
  }
  function intCoefs(c) {
    var L = c.reduce(function (acc, f) { return lcm(acc, Number(f.d)); }, 1);
    var I = c.map(function (f) { return Math.round(f.valueOf() * L); });
    return I.every(function (v) { return isFinite(v) && Math.abs(v) <= 1e9; }) ? I : null;
  }
  /* √D (D ≥ 0 drob) = k·√m */
  function surd(D) {
    var N = Number(D.n) * Number(D.d), q = Number(D.d);
    if (!isFinite(N) || N > 1e12) return null;
    var k = 1, m = N;
    for (var d = 2; d * d <= m; d++) while (m % (d * d) === 0) { m /= d * d; k *= d; }
    return { k: F(k, q), m: m };
  }
  /* r ± s√m (r, s — droblar) → TeX */
  function pmTeX(r, s, m) {
    var Q = lcm(Number(r.d), Number(s.d)), R = r.mul(Q), S = s.mul(Q);
    var sq = (S.equals(1) ? '' : fS(S).replace('−', '-')) + '\\sqrt{' + m + '}';
    var top = (R.equals(0) ? '' : fS(R).replace('−', '-') + ' ') + '\\pm ' + sq;
    return Q === 1 ? top : '\\frac{' + top + '}{' + Q + '}';
  }
  /* köpagzaly deňleme P(x) = 0: ädimler (Markdown setirleri) we kökler [{v, tex, txt}] */
  function rootObj(f) { return { v: f.valueOf(), tex: fT(f), txt: fS(f), exact: true }; }
  function solveLinear(c, lines) {
    var a = c[1], b = c[0], x = b.neg().div(a);
    lines.push('Näbellili agzalary çep tarapa, sanlary sag tarapa geçirýäris: $$' + polyTeX([F(0), a]) + ' = ' + fT(b.neg()) + '$$');
    if (!a.equals(1)) lines.push('Iki tarapy hem $x$-iň koeffisiýentine ($' + fT(a) + '$) bölýäris: $$x = ' + (fInt(b.neg()) && fInt(a) ? '\\frac{' + fT(b.neg()) + '}{' + fT(a) + '} = ' : '') + fT(x) + '$$');
    return [rootObj(x)];
  }
  function solveQuadratic(c, lines) {
    var a = c[2], b = c[1], cc = c[0];
    var D = b.mul(b).sub(F(4).mul(a).mul(cc));
    lines.push('Koeffisiýentler: $a = ' + fT(a) + '$, $b = ' + fT(b) + '$, $c = ' + fT(cc) + '$.');
    lines.push('**Diskriminant:** $D = b^2 - 4ac = ' + fP(b) + '^2 - 4\\cdot ' + fP(a) + '\\cdot ' + fP(cc) + ' = ' + fT(D) + '$.');
    var a2 = a.mul(2), roots = [];
    if (D.compare(0) < 0) {
      lines.push('$D < 0$ — deňlemäniň **hakyky köki ýok**.');
      var s0 = surd(D.neg());
      if (s0) {
        var re = b.neg().div(a2), im = s0.k.div(a2).abs();
        var imT = (im.equals(1) ? '' : fT(im)) + (s0.m === 1 ? '' : '\\sqrt{' + s0.m + '}') || '1';
        lines.push('Kompleks kökleri: $x_{1,2} = ' + (re.equals(0) ? '' : fT(re) + ' ') + '\\pm ' + imT + 'i$.');
      }
      return roots;
    }
    if (D.equals(0)) {
      var x0 = b.neg().div(a2);
      lines.push('$D = 0$ — deňlemäniň bir (gaýtalanýan) köki bar: $$x = -\\frac{b}{2a} = ' + fT(x0) + '$$');
      return [rootObj(x0)];
    }
    lines.push('$D > 0$ — deňlemäniň iki dürli hakyky köki bar:');
    var s = surd(D);
    if (s && s.m === 1) {
      var x1 = b.neg().add(s.k).div(a2), x2 = b.neg().sub(s.k).div(a2);
      lines.push('$$x_{1,2} = \\frac{-b \\pm \\sqrt{D}}{2a} = \\frac{' + fT(b.neg()) + ' \\pm ' + fT(s.k) + '}{' + fT(a2) + '}$$');
      lines.push('$$x_1 = ' + fT(x1) + ', \\qquad x_2 = ' + fT(x2) + '$$');
      roots = [rootObj(x1), rootObj(x2)];
    } else {
      var r0 = b.neg().div(a2), sq = Math.sqrt(D.valueOf()), v1 = (-b.valueOf() + sq) / a2.valueOf(), v2 = (-b.valueOf() - sq) / a2.valueOf();
      var form = s ? pmTeX(r0, s.k.div(a2).abs(), s.m) : null;
      lines.push('$$x_{1,2} = \\frac{-b \\pm \\sqrt{D}}{2a} = \\frac{' + fT(b.neg()) + ' \\pm \\sqrt{' + fT(D) + '}}{' + fT(a2) + '}' + (form ? ' = ' + form : '') + '$$');
      lines.push('$$x_1 \\approx ' + dec(v1) + ', \\qquad x_2 \\approx ' + dec(v2) + '$$');
      var t1 = s ? pmTeX(r0, s.k.div(a2).abs(), s.m) : null;
      var fixT = function (t) { return t.replace(/^\+ /, '').replace(/\{\+ /, '{').replace(/^- /, '-'); };
      roots = [{ v: v1, tex: t1 ? fixT(t1.replace('\\pm ', '+ ')) : dec(v1), txt: '≈ ' + decU(v1), exact: !!t1 }, { v: v2, tex: t1 ? fixT(t1.replace('\\pm ', '- ')) : dec(v2), txt: '≈ ' + decU(v2), exact: !!t1 }];
    }
    var sum = b.neg().div(a), prod = cc.div(a);
    lines.push('**Wiýetiň teoremasy bilen barlag:** $x_1 + x_2 = -\\frac{b}{a} = ' + fT(sum) + '$, $x_1 \\cdot x_2 = \\frac{c}{a} = ' + fT(prod) + '$ ✓');
    return roots;
  }
  function solvePoly(c, lines) {
    if (c.length - 1 === 1) return solveLinear(c, lines);
    if (c.length - 1 === 2) return solveQuadratic(c, lines);
    var found = [], cur = c.slice(), zeroRoot = false;
    while (cur.length > 1 && cur[0].equals(0)) { cur = cur.slice(1); zeroRoot = true; }
    if (zeroRoot) { found.push(F(0)); lines.push('Azat agza ýok, şonuň üçin $x = 0$ kök: $x$-i ýaýyň daşyna çykarýarys.'); }
    var tried = false;
    while (cur.length - 1 > 2) {
      var I = intCoefs(cur);
      if (!I) break;
      var ps = divisors(I[0]), qs = divisors(I[I.length - 1]), hit = null;
      if (!tried) { lines.push('Rasional kökler $\\pm\\frac{p}{q}$ görnüşde bolup biler: $p$ — azat agzanyň ($' + I[0] + '$), $q$ — baş koeffisiýentiň ($' + I[I.length - 1] + '$) bölüjisi.'); tried = true; }
      outer: for (var i = 0; i < ps.length; i++) for (var j = 0; j < qs.length; j++) for (var sg = 1; sg >= -1; sg -= 2) {
        var r = F(sg * ps[i], qs[j]);
        if (polyAt(cur, r).equals(0)) { hit = r; break outer; }
      }
      if (!hit) break;
      var rest = deflate(cur, hit);
      lines.push('$P(' + fT(hit) + ') = 0$, diýmek $x = ' + fT(hit) + '$ kök. Gorneriň shemasy bilen $(x ' + (hit.compare(0) < 0 ? '+ ' + fT(hit.neg()) : '- ' + fT(hit)) + ')$ köpeldijini aýyrýarys: $$' + polyTeX(cur) + ' = \\left(x ' + (hit.compare(0) < 0 ? '+ ' + fT(hit.neg()) : '- ' + fT(hit)) + '\\right)\\left(' + polyTeX(rest) + '\\right)$$');
      found.push(hit); cur = rest;
    }
    var roots = found.map(rootObj);
    if (cur.length - 1 <= 2 && cur.length - 1 >= 1) {
      if (found.length) lines.push('Galan deňleme: $$' + polyTeX(cur) + ' = 0$$');
      roots = roots.concat(cur.length - 1 === 2 ? solveQuadratic(cur, lines) : solveLinear(cur, lines));
    } else if (cur.length - 1 > 2) {
      var f = fxOf(M().parse(polyStr(cur)));
      var B = 1 + Math.max.apply(null, cur.slice(0, -1).map(function (x) { return Math.abs(x.div(cur[cur.length - 1]).valueOf()); }));
      var nr = rootsIn(f, -B - 1, B + 1, 8000);
      lines.push((found.length ? 'Galan $' + polyTeX(cur) + ' = 0$ deňlemäniň' : 'Bu deňlemäniň') + ' rasional köki ýok, şonuň üçin hakyky kökleri san usuly bilen tapýarys (alamatyň üýtgeýşi + ýarpylatma, Nýutonyň usuly bilen takyklamak; ähli kökler $|x| < ' + dec(B + 1, 2) + '$ aralykda ýatýar).');
      nr.forEach(function (v) { var n = nice(v); roots.push({ v: v, tex: n.tex, txt: n.exact ? n.txt : '≈ ' + n.txt, exact: n.exact }); });
    }
    var seen = [];
    return roots.filter(function (r) { if (seen.some(function (q) { return Math.abs(q - r.v) < 1e-9; })) return false; seen.push(r.v); return true; })
      .sort(function (p, q) { return p.v - q.v; });
  }

  /* ============================================================ soragy okamak */
  function textOf(m) {
    return (m && Array.isArray(m.content) ? m.content : []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; });
  }
  function isTextTurn(m) { return m && m.role === 'user' && Array.isArray(m.content) && m.content.some(function (b) { return b.type !== 'tool_result'; }); }
  function question(conv, idx) {
    var m = conv[idx], q = { idx: idx, text: '', quote: '', page: '', images: 0 };
    textOf(m).forEach(function (t) {
      var a;
      if ((a = /^<sahypa>([\s\S]*)<\/sahypa>$/.exec(t))) { var pm = /\(([^()]*)\)\s*$/.exec(a[1]); q.page = pm ? pm[1] : ''; }
      else if ((a = /^<saylanan>([\s\S]*)<\/saylanan>$/.exec(t))) q.quote = a[1];
      else if (!/^\[(öňki surat|Ulanyjy surat iberdi)/.test(t)) q.text += (q.text ? '\n' : '') + t;
    });
    q.images = (m.content || []).filter(function (b) { return b.type === 'image'; }).length;
    return q;
  }
  function lastQuestionIdx(conv, before) {
    for (var i = (before === undefined ? conv.length : before) - 1; i >= 0; i--) if (isTextTurn(conv[i])) return i;
    return -1;
  }

  /* ============================================================ jogaplar: umumy bölekler */
  var EX = '`2x² − 5x + 2 = 0`, `lim (x→0) sin(x)/x`, `∫ x·eˣ dx`, `y = x³ − 3x grafigini çyz`';
  function capabilities() {
    return 'Häzir Claude API sazlanmady, şonuň üçin soraglaryňyza **Amatly motory** — saýtyň öz hasaplaýyş motorlary jogap berýär. Her çözgüt ädimme-ädim we barlagly:\n\n' +
      '- **Kalkulus:** limit, önüm, kesgitsiz we kesgitli integral — `lim (x→0) (1 − cos x)/x²`, `x³ − 3x funksiýanyň önümi`, `∫₀³ x² dx`\n' +
      '- **Deňlemeler we deňsizlikler:** çyzykly, kwadrat (diskriminant), köpagzaly, trigonometrik, modully — `2x² − 5x + 2 = 0`, `2sin(x) = 1`, `|x − 3| < 2`\n' +
      '- **Ulgamlar we matrisalar:** Gauss, Gauss–Žordan, Kramer; kesgitleýji, ters matrisa — `2x + y = 5; x − y = 1`, `[[2, 1], [1, 3]] ters matrisasy`\n' +
      '- **Grafik we derňew:** nollar, ekstremumlar, artýan/kemelýän aralyklar, kesişme nokatlary — `y = x² − 4x + 3 grafigini çyz`\n' +
      '- **Çyzykly programmirleme:** simpleks we bitin sanly — `max Z = 3x1 + 5x2; x1 ≤ 4; 2x2 ≤ 12; 3x1 + 2x2 ≤ 18`\n' +
      '- **Statistika, droblar, IUUB/IUKS, göterim, geometriýa, hereket meseleleri** — `4, 8, 6, 5, 3 medanasy`, `3/4 + 5/6`, `taraplary 3, 4, 5 bolan üçburçlugyň meýdany`\n' +
      '- **Düşündirişler:** simpleks, M-usuly, kölege bahalary, MODI, Vogel, t-test, ýarpylatma usuly we başgalar\n\n' +
      'Suratdan meseläni okamak we erkin söhbet üçin Claude API gerek: saýtyň eýesi ony Sazlamalar → Amatly AI bölüminde birikdirip biler.';
  }
  function tutor() { return env.mode === 'tutor'; }
  function textPlan(md) { return { text: md }; }

  /* ============================================================ niýetler (mesele görnüşleri) */
  var INTENTS = [];
  function intent(name, fn) { INTENTS.push({ name: name, run: fn }); }

  /* --- salamlaşmak, kimdigi, sag bol */
  intent('chat', function (c) {
    var f = c.f.trim();
    if (c.spans.length && !/^(salam|hi|hello)\b/.test(f)) return null;
    if (/^(salam|salaam|salom|hi|hello|hey|gowy gun|ertiriniz haýyrly|agsamynyz)\b/.test(f) && f.length < 60 && !c.spans.length)
      return textPlan('Salam! Men **Amatly AI**. ' + capabilities() + '\n\nMeseläňizi ýazyň — çözüp bereýin.');
    if (/(sen kim|kimsin|sen name|name edip bil|name bilyan|nahili komek|komek edip bil|nameler edip|mumkincilik|name sorap bol|nahili ulanmaly)/.test(f))
      return textPlan('Men **Amatly AI** — Amatly.com saýtynyň matematika kömekçisi. ' + capabilities());
    if (/^(sag bol|sagbol|sag bolun|sagbolun|minnetdar|tagzym|berekella|ajayyp|gowy|oran gowy|thanks|thank you)\b/.test(f) && f.length < 50)
      return textPlan('Hiç zat däl! Başga mesele bar bolsa ýazyň — ädimme-ädim çözüp bererin. Mysal üçin: ' + EX + '.');
    return null;
  });

  /* --- Amal barlagy sahypalarynyň «Amatly AI bilen düşündir» soraglary (netije soragyň içinde) */
  var OR = [
    { re: /wengr|bellemek meselesi/, page: 'amal-barlagy/bellemek.html', name: 'Bellemek meselesi (Wengr usuly)', grab: /(?:optimal bellemek|tapylan[^:]*):\s*([^]*?)(?:\.\s+[A-ZÄÇÖÜŽŇŞÝ]|$)/,
      md: '**Wengr usulynyň ädimleri:**\n1. **Setirleri azaltmak:** her setiriň iň kiçi elementini şol setiriň ähli elementlerinden aýyrýarys — her setirde azyndan bir 0 peýda bolýar.\n2. **Sütünleri azaltmak:** şol işi sütünler üçin edýäris.\n3. **Nollary örtmek:** ähli nollary iň az sanly kese we dik çyzyk bilen örtýäris. Çyzyklaryň sany $n$-e deň bolsa, optimal bellemek nollaryň arasynda bar.\n4. **Matrisany üýtgetmek:** çyzyk az bolsa, örtülmedik elementleriň iň kiçisini ($k$) örtülmedik elementlerden aýyrýarys we iki çyzygyň kesişýän öýjüklerine goşýarys; 3-nji ädime gaýdýarys.\n5. **Bellemek:** her setirde we her sütünde diňe bir 0 saýlap, ýerine ýetirijileri işlere belleýäris.\n\n**Näme üçin optimal?** Setirden ýa-da sütünden hemişelik sany aýyrmak ähli bellemeleriň jemini şol bir sana üýtgedýär — iň oňat bellemäniň özi üýtgemeýär. Ahyrky matrisada ähli elementler $\\ge 0$, saýlanan bellemäniň bahasy bolsa $0$: ondan kiçi baha bolup bilmeýär. Diýmek, ol başdaky mesele üçin hem optimal. Iň köp girdeji meselesi ilki «iň uly element − element» öwrülmesi bilen iň az çykdajy meselesine getirilýär.' },
    { re: /ikilenji simpleks/, page: 'amal-barlagy/ikilenji-simpleks.html', name: 'Ikilenji simpleks usuly', grab: /Jogap:\s*([^]*?)(?:\.\s+[A-ZÄÇÖÜŽŇŞÝ]|$)/,
      md: '**Ikilenji simpleks usuly** sag tarapynda otrisatel sanlar bolan, ýöne optimallyk şerti (Z-setiri) eýýäm ýerine ýetýän tablisadan başlaýar — adatça ≥ çäklendirmeli min meselelerinde emeli üýtgeýänsiz.\n1. **Çykýan setir:** sag tarapy iň uly otrisatel ($b_i < 0$) bolan setir saýlanýar. Ähli $b_i \\ge 0$ bolsa — çözgüt mümkin we optimal.\n2. **Giriji sütün:** şol setirdäki otrisatel elementler ($a_{ij} < 0$) üçin $\\left|\\frac{\\Delta_j}{a_{ij}}\\right|$ gatnaşygy hasaplanýar we iň kiçisi saýlanýar — bu Z-setiriniň optimallygyny saklaýar. Setirde otrisatel element ýok bolsa — meseläniň mümkin çözgüdi ýok.\n3. **Žordanyň öwrülmesi:** çözüji element 1-e, sütüniň galan elementleri 0-a öwrülýär; 1-nji ädime gaýdylýar.\n\nAdaty simpleks mümkinligi saklap optimallyga ýöreýär, ikilenji simpleks bolsa optimallygy saklap mümkinlige ýöreýär. Täze çäklendirme goşulanda (mysal üçin, bitin sanly meselelerde) hem amatly.' },
    { re: /matrisa oyny|eyer nokady|garysyk strateg/, page: 'amal-barlagy/oyunlar-nazaryyeti.html', name: 'Oýunlar nazaryýeti', grab: /Tapylan çözgüt:\s*([^]*?)(?:\.\s+[A-ZÄÇÖÜŽŇŞÝ]|$)/,
      md: '**Matrisa oýnuny çözmegiň tertibi:**\n1. **Eýer nokady:** her setiriň minimumyndan iň ulusy (aşaky baha $\\alpha$) we her sütüniň maksimumyndan iň kiçisi (ýokarky baha $\\beta$) tapylýar. $\\alpha = \\beta$ bolsa, oýnuň arassa strategiýalarda çözgüdi bar, $v = \\alpha = \\beta$.\n2. **Agdyklyk:** başga strategiýadan hemişe erbet bolan setirler (A üçin) we sütünler (B üçin) aýrylýar — matrisa kiçelýär.\n3. **Garyşyk strategiýalar:** eýer nokady ýok bolsa, oýunçylar strategiýalaryny ähtimallyklar bilen saýlaýar. 2×2 oýunda formulalar bilen, uly oýunlarda çyzykly programmirleme (simpleks) bilen çözülýär: A özüniň kepillendirilen utuşyny $v$ iň uly edýär, B bolsa A-nyň utuşyny iň kiçi edýär.\n\n**Netijäniň manysy:** $p^*$ bilen A garşydaşy näme etse-de ortaça azyndan $v$ utýar; $q^*$ bilen B ortaça $v$-den köp utdurmaýar (minimaks teoremasy).' },
    { re: /sahalar we aracak|bitin sanly programmirleme meselesi/, page: 'amal-barlagy/bitin-sanly.html', name: 'Bitin sanly programmirleme', grab: /(?:tapylan jogap|Jogap):\s*([^]*?)(?:\.\s+[A-ZÄÇÖÜŽŇŞÝ]|$)/,
      md: '**Şahalar we araçäkler usuly:**\n1. Bitinlik şertini aýryp, **gowşadylan** çyzykly meseläni simpleks bilen çözýäris. Jogap bitin bolsa — taýýar.\n2. **Şahalandyrmak:** bitin däl üýtgeýän $x_j = b$ saýlanýar we iki täze mesele gurulýar: $x_j \\le \\lfloor b \\rfloor$ we $x_j \\ge \\lceil b \\rceil$.\n3. **Araçäk:** her düwüniň gowşadylan optimumy şol şahadaky bitin çözgütleriň iň oňat bolup biläýjek bahasy.\n4. **Kesmek düzgünleri:** şaha (a) mümkin çözgüdi ýok bolsa, (b) araçägi tapylan iň oňat bitin çözgütden (rekorddan) gowy bolmasa, (c) bitin çözgüt berse (rekord täzelenýär) — dowam etdirilmeýär.\n5. Açyk düwün galmasa, rekord optimal bitin çözgütdir.\n\nGowşadylan meseläniň optimumy bitin optimumdan hemişe gowy ýa-da deň — şol tapawut bitinlik şertiniň «bahasydyr».' },
    { re: /deykstra|bellman|floyd|in gysga yol/, page: 'amal-barlagy/in-gysga-yol.html', name: 'Iň gysga ýol', grab: /(iň gysga ýol[^]*?)(?:\.\s+[A-ZÄÇÖÜŽŇŞÝ]|$)/,
      md: '**Deýkstranyň usuly** (gyralaryň agramy otrisatel däl):\n1. Başlangyç depäniň aralygy $0$, galanlaryňky $\\infty$; ähli depeler «wagtlaýyn».\n2. Wagtlaýyn depeleriň iň kiçi aralyklysy saýlanýar we «hemişelik» edilýär — oňa çenli has gysga ýol bolup bilmeýär, sebäbi beýleki ýollar diňe uzalyp biler.\n3. Onuň goňşulary üçin aralyk täzelenýär: $d(v) = \\min(d(v),\\ d(u) + w(u, v))$ we «öňki depe» ýatda saklanýar.\n4. Ähli depeler hemişelik bolýança 2–3 gaýtalanýar; ýol «öňki depeler» boýunça yzyna dikeldilýär.\n\n**Bellman–Ford** otrisatel agramly gyralarda ulanylýar: ähli gyralar $n - 1$ gezek gowşadylýar; ýene gowşatmak mümkin bolsa, grafda otrisatel aýlaw bar. **Floýd–Uorşell** ähli depe jübütleriniň aralygyny bir wagtda tapýar.' },
    { re: /\bcpm\b|\bpert\b|kritiki yol|tor meyilnama/, page: 'amal-barlagy/cpm-pert.html', name: 'Tor meýilnamasy (CPM/PERT)', grab: /Hasaplama:\s*([^]*?)(?:\.\s+[A-ZÄÇÖÜŽŇŞÝ]|$)/,
      md: '**Kritiki ýol usuly (CPM):**\n1. **Göni ýöriş:** her işiň iň ir başlanýan ($ES$) we gutarýan ($EF = ES + t$) wagty; işiň $ES$-i öňki işleriň $EF$-leriniň iň ulusy. Taslamanyň möhleti $T$ — iň uly $EF$.\n2. **Yza ýöriş:** iň giç gutarýan ($LF$) we başlanýan ($LS = LF - t$) wagtlar; $LF$ — indiki işleriň $LS$-leriniň iň kiçisi.\n3. **Ätiýaç:** $TF = LS - ES$. Ätiýajy $0$ bolan işler **kritiki**: olaryň islendigi gijikse, tutuş taslama gijigýär. Kritiki işleriň zynjyry — kritiki ýol (iň uzyn ýol).\n\n**Näme etmeli:** möhleti gysgaltmak üçin serişdeleri kritiki işlere beriň; ätiýajy bar işleri ätiýajyň çäginde süýşürip bolýar. **PERT** her iş üçin üç baha ($a$, $m$, $b$) ulanýar: $t = \\frac{a + 4m + b}{6}$, $\\sigma^2 = \\left(\\frac{b - a}{6}\\right)^2$ — möhletiň ähtimallygy normal paýlanyş bilen hasaplanýar.' }
  ];
  intent('or-explain', function (c) {
    if (!/(dusundir|dusunduri|ädim|adim|cozuldi|tapylan|jogap:|hasaplama:)/.test(c.f)) return null;
    for (var i = 0; i < OR.length; i++) {
      var o = OR[i];
      if (!o.re.test(c.f)) continue;
      if (o.page === 'amal-barlagy/bitin-sanly.html' && !/tapylan|jogap/.test(c.f)) return null;
      var g = o.grab.exec(c.text), res = g ? g[1].replace(/\s+/g, ' ').replace(/[*_|$`]/g, function (ch) { return { '*': '∗', '_': ' ', '|': '∣', '$': '＄', '`': "'" }[ch]; }).trim() : '';
      return textPlan((res ? '**Saýtyň motory tapan netije:** ' + res + '.\n\n' : '') + o.md + '\n\n' + link(o.name + ' — saýtda ädimme-ädim', o.page));
    }
    return null;
  });

  /* --- çyzykly programmirleme → solve_lp */
  intent('lp', function (c) {
    var hasSense = /(^|[^a-z])(max|maks|maksimum\w*|maksimal\w*|min|minimum\w*|minimal\w*)([^a-z]|$)/.test(c.f) || /in uly baha|in kici baha/.test(c.f);
    if (!hasSense || !/[<>]=?|=/.test(c.n)) return null;
    var pieces = [];
    c.n.split(/\n|;/).forEach(function (p) {
      var parts = p.split(/,\s+/), acc = '';
      parts.forEach(function (x) {
        if (acc && /<=|>=|[<>]|=/.test(acc) && /<=|>=|[<>]|=/.test(x)) { pieces.push(acc); acc = x; } else acc = acc ? acc + ', ' + x : x;
      });
      if (acc) pieces.push(acc);
    });
    var obj = null, sense = null, cons = [];
    pieces.forEach(function (p) {
      var fp = fold(p), sp = spans(p);
      var se = /(max|maks|maksimum|maksimal|in uly)/.test(fp) ? 'max' : /(min|minimum|minimal|in kici)/.test(fp) ? 'min' : null;
      if (se && !obj) {
        var e = sp.filter(function (x) { return /[a-zA-Z]\d|[xyz]/.test(x) && !/<|>/.test(x); })[0];
        if (e) { obj = e.replace(/->\s*$/, '').trim(); sense = se; return; }
      }
      sp.forEach(function (x) { if (/<=|>=|<|>|=/.test(x) && /[a-zA-Z]/.test(x) && !/->/.test(x)) cons.push(x); });
    });
    if (!obj || !cons.length) return null;
    if (!/^[A-Za-z]\w*\s*=/.test(obj)) obj = 'Z = ' + obj;
    cons = cons.filter(function (x) { return !/^[A-Za-z]\w*\s*=(?!=)/.test(x) || /[<>]/.test(x) || /[-+*\/]/.test(x.split('=')[0]); });
    var problem = sense + ' ' + obj + '\n' + cons.join('\n');
    var integer = /bitin/.test(c.f);
    return need('simplex').then(function (S) {
      var p;
      try { p = S.parseText(problem); } catch (e) {
        return textPlan('Çyzykly programmirleme meselesini okap bolmady: ' + (e.message || e) + '\n\nMeseläni şeýle ýazyň (her setirde bir şert):\n```\nmax Z = 3x1 + 5x2\nx1 <= 4\n2x2 <= 12\n3x1 + 2x2 <= 18\n```\n' + link('Simpleks kalkulýatory', 'amal-barlagy/simpleks.html'));
      }
      var vars = p.vars.join(', ');
      return {
        text: tutor()
          ? 'Ilki modeli özüňiz düzüp görüň: üýtgeýänler (' + vars + '), maksat funksiýasy we çäklendirmeler. Simpleks usulynda başlangyç bazis goşmaça üýtgeýänlerden düzülýär; giriji sütün Z-setirindäki iň uly otrisatel koeffisiýent boýunça, çykýan setir iň kiçi $b_i / a_{ij}$ gatnaşygy boýunça saýlanýar. Motoryň takyk çözgüdi aşakdaky kartda — öz jogabyňyz bilen deňeşdirmek üçin açyň.'
          : 'Meseläni saýtyň takyk droblar bilen işleýän ' + (integer ? 'simpleks we şahalar-araçäkler' : 'simpleks') + ' motory bilen çözýärin. Model (' + p.vars.length + ' üýtgeýän, ' + p.cons.length + ' çäklendirme, ähli üýtgeýänler $\\ge 0$) kartada görkezilýär.',
        tools: [{ name: 'solve_lp', input: { problem: problem, integer: integer } }],
        after: function (items) {
          var r = items[0] && items[0].data;
          if (!r) return 'Simpleks motory jogap bermedi' + (items[0] && items[0].error ? ': ' + items[0].error : '.');
          if (r.status !== 'optimal') return ({ infeasible: '**Netije:** meseläniň mümkin çözgüdi ýok — çäklendirmeler bir wagtda ýerine ýetip bilmeýär. Şertleri (aýratyn-da ≥ we = çäklendirmeleri) barlaň.', unbounded: '**Netije:** maksat funksiýasy çäklendirilmedik — ' + (r.sense === 'max' ? 'Z-i islendik uly' : 'Z-i islendik kiçi') + ' edip bolýar, optimal çözgüt ýok. Köplenç bir çäklendirme ýatdan çykandyr.' }[r.status] || '**Netije:** ' + r.status);
          if (tutor()) return 'Motor meseläni çözdi we ähli çäklendirmeleri barlady. Öz jogabyňyzy tapanyňyzdan soň kartany açyp deňeşdiriň.';
          var vals = r.variables.map(function (v) { return v.replace(/^([a-z]+)(\d+)$/i, '$1_{$2}') + ' = ' + fT(F(r.solution[v])); }).join(',\\ ');
          var tight = (r.check || []).filter(function (k) { return k.tight; }).map(function (k) { return k.index; });
          var out = '**Jogap:** $' + r.objective + '_{\\' + (r.sense === 'max' ? 'max' : 'min') + '} = ' + fT(F(r.value)) + '$' + (String(r.value).indexOf('/') >= 0 ? ' $\\approx ' + dec(r.value_decimal) + '$' : '') + ' bolanda $' + vals + '$ ' + (r.all_satisfied ? '✓' : '') + '\n\n';
          out += '- Motor tapylan çözgüdi ähli çäklendirmelere goýup barlady' + (tight.length ? '; doly ulanylýan (işjeň) çäklendirmeler: ' + tight.join(', ') : '') + '.\n';
          if (r.shadow_prices) {
            var sp = Object.keys(r.shadow_prices).map(function (k) { return k.replace(/^y(\d+)$/, 'y_{$1}') + ' = ' + fT(F(r.shadow_prices[k])); });
            var best = Object.keys(r.shadow_prices).filter(function (k) { return F(r.shadow_prices[k]).compare(0) !== 0; })[0];
            out += '- **Kölege bahalary:** $' + sp.join(',\\ ') + '$' + (best ? ' — mysal üçin, ' + best.slice(1) + '-nji çäklendirmäniň sag tarapy 1 birlik artsa, $' + r.objective + '$ takmynan $' + fT(F(r.shadow_prices[best])) + '$ üýtgär.' : '.') + '\n';
          }
          if (r.integer && r.lp_relaxation_value) out += '- Bitinlik şertsiz (gowşadylan) meseläniň optimumy $' + fT(F(r.lp_relaxation_value)) + '$; şahalar we araçäkler agajynda ' + r.nodes + ' düwün barlandy.\n';
          if (r.alternative_optimum) out += '- Alternatiw optimal çözgütler hem bar (Z şol bir bahany başga nokatlarda hem alýar).\n';
          out += '\nSimpleks tablisalaryny ädimme-ädim görmek üçin kartadaky salgyny açyň.';
          return out;
        }
      };
    });
  });

  /* --- çyzykly deňlemeler ulgamy (Gauss, Gauss–Žordan, Kramer) */
  function matTeX(Mx, n, L, opts) {
    opts = opts || {};
    var cols = Mx[0].length, aug = !opts.noAug && cols > n;
    var spec = new Array(n + 1).join('r') + (aug ? '|' + new Array(cols - n + 1).join('r') : '');
    return '\\left(\\begin{array}{' + spec + '}' + Mx.map(function (r) { return r.map(function (x) { return fT(x); }).join(' & '); }).join(' \\\\ ') + '\\end{array}\\right)';
  }
  function eqRowTeX(row, b, vars) {
    var s = '';
    row.forEach(function (a, j) {
      if (a.equals(0)) return;
      var neg = a.compare(0) < 0, ab = a.abs(), v = vars[j].replace(/^([a-z])(\d+)$/i, '$1_{$2}');
      var term = (ab.equals(1) ? '' : fT(ab)) + v;
      s += s ? (neg ? ' - ' : ' + ') + term : (neg ? '-' : '') + term;
    });
    return (s || '0') + ' = ' + fT(b);
  }
  intent('system', function (c) {
    var eqs = c.spans.filter(function (s) { var k = splitCmp(s); return k && k.op === '=' && varsOf(k.nl).concat(varsOf(k.nr)).length; });
    if (eqs.length < 2) return null;
    var defs = eqs.filter(asDef);
    if (defs.length === eqs.length && /(grafik|cyz|kesisme)/.test(c.f)) return null;
    var all = {};
    eqs.forEach(function (s) { var k = splitCmp(s); varsOf(k.nl).concat(varsOf(k.nr)).forEach(function (v) { all[v] = 1; }); });
    if (Object.keys(all).length < 2) return null;
    return need('linsys').then(function (L) {
      var sys;
      try { sys = L.parseEquations(eqs.join('\n')); } catch (e) { return /ulgam/.test(c.f) ? textPlan('Ulgamy okap bolmady: ' + e.message + '\n\n' + link('n×n ulgam kalkulýatory', 'algebra/index.html#nxn-ulgam')) : null; }
      var method = /kramer|cramer/.test(c.f) ? 'cramer' : /zordan|jordan/.test(c.f) ? 'jordan' : 'gauss';
      var r = L.solve(sys, { method: method });
      var n = sys.vars.length, vars = sys.vars, lines = [];
      var vt = function (v) { return v.replace(/^([a-z])(\d+)$/i, '$1_{$2}'); };
      lines.push('**Ulgam:** $$\\begin{cases} ' + sys.A.map(function (row, i) { return eqRowTeX(row, sys.b[i], vars); }).join(' \\\\ ') + ' \\end{cases}$$');
      if (tutor()) {
        var t = method === 'cramer' ? 'Ilki esasy kesgitleýjini $\\Delta$ hasaplaň; $\\Delta \\ne 0$ bolsa, her näbelli $x_i = \\frac{\\Delta_i}{\\Delta}$, bu ýerde $\\Delta_i$-de $i$-nji sütün azat agzalar bilen çalşylýar.'
          : 'Giňeldilen matrisany ýazyň we birinji setiriň kömegi bilen aşakdaky setirlerden $' + vt(vars[0]) + '$-i aýyryň (setirleri sana köpeldip goşmak). Soň ikinji näbellä geçiň. Üçburç görnüş alnanda, yza ýöriş bilen näbellileri aşakdan ýokary tapyň.';
        if (r.steps && r.steps[1]) t += '\n\nBirinji ädim: ' + r.steps[1].ops.join('; ') + '.';
        return textPlan(lines.join('\n\n') + '\n\n**Maslahat:** ' + t + '\n\nDoly çözgüdi görmek üçin «Düşündir» režimine geçip, soragy täzeden iberiň.');
      }
      if (r.reason) lines.push('_' + r.reason + '_');
      if (method === 'cramer' && r.det && r.dets) {
        lines.push('**Kramer usuly.** Esasy kesgitleýji: $$\\Delta = ' + matTeX(sys.A, n, L, { noAug: true }).replace('\\left(', '\\left|').replace('\\right)', '\\right|') + ' = ' + r.det.text.replace(/·/g, '\\cdot ').replace(/−/g, '-') + '$$');
        lines.push('$\\Delta \\ne 0$, şonuň üçin ulgamyň ýeke-täk çözgüdi bar. $\\Delta_i$ kesgitleýjide $i$-nji sütün azat agzalar bilen çalşylýar:');
        r.dets.forEach(function (d) { lines.push('$$\\Delta_{' + (d.j + 1) + '} = ' + matTeX(d.A, n, L, { noAug: true }).replace('\\left(', '\\left|').replace('\\right)', '\\right|') + ' = ' + d.text.replace(/·/g, '\\cdot ').replace(/−/g, '-') + '$$'); });
        lines.push('$$' + vars.map(function (v, j) { return vt(v) + ' = \\frac{\\Delta_{' + (j + 1) + '}}{\\Delta} = ' + fT(r.x[j]); }).join(',\\qquad ') + '$$');
      }
      if (r.steps) {
        lines.push('**' + (method === 'cramer' ? 'Gauss usuly bilen derňew' : method === 'jordan' ? 'Gauss–Žordan usuly' : 'Gauss usuly: göni ýöriş') + '**');
        r.steps.forEach(function (s, k) {
          lines.push((k === 0 ? s.title + ':' : '**' + s.title + '**' + (s.ops && s.ops.length ? ' — ' + s.ops.join('; ') : '')) + '\n$$' + matTeX(s.M, n, L) + '$$');
        });
      }
      if (r.back && method === 'gauss') {
        lines.push('**Yza ýöriş** (aşakdan ýokary):');
        lines.push(r.back.map(function (b) {
          var row = r.echelon[r.pivots.filter(function (p) { return p.col === b.col; })[0].row];
          return '- $' + eqRowTeX(row.slice(0, n), row[n], vars) + ' \\;\\Rightarrow\\; ' + vt(vars[b.col]) + ' = ' + fT(b.x) + '$';
        }).join('\n'));
      }
      var plan = { text: '' };
      if (r.status === 'unique') {
        lines.push('✓ Ulgamyň **ýeke-täk çözgüdi** bar: rang $A$ = rang $(A|b)$ = ' + n + ' (Kroneker–Kapelli teoremasy).');
        lines.push('**Jogap:** $' + vars.map(function (v, j) { return vt(v) + ' = ' + fT(r.x[j]); }).join(',\\ ') + '$');
        if (r.check) lines.push('**Barlag** (bahalary deňlemelere goýýarys): ' + r.check.map(function (k) { return (k.i + 1) + '-nji: $' + fT(k.lhs) + ' = ' + fT(k.rhs) + '$ ' + (k.ok ? '✓' : '✗'); }).join('; '));
        if (n === 2 && sys.A.length === 2 && sys.A.every(function (row) { return !row[1].equals(0); })) {
          var fns = sys.A.map(function (row, i) {
            var e = '(' + sys.b[i].toFraction() + ' - (' + row[0].toFraction() + ')*x) / (' + row[1].toFraction() + ')';
            return { expr: e, label: eqRowTeX(row, sys.b[i], vars).replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2').replace(/[{}\\]/g, '').replace(/_/g, '') };
          });
          var x0 = r.x[0].valueOf(), y0 = r.x[1].valueOf();
          plan.tools = [{ name: 'plot_graph', input: { title: 'Ulgamyň grafiki çözgüdi', functions: fns, x_min: Math.floor(x0 - 5), x_max: Math.ceil(x0 + 5), points: [{ x: x0, y: y0, label: '(' + iTxt(x0) + '; ' + iTxt(y0) + ')' }] } }];
          plan.after = function (items) {
            var d = items[0] && items[0].data, ok = d && d.intersections && d.intersections[0] && d.intersections[0].points.some(function (p) { return Math.abs(p.x - x0) < 1e-3 && Math.abs(p.y - y0) < 1e-3; });
            return ok ? 'Grafiki barlag: iki göni çyzyk $(' + fT(r.x[0]) + ';\\ ' + fT(r.x[1]) + ')$ nokatda kesişýär — bu ulgamyň çözgüdi ✓\n\n' + link('n×n ulgam kalkulýatory', 'algebra/index.html#nxn-ulgam') : 'Göni çyzyklaryň grafigi çyzyldy.';
          };
        }
      } else if (r.status === 'infinite' && r.general) {
        var g = r.general, pn = ['t', 's', 'r', 'p', 'q'];
        var ex = function (e) {
          var s = e.c.equals(0) ? '' : fT(e.c);
          e.d.forEach(function (d, k) { if (d.equals(0)) return; var neg = d.compare(0) < 0, ab = d.abs(); s += (s ? (neg ? ' - ' : ' + ') : (neg ? '-' : '')) + (ab.equals(1) ? '' : fT(ab)) + pn[k]; });
          return s || '0';
        };
        lines.push('∞ Ulgamyň **tükeniksiz köp çözgüdi** bar: rang $A$ = rang $(A|b)$ = ' + r.rankA + ' < ' + n + ' — ' + (n - r.rankA) + ' näbelli erkin.');
        lines.push('**Umumy çözgüt:** $' + g.free.map(function (j, k) { return vt(vars[j]) + ' = ' + pn[k]; }).join(',\\ ') + '$ (erkin), $' + vars.map(function (v, j) { return g.expr[j].free ? '' : vt(v) + ' = ' + ex(g.expr[j]); }).filter(Boolean).join(',\\ ') + '$, $' + g.free.map(function (_, k) { return pn[k]; }).join(', ') + ' \\in \\mathbb{R}$');
      } else if (r.status === 'none') {
        lines.push('✗ Ulgamyň **çözgüdi ýok** (ylalaşyksyz ulgam): rang $A$ = ' + r.rankA + ' < rang $(A|b)$ = ' + r.rankAb + ' — soňky tablisada $0 = ' + fT(r.echelon[r.bad][n]) + '$ ýaly mümkin däl deňlik alyndy.');
      }
      if (!plan.tools) lines.push(link('n×n ulgam kalkulýatory — Gauss, Gauss–Žordan, Kramer', 'algebra/index.html#nxn-ulgam'));
      plan.text = lines.join('\n\n');
      return plan;
    });
  });

  /* --- matrisalar */
  function matrices(n) {
    var out = [], i = 0;
    while ((i = n.indexOf('[', i)) >= 0) {
      var depth = 0, k = i;
      for (; k < n.length; k++) { if (n[k] === '[') depth++; else if (n[k] === ']') { depth--; if (!depth) break; } }
      if (depth) break;
      var src = n.slice(i, k + 1);
      if (/^[\[\]\d\s,;.\-+\/]+$/.test(src)) {
        try {
          var v = M().evaluate(src), arr = v && v.toArray ? v.toArray() : v;
          if (Array.isArray(arr) && Array.isArray(arr[0]) && arr.every(function (r) { return Array.isArray(r) && r.length === arr[0].length && r.every(function (x) { return typeof x === 'number' && isFinite(x); }); })) {
            var nm = /([A-Z])\s*=\s*$/.exec(n.slice(Math.max(0, i - 6), i));
            out.push({ name: nm ? nm[1] : null, A: arr.map(function (r) { return r.map(toFrac); }) });
          }
        } catch (e) { /* matrisa däl */ }
      }
      i = k + 1;
    }
    return out.filter(function (m) { return m.A.every(function (r) { return r.every(Boolean); }); });
  }
  function pmat(A) { return '\\begin{pmatrix} ' + A.map(function (r) { return r.map(fT).join(' & '); }).join(' \\\\ ') + ' \\end{pmatrix}'; }
  function rrefF(A) {
    var R = A.map(function (r) { return r.slice(); }), m = R.length, n = R[0].length, row = 0, piv = [];
    for (var col = 0; col < n && row < m; col++) {
      var p = -1;
      for (var i = row; i < m; i++) if (!R[i][col].equals(0)) { p = i; break; }
      if (p < 0) continue;
      var t = R[p]; R[p] = R[row]; R[row] = t;
      var pv = R[row][col];
      R[row] = R[row].map(function (x) { return x.div(pv); });
      for (i = 0; i < m; i++) if (i !== row && !R[i][col].equals(0)) { var f = R[i][col]; R[i] = R[i].map(function (x, j) { return x.sub(f.mul(R[row][j])); }); }
      piv.push(col); row++;
    }
    return { R: R, rank: piv.length };
  }
  function mul(A, B) { return A.map(function (r) { return B[0].map(function (_, j) { return r.reduce(function (s, x, k) { return s.add(x.mul(B[k][j])); }, F(0)); }); }); }
  intent('matrix', function (c) {
    var ms = matrices(c.n);
    if (!ms.length) return null;
    var f = c.f;
    return need('linsys').then(function (L) {
      var A = ms[0].A, nA = ms[0].name || 'A', lines = [], sq = A.length === A[0].length;
      lines.push('$$' + nA + ' = ' + pmat(A) + '$$');
      var want = {
        det: /kesgitleyji|determinant|\bdet\b/.test(f), inv: /ters|obrat|inverse|\^\s*\(\s*-\s*1\s*\)|\^-1/.test(f + ' ' + c.n), tr: /transpon/.test(f),
        rank: /\brang/.test(f), prod: ms.length > 1 && /(kopelt|hasyl|\*)/.test(f + c.n), sum: ms.length > 1 && /(gos|jem|\+)/.test(f + c.n), eig: /hasiyetli|eigen|hususy san/.test(f)
      };
      if (!Object.keys(want).some(function (k) { return want[k]; })) { want.det = sq; want.inv = sq; want.rank = !sq; }
      if (want.prod) {
        var B = ms[1].A, nB = ms[1].name || 'B';
        if (A[0].length !== B.length) lines.push('$' + nA + '$ matrisanyň sütün sany (' + A[0].length + ') $' + nB + '$ matrisanyň setir sanyna (' + B.length + ') deň däl — köpeltmek kesgitlenmedik.');
        else lines.push('**Köpeltmek hasyly:** $(' + nA + nB + ')_{ij}$ — $' + nA + '$-nyň $i$-nji setiri bilen $' + nB + '$-niň $j$-nji sütüniniň skalýar köpeltmek hasyly: $$' + nA + '\\cdot ' + nB + ' = ' + pmat(A) + pmat(B) + ' = ' + pmat(mul(A, B)) + '$$');
      }
      if (want.sum) {
        var B2 = ms[1].A, nB2 = ms[1].name || 'B';
        if (A.length !== B2.length || A[0].length !== B2[0].length) lines.push('Matrisalaryň ölçegleri deň däl — goşmak kesgitlenmedik.');
        else lines.push('**Jemi:** $$' + nA + ' + ' + nB2 + ' = ' + pmat(A.map(function (r, i) { return r.map(function (x, j) { return x.add(B2[i][j]); }); })) + '$$');
      }
      var D = null;
      if ((want.det || want.inv) && sq) {
        var de = L.detExplain(A);
        D = de.value;
        lines.push('**Kesgitleýji**' + (A.length === 2 ? ' ($ad - bc$)' : de.rule === 'sarrus' ? ' (Sarrus düzgüni)' : ' (Gauss usuly bilen üçburç görnüşe getirip)') + ': $$\\det ' + nA + ' = ' + de.text.replace(/·/g, '\\cdot ').replace(/−/g, '-') + '$$');
      }
      if (want.inv && sq) {
        if (D.equals(0)) lines.push('$\\det ' + nA + ' = 0$ — matrisa **aýratyn** (ters matrisasy ýok).');
        else {
          var n = A.length, Aug = A.map(function (r, i) { return r.concat(A.map(function (_, j) { return F(i === j ? 1 : 0); })); });
          var inv = rrefF(Aug).R.map(function (r) { return r.slice(n); });
          if (n === 2) lines.push('**Ters matrisa** ($2\\times 2$ üçin $A^{-1} = \\frac{1}{ad - bc}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}$): $$' + nA + '^{-1} = \\frac{1}{' + fT(D) + '}' + pmat([[A[1][1], A[0][1].neg()], [A[1][0].neg(), A[0][0]]]) + ' = ' + pmat(inv) + '$$');
          else lines.push('**Ters matrisa** (Gauss–Žordan usuly: $(' + nA + ' \\mid E) \\to (E \\mid ' + nA + '^{-1})$): $$' + nA + '^{-1} = ' + pmat(inv) + '$$');
          var E = mul(A, inv), ok = E.every(function (r, i) { return r.every(function (x, j) { return x.equals(i === j ? 1 : 0); }); });
          lines.push('**Barlag:** $' + nA + '\\cdot ' + nA + '^{-1} = E$ ' + (ok ? '✓' : '✗'));
        }
      }
      if (want.tr) lines.push('**Transponirlenen matrisa** (setirler sütün bolýar): $$' + nA + '^{T} = ' + pmat(A[0].map(function (_, j) { return A.map(function (r) { return r[j]; }); })) + '$$');
      if (want.rank) lines.push('**Rang:** basgançakly görnüşdäki nol däl setirleriň sany — $\\operatorname{rang} ' + nA + ' = ' + rrefF(A).rank + '$.');
      if (want.eig && sq) {
        try {
          var ev = M().eigs(A.map(function (r) { return r.map(function (x) { return x.valueOf(); }); })).values;
          ev = (ev.toArray ? ev.toArray() : ev).map(realOf);
          lines.push('**Häsiýetli sanlar** ($\\det(' + nA + ' - \\lambda E) = 0$): $' + ev.map(function (v, i) { return '\\lambda_{' + (i + 1) + '} ' + eqT(v); }).join(',\\ ') + '$');
        } catch (e) { lines.push('Häsiýetli sanlary hasaplap bolmady.'); }
      }
      lines.push(link('Matrisa kalkulýatory', 'matrisa/index.html'));
      return textPlan(lines.join('\n\n'));
    });
  });

  /* --- limit → solve_steps */
  var PT = '([-+]?\\s*(?:inf|infinity|\\d+(?:\\.\\d+)?(?:\\s*\\/\\s*\\d+)?|\\d*\\s*\\*?\\s*pi(?:\\s*\\/\\s*\\d+)?|e))';
  function limitPlan(expr, point, v, title) {
    var node = P(expr);
    if (!node) return null;
    var vs = varsOf(node);
    if (vs.length > 1) return null;
    if (vs.length === 1 && vs[0] !== 'x') node = rename(node, vs[0], 'x');
    var e = node.toString(), pt = point.replace(/\s+/g, '').replace(/^\+/, '').replace(/^infinity$/, 'inf');
    var ptTex = /inf/.test(pt) ? (pt[0] === '-' ? '-\\infty' : '+\\infty') : texOf(pt);
    var limTex = '\\lim_{x \\to ' + ptTex + '} ' + texOf(node);
    var plan = {
      text: tutor()
        ? 'Ilki özüňiz synanyşyň: $' + limTex + '$. Nokady goýup görüň — san alynsa, ol jogap. $\\frac{0}{0}$ ýa-da $\\frac{\\infty}{\\infty}$ kesgitsizlik bolsa: köpeldijilere dagytmak, aýratyn limitler ($\\frac{\\sin x}{x} \\to 1$) ýa-da Lopitalyň düzgüni kömek eder. Motoryň çözgüdi aşakdaky kartda.'
        : 'Limiti saýtyň ädimme-ädim motory bilen hasaplaýaryn: $$' + limTex + '$$',
      tools: [{ name: 'solve_steps', input: { task: 'limit', expression: e, point: pt } }]
    };
    var a = /inf/.test(pt) ? null : realOf(P(pt.replace(/\bpi\b/, 'pi')) && P(pt).compile().evaluate());
    if (a !== null && isFinite(a) && !tutor()) {
      var f = fxOf(node), L1 = f(a - 1e-3), L2 = f(a + 1e-3), L3 = f(a - 1e-4), L4 = f(a + 1e-4);
      var Lv = [L1, L2, L3, L4].every(isFinite) && Math.abs(L3 - L4) < 1e-3 * Math.max(1, Math.abs(L3)) && Math.abs(L1 - L3) < 1e-2 * Math.max(1, Math.abs(L3)) ? (L3 + L4) / 2 : null;
      if (Lv !== null && Math.abs(Lv) < 1e6) { var lv = +Lv.toFixed(4); plan.tools.push({ name: 'plot_graph', input: { title: 'x → ' + iTxt(a) + ' bolanda f(x) → ' + decU(lv), functions: [{ expr: e, label: 'f(x) = ' + plain(node) }], x_min: a - 4, x_max: a + 4, points: [{ x: a, y: lv, label: 'limit ≈ ' + decU(lv) }] } }); }
    }
    plan.after = function (items) {
      var r = items[0] && items[0].data;
      if (!r) return 'Motor limit hasaplamady' + (items[0] && items[0].error ? ': ' + items[0].error : '.');
      if (!r.ok) return 'Motor bu limit üçin usul tapmady' + (r.error ? ': ' + r.error : '') + '. ' + link('Limitler sapagy', 'kalkulus/kalkulus-limitler.html');
      if (tutor()) return 'Motoryň jogaby we ädimleri kartada. Öz çözgüdiňizi tapanyňyzdan soň deňeşdiriň.';
      var ans = String(r.answer_exact || r.answer || '').trim();
      return '**Jogap:** $' + limTex + ' ' + ansTeX(ans) + '$' + (/^ok/.test(r.check) ? ' ✓' : '') + '\n\n' +
        (r.check ? '- ' + r.check.replace(/^(ok|warn|none):\s*/, '') + '\n' : '') + (items[1] ? '- Grafikde $x$ nokada ýakynlaşanda funksiýanyň bahalary şol sana ýakynlaşýar (nokadyň özünde funksiýa kesgitlenmedik bolup biler).\n' : '') +
        '\n' + link('Limitler sapagy', 'kalkulus/kalkulus-limitler.html');
    };
    return plan;
  }
  intent('limit', function (c) {
    var n = c.n, m = new RegExp('lim\\s*_?\\s*\\{?\\s*\\(?\\s*([a-z])\\s*->\\s*' + PT + '\\s*([+-](?![\\d(a-z]))?\\s*\\)?\\s*\\}?', 'i').exec(n);
    var v, point, rest;
    if (m) { v = m[1]; point = m[2]; rest = n.slice(m.index + m[0].length); }
    else {
      if (!/limit/.test(c.f)) return null;
      var m2 = new RegExp('\\b([a-z])\\s*->\\s*' + PT, 'i').exec(n) || new RegExp('\\b([a-z])\\s+' + PT + '\\s*-?\\s*(?:a|e|ä|ga|ge|ka|ke)?\\s+ymtyl', 'i').exec(n);
      if (!m2) return null;
      v = m2[1]; point = m2[2]; rest = n.slice(0, m2.index) + ' ' + n.slice(m2.index + m2[0].length);
    }
    var cand = spans(rest.replace(/\blim\b/g, ' ')).filter(function (s) { return s.indexOf(v) >= 0 && !/->/.test(s); });
    if (!cand.length) return null;
    var e = cand[0].replace(/^[a-z]\s*\(\s*[a-z]\s*\)\s*=\s*/, '');
    return limitPlan(e, point, v);
  });

  /* --- integral → solve_steps (+ kesgitli integralda grafik) */
  function boundNum(s) { var n = P(String(s).replace(/π/g, 'pi')); var v = n ? realOf(n.compile().evaluate()) : NaN; return isFinite(v) ? v : NaN; }
  intent('integral', function (c) {
    var raw = c.text, lo = null, hi = null, m;
    var B = '(-?\\s*[\\dπ.,/]+|-?\\s*\\d*\\s*π(?:\\s*/\\s*\\d+)?|-?\\s*pi(?:\\s*/\\s*\\d+)?)';
    if (!/∫|integral/i.test(raw) && !/integral/.test(c.f)) return null;
    if ((m = /∫\s*_\s*\{?\s*([^}\s^]+)\s*\}?\s*\^\s*\{?\s*([^}\s]+)\s*\}?/.exec(raw))) { lo = m[1]; hi = m[2]; }
    else if ((m = /∫\s*([₋₀₁₂₃₄₅₆₇₈₉]+)\s*([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+|\^\s*\S+)/.exec(raw))) { lo = m[1].replace(/[₋₀₁₂₃₄₅₆₇₈₉]/g, function (ch) { return SUBC[ch]; }); hi = m[2].replace(/^\^\s*/, '').replace(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/g, function (ch) { return SUPC[ch]; }); }
    else if ((m = new RegExp(B + '\\s*-?\\s*(?:dan|den|dän|tan|ten|dän)\\s+' + B + '\\s*-?\\s*(?:a|e|ä|ga|ge|ka|ke|ýa|ýe|ýä)?\\s*(?:çenli|cenli|aralykda|aralyk)', 'i').exec(raw))) { lo = m[1]; hi = m[2]; }
    else if ((m = new RegExp('\\[\\s*' + B + '\\s*[;,]\\s*' + B + '\\s*\\]').exec(raw))) { lo = m[1]; hi = m[2]; }
    else if ((m = new RegExp('çäk\\w*\\s*:?\\s*' + B + '\\s*(?:we|,|;|hem)\\s*' + B, 'i').exec(raw))) { lo = m[1]; hi = m[2]; }
    else if ((m = new RegExp('\\bfrom\\s+' + B + '\\s+to\\s+' + B, 'i').exec(raw))) { lo = m[1]; hi = m[2]; }
    if (lo !== null) { lo = lo.replace(/\s+/g, '').replace(',', '.'); hi = hi.replace(/\s+/g, '').replace(',', '.'); }
    var n = c.n, expr = null, dv = 'x';
    var body = n;
    var at = n.indexOf('∫');
    if (at >= 0) {
      body = n.slice(at + 1).replace(/^\s*_\s*\{?[^}\s^]+\}?\s*\^\s*\{?[^}\s]+\}?/, '').replace(/^\s*\d+(?:\.\d+)?\s*\^\s*\(\s*[^)]*\)/, '').replace(/^\s*\[[^\]]*\]/, '');
      var dm = /\bd([a-z])\b/.exec(body);
      if (dm) { dv = dm[1]; body = body.slice(0, dm.index); }
      var sp = spans(body);
      expr = sp.length ? sp[0] : null;
    } else {
      var cands = spans(n.replace(/\bd([a-z])\b/g, ' ')).filter(function (s) { return /[a-z]/.test(s.replace(/sin|cos|tan|cot|log|sqrt|exp|abs|pi/g, '')) && !/^[a-z]$/.test(s); });
      cands = cands.map(function (s) { var d = asDef(s); return d ? d.expr : s; }).filter(function (s) { return !/[=<>]/.test(s); });
      expr = cands.sort(function (a, b) { return b.length - a.length; })[0] || null;
      var dm2 = /\bd([a-z])\b/.exec(n); if (dm2) dv = dm2[1];
    }
    if (!expr) return null;
    var node = P(expr);
    if (!node) return null;
    var vs = varsOf(node);
    if (vs.length > 1) return null;
    if (vs.length === 1 && vs[0] !== 'x') node = rename(node, vs[0], 'x');
    else if (dv !== 'x' && vs.length === 1) node = rename(node, dv, 'x');
    var e = node.toString(), defn = lo !== null && hi !== null;
    var a = defn ? boundNum(lo) : NaN, b = defn ? boundNum(hi) : NaN;
    var iTex = '\\int' + (defn ? '_{' + texOf(lo.replace(/π/g, 'pi')) + '}^{' + texOf(hi.replace(/π/g, 'pi')) + '}' : '') + ' ' + texOf(node) + '\\,dx';
    var plan = {
      text: tutor()
        ? 'Ilki özüňiz synanyşyň: $' + iTex + '$. Tablisa integrallaryny ýatlaň; köpeltmek hasyly bolsa ($x\\cdot e^x$, $x\\sin x$) — bölekleýin integrirlemek $\\int u\\,dv = uv - \\int v\\,du$, içki funksiýanyň önümi bar bolsa — ornuna goýma usuly. Motoryň çözgüdi aşakdaky kartda.'
        : 'Integraly saýtyň ädimme-ädim motory bilen çözýärin: $$' + iTex + '$$',
      tools: [{ name: 'solve_steps', input: defn ? { task: 'definite_integral', expression: e, lower: lo.replace(/π/g, 'pi'), upper: hi.replace(/π/g, 'pi') } : { task: 'integral', expression: e } }]
    };
    if (defn && isFinite(a) && isFinite(b) && a !== b) {
      var w = Math.abs(b - a);
      plan.tools.push({ name: 'plot_graph', input: { title: 'Integral — boýalan meýdan', functions: [{ expr: e, label: 'f(x) = ' + plain(node) }], x_min: Math.min(a, b) - Math.max(1, w * 0.3), x_max: Math.max(a, b) + Math.max(1, w * 0.3), shade: { from: Math.min(a, b), to: Math.max(a, b) } } });
    }
    plan.after = function (items) {
      var r = items[0] && items[0].data;
      if (!r) return 'Motor integraly hasaplamady' + (items[0] && items[0].error ? ': ' + items[0].error : '.');
      if (!r.ok) return 'Motor bu integral üçin usul tapmady' + (r.check ? ': ' + r.check.replace(/^(ok|warn|none):\s*/, '') : '') + '\n\n' + link('Integral usullary', 'kalkulus/kalkulus-integral-usullary.html');
      if (tutor()) return 'Motoryň jogaby we ädimleri kartada. Öz jogabyňyzy önümini alyp hem barlap bilersiňiz: $F\'(x) = f(x)$ bolmaly.';
      var ans = String(r.answer_exact || r.answer || ''), out;
      if (defn) {
        out = '**Jogap:** $' + iTex + ' ' + ansTeX(ans) + '$' + (/^ok/.test(r.check) ? ' ✓' : '') + '\n\n';
        if (items[1]) out += '- Grafikde boýalan ýer — integralyň geometrik manysy: egriniň we Ox okunyň arasyndaky meýdan (Ox okunyň aşagyndaky bölek minus alamat bilen girýär).\n';
      } else {
        out = '**Jogap:** $' + iTex + ' ' + ansTeX(ans) + '$' + (/^ok/.test(r.check) ? ' ✓' : '') + '\n\n';
      }
      if (r.check) out += '- Barlag: ' + r.check.replace(/^(ok|warn|none):\s*/, '') + '\n';
      return out + '\n' + link('Integral usullary', 'kalkulus/kalkulus-integral-usullary.html') + ' · ' + link('Integralyň ulanylyşy', 'kalkulus/kalkulus-integral-ulanylysy.html');
    };
    return plan;
  });

  /* --- önüm → solve_steps */
  intent('derivative', function (c) {
    var f = c.f, prime = /([a-z)])\s*''?\s*(\(|=|$)/.test(c.n) && /'/.test(c.n);
    if (!/onum|differensir|d\/dx|derivat/.test(f) && !prime) return null;
    if (/bolekleyin onum|xusus/.test(f)) return null;
    var cands = spans(c.n.replace(/d\/dx/g, ' ')).map(function (s) {
      s = s.replace(/^[yf]\s*'+\s*(\(\s*x\s*\))?\s*=?\s*$/, '');
      var d = asDef(s.replace(/^([yfgh])\s*'+/, '$1'));
      if (d) return d.expr;
      return s.replace(/^\((.*)\)\s*'+$/, '$1').replace(/'+$/, '');
    }).filter(function (s) { var nn = P(s); return nn && varsOf(nn).length === 1 && !/[=<>]/.test(s); });
    if (!cands.length) return null;
    var node = P(cands.sort(function (a, b) { return b.length - a.length; })[0]), vs = varsOf(node);
    if (vs[0] !== 'x') node = rename(node, vs[0], 'x');
    var e = node.toString(), second = /ikinji|ikilenji|''/.test(f + c.n);
    var tools = [{ name: 'solve_steps', input: { task: 'derivative', expression: e } }], d1 = null;
    try { d1 = M().simplify(M().derivative(node, 'x')); } catch (er) { d1 = null; }
    if (second && d1) tools.push({ name: 'solve_steps', input: { task: 'derivative', expression: d1.toString() } });
    return {
      text: tutor()
        ? 'Ilki özüňiz synanyşyň: $f(x) = ' + texOf(node) + '$. Haýsy düzgün gerek: jemiň önümi, $(x^n)\' = nx^{n-1}$, köpeltmek hasyly $(uv)\' = u\'v + uv\'$, paý ýa-da çylşyrymly funksiýa $(f(g(x)))\' = f\'(g)\\cdot g\'$? Motoryň çözgüdi aşakdaky kartda.'
        : 'Önümi düzgünler bilen ädimme-ädim tapýaryn: $$f(x) = ' + texOf(node) + '$$',
      tools: tools,
      after: function (items) {
        var r = items[0] && items[0].data;
        if (!r || !r.ok) return 'Motor önümi tapmady' + (r && r.error ? ': ' + r.error : '') + '. ' + link('Önüm sapagy', 'kalkulus/kalkulus-onum.html');
        if (tutor()) return 'Motoryň jogaby we ädimleri kartada. Öz jogabyňyz bilen deňeşdiriň.';
        var d = P(String(r.answer_exact || r.answer).replace(/^f′\(x\)\s*=\s*/, '')) || d1;
        var out = '**Jogap:** $f\'(x) = ' + (d ? texOf(d) : '\\text{' + String(r.answer).replace(/[\\{}$]/g, '') + '}') + '$' + (/^ok/.test(r.check) ? ' ✓' : '') + '\n\n';
        if (r.check) out += '- Barlag: ' + r.check.replace(/^(ok|warn|none):\s*/, '') + '\n';
        if (items[1] && items[1].data && items[1].data.ok) { var d2 = P(String(items[1].data.answer_exact || items[1].data.answer)); out += '- **Ikinji önüm:** $f\'\'(x) = ' + (d2 ? texOf(d2) : String(items[1].data.answer)) + '$\n'; }
        var dp = d1 && polyOf(d1);
        if (dp && dp.deg >= 1 && dp.deg <= 4 && !dp.den) {
          var tmp = [], rts = solvePoly(dp.c, tmp).sort(function (a, b) { return a.v - b.v; });
          if (rts.length) out += '- Kritiki nokatlar ($f\'(x) = 0$): $' + rts.map(function (q) { return 'x = ' + q.tex; }).join(',\\ ') + '$ — funksiýany derňemek üçin: «y = … grafigini çyz we derňe».\n';
        }
        return out + '\n' + link('Önüm sapagy', 'kalkulus/kalkulus-onum.html') + ' · ' + link('Önümiň ulanylyşy', 'kalkulus/kalkulus-onum-ulanylysy.html');
      }
    };
  });

  /* --- statistika */
  function numberList(raw) {
    var s = String(raw).replace(/[−–—]/g, '-'), best = null;
    var rx = /-?\d+(?:[.,]\d+)?(?:(?:\s*;\s*|\s*,\s*|\s+)-?\d+(?:[.,]\d+)?){2,}/g, m;
    while ((m = rx.exec(s))) {
      var t = m[0], parts;
      if (/;/.test(t)) parts = t.split(/\s*;\s*/).map(function (x) { return x.replace(',', '.'); });
      else if (/,\s/.test(t) || /\s/.test(t)) parts = t.split(/\s*,\s*|\s+/);
      else parts = t.split(',');
      var nums = parts.map(Number).filter(function (x) { return isFinite(x); });
      if (nums.length >= 3 && (!best || nums.length > best.length)) best = nums;
    }
    return best;
  }
  intent('stats', function (c) {
    var key = /ortaca|orta baha|orta arifmetik|medana|mediana|moda\b|dispers|standart|dowuklik|gysarma|kwartil|razmah|dargama|statistik|toplum|nusga|maglumat/.test(c.f);
    var nums = numberList(c.text);
    if (!nums || (!key && !(/^statistika/.test(c.page) && nums.length >= 3) && nums.length < 5)) return null;
    if (!key && /[a-z]\s*[=<>]|[=<>]\s*[a-z]/.test(c.n)) return null;
    var n = nums.length, fr = nums.map(toFrac), exact = fr.every(Boolean);
    var sorted = nums.slice().sort(function (a, b) { return a - b; });
    var sum = exact ? fr.reduce(function (s, x) { return s.add(x); }, F(0)) : null, sumN = nums.reduce(function (s, x) { return s + x; }, 0);
    var mean = exact ? sum.div(n) : null, meanN = sumN / n;
    var med = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    var cnt = {}; nums.forEach(function (x) { cnt[x] = (cnt[x] || 0) + 1; });
    var mx = Math.max.apply(null, Object.keys(cnt).map(function (k) { return cnt[k]; })), modes = Object.keys(cnt).filter(function (k) { return cnt[k] === mx; }).map(Number).sort(function (a, b) { return a - b; });
    var ss = exact ? fr.reduce(function (s, x) { var d = x.sub(mean); return s.add(d.mul(d)); }, F(0)) : null;
    var ssN = nums.reduce(function (s, x) { return s + (x - meanN) * (x - meanN); }, 0);
    var varP = ssN / n, varS = n > 1 ? ssN / (n - 1) : NaN;
    var T = function (f, v) { return f ? fT(f) + (fInt(f) ? '' : ' \\approx ' + dec(f.valueOf())) : dec(v); };
    var lines = [];
    var list = nums.map(function (x) { return dec(x, 6); }).join(', ');
    lines.push('**Maglumatlar** ($n = ' + n + '$): ' + list);
    lines.push('**Tertiplenen hatar:** ' + sorted.map(function (x) { return dec(x, 6); }).join(', '));
    lines.push('1. **Ortaça:** $\\bar{x} = \\frac{' + (n <= 12 ? nums.map(function (x) { return dec(x, 6).replace('−', '-'); }).join(' + ').replace(/\+ -/g, '- ') : '\\sum x_i') + '}{' + n + '} = ' + (exact ? '\\frac{' + fS(sum).replace('−', '-') + '}{' + n + '}' + (fInt(mean) || mean.toFraction() !== sum.toFraction() + '/' + n ? ' = ' + T(mean) : ' \\approx ' + dec(meanN)) : dec(meanN)) + '$\n' +
      '2. **Medana:** ' + (n % 2 ? '$n = ' + n + '$ täk — ortadaky (' + ((n + 1) / 2) + '-nji) agza: $Me = ' + dec(med, 6) + '$' : '$n = ' + n + '$ jübüt — ortadaky iki agzanyň ortaçasy: $Me = \\frac{' + dec(sorted[n / 2 - 1], 6) + ' + ' + dec(sorted[n / 2], 6) + '}{2} = ' + dec(med, 6) + '$') + '\n' +
      '3. **Moda:** ' + (mx === 1 ? 'ähli bahalar bir gezekden gabat gelýär — moda ýok' : 'iň köp gaýtalanýan baha — $Mo = ' + modes.map(function (x) { return dec(x, 6); }).join(';\\ ') + '$ (' + mx + ' gezek)') + '\n' +
      '4. **Dargama (razmah):** $R = x_{\\max} - x_{\\min} = ' + dec(sorted[n - 1], 6) + ' - ' + dec(sorted[0], 6).replace('−', '-') + ' = ' + dec(sorted[n - 1] - sorted[0], 6) + '$\n' +
      '5. **Dispersiýa:** $\\sum (x_i - \\bar{x})^2 = ' + (exact ? T(ss) : dec(ssN)) + '$; baş toplum üçin $\\sigma^2 = \\frac{\\sum (x_i - \\bar{x})^2}{n} = ' + (exact ? T(ss.div(n)) : dec(varP)) + '$' + (n > 1 ? ', nusga üçin $s^2 = \\frac{\\sum (x_i - \\bar{x})^2}{n - 1} = ' + (exact ? T(ss.div(n - 1)) : dec(varS)) + '$' : '') + '\n' +
      '6. **Standart döwüklik:** $\\sigma = \\sqrt{\\sigma^2} \\approx ' + dec(Math.sqrt(varP)) + '$' + (n > 1 ? ', $s = \\sqrt{s^2} \\approx ' + dec(Math.sqrt(varS)) + '$' : ''));
    if (n <= 10) {
      lines.push('| $x_i$ | $x_i - \\bar{x}$ | $(x_i - \\bar{x})^2$ |\n|---|---|---|\n' + nums.map(function (x, i) {
        var d = exact ? fr[i].sub(mean) : null, dn = x - meanN;
        return '| ' + dec(x, 6) + ' | $' + (d ? fT(d) : dec(dn)) + '$ | $' + (d ? fT(d.mul(d)) : dec(dn * dn)) + '$ |';
      }).join('\n'));
    }
    lines.push('Baş toplumyň ($\\sigma$) we nusganyň ($s$) formulalary diňe maýdalawjyda tapawutlanýar: maglumatlar uly toplumdan alnan nusga bolsa, $n - 1$ (Bessel düzedişi) ulanylýar.');
    var arr = '[' + nums.join(', ') + ']';
    return {
      text: lines.join('\n\n'),
      tools: [{ name: 'calculate', input: { expressions: ['mean(' + arr + ')', 'median(' + arr + ')', 'mode(' + arr + ')', 'variance(' + arr + ', "uncorrected")', 'std(' + arr + ', "uncorrected")', 'std(' + arr + ')'] } }],
      after: function (items) {
        var d = items[0] && items[0].data;
        var ok = Array.isArray(d) && !d.some(function (x) { return x.error; }) && Math.abs(Number(d[0].result) - meanN) < 1e-9 && Math.abs(Number(d[1].result) - med) < 1e-9;
        return (ok ? 'math.js bilen garaşsyz barlag şol bahalary berdi ✓' : 'Barlag kartasyna serediň.') + ' (`std(...)` — nusga, `"uncorrected"` — baş toplum üçin.)\n\n' + link('Statistika: ortaça, medana, moda we dargama', 'statistika/index.html#ortaca-medana-moda-we-dargama');
      }
    };
  });

  /* --- IUUB, IUKS, ýönekeý köpeldijiler, göterim */
  intent('numbers', function (c) {
    var f = c.f, ints = (c.text.match(/\d+/g) || []).map(Number).filter(function (x) { return x > 0 && x <= 1e12; });
    var isG = /iuub|in uly umumy bolu|ebob|\bgcd\b|\buub\b/.test(f), isL = /iuks|in kici umumy|ekuk|ekok|\blcm\b|\bkuk\b|umumy kopeltmek|umumy kratny/.test(f);
    if ((isG || isL) && ints.length >= 2) {
      var nums = ints.slice(0, 6), lines = [];
      var g = nums.reduce(gcd), l = nums.reduce(lcm);
      if (nums.length === 2) {
        var a = Math.max(nums[0], nums[1]), b = Math.min(nums[0], nums[1]), steps = [];
        while (b) { steps.push('$' + a + ' = ' + Math.floor(a / b) + '\\cdot ' + b + ' + ' + (a % b) + '$'); var t = a % b; a = b; b = t; }
        lines.push('**Ýewklidiň algoritmi** (galyndy 0 bolýança bölýäris):\n' + steps.map(function (s) { return '- ' + s; }).join('\n'));
      }
      var fac = function (x) { var o = [], d = 2; while (d * d <= x) { while (x % d === 0) { o.push(d); x /= d; } d++; } if (x > 1) o.push(x); return o; };
      lines.push('**Ýönekeý köpeldijiler:** ' + nums.map(function (x) { return '$' + x + ' = ' + fac(x).join('\\cdot ') + '$'; }).join(', '));
      if (isG) lines.push('**Jogap:** $\\text{IUUB}(' + nums.join(', ') + ') = ' + g + '$');
      if (isL) lines.push((nums.length === 2 ? '$\\text{IUKS}(a, b) = \\frac{a\\cdot b}{\\text{IUUB}(a, b)} = \\frac{' + nums[0] + '\\cdot ' + nums[1] + '}{' + g + '}$. ' : '') + '**Jogap:** $\\text{IUKS}(' + nums.join(', ') + ') = ' + l + '$');
      lines.push(link('IUUB we IUKS kalkulýatory', 'on-algebra/index.html#in-uly-umumy-boluji-iuub-we-in-kici-'));
      return textPlan(lines.join('\n\n'));
    }
    if (/yonekey kopeldiji|kopeldijilere dagyt|faktorla/.test(f) && ints.length && !c.spans.some(function (sp) { return /[a-z]/.test(sp); })) {
      var x = ints[0], o = [], d = 2, y = x;
      while (d * d <= y) { while (y % d === 0) { o.push(d); y /= d; } d++; }
      if (y > 1) o.push(y);
      return textPlan('**Ýönekeý köpeldijilere dagytmak:** ' + x + ' sany iň kiçi ýönekeý bölüjilere yzygider bölýäris: $$' + x + ' = ' + o.join('\\cdot ') + '$$' + (o.length === 1 ? x + ' — ýönekeý san.' : ''));
    }
    var pm = /(\d+(?:[.,]\d+)?)\s*-?\s*(?:[a-zçäöüžňşý]{0,4})\s+(\d+(?:[.,]\d+)?)\s*(?:%|göterim)/i.exec(c.text) || /(\d+(?:[.,]\d+)?)\s*(?:%|göterim)[^\d]{0,30}?(\d+(?:[.,]\d+)?)/i.exec(c.text);
    if (pm && /%|goterim/.test(f) && !/[a-z]\s*=/.test(c.n)) {
      var first = /%|göterim/i.test(c.text.slice(pm.index, pm.index + pm[0].indexOf(pm[2]))) ? 'pct-first' : 'base-first';
      var A = Number(pm[first === 'base-first' ? 1 : 2].replace(',', '.')), p = Number(pm[first === 'base-first' ? 2 : 1].replace(',', '.'));
      if (/nace goterim|nache goterim|nace %|nace protsent/.test(f)) {
        return textPlan('Bir sanyň beýleki sandan näçe göterimdigini tapmak: $$\\frac{' + dec(p) + '}{' + dec(A) + '}\\cdot 100\\% ' + eqT(p / A * 100) + '\\%$$\n\n' + link('Göterim hasaplamalary', 'on-algebra/index.html#goterim-hasaplamalary'));
      }
      return textPlan('Sanyň göterimini tapmak üçin sany göterime köpeldip, 100-e bölýäris: $$' + dec(A) + '\\cdot \\frac{' + dec(p) + '}{100} ' + eqT(A * p / 100) + '$$\n\n' + link('Göterim hasaplamalary', 'on-algebra/index.html#goterim-hasaplamalary'));
    }
    return null;
  });

  /* --- geometriýa */
  function numsAfter(t, word) {
    var m = new RegExp(word + '[a-zçäöüžňşý]*\\s*(?:=|:|-?\\s*(?:i|y|si|sy|ýa|ýe)?)?\\s*(\\d+(?:[.,]\\d+)?)', 'i').exec(t);
    return m ? Number(m[1].replace(',', '.')) : null;
  }
  intent('geometry', function (c) {
    var f = c.f, t = c.text, nums = (t.match(/\d+(?:[.,]\d+)?/g) || []).map(function (x) { return Number(x.replace(',', '.')); });
    if (!nums.length || /[a-z]\s*[=<>]\s*[\d(-]|\^/.test(c.n.replace(/\b[rhad]\s*=/g, ''))) return null;
    var L = [], P2 = function (v) { return nt(v); };
    var r = numsAfter(t, 'radius') || numsAfter(t, '\\br') , dmt = numsAfter(t, 'diametr'), h = numsAfter(t, 'beýiklig') || numsAfter(t, '\\bh');
    if (!r && dmt) r = dmt / 2;
    if (/ucburc/.test(f) && /tarap/.test(f) && nums.length >= 3 && !/gonuburcly/.test(f)) {
      var a = nums[0], b = nums[1], cc = nums[2], s = [a, b, cc].sort(function (x, y) { return x - y; });
      if (s[0] + s[1] <= s[2]) return textPlan('Taraplary ' + [a, b, cc].map(dec).join(', ') + ' bolan üçburçluk ýok: iki kiçi tarapyň jemi uly tarapdan uly bolmaly ($' + dec(s[0]) + ' + ' + dec(s[1]) + ' \\le ' + dec(s[2]) + '$).');
      var p = (a + b + cc) / 2, S = Math.sqrt(p * (p - a) * (p - b) * (p - cc));
      L.push('**Perimetr:** $P = a + b + c = ' + dec(a) + ' + ' + dec(b) + ' + ' + dec(cc) + ' = ' + dec(2 * p) + '$, ýarym perimetr $p = ' + dec(p) + '$.');
      L.push('**Geronyň formulasy:** $$S = \\sqrt{p(p-a)(p-b)(p-c)} = \\sqrt{' + dec(p) + '\\cdot ' + dec(p - a) + '\\cdot ' + dec(p - b) + '\\cdot ' + dec(p - cc) + '} ' + eqT(S) + '$$');
      var right = Math.abs(s[0] * s[0] + s[1] * s[1] - s[2] * s[2]) < 1e-9;
      if (right) L.push('Bellik: $' + dec(s[0]) + '^2 + ' + dec(s[1]) + '^2 = ' + dec(s[2]) + '^2$ — üçburçluk **gönüburçly** (Pifagoryň teoremasy), şonuň üçin $S = \\frac{1}{2}\\cdot ' + dec(s[0]) + '\\cdot ' + dec(s[1]) + ' = ' + dec(S) + '$ hem bolýar.');
      else L.push('Görnüşi: ' + (s[0] * s[0] + s[1] * s[1] > s[2] * s[2] ? 'ýiti burçly' : 'kütek burçly') + (a === b && b === cc ? ', deňtaraply' : a === b || b === cc || a === cc ? ', deňýanly' : '') + ' üçburçluk.');
      L.push('**Jogap:** $S ' + eqT(S) + '$');
      return textPlan(L.join('\n\n') + '\n\n' + link('Geometriýa kalkulýatorlary', 'geometriya/index.html'));
    }
    if (/(gonuburcly ucburc|katet|gipotenuza)/.test(f) && nums.length >= 2) {
      var k1 = nums[0], k2 = nums[1];
      if (/gipotenuza/.test(f) && /katet/.test(f) && !/katetleri/.test(f) && nums[1] !== undefined) {
        var hyp = Math.max(k1, k2), leg = Math.min(k1, k2), other = Math.sqrt(hyp * hyp - leg * leg);
        return textPlan('**Pifagoryň teoremasy:** $a^2 + b^2 = c^2$, şonuň üçin $$b = \\sqrt{c^2 - a^2} = \\sqrt{' + dec(hyp) + '^2 - ' + dec(leg) + '^2} ' + eqT(other) + '$$\n\n**Meýdan:** $S = \\frac{ab}{2} ' + eqT(leg * other / 2) + '$');
      }
      var cH = Math.sqrt(k1 * k1 + k2 * k2);
      return textPlan('**Pifagoryň teoremasy:** $$c = \\sqrt{a^2 + b^2} = \\sqrt{' + dec(k1) + '^2 + ' + dec(k2) + '^2} = \\sqrt{' + dec(k1 * k1 + k2 * k2) + '} ' + eqT(cH) + '$$\n\n**Meýdan:** $S = \\frac{ab}{2} = \\frac{' + dec(k1) + '\\cdot ' + dec(k2) + '}{2} = ' + dec(k1 * k2 / 2) + '$, **perimetr:** $P ' + eqT(k1 + k2 + cH) + '$.');
    }
    if (/(\bsar(y|yn|a|da|yň|yn)?\b|\bsfera)/.test(f) && (r || nums.length === 1)) {
      r = r || nums[0];
      return textPlan('Radiusy $R = ' + dec(r) + '$ bolan şar:\n\n- **Göwrümi:** $V = \\frac{4}{3}\\pi R^3 = \\frac{4}{3}\\pi\\cdot ' + dec(r) + '^3 = ' + nice(4 / 3 * Math.pow(r, 3)).tex + '\\pi \\approx ' + dec(4 / 3 * Math.PI * Math.pow(r, 3)) + '$\n- **Üstüniň meýdany:** $S = 4\\pi R^2 = ' + nice(4 * r * r).tex + '\\pi \\approx ' + dec(4 * Math.PI * r * r) + '$\n\n' + link('Geometriýa: göwrümli şekiller', 'geometriya/index.html'));
    }
    if (/(silindr)/.test(f) && r && h) return textPlan('Silindr ($r = ' + dec(r) + '$, $h = ' + dec(h) + '$):\n\n- **Göwrümi:** $V = \\pi r^2 h = ' + nice(r * r * h).tex + '\\pi \\approx ' + dec(Math.PI * r * r * h) + '$\n- **Doly üstüniň meýdany:** $S = 2\\pi r(r + h) = ' + nice(2 * r * (r + h)).tex + '\\pi \\approx ' + dec(2 * Math.PI * r * (r + h)) + '$');
    if (/(konus)/.test(f) && r && h) { var l = Math.sqrt(r * r + h * h); return textPlan('Konus ($r = ' + dec(r) + '$, $h = ' + dec(h) + '$):\n\n- **Göwrümi:** $V = \\frac{1}{3}\\pi r^2 h ' + eqT(r * r * h / 3) + '\\pi \\approx ' + dec(Math.PI * r * r * h / 3) + '$\n- **Emele getirijisi:** $l = \\sqrt{r^2 + h^2} ' + eqT(l) + '$\n- **Doly üstüniň meýdany:** $S = \\pi r(r + l) \\approx ' + dec(Math.PI * r * (r + l)) + '$'); }
    if (/(towere[kg]|tegele[kg]|aylana|krug)/.test(f) && (r || nums.length === 1)) {
      r = r || nums[0];
      return textPlan('Radiusy $r = ' + dec(r) + '$ bolan töwerek we tegelek:\n\n- **Töweregiň uzynlygy:** $C = 2\\pi r = ' + nice(2 * r).tex + '\\pi \\approx ' + dec(2 * Math.PI * r) + '$\n- **Tegelegiň meýdany:** $S = \\pi r^2 = ' + nice(r * r).tex + '\\pi \\approx ' + dec(Math.PI * r * r) + '$\n\nUzynlyk çyzygyň ölçegi (sm, m), meýdan bolsa tekizligiň ölçegi (sm², m²).\n\n' + link('Geometriýa kalkulýatorlary', 'geometriya/index.html'));
    }
    if (/\bkub/.test(f) && !/denleme|kub kok/.test(f) && nums.length === 1) {
      var q = nums[0];
      return textPlan('Gapyrgasy $a = ' + dec(q) + '$ bolan kub:\n\n- **Göwrümi:** $V = a^3 = ' + dec(Math.pow(q, 3)) + '$\n- **Üstüniň meýdany:** $S = 6a^2 = ' + dec(6 * q * q) + '$\n- **Diagonaly:** $d = a\\sqrt{3} ' + eqT(q * Math.sqrt(3)) + '$');
    }
    if (/gonuburclu[kg]/.test(f) && nums.length >= 2) {
      var x = nums[0], y = nums[1];
      return textPlan('Taraplary $a = ' + dec(x) + '$, $b = ' + dec(y) + '$ bolan gönüburçluk:\n\n- **Meýdany:** $S = ab = ' + dec(x * y) + '$\n- **Perimetri:** $P = 2(a + b) = ' + dec(2 * (x + y)) + '$\n- **Diagonaly:** $d = \\sqrt{a^2 + b^2} ' + eqT(Math.sqrt(x * x + y * y)) + '$');
    }
    if (/kwadrat/.test(f) && /tarap/.test(f) && !/denleme|kwadrat koki|kwadrata/.test(f) && nums.length === 1) {
      var sq = nums[0];
      return textPlan('Tarapy $a = ' + dec(sq) + '$ bolan kwadrat:\n\n- **Meýdany:** $S = a^2 = ' + dec(sq * sq) + '$\n- **Perimetri:** $P = 4a = ' + dec(4 * sq) + '$\n- **Diagonaly:** $d = a\\sqrt{2} ' + eqT(sq * Math.SQRT2) + '$');
    }
    void P2;
    return null;
  });

  /* --- hereket meseleleri */
  intent('motion', function (c) {
    var f = c.f;
    if (!/(otly|masyn|awtomobil|awtobus|pyyada|welosiped|gami|gayyk|ucar|motosikl|tizlik|km\/sag)/.test(f)) return null;
    var t = c.text.replace(/,(\d)/g, '.$1');
    var sp = [], m, rx = /(\d+(?:\.\d+)?)(?:\s*(?:we|,|hem-de|hem|-)\s*(\d+(?:\.\d+)?))?\s*(km\/sag(?:at)?|km\/s|km\/h|m\/s(?:ek)?)/gi;
    while ((m = rx.exec(t))) { sp.push(Number(m[1])); if (m[2]) sp.push(Number(m[2])); }
    var dm = /(\d+(?:\.\d+)?)\s*(km|metr|m)\b(?!\s*\/)/i.exec(t), S = dm ? Number(dm[1]) : null, unit = dm ? (dm[2].toLowerCase() === 'km' ? 'km' : 'm') : 'km';
    var tm = /(\d+(?:\.\d+)?)\s*(sagat|sag)(?![a-zçäöüžňşý]*\s*\/)/i.exec(t.replace(/km\/sag[a-zçäöüžňşý]*/gi, '')), T = tm ? Number(tm[1]) : null;
    var vu = /(^|[^k])m\/s/i.test(t) ? 'm/s' : 'km/sag', tu = vu === 'm/s' ? 'sekunt' : 'sagat';
    var link2 = '\n\n' + link('Hereket meseleleri', 'soz-meseleleri/soz-hereket.html');
    if (sp.length >= 2 && S && /(garsy|dusus|biri-birine)/.test(f) && !/ters ugur|ters tarap/.test(f)) {
      var v = sp[0] + sp[1], tt = S / v;
      return textPlan('**Çözgüt.** Biri-birine garşy hereket edende ýakynlaşma tizligi tizlikleriň jemine deň: $$v = v_1 + v_2 = ' + dec(sp[0]) + ' + ' + dec(sp[1]) + ' = ' + dec(v) + '\\ \\text{' + vu + '}$$ Duşuşmaga çenli wagt: $$t = \\frac{S}{v_1 + v_2} = \\frac{' + dec(S) + '}{' + dec(v) + '} ' + eqT(tt) + '\\ \\text{' + tu + '}$$\n\n**Jogap:** ' + nTxt(tt) + ' ' + tu + 'dan duşuşarlar.\n\n**Barlag:** ' + nTxt(tt) + ' ' + tu + 'da birinji ' + dec(sp[0] * tt) + ' ' + unit + ', ikinji ' + dec(sp[1] * tt) + ' ' + unit + ' geçýär: $' + dec(sp[0] * tt) + ' + ' + dec(sp[1] * tt) + ' = ' + dec(S) + '$ ✓' + link2);
    }
    if (sp.length >= 2 && S && /(yzyndan|kowup|kowmak|yzarla|yetip|yeter)/.test(f)) {
      var dv = Math.abs(sp[0] - sp[1]);
      if (!dv) return textPlan('Tizlikler deň — aradaky uzaklyk üýtgemeýär, kowup ýetmek bolmaýar.');
      var t2 = S / dv;
      return textPlan('**Çözgüt.** Bir ugra hereket edende ýakynlaşma tizligi tizlikleriň tapawudyna deň: $$v = v_1 - v_2 = ' + dec(Math.max(sp[0], sp[1])) + ' - ' + dec(Math.min(sp[0], sp[1])) + ' = ' + dec(dv) + '\\ \\text{' + vu + '}$$ $$t = \\frac{S}{v_1 - v_2} = \\frac{' + dec(S) + '}{' + dec(dv) + '} ' + eqT(t2) + '\\ \\text{' + tu + '}$$\n\n**Jogap:** ' + nTxt(t2) + ' ' + tu + 'dan kowup ýeter.' + link2);
    }
    if (sp.length >= 2 && T && /(ters ugur|ters tarap|garsylykly ugur|durli tarap)/.test(f)) {
      var dist = (sp[0] + sp[1]) * T;
      return textPlan('**Çözgüt.** Ters ugra hereket edende daşlaşma tizligi $v_1 + v_2 = ' + dec(sp[0] + sp[1]) + '$ ' + vu + '. $$S = (v_1 + v_2)\\,t = ' + dec(sp[0] + sp[1]) + '\\cdot ' + dec(T) + ' = ' + dec(dist) + '\\ \\text{' + unit + '}$$\n\n**Jogap:** ' + dec(dist) + ' ' + unit + '.' + link2);
    }
    if (sp.length === 1 && T && !S) return textPlan('$$S = v\\cdot t = ' + dec(sp[0]) + '\\cdot ' + dec(T) + ' = ' + dec(sp[0] * T) + '\\ \\text{' + unit + '}$$\n\n**Jogap:** ' + dec(sp[0] * T) + ' ' + unit + '.' + link2);
    if (sp.length === 1 && S && !T) return textPlan('$$t = \\frac{S}{v} = \\frac{' + dec(S) + '}{' + dec(sp[0]) + '} ' + eqT(S / sp[0]) + '\\ \\text{' + tu + '}$$\n\n**Jogap:** ' + nTxt(S / sp[0]) + ' ' + tu + '.' + link2);
    if (!sp.length && S && T) return textPlan('$$v = \\frac{S}{t} = \\frac{' + dec(S) + '}{' + dec(T) + '} ' + eqT(S / T) + '\\ \\text{' + vu + '}$$\n\n**Jogap:** ' + nTxt(S / T) + ' ' + vu + '.' + link2);
    return null;
  });

  /* --- trigonometrik deňleme (trig-engine.js) */
  function seriesTeX(s, v) {
    var b = s.base && s.base.q ? window.AmatlyTrig.qTex(s.base.q) : s.base ? dec(s.base.num) : '0';
    var per;
    if (s.pq) { var nn = String(s.pq.n), dd = String(s.pq.d), top = (nn === '1' ? '' : nn) + '\\pi n'; per = dd === '1' ? top : '\\frac{' + top + '}{' + dd + '}'; }
    else per = dec(s.pnum) + 'n';
    return v + ' = ' + (b === '0' ? per : b + ' + ' + per);
  }
  var TRIG_METHOD = { basic: 'Iň ýönekeý deňleme', quadratic: 'Ornuna goýma: kwadrat deňleme', homogeneous: 'Bir jynsly deňleme', auxiliary: 'Kömekçi burç usuly', linear: 'Birinji derejeli bir jynsly deňleme', factor: 'Köpeldijilere dagytmak', equal: 'Bir atly funksiýalar', numeric: 'San usuly', identity: 'Toždestwo', none: 'Çözgüt ýok' };
  function trigPlan(span, k) {
    return need('trig').then(function (T) {
      var r;
      try { r = T.solveEquation(span, { lo: 0, hi: 2 * Math.PI }); } catch (e) { return textPlan('Trigonometrik deňlemäni okap bolmady: ' + e.message + '\n\n' + link('Trigonometrik deňlemeleri çözüji', 'trigonometriya/index.html')); }
      var v = r.v || 'x', lines = [], all = [];
      lines.push('**Deňleme:** $' + texOf(k.nl) + ' = ' + texOf(k.nr) + '$ — usul: **' + (TRIG_METHOD[r.method] || r.method) + '**');
      if (tutor()) {
        lines.push('**Maslahat:** ' + (r.method === 'quadratic' ? 'täze üýtgeýän giriziň (mysal üçin $t = \\sin x$, $|t| \\le 1$), kwadrat deňlemäni çözüň, soň iň ýönekeý deňlemelere gaýdyň.' : r.method === 'homogeneous' ? 'iki tarapy $\\cos^2 x$-e (ýa-da $\\cos x$-e) bölüp, $\\operatorname{tg} x$ boýunça deňlemä getiriň.' : 'iň ýönekeý deňlemäniň umumy formulasyny ulanyň: $\\sin x = a \\Rightarrow x = (-1)^n \\arcsin a + \\pi n$, $\\cos x = a \\Rightarrow x = \\pm\\arccos a + 2\\pi n$, $\\operatorname{tg} x = a \\Rightarrow x = \\operatorname{arctg} a + \\pi n$.') + '\n\nDoly çözgüdi görmek üçin «Düşündir» režimine geçip, soragy täzeden iberiň.');
        return textPlan(lines.join('\n\n'));
      }
      if (r.steps && r.steps.length) lines.push(r.steps.map(function (s, i) { return (i + 1) + '. ' + String(s).replace(/[*_|$`]/g, function (ch) { return { '*': '·', '_': ' ', '|': '∣', '$': '', '`': '' }[ch]; }); }).join('\n'));
      if (r.identity) lines.push('**Jogap:** deňleme toždestwo — $' + v + '$-iň kesgitlenen islendik bahasy çözgüt.');
      else if (r.method !== 'numeric') {
        r.branches.forEach(function (b) { (b.x || []).forEach(function (s) { all.push(seriesTeX(s, v)); }); });
        lines.push('**Umumy çözgüt:** ' + (all.length ? '$' + all.join(';\\quad ') + ',\\quad n \\in \\mathbb{Z}$' : 'çözgüt ýok') + (r.branches.some(function (b) { return b.none; }) ? '\n\n' + r.branches.filter(function (b) { return b.none; }).map(function (b) { return '_' + (b.note || 'Bu şahada çözgüt ýok.') + '_'; }).join(' ') : ''));
      }
      if (r.particular && r.particular.length) {
        lines.push('**[0; 2π) aralykdaky çözgütler:**\n\n| № | $' + v + '$ (radian) | gradus |\n|---|---|---|\n' + r.particular.map(function (p, i) {
          var a = p.q ? T.angleQ(p.q) : T.angleRad(p.x);
          return '| ' + (i + 1) + ' | $' + (p.q ? T.qTex(p.q) + (Math.abs(p.x) < 1e-12 ? '' : ' \\approx ' + dec(p.x)) : '\\approx ' + dec(p.x, 6)) + '$ | ' + T.degText(a) + ' |';
        }).join('\n'));
        if (r.check && r.check.n) lines.push('✓ **Barlag:** tapylan ' + r.check.n + ' bahanyň hemmesi deňlemä goýuldy — iki tarapyň tapawudy $10^{-9}$-dan kiçi.');
      } else if (!r.identity && r.method === 'numeric') lines.push('[0; 2π) aralykda kök tapylmady.');
      if (r.warnings) lines.push(r.warnings.map(function (w) { return '_' + w + '_'; }).join('\n'));
      var plan = { text: lines.join('\n\n') };
      if (!r.identity && r.particular && r.particular.length) {
        var fl = fxOf(rename(k.nl, v, 'x'));
        plan.tools = [{ name: 'plot_graph', input: { title: 'Deňlemäniň iki tarapy we çözgütler', functions: [{ expr: rename(k.nl, v, 'x').toString(), label: 'çep: ' + plain(k.nl) }, { expr: rename(k.nr, v, 'x').toString(), label: 'sag: ' + plain(k.nr) }], x_min: 0, x_max: 2 * Math.PI, points: r.particular.slice(0, 12).map(function (p) { return { x: p.x, y: fl(p.x) }; }) } }];
        plan.after = function () { return 'Grafikde deňlemäniň iki tarapynyň kesişme nokatlary — [0; 2π) aralykdaky çözgütler ✓ Galan çözgütler perioda goşup alynýar.\n\n' + link('Trigonometrik deňlemeleri çözüji', 'trigonometriya/index.html'); };
      } else plan.text += '\n\n' + link('Trigonometrik deňlemeleri çözüji', 'trigonometriya/index.html');
      return plan;
    });
  }

  /* --- deňsizlik */
  function intervalText(iv) {
    var L = iv.a === -Infinity ? '(-\\infty' : (iv.ca ? '[' : '(') + nice(iv.a).tex, R = iv.b === Infinity ? '+\\infty)' : nice(iv.b).tex + (iv.cb ? ']' : ')');
    if (iv.a === iv.b) return '\\{' + nice(iv.a).tex + '\\}';
    return L + ';\\ ' + R;
  }
  function inequalityPlan(k, c) {
    var pol0 = polyOf(new (M().OperatorNode)('-', 'subtract', [k.nl, k.nr]));
    var g = pol0 && !pol0.den ? M().parse(polyStr(pol0.c)) : texOf(k.nr) === '0' ? k.nl : new (M().OperatorNode)('-', 'subtract', [k.nl, k.nr]);
    var gf = fxOf(new (M().OperatorNode)('-', 'subtract', [k.nl, k.nr]));
    var op = k.op, lines = [], pts = [];
    var pol = polyOf(new (M().OperatorNode)('-', 'subtract', [k.nl, k.nr]));
    if (pol && !pol.den && pol.deg >= 1 && pol.deg <= 4) {
      var tmp = [];
      pts = solvePoly(pol.c, tmp).map(function (r) { return r.v; });
    } else pts = rootsIn(gf, -60, 60, 12000);
    var bad = cutsIn(gf, -60, 60, 12000);
    if (pol && pol.den) { var dz0 = polyOf(pol.den); if (dz0 && dz0.deg >= 1 && dz0.deg <= 4) solvePoly(dz0.c, []).forEach(function (r) { if (!bad.some(function (q) { return Math.abs(q - r.v) < 1e-6; })) bad.push(r.v); }); }
    bad = bad.filter(function (x) { return !pts.some(function (q) { return Math.abs(q - x) < 1e-7; }); });
    var cuts = pts.concat(bad).sort(function (a, b) { return a - b; }).filter(function (x, i, arr) { return !i || Math.abs(x - arr[i - 1]) > 1e-9; });
    var edges = [-Infinity].concat(cuts, [Infinity]), segs = [], ok = function (v) { return op === '<' ? v < 0 : op === '<=' ? v <= 1e-12 : op === '>' ? v > 0 : v >= -1e-12; };
    var rows = [];
    for (var i = 0; i < edges.length - 1; i++) {
      var a = edges[i], b = edges[i + 1];
      var t = a === -Infinity ? (b === Infinity ? 0 : b - 1) : b === Infinity ? a + 1 : (a + b) / 2;
      if (a !== -Infinity && b !== Infinity && b - a > 2) t = Math.round(t) === a || Math.round(t) === b ? t : Math.round(t);
      var y = gf(t);
      rows.push({ a: a, b: b, t: t, y: y, good: isFinite(y) && ok(y) && !(op[1] !== '=' && Math.abs(y) < 1e-12) });
    }
    rows.forEach(function (rw) { if (rw.good) segs.push({ a: rw.a, b: rw.b, ca: false, cb: false }); });
    /* araçäk nokadyň özi: funksiýa kesgitlenen we deňsizligi kanagatlandyrýan bolsa — ýapyk uç */
    cuts.forEach(function (x) {
      var y = gf(x);
      if (!isFinite(y)) return;
      var isRoot = pts.some(function (q) { return Math.abs(q - x) < 1e-9; });
      if (isRoot ? !(op === '<=' || op === '>=') : !ok(y)) return;
      var s = segs.filter(function (q) { return Math.abs(q.a - x) < 1e-9 || Math.abs(q.b - x) < 1e-9; });
      if (s.length) s.forEach(function (q) { if (Math.abs(q.a - x) < 1e-9) q.ca = true; if (Math.abs(q.b - x) < 1e-9) q.cb = true; });
      else segs.push({ a: x, b: x, ca: true, cb: true });
    });
    segs.sort(function (p, q) { return p.a - q.a; });
    var merged = [];
    segs.forEach(function (s) { var l = merged[merged.length - 1]; if (l && Math.abs(l.b - s.a) < 1e-9 && (l.cb || s.ca)) { l.b = s.b; l.cb = s.cb; } else merged.push(Object.assign({}, s)); });
    var opT = { '<': '<', '<=': '\\le', '>': '>', '>=': '\\ge' }[op];
    lines.push('**Deňsizlik:** $' + texOf(k.nl) + ' ' + opT + ' ' + texOf(k.nr) + '$');
    var absM = /^abs\(([^()]*)\)$/.exec(k.L.replace(/\s/g, '')), rv = fracEval(k.nr);
    if (absM && rv && rv.compare(0) > 0 && (op === '<' || op === '<=')) lines.push('Modulyň kesgitlemesi boýunça: $|A| ' + opT + ' c \\iff -c ' + opT + ' A ' + opT + ' c$, ýagny $$' + '-' + fT(rv) + ' ' + opT + ' ' + texOf(absM[1]) + ' ' + opT + ' ' + fT(rv) + '$$');
    else if (absM && rv && rv.compare(0) > 0) lines.push('Modulyň kesgitlemesi boýunça: $|A| ' + opT + ' c \\iff A ' + opT + ' c$ ýa-da $A ' + { '>': '<', '>=': '\\le' }[op] + ' -c$.');
    lines.push('1. Ähli agzalary bir tarapa geçirýäris: $g(x) = ' + texOf(g) + ' ' + opT + ' 0$.');
    lines.push('2. Araçäk nokatlar — $g(x) = 0$ deňlemäniň kökleri' + (bad.length ? ' we $g$ kesgitlenmedik nokatlar' : '') + ': ' + (cuts.length ? '$' + cuts.map(function (x) { return 'x ' + eqT(x); }).join(',\\ ') + '$' : 'ýok') + '.');
    if (rows.length <= 9) lines.push('3. **Aralyklar usuly:** her aralykda $g(x)$-iň alamatyny barlag nokadynda kesgitleýäris:\n\n| Aralyk | Barlag nokady | $g(x)$ | Alamat |\n|---|---|---|---|\n' + rows.map(function (rw) {
      return '| $' + intervalText({ a: rw.a, b: rw.b }) + '$ | $' + nice(rw.t).tex + '$ | $' + (isFinite(rw.y) ? nice(rw.y).tex : '—') + '$ | ' + (!isFinite(rw.y) ? 'kesgitlenmedik' : rw.y > 0 ? '+' : rw.y < 0 ? '−' : '0') + (rw.good ? ' ✓' : '') + ' |';
    }).join('\n'));
    var ans = merged.length ? merged.map(intervalText).join(' \\cup ') : '\\varnothing';
    lines.push('**Jogap:** $x \\in ' + ans + '$' + (merged.length ? '' : ' — deňsizligiň çözgüdi ýok'));
    var xs = cuts.filter(isFinite), lo = xs.length ? Math.min.apply(null, xs) : -5, hi = xs.length ? Math.max.apply(null, xs) : 5, pad = Math.max(2, (hi - lo) * 0.4);
    return {
      text: tutor() ? lines.slice(0, 3).join('\n\n') + '\n\n**Maslahat:** her aralykdan bir san alyp, $g(x)$-iň alamatyny özüňiz barlaň. Doly çözgüdi görmek üçin «Düşündir» režimine geçiň.' : lines.join('\n\n'),
      tools: tutor() ? [] : [{ name: 'plot_graph', input: { title: 'Deňsizligiň grafiki çözgüdi', functions: texOf(k.nr) === '0' ? [{ expr: k.nl.toString(), label: 'y = ' + plain(k.nl) }] : [{ expr: k.nl.toString(), label: 'y = ' + plain(k.nl) }, { expr: k.nr.toString(), label: 'y = ' + plain(k.nr) }], x_min: lo - pad, x_max: hi + pad, points: pts.filter(function (x) { return isFinite(fxOf(k.nl)(x)); }).slice(0, 8).map(function (x) { return { x: x, y: fxOf(k.nl)(x), label: 'x = ' + iTxt(x) }; }) } }],
      after: function () {
        var where = texOf(k.nr) === '0' ? 'Ox okundan' : '$y = ' + texOf(k.nr) + '$ egrisinden';
        return 'Grafikde: $y = ' + texOf(k.nl) + '$ egrisiniň ' + where + ' ' + (op[0] === '<' ? 'aşakda' : 'ýokarda') + ' ýatan ýerleri — tapylan aralyklar ✓\n\n' + link('Algebra: deňlemeler we deňsizlikler', 'algebra/index.html');
      }
    };
  }

  /* --- deňleme f(x) = g(x) */
  function equationPlan(k, c) {
    var diff = new (M().OperatorNode)('-', 'subtract', [k.nl, k.nr]);
    var lines = [], roots = [], f = fxOf(diff), method = /nyuton|newton|galtasyan/.test(c.f) ? 'newton' : /yarpylatma|bisek/.test(c.f) ? 'bisect' : null;
    var pol = polyOf(diff), vr = c.v || 'x';
    var squash = function (t) { return t.replace(/[{}\s]/g, ''); };
    var gexpr = pol && !pol.den ? M().parse(polyStr(pol.c)) : (texOf(k.nr) === '0' ? k.nl : diff);
    lines.push('**Deňleme:** $' + texOf(k.nl) + ' = ' + texOf(k.nr) + '$');
    if (pol && pol.deg >= 1 && !method && (pol.deg <= 2 || pol.deg <= 6)) {
      var std = polyTeX(pol.c) + ' = 0';
      if (pol.den) lines.push('Maýdalawjy nola deň bolmaly däl: $' + texOf(pol.den) + ' \\ne 0$. Deňlemäni umumy maýdalawja getirip, sanawjyny nola deňleýäris: $$' + std + '$$');
      else if (pol.deg > 1 && (texOf(k.nr) !== '0' || squash(texOf(k.nl)) !== squash(polyTeX(pol.c)))) lines.push('Ähli agzalary çep tarapa geçirip, ýönekeýleşdirýäris: $$' + std + '$$');
      if (pol.deg === 2) lines.push('Bu **kwadrat deňleme** ($ax^2 + bx + c = 0$).');
      roots = solvePoly(pol.c, lines);
      if (pol.den) {
        var dz = fxOf(pol.den), before = roots.length;
        roots = roots.filter(function (r) { return Math.abs(dz(r.v)) > 1e-9; });
        if (roots.length < before) lines.push('Maýdalawjyny nola öwürýän kök aýrylýar (kesgitleniş ýaýlasyna girmeýär).');
      }
    } else {
      var B = 20, rs = rootsIn(f, -B, B, 8000);
      if (!rs.length) rs = rootsIn(f, -1000, 1000, 40000);
      if (method === 'newton' || method === 'bisect') {
        var r0 = rs[0];
        if (r0 === undefined) { lines.push('Bu deňlemäniň [−20; 20] aralykda hakyky köki tapylmady.'); return textPlan(lines.join('\n\n')); }
        var dnode = null; try { var dp0 = pol && !pol.den ? polyOf(M().derivative(gexpr, 'x')) : null; dnode = dp0 ? M().parse(polyStr(dp0.c)) : M().simplify(M().derivative(diff, 'x')); } catch (e) { dnode = null; }
        if (method === 'newton') {
          var df = dnode ? fxOf(dnode) : function (x) { return (f(x + 1e-6) - f(x - 1e-6)) / 2e-6; };
          var x = Math.round(r0 * 2) / 2; if (Math.abs(df(x)) < 1e-9) x += 0.5;
          var rowsN = [];
          for (var it = 0; it < 20; it++) {
            var fx = f(x), dfx = df(x), x1 = x - fx / dfx;
            rowsN.push('| ' + it + ' | ' + dec(x, 6) + ' | ' + dec(fx, 6) + ' | ' + dec(dfx, 6) + ' | ' + dec(x1, 6) + ' |');
            if (!isFinite(x1) || Math.abs(x1 - x) < 1e-7) { x = x1; break; }
            x = x1;
          }
          lines.push('**Nýutonyň usuly:** $f(x) = ' + texOf(gexpr) + '$, $f\'(x) = ' + (dnode ? texOf(dnode) : '…') + '$. Formula: $$x_{n+1} = x_n - \\frac{f(x_n)}{f\'(x_n)}$$ Başlangyç ýakynlaşma $x_0 = ' + rowsN[0].split('|')[2].trim().replace('−', '-') + '$ (grafikde köke ýakyn nokat).');
          lines.push('| $n$ | $x_n$ | $f(x_n)$ | $f\'(x_n)$ | $x_{n+1}$ |\n|---|---|---|---|---|\n' + rowsN.join('\n'));
          lines.push('Iki yzygider ýakynlaşmanyň tapawudy $10^{-7}$-den kiçi boldy — usul kwadratik tizlik bilen ýygnandy. **Jogap:** $x \\approx ' + dec(x, 6) + '$' + (rs.length > 1 ? ' (deňlemäniň beýleki kökleri: $' + rs.slice(1).map(function (q) { return 'x \\approx ' + dec(q, 6); }).join(',\\ ') + '$)' : ''));
          roots = rs.map(function (q) { return { v: q, tex: dec(q, 6), txt: '≈ ' + dec(q, 6), exact: false }; });
        } else {
          var aa = Math.floor(r0), bb = aa + 1;
          if (f(aa) * f(bb) > 0) { aa = r0 - 0.5; bb = r0 + 0.5; }
          var rowsB = [], fa = f(aa);
          for (var j = 0; j < 12; j++) {
            var cm = (aa + bb) / 2, fc = f(cm);
            rowsB.push('| ' + (j + 1) + ' | ' + dec(aa, 6) + ' | ' + dec(bb, 6) + ' | ' + dec(cm, 6) + ' | ' + dec(fc, 6) + ' |');
            if ((fa < 0) === (fc < 0)) { aa = cm; fa = fc; } else bb = cm;
          }
          lines.push('**Ýarpylatma usuly:** $f(x) = ' + texOf(gexpr) + '$ funksiýa $[' + rowsB[0].split('|')[2].trim() + ';\\ ' + rowsB[0].split('|')[3].trim() + ']$ aralygyň uçlarynda dürli alamatly, şonuň üçin aralykda kök bar. Her ädimde orta nokat $c = \\frac{a + b}{2}$ alynýar we alamat üýtgeýän ýarysy saklanýar:');
          lines.push('| $n$ | $a$ | $b$ | $c$ | $f(c)$ |\n|---|---|---|---|---|\n' + rowsB.join('\n'));
          lines.push('12 ädimden soň aralygyň uzynlygy $\\frac{1}{2^{12}} \\approx 0.00024$. **Jogap:** $x \\approx ' + dec((aa + bb) / 2, 4) + '$ (takyk kök $x \\approx ' + dec(r0, 8) + '$).');
          roots = rs.map(function (q) { return { v: q, tex: dec(q, 6), txt: '≈ ' + dec(q, 6), exact: false }; });
        }
      } else {
        lines.push('Bu deňlemäni algebraik formula bilen çözüp bolmaýar, şonuň üçin kökleri **san usuly** bilen tapýarys: $f(x) = ' + texOf(gexpr) + '$ funksiýanyň alamaty üýtgeýän ýerlerini gözläp, ýarpylatma we Nýutonyň usuly bilen takyklaýarys.');
        roots = rs.map(function (q) { var nn = nice(q); return { v: q, tex: nn.tex, txt: nn.exact ? nn.txt : '≈ ' + nn.txt, exact: nn.exact }; });
        if (roots.length) lines.push('**Barlag:** ' + roots.slice(0, 6).map(function (r) { return '$f(' + (r.exact ? r.tex : dec(r.v, 6)) + ') \\approx ' + dec(f(r.v), 3).replace('−', '-') + '$'; }).join(', ') + ' ✓');
      }
    }
    if (!method) {
      if (roots.length) lines.push('**Jogap:** $' + (roots.length === 1 ? vr + ' ' + (roots[0].exact ? '= ' : '\\approx ') + roots[0].tex : roots.map(function (r, i) { return vr + '_{' + (i + 1) + '} ' + (r.exact ? '= ' : '\\approx ') + r.tex; }).join(',\\quad ')) + '$');
      else if (!lines.some(function (l) { return /hakyky köki ýok/.test(l); })) lines.push('**Jogap:** hakyky kök tapylmady' + (pol ? '.' : ' ([−1000; 1000] aralykda).'));
    }
    var real = roots.filter(function (r) { return isFinite(r.v); });
    var lo = real.length ? Math.min.apply(null, real.map(function (r) { return r.v; })) : -3, hi = real.length ? Math.max.apply(null, real.map(function (r) { return r.v; })) : 3, pad = Math.max(2, (hi - lo) * 0.35);
    var yr = {};
    if (pol && !pol.den && pol.deg === 2) {                     /* parabola: depesi we kökleri görünýän penjire */
      var xv = pol.c[1].neg().div(pol.c[2].mul(2)).valueOf(), yv = polyAt(pol.c, toFrac(xv) || F(0)).valueOf(), sp = Math.max(2, Math.abs(yv));
      if (!real.length) { lo = xv - 2; hi = xv + 2; }
      yr = { y_min: Math.min(0, yv) - 0.8 * sp, y_max: Math.max(0, yv) + 0.8 * sp };
    }
    if (tutor() && pol && pol.deg === 2 && !method) {
      return textPlan(lines[0] + '\n\n**Maslahat:** deňlemäni $ax^2 + bx + c = 0$ görnüşe getiriň, $a$, $b$, $c$ koeffisiýentleri ýazyň we diskriminanty hasaplaň: $D = b^2 - 4ac$. Soň $x_{1,2} = \\frac{-b \\pm \\sqrt{D}}{2a}$. Jogabyňyzy Wiýetiň teoremasy bilen barlaň: $x_1 + x_2 = -\\frac{b}{a}$, $x_1 x_2 = \\frac{c}{a}$.\n\nDoly çözgüdi görmek üçin «Düşündir» režimine geçiň.');
    }
    return {
      text: lines.join('\n\n'),
      tools: [{ name: 'plot_graph', input: Object.assign({ title: 'Grafiki barlag', functions: [{ expr: gexpr.toString(), label: 'y = ' + plain(gexpr) }], x_min: lo - pad, x_max: hi + pad, points: real.slice(0, 10).map(function (r, i) { return { x: r.v, y: 0, label: real.length > 1 ? 'x' + '₁₂₃₄₅₆₇₈₉'[i] : 'x' }; }) }, yr) }],
      after: function (items) {
        var d = items[0] && items[0].data, z = d && d.curves && d.curves[0] ? d.curves[0].zeros : null;
        var ok = z && real.every(function (r) { return r.v < lo - pad || r.v > hi + pad || z.some(function (q) { return Math.abs(q - r.v) < 1e-3; }); });
        return (real.length ? (ok ? 'Grafiki barlag: $y = ' + texOf(gexpr) + '$ egrisi Ox okuny tapylan nokatlarda kesýär ✓' : 'Grafik çyzyldy — kökleri grafikden hem barlap bilersiňiz.') : 'Grafik Ox okuny kesmeýär — hakyky kök ýok ✓') +
          '\n\n' + (method ? link('San usullary: ' + (method === 'newton' ? 'Nýutonyň usuly' : 'ýarpylatma usuly'), 'san-usullary/index.html#' + (method === 'newton' ? 'newton-usuly' : 'yarpylatma-usuly')) : link('Algebra: deňlemeler', 'algebra/index.html'));
      }
    };
  }

  /* --- grafik we funksiýany derňemek */
  function analyse(node, win) {
    win = win || [-20, 20];
    var f = fxOf(node), out = { lines: [], pts: [] };
    var pol = polyOf(node), d1 = null, d2 = null;
    try { d1 = M().simplify(M().derivative(node, 'x')); d2 = M().simplify(M().derivative(d1, 'x')); } catch (e) { d1 = d2 = null; }
    var ok = 0, fin = function (x) { return isFinite(f(x)); };
    for (var t = -50; t <= 50; t += 0.25) if (fin(t)) ok++;
    if (pol && !pol.den) out.lines.push('**Kesgitleniş ýaýlasy:** $x \\in \\mathbb{R}$ (köpagza).');
    else if (pol && pol.den) {
      var dz = polyOf(pol.den), bad = dz && dz.deg >= 1 && dz.deg <= 4 ? solvePoly(dz.c, []).map(function (r) { return r; }) : [];
      out.bad = bad.map(function (r) { return r.v; });
      out.lines.push('**Kesgitleniş ýaýlasy:** ' + (bad.length ? '$x \\ne ' + bad.map(function (r) { return r.tex; }).join(',\\ x \\ne ') + '$ (maýdalawjy nola deň bolmaly däl)' : '$x \\in \\mathbb{R}$') + '.');
    } else if (ok < 401) {
      var segs = [], inside = false, a0 = null;
      for (var s = -50; s <= 50.0001; s += 0.05) { var fi = fin(s); if (fi && !inside) { inside = true; a0 = s; } else if (!fi && inside) { inside = false; segs.push([a0, s - 0.05]); } }
      if (inside) segs.push([a0, Infinity]);
      if (segs.length && segs.length <= 3) out.lines.push('**Kesgitleniş ýaýlasy** (san barlagy): ' + segs.map(function (q) { var A = q[0] <= -49.9 ? '(-\\infty' : (fin(Math.round(q[0] * 1e6) / 1e6) ? '[' : '(') + nice(Math.round(q[0] * 1e4) / 1e4).tex; var Bq = q[1] === Infinity ? '+\\infty)' : nice(Math.round(q[1] * 1e4) / 1e4).tex + ']'; return '$' + A + ';\\ ' + Bq + '$'; }).join(' $\\cup$ ') + '.');
    }
    var sym = [0.7, 1.3, 2.1, 3.7].map(function (x) { return [f(x), f(-x)]; }).filter(function (p) { return isFinite(p[0]) && isFinite(p[1]); });
    if (sym.length >= 3) {
      if (sym.every(function (p) { return Math.abs(p[0] - p[1]) < 1e-9 * Math.max(1, Math.abs(p[0])); })) out.lines.push('**Jübütlik:** $f(-x) = f(x)$ — jübüt funksiýa, grafik Oy okuna görä simmetrik.');
      else if (sym.every(function (p) { return Math.abs(p[0] + p[1]) < 1e-9 * Math.max(1, Math.abs(p[0])); })) out.lines.push('**Jübütlik:** $f(-x) = -f(x)$ — täk funksiýa, grafik koordinata başlangyjyna görä simmetrik.');
    }
    var zeros;
    if (pol && pol.deg >= 1 && pol.deg <= 6) { zeros = solvePoly(pol.c, []); if (pol.den) { var dzf = fxOf(pol.den); zeros = zeros.filter(function (r) { return Math.abs(dzf(r.v)) > 1e-9; }); } }
    else zeros = rootsIn(f, win[0], win[1], 8000).map(function (q) { var nn = nice(q); return { v: q, tex: nn.tex, exact: nn.exact }; });
    zeros.sort(function (p, q) { return p.v - q.v; });
    if (hasFn(node, ['sin', 'cos', 'tan', 'cot'])) {
      var per = [Math.PI / 2, Math.PI, 2 * Math.PI, 4 * Math.PI].filter(function (T) { return [0.3, 1.1, 2.5, -0.7].every(function (x) { var a = f(x), b = f(x + T); return isFinite(a) && isFinite(b) && Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a)); }); })[0];
      if (per) out.lines.push('**Periodlylyk:** $f(x + ' + nice(per).tex + ') = f(x)$ — funksiýa periodik (esasy periody $T = ' + nice(per).tex + '$); aşakda $[' + nice(win[0]).tex + ';\\ ' + nice(win[1]).tex + ']$ aralyk derňelýär.');
    }
    out.zeros = zeros;
    out.lines.push('**Nollary** ($f(x) = 0$): ' + (zeros.length ? '$' + zeros.slice(0, 8).map(function (r) { return 'x ' + (r.exact ? '= ' : '\\approx ') + r.tex; }).join(',\\ ') + '$' + (zeros.length > 8 ? ' …' : '') : 'hakyky noly ýok') + '.');
    zeros.slice(0, 8).forEach(function (r) { out.pts.push({ x: r.v, y: 0, label: '(' + iTxt(r.v) + '; 0)' }); });
    if (isFinite(f(0))) { out.lines.push('**Oy oky bilen kesişmesi:** $f(0) ' + eqT(f(0)) + '$.'); if (!zeros.some(function (r) { return Math.abs(r.v) < 1e-9; })) out.pts.push({ x: 0, y: f(0), label: '(0; ' + iTxt(f(0)) + ')' }); }
    if (d1) {
      var df = fxOf(d1), dp = polyOf(d1), crit;
      if (dp && dp.deg >= 1 && dp.deg <= 4 && !dp.den) crit = solvePoly(dp.c, []);
      else if (dp && dp.deg === 0 && !dp.den) crit = [];
      else crit = rootsIn(df, win[0], win[1], 8000).map(function (q) { var nn = nice(q); return { v: q, tex: nn.tex, exact: nn.exact }; });
      crit = crit.filter(function (r) { return isFinite(f(r.v)); }).sort(function (p, q) { return p.v - q.v; });
      out.lines.push('**Önüm:** $f\'(x) = ' + texOf(d1) + '$' + (crit.length ? '; $f\'(x) = 0 \\Rightarrow ' + crit.slice(0, 8).map(function (r) { return 'x ' + (r.exact ? '= ' : '\\approx ') + r.tex; }).join(',\\ ') + '$ (kritiki nokatlar).' : (dp && dp.deg === 0 ? ' — hemişelik alamatly.' : '; kritiki nokat ýok.')));
      var cuts = crit.map(function (r) { return r.v; }).concat(out.bad || []).sort(function (a, b) { return a - b; });
      var periodic = out.lines.some(function (l) { return /Periodlylyk/.test(l); });
      if (cuts.length <= 8) {
        var edges = (periodic ? [win[0]] : [-Infinity]).concat(cuts, periodic ? [win[1]] : [Infinity]), mono = [];
        for (var i = 0; i < edges.length - 1; i++) {
          var a = edges[i], b = edges[i + 1], tt = a === -Infinity ? (b === Infinity ? 0 : b - 1) : b === Infinity ? a + 1 : (a + b) / 2, v = df(tt);
          if (isFinite(v) && Math.abs(v) > 1e-12) mono.push('$' + intervalText({ a: a, b: b, ca: periodic && i === 0, cb: periodic && i === edges.length - 2 }) + '$ — ' + (v > 0 ? 'artýar' : 'kemelýär'));
        }
        if (mono.length) out.lines.push('**Monotonlyk:** ' + mono.join(', ') + '.');
        var ext = [];
        crit.forEach(function (r) {
          var h = 1e-4 * Math.max(1, Math.abs(r.v)), l = df(r.v - h), rr = df(r.v + h);
          if (!isFinite(l) || !isFinite(rr)) return;
          var y = f(r.v), yt = nice(y);
          out.pts = out.pts.filter(function (p) { return Math.abs(p.x - r.v) > 1e-9; });
          if (l > 0 && rr < 0) { ext.push('$x ' + (r.exact ? '= ' : '\\approx ') + r.tex + '$ — lokal maksimum, $f ' + (yt.exact ? '= ' : '\\approx ') + yt.tex + '$'); out.pts.push({ x: r.v, y: y, label: 'max (' + iTxt(r.v) + '; ' + iTxt(y) + ')' }); }
          else if (l < 0 && rr > 0) { ext.push('$x ' + (r.exact ? '= ' : '\\approx ') + r.tex + '$ — lokal minimum, $f ' + (yt.exact ? '= ' : '\\approx ') + yt.tex + '$'); out.pts.push({ x: r.v, y: y, label: 'min (' + iTxt(r.v) + '; ' + iTxt(y) + ')' }); }
        });
        if (ext.length) out.lines.push('**Ekstremumlar:** ' + ext.join('; ') + '.');
        out.ext = ext.length;
      }
      if (d2 && pol && !pol.den && pol.deg >= 3) {
        var d2p = polyOf(d2), infl = d2p && d2p.deg >= 1 && d2p.deg <= 4 ? solvePoly(d2p.c, []) : [];
        if (infl.length) out.lines.push('**Egrilik nokatlary** ($f\'\'(x) = ' + texOf(d2) + ' = 0$): $' + infl.map(function (r) { return 'x ' + (r.exact ? '= ' : '\\approx ') + r.tex; }).join(',\\ ') + '$ — grafik çukurdan güberçege (ýa-da tersine) geçýär.');
      }
      if (pol && pol.deg === 2 && !pol.den) {
        var A = pol.c[2], Bc = pol.c[1], x0 = Bc.neg().div(A.mul(2)), y0 = polyAt(pol.c, x0);
        out.lines.unshift('Bu **parabola** ($a = ' + fT(A) + (A.compare(0) > 0 ? ' > 0$ — şahalary ýokaryk' : ' < 0$ — şahalary aşak') + '). Depesi: $x_0 = -\\frac{b}{2a} = ' + fT(x0) + '$, $y_0 = f(x_0) = ' + fT(y0) + '$ — $(' + fT(x0) + ';\\ ' + fT(y0) + ')$; simmetriýa oky $x = ' + fT(x0) + '$.');
      }
    }
    if (pol && pol.den) {
      var nd = polyOf(pol.den), nn2 = pol.deg, dd = nd ? nd.deg : 0;
      if (nn2 < dd) out.lines.push('**Asimptotalar:** ' + (out.bad && out.bad.length ? 'dik — $x = ' + out.bad.map(function (x) { return nice(x).tex; }).join(',\\ x = ') + '$; ' : '') + 'kese — $y = 0$.');
      else if (nn2 === dd && nd) out.lines.push('**Asimptotalar:** ' + (out.bad && out.bad.length ? 'dik — $x = ' + out.bad.map(function (x) { return nice(x).tex; }).join(',\\ x = ') + '$; ' : '') + 'kese — $y = ' + fT(pol.c[nn2].div(nd.c[dd])) + '$.');
      else if (out.bad && out.bad.length) out.lines.push('**Dik asimptotalar:** $x = ' + out.bad.map(function (x) { return nice(x).tex; }).join(',\\ x = ') + '$.');
    }
    return out;
  }
  function graphPlan(fns, c) {
    var many = fns.length > 1, lines = [], pts = [];
    var trig = fns.some(function (q) { return hasFn(q.node, ['sin', 'cos', 'tan', 'cot']); });
    var xs = [];
    if (!many) {
      var A = analyse(fns[0].node, trig ? [-2 * Math.PI, 2 * Math.PI] : [-20, 20]);
      lines.push('**Funksiýany derňeýäris:** $f(x) = ' + texOf(fns[0].node) + '$');
      lines.push(A.lines.map(function (l, i) { return (i + 1) + '. ' + l; }).join('\n'));
      pts = A.pts;
      (A.zeros || []).forEach(function (r) { xs.push(r.v); });
      A.pts.forEach(function (p) { xs.push(p.x); });
    } else {
      lines.push('**Funksiýalar:** ' + fns.map(function (q) { return '$' + (q.label === 'y' ? 'y' : q.label) + ' = ' + texOf(q.node) + '$'; }).join(', '));
      var inter = [];
      for (var i = 0; i < fns.length; i++) for (var j = i + 1; j < fns.length; j++) {
        var fa = fxOf(fns[i].node), fb = fxOf(fns[j].node), lo = trig ? -2 * Math.PI : -20, hi = trig ? 2 * Math.PI : 20;
        var rs = rootsIn(function (x) { return fa(x) - fb(x); }, lo, hi, 8000);
        rs.forEach(function (x) { inter.push({ x: x, y: fa(x) }); xs.push(x); });
      }
      if (inter.length) {
        lines.push('**Kesişme nokatlary** ($' + fns.map(function (q) { return texOf(q.node); }).join(' = ') + '$ deňlemäniň kökleri' + (trig ? ', $[-2\\pi;\\ 2\\pi]$ aralykda' : '') + '):\n' + inter.slice(0, 10).map(function (p) { var nx = nice(p.x), ny = nice(p.y); return '- $(' + (nx.exact ? nx.tex : '\\approx ' + nx.tex) + ';\\ ' + (ny.exact ? ny.tex : '\\approx ' + ny.tex) + ')$'; }).join('\n'));
        pts = inter.slice(0, 10).map(function (p) { return { x: p.x, y: p.y, label: '(' + iTxt(p.x) + '; ' + iTxt(p.y) + ')' }; });
      } else lines.push('Grafikler ' + (trig ? '$[-2\\pi;\\ 2\\pi]$' : '$[-20;\\ 20]$') + ' aralykda kesişmeýär.');
    }
    var lo2, hi2;
    if (trig) { lo2 = -2 * Math.PI; hi2 = 2 * Math.PI; }
    else if (xs.length) { var mn = Math.min.apply(null, xs), mx = Math.max.apply(null, xs), pad = Math.max(2, (mx - mn) * 0.35); lo2 = Math.max(-50, mn - pad); hi2 = Math.min(50, mx + pad); if (hi2 - lo2 < 4) { lo2 -= 2; hi2 += 2; } }
    else { lo2 = -6; hi2 = 6; }
    if (!trig && fns.some(function (q) { return hasFn(q.node, ['log', 'sqrt', 'log10', 'log2']); }) && lo2 < 0) lo2 = Math.min(-1, lo2 / 4);
    var yr = {};
    if (!many && pts.length >= 2) {
      var ys = pts.map(function (p) { return p.y; }).filter(isFinite), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), sp = Math.max(2, y1 - y0);
      if (xs.length) { var x0p = Math.min.apply(null, xs), x1p = Math.max.apply(null, xs), padx = Math.max(1.2, (x1p - x0p) * 0.3); lo2 = Math.max(lo2, x0p - padx); hi2 = Math.min(hi2, x1p + padx); }
      yr = { y_min: y0 - sp * 0.6, y_max: y1 + sp * 0.6 };
    }
    return {
      text: lines.join('\n\n'),
      tools: [{ name: 'plot_graph', input: Object.assign({ title: many ? 'Grafikler we kesişme nokatlary' : 'y = ' + plain(fns[0].node), functions: fns.slice(0, 5).map(function (q, i) { return { expr: q.node.toString(), label: (q.label === 'y' ? (many ? ['f', 'g', 'h', 'p', 'q'][i] + '(x)' : 'y') : q.label) + ' = ' + plain(q.node) }; }), x_min: lo2, x_max: hi2, points: pts.slice(0, 12) }, yr) }],
      after: function (items) {
        var d = items[0] && items[0].data;
        if (!d) return 'Grafik çyzylmady' + (items[0] && items[0].error ? ': ' + items[0].error : '.');
        var out = 'Grafik ';
        if (many) out += d.intersections && d.intersections.length ? 'kesişme nokatlaryny tassyklaýar ✓ (nokatlaryň üstüne syçanjygy getirseňiz bahalar görünýär).' : 'çyzyldy.';
        else out += 'derňewi tassyklaýar ✓ Grafigi süýşürip (çekip) we ulaldyp/kiçeldip bilersiňiz.';
        return out + '\n\n' + link('Funksiýalar', 'kalkulus/kalkulus-funksiyalar.html') + ' · ' + link('Önümiň ulanylyşy: ekstremumlar', 'kalkulus/kalkulus-onum-ulanylysy.html');
      }
    };
  }

  /* --- deňleme, deňsizlik, grafik: formulalara görä */
  intent('formula', function (c) {
    var f = c.f, graphWord = /(grafik|cyz|dern|parabola|giperbola|egri|kesisme|ekstremum|kritiki|monoton|artyan|kemelyan|kesgitlenis)/.test(f);
    var defs = c.spans.map(asDef).filter(Boolean);
    if (graphWord && /normal paylan/.test(f)) return null;
    if (defs.length && (graphWord || !/(coz|kok|tap)/.test(f) || defs.length > 1)) return graphPlan(defs.slice(0, 5), c);
    for (var i = 0; i < c.spans.length; i++) {
      if (asDef(c.spans[i])) continue;                       /* «f(x) = …» — funksiýanyň kesgitlemesi, deňleme däl */
      var k = splitCmp(c.spans[i]);
      if (!k || k.op === '!=' || k.op === '==') continue;
      var vs = varsOf(k.nl).concat(varsOf(k.nr)).filter(function (v, j, a) { return a.indexOf(v) === j; });
      if (vs.length !== 1) continue;
      var v = vs[0];
      if (v !== 'x') { k = { op: k.op, L: k.L, R: k.R, nl: rename(k.nl, v, 'x'), nr: rename(k.nr, v, 'x') }; k.L = k.nl.toString(); k.R = k.nr.toString(); }
      c.v = v;
      if (k.op === '=') {
        if (hasFn(k.nl, ['sin', 'cos', 'tan', 'cot']) || hasFn(k.nr, ['sin', 'cos', 'tan', 'cot'])) {
          if (v === 'x') return trigPlan(c.spans[i], k);
          return trigPlan(k.L + ' = ' + k.R, k);
        }
        return equationPlan(k, c);
      }
      return inequalityPlan(k, c);
    }
    if (defs.length) return graphPlan(defs.slice(0, 5), c);
    if (graphWord) {
      var ex = c.spans.map(function (s) { return P(s); }).filter(function (nn) { return nn && !/[=<>]/.test(nn.toString()) && varsOf(nn).length === 1 && varsOf(nn)[0] === 'x'; });
      if (ex.length) return graphPlan(ex.slice(0, 5).map(function (nn) { return { label: 'y', node: nn }; }), c);
    }
    return null;
  });

  /* --- köpagzany köpeldijilere dagytmak */
  intent('factor', function (c) {
    if (!/kopeldijilere dagyt|kopeldijä dagyt|kopeldijilere bol|faktorla|factor/.test(c.f)) return null;
    var cand = c.spans.map(function (s) { var d = asDef(s); return d ? d.node : P(s); }).filter(function (nn) { return nn && !/[=<>]/.test(nn.toString()) && varsOf(nn).length === 1; });
    if (!cand.length) return null;
    var node = cand[0], v = varsOf(node)[0];
    if (v !== 'x') node = rename(node, v, 'x');
    var pol = polyOf(node);
    if (!pol || pol.den || pol.deg < 2 || pol.deg > 4) return null;
    var lines = ['**Köpagza:** $' + polyTeX(pol.c) + '$'], tmp = [], roots = solvePoly(pol.c, tmp);
    var lead = pol.c[pol.c.length - 1], rat = roots.filter(function (r) { return r.exact && /^-?(\\frac\{\d+\}\{\d+\}|\d+)$/.test(r.tex); });
    var mult = function (r) { var t = toFrac(r.v); return '\\left(x ' + (t.compare(0) < 0 ? '+ ' + fT(t.neg()) : '- ' + fT(t)) + '\\right)'; };
    lines.push('$' + polyTeX(pol.c) + ' = 0$ deňlemäniň kökleri: ' + (roots.length ? '$' + roots.map(function (r) { return 'x ' + (r.exact ? '= ' : '\\approx ') + r.tex; }).join(',\\ ') + '$' : 'hakyky kök ýok') + '.');
    if (rat.length === pol.deg) {
      lines.push('Köküň her biri bir köpeldiji berýär: $a(x - x_1)(x - x_2)\\ldots$ — **Jogap:** $$' + polyTeX(pol.c) + ' = ' + (lead.equals(1) ? '' : lead.equals(-1) ? '-' : fT(lead)) + rat.map(mult).join('') + '$$');
    } else if (pol.deg === 2 && roots.length === 2) {
      var fac = function (t) { return /^-[^+\-]*$/.test(t) ? '\\left(x + ' + t.slice(1) + '\\right)' : /^[^+\-]*$/.test(t) ? '\\left(x - ' + t + '\\right)' : '\\left(x - \\left(' + t + '\\right)\\right)'; };
      lines.push('Kökler irrasional — köpagza diňe hakyky sanlar köplüginde köpeldijilere dagaýar: $$' + polyTeX(pol.c) + ' = ' + (lead.equals(1) ? '' : fT(lead)) + fac(roots[0].tex) + fac(roots[1].tex) + '$$');
    } else if (rat.length) {
      var rest = pol.c.slice(); rat.forEach(function (r) { rest = deflate(rest, toFrac(r.v)); });
      lines.push('**Jogap:** $$' + polyTeX(pol.c) + ' = ' + rat.map(mult).join('') + '\\left(' + polyTeX(rest) + '\\right)$$ (soňky köpeldiji rasional köpeldijilere dagamaýar).');
    } else lines.push('Bu köpagza rasional köpeldijilere dagamaýar.');
    return textPlan(lines.join('\n\n') + '\n\n' + link('Algebra', 'algebra/index.html'));
  });

  /* --- diňe aňlatma (x bilen): funksiýany derňemek we grafik */
  intent('expr', function (c) {
    if (c.spans.length !== 1 || /(coz|tap|hasapla)/.test(c.f) && !/(funksiya|grafik|dern)/.test(c.f)) return null;
    var nn = P(c.spans[0]);
    if (!nn || /[=<>]/.test(nn.toString()) || varsOf(nn).length !== 1 || varsOf(nn)[0] !== 'x' || c.text.replace(/\s+/g, '').length > 80) return null;
    return graphPlan([{ label: 'y', node: nn }], c);
  });

  /* --- arifmetika: takyk droblar */
  intent('arith', function (c) {
    var cand = c.spans.filter(function (s) { var nn = P(s); return nn && !varsOf(nn).length && /[-+*\/^!]|sqrt|sin|cos|tan|log|abs|exp/.test(s) && !/[=<>]/.test(s); });
    if (!cand.length) return null;
    var s = cand.sort(function (a, b) { return b.length - a.length; })[0], node = P(s);
    var exact = fracEval(node), val = realOf((function () { try { return node.compile().evaluate(); } catch (e) { return NaN; } })());
    if (!isFinite(val) && !exact) return null;
    var lines = [];
    var fr = [];
    node.traverse(function (n) { if (n.isOperatorNode && n.fn === 'divide' && n.args[0].isConstantNode && n.args[1].isConstantNode) fr.push(n); });
    var sumOnly = true;
    node.traverse(function (n) { if (n.isOperatorNode && !/^(add|subtract|divide|unaryMinus)$/.test(n.fn)) sumOnly = false; if (n.isFunctionNode) sumOnly = false; });
    if (exact && sumOnly && fr.length >= 2) {
      var dens = fr.map(function (n) { return Number(n.args[1].value); }), L = dens.reduce(lcm, 1);
      var terms = [], ok = true;
      (function walk(n, sign) {
        if (n.isParenthesisNode) return walk(n.content, sign);
        if (n.isOperatorNode && n.fn === 'add') { walk(n.args[0], sign); walk(n.args[1], sign); return; }
        if (n.isOperatorNode && n.fn === 'subtract') { walk(n.args[0], sign); walk(n.args[1], -sign); return; }
        if (n.isOperatorNode && n.fn === 'unaryMinus') { walk(n.args[0], -sign); return; }
        var q = fracEval(n);
        if (!q) { ok = false; return; }
        terms.push({ sign: sign, f: q, num: n.isOperatorNode && n.fn === 'divide' ? Number(n.args[0].value) : Number(q.valueOf()), den: n.isOperatorNode && n.fn === 'divide' ? Number(n.args[1].value) : 1 });
      })(node, 1);
      if (ok && terms.length >= 2 && terms.every(function (t) { return isInt(t.num) && isInt(t.den); })) {
        lines.push('**Umumy maýdalawjy** — maýdalawjylaryň iň kiçi umumy köpeltmek sany: $\\text{IUKS}(' + terms.map(function (t) { return t.den; }).join(', ') + ') = ' + L + '$.');
        lines.push('**Goşmaça köpeldijiler:** ' + terms.map(function (t) { return '$' + L + ' : ' + t.den + ' = ' + (L / t.den) + '$'; }).join(', ') + '.');
        var sgn = function (t, i) { return (t.sign < 0 ? (i ? ' - ' : '-') : (i ? ' + ' : '')); };
        var orig = terms.map(function (t, i) { return sgn(t, i) + (t.den === 1 ? String(t.num) : '\\frac{' + t.num + '}{' + t.den + '}'); }).join('');
        var scaled = terms.map(function (t, i) { return sgn(t, i) + '\\frac{' + t.num + '\\cdot ' + (L / t.den) + '}{' + L + '}'; }).join('');
        var nums = terms.map(function (t, i) { return sgn(t, i) + (t.num * L / t.den); }).join('');
        var mixed = fMixed(exact);
        lines.push('$$' + orig + ' = ' + scaled + ' = \\frac{' + nums + '}{' + L + '} = ' + fT(exact) + (mixed && mixed !== fT(exact) ? ' = ' + mixed : '') + '$$');
        var red = terms.reduce(function (s2, t) { return s2 + t.sign * t.num * L / t.den; }, 0);
        if (gcd(red, L) > 1 && Number(exact.d) !== L) lines.push('Drob $' + gcd(red, L) + '$-e gysgaldyldy.');
        lines.push('**Jogap:** $' + fT(exact) + (mixed && mixed !== fT(exact) ? ' = ' + mixed : '') + (fInt(exact) ? '' : ' \\approx ' + dec(exact.valueOf())) + '$');
        lines.push(link('Kesirleri goşmak we aýyrmak', 'on-algebra/index.html#kesirleri-gosmak-we-ayyrmak'));
        return { text: lines.join('\n\n'), tools: [{ name: 'calculate', input: { expressions: [s, 'fraction(' + s + ')'] } }], after: function () { return 'math.js bilen barlandy ✓'; } };
      }
    }
    var res = exact ? fT(exact) + (fInt(exact) ? '' : (fMixed(exact) ? ' = ' + fMixed(exact) : '') + ' \\approx ' + dec(exact.valueOf(), 6)) : (nice(val).exact ? nice(val).tex + (isInt(val) ? '' : ' \\approx ' + dec(val, 6)) : '\\approx ' + dec(val, 8));
    lines.push('$$' + texOf(node) + ' = ' + res + '$$');
    if (!exact && /sqrt|sin|cos|tan|log|exp/.test(s)) lines.push('Bellik: funksiýalaryň bahalary onluk drob görnüşinde ýakynlaşdyrylyp hasaplanýar.');
    return { text: lines.join('\n\n'), tools: [{ name: 'calculate', input: { expressions: [s] } }], after: function (items) { var d = items[0] && items[0].data; return d && d[0] && !d[0].error ? 'math.js bilen barlandy: ' + d[0].result.replace(/-/g, '−') + ' ✓' : 'Barlag kartasyna serediň.'; } };
  });

  /* ============================================================ düşündiriş soraglary (bilim bazasy) */
  var KB = [
    { k: [/t-?test|student/, /haçan|hacan|name|ulan|haysy/], t: '**t-test** iki ortaçanyň (ýa-da bir ortaçanyň belli baha bilen) tapawudynyň tötänleýin däldigini barlaýar. Ony şu ýagdaýlarda ulanýarlar:\n\n- maglumatlar san görnüşinde (bal, agram, wagt) we takmynan **normal paýlanan**;\n- baş toplumyň dispersiýasy belli däl, nusga kiçi (adatça $n < 30$; uly nusgada t-test z-teste ýakynlaşýar);\n- gözegçilikler biri-birine bagly däl.\n\n**Görnüşleri:**\n1. **Bir nusgaly** — ortaça belli baha bilen deňeşdirilýär: $t = \\frac{\\bar{x} - \\mu_0}{s / \\sqrt{n}}$.\n2. **Iki garaşsyz nusgaly** — iki dürli topar (mysal: iki synp); dispersiýalar deň bolmasa, Welç t-testi ulanylýar.\n3. **Jübüt** — şol bir adamlar iki gezek ölçenýär (öňünden we soňundan): tapawutlaryň ortaçasy barlanýar.\n\n$|t|$ uly bolsa (p-baha < 0.05), tapawut statistik taýdan ähmiýetli. Maglumatlar normal paýlanmadyk bolsa, parametrik däl Mann–Whitney ýa-da Wilkokson barlagy saýlanýar.', l: [['Ortaçalary deňeşdirmek (t-test)', 'statistika/index.html#ortacalary-denesdirmek-t-test']] },
    { k: [/normal paylan|gauss egri|normal egri/], plot: { title: 'Standart normal paýlanyş φ(x)', functions: [{ expr: 'exp(-x^2/2)/sqrt(2*pi)', label: 'φ(x)' }], x_min: -4, x_max: 4, points: [{ x: -1, y: 0.2420, label: 'μ − σ' }, { x: 1, y: 0.2420, label: 'μ + σ' }], shade: { from: -1, to: 1 } },
      t: '**Normal paýlanyş** (Gauss paýlanyşy) $N(\\mu, \\sigma^2)$ dykyzlyk funksiýasy: $$f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}}\\, e^{-\\frac{(x - \\mu)^2}{2\\sigma^2}}$$\nGrafikde standart normal paýlanyş ($\\mu = 0$, $\\sigma = 1$). Egri $x = \\mu$ göni çyzyga görä simmetrik, iň ýokary nokady $x = \\mu$-de; $\\sigma$ näçe uly bolsa, egri şonça ýaýbaň.\n\n**68–95–99.7 düzgüni:** bahalaryň takmynan 68 %-i $\\mu \\pm \\sigma$ (grafikde boýalan ýer), 95 %-i $\\mu \\pm 2\\sigma$, 99.7 %-i $\\mu \\pm 3\\sigma$ aralykda ýatýar. Egriniň aşagyndaky jemi meýdan 1-e deň.', l: [['Normal paýlanyş kalkulýatory', 'statistika/index.html#normal-paylanys']] },
    { k: [/sar/, /gowrum/, /formula|nireden|nahili|subut|cykar/], t: 'Şaryň göwrümi $V = \\frac{4}{3}\\pi R^3$. Formulany integral bilen almak bolýar: şary galyňlygy $dx$ bolan inçe tegelek dilimlere bölýäris. Merkezden $x$ uzaklykdaky dilimiň radiusy $\\sqrt{R^2 - x^2}$, meýdany $\\pi(R^2 - x^2)$. Ähli dilimleri goşýarys: $$V = \\int_{-R}^{R} \\pi\\left(R^2 - x^2\\right)dx = \\pi\\left(R^2 x - \\frac{x^3}{3}\\right)\\Big|_{-R}^{R} = \\frac{4}{3}\\pi R^3$$\nArhimed muny integralsyz subut edipdir: şaryň göwrümi daşyndan çyzylan silindriň göwrüminiň $\\frac{2}{3}$ bölegine deň: $\\frac{2}{3}\\cdot \\pi R^2\\cdot 2R = \\frac{4}{3}\\pi R^3$. Üstüniň meýdany göwrümiň radius boýunça önümi: $S = \\frac{dV}{dR} = 4\\pi R^2$.', l: [['Integralyň ulanylyşy: göwrüm', 'kalkulus/kalkulus-integral-ulanylysy.html'], ['Geometriýa', 'geometriya/index.html']] },
    { k: [/towere|tegelek/, /uzynlyg/, /meydan/], t: '**Töweregiň uzynlygy** — tegelegiň gyrasynyň (çyzygyň) uzynlygy: $C = 2\\pi r = \\pi d$; ölçeg birligi uzynlyk (sm, m).\n\n**Tegelegiň meýdany** — töweregiň içindäki tekizligiň ölçegi: $S = \\pi r^2$; ölçeg birligi kwadrat (sm², m²).\n\nMysal: $r = 5$ sm bolsa, $C = 10\\pi \\approx 31.4$ sm, $S = 25\\pi \\approx 78.5$ sm². Radius 2 esse ulalsa, uzynlyk 2 esse, meýdan bolsa 4 esse ulalýar. Baglanyşyk: $S = \\frac{C\\cdot r}{2}$ — tegelegi inçe halkalara bölüp, olary «açsaňyz», esasy $C$, beýikligi $r$ bolan üçburçluk alynýar.', l: [['Geometriýa kalkulýatorlary', 'geometriya/index.html']] },
    { k: [/matrisa/, /kopelt/, /orun|calsyr|commut|kommut|nam/], t: 'Matrisalary köpeltmek «setir × sütün» düzgüni bilen ýerine ýetirilýär: $(AB)_{ij}$ — $A$-nyň $i$-nji setiri bilen $B$-niň $j$-nji sütüniniň skalýar köpeltmek hasyly. Şonuň üçin tertip möhüm: $AB$-de $A$-nyň setirleri, $BA$-da bolsa $B$-niň setirleri ulanylýar. Mysal: $$A = \\begin{pmatrix} 1 & 2 \\\\ 0 & 1 \\end{pmatrix},\\ B = \\begin{pmatrix} 0 & 1 \\\\ 1 & 0 \\end{pmatrix}:\\quad AB = \\begin{pmatrix} 2 & 1 \\\\ 1 & 0 \\end{pmatrix},\\quad BA = \\begin{pmatrix} 0 & 1 \\\\ 1 & 2 \\end{pmatrix}$$\n$AB \\ne BA$. Geometrik many: matrisa — tekizligiň öwrülmesi (aýlamak, süýndürmek, şöhlelendirmek); iki öwrülmäni dürli tertipde ýerine ýetirseňiz, netije üýtgeýär. Ölçegler hem päsgel berip biler: $A$ — $2\\times 3$, $B$ — $3\\times 4$ bolsa, $AB$ bar, $BA$ bolsa kesgitlenmedik. Käbir jübütler orun çalşyrýar: $A$ we birlik matrisa $E$, $A$ we $A^{-1}$, diagonal matrisalar.', l: [['Matrisa kalkulýatory', 'matrisa/index.html']] },
    { k: [/soz mesele|mesele/, /denleme|owur|duz/], t: 'Söz meselesini deňlemä öwürmegiň tertibi:\n\n1. **Näbellini saýlaň:** soralýan ululygy (ýa-da beýlekileri aňlatmak aňsat bolanyny) $x$ bilen belläň we manysyny ýazyň.\n2. **Galan ululyklary $x$ arkaly aňladyň:** «4 esse uly» → $4x$, «5 kiçi» → $x - 5$, «20 ýyldan soň» → $x + 20$.\n3. **Deňligi tapyň:** şol bir ululyk iki dürli ýol bilen aňladylýan ýeri gözläň («... deň bolar», «jemi ...», «näçe esse»).\n4. **Deňlemäni çözüň** we **jogaby şerte goýup barlaň** (ýaş otrisatel, adam sany drob bolmaly däl).\n\n**Mysal:** kakasy oglundan 4 esse uly, 20 ýyldan soň bolsa 2 esse uly bolar. Ogly $x$ ýaşynda, kakasy $4x$. 20 ýyldan soň: $4x + 20 = 2(x + 20) \\Rightarrow 2x = 20 \\Rightarrow x = 10$. Jogap: ogly 10, kakasy 40 ýaşynda. Barlag: 20 ýyldan 30 we 60 — 2 esse ✓', l: [['Meseläni çözmegiň ädimleri', 'soz-meseleleri/soz-gollanma.html'], ['Deňleme çözüji', 'soz-meseleleri/soz-denleme.html']] },
    { k: [/yarpylatma|bisek/, /yygnan|hemise|name ucin|nam/], t: '**Ýarpylatma usuly** üznüksiz funksiýa we $f(a)\\cdot f(b) < 0$ şerti bilen başlaýar. Aralyk baha teoremasy (Bolsano–Koşi) boýunça şeýle aralykda azyndan bir kök bar.\n\nHer ädimde orta nokat $c = \\frac{a + b}{2}$ alynýar we alamat üýtgeýän ýarysy saklanýar — kök hemişe aralygyň içinde galýar. Aralygyň uzynlygy her gezek 2 esse kiçelýär: $n$ ädimden soň $\\frac{b - a}{2^n}$. Şonuň üçin usul **hökman ýygnanýar** we ýalňyşlyk öňünden bellidir: mysal üçin, $[1;\\ 2]$ aralykda $10^{-6}$ takyklyk üçin $n \\ge \\log_2 10^6 \\approx 20$ ädim ýeterlik.\n\nKemçiligi — haýal (çyzykly) ýygnanýar. Nýutonyň usuly köküň golaýynda has çalt (kwadratik), ýöne başlangyç nokat erbet saýlansa ýygnanman biler. Synap görüň: «x³ − x − 2 = 0 deňlemäni ýarpylatma usuly bilen çöz».', l: [['San usullary: ýarpylatma', 'san-usullary/index.html#yarpylatma-usuly']] },
    { k: [/simpleks/, /cozuji|giriji|cykyan|sutun|setir|sayla/], t: '**Çözüji (giriji) sütün:** maksimum meselesinde Z-setirindäki iň uly otrisatel koeffisiýentli sütün saýlanýar — şol üýtgeýän bazise girende Z iň çalt ösýär. (Minimum meselesinde — iň uly položitel baha.) Z-setirinde otrisatel san galmasa, çözgüt optimal.\n\n**Çözüji (çykýan) setir:** saýlanan sütündäki diňe položitel elementler üçin $\\frac{b_i}{a_{ij}}$ gatnaşygy hasaplanýar we iň kiçisi saýlanýar. Bu «iň kiçi gatnaşyk» düzgüni täze çözgüdiň mümkin bolmagyny (ähli üýtgeýänler $\\ge 0$) üpjün edýär. Sütünde položitel element ýok bolsa — maksat funksiýasy çäklendirilmedik.\n\n**Çözüji element** — setir bilen sütüniň kesişmesi: Žordanyň öwrülmesi bilen ol 1-e, sütüniň galan elementleri 0-a öwrülýär. Gatnaşyklar deň bolsa (azgyn ýagdaý), islendigini saýlap bolýar, ýöne aýlanmagyň öňüni almak üçin Blendiň düzgüni ulanylýar.', l: [['Simpleks usuly ädimme-ädim', 'amal-barlagy/simpleks.html']] },
    { k: [/m-?usul|\bm usul|uly m/, /iki tapgyr/], t: 'Iki usul hem ≥ we = çäklendirmeli meselelerde **emeli üýtgeýänler** ($R_i$) bilen başlangyç bazis gurýar; tapawut — olary nädip ýok edýändiginde.\n\n**M-usuly:** emeli üýtgeýänler maksat funksiýasyna örän uly jerime bilen goşulýar ($\\max\\ Z - M\\sum R_i$); simpleks olary öz-özünden bazisden çykarýar. Bir tapgyrda çözülýär, ýöne «örän uly $M$» el bilen hasaplamakda gopbamsy, kompýuterde tegeleklenme ýalňyşyna sebäp bolup biler.\n\n**Iki tapgyrly usul:** 1-nji tapgyrda diňe emeli üýtgeýänleriň jemi minimallaşdyrylýar ($\\min W = \\sum R_i$). $W_{\\min} > 0$ bolsa — mümkin çözgüt ýok; $W_{\\min} = 0$ bolsa, 2-nji tapgyrda tapylan bazisden başlap esasy maksat funksiýasy optimallaşdyrylýar. $M$ ýok, şonuň üçin san taýdan durnukly.\n\nIki usul hem şol bir optimal jogaby berýär.', l: [['Simpleks: M-usuly we iki tapgyrly usul', 'amal-barlagy/simpleks.html']] },
    { k: [/kolege bahas|ikilenji baha|dual baha|shadow/], t: '**Kölege bahasy** $y_i$ — $i$-nji çäklendirmäniň sag tarapy (serişde) 1 birlik artanda maksat funksiýasynyň optimal bahasynyň näçe üýtgejekdigini görkezýär: $\\Delta Z \\approx y_i\\cdot \\Delta b_i$.\n\n**Mysal:** önümçilik meselesinde $y_2 = 1.5$ bolsa, 2-nji çig maldan ýene 1 kg tapmak girdejini 1.5 manat artdyrýar — şonuň üçin oňa 1.5 manatdan köp tölemek peýdasyz. Çäklendirme doly ulanylmasa (ätiýaç bar bolsa), onuň kölege bahasy 0: ol serişdäni köpeltmek hiç zat bermeýär.\n\nKölege bahalary ikilenji meseläniň optimal çözgüdi; güýçli ikilenjilik teoremasy boýunça $\\max Z = \\min W = \\sum b_i y_i$. Baha diňe optimal bazis üýtgemeýän çäkde dogry.', l: [['Simpleks: ikilenji mesele we kölege bahalary', 'amal-barlagy/simpleks.html']] },
    { k: [/modi|potensial/], t: 'Ulag meselesinde ilki **başlangyç** meýilnama (demirgazyk-günbatar burç, iň az baha ýa-da Vogel usuly bilen) tapylýar, ýöne ol adatça optimal däl. **MODI usuly** (potensiallar usuly) şu meýilnamanyň optimaldygyny barlaýar we gowulandyrýar:\n\n1. Her eýelenen öýjük üçin $u_i + v_j = c_{ij}$ deňlemelerinden potensiallar tapylýar ($u_1 = 0$ alyp).\n2. Boş öýjükler üçin baha hasaplanýar: $\\Delta_{ij} = c_{ij} - (u_i + v_j)$.\n3. Ähli $\\Delta_{ij} \\ge 0$ bolsa — meýilnama optimal.\n4. Otrisatel $\\Delta_{ij}$ bar bolsa, iň otrisatel öýjük üçin ýapyk aýlaw gurulýar, ýük aýlaw boýunça süýşürilýär we jemi çykdajy azalýar; 1-nji ädime gaýdylýar.\n\nŞeýlelik bilen MODI ähli meýilnamalary barlamazdan, başlangyç meýilnamadan optimal meýilnama gysga ýol bilen alyp barýar.', l: [['MODI usuly', 'amal-barlagy/modi.html']] },
    { k: [/demirgazyk|gunbatar|\bvogel/, /tapawut|deneş|denes|haysy|vogel/], t: 'Ikisi hem ulag meselesiniň **başlangyç** meýilnamasyny gurýar.\n\n**Demirgazyk-günbatar burç usuly** tablisanyň ýokarky çep öýjüginden başlap, bahalara seretmän ýük paýlaýar — iň ýönekeý we çalt, ýöne meýilnama köplenç gymmat bolýar.\n\n**Vogel usuly** (VAM) her setir we sütün üçin «jerimäni» — iki iň kiçi bahanyň tapawudyny — hasaplaýar we iň uly jerimeli hatarda iň arzan öýjüge ýük berýär. Has köp hasaplama gerek, ýöne meýilnama adatça optimala örän ýakyn ýa-da optimal bolýar, şonuň üçin MODI bilen gowulandyrmak az ädim talap edýär.\n\n**Iň az baha usuly** bu ikisiniň arasynda: ilki iň arzan öýjükler doldurylýar.', l: [['Demirgazyk-günbatar burç', 'amal-barlagy/demirgazyk-gunbatar.html'], ['Vogel usuly', 'amal-barlagy/vogel.html']] },
    { k: [/onum/, /name|manys|kesgitleme|dusunje|dusundir|nahili/], t: '**Önüm** — funksiýanyň üýtgeýiş tizligi: $$f\'(x) = \\lim_{h \\to 0} \\frac{f(x + h) - f(x)}{h}$$\n**Geometrik many:** $f\'(x_0)$ — grafigiň $x_0$ nokatdaky galtaşýan çyzygynyň burç koeffisiýenti. **Fiziki many:** ýoluň wagt boýunça önümi — tizlik.\n\nEsasy düzgünler: $(x^n)\' = nx^{n-1}$, $(\\sin x)\' = \\cos x$, $(e^x)\' = e^x$, $(\\ln x)\' = \\frac{1}{x}$; köpeltmek hasyly $(uv)\' = u\'v + uv\'$, paý $\\left(\\frac{u}{v}\\right)\' = \\frac{u\'v - uv\'}{v^2}$, çylşyrymly funksiýa $(f(g(x)))\' = f\'(g(x))\\cdot g\'(x)$.\n\nIslendik funksiýany ýazyň — önümini ädimme-ädim taparyn, mysal: «x³ − 3x funksiýanyň önümi».', l: [['Önüm sapagy', 'kalkulus/kalkulus-onum.html']] },
    { k: [/integral/, /name|manys|kesgitleme|dusunje|dusundir/], t: '**Integral** — önümiň ters amaly. Kesgitsiz integral: $\\int f(x)\\,dx = F(x) + C$, bu ýerde $F\'(x) = f(x)$.\n\n**Kesgitli integral** — Nýuton–Leýbnis formulasy: $\\int_a^b f(x)\\,dx = F(b) - F(a)$. Geometrik many: egriniň we Ox okunyň arasyndaky meýdan (okuň aşagyndaky bölek minus alamat bilen).\n\nEsasy usullar: tablisa integrallary, ornuna goýma ($t = g(x)$), bölekleýin integrirlemek $\\int u\\,dv = uv - \\int v\\,du$, rasional funksiýalary ýönekeý droblara dagytmak.\n\nIslendik integraly ýazyň — ädimme-ädim çözerin, mysal: «∫ x·eˣ dx» ýa-da «∫₀³ x² dx».', l: [['Integral sapagy', 'kalkulus/kalkulus-integral.html'], ['Integral usullary', 'kalkulus/kalkulus-integral-usullary.html']] },
    { k: [/limit/, /name|manys|kesgitleme|dusunje|dusundir/], t: '**Limit** — $x$ belli bir nokada ýakynlaşanda $f(x)$-iň ýakynlaşýan bahasy: $\\lim_{x \\to a} f(x) = L$. Funksiýanyň nokadyň özünde kesgitlenmegi hökman däl: $\\frac{\\sin x}{x}$ funksiýa $x = 0$-da kesgitlenmedik, ýöne $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$.\n\nHasaplamagyň tertibi: 1) nokady goýup görmek; 2) $\\frac{0}{0}$, $\\frac{\\infty}{\\infty}$ kesgitsizliklerde — köpeldijilere dagytmak, ýönekeýleşdirmek, aýratyn limitler ($\\frac{\\sin x}{x} \\to 1$, $\\left(1 + \\frac{1}{x}\\right)^x \\to e$) ýa-da Lopitalyň düzgüni $\\lim \\frac{f}{g} = \\lim \\frac{f\'}{g\'}$.\n\nIslendik limiti ýazyň, mysal: «lim (x→0) (1 − cos x)/x²».', l: [['Limitler sapagy', 'kalkulus/kalkulus-limitler.html']] },
    { k: [/diskriminant/], t: 'Kwadrat deňleme $ax^2 + bx + c = 0$ üçin **diskriminant** $D = b^2 - 4ac$ kökleriň sanyny kesgitleýär:\n\n- $D > 0$ — iki dürli hakyky kök: $x_{1,2} = \\frac{-b \\pm \\sqrt{D}}{2a}$;\n- $D = 0$ — bir (gaýtalanýan) kök: $x = -\\frac{b}{2a}$;\n- $D < 0$ — hakyky kök ýok (parabola Ox okuny kesmeýär).\n\n**Wiýetiň teoremasy:** $x_1 + x_2 = -\\frac{b}{a}$, $x_1 x_2 = \\frac{c}{a}$ — jogaby barlamak üçin amatly. Mysal deňlemäni ýazyň: «2x² − 5x + 2 = 0».', l: [['Algebra', 'algebra/index.html']] },
    { k: [/pifagor/], t: '**Pifagoryň teoremasy:** gönüburçly üçburçlukda gipotenuzanyň kwadraty katetleriň kwadratlarynyň jemine deň: $$c^2 = a^2 + b^2$$ Mysal: katetler 3 we 4 bolsa, $c = \\sqrt{9 + 16} = 5$. Ters teorema hem dogry: $a^2 + b^2 = c^2$ bolsa, üçburçluk gönüburçly. Iň meşhur subudy: tarapy $a + b$ bolan kwadratyň içinde dört deň üçburçluk we tarapy $c$ bolan kwadrat ýerleşýär: $(a + b)^2 = 4\\cdot \\frac{ab}{2} + c^2 \\Rightarrow a^2 + b^2 = c^2$.', l: [['Geometriýa', 'geometriya/index.html']] },
    { k: [/gauss/, /usul|name|nahili/], t: '**Gauss usuly** — çyzykly ulgamy näbellileri yzygider aýyrmak bilen çözmek:\n\n1. **Göni ýöriş:** giňeldilen matrisany $(A|b)$ setir amallary (setiri sana köpeltmek, bir setiri beýlekisine goşmak, ornuny çalyşmak) bilen üçburç (basgançakly) görnüşe getirýäris.\n2. **Yza ýöriş:** soňky deňlemeden başlap, näbellileri aşakdan ýokary tapýarys.\n\n**Kroneker–Kapelli teoremasy:** rang $A$ = rang $(A|b)$ = $n$ — ýeke-täk çözgüt; rang $A$ = rang $(A|b)$ < $n$ — tükeniksiz köp; rang $A$ < rang $(A|b)$ — çözgüt ýok. Ulgamy ýazyň, mysal: «2x + y − z = 8; −3x − y + 2z = −11; −2x + y + 2z = −3».', l: [['n×n ulgam kalkulýatory', 'algebra/index.html#nxn-ulgam']] },
    { k: [/kramer|cramer/], t: '**Kramer usuly** kwadrat ulgam üçin ($n$ deňleme, $n$ näbelli): esasy kesgitleýji $\\Delta = \\det A \\ne 0$ bolsa, ulgamyň ýeke-täk çözgüdi bar we $$x_i = \\frac{\\Delta_i}{\\Delta},$$ bu ýerde $\\Delta_i$ — $A$-nyň $i$-nji sütünini azat agzalar bilen çalşyp alnan kesgitleýji. $\\Delta = 0$ bolsa, formulalar ulanylmaýar: ulgamyň ýa çözgüdi ýok, ýa-da tükeniksiz köp (Gauss usuly bilen anyklanýar). Kiçi ulgamlar üçin amatly, uly ulgamlarda Gauss usuly has az hasaplama talap edýär.', l: [['n×n ulgam kalkulýatory', 'algebra/index.html#nxn-ulgam']] },
    { k: [/logarifm/], t: '**Logarifm** — derejäniň ters amaly: $\\log_a b = c \\iff a^c = b$ ($a > 0$, $a \\ne 1$, $b > 0$). Mysal: $\\log_2 8 = 3$, sebäbi $2^3 = 8$.\n\nHäsiýetleri: $\\log_a(xy) = \\log_a x + \\log_a y$, $\\log_a \\frac{x}{y} = \\log_a x - \\log_a y$, $\\log_a x^k = k\\log_a x$, täze esasa geçmek $\\log_a b = \\frac{\\ln b}{\\ln a}$. $\\ln$ — natural logarifm (esasy $e \\approx 2.718$), $\\lg$ — onluk logarifm (esasy 10).', l: [['Algebra', 'algebra/index.html']] },
    { k: [/nyuton|newton/, /usul/], t: '**Nýutonyň (galtaşýanlar) usuly** $f(x) = 0$ deňlemäniň köküni ýakynlaşdyryp tapýar: $$x_{n+1} = x_n - \\frac{f(x_n)}{f\'(x_n)}$$ Her ädimde grafigiň $x_n$ nokatdaky galtaşýan çyzygy gurulýar we onuň Ox oky bilen kesişmesi täze ýakynlaşma bolýar. Köküň golaýynda kwadratik ýygnanýar (her ädimde dogry sanlaryň sany takmynan iki esse artýar), ýöne $f\'(x_n) \\approx 0$ bolsa ýa-da başlangyç nokat daşda bolsa, usul dargap biler. Synap görüň: «x³ − x − 2 = 0 deňlemäni Nýutonyň usuly bilen çöz».', l: [['San usullary: Nýutonyň usuly', 'san-usullary/index.html#newton-usuly']] },
    { k: [/wengr|bellemek mesele/], t: OR[0].md, l: [['Bellemek meselesi (Wengr usuly)', 'amal-barlagy/bellemek.html']] },
    { k: [/ikilenji simpleks/], t: OR[1].md, l: [['Ikilenji simpleks usuly', 'amal-barlagy/ikilenji-simpleks.html']] },
    { k: [/oyunlar nazary|matrisa oyn|eyer nokad/], t: OR[2].md, l: [['Oýunlar nazaryýeti', 'amal-barlagy/oyunlar-nazaryyeti.html']] },
    { k: [/sahalar we aracak|bitin sanly/], t: OR[3].md, l: [['Bitin sanly programmirleme', 'amal-barlagy/bitin-sanly.html']] },
    { k: [/deykstra|dijkstra|bellman|in gysga yol/], t: OR[4].md, l: [['Iň gysga ýol', 'amal-barlagy/in-gysga-yol.html']] },
    { k: [/kritiki yol|\bcpm\b|\bpert\b|tor meyilnama/], t: OR[5].md, l: [['Tor meýilnamasy (CPM, PERT)', 'amal-barlagy/cpm-pert.html']] },
    { k: [/simpleks/], t: '**Simpleks usuly** çyzykly programmirleme meselesini çözýär: mümkin çözgütleriň köpburçlugynyň depelerinden depelerine maksat funksiýasyny gowulandyryp geçýär.\n\n1. Meseläni kanonik görnüşe getirýäris: ≤ çäklendirmelere goşmaça (ätiýaç) üýtgeýänler, ≥ we = çäklendirmelere emeli üýtgeýänler goşulýar.\n2. Başlangyç simpleks tablisasyny düzýäris.\n3. Giriji sütün — Z-setirindäki iň uly otrisatel koeffisiýent (max üçin); çykýan setir — iň kiçi $b_i / a_{ij}$ gatnaşyk.\n4. Žordanyň öwrülmesini ýerine ýetirýäris; Z-setirinde otrisatel san galmaýança gaýtalaýarys.\n\nMeseläňizi ýazyň, mysal: «max Z = 3x1 + 5x2; x1 ≤ 4; 2x2 ≤ 12; 3x1 + 2x2 ≤ 18» — takyk droblar bilen çözüp bererin.', l: [['Simpleks usuly', 'amal-barlagy/simpleks.html']] },
    { k: [/ulag meselesi/], t: '**Ulag meselesi:** üpjün edijilerden sarp edijilere ýüki iň az jemi çykdajy bilen daşamagyň meýilnamasy. Çözmegiň tertibi:\n\n1. Meseläni deňagramly edýäris (jemi ätiýaç = jemi isleg; bolmasa, galp setir ýa-da sütün goşulýar).\n2. **Başlangyç meýilnama:** demirgazyk-günbatar burç, iň az baha ýa-da Vogel usuly.\n3. **Optimallyk barlagy:** MODI (potensiallar) usuly; gerek bolsa ýük ýapyk aýlaw boýunça süýşürilýär.\n\nEýelenen öýjükleriň sany $m + n - 1$ bolmaly (azgyn bolmadyk meýilnama).', l: [['Vogel usuly', 'amal-barlagy/vogel.html'], ['MODI usuly', 'amal-barlagy/modi.html']] }
  ];
  intent('kb', function (c) {
    var f = c.f + ' ' + fold(c.quote), best = null, bs = 0;
    KB.forEach(function (e) {
      var hits = e.k.filter(function (re) { return re.test(f); }).length;
      if (hits === e.k.length && hits > bs) { best = e; bs = hits; }
    });
    if (!best) return null;
    var md = best.t + '\n\n' + best.l.map(function (x) { return link(x[0], x[1]); }).join(' · ');
    return best.plot ? { text: md, tools: [{ name: 'plot_graph', input: best.plot }], after: function () { return 'Grafigi süýşürip we ulaldyp bilersiňiz; nokadyň üstüne syçanjygy getirseňiz, bahalar görünýär.'; } } : textPlan(md);
  });

  /* --- düşünilmedik sorag: dogruçyl habar + saýtyň sahypalary */
  function fallback(c) {
    var q = c.text || c.quote;
    var help = typeof env.siteHelp === 'function' ? env.siteHelp(q) : Promise.resolve([]);
    return Promise.resolve(help).catch(function () { return []; }).then(function (links) {
      var md = 'Bu soragy **Amatly motory** düşünmedi. Men formulasy ýa-da sanlary bolan matematika meselelerini çözýärin we esasy düşünjeleri düşündirýärin. Meseläni formulasy bilen ýazyp görüň, mysal üçin: ' + EX + '.';
      if (links && links.length) md += '\n\n**Saýtyň bu sahypalary kömek edip biler:**\n' + links.map(function (l) { return '- ' + link(l.t, l.u) + (l.h ? ' — ' + l.h : ''); }).join('\n');
      md += '\n\n_Erkin söhbet we suratdan okamak üçin Claude API gerek (Sazlamalar → Amatly AI)._';
      return textPlan(md);
    });
  }

  /* ============================================================ esasy funksiýa */
  function context(text, extra) {
    var t = String(text || ''), quote = extra && extra.quote || '';
    var generic = /^\s*(şuny|suny|bu(ny)?|muny)?\s*(düşündir|dusundir|düşündiriň|dusundirin|näme\??|name\??|aňlat)/i.test(t) && t.length < 60;
    var src = generic && quote ? quote : t;
    var n = norm(src);
    return { text: src, raw: t, quote: quote, f: fold(t + (generic && quote ? ' ' + quote : '')), n: n, spans: spans(n), page: extra && extra.page || env.page || '', mode: env.mode };
  }
  function analyze(text, e, extra) {
    if (e) env = Object.assign({}, env, e);
    var c = context(text, extra);
    var i = 0;
    function next() {
      if (i >= INTENTS.length) return fallback(c);
      var it = INTENTS[i++];
      var r;
      try { r = it.run(c); } catch (err) { r = null; if (window.console) console.warn('Amatly motory (' + it.name + '):', err); }
      return Promise.resolve(r).catch(function (err) { if (window.console) console.warn('Amatly motory (' + it.name + '):', err); return null; }).then(function (p) {
        if (p) { p.intent = p.intent || it.name; return p; }
        return next();
      });
    }
    return next();
  }
  function toReply(plan) {
    var content = [];
    if (plan.text) content.push({ type: 'text', text: plan.text });
    (plan.tools || []).forEach(function (t) { var id = uid(); plans[id] = plan; content.push({ type: 'tool_use', id: id, name: t.name, input: t.input }); });
    if (!content.length) content.push({ type: 'text', text: '…' });
    return { content: content, stop: plan.tools && plan.tools.length ? 'tool_use' : 'end_turn', intent: plan.intent };
  }
  function afterTools(conv) {
    var res = conv[conv.length - 1], asst = conv[conv.length - 2];
    var uses = (asst && Array.isArray(asst.content) ? asst.content : []).filter(function (b) { return b.type === 'tool_use'; });
    var map = {};
    res.content.forEach(function (b) { map[b.tool_use_id] = b; });
    var items = uses.map(function (u) {
      var r = map[u.id], data = null;
      try { data = JSON.parse(r && typeof r.content === 'string' ? r.content : 'null'); } catch (e) { data = null; }
      return { name: u.name, input: u.input, data: r && r.is_error ? null : data, error: r && r.is_error ? String(r.content).replace(/^Error:\s*/, '') : '' };
    });
    var plan = uses.length ? plans[uses[0].id] : null;
    var text;
    try { text = plan && plan.after ? plan.after(items) : generic(items); } catch (e) { text = generic(items); }
    return Promise.resolve(text).then(function (t) { return { content: [{ type: 'text', text: t || 'Taýýar.' }], stop: 'end_turn' }; });
  }
  function generic(items) {
    return items.map(function (it) {
      if (it.error) return 'Gural işlemedi: ' + it.error;
      var d = it.data;
      if (it.name === 'solve_steps' && d) return d.ok ? '**Jogap:** ' + d.answer + (d.check ? ' — ' + d.check.replace(/^(ok|warn|none):\s*/, '') : '') : 'Motor bu meseläni çözmedi.';
      if (it.name === 'solve_lp' && d) return d.status === 'optimal' ? '**Jogap:** ' + d.objective + ' = ' + d.value : '**Netije:** ' + d.status;
      if (it.name === 'calculate' && Array.isArray(d)) return d.map(function (x) { return '`' + x.expr + '` = ' + (x.error || x.result); }).join('\n');
      if (it.name === 'plot_graph') return 'Grafik çyzyldy.';
      return '';
    }).filter(Boolean).join('\n\n') || 'Taýýar.';
  }
  function reply(conv, e) {
    if (e) env = Object.assign({}, env, e);
    var last = conv[conv.length - 1];
    if (last && last.role === 'user' && Array.isArray(last.content) && last.content.length && last.content.every(function (b) { return b.type === 'tool_result'; })) return need('math').then(function () { return afterTools(conv); });
    var idx = lastQuestionIdx(conv);
    if (idx < 0) return Promise.resolve(toReply(textPlan(capabilities())));
    var q = question(conv, idx);
    if (!q.page) q.page = env.page || '';
    var ft = fold(q.text);
    /* «doly çözgüdi görkez», «dowam et» — öňki soragy düşündiriş režiminde täzeden çözmek */
    if (/^(doly )?(cozgudi|jogaby|cozuwi|cozgut) (gorkez|ber|yaz)|^dowam\b|^cozgudi gorkez|^dogry jogap/.test(ft.trim()) && ft.length < 60) {
      var prev = lastQuestionIdx(conv, idx);
      if (prev >= 0) { var pq = question(conv, prev); env.mode = 'explain'; q = pq; }
    }
    return need('math').then(function () {
      if (q.images && !spans(norm(q.text)).some(function (sp) { return /[0-9=]|^[a-z]$|[a-z]\s*[-+*\/^]/.test(sp); })) return textPlan('Suratdaky meseläni okamak üçin Claude API gerek — **Amatly motory** suratlary okap bilmeýär. Meseläni tekst görnüşinde ýazyň, men ony saýtyň motory bilen ädimme-ädim çözerin. Mysal: ' + EX + '.');
      return analyze(q.text, null, { quote: q.quote, page: q.page }).then(function (p) {
        if (q.images && p) p.text = '_Bellik: Amatly motory suraty okap bilmeýär — diňe ýazylan tekst boýunça jogap berýärin._\n\n' + (p.text || '');
        return p;
      });
    }).then(toReply);
  }

  window.AmatlyAILocal = { version: 1, reply: reply, analyze: function (text, e, extra) { return need('math').then(function () { return analyze(text, e, extra); }); }, norm: norm, spans: spans, nice: nice };
})();
