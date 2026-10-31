/*!
 * Amatly.com — hasaplaýyş motory (Amatly AI üçin)
 * Kalkulus bölüminiň ädimme-ädim çözüjilerini (limit, önüm, integral) sahypadan garaşsyz ulanmak üçin window.AmatlyEngine-e çykarýar.
 * AI kömekçisi (assets/ai/ai.js) bu faýly diňe gerek bolanda ýükleýär; ondan öň saýtyň umumy math.js-i ýüklenmeli.
 * Her netije: {ok, task, title, answer, answerText, steps: [html], check: {status: 'ok' | 'warn' | 'none', text}}.
 */
(function(){
'use strict';

/* ===== modules/core/mathjs.js ===== */
/* math.js (mathjs.org) — sahypa assets/js/vendor/math.js faýlyny ýükleýär we global `math` ýüze çykýar.
   Ähli modullar math-y diňe şu ýerden import edýär. */

const math = window.math;

/* ===== modules/core/expression.js ===== */
/* Aňlatmalary taýýarlamak we math.js düwünleri bilen işlemek (prep, parseBound, unwrap, flattenSum ...);
   girizilen aňlatmany kompilýasiýa etmek: yzygiderlik aₙ (seqCompile), f(x, y) (xyCompile, evalXY) — rugsat berlen harplary barlap. */

function prep(s){
  const SUP = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁺':'+','⁻':'-'};
  s = String(s)
    .replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, m => '^(' + m.split('').map(c => SUP[c]).join('') + ')')
    .replace(/√\s*\(/g, 'sqrt(').replace(/√\s*([A-Za-z0-9.]+)/g, 'sqrt($1)')
    .replace(/π/g, 'pi')
    .replace(/\barc(sin|cos|tan|cot)\s*\(/gi, (m, f) => 'a' + f.toLowerCase() + '(')
    .replace(/\barctg\s*\(/gi, 'atan(').replace(/\barcctg\s*\(/gi, 'acot(')
    .replace(/\bctg\s*\(/gi, 'cot(').replace(/\btg\s*\(/gi, 'tan(')
    .replace(/\blg\s*\(/gi, 'log10(').replace(/\bln\s*\(/gi, 'log(')
    .replace(/(^|[^A-Za-z_])([xynt])\s*\(/g, '$1$2*(');                     // x(x+1), n(n+1): üýtgeýji funksiýa däl — köpeltmek
  if(!/[A-Za-z_]\w*\s*\([^()]*\d\s*,\s*\d/.test(s)) s = s.replace(/(\d),(\d)/g, '$1.$2');   // onluk drob otyr (funksiýa argumenti däl bolsa)
  return s;
}

function safeEval(fn, x){ try{ const y = fn(x); return (typeof y === 'number') ? y : NaN; } catch(e){ return NaN; } }

function parseBound(s){
  s = prep(s).trim().toLowerCase();
  if(s === '') return NaN;
  if(s === 'inf' || s === '+inf' || s === 'cheksiz' || s === '+cheksiz' || s === '∞' || s === '+∞') return Infinity;
  if(s === '-inf' || s === '-cheksiz' || s === '-∞') return -Infinity;
  return math.evaluate(s);
}

function constVal(n){
  try{ const v = n.compile().evaluate({}); return (typeof v==='number' && isFinite(v)) ? v : null; } catch(e){ return null; }
}

function unwrap(n){ return n.type==='ParenthesisNode' ? unwrap(n.content) : n; }

function isX(n){ n = unwrap(n); return n.type==='SymbolNode' && n.name==='x'; }

function isE(n){ n = unwrap(n); return n.type==='SymbolNode' && n.name==='e'; }

function flattenSum(node, sign, out){
  if(node.type==='ParenthesisNode') return flattenSum(node.content, sign, out);
  if(node.type==='OperatorNode' && node.fn==='add'){ flattenSum(node.args[0], sign, out); flattenSum(node.args[1], sign, out); }
  else if(node.type==='OperatorNode' && node.fn==='subtract'){ flattenSum(node.args[0], sign, out); flattenSum(node.args[1], -sign, out); }
  else if(node.type==='OperatorNode' && node.fn==='unaryMinus'){ flattenSum(node.args[0], -sign, out); }
  else out.push({node, sign});
  return out;
}

/* aₙ (n we x ikisi hem n-e deň) — kesgitlenmedik bolsa NaN */
function seqCompile(src){
  const node = math.parse(prep(src));
  let bad = null;
  node.traverse((c, path, parent) => {
    if(c.type === 'SymbolNode' && !(parent && parent.type === 'FunctionNode' && path === 'fn') && !['n', 'x', 'pi', 'e', 'E', 'PI', 'phi', 'tau'].includes(c.name)) bad = c.name;
  });
  if(bad) throw new Error('symbol:' + bad);
  const c = node.compile();
  return {node, a: k => safeEval(kk => c.evaluate({n: kk, x: kk}), k)};
}

const MV_OK = ['x', 'y', 'pi', 'e', 'E', 'PI', 'phi', 'tau'];

/* f(x, y) aňlatmasy: {node, f}. Diňe x, y (we goşmaça rugsat berlen üýtgeýjiler) — başga simwol bolsa Error('symbol:ady') */
function xyCompile(src, extra){
  const node = math.parse(prep(String(src).replace(/θ/g, 't')));
  const ok = MV_OK.concat(extra || []);
  let bad = null;
  node.traverse((c, path, parent) => {
    if(c.type === 'SymbolNode' && !(parent && parent.type === 'FunctionNode' && path === 'fn') && ok.indexOf(c.name) === -1) bad = c.name;
  });
  if(bad) throw new Error('symbol:' + bad);
  return {node, f: evalXY(node.compile())};
}

/* (x, y) → san; ýalňyşlyk ýa-da kompleks netije bolsa NaN */
function evalXY(compiled, extra){
  return function(x, y){
    try{
      const scope = extra ? Object.assign({x, y}, extra) : {x, y};
      const v = compiled.evaluate(scope);
      return typeof v === 'number' ? v : NaN;
    }catch(e){ return NaN; }
  };
}

/* ===== modules/core/format.js ===== */
/* Sanlary okalýan görnüşde görkezmek: fmt (umumy), fmtPrec (ýokary takyklyk), fmtNice (takyk ýazgy: 2√5/5, 3π/2, 1/e),
   niceConst (belli hemişelikleri tanamak), lineEq (galtaşýan çyzygyň deňlemesi). */

function fmt(n){
  if (isNaN(n)) return "kesgitlenmedik";
  if (!isFinite(n)) return n > 0 ? "+∞" : "-∞";
  if (Math.abs(n) < 1e-9) return "0";
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  return math.format(n, {precision: 6, lowerExp: -6, upperExp: 9});
}

/* ýokary takyklykly format: 1.41421356237, 4.4e-16 */
function fmtPrec(n, p){
  if(isNaN(n)) return 'kesgitlenmedik';
  if(!isFinite(n)) return n > 0 ? '+∞' : '-∞';
  if(n === 0) return '0';
  return math.format(n, {precision: p || 10});
}

/* Onluk sany ýönekeý drob p/q bilen ýakynlaşdyrmak (zynjyrly drob): q ≤ maxDen we otnositel ýalňyşlyk ≤ tol bolsa [p, q], ýogsam null */
function ratApprox(v, maxDen, tol){
  if(!isFinite(v)) return null;
  if(v === 0) return [0, 1];
  const s = v < 0 ? -1 : 1, x = Math.abs(v);
  tol = tol === undefined ? 1e-11 : tol;
  let hm2 = 0, hm1 = 1, km2 = 1, km1 = 0, b = x;
  for(let it = 0; it < 64; it++){
    const an = Math.floor(b), h = an*hm1 + hm2, k = an*km1 + km2;
    if(k > (maxDen || 10000)) return null;
    if(Math.abs(x - h/k) <= tol*x) return [s*h, k];
    hm2 = hm1; hm1 = h; km2 = km1; km1 = k;
    const fr = b - an;
    if(fr < 1e-15) return null;
    b = 1/fr;
  }
  return null;
}

/* Sany drob görnüşinde (mümkin bolsa) ýazmak: 0.1666… → 1/6, 0.25 → 1/4, başga ýagdaýda fmt */
function fmtRat(v, maxDen){
  const r = ratApprox(v, maxDen || 1000);
  if(!r) return fmt(v);
  return r[1] === 1 ? String(r[0]) : (r[0] < 0 ? '−' : '') + Math.abs(r[0]) + '/' + r[1];
}

const SEQ_CONSTS = [
  ['e', Math.E], ['π', Math.PI], ['√2', Math.SQRT2], ['ln 2', Math.LN2], ['1/e', 1/Math.E], ['e²', Math.E*Math.E],
  ['√3', Math.sqrt(3)], ['π/2', Math.PI/2], ['π/4', Math.PI/4], ['φ = (1 + √5)/2', (1 + Math.sqrt(5))/2], ['√e', Math.sqrt(Math.E)], ['π²/6', Math.PI*Math.PI/6],
  ['e − 1', Math.E - 1], ['π²/12', Math.PI*Math.PI/12], ['π²/8', Math.PI*Math.PI/8], ['π⁴/90', Math.pow(Math.PI, 4)/90], ['2π', 2*Math.PI], ['π/3', Math.PI/3], ['π/6', Math.PI/6], ['ζ(3) (Aperiniň hemişeligi)', 1.2020569031595942],
  ['4π/3', 4*Math.PI/3], ['8π', 8*Math.PI], ['4π', 4*Math.PI], ['3π/2', 1.5*Math.PI], ['π/8', Math.PI/8], ['2π/3', 2*Math.PI/3], ['3π', 3*Math.PI]
];

/* Bahany "owadan" hemişelige ýakynlaşdyrmak (bitin, ýönekeý drob, e, π, ...): err — takmynan ýalňyşlyk */
function niceConst(L, err){
  if(!isFinite(L)) return {v: L, label: fmt(L), exact: false};
  const lim = Math.min(1e-3*Math.max(1, Math.abs(L)), Math.max(1e-9*Math.max(1, Math.abs(L)), 3*(err || 0)));
  const cand = [];
  const R = Math.round(L);
  cand.push({v: R, label: String(R), pri: 0});
  for(let q = 2; q <= 12; q++){ const p = Math.round(L*q); if(p % q !== 0) cand.push({v: p/q, label: (p < 0 ? '−' : '') + Math.abs(p) + '/' + q + ' ≈ ' + fmt(p/q), pri: 1}); }
  SEQ_CONSTS.forEach(([name, c]) => { cand.push({v: c, label: name + ' ≈ ' + fmt(c), pri: 2}); cand.push({v: -c, label: '−' + name + ' ≈ ' + fmt(-c), pri: 2}); });
  let best = null;
  cand.forEach(c => { const d = Math.abs(L - c.v); if(d <= lim && (!best || d < best.d - 1e-15 || (Math.abs(d - best.d) <= 1e-15 && c.pri < best.pri))) best = {d, c}; });
  if(best) return {v: best.c.v, label: best.c.label, exact: true};
  return {v: L, label: fmt(L), exact: false};
}

const FMT_SQFREE = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15, 17, 19, 21, 22, 23, 26, 29, 30, 31, 33, 34, 35, 37, 38, 39, 41, 42, 43, 46, 47];

/* Sany owadan ýazmak: bitin, ýönekeý drob, (p ± √k)/q, π-li hemişelikler; başartmasa fmt. Mysal: 0.5773502691896258 → √3/3 */
function fmtNice(v){
  if(!isFinite(v)) return fmt(v);
  const neg = v < 0, a = Math.abs(v), sg = s => (neg ? '−' : '') + s;
  if(a < 1e-12) return '0';
  if(Math.abs(a - Math.round(a)) < 1e-9*Math.max(1, a)) return sg(String(Math.round(a)));
  const r = ratApprox(a, 100, 1e-10);
  if(r) return sg(r[0] + '/' + r[1]);
  for(let q = 1; q <= 12; q++){                                // kπ/q
    const k = a*q/Math.PI;
    if(Math.abs(k - Math.round(k)) < 1e-9 && Math.round(k) > 0 && Math.round(k) <= 48){
      const ki = Math.round(k), g = (p, t) => t ? g(t, p % t) : p, dd = g(ki, q), kk = ki/dd, qq = q/dd;
      return sg((kk === 1 ? '' : kk) + 'π' + (qq === 1 ? '' : '/' + qq));
    }
  }
  const gcd = (p, t) => t ? gcd(t, p % t) : Math.abs(p);
  for(let q = 1; q <= 12; q++) for(let k = 2; k <= 50; k++){
    if(FMT_SQFREE.indexOf(k) === -1) continue;                 // √20 → 2√5: diňe kwadratsyz k we m·√k
    const sk = Math.sqrt(k);
    for(let m = 1; m <= 12; m++) for(const s of [1, -1]){
      const p = v*q - s*m*sk;                                 // v = (p + s·m·√k)/q
      if(Math.abs(p - Math.round(p)) < 1e-9){
        let pi = Math.round(p), mm = m, qq = q;
        const g = gcd(gcd(pi, mm), qq);
        if(g > 1){ pi /= g; mm /= g; qq /= g; }
        const root = (mm === 1 ? '' : mm) + '√' + k;
        const num = pi === 0 ? (s > 0 ? '' : '−') + root : (pi < 0 && s > 0) ? root + ' − ' + (-pi) : String(pi).replace('-', '−') + (s > 0 ? ' + ' : ' − ') + root;   // (√5 − 1)/2
        return qq === 1 ? num : (pi === 0 ? num : '(' + num + ')') + '/' + qq;
      }
    }
  }
  for(const k of [1, 2, -1, -2]){                                // (p/q)·e^(−k): 1/e, 2/e, 4/e², e/2, 3e
    const r2 = ratApprox(a*Math.exp(k), 12, 1e-11);
    if(r2 && r2[0] <= 60){
      const p = r2[0], q = r2[1], E = Math.abs(k) === 2 ? 'e²' : 'e';
      if(k > 0) return sg(p + '/' + (q === 1 ? E : '(' + q + E + ')'));
      return sg((p === 1 ? '' : p) + E + (q === 1 ? '' : '/' + q));
    }
  }
  const n = niceConst(v, 1e-12*Math.max(1, a));
  if(n.exact && /π/.test(n.label)) return n.label.split(' ≈ ')[0].replace(/^-/, '−');
  return fmt(v).replace(/^-/, '−');
}

/* y = m·x + c görnüşinde galtaşýan çyzygyň deňlemesi */
function lineEq(m, x0, y0){
  const c = y0 - m*x0;
  if(Math.abs(m) < 1e-12) return 'y = ' + fmt(y0);
  const xs = Math.abs(m - 1) < 1e-12 ? 'x' : Math.abs(m + 1) < 1e-12 ? '−x' : fmt(m) + '·x';
  const cs = Math.abs(c) < 1e-9 ? '' : (c < 0 ? ' − ' : ' + ') + fmt(Math.abs(c));
  return 'y = ' + xs + cs;
}

/* ===== modules/core/numlimit.js ===== */
/* San limitleri: funksiýanyň ýa-da yzygiderligiň ýakynlaşýan bahalaryndan (10⁻¹ … 10⁻⁵ ädimler, n = 10 … 10⁵) limiti kesgitlemek
   (classify, seqLimit) we netijäni ýazmak (fmtSide). Kalkulýatorlaryň san barlaglary şuny ulanýar. */

function snap(v){ return Math.abs(v)<1e-4 ? 0 : Number(v.toPrecision(4)); }

function classify(v){
  const last = v[4];
  if(isNaN(v[2]) || isNaN(v[3]) || isNaN(last)) return {t:'nan'};
  const big = [v[2],v[3],last].find(z=>!isFinite(z));
  if(big !== undefined) return {t:'inf', s: big>0?1:-1};
  const d1=v[2]-v[1], d2=v[3]-v[2], d3=last-v[3];
  const tol = 0.02*Math.max(1, Math.abs(last));
  if(Math.abs(d3)<=tol && (Math.abs(d3)<=Math.abs(d2)+1e-12 || Math.abs(d3)<=1e-4*Math.max(1,Math.abs(last)))){
    let L = last;
    if(Math.abs(d2)>1e-12 && Math.abs(d3/d2)<0.9){ const ex = last - d3*d3/(d3-d2); if(isFinite(ex)) L = ex; }
    return {t:'val', v:snap(L)};
  }
  if(d1*d2>0 && d2*d3>0 && Math.abs(last)>10 && Math.abs(last)>Math.abs(v[3]) && Math.abs(d3)>=0.5*Math.abs(d2)) return {t:'inf', s:last>0?1:-1};
  return {t:'unstable'};
}

function fmtSide(c){ return c.t==='val' ? fmt(c.v) : c.t==='inf' ? (c.s>0?'+∞':'-∞') : c.t==='nan' ? 'kesgitlenmedik' : 'durnuksyz'; }

/* Uly n-lerde limit: {t:'val', L, err} / {t:'inf', s} / {t:'osc', L1, L2} / {t:'nan'} / {t:'unstable'} */
function seqLimit(a, n0){
  const pts = [10, 100, 1000, 10000, 100000].map(t => t + n0 - 1);
  const ev = pts.map(a), od = pts.map(p => a(p + 1));
  const c1 = classify(ev), c2 = classify(od);
  const est = v => {
    const d2 = v[3] - v[2], d3 = v[4] - v[3];
    let L = v[4], err = Math.abs(d3);
    if(Math.abs(d2) > 1e-300 && Math.abs(d3/d2) < 0.9){ const ex = v[4] - d3*d3/(d3 - d2); if(isFinite(ex)){ err = Math.abs(ex - v[4]); L = ex; } }
    return {L, err};
  };
  if(c1.t === 'nan' || c2.t === 'nan') return {t: 'nan', pts, ev, od};
  if(c1.t === 'inf' && c2.t === 'inf') return c1.s === c2.s ? {t: 'inf', s: c1.s, pts, ev, od} : {t: 'osc', inf: true, pts, ev, od};
  if(c1.t === 'val' && c2.t === 'val'){
    const e1 = est(ev), e2 = est(od), tol = 1e-3*Math.max(1, Math.abs(e1.L));
    if(Math.abs(e1.L - e2.L) <= tol) return {t: 'val', L: (e1.L + e2.L)/2, err: Math.max(e1.err, e2.err, Math.abs(e1.L - e2.L)), pts, ev, od};
    return {t: 'osc', L1: e1.L, L2: e2.L, pts, ev, od};
  }
  return {t: 'unstable', pts, ev, od};
}

/* san barlagynyň gysga netijesi: {k:'val', v} | {k:'inf', s} | {k:'none'} | {k:'one', side, v} | {k:'?'} */
function numOutcome(L, R){
  const eq = (p, q) => Math.abs(p - q) <= 1e-3*Math.max(1, Math.abs(p));
  const val = c => c.t === 'val' ? c.v : c.s*Infinity;
  if(L.t === 'val' && R.t === 'val') return eq(L.v, R.v) ? {k: 'val', v: (L.v + R.v)/2} : {k: 'none'};
  if(L.t === 'inf' && R.t === 'inf') return L.s === R.s ? {k: 'inf', s: L.s} : {k: 'none'};
  if((L.t === 'val' && R.t === 'inf') || (L.t === 'inf' && R.t === 'val')) return {k: 'none'};
  if(L.t === 'nan' && (R.t === 'val' || R.t === 'inf')) return {k: 'one', side: 1, v: val(R)};
  if(R.t === 'nan' && (L.t === 'val' || L.t === 'inf')) return {k: 'one', side: -1, v: val(L)};
  return {k: '?'};
}

/* algebraik netije san barlagy bilen gabat gelýärmi: true / false / null (deňeşdirip bolmady) */
function limAgree(sym, num){
  if(sym === null || sym === undefined || num.k === '?') return null;
  const eq = (p, q) => (p === q) || (isFinite(p) && isFinite(q) && Math.abs(p - q) <= 2e-3*Math.max(1, Math.abs(p)));
  if(sym.side) return num.k === 'one' && num.side === sym.side && eq(sym.v, num.v);
  if(sym.osc) return null;
  if(sym.none) return num.k === 'none';
  if(sym === Infinity || sym === -Infinity) return num.k === 'inf' && num.s === Math.sign(sym);
  return num.k === 'val' && eq(sym, num.v);
}

/* ===== modules/core/pretty.js ===== */
/* Aňlatmalary owadan (HTML) görkezmek we ygtybarly ýönekeýleşdirmek. */

function _esc(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

const _TRIG = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh'];

const _FN_NAME = {tan:'tg', cot:'ctg', asin:'arcsin', acos:'arccos', atan:'arctg', acot:'arcctg', log10:'lg'};

const _VARL = ['x', 'y', 'z'];

/* prettyNode(node, K): HTML setir gaýtarýar. K — {simwol: Node} çalşyrmalary (islege görä). Içinde çep/sag skobka goýulmagy takyk deňeşdirme boýunça */
function prettyNode(node, K){
  K = K || {};
  const res = n => { n = unwrap(n); while(n.type === 'SymbolNode' && K[n.name]) n = unwrap(K[n.name]); return n; };
  const isNegC = n => n.type === 'ConstantNode' && typeof n.value === 'number' && n.value < 0;
  const isNeg = n => isNegC(n) || (n.type === 'OperatorNode' && n.fn === 'unaryMinus');
  const numStr = v => {
    const a = Math.abs(v), s = Number.isInteger(a) ? String(a) : String(Number(a.toPrecision(10)));
    return (v < 0 ? '−' : '') + s;
  };
  // g(n) -> [html, prec]; prec: 1 +/−, 2 ·/÷, 3 unar −, 4 derece, 5 atom
  const g = n => {
    n = res(n);
    if(n.type === 'ConstantNode'){
      if(typeof n.value !== 'number') return [_esc(String(n.value)), 5];
      return [numStr(n.value), n.value < 0 ? 3 : 5];
    }
    if(n.type === 'SymbolNode') return [n.name === 'pi' ? 'π' : _esc(n.name), 5];
    if(n.type === 'OperatorNode'){
      const f = n.fn, a = n.args[0], b = n.args[1];
      const w = (m, minP) => { const [s, p] = g(m); return p < minP ? '(' + s + ')' : s; };
      if(f === 'add'){
        const rb = res(b);
        if(isNegC(rb)) return [w(a, 1) + ' − ' + numStr(-rb.value), 1];
        if(rb.type === 'OperatorNode' && rb.fn === 'unaryMinus') return [w(a, 1) + ' − ' + w(rb.args[0], 2), 1];
        return [w(a, 1) + ' + ' + w(b, 1), 1];
      }
      if(f === 'subtract'){
        const rb = res(b);
        return [w(a, 1) + ' − ' + (isNeg(rb) ? '(' + g(b)[0] + ')' : w(b, 2)), 1];
      }
      if(f === 'unaryMinus'){ const ra = res(a); return ['−' + (isNeg(ra) ? '(' + g(a)[0] + ')' : w(a, 2)), 3]; }
      if(f === 'unaryPlus') return g(a);
      if(f === 'multiply'){
        const ra = res(a), rb = res(b), ua = unwrap(a), ub = unwrap(b);
        /* 1·u → u (goýlan san 1 bolsa — mysal x = 1 — görkezilýär: 3·1·2²) */
        if(ua.type === 'ConstantNode' && ua.value === 1) return g(b);
        if(ub.type === 'ConstantNode' && ub.value === 1) return g(a);
        const isDiv = m => m.type === 'OperatorNode' && m.fn === 'divide';
        const [ls, lp] = g(a), [rs, rp] = g(b);
        const left = (lp < 2 || isDiv(ra)) ? '(' + ls + ')' : ls;
        const right = (isNeg(rb) || rp < 2 || isDiv(rb)) ? '(' + rs + ')' : rs;
        const rbBase = rb.type === 'OperatorNode' && rb.fn === 'pow' ? res(rb.args[0]) : rb;
        const implicit = ra.type === 'ConstantNode' && typeof ra.value === 'number' && rbBase.type === 'SymbolNode' && !K[rbBase.name] && rbBase.name !== 'e';
        if(implicit && ra.value < 0) return ['−' + numStr(-ra.value) + right, 3];
        /* (3/2)·y² → 3y²/2, −(1/2)·x → −x/2 */
        const fr = ra.type === 'OperatorNode' && ra.fn === 'unaryMinus' ? res(ra.args[0]) : ra, frNeg = fr !== ra;
        if(fr.type === 'OperatorNode' && fr.fn === 'divide' && res(fr.args[0]).type === 'ConstantNode' && res(fr.args[1]).type === 'ConstantNode' &&
           typeof res(fr.args[0]).value === 'number' && typeof res(fr.args[1]).value === 'number' && res(fr.args[0]).value > 0 && res(fr.args[1]).value > 0 &&
           rbBase.type === 'SymbolNode' && !K[rbBase.name] && rbBase.name !== 'e' && !isNeg(rb) && rp >= 4){
          const pv = res(fr.args[0]).value;
          return [(frNeg ? '−' : '') + (pv === 1 ? '' : numStr(pv)) + right + '/' + numStr(res(fr.args[1]).value), frNeg ? 3 : 2];
        }
        /* −(3)·x → −3x */
        const rn = ra.type === 'OperatorNode' && ra.fn === 'unaryMinus' ? res(ra.args[0]) : null;
        if(rn && rn.type === 'ConstantNode' && typeof rn.value === 'number' && rn.value > 0 && rbBase.type === 'SymbolNode' && !K[rbBase.name] && rbBase.name !== 'e' && !isNeg(rb) && rp >= 2 && !isDiv(rb))
          return ['−' + numStr(rn.value) + right, 3];
        /* harplaryň köpeltmek hasyly nokatsyz: 2x·y → 2xy, x²·y → x²y (dürli harplar bolanda) */
        let lf = ra; while(lf.type === 'OperatorNode' && lf.fn === 'multiply') lf = res(lf.args[1]);
        const lfBase = lf.type === 'OperatorNode' && lf.fn === 'pow' ? res(lf.args[0]) : lf;
        const letters = !implicit && !isDiv(ra) && lp >= 2 && rp >= 4 && rbBase.type === 'SymbolNode' && _VARL.indexOf(rbBase.name) !== -1 && !K[rbBase.name] &&
          ((lf.type === 'ConstantNode' && typeof lf.value === 'number') || (lfBase.type === 'SymbolNode' && _VARL.indexOf(lfBase.name) !== -1 && !K[lfBase.name] && lfBase.name !== rbBase.name));
        return [implicit || letters ? left + right : left + '·' + right, 2];
      }
      if(f === 'divide') return [w(a, 2) + '/' + w(b, 4), 2];
      if(f === 'pow'){
        const base = res(a), ex = res(b);
        if(base.type === 'FunctionNode' && _TRIG.indexOf(base.fn.name) !== -1 && ex.type === 'ConstantNode' && Number.isInteger(ex.value) && ex.value > 0){
          return [(_FN_NAME[base.fn.name] || base.fn.name) + '<sup>' + g(ex)[0] + '</sup>(' + base.args.map(m => g(m)[0]).join(', ') + ')', 5];
        }
        const bs = (base.type === 'FunctionNode' && base.fn.name === 'sqrt') ? '(' + g(base)[0] + ')' : w(base, 5);   // (√u)² — √(u²) bilen bulaşmaz ýaly
        return [bs + '<sup>' + g(ex)[0] + '</sup>', 4];
      }
    }
    if(n.type === 'FunctionNode'){
      const name = n.fn.name, args = n.args, a0 = args[0], one = args.length === 1;
      if(name === 'exp' && one) return ['e<sup>' + g(a0)[0] + '</sup>', 4];
      if(name === 'sqrt' && one){ const r = res(a0); return ['√' + ((r.type === 'SymbolNode' || (r.type === 'ConstantNode' && r.value >= 0)) ? g(a0)[0] : '(' + g(a0)[0] + ')'), 5]; }
      if(name === 'abs' && one) return ['|' + g(a0)[0] + '|', 5];
      if(name === 'log' && one){
        const r = res(a0);
        if(r.type === 'FunctionNode' && r.fn.name === 'abs' && r.args.length === 1) return ['ln|' + g(r.args[0])[0] + '|', 5];
        return ['ln(' + g(a0)[0] + ')', 5];
      }
      if(name === 'log' && args.length === 2) return ['log<sub>' + g(args[1])[0] + '</sub>(' + g(a0)[0] + ')', 5];
      return [(_FN_NAME[name] || _esc(name)) + '(' + args.map(m => g(m)[0]).join(', ') + ')', 5];
    }
    return [_esc(n.toString()), 0];
  };
  return g(node)[0];
}

/* üýtgeýjisiz transsendent hemişelikler (log(2), sqrt(2), pi, e) goralýar: simplify olary onluk drobda hasaplamaz */
function _hasX(n){ let f = false; n.traverse(c => { if(c.type === 'SymbolNode' && c.name === 'x') f = true; }); return f; }

/* üýtgeýjisiz (diňe sanlar, π, e we funksiýalar) aňlatma */
function _isConstTree(n){
  let ok = true;
  n.traverse((c, path) => { if(c.type === 'SymbolNode' && path !== 'fn' && c.name !== 'pi' && c.name !== 'e') ok = false; });
  return ok;
}

function _isRational(n){
  n = unwrap(n);
  if(n.type === 'ConstantNode') return typeof n.value === 'number';
  if(n.type === 'OperatorNode'){
    if(['add', 'subtract', 'multiply', 'divide', 'unaryMinus', 'unaryPlus'].indexOf(n.fn) !== -1) return n.args.every(_isRational);
    if(n.fn === 'pow'){ const e = unwrap(n.args[1]); return _isRational(n.args[0]) && e.type === 'ConstantNode' && Number.isInteger(e.value); }
  }
  return false;
}

/* köpagzanyň derejesi: c·x^k görnüşli agzalar üçin k, başga ýagdaýda null */
function _termDeg(n){
  n = unwrap(n);
  if(n.type === 'ConstantNode') return 0;
  if(n.type === 'SymbolNode') return n.name === 'x' ? 1 : null;
  if(n.type === 'OperatorNode'){
    if(n.fn === 'unaryMinus' || n.fn === 'unaryPlus') return _termDeg(n.args[0]);
    if(n.fn === 'pow'){ const b = unwrap(n.args[0]), e = unwrap(n.args[1]); return (b.type === 'SymbolNode' && b.name === 'x' && e.type === 'ConstantNode' && e.value >= 0) ? e.value : null; }
    if(n.fn === 'multiply'){ const p = _hasX(n.args[0]), q = _hasX(n.args[1]); if(p && q) return null; return _termDeg(p ? n.args[0] : n.args[1]); }
    if(n.fn === 'divide'){ if(_hasX(n.args[1])) return null; return _termDeg(n.args[0]); }
  }
  return null;
}

/* tutuşlygyna köpagza bolsa agzalary derejäniň kemelişi boýunça tertipleýär: 3x² − 8x + 2 */
function orderSum(node){
  const terms = flattenSum(node, 1, []);
  if(terms.length < 2) return node;
  const degs = terms.map(t => _termDeg(t.node));
  if(degs.some(d => d === null)) return node;
  const idx = terms.map((t, i) => i).sort((p, q) => (degs[q] - degs[p]) || (p - q));
  let out = null;
  idx.forEach(i => {
    const t = terms[i];
    if(out === null) out = t.sign > 0 ? t.node : new math.OperatorNode('-', 'unaryMinus', [t.node]);
    else out = new math.OperatorNode(t.sign > 0 ? '+' : '-', t.sign > 0 ? 'add' : 'subtract', [out, t.node]);
  });
  return out;
}

/* alamatlary daşa çykarýar: a·(−1)/4 → −a/4, hemişelik köpeldijini öňe goýýar: x^(3/2)·2/3 → 2x^(3/2)/3 */
function _isOne(n){ return n.type === 'ConstantNode' && n.value === 1; }

/* köpeltmek, hemişelik öňde: 2·x, birlik taşlanýar */
function _mul(u, v){
  if(_isOne(u)) return v;
  if(_isOne(v)) return u;
  if(v.type === 'ConstantNode' && u.type !== 'ConstantNode') return new math.OperatorNode('*', 'multiply', [v, u]);
  return new math.OperatorNode('*', 'multiply', [u, v]);
}

/* hemme agzasy otrisatel jem bolsa, položitel görnüşini gaýtarýar: −3x² − 2x → 3x² + 2x */
function _allNegSum(n){
  n = unwrap(n);
  if(!(n.type === 'OperatorNode' && (n.fn === 'add' || n.fn === 'subtract'))) return null;
  const terms = flattenSum(n, 1, []);
  if(!terms.every(t => t.sign < 0)) return null;
  let out = null;
  terms.forEach(t => { out = out === null ? t.node : new math.OperatorNode('+', 'add', [out, t.node]); });
  return out;
}

function _splitSign(n){
  n = unwrap(n);
  if(n.type === 'ConstantNode' && typeof n.value === 'number' && n.value < 0) return {s:-1, m:new math.ConstantNode(-n.value)};
  if(n.type === 'OperatorNode' && n.fn === 'unaryMinus'){ const r = _splitSign(n.args[0]); return {s:-r.s, m:r.m}; }
  if(n.type === 'OperatorNode' && n.fn === 'unaryPlus') return _splitSign(n.args[0]);
  if(n.type === 'OperatorNode' && (n.fn === 'multiply' || n.fn === 'divide')){
    const a = _splitSign(n.args[0]), b = _splitSign(n.args[1]);
    const isDiv = m => m.type === 'OperatorNode' && m.fn === 'divide';
    const [p1, q1] = isDiv(a.m) ? a.m.args : [a.m, null], [p2, q2] = isDiv(b.m) ? b.m.args : [b.m, null];
    let s = a.s*b.s, num, den;
    if(n.fn === 'multiply'){ num = _mul(p1, p2); den = (q1 && q2) ? _mul(q1, q2) : (q1 || q2); }
    else { num = q2 ? _mul(p1, q2) : p1; den = q1 ? (_isOne(p2) ? q1 : _mul(q1, p2)) : p2; }
    const pn = _allNegSum(num); if(pn){ num = pn; s = -s; }
    if(den){ const pd = _allNegSum(den); if(pd){ den = pd; s = -s; } }
    return {s, m:(!den || _isOne(den)) ? num : new math.OperatorNode('/', 'divide', [num, den])};
  }
  return {s:1, m:tidySigns(n)};
}

function tidySigns(n){
  n = unwrap(n);
  if((n.type === 'ConstantNode' && typeof n.value === 'number' && n.value < 0) || (n.type === 'OperatorNode' && ['multiply', 'divide', 'unaryMinus', 'unaryPlus'].indexOf(n.fn) !== -1)){
    const r = _splitSign(n);
    return r.s < 0 ? new math.OperatorNode('-', 'unaryMinus', [r.m]) : r.m;
  }
  if(n.type === 'OperatorNode') return new math.OperatorNode(n.op, n.fn, n.args.map(tidySigns));
  if(n.type === 'FunctionNode') return new math.FunctionNode(n.fn, n.args.map(tidySigns));
  return n;
}

function simplifySafe(node){
  try{
    const K = {}, seen = {}; let i = 0;
    const prot = node.transform(function(n){
      if(n.type === 'ParenthesisNode') return n;
      if(_isConstTree(n) && !_isRational(n)){
        const key = n.toString();
        if(!(key in seen)){ seen[key] = '_K' + (i++); K[seen[key]] = n; }
        return new math.SymbolNode(seen[key]);
      }
      return n;
    });
    const S = math.simplify(prot);
    return orderSum(tidySigns(S.transform(n => (n.type === 'SymbolNode' && K[n.name]) ? K[n.name] : n)));
  }catch(e){ return node; }
}

/* ===== modules/core/quadrature.js ===== */
/* San integrirleme: Simpsonyň formulasy we kosinus çalyşmaly birleşdirilen Gauss–Ležandr kwadraturasy (gyralardaky √(1 − x²) ýaly
   özüni alyp barşy tekizleýär) — integral, Riemann we köp integral kalkulýatorlary üçin. */

function simpson(f, a, b, n){
  const h = (b-a)/n; let sum = f(a)+f(b);
  for(let i=1;i<n;i++){ sum += (i%2===0?2:4) * f(a+i*h); }
  return (h/3)*sum;
}

const GL_X = [-0.9602898564975363, -0.7966664774136267, -0.5255324099163290, -0.1834346424956498, 0.1834346424956498, 0.5255324099163290, 0.7966664774136267, 0.9602898564975363];

const GL_W = [0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.3626837833783620, 0.3626837833783620, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];

/* ∫ₐᵇ g(t) dt — birleşdirilen Gauss–Ležandr (P bölek × 8 nokat) we t = a + (b − a)(1 − cos πs)/2 çalyşmasy:
   nokatlar uçlara golaýlaşýar, √(1 − x²) ýaly gyralardaky "dik" özüni alyp barş tekizlenýär — takyklyk ep-esli ýokarlanýar. */
function glIntegrate(g, a, b, P){
  const h = 1/P, L = b - a;
  let s = 0;
  for(let p = 0; p < P; p++){
    const m = (p + 0.5)*h, r = h/2;
    for(let i = 0; i < 8; i++){
      const u = m + r*GL_X[i], c = Math.cos(Math.PI*u);
      s += GL_W[i]*g(a + L*(1 - c)/2)*Math.sin(Math.PI*u);
    }
  }
  return s*h/2*L*Math.PI/2;
}

/* ===== modules/core/poly.js ===== */
/* Köpagzalar we rasional funksiýalar: koeffisiýentler (öz arifmetikamyz bilen), bahasy, (x − a)-a bölmek, kökler, owadan ýazgy. */

const PL_MAXDEG = 24;

function plTrim(c){ const r = c.slice(); while(r.length > 1 && Math.abs(r[r.length - 1]) < 1e-14) r.pop(); return r; }

function plAdd(a, b, s){ const n = Math.max(a.length, b.length), r = new Array(n).fill(0); for(let i = 0; i < n; i++) r[i] = (a[i] || 0) + s*(b[i] || 0); return plTrim(r); }

function plMul(a, b){
  if(a.length + b.length - 2 > PL_MAXDEG) throw new Error('dereje');
  const r = new Array(a.length + b.length - 1).fill(0);
  for(let i = 0; i < a.length; i++) if(a[i]) for(let j = 0; j < b.length; j++) r[i + j] += a[i]*b[j];
  return plTrim(r);
}

function plHasX(n){ let f = false; n.traverse(c => { if(c.type === 'SymbolNode' && c.name === 'x') f = true; }); return f; }

function plConstVal(n){ try{ const v = n.compile().evaluate({}); return (typeof v === 'number' && isFinite(v)) ? v : null; }catch(e){ return null; } }

/* rasional görnüş {n, d} (koeffisiýentler ösýän tertipde) ýa-da null. math.rationalize ulanylmaýar — ol (2x + 1)⁶ ýaly
   aňlatmalarda örän haýal; bu ýerde köpagzalaryň arifmetikasy göni ýerine ýetirilýär. */
function plRat(node){
  node = unwrap(node);
  if(!plHasX(node)){ const v = plConstVal(node); return v === null ? null : {n: [v], d: [1]}; }
  if(node.type === 'SymbolNode') return node.name === 'x' ? {n: [0, 1], d: [1]} : null;
  if(node.type !== 'OperatorNode') return null;
  const f = node.fn;
  if(f === 'unaryPlus') return plRat(node.args[0]);
  if(f === 'unaryMinus'){ const a = plRat(node.args[0]); return a && {n: a.n.map(v => -v), d: a.d}; }
  if(f === 'add' || f === 'subtract'){
    const a = plRat(node.args[0]), b = plRat(node.args[1]);
    if(!a || !b) return null;
    if(a.d.length === 1 && b.d.length === 1) return {n: plAdd(a.n.map(v => v/a.d[0]), b.n.map(v => v/b.d[0]), f === 'add' ? 1 : -1), d: [1]};
    return {n: plAdd(plMul(a.n, b.d), plMul(b.n, a.d), f === 'add' ? 1 : -1), d: plMul(a.d, b.d)};
  }
  if(f === 'multiply'){ const a = plRat(node.args[0]), b = plRat(node.args[1]); return (a && b) ? {n: plMul(a.n, b.n), d: plMul(a.d, b.d)} : null; }
  if(f === 'divide'){
    const a = plRat(node.args[0]), b = plRat(node.args[1]);
    if(!a || !b || b.n.every(v => Math.abs(v) < 1e-300)) return null;
    return {n: plMul(a.n, b.d), d: plMul(a.d, b.n)};
  }
  if(f === 'pow'){
    const k = plConstVal(node.args[1]);
    if(k === null || !Number.isInteger(k) || Math.abs(k) > PL_MAXDEG) return null;
    const a = plRat(node.args[0]);
    if(!a) return null;
    let r = {n: [1], d: [1]};
    for(let i = 0; i < Math.abs(k); i++) r = {n: plMul(r.n, a.n), d: plMul(r.d, a.d)};
    return k >= 0 ? r : {n: r.d, d: r.n};
  }
  return null;
}

/* node x boýunça köpagza bolsa koeffisiýentler [a₀, a₁, …, aₙ], ýogsam null */
function polyCoeffs(node){
  try{
    const r = plRat(node);
    if(!r) return null;
    if(r.d.length === 1) return plTrim(r.n.map(v => v/r.d[0]));
    const g = polyGcd(r.n, r.d);
    const q = polyDiv(r.d, g).q;
    if(q.length !== 1) return null;
    return plTrim(polyDiv(r.n, g).q.map(v => v/q[0]));
  }catch(e){ return null; }
}

/* rasional funksiýa P/Q: {num, den} koeffisiýentleri (umumy köpeldijiler gysgaldylan), ýogsam null */
function ratCoeffs(node){
  try{
    const r = plRat(node);
    if(!r) return null;
    let num = r.n, den = r.d;
    if(den.length > 1 && num.length > 1){
      const g = polyGcd(num, den);
      if(g.length > 1){ num = polyDiv(num, g).q; den = polyDiv(den, g).q; }
    }
    if(den.length === 1){ num = num.map(v => v/den[0]); den = [1]; }
    else {
      /* maýdalawjynyň iň kiçi bitin görnüşi: baş koeffisiýent položitel we koeffisiýentler mümkin boldugyça bitin */
      const lead = den[den.length - 1], sc = den.every(v => Number.isInteger(v)) && num.every(v => Number.isInteger(v)) ? Math.sign(lead) : lead;
      num = num.map(v => v/sc); den = den.map(v => v/sc);
    }
    return {num: plTrim(num), den: plTrim(den)};
  }catch(e){ return null; }
}

function polyEval(c, x){ let s = 0; for(let k = c.length - 1; k >= 0; k--) s = s*x + c[k]; return s; }

function polyDeriv(c){ return c.length > 1 ? c.slice(1).map((v, k) => v*(k + 1)) : [0]; }

/* (x − a)-a bölmek (Gorneriň shemasy): {q, r} */
function polyDivLinear(c, a){
  const n = c.length - 1, q = new Array(Math.max(n, 1)).fill(0);
  let acc = 0;
  for(let k = n; k >= 0; k--){ acc = acc*a + c[k]; if(k > 0) q[k - 1] = acc; }
  return {q: plTrim(q), r: acc};
}

/* P/Q bölmek: {q, r} (koeffisiýentler) */
function polyDiv(P, Q){
  P = plTrim(P); Q = plTrim(Q);
  const r = P.slice(), dq = Q.length - 1, q = new Array(Math.max(P.length - dq, 1)).fill(0);
  for(let k = P.length - 1; k >= dq; k--){
    const c = r[k]/Q[dq];
    q[k - dq] = c;
    for(let j = 0; j <= dq; j++) r[k - dq + j] -= c*Q[j];
  }
  return {q: plTrim(q), r: plTrim(r.slice(0, Math.max(dq, 1)))};
}

/* iki köpagzanyň iň uly umumy bölüjisi (Ýewklid), baş koeffisiýenti 1; umumy köpeldiji ýok bolsa [1] */
function polyGcd(A, B){
  let a = plTrim(A.slice()), b = plTrim(B.slice());
  const scale = Math.max(1, ...a.map(Math.abs), ...b.map(Math.abs));
  for(let it = 0; it < 20 && !(b.length === 1 && Math.abs(b[0]) <= 1e-9*scale); it++){
    const r = polyDiv(a, b).r.map(v => Math.abs(v) <= 1e-9*scale ? 0 : v);
    a = b; b = plTrim(r);
  }
  if(a.length <= 1) return [1];
  const lead = a[a.length - 1];
  return a.map(v => v/lead);
}

/* koeffisiýentlerden math.js düwüni: [0, 1, 1] → x^2 + x (drob koeffisiýentler p/q görnüşinde) */
function polyNode(c){
  c = plTrim(c);
  const parts = [];
  for(let k = c.length - 1; k >= 0; k--){
    const a = c[k];
    if(Math.abs(a) < 1e-12) continue;
    const s = fmtRat(Math.abs(a), 1000).replace('−', '-');
    const coef = (k > 0 && Math.abs(Math.abs(a) - 1) < 1e-12) ? '' : '(' + s + ')' + (k > 0 ? '*' : '');
    parts.push((a < 0 ? '-' : '+') + coef + (k === 0 ? '' : k === 1 ? 'x' : 'x^' + k));
  }
  if(!parts.length) return math.parse('0');
  let str = parts.join(' ');
  if(str.charAt(0) === '+') str = str.slice(1);
  return math.parse(str);
}

/* hakyky kökler (dereje ≤ 3 — math.polynomialRoot), gaýtalanmasy bilen: [{x, m}] */
function polyRealRoots(c){
  c = plTrim(c);
  const d = c.length - 1;
  if(d < 1 || d > 3) return null;
  let raw;
  try{ raw = math.polynomialRoot.apply(null, c); }catch(e){ return null; }
  const re = [];
  raw.forEach(z => {
    const x = typeof z === 'number' ? z : (Math.abs(z.im) < 1e-9*Math.max(1, Math.abs(z.re)) ? z.re : null);
    if(x !== null) re.push(Math.abs(x) < 1e-12 ? 0 : x);
  });
  re.sort((p, q) => p - q);
  const out = [];
  re.forEach(x => {
    const last = out[out.length - 1];
    if(!(last && Math.abs(last.x - x) < 1e-7*Math.max(1, Math.abs(x)))) out.push({x, m: 1});
  });
  /* gaýtalanmany önümler boýunça kesgitlemek (polynomialRoot gaýtalanýan kökleri bir gezek berip biler) */
  const scale = Math.max(1, ...c.map(Math.abs));
  out.forEach(r => {
    let der = c, m = 1;
    while(m < d){ der = polyDeriv(der); if(Math.abs(polyEval(der, r.x)) <= 1e-7*scale) m++; else break; }
    r.m = m;
  });
  const realCount = out.reduce((s, r) => s + r.m, 0);
  return {roots: out, complexCount: Math.max(0, d - realCount)};
}

/* sanyň owadan ýazgysy (drob mümkin bolsa) */
function numStr(v){ const s = fmtRat(v, 1000); return s.charAt(0) === '-' ? '−' + s.slice(1) : s; }

/* c₀ + c₁x + … owadan HTML (derejäniň kemelişi boýunça); v — üýtgeýjiniň ady, ýa-da '(x − 2)' ýaly */
function polyHtml(c, v){
  v = v || 'x';
  const parts = [];
  for(let k = c.length - 1; k >= 0; k--){
    const a = c[k];
    if(Math.abs(a) < 1e-12) continue;
    const pw = k === 0 ? '' : k === 1 ? v : v + '<sup>' + k + '</sup>', abs = Math.abs(a);
    const coef = (k > 0 && Math.abs(abs - 1) < 1e-12) ? '' : numStr(abs);
    parts.push({neg: a < 0, t: coef + pw});
  }
  if(!parts.length) return '0';
  return parts.map((p, i) => i === 0 ? (p.neg ? '−' : '') + p.t : (p.neg ? ' − ' : ' + ') + p.t).join('');
}

/* (x − a) görnüşi: a = 0 → x, a < 0 → (x + |a|) */
function linFactor(a){ return Math.abs(a) < 1e-12 ? 'x' : '(x ' + (a < 0 ? '+ ' + numStr(-a) : '− ' + numStr(a)) + ')'; }

/* ===== modules/solvers/derivative-steps.js ===== */
/* Önüm: mugallym ýaly ädimme-ädim çözgüt.
   Her bölek üçin haýsy düzgüniň saýlanýandygy we näme üçindigi görkezilýär: jem, hemişelik köpeldiji, derejeli funksiýa,
   köpeltmek hasyly, paý, çylşyrymly funksiýa (zynjyr düzgüni), görkezijili we logarifmik önüm.
   Önüm şol düzgünleriň özi bilen gurulýar (ln 2 ýaly hemişelikler simwol görnüşinde galýar), soňra ýönekeýleşdirilýär. */

const dvN = v => new math.ConstantNode(v);

const dvOp = (op, fn, a) => new math.OperatorNode(op, fn, a);

const dvAdd = (a, b) => dvOp('+', 'add', [a, b]);

const dvSub = (a, b) => dvOp('-', 'subtract', [a, b]);

const dvMul = (a, b) => dvOp('*', 'multiply', [a, b]);

const dvDiv = (a, b) => dvOp('/', 'divide', [a, b]);

const dvPow = (a, b) => dvOp('^', 'pow', [a, b]);

const dvNeg = a => dvOp('-', 'unaryMinus', [a]);

const dvFn = (name, a) => new math.FunctionNode(name, [a]);

/* Üýtgeýji: adatça x. Köp üýtgeýjili režimde (bölekleýin önüm) DV_VAR = 'x' ýa-da 'y', beýleki harplar hemişelik hasaplanýar;
   DV_OUT — zynjyr düzgünindäki daşky funksiýanyň ady (y üýtgeýji bolanda "y = sin t" bulaşdyrmaz ýaly g ulanylýar). */
let DV_VAR = 'x', DV_MULTI = false, DV_OUT = 'y';

const DV_SYMS = ['x', 'y', 'z'];

const DV_SUPV = {x: 'ˣ', y: 'ʸ', z: 'ᶻ'};

function dvHasX(n){ let f = false; n.traverse(c => { if(c.type === 'SymbolNode' && c.name === DV_VAR) f = true; }); return f; }

function dvIsX(n){ n = unwrap(n); return n.type === 'SymbolNode' && n.name === DV_VAR; }

/* islendik üýtgeýji harp (görkezmek üçin): köp üýtgeýjili režimde x, y, z */
function dvHasV(n){
  if(!DV_MULTI) return dvHasX(n);
  let f = false; n.traverse(c => { if(c.type === 'SymbolNode' && DV_SYMS.indexOf(c.name) !== -1) f = true; }); return f;
}

/* önüm alynýan üýtgeýjä bagly däl köpeldiji (köp üýtgeýjili režimde y, e^y, 3y² hem hemişelik) */
function dvIsK(n){ return DV_MULTI ? !dvHasX(n) : dvConst(n) !== null; }

function dvConst(n){
  if(dvHasX(n)) return null;
  try{ const v = n.compile().evaluate({}); return (typeof v === 'number' && isFinite(v)) ? v : null; }catch(e){ return null; }
}

/* san düwüni: bitin ýa-da ýönekeý drob (2/3) görnüşinde */
function dvNum(v){
  if(Number.isInteger(v)) return v < 0 ? dvNeg(dvN(-v)) : dvN(v);
  const r = ratApprox(Math.abs(v), 100);
  const node = r ? dvDiv(dvN(r[0]), dvN(r[1])) : dvN(Math.abs(v));
  return v < 0 ? dvNeg(node) : node;
}

/* görkezmek üçin: x^(−n) → 1/xⁿ, x^(1/2) → √x, sec/csc → 1/cos, 1/sin */
function dvTidy(n){
  return n.transform(function tidy(m){
    if(m.type === 'FunctionNode' && (m.fn.name === 'sec' || m.fn.name === 'csc') && m.args.length === 1)
      return dvDiv(dvN(1), dvFn(m.fn.name === 'sec' ? 'cos' : 'sin', dvTidy(m.args[0])));
    if(m.type === 'OperatorNode' && m.fn === 'pow'){
      const base = unwrap(m.args[0]), e = dvConst(m.args[1]);
      if(base.type === 'FunctionNode' && (base.fn.name === 'sec' || base.fn.name === 'csc') && e !== null && e > 0)
        return dvDiv(dvN(1), dvPow(dvFn(base.fn.name === 'sec' ? 'cos' : 'sin', dvTidy(base.args[0])), dvNum(e)));
      if(e !== null && e < 0 && dvHasV(base)){
        const b = dvTidy(m.args[0]), pe = -e;
        return dvDiv(dvN(1), pe === 1 ? b : Math.abs(pe - 0.5) < 1e-12 ? dvFn('sqrt', b) : dvPow(b, dvNum(pe)));
      }
      if(e !== null && Math.abs(e - 0.5) < 1e-12 && dvHasV(base)) return dvFn('sqrt', dvTidy(m.args[0]));
    }
    if(m.type === 'OperatorNode' && (m.fn === 'divide' || m.fn === 'multiply')){
      const a = dvTidy(m.args[0]), b = dvTidy(m.args[1]), ua = unwrap(a), ub = unwrap(b);
      const isRecip = u => u.type === 'OperatorNode' && u.fn === 'divide' && unwrap(u.args[0]).type === 'ConstantNode' && unwrap(u.args[0]).value === 1;
      if(m.fn === 'divide' && isRecip(ua)) return dvDiv(dvN(1), dvConst(b) !== null ? dvMul(b, ua.args[1]) : dvMul(ua.args[1], b));
      if(m.fn === 'multiply' && isRecip(ub)) return dvDiv(a, ub.args[1]);
      if(m.fn === 'multiply' && isRecip(ua)) return dvDiv(b, ua.args[1]);
      return new math.OperatorNode(m.op, m.fn, [a, b]);
    }
    return m;
  });
}

/* √u² → u (görkezmek we ýönekeýleşdirmek üçin) */
function dvSqrtSq(n){
  return n.transform(function sq(m){
    if(m.type === 'OperatorNode' && m.fn === 'pow'){
      const b = unwrap(m.args[0]), e = dvConst(m.args[1]);
      if(b.type === 'FunctionNode' && b.fn.name === 'sqrt' && e !== null && Number.isInteger(e) && e > 0 && e % 2 === 0){
        const u = dvSqrtSq(b.args[0]);
        return e === 2 ? u : dvPow(u, dvN(e/2));
      }
    }
    return m;
  });
}

/* köpeldijileriň tertibi: san, hemişelik, x-iň derejesi, funksiýalar, jemler — 2·cos(x²)·x → 2x·cos(x²) */
function dvOrder(n){
  return n.transform(function ord(m){
    if(m.type === 'OperatorNode' && m.fn === 'multiply'){
      const fs = dvFactors(m, []).map(f => dvOrder(f));
      const symOf = u => { const b = u.type === 'OperatorNode' && u.fn === 'pow' && !dvHasV(u.args[1]) ? unwrap(u.args[0]) : u; return b.type === 'SymbolNode' && DV_SYMS.indexOf(b.name) !== -1 ? b.name : null; };
      const cat = f => {
        const u = unwrap(f);
        if(u.type === 'ConstantNode') return 0;
        if(!dvHasV(u)) return 1;
        if(DV_MULTI ? symOf(u) : (dvIsX(u) || (u.type === 'OperatorNode' && u.fn === 'pow' && dvIsX(u.args[0]) && !dvHasX(u.args[1])))) return 2;
        if(u.type === 'OperatorNode' && (u.fn === 'add' || u.fn === 'subtract')) return 4;
        return 3;
      };
      /* köp üýtgeýjili režimde harplar elipbiý tertibinde: 2xy, 3xy² */
      const key = f => DV_MULTI ? (symOf(unwrap(f)) || '') : '';
      return dvProduct(fs.map((f, i) => ({f, i, c: cat(f), k: key(f)})).sort((a, b) => a.c - b.c || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0) || a.i - b.i).map(o => o.f));
    }
    return m;
  });
}

/* aňlatmanyň "agramy": düwünleriň sany + gödek görnüşler üçin jerime */
function dvScore(n){
  let sc = 0;
  n.traverse((m, path, parent) => {
    sc++;
    if(m.type === 'OperatorNode'){
      if(m.fn === 'pow'){ const b = unwrap(m.args[0]); if(b.type === 'FunctionNode' && b.fn.name === 'sqrt') sc += 4; }
      if(m.fn === 'divide' && parent && parent.type === 'OperatorNode' && parent.fn === 'divide') sc += 3;
      if(m.fn === 'divide'){ const nu = unwrap(m.args[0]); if(nu.type === 'OperatorNode' && (nu.fn === 'add' || nu.fn === 'subtract') && nu.args.some(a => { const ua = unwrap(a); return ua.type === 'OperatorNode' && ua.fn === 'divide'; })) sc += 2; }
      if(m.fn === 'unaryMinus' && parent && parent.type === 'OperatorNode' && parent.fn === 'multiply') sc += 2;
      if((m.fn === 'multiply' || m.fn === 'add') && m.args.some(a => a.type === 'ConstantNode' && (a.value === 1 && m.fn === 'multiply' || a.value === 0))) sc += 2;
      if(m.fn === 'multiply' && unwrap(m.args[0]).type !== 'ConstantNode' && m.args[0].toString() === m.args[1].toString()) sc += 3;   // x·x → x²
    }
  });
  return sc;
}

/* rasional aňlatma: sanawjy/maýdalawjy açylan görnüşde (umumy köpeldijiler gysgaldylan) */
function dvRat(raw){
  let rational = true;
  raw.traverse(m => { if(m.type === 'FunctionNode' || (m.type === 'SymbolNode' && m.name !== 'x')) rational = false; });
  if(!rational) return null;
  const R = ratCoeffs(raw);
  if(!R || R.num.length > 9 || R.den.length > 9) return null;
  return R.den.length === 1 ? polyNode(R.num) : dvDiv(polyNode(R.num), polyNode(R.den));
}

function dvSame(a, b){
  const fa = a.compile(), fb = b.compile(), Y = [0.83, 1.47, 0.61], Z = [1.19, 0.29, 1.73];
  for(const [i, x] of [0.37, 1.21, 2.53].entries()){
    const sc = DV_MULTI ? {x, y: Y[i], z: Z[i]} : {x};
    let va, vb;
    try{ va = fa.evaluate(sc); vb = fb.evaluate(sc); }catch(e){ continue; }
    if(typeof va !== 'number' || typeof vb !== 'number' || !isFinite(va)) continue;
    if(Math.abs(va - vb) > 1e-9*Math.max(1, Math.abs(va))) return false;
  }
  return true;
}

/* içinde skobkaly köpeltmek bolan köpagza jemini açmak: x² − 2·(x − 1) → x² − 2x + 2 */
function dvPolyTidy(n){
  return n.transform(function pt(m){
    if(m.type === 'OperatorNode' && (m.fn === 'add' || m.fn === 'subtract')){
      let nested = false;
      m.traverse(c => { if(c !== m && c.type === 'OperatorNode' && c.fn === 'multiply' && c.args.some(a => { const ua = unwrap(a); return ua.type === 'OperatorNode' && (ua.fn === 'add' || ua.fn === 'subtract'); })) nested = true; });
      if(nested){ const R = ratCoeffs(m); if(R && R.den.length === 1 && R.num.length <= 7) return polyNode(R.num); }
    }
    return m;
  });
}

/* jemiň agzalarynyň tertibi: x-iň derejeleri (uludan kiçä), soň beýleki agzalar, iň soňunda hemişelikler: −sin(2x)/4 + x/2 → x/2 − sin(2x)/4 */
function dvSumOrder(n){
  return n.transform(function so(m){
    if(m.type === 'OperatorNode' && (m.fn === 'add' || m.fn === 'subtract')) return dvSumOrder1(m);
    return m;
  });
}

function dvSumOrder1(u){
  const terms = flattenSum(u, 1, []).map(t => ({node: dvSumOrder(t.node), sign: t.sign})).map((t, i) => {
    let key;
    if(DV_MULTI) key = [0, 0];
    else if(!dvHasX(t.node)) key = [2, 0];
    else { const R = ratCoeffs(t.node); key = (R && R.den.length === 1) ? [0, -(R.num.length - 1)] : [1, 0]; }
    return {t, i, key};
  });
  terms.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.i - b.i);
  let out = null;
  terms.forEach(({t}) => { out = out === null ? (t.sign > 0 ? t.node : dvNeg(t.node)) : (t.sign > 0 ? dvAdd(out, t.node) : dvSub(out, t.node)); });
  return out;
}

/* (A ± B)/c → A/c ± B/c (c hemişelik): (x − sin 2x/2)/2 → x/2 − sin(2x)/4 */
function dvDistrib(n){
  const u = unwrap(n);
  if(!(u.type === 'OperatorNode' && u.fn === 'divide' && dvConst(u.args[1]) !== null)) return null;
  const num = unwrap(u.args[0]);
  if(!(num.type === 'OperatorNode' && (num.fn === 'add' || num.fn === 'subtract'))) return null;
  const terms = flattenSum(num, 1, []);
  let out = null;
  terms.forEach(t => { const q = simplifySafe(dvDiv(t.node, u.args[1])); out = out === null ? (t.sign > 0 ? q : dvNeg(q)) : (t.sign > 0 ? dvAdd(out, q) : dvSub(out, q)); });
  return out;
}

/* daşky minusy jemiň içine geçirmek: −(−4x³ + 6x)/u → (4x³ − 6x)/u */
function dvNegOut(n){
  const u = unwrap(n), isSum = m => m.type === 'OperatorNode' && (m.fn === 'add' || m.fn === 'subtract');
  if(u.type === 'OperatorNode' && u.fn === 'unaryMinus'){
    const a = unwrap(u.args[0]);
    if(a.type === 'OperatorNode' && a.fn === 'divide' && isSum(unwrap(a.args[0]))) return dvDiv(simplifySafe(dvNeg(unwrap(a.args[0]))), a.args[1]);
    if(isSum(a)) return simplifySafe(dvNeg(a));
  }
  if(u.type === 'OperatorNode' && u.fn === 'divide'){
    const num = unwrap(u.args[0]);
    if(num.type === 'OperatorNode' && num.fn === 'unaryMinus' && isSum(unwrap(num.args[0]))) return dvDiv(simplifySafe(dvNeg(unwrap(num.args[0]))), u.args[1]);
  }
  return null;
}

/* iň "owadan" ýönekeýleşdirilen görnüş: birnäçe dalaşgärden iň ýeňili (san taýdan barlanan) */
function dvS(raw, extra){
  const cands = (extra || []).slice();
  const tryAdd = f => { try{ const r = f(); if(r) cands.push(r); }catch(e){ /* dalaşgär taşlanýar */ } };
  let s1 = null;
  tryAdd(() => (s1 = simplifySafe(raw)));
  tryAdd(() => s1 ? simplifySafe(dvSqrtSq(s1)) : null);
  tryAdd(() => math.simplifyCore(raw));
  tryAdd(() => dvRat(raw));
  tryAdd(() => s1 ? dvDistrib(s1) : null);
  tryAdd(() => s1 ? dvNegOut(s1) : null);
  let best = null, bs = Infinity;
  cands.forEach(c => {
    const t = dvSumOrder(dvOrder(dvPolyTidy(dvSqrtSq(c))));
    const sc = dvScore(dvTidy(t));
    if(sc < bs && (best === null || dvSame(raw, t))){ bs = sc; best = t; }
  });
  return best || raw;
}

const P = n => prettyNode(dvTidy(n));

function dvPf(n){
  const u = unwrap(dvTidy(n)), s = prettyNode(u);
  return ((u.type === 'OperatorNode' && ['add', 'subtract', 'unaryMinus', 'divide'].indexOf(u.fn) !== -1) || (u.type === 'ConstantNode' && u.value < 0)) ? '(' + s + ')' : s;
}

function dvPp(n){
  const u = unwrap(dvTidy(n)), s = prettyNode(u);
  return (u.type === 'OperatorNode' || (u.type === 'ConstantNode' && u.value < 0)) ? '(' + s + ')' : s;
}

/* maýdalawjy üçin: diňe jem, köpeltmek, bölmek ýa-da otrisatel bolsa skobka */
function dvPd(n){
  const u = unwrap(dvTidy(n)), s = prettyNode(u);
  return ((u.type === 'OperatorNode' && ['add', 'subtract', 'multiply', 'divide', 'unaryMinus'].indexOf(u.fn) !== -1) || (u.type === 'ConstantNode' && u.value < 0)) ? '(' + s + ')' : s;
}

/* t^k ýazgysy: k = 1 → t, k = 0 → 1 */
function dvPowStr(base, k){
  const v = dvConst(k);
  if(v === 1) return base;
  if(v === 0) return '1';
  return base + '<sup>' + P(k) + '</sup>';
}

const dvNest = (title, items) => title + (items.length ? '<ol class="steps sub">' + items.map(s => '<li>' + s + '</li>').join('') + '</ol>' : '');

const dvRule = s => s.rule ? ' <span class="rule">(' + s.rule + ')</span>' : '';

const dvEq = (rawS, d) => rawS === P(d) ? '' : ' = ' + P(d);

/* daşky funksiýalaryň önümleri (t boýunça) */
const DV_TAB = {
  sin: 'cos(t)', cos: '-sin(t)', tan: '1/cos(t)^2', cot: '-1/sin(t)^2', sec: 'sin(t)/cos(t)^2', csc: '-cos(t)/sin(t)^2',
  asin: '1/sqrt(1-t^2)', acos: '-1/sqrt(1-t^2)', atan: '1/(1+t^2)', acot: '-1/(1+t^2)',
  sinh: 'cosh(t)', cosh: 'sinh(t)', tanh: '1/cosh(t)^2',
  exp: 'exp(t)', log: '1/t', log10: '1/(t*log(10))', log2: '1/(t*log(2))', sqrt: '1/(2*sqrt(t))', cbrt: '1/(3*cbrt(t)^2)', abs: 't/abs(t)'
};

const DV_KIND = {
  sin: 'trigonometrik funksiýa', cos: 'trigonometrik funksiýa', tan: 'trigonometrik funksiýa', cot: 'trigonometrik funksiýa', sec: 'trigonometrik funksiýa', csc: 'trigonometrik funksiýa',
  asin: 'ters trigonometrik funksiýa', acos: 'ters trigonometrik funksiýa', atan: 'ters trigonometrik funksiýa', acot: 'ters trigonometrik funksiýa',
  sinh: 'giperbolik funksiýa', cosh: 'giperbolik funksiýa', tanh: 'giperbolik funksiýa',
  exp: 'görkezijili funksiýa', log: 'logarifmik funksiýa', log10: 'logarifmik funksiýa', log2: 'logarifmik funksiýa', sqrt: 'kök', cbrt: 'kök', abs: 'modul'
};

/* u′ setiri: ýönekeý bolsa bir setirde, ýogsam içki düşündiriş bilen */
function dvItem(label, node, s){
  if(s.simple) return label + ' = (' + P(node) + ')′ = ' + P(s.d) + dvRule(s);
  return dvNest(label + ' = (' + P(node) + ')′:', [s.html]);
}

/* köpeltmek hasylynyň köpeldijileri */
function dvFactors(n, out){
  n = unwrap(n);
  if(n.type === 'OperatorNode' && n.fn === 'multiply'){ dvFactors(n.args[0], out); dvFactors(n.args[1], out); }
  else out.push(n);
  return out;
}

function dvProduct(list){ return list.reduce((acc, f) => acc === null ? f : dvMul(acc, f), null); }

/* netije obýekti: raw — ýönekeýleşdirilmedik önüm (ata düwün öz önümini şundan gurýar), d — görkezmek üçin owadan görnüş */
function dvSumS(node){
  const terms = flattenSum(node, 1, []);
  const parts = terms.map(t => ({t, s: dvStep(t.node)}));
  let raw = null;
  parts.forEach(({t, s}) => { raw = raw === null ? (t.sign > 0 ? s.raw : dvNeg(s.raw)) : (t.sign > 0 ? dvAdd(raw, s.raw) : dvSub(raw, s.raw)); });
  const d = dvS(raw);
  const items = parts.map(({t, s}) => {
    if(!s.simple) return s.html;
    const lhs = t.sign > 0 ? '(' + P(t.node) + ')′' : '(−' + dvPf(t.node) + ')′', sg = t.sign > 0 ? '' : '−';
    /* köp üýtgeýjili režim: harply hemişelik köpeldiji aç-açan görkezilýär — (x²y)′ₓ = y·(x²)′ₓ = y·2x = 2xy */
    if(DV_MULTI && s.k && dvHasV(s.k)){
      const mid = sg + dvPf(s.k) + '·' + dvPf(s.uD);
      return lhs + ' = ' + sg + dvPf(s.k) + '·(' + P(s.u) + ')′ = ' + mid + (mid === sg + dvPf(s.d) ? '' : ' = ' + (sg ? sg + dvPf(s.d) : P(s.d))) + ' <span class="rule">(' + P(s.k) + ' — hemişelik köpeldiji)</span>';
    }
    if(DV_MULTI && s.rule === 'hemişelik' && dvHasV(t.node)) return lhs + ' = 0 <span class="rule">(' + DV_VAR + '-e bagly däl — hemişelik)</span>';
    return t.sign > 0 ? lhs + ' = ' + P(s.d) + dvRule(s) : lhs + ' = ' + (dvConst(s.d) === 0 ? '0' : '−' + dvPf(s.d)) + dvRule(s);
  });
  const title = '<b>Jemiň önümi</b>: (u ± v)′ = u′ ± v′ — her agzany aýratyn önümleýäris:';
  const tail = 'Jemlesek: (' + P(node) + ')′ = ' + P(d) + '.';
  const easy = parts.length <= 4 && parts.every(({s}) => s.simple && (s.rule === 'hemişelik' || s.rule === 'derejeli funksiýa' || s.rule === 'hemişelik köpeldiji' || !s.rule));
  if(easy) return {raw, d, html: '(' + P(node) + ')′ = ' + P(d) + ' — jemiň önümi: her agzanyň önümi aýratyn alyndy.', simple: true, rule: 'jemiň önümi', sum: {title, items, tail}};
  return {raw, d, html: dvNest(title, items) + tail, simple: false, sum: {title, items, tail}};
}

function dvProdS(node){
  const fs = dvFactors(node, []), consts = fs.filter(dvIsK), rest = fs.filter(f => !dvIsK(f));
  if(consts.length && rest.length){
    const k = dvProduct(consts), u = dvProduct(rest), s = dvStep(u), raw = dvMul(k, s.raw), d = dvS(raw, [dvMul(k, s.d)]);
    const head = '<b>Hemişelik köpeldiji</b> önümiň daşyna çykýar: (' + P(node) + ')′ = ' + dvPf(k) + '·(' + P(u) + ')′';
    const rawS = dvPf(k) + '·' + dvPf(s.d);
    if(s.simple) return {raw, d, html: head + ' = ' + rawS + dvEq(rawS, d) + dvRule(s) + '.', simple: true, rule: 'hemişelik köpeldiji', k, u, uD: s.d};
    return {raw, d, html: dvNest(head + ':', [s.html]) + '⇒ (' + P(node) + ')′ = ' + rawS + dvEq(rawS, d) + '.', simple: false};
  }
  const A = rest[0], B = dvProduct(rest.slice(1)), su = dvStep(A), sv = dvStep(B);
  const raw = dvAdd(dvMul(su.raw, B), dvMul(A, sv.raw)), d = dvS(raw);
  const head = '<b>Köpeltmek hasylynyň önümi</b>: (u·v)′ = u′·v + u·v′, bu ýerde u = ' + P(A) + ', v = ' + P(B) + ':';
  const rawS = dvPf(su.d) + '·' + dvPf(B) + ' + ' + dvPf(A) + '·' + dvPf(sv.d);
  return {raw, d, html: dvNest(head, [dvItem('u′', A, su), dvItem('v′', B, sv)]) + '⇒ (' + P(node) + ')′ = ' + rawS + dvEq(rawS, d) + '.', simple: false};
}

/* v² (v = √u bolsa u) */
function dvSq(v){ const u = unwrap(v); return (u.type === 'FunctionNode' && u.fn.name === 'sqrt') ? u.args[0] : dvPow(v, dvN(2)); }

function dvQuotS(node){
  const A = node.args[0], B = node.args[1], ca = dvIsK(A) ? 1 : null, cb = dvIsK(B) ? 1 : null;
  if(cb !== null){
    const s = dvStep(A), raw = dvDiv(s.raw, B), d = dvS(raw);
    const head = '<b>Hemişelik maýdalawjy</b>: (u/c)′ = u′/c ⇒ (' + P(node) + ')′ = (' + P(A) + ')′/' + dvPd(B);
    const rawS = dvPf(s.d) + '/' + dvPd(B);
    if(s.simple) return {raw, d, html: head + ' = ' + rawS + dvEq(rawS, d) + dvRule(s) + '.', simple: true, rule: 'hemişelik köpeldiji'};
    return {raw, d, html: dvNest(head + ':', [s.html]) + '⇒ (' + P(node) + ')′ = ' + rawS + dvEq(rawS, d) + '.', simple: false};
  }
  if(ca !== null){
    const s = dvStep(B), raw = dvNeg(dvDiv(dvMul(A, s.raw), dvSq(B))), d = dvS(raw);
    const head = '<b>Hemişelik / funksiýa</b>: (c/v)′ = −c·v′/v², bu ýerde c = ' + P(A) + ', v = ' + P(B) + ':';
    const rawS = '−' + dvPf(A) + '·' + dvPf(s.d) + '/' + dvPd(dvSq(B));
    return {raw, d, html: dvNest(head, [dvItem('v′', B, s)]) + '⇒ (' + P(node) + ')′ = ' + rawS + dvEq(rawS, d) + '.', simple: false};
  }
  const su = dvStep(A), sv = dvStep(B);
  const Nraw = dvSub(dvMul(su.raw, B), dvMul(A, sv.raw)), D = dvSq(B), raw = dvDiv(Nraw, D);
  const N = dvS(Nraw), alt = dvDiv(N, D), full = dvS(raw);
  const d = dvScore(dvTidy(alt)) <= dvScore(dvTidy(full)) ? alt : full;
  const head = '<b>Paýyň önümi</b>: (u/v)′ = (u′·v − u·v′)/v², bu ýerde u = ' + P(A) + ', v = ' + P(B) + ':';
  const rawS = '(' + dvPf(su.d) + '·' + dvPf(B) + ' − ' + dvPf(A) + '·' + dvPf(sv.d) + ')/' + dvPd(D);
  return {raw, d, html: dvNest(head, [dvItem('u′', A, su), dvItem('v′', B, sv)]) + '⇒ (' + P(node) + ')′ = ' + rawS + dvEq(rawS, d) + '.', simple: false};
}

/* zynjyr düzgüniniň umumy setiri: daşky önüm (içki bilen) · içkiniň önümi */
function dvChain(node, head, g, s, outerG){
  const raw = dvMul(outerG, s.raw), d = dvS(raw), og = dvS(outerG), rawS = dvPf(og) + '·' + dvPf(s.d);
  if(s.simple) return {raw, d, html: head + ', t′ = (' + P(g) + ')′ = ' + P(s.d) + ' ⇒ (' + P(node) + ')′ = ' + rawS + dvEq(rawS, d) + '.', simple: false};
  return {raw, d, html: dvNest(head + ':', [dvItem('t′', g, s)]) + '⇒ (' + P(node) + ')′ = ' + rawS + dvEq(rawS, d) + '.', simple: false};
}

function dvPowS(node){
  const U = node.args[0], W = node.args[1], hu = dvHasX(U), hw = dvHasX(W);
  if(hu && !hw){
    const nm1 = simplifySafe(dvSub(W, dvN(1)));
    if(dvIsX(U)){
      const raw = dvMul(W, dvPow(U, nm1)), d = dvS(raw);
      const rawS = dvPf(W) + '·' + dvPowStr(DV_VAR, nm1);
      return {raw, d, html: '(' + P(node) + ')′ = ' + rawS + dvEq(rawS, d) + ' — derejeli funksiýa: (' + DV_VAR + 'ⁿ)′ = n·' + DV_VAR + 'ⁿ⁻¹.', simple: true, rule: 'derejeli funksiýa'};
    }
    const s = dvStep(U);
    const O = DV_OUT, head = '<b>Çylşyrymly funksiýa</b> (zynjyr düzgüni): daşky ' + O + ' = t<sup>' + P(W) + '</sup>, içki t = ' + P(U) + '; ' + O + '′ = ' + O + '′(t)·t′, bu ýerde ' + O + '′(t) = ' + dvPf(W) + '·' + dvPowStr('t', nm1);
    return dvChain(node, head, U, s, dvMul(W, dvPow(U, nm1)));
  }
  if(!hu && hw){
    const bu = unwrap(U), isE = bu.type === 'SymbolNode' && bu.name === 'e';
    const outerG = isE ? dvPow(U, W) : dvMul(dvPow(U, W), dvFn('log', U));
    if(dvIsX(W)){
      const d = dvS(outerG);
      const sv = DV_SUPV[DV_VAR] || 'ˣ';
      return {raw: outerG, d, html: '(' + P(node) + ')′ = ' + P(d) + (isE ? ' — görkezijili funksiýa: (e' + sv + ')′ = e' + sv + '.' : ' — görkezijili funksiýa: (a' + sv + ')′ = a' + sv + '·ln a.'), simple: true, rule: 'görkezijili funksiýa'};
    }
    const s = dvStep(W), bs = dvPp(U);
    const O = DV_OUT, head = '<b>Çylşyrymly funksiýa</b> (zynjyr düzgüni): daşky ' + O + ' = ' + bs + '<sup>t</sup>, içki t = ' + P(W) + '; ' + O + '′ = ' + O + '′(t)·t′, bu ýerde ' + O + '′(t) = ' + (isE ? 'e<sup>t</sup>' : bs + '<sup>t</sup>·ln ' + bs);
    return dvChain(node, head, W, s, outerG);
  }
  const su = dvStep(U), sv = dvStep(W);
  const innerRaw = dvAdd(dvMul(sv.raw, dvFn('log', U)), dvDiv(dvMul(W, su.raw), U)), inner = dvS(innerRaw);
  const raw = dvMul(node, innerRaw), alt = dvMul(node, inner), full = dvS(raw);
  const d = dvScore(dvTidy(alt)) <= dvScore(dvTidy(full)) ? alt : full;
  const O = DV_OUT, head = '<b>Logarifmik önüm</b> (esas hem, dereje hem ' + DV_VAR + '-e bagly): ' + O + ' = u<sup>v</sup> ⇒ ln ' + O + ' = v·ln u ⇒ ' + O + '′/' + O + ' = v′·ln u + v·u′/u, bu ýerde u = ' + P(U) + ', v = ' + P(W) + ':';
  const rawS = dvPp(node) + '·(' + P(inner) + ')';
  return {raw, d, html: dvNest(head, [dvItem('u′', U, su), dvItem('v′', W, sv)]) + '⇒ ' + O + '′ = ' + rawS + dvEq(rawS, d) + '.', simple: false};
}

function dvFuncS(node){
  const name = node.fn.name, g = node.args[0], outerT = math.parse(DV_TAB[name]);
  const outerG = outerT.transform(m => (m.type === 'SymbolNode' && m.name === 't') ? g : m);
  if(dvIsX(g)){
    const d = dvS(outerG);
    return {raw: outerG, d, html: '(' + P(node) + ')′ = ' + P(d) + ' — ' + DV_KIND[name] + ' (önümler tablisasy).', simple: true, rule: DV_KIND[name]};
  }
  const s = dvStep(g);
  const O = DV_OUT, head = '<b>Çylşyrymly funksiýa</b> (zynjyr düzgüni): daşky ' + O + ' = ' + P(dvFn(name, new math.SymbolNode('t'))) + ', içki t = ' + P(g) + '; ' + O + '′ = ' + O + '′(t)·t′, bu ýerde ' + O + '′(t) = ' + P(outerT);
  return dvChain(node, head, g, s, outerG);
}

function dvLogBase(node){
  const g = node.args[0], b = node.args[1];
  if(dvHasX(b)){ const raw = math.derivative(node, DV_VAR), d = dvS(dvTidy(raw)); return {raw, d, html: '(' + P(node) + ')′ = ' + P(d) + '.', simple: true}; }
  const s = dvStep(g), raw = dvDiv(s.raw, dvMul(g, dvFn('log', b))), d = dvS(raw);
  const rawS = dvPf(s.d) + '/(' + dvPf(g) + '·ln ' + dvPp(b) + ')';
  const head = '<b>Logarifm</b>: (log<sub>b</sub> u)′ = u′/(u·ln b), bu ýerde u = ' + P(g) + ', b = ' + P(b);
  if(s.simple) return {raw, d, html: head + ', u′ = ' + P(s.d) + ' ⇒ (' + P(node) + ')′ = ' + rawS + dvEq(rawS, d) + '.', simple: dvIsX(g), rule: 'logarifmik funksiýa'};
  return {raw, d, html: dvNest(head + ':', [dvItem('u′', g, s)]) + '⇒ (' + P(node) + ')′ = ' + rawS + dvEq(rawS, d) + '.', simple: false};
}

/* (ln|u|)′ = u′/u */
function dvLogAbs(node){
  const g = unwrap(node.args[0]).args[0], s = dvStep(g), raw = dvDiv(s.raw, g), d = dvS(raw);
  if(dvIsX(g)) return {raw, d, html: '(' + P(node) + ')′ = ' + P(d) + ' — logarifmik funksiýa: (ln|' + DV_VAR + '|)′ = 1/' + DV_VAR + '.', simple: true, rule: 'logarifmik funksiýa'};
  const rawS = dvPf(s.d) + '/' + dvPd(g);
  const head = '<b>Logarifm</b>: (ln|u|)′ = u′/u, bu ýerde u = ' + P(g);
  if(s.simple) return {raw, d, html: head + ', u′ = ' + P(s.d) + ' ⇒ (' + P(node) + ')′ = ' + rawS + dvEq(rawS, d) + '.', simple: false};
  return {raw, d, html: dvNest(head + ':', [dvItem('u′', g, s)]) + '⇒ (' + P(node) + ')′ = ' + rawS + dvEq(rawS, d) + '.', simple: false};
}

function dvNegS(node){
  const a = node.args[0], s = dvStep(a), raw = dvNeg(s.raw), d = dvS(raw);
  if(s.simple) return {raw, d, html: '(' + P(node) + ')′ = −(' + P(a) + ')′ = ' + P(d) + dvRule(s) + '.', simple: true, rule: s.rule};
  return {raw, d, html: dvNest('(−u)′ = −u′:', [s.html]) + '⇒ (' + P(node) + ')′ = ' + P(d) + '.', simple: false};
}

/* {raw, d, html, simple, rule?}: raw — düzgünler bilen gurlan önüm, d — ýönekeýleşdirilen, html — düşündiriş,
   simple — tablisadan ýa-da bir düzgünden bir ädim */
function dvStep(node){
  node = unwrap(node);
  if(!dvHasX(node)) return {raw: dvN(0), d: dvN(0), html: '(' + P(node) + ')′ = 0 — hemişeligiň önümi nola deň' + (DV_MULTI && dvHasV(node) ? ' (' + DV_VAR + '-e bagly däl)' : '') + '.', simple: true, rule: 'hemişelik'};
  if(dvIsX(node)) return {raw: dvN(1), d: dvN(1), html: '(' + DV_VAR + ')′ = 1.', simple: true};
  if(node.type === 'OperatorNode'){
    switch(node.fn){
      case 'unaryPlus': return dvStep(node.args[0]);
      case 'unaryMinus': return dvNegS(node);
      case 'add': case 'subtract': return dvSumS(node);
      case 'multiply': return dvProdS(node);
      case 'divide': return dvQuotS(node);
      case 'pow': return dvPowS(node);
    }
  }
  if(node.type === 'FunctionNode'){
    if(node.fn.name === 'log' && node.args.length === 2) return dvLogBase(node);
    if(node.fn.name === 'log' && node.args.length === 1 && unwrap(node.args[0]).type === 'FunctionNode' && unwrap(node.args[0]).fn.name === 'abs') return dvLogAbs(node);
    if(node.args.length === 1 && DV_TAB[node.fn.name]) return dvFuncS(node);
  }
  const raw = math.derivative(node, DV_VAR), d = dvS(dvTidy(raw));
  return {raw, d, html: '(' + P(node) + ')′ = ' + P(d) + '.', simple: true};
}

/* Esasy: f(x) üçin ädimler we önüm. Gaýtarýar {steps: [html], d: node} */
function derivSteps(node){
  const s = dvStep(node);
  if(s.sum) return {steps: [s.sum.title.replace(/:$/, '.')].concat(s.sum.items, [s.sum.tail]), d: s.d};
  return {steps: [s.html], d: s.d};
}

/* owadan ýönekeýleşdirmek — başga modullar üçin (integral, limit) */
function niceSimplify(node){ return dvS(node); }

/* diňe önüm (ýönekeýleşdirilen, ln 2 simwol görnüşinde) — başga modullar üçin */
function derivNice(node){ return dvStep(node).d; }

/* önümi görkezmek (sec → 1/cos, x^(−1/2) → 1/√x) */
function derivPretty(d){ return P(d); }

/* ---- köp üýtgeýjili režim (bölekleýin önüm, köp integrallar) ---- */
function dvWith(v, fn){
  const keep = [DV_VAR, DV_MULTI, DV_OUT];
  DV_VAR = v; DV_MULTI = true; DV_OUT = 'g';
  try{ return fn(); } finally { DV_VAR = keep[0]; DV_MULTI = keep[1]; DV_OUT = keep[2]; }
}

/* ∂/∂v: ädimler (′ belgisi ′<sub>v</sub> görnüşinde) we önüm. Beýleki harplar hemişelik. */
function derivStepsVar(node, v){
  return dvWith(v, () => {
    const r = derivSteps(node);
    return {steps: r.steps.map(h => h.replace(/\)′/g, ')′<sub>' + v + '</sub>')), d: r.d};
  });
}

/* ∂f/∂v (ýönekeýleşdirilen) */
function derivNiceVar(node, v){ return dvWith(v, () => dvStep(node).d); }

/* köp üýtgeýjili aňlatmany owadan ýönekeýleşdirmek we görkezmek (2xy, 1/y²) */
function niceSimplifyVar(node){ return dvWith('x', () => dvS(node)); }

function prettyVar(node, K){ return dvWith('x', () => prettyNode(dvTidy(node), K)); }

/* ===== modules/solvers/integral-steps.js ===== */
/* Integral: mugallym ýaly ädimme-ädim çözgüt — usuly saýlamak we näme üçin saýlanýandygyny düşündirmek:
   çyzyklylyk we hemişelik köpeldiji, integrallar tablisasy (çyzykly argument bilen), köpagzany açmak, köpagzalary bölmek,
   ýönekeý droblara dagytmak (örtmek usuly), doly kwadrata getirmek, trigonometrik toždestwolar, ornuna goýma (u-çalşyrma),
   bölekleýin integrirlemek (şol sanda aýlanýan halat eᵃˣ·sin bx). Tapylan F(x) önüm bilen barlanýar: F′(x) = f(x). */

const igX = () => new math.SymbolNode('x');

const igN = v => new math.ConstantNode(v);

const igOp = (op, fn, a) => new math.OperatorNode(op, fn, a);

const igAdd = (a, b) => igOp('+', 'add', [a, b]);

const igSub = (a, b) => igOp('-', 'subtract', [a, b]);

const igMul = (a, b) => igOp('*', 'multiply', [a, b]);

const igDiv = (a, b) => igOp('/', 'divide', [a, b]);

const igPow = (a, b) => igOp('^', 'pow', [a, b]);

const igNeg = a => igOp('-', 'unaryMinus', [a]);

const igFn = (name, a) => new math.FunctionNode(name, [a]);

const igLnAbs = u => igFn('log', igFn('abs', u));

/* bir çözgüt üçin çäkler: gaýtalanýan işi ýatda saklamak we gözlegiň gaty uzap gitmezligi */
let IG_BUDGET = 0, IG_NEST = 0;

const IG_CACHE = new Map();

function igHasX(n){ let f = false; n.traverse(c => { if(c.type === 'SymbolNode' && c.name === 'x') f = true; }); return f; }

function igIsX(n){ n = unwrap(n); return n.type === 'SymbolNode' && n.name === 'x'; }

function igConst(n){
  if(igHasX(n)) return null;
  try{ const v = n.compile().evaluate({}); return (typeof v === 'number' && isFinite(v)) ? v : null; }catch(e){ return null; }
}

function igSize(n){ let k = 0; n.traverse(() => { k++; }); return k; }

function igSubX(n, rep){ return n.transform(m => (m.type === 'SymbolNode' && m.name === 'x') ? rep : m); }

function igCompile(n){ const c = n.compile(); return x => safeEval(xx => c.evaluate({x: xx}), x); }

function igS(n){ try{ return niceSimplify(n); }catch(e){ return n; } }

const igP = n => derivPretty(n);

function igPp(n){
  const u = unwrap(n), s = igP(n);
  return ((u.type === 'OperatorNode' && ['add', 'subtract', 'unaryMinus', 'divide'].indexOf(u.fn) !== -1) || (u.type === 'ConstantNode' && u.value < 0)) ? '(' + s + ')' : s;
}

const igI = (n, v) => { const u = unwrap(n), s = igP(n); return '∫ ' + ((u.type === 'OperatorNode' && (u.fn === 'add' || u.fn === 'subtract')) ? '(' + s + ')' : s) + ' d' + (v || 'x'); };

/* köpagzany skobkada (birden köp agza bolsa) */
const igPolyP = c => { const h = polyHtml(c); return c.filter(v => Math.abs(v) > 1e-12).length > 1 ? '(' + h + ')' : h; };

const igNest = (title, items) => title + (items.length ? '<ol class="steps sub">' + items.map(s => '<li>' + s + '</li>').join('') + '</ol>' : '');

/* sany owadan düwün görnüşinde: bitin, p/q, (p ± √k)/q, ýogsam onluk */
function igNum(v){
  if(Math.abs(v) < 1e-12) return igN(0);
  const neg = v < 0, a = Math.abs(v);
  let node = null;
  if(Math.abs(a - Math.round(a)) < 1e-10) node = igN(Math.round(a));
  else { const r = ratApprox(a, 1000, 1e-10); if(r) node = igDiv(igN(r[0]), igN(r[1])); }
  if(!node){
    search: for(let q = 1; q <= 12; q++) for(let k = 2; k <= 60; k++){
      const sk = Math.sqrt(k);
      if(Number.isInteger(sk)) continue;
      for(const sg of [1, -1]){
        const p = a*q - sg*sk;
        if(Math.abs(p - Math.round(p)) < 1e-9){
          const pi = Math.round(p), root = igFn('sqrt', igN(k));
          const num = pi === 0 ? (sg > 0 ? root : igNeg(root)) : (sg > 0 ? igAdd(igN(pi), root) : igSub(igN(pi), root));
          node = q === 1 ? num : igDiv(num, igN(q));
          break search;
        }
      }
    }
  }
  if(!node) node = igN(Number(a.toPrecision(10)));
  return neg ? igNeg(node) : node;
}

const igNumS = v => igP(igNum(v));

const igNumP = v => { const s = igNumS(v); return /[\/−\s]/.test(s) ? '(' + s + ')' : s; };

function igCoef(v, node){
  if(Math.abs(v - 1) < 1e-12) return node;
  if(Math.abs(v + 1) < 1e-12) return igNeg(node);
  return igMul(igNum(v), node);
}

function igSumNodes(list){ return list.filter(Boolean).reduce((acc, n) => acc === null ? n : igAdd(acc, n), null); }

/* (x − r) düwüni */
function igLinNode(r){ return Math.abs(r) < 1e-12 ? igX() : (r > 0 ? igSub(igX(), igNum(r)) : igAdd(igX(), igNum(-r))); }

const igLinS = r => igPp(igLinNode(r));

/* u = kx + b bolsa {k, b} */
function igLin(u){ const c = polyCoeffs(u); return (c && c.length === 2 && Math.abs(c[1]) > 1e-14) ? {k: c[1], b: c[0]} : null; }

/* köpagzanyň integraly: Σ cₖ xᵏ⁺¹/(k + 1) */
function igPolyInt(c){ const ic = [0]; c.forEach((v, k) => ic.push(v/(k + 1))); return polyNode(ic); }

const igPolySub = (A, B) => { const n = Math.max(A.length, B.length), r = []; for(let i = 0; i < n; i++) r.push((A[i] || 0) - (B[i] || 0)); return r; };

const igPolyScale = (A, k) => A.map(v => v*k);

/* F′(x) = f(x)? (birnäçe nokatda san taýdan) */
function igVerify(F, f){
  let dF;
  try{ dF = igCompile(math.derivative(F, 'x')); }catch(e){ return false; }
  const fx = igCompile(f);
  let ok = 0;
  for(const x of [-2.31, -1.13, -0.47, 0.29, 0.83, 1.37, 1.91, 2.63, 3.47, 4.21, 5.37, 6.83]){
    const a = fx(x), b = dF(x);
    if(!isFinite(a) || !isFinite(b)) continue;
    if(Math.abs(a - b) > 1e-6*Math.max(1, Math.abs(a))) return false;
    ok++;
  }
  return ok >= 3;
}

/* √(b − ax²) we (b − ax²)^(3/2): x = √(b/a)·sin t ornuna goýmasy bilen alynýan tablisa formulalary (tegelegiň meýdany we ş.m.) */
function igCircle(w, n){
  const q = polyCoeffs(w);
  if(!(q && q.length === 3 && Math.abs(q[1]) < 1e-14 && q[2] < 0 && q[0] > 0)) return null;
  const a = -q[2], b = q[0], sw = igFn('sqrt', w), as = igFn('asin', igMul(igNum(Math.sqrt(a/b)), igX()));
  if(Math.abs(n - 0.5) < 1e-14)
    return {F: igAdd(igMul(igDiv(igX(), igN(2)), sw), igMul(igNum(b/(2*Math.sqrt(a))), as)),
      rule: '∫ √(b − ax²) dx = (x/2)·√(b − ax²) + (b/(2√a))·arcsin(x·√(a/b)) — tablisa formulasy (x = √(b/a)·sin t ornuna goýmasy bilen alynýar)'};
  if(Math.abs(n - 1.5) < 1e-14)
    return {F: igAdd(igMul(igMul(igDiv(igX(), igN(8)), igSub(igNum(5*b), igMul(igNum(2*a), igPow(igX(), igN(2))))), sw), igMul(igNum(3*b*b/(8*Math.sqrt(a))), as)),
      rule: '∫ (b − ax²)<sup>3/2</sup> dx = (x/8)·(5b − 2ax²)·√(b − ax²) + (3b²/(8√a))·arcsin(x·√(a/b)) — tablisa formulasy (x = √(b/a)·sin t ornuna goýmasy bilen alynýar)'};
  return null;
}

/* ---------- integrallar tablisasy (çyzykly argument bilen) ---------- */
function igTable(node){
  node = unwrap(node);
  if(igIsX(node)) return {F: igDiv(igPow(igX(), igN(2)), igN(2)), rule: 'derejeli funksiýa: ∫ xⁿ dx = xⁿ⁺¹/(n + 1)'};
  const withLin = (u, Fu, rule) => {
    const L = igLin(u);
    if(!L) return null;
    const one = Math.abs(L.k - 1) < 1e-14;
    return {F: one ? Fu : igDiv(Fu, igNum(L.k)), rule: igIsX(u) ? rule : rule + '; çyzykly argument: ∫ f(kx + b) dx = F(kx + b)/k', lin: !igIsX(u)};
  };
  if(node.type === 'OperatorNode' && node.fn === 'pow'){
    const U = node.args[0], W = node.args[1], n = igConst(W);
    if(n !== null && igHasX(U)){
      const ci = igLin(U) ? null : igCircle(U, n);
      if(ci) return ci;
      if(Math.abs(n + 1) < 1e-14) return withLin(U, igLnAbs(U), '∫ dx/x = ln|x|');
      return withLin(U, igDiv(igPow(U, igNum(n + 1)), igNum(n + 1)), 'derejeli funksiýa: ∫ xⁿ dx = xⁿ⁺¹/(n + 1)');
    }
    const a = igConst(U), bu = unwrap(U);
    if(a !== null && a > 0 && Math.abs(a - 1) > 1e-14 && igHasX(W)){
      const isE = bu.type === 'SymbolNode' && bu.name === 'e';
      return withLin(W, isE ? node : igDiv(node, igFn('log', U)), isE ? 'görkezijili funksiýa: ∫ eˣ dx = eˣ' : 'görkezijili funksiýa: ∫ aˣ dx = aˣ/ln a');
    }
    return null;
  }
  if(node.type === 'FunctionNode' && node.args.length === 1){
    const u = node.args[0], name = node.fn.name;
    const T = {
      sin: () => [igNeg(igFn('cos', u)), '∫ sin x dx = −cos x'],
      cos: () => [igFn('sin', u), '∫ cos x dx = sin x'],
      exp: () => [igFn('exp', u), '∫ eˣ dx = eˣ'],
      sinh: () => [igFn('cosh', u), '∫ sinh x dx = cosh x'],
      cosh: () => [igFn('sinh', u), '∫ cosh x dx = sinh x'],
      tan: () => [igNeg(igLnAbs(igFn('cos', u))), '∫ tg x dx = −ln|cos x|'],
      cot: () => [igLnAbs(igFn('sin', u)), '∫ ctg x dx = ln|sin x|'],
      sec: () => [igLnAbs(igAdd(igDiv(igN(1), igFn('cos', u)), igFn('tan', u))), '∫ dx/cos x = ln|1/cos x + tg x|'],
      csc: () => [igLnAbs(igFn('tan', igDiv(u, igN(2)))), '∫ dx/sin x = ln|tg(x/2)|'],
      sqrt: () => [igMul(igDiv(igN(2), igN(3)), igPow(u, igDiv(igN(3), igN(2)))), '∫ √x dx = (2/3)·x<sup>3/2</sup>'],
      cbrt: () => [igMul(igDiv(igN(3), igN(4)), igPow(u, igDiv(igN(4), igN(3)))), '∫ ∛x dx = (3/4)·x<sup>4/3</sup>']
    }[name];
    if(name === 'sqrt' && !igLin(u)){ const ci = igCircle(u, 0.5); if(ci) return ci; }
    return T ? withLin(u, T()[0], T()[1]) : null;
  }
  if(node.type === 'OperatorNode' && node.fn === 'divide'){
    const c = igConst(node.args[0]), Q = unwrap(node.args[1]);
    if(c === null) return null;
    const cm = r => (!r || Math.abs(c - 1) < 1e-14) ? r : {F: igMul(igNum(c), r.F), rule: r.rule, lin: r.lin};
    if(igLin(Q)) return cm(withLin(Q, igLnAbs(Q), '∫ dx/x = ln|x|'));
    if(Q.type === 'OperatorNode' && Q.fn === 'pow'){
      const n = igConst(Q.args[1]), b = unwrap(Q.args[0]);
      if(n !== null && igLin(b)) return cm(igTable(igPow(b, igNum(-n))));
      if(n === 2 && b.type === 'FunctionNode' && b.args.length === 1 && (b.fn.name === 'cos' || b.fn.name === 'sin'))
        return cm(withLin(b.args[0], b.fn.name === 'cos' ? igFn('tan', b.args[0]) : igNeg(igFn('cot', b.args[0])), b.fn.name === 'cos' ? '∫ dx/cos²x = tg x' : '∫ dx/sin²x = −ctg x'));
    }
    if(Q.type === 'FunctionNode' && Q.fn.name === 'sqrt' && Q.args.length === 1){
      const w = Q.args[0];
      if(igLin(w)) return cm(withLin(w, igMul(igN(2), igFn('sqrt', w)), '∫ dx/√x = 2√x'));
      const q = polyCoeffs(w);
      if(q && q.length === 3 && Math.abs(q[1]) < 1e-14){
        const A = q[2], B = q[0];
        if(A < 0 && B > 0){ const a = -A; return cm({F: igDiv(igFn('asin', igMul(igNum(Math.sqrt(a/B)), igX())), igNum(Math.sqrt(a))), rule: '∫ dx/√(b − ax²) = arcsin(x·√(a/b))/√a'}); }
        if(A > 0 && Math.abs(B) > 1e-14) return cm({F: igDiv(igLnAbs(igAdd(igMul(igNum(Math.sqrt(A)), igX()), igFn('sqrt', w))), igNum(Math.sqrt(A))), rule: '∫ dx/√(x² + b) = ln|x + √(x² + b)| (uzyn logarifm)'});
      }
    }
  }
  return null;
}

/* ---------- çyzyklylyk, hemişelik köpeldiji ---------- */
function igFactors(n, out){
  n = unwrap(n);
  if(n.type === 'OperatorNode' && n.fn === 'multiply'){ igFactors(n.args[0], out); igFactors(n.args[1], out); }
  else out.push(n);
  return out;
}

const igProduct = list => list.reduce((acc, f) => acc === null ? f : igMul(acc, f), null);

function igSum(node, depth){
  const terms = flattenSum(node, 1, []), parts = [];
  for(const t of terms){ const s = igSolve(t.node, depth + 1); if(!s || !s.F) return null; parts.push({t, s}); }
  const F = igS(parts.reduce((acc, {t, s}) => acc === null ? (t.sign > 0 ? s.F : igNeg(s.F)) : (t.sign > 0 ? igAdd(acc, s.F) : igSub(acc, s.F)), null));
  const items = parts.map(({t, s}) => s.simple ? igI(t.node) + ' = ' + igP(s.F) + (s.rule ? ' <span class="rule">(' + s.rule + ')</span>' : '') : s.html);
  const title = '<b>Integralyň çyzyklylygy</b>: ∫(u ± v) dx = ∫u dx ± ∫v dx — her agzany aýratyn integrirleýäris:';
  const tail = 'Jemlesek: ' + igI(node) + ' = ' + igP(F) + '.';
  return {F, html: igNest(title, items) + tail, simple: false, method: 'çyzyklylyk', sum: {title, items, tail}};
}

/* hemişelik köpeldijini aýyrmak: {k, rest} */
function igConstSplit(node){
  node = unwrap(node);
  if(node.type === 'OperatorNode' && node.fn === 'unaryMinus'){
    const inner = igConstSplit(node.args[0]);
    if(inner && inner.kv !== null) return {k: igNum(-inner.kv), kv: -inner.kv, rest: inner.rest};
    return {k: igN(-1), kv: -1, rest: node.args[0]};
  }
  if(node.type === 'OperatorNode' && node.fn === 'divide'){
    const c = igConst(node.args[1]);
    if(c !== null && c !== 0) return {k: igDiv(igN(1), node.args[1]), kv: 1/c, rest: node.args[0]};
    const cn = igConst(node.args[0]);
    if(cn !== null && Math.abs(cn - 1) > 1e-14 && cn !== 0) return {k: node.args[0], kv: cn, rest: igDiv(igN(1), node.args[1])};
    const fs = igFactors(node.args[0], []), cs = fs.filter(f => igConst(f) !== null), rs = fs.filter(f => igConst(f) === null);
    if(cs.length && rs.length){ const k = igProduct(cs); return {k, kv: igConst(k), rest: igDiv(igProduct(rs), node.args[1])}; }
    return null;
  }
  if(node.type === 'OperatorNode' && node.fn === 'multiply'){
    const fs = igFactors(node, []), cs = fs.filter(f => igConst(f) !== null), rs = fs.filter(f => igConst(f) === null);
    if(cs.length && rs.length){ const k = igProduct(cs); return {k, kv: igConst(k), rest: igProduct(rs)}; }
  }
  return null;
}

function igConstMul(node, cs, depth){
  const sub = igSolve(cs.rest, depth + 1);
  if(!sub || !sub.F) return null;
  const F = igS(igMul(cs.k, sub.F)), kS = igPp(cs.k);
  const head = '<b>Hemişelik köpeldiji</b> integralyň daşyna çykýar: ' + igI(node) + ' = ' + kS + '·' + igI(cs.rest);
  if(sub.simple) return {F, html: head + ' = ' + kS + '·' + igPp(sub.F) + (igP(F) === kS + '·' + igPp(sub.F) ? '' : ' = ' + igP(F)) + (sub.rule ? ' <span class="rule">(' + sub.rule + ')</span>' : '') + '.', simple: true, rule: sub.rule, method: sub.method};
  const kf = kS + '·' + igPp(sub.F);
  return {F, html: igNest(head + ':', [sub.html]) + '⇒ ' + igI(node) + ' = ' + kf + (kf === igP(F) ? '' : ' = ' + igP(F)) + '.', simple: false, method: sub.method};
}

/* ---------- köpagza, drob-rasional funksiýalar ---------- */
function igPolyExpand(node, depth){
  const c = polyCoeffs(node);
  if(!c) return null;
  const E = polyNode(c), sub = igSolve(E, depth + 1);
  if(!sub || !sub.F) return null;
  const F = sub.F;
  return {F, html: 'Köpagzany açýarys: ' + igP(node) + ' = ' + polyHtml(c) + '.' + (sub.sum ? igNest('', sub.sum.items) + sub.sum.tail : ' ' + sub.html), simple: false, method: 'köpagza'};
}

/* kwadrat maýdalawjy: (m x + n)/(a x² + b x + c) */
function igQuad(num, den){
  const a = den[2], b = den[1], c = den[0], m = num[1] || 0, nn = num[0] || 0, D = b*b - 4*a*c, html = [];
  const Nf = x => m*x + nn, dQ = x => 2*a*x + b, aS = Math.abs(a - 1) < 1e-12 ? '' : igNumS(a) + '·';
  if(D > 1e-10){
    const s = Math.sqrt(D), r1 = (-b - s)/(2*a), r2 = (-b + s)/(2*a), A = Nf(r1)/dQ(r1), B = Nf(r2)/dQ(r2);
    html.push('<b>Ýönekeý droblara dagytmak</b>: maýdalawjynyň iki dürli hakyky köki bar (D = ' + igNumS(D) + ' &gt; 0): x₁ = ' + igNumS(r1) + ', x₂ = ' + igNumS(r2) + ', şonuň üçin ' + polyHtml(den) + ' = ' + aS + igLinS(r1) + '·' + igLinS(r2) + '.');
    html.push(igPolyP(num) + '/' + igPolyP(den) + ' = A/' + igLinS(r1) + ' + B/' + igLinS(r2) + '. Örtmek usuly bilen (A = igP(x₁)/Q′(x₁)): A = ' + igNumS(A) + ', B = ' + igNumS(B) + '.');
    const parts = [[A, r1], [B, r2]].filter(q => Math.abs(q[0]) > 1e-12).sort((p, q) => (q[0] > 0) - (p[0] > 0));
    const F = igSumNodes(parts.map(q => igCoef(q[0], igLnAbs(igLinNode(q[1]))))) || igN(0);
    html.push('∫ A/(x − x₁) dx = A·ln|x − x₁| ⇒ ∫ = ' + igP(igS(F)) + '.');
    return {F, html};
  }
  if(Math.abs(D) <= 1e-10){
    const r = -b/(2*a), A = m/a, B = (m*r + nn)/a;
    html.push('<b>Ýönekeý droblara dagytmak</b>: maýdalawjy doly kwadrat (D = 0): ' + polyHtml(den) + ' = ' + aS + igLinS(r) + '<sup>2</sup>, şonuň üçin drob = A/' + igLinS(r) + ' + B/' + igLinS(r) + '<sup>2</sup>, bu ýerde A = ' + igNumS(A) + ', B = ' + igNumS(B) + '.');
    const F = igSumNodes([Math.abs(A) > 1e-12 ? igCoef(A, igLnAbs(igLinNode(r))) : null, Math.abs(B) > 1e-12 ? igNeg(igDiv(igNum(B), igLinNode(r))) : null]) || igN(0);
    html.push('∫ dx/(x − r)² = −1/(x − r) ⇒ ∫ = ' + igP(igS(F)) + '.');
    return {F, html};
  }
  const p = b/(2*a), q = Math.sqrt(c/a - p*p), k1 = m/(2*a), k2 = nn - m*b/(2*a);
  const shift = igLinNode(-p), atanArg = Math.abs(q - 1) < 1e-12 ? shift : igDiv(shift, igNum(q));
  const sq = igP(igPow(shift, igN(2))) + ' + ' + igP(igPow(igNum(q), igN(2)));
  html.push('Maýdalawjynyň hakyky köki ýok (D = ' + igNumS(D) + ' &lt; 0)' + (Math.abs(p) < 1e-12 ? ': ' + polyHtml(den) + ' = ' + aS + (aS ? '(' + sq + ')' : sq) : ', <b>doly kwadrata getirýäris</b>: ' + polyHtml(den) + ' = ' + aS + '(' + sq + ')') + '.');
  if(Math.abs(m) > 1e-12) html.push('Sanawjyny maýdalawjynyň önümi arkaly ýazýarys: ' + polyHtml(num) + ' = ' + igNumP(k1) + '·(' + polyHtml(polyDeriv(den)) + ')' + (Math.abs(k2) > 1e-12 ? (k2 > 0 ? ' + ' : ' − ') + igNumS(Math.abs(k2)) : '') + '; birinji bölek: ∫ Q′/Q dx = ln|Q|.');
  const lnQ = a > 0 ? igFn('log', polyNode(den)) : igLnAbs(polyNode(den));
  const F = igSumNodes([Math.abs(k1) > 1e-12 ? igCoef(k1, lnQ) : null, Math.abs(k2) > 1e-12 ? igCoef(k2/(a*q), igFn('atan', atanArg)) : null]) || igN(0);
  html.push((Math.abs(k2) > 1e-12 ? '∫ dx/((x + p)² + q²) = (1/q)·arctg((x + p)/q) ⇒ ' : '⇒ ') + '∫ = ' + igP(igS(F)) + '.');
  return {F, html};
}

/* kub maýdalawjy */
function igCubic(num, den){
  const rr = polyRealRoots(den);
  if(!rr) return null;
  const a = den[3], R = rr.roots, html = [], N = x => polyEval(num, x), aS = Math.abs(a - 1) < 1e-12 ? '' : igNumS(a) + '·';
  if(R.length === 3){
    const dQ = polyDeriv(den), co = R.map(r => N(r.x)/polyEval(dQ, r.x));
    html.push('<b>Ýönekeý droblara dagytmak</b>: maýdalawjynyň üç dürli köki bar: ' + R.map((r, i) => 'x' + '₁₂₃'[i] + ' = ' + igNumS(r.x)).join(', ') + '; ' + polyHtml(den) + ' = ' + aS + R.map(r => igLinS(r.x)).join('·') + '.');
    html.push('Drob = ' + R.map((r, i) => 'ABC'[i] + '/' + igLinS(r.x)).join(' + ') + '; örtmek usuly bilen: ' + co.map((v, i) => 'ABC'[i] + ' = ' + igNumS(v)).join(', ') + '.');
    const F = igSumNodes(R.map((r, i) => Math.abs(co[i]) > 1e-12 ? igCoef(co[i], igLnAbs(igLinNode(r.x))) : null)) || igN(0);
    return {F, html};
  }
  if(R.length === 2){
    const d = R.find(r => r.m === 2), s = R.find(r => r.m === 1);
    if(!d || !s) return null;
    const r = d.x, t = s.x, C = N(t)/(a*(t - r)*(t - r)), B = N(r)/(a*(r - t)), dN = polyEval(polyDeriv(num), r), A = (dN*(r - t) - N(r))/(a*(r - t)*(r - t));
    html.push('<b>Ýönekeý droblara dagytmak</b>: maýdalawjy = ' + aS + igLinS(r) + '<sup>2</sup>·' + igLinS(t) + ' (x = ' + igNumS(r) + ' iki gezek gaýtalanýan kök).');
    html.push('Drob = A/' + igLinS(r) + ' + B/' + igLinS(r) + '<sup>2</sup> + C/' + igLinS(t) + ', bu ýerde A = ' + igNumS(A) + ', B = ' + igNumS(B) + ', C = ' + igNumS(C) + '.');
    const F = igSumNodes([Math.abs(A) > 1e-12 ? igCoef(A, igLnAbs(igLinNode(r))) : null, Math.abs(B) > 1e-12 ? igNeg(igDiv(igNum(B), igLinNode(r))) : null, Math.abs(C) > 1e-12 ? igCoef(C, igLnAbs(igLinNode(t))) : null]) || igN(0);
    return {F, html};
  }
  const r = R[0].x;
  if(R[0].m === 3){
    const c0 = N(r), c1 = polyEval(polyDeriv(num), r), c2 = polyEval(polyDeriv(polyDeriv(num)), r)/2;
    html.push('<b>Ýönekeý droblara dagytmak</b>: maýdalawjy = ' + aS + igLinS(r) + '<sup>3</sup>; sanawjyny (x − ' + igNumS(r) + ') derejeleri boýunça ýazýarys.');
    const F = igSumNodes([Math.abs(c2) > 1e-12 ? igCoef(c2/a, igLnAbs(igLinNode(r))) : null, Math.abs(c1) > 1e-12 ? igNeg(igDiv(igNum(c1/a), igLinNode(r))) : null, Math.abs(c0) > 1e-12 ? igNeg(igDiv(igNum(c0/(2*a)), igPow(igLinNode(r), igN(2)))) : null]) || igN(0);
    return {F, html};
  }
  const K = polyDivLinear(den, r).q, A = N(r)/polyEval(K, r), rem = igPolySub(num, igPolyScale(K, A)), lin = polyDivLinear(rem, r).q;
  html.push('<b>Ýönekeý droblara dagytmak</b>: maýdalawjynyň bir hakyky köki bar: x = ' + igNumS(r) + ', galany kwadrat üçagza: ' + polyHtml(den) + ' = ' + igLinS(r) + '·(' + polyHtml(K) + ').');
  html.push('Drob = A/' + igLinS(r) + ' + (Bx + C)/(' + polyHtml(K) + '); A = igP(x₀)/K(x₀) = ' + igNumS(A) + ', Bx + C = ' + polyHtml(lin) + '.');
  const qd = igQuad(lin, K);
  if(!qd) return null;
  qd.html.forEach(h => html.push(h));
  const F = igSumNodes([Math.abs(A) > 1e-12 ? igCoef(A, igLnAbs(igLinNode(r))) : null, qd.F]);
  return {F, html};
}

/* dogry drob num/den */
function igPartial(num, den){
  const n = den.length - 1, a = den[n], dQ = polyDeriv(den);
  const c = num[num.length - 1]/dQ[dQ.length - 1];
  if(n >= 2 && num.length === dQ.length && num.every((v, i) => Math.abs(v - c*dQ[i]) < 1e-9*Math.max(1, Math.abs(v)))){
    const F = igCoef(c, n === 2 && dQ.length === 2 && (den[1]*den[1] - 4*den[0]*den[2] < 0) && a > 0 ? igFn('log', polyNode(den)) : igLnAbs(polyNode(den)));
    const same = Math.abs(c - 1) < 1e-12;
    return {F, html: ['Sanawjy maýdalawjynyň önümine ' + (same ? 'deň' : 'proporsional') + ': ' + (same ? polyHtml(num) + ' = (' + polyHtml(den) + ')′' : polyHtml(num) + ' = ' + igNumP(c) + '·(' + polyHtml(dQ) + ')') + '. <b>Ornuna goýma</b> t = ' + polyHtml(den) + ', dt = ' + polyHtml(dQ) + ' dx ⇒ ' + (same ? '' : igNumS(c) + '·') + '∫ dt/t = ' + (same ? '' : igNumS(c) + '·') + 'ln|t| ⇒ ∫ = ' + igP(igS(F)) + '.']};
  }
  if(n === 1){ const F = igCoef(num[0]/a, igLnAbs(polyNode(den))); return {F, html: ['∫ c/(ax + b) dx = (c/a)·ln|ax + b| ⇒ ∫ = ' + igP(igS(F)) + '.']}; }
  if(n === 2) return igQuad(num, den);
  if(n === 3) return igCubic(num, den);
  return null;
}

function igRationalS(node, depth){
  const R = ratCoeffs(node);
  if(!R || R.den.length < 2) return null;
  let num = R.num.slice();
  const den = R.den.slice(), html = [];
  let Fp = null;
  if(num.length >= den.length){
    const dv = polyDiv(num, den);
    num = dv.r;
    const restZero = num.every(v => Math.abs(v) < 1e-12);
    html.push('<b>Köpagzalary bölmek</b>: sanawjynyň derejesi maýdalawjynykydan kiçi däl, şonuň üçin ilki bölýäris: ' + igP(node) + ' = ' + polyHtml(dv.q) + (restZero ? '' : (num[num.length - 1] < 0 && num.filter(v => Math.abs(v) > 1e-12).length === 1 ? ' − ' + igPolyP(num.map(v => -v)) : ' + ' + igPolyP(num)) + '/' + igPolyP(den)) + '.');
    if(dv.q.some(v => Math.abs(v) > 1e-14)){ Fp = igPolyInt(dv.q); html.push('∫ (' + polyHtml(dv.q) + ') dx = ' + igP(igS(Fp)) + '.'); }
  }
  let Fr = null;
  if(num.some(v => Math.abs(v) > 1e-12)){
    while(num.length > 1 && Math.abs(num[num.length - 1]) < 1e-12) num.pop();
    const pf = igPartial(num, den);
    if(!pf) return null;
    pf.html.forEach(h => html.push(h));
    Fr = pf.F;
  }
  const F = igS(igSumNodes([Fp, Fr]) || igN(0));
  html.push('Netije: ' + igI(node) + ' = ' + igP(F) + '.');
  return {F, html: igNest('Rasional funksiýa (köpagzalaryň gatnaşygy):', html), simple: false, method: Fr ? 'ýönekeý droblar' : 'köpagzalary bölmek', flat: html};
}

/* ---------- trigonometrik toždestwolar ---------- */
function igTrigArg(n){ n = unwrap(n); return (n.type === 'FunctionNode' && n.args.length === 1 && ['sin', 'cos', 'tan'].indexOf(n.fn.name) !== -1 && igLin(n.args[0])) ? n : null; }

function igTrig(node, depth){
  node = unwrap(node);
  if(node.type === 'OperatorNode' && node.fn === 'pow'){
    const t = igTrigArg(node.args[0]), n = igConst(node.args[1]);
    if(t && n === 2){
      const u = t.args[0], u2 = igS(igMul(igN(2), u));
      const map = {
        sin: [igDiv(igSub(igN(1), igFn('cos', u2)), igN(2)), 'sin²u = (1 − cos 2u)/2'],
        cos: [igDiv(igAdd(igN(1), igFn('cos', u2)), igN(2)), 'cos²u = (1 + cos 2u)/2'],
        tan: [igSub(igDiv(igN(1), igPow(igFn('cos', u), igN(2))), igN(1)), 'tg²u = 1/cos²u − 1']
      }[t.fn.name];
      const sub = igSolve(map[0], depth + 1);
      if(!sub || !sub.F) return null;
      return {F: sub.F, html: igNest('<b>Trigonometrik toždestwo</b> (derejäni peseltmek): ' + map[1] + ' ⇒ ' + igI(node) + ' = ' + igI(map[0]) + ':', [sub.html]) + '⇒ ' + igI(node) + ' = ' + igP(sub.F) + '.', simple: false, method: 'trigonometrik toždestwo'};
    }
    if(t && n !== null && Number.isInteger(n) && n >= 3 && n % 2 === 1 && t.fn.name !== 'tan'){
      const u = t.args[0], m = (n - 1)/2, other = t.fn.name === 'sin' ? 'cos' : 'sin';
      const base1 = igSub(igN(1), igPow(igFn(other, u), igN(2)));
      const rw = igMul(igFn(t.fn.name, u), m === 1 ? base1 : igPow(base1, igN(m)));
      const sub = igSubst(rw, depth + 1);
      if(!sub || !sub.F) return null;
      return {F: sub.F, html: igNest('<b>Täk dereje</b>: bir köpeldijini aýyrýarys we ' + t.fn.name + '²u = 1 − ' + other + '²u ulanýarys: ' + igP(node) + ' = ' + igP(rw) + ':', [sub.html]) + '⇒ ' + igI(node) + ' = ' + igP(sub.F) + '.', simple: false, method: 'trigonometrik toždestwo + ornuna goýma'};
    }
  }
  if(node.type === 'OperatorNode' && node.fn === 'multiply'){
    const fs = igFactors(node, []);
    if(fs.length === 2 && fs.every(f => { const t = igTrigArg(f); return t && t.fn.name !== 'tan'; })){
      const [f1, f2] = fs.map(unwrap), A = f1.args[0], B = f2.args[0];
      if(igS(igSub(A, B)).toString() === '0') return null;                           // birmeňzeş argument — ornuna goýma has ýönekeý
      const sum = igS(igAdd(A, B)), dif = igS(igSub(A, B));
      let rw, rule;
      if(f1.fn.name === 'sin' && f2.fn.name === 'cos'){ rw = igDiv(igAdd(igFn('sin', sum), igFn('sin', dif)), igN(2)); rule = 'sin A·cos B = (sin(A + B) + sin(A − B))/2'; }
      else if(f1.fn.name === 'cos' && f2.fn.name === 'sin'){ rw = igDiv(igSub(igFn('sin', sum), igFn('sin', dif)), igN(2)); rule = 'cos A·sin B = (sin(A + B) − sin(A − B))/2'; }
      else if(f1.fn.name === 'cos'){ rw = igDiv(igAdd(igFn('cos', dif), igFn('cos', sum)), igN(2)); rule = 'cos A·cos B = (cos(A − B) + cos(A + B))/2'; }
      else { rw = igDiv(igSub(igFn('cos', dif), igFn('cos', sum)), igN(2)); rule = 'sin A·sin B = (cos(A − B) − cos(A + B))/2'; }
      const sub = igSolve(rw, depth + 1);
      if(!sub || !sub.F) return null;
      return {F: sub.F, html: igNest('<b>Köpeltmek hasylyny jeme öwürmek</b>: ' + rule + ' ⇒ ' + igI(node) + ' = ' + igI(rw) + ':', [sub.html]) + '⇒ ' + igI(node) + ' = ' + igP(sub.F) + '.', simple: false, method: 'trigonometrik toždestwo'};
    }
  }
  return null;
}

/* ---------- ornuna goýma (u-çalşyrma) ---------- */
function igCands(node){
  const out = [], seen = {};
  const push = m => {
    m = unwrap(m);
    if(!igHasX(m) || igIsX(m) || igLin(m)) return;
    const k = m.toString();
    if(seen[k]) return;
    seen[k] = 1; out.push(m);
  };
  const outer = [];
  node.traverse(m => {
    if(m.type === 'FunctionNode'){ outer.push(m); m.args.forEach(push); }
    if(m.type === 'OperatorNode' && m.fn === 'pow'){ push(m.args[0]); push(m.args[1]); if(!igHasX(m.args[0])) outer.push(m); }
    if(m.type === 'OperatorNode' && m.fn === 'divide') push(m.args[1]);
  });
  const inner = out.splice(0).sort((p, q) => igSize(q) - igSize(p));
  inner.forEach(m => out.push(m));
  outer.sort((p, q) => igSize(q) - igSize(p)).forEach(push);          // içki aňlatmalar öňürti, soň bütin funksiýalar
  return out.slice(0, 12);
}

function igSameFn(m, uf){
  const mf = igCompile(m);
  let ok = 0;
  for(const x of [0.31, 0.77, 1.43, 2.19]){
    const a = uf(x), b = mf(x);
    if(!isFinite(a) || !isFinite(b)) continue;
    if(Math.abs(a - b) > 1e-9*Math.max(1, Math.abs(a))) return false;
    ok++;
  }
  return ok >= 2;
}

function igSubst(node, depth){
  if(depth > 5 || IG_NEST >= 2) return null;
  for(const u of igCands(node)){
    let du;
    try{ du = derivNice(u); }catch(e){ continue; }
    if(igConst(du) === 0) continue;
    let r;
    try{ r = igS(igDiv(node, du)); }catch(e){ continue; }
    const uf = igCompile(u), uSize = igSize(u);
    let G = r.transform(function rep(m){ return (igHasX(m) && igSize(m) >= Math.min(uSize, 2) && igSameFn(m, uf)) ? new math.SymbolNode('t') : m; });
    if(igHasX(G)){
      /* u = a·x² + b bolsa galan x² agzalaryny (t − b)/a bilen çalyşmak: ∫ x³·√(x² + 1) dx */
      const uc = polyCoeffs(u);
      if(!(uc && uc.length === 3 && Math.abs(uc[1]) < 1e-14)) continue;
      const xr = igFn('sqrt', igDiv(igSub(new math.SymbolNode('t'), igNum(uc[0])), igNum(uc[2])));
      const G2 = igS(G.transform(m => (m.type === 'SymbolNode' && m.name === 'x') ? xr : m));
      if(igHasX(G2)) continue;
      let hasSqrtT = false;
      G2.traverse(m => { if(m.type === 'FunctionNode' && m.fn.name === 'sqrt' && igSize(m.args[0]) > 1 && unwrap(m.args[0]).type === 'OperatorNode') hasSqrtT = true; });
      if(hasSqrtT) continue;
      G = G2;
    }
    let tCount = 0;
    G.traverse(m => { if(m.type === 'SymbolNode' && m.name === 't') tCount++; });
    if(!tCount && igConst(G) === null) continue;
    const Gx = G.transform(m => (m.type === 'SymbolNode' && m.name === 't') ? igX() : m);
    IG_NEST++;
    let sub;
    try{ sub = igSolve(Gx, depth + 1); }finally{ IG_NEST--; }
    if(!sub || !sub.F) continue;
    const F = igS(igSubX(sub.F, u));
    if(!igVerify(F, node)) continue;
    const toT = h => h.replace(/x/g, 't');
    const FT = toT(igP(sub.F));
    const head = '<b>Ornuna goýma</b> (u-çalşyrma): integralyň içinde içki funksiýa ' + igPp(u) + ' we onuň önümi (' + igP(du) + ') bar. t = ' + igP(u) + ', dt = ' + igPp(du) + ' dx alýarys ⇒ ' + igI(node) + ' = ' + igI(G, 't');
    const html = sub.simple
      ? head + ' = ' + FT + '. Yzyna t = ' + igP(u) + ' goýýarys: ' + igI(node) + ' = ' + igP(F) + '.'
      : igNest(head + ':', [toT(sub.html)]) + 'Yzyna t = ' + igP(u) + ' goýýarys: ' + igI(node) + ' = ' + igP(F) + '.';
    return {F, html, simple: false, method: 'ornuna goýma'};
  }
  return null;
}

/* x-iň derejeleriniň köpeltmek hasyly: x·√x → x^(3/2), √x/x → x^(−1/2); {c, n} ýa-da null */
function igPowParts(node){
  node = unwrap(node);
  const cv = igConst(node);
  if(cv !== null) return {c: cv, n: 0, k: 0};
  if(igIsX(node)) return {c: 1, n: 1, k: 1};
  if(node.type === 'FunctionNode' && node.args.length === 1 && igIsX(node.args[0])){
    if(node.fn.name === 'sqrt') return {c: 1, n: 0.5, k: 1};
    if(node.fn.name === 'cbrt') return {c: 1, n: 1/3, k: 1};
    return null;
  }
  if(node.type === 'OperatorNode'){
    if(node.fn === 'pow'){ const e = igConst(node.args[1]); if(e === null) return null; const b = igPowParts(node.args[0]); return (b && b.c === 1) ? {c: 1, n: b.n*e, k: b.k} : null; }
    if(node.fn === 'multiply' || node.fn === 'divide'){
      const a = igPowParts(node.args[0]), b = igPowParts(node.args[1]);
      if(!a || !b) return null;
      return node.fn === 'multiply' ? {c: a.c*b.c, n: a.n + b.n, k: a.k + b.k} : (b.c === 0 ? null : {c: a.c/b.c, n: a.n - b.n, k: a.k + b.k});
    }
    if(node.fn === 'unaryMinus'){ const a = igPowParts(node.args[0]); return a && {c: -a.c, n: a.n, k: a.k}; }
  }
  return null;
}

function igPowCombine(node, depth){
  const pp = igPowParts(node);
  if(!pp || pp.k < 2) return null;
  const n = Math.round(pp.n*6)/6, xn = Math.abs(n - 1) < 1e-12 ? igX() : igPow(igX(), igNum(n));
  const rw = Math.abs(pp.c - 1) < 1e-12 ? xn : igMul(igNum(pp.c), xn);
  const sub = igSolve(rw, depth + 1);
  if(!sub || !sub.F) return null;
  return {F: sub.F, html: 'Derejeleri birleşdirýäris (xᵃ·xᵇ = xᵃ⁺ᵇ): ' + igP(node) + ' = ' + igP(rw) + '. ' + sub.html, simple: false, method: 'tablisa'};
}

/* çyzykly içki aňlatma: t = kx + b, x = (t − b)/k — mysal: ∫ x·√(x + 1) dx */
function igLinSubst(node, depth){
  if(depth > 5 || IG_NEST >= 2) return null;
  const cands = [], seen = {};
  node.traverse(m => {
    let u = null;
    if(m.type === 'FunctionNode' && (m.fn.name === 'sqrt' || m.fn.name === 'cbrt') && m.args.length === 1) u = m.args[0];
    if(m.type === 'OperatorNode' && m.fn === 'pow'){ const e = igConst(m.args[1]); if(e !== null && (!Number.isInteger(e) || Math.abs(e) >= 3)) u = m.args[0]; }
    if(u){ u = unwrap(u); const L = igLin(u); if(L && !igIsX(u) && !seen[u.toString()]){ seen[u.toString()] = 1; cands.push({u, L}); } }
  });
  for(const {u, L} of cands){
    const xt = igS(igDiv(igSub(new math.SymbolNode('t'), igNum(L.b)), igNum(L.k)));
    const G = igS(igDiv(igSubX(node, xt), igNum(L.k)));
    if(igHasX(G)) continue;
    const Gx = G.transform(m => (m.type === 'SymbolNode' && m.name === 't') ? igX() : m);
    IG_NEST++;
    let sub;
    try{ sub = igSolve(Gx, depth + 1); }finally{ IG_NEST--; }
    if(!sub || !sub.F) continue;
    const F = igS(igSubX(sub.F, u));
    if(!igVerify(F, node)) continue;
    const toT = h => h.replace(/x/g, 't');
    const head = '<b>Ornuna goýma</b> (çyzykly): t = ' + igP(u) + ' alýarys, onda x = ' + toT(igP(igSubX(xt, igX()))).replace(/t/g, 't') + ', dx = ' + (Math.abs(L.k - 1) < 1e-12 ? 'dt' : 'dt/' + igNumS(L.k)) + ' ⇒ ' + igI(node) + ' = ' + igI(G, 't');
    const html = sub.simple ? head + ' = ' + toT(igP(sub.F)) + '. Yzyna t = ' + igP(u) + ' goýýarys: ' + igI(node) + ' = ' + igP(F) + '.'
      : igNest(head + ':', [toT(sub.html)]) + 'Yzyna t = ' + igP(u) + ' goýýarys: ' + igI(node) + ' = ' + igP(F) + '.';
    return {F, html, simple: false, method: 'ornuna goýma'};
  }
  return null;
}

/* ---------- bölekleýin integrirlemek ---------- */
function igIsExpTrig(f){
  f = unwrap(f);
  if(f.type === 'FunctionNode' && f.args.length === 1 && ['exp', 'sin', 'cos', 'sinh', 'cosh'].indexOf(f.fn.name) !== -1) return !!igLin(f.args[0]);
  if(f.type === 'OperatorNode' && f.fn === 'pow' && igConst(f.args[0]) !== null && igHasX(f.args[1])) return !!igLin(f.args[1]);
  return false;
}

function igIsLogInv(f){
  f = unwrap(f);
  if(f.type !== 'FunctionNode' || f.args.length !== 1) return false;
  if(f.fn.name === 'log') return !!polyCoeffs(f.args[0]);
  return ['atan', 'asin', 'acos', 'acot'].indexOf(f.fn.name) !== -1 && !!igLin(f.args[0]);
}

const igExpKind = f => { f = unwrap(f); return (f.type === 'FunctionNode' && (f.fn.name === 'sin' || f.fn.name === 'cos')) ? 'trig' : (f.type === 'FunctionNode' && f.fn.name === 'exp') || f.type === 'OperatorNode' ? 'exp' : 'other'; };

function igPartsFactors(node){
  node = unwrap(node);
  if(node.type === 'OperatorNode' && node.fn === 'divide'){
    const q = unwrap(node.args[1]);
    if(q.type === 'OperatorNode' && q.fn === 'pow' && igConst(q.args[0]) !== null) return igFactors(node.args[0], []).concat([igPow(q.args[0], igS(igNeg(q.args[1])))]);
    if(q.type === 'FunctionNode' && q.fn.name === 'exp') return igFactors(node.args[0], []).concat([igFn('exp', igS(igNeg(q.args[0])))]);
    return null;
  }
  return igFactors(node, []);
}

function igParts(node, depth){
  if(depth > 6) return null;
  const fs = igPartsFactors(node);
  if(!fs) return null;
  const polyF = [], expT = [], logI = [], other = [];
  fs.forEach(f => { if(polyCoeffs(f)) polyF.push(f); else if(igIsExpTrig(f)) expT.push(f); else if(igIsLogInv(f)) logI.push(f); else other.push(f); });
  if(other.length) return null;
  if(!polyF.length && !logI.length && expT.length === 2){
    const e = expT.find(f => igExpKind(f) === 'exp'), t = expT.find(f => igExpKind(f) === 'trig');
    if(!e || !t) return null;
    const ue = unwrap(e), w = ue.type === 'FunctionNode' ? ue.args[0] : ue.args[1], base = ue.type === 'FunctionNode' ? Math.E : igConst(ue.args[0]);
    const Le = igLin(w), Lt = igLin(unwrap(t).args[0]), a = Le.k*Math.log(base), b = Lt.k, ut = unwrap(t).args[0];
    const S = igFn('sin', ut), Cn = igFn('cos', ut), den = a*a + b*b;
    const inner = unwrap(t).fn.name === 'sin' ? igSub(igMul(igNum(a), S), igMul(igNum(b), Cn)) : igAdd(igMul(igNum(a), Cn), igMul(igNum(b), S));
    const F = igS(igDiv(igMul(e, inner), igNum(den)));
    if(!igVerify(F, node)) return null;
    return {F, html: '<b>Bölekleýin integrirlemek</b> (aýlanýan halat): u = ' + igP(t) + ', dv = ' + igP(e) + ' dx alyp, usuly iki gezek ulanýarys — integral öz-özüne gaýdyp gelýär: I = … − (b²/a²)·I. Şondan I tapylýar: ∫ e<sup>ax</sup>·sin bx dx = e<sup>ax</sup>(a·sin bx − b·cos bx)/(a² + b²), ∫ e<sup>ax</sup>·cos bx dx = e<sup>ax</sup>(a·cos bx + b·sin bx)/(a² + b²); bu ýerde a = ' + igNumS(a) + ', b = ' + igNumS(b) + ' ⇒ ' + igI(node) + ' = ' + igP(F) + '.', simple: false, method: 'bölekleýin integrirlemek (aýlanýan)'};
  }
  if(!logI.length && expT.length === 1 && polyF.length){
    const Pn = igProduct(polyF), T = expT[0], tv = igTable(T);
    if(!tv) return null;
    const v = igS(tv.F), dP = derivNice(Pn), restRaw = igS(igMul(v, dP)), ur = unwrap(restRaw);
    const neg = ur.type === 'OperatorNode' && ur.fn === 'unaryMinus', rest = neg ? ur.args[0] : restRaw, op = neg ? ' + ' : ' − ';
    const sub = igSolve(rest, depth + 1);
    if(!sub || !sub.F) return null;
    const F = igS(neg ? igAdd(igMul(Pn, v), sub.F) : igSub(igMul(Pn, v), sub.F));
    const head = '<b>Bölekleýin integrirlemek</b>: ∫ u dv = u·v − ∫ v du. Köpagza önümlenende derejesi kiçelýär, şonuň üçin u = ' + igP(Pn) + ', dv = ' + igP(T) + ' dx alýarys: du = ' + (igConst(dP) === 1 ? '' : igPp(dP) + ' ') + 'dx, v = ' + igP(v) + '.';
    const uv = igP(igS(igMul(Pn, v)));
    const mid = '⇒ ' + igI(node) + ' = ' + uv + op + igI(rest);
    const html = sub.simple ? head + ' ' + mid + ' = ' + uv + op + igPp(sub.F) + ' = ' + igP(F) + '.' : igNest(head + ' ' + mid + ':', [sub.html]) + '⇒ ' + igI(node) + ' = ' + uv + op + igPp(sub.F) + ' = ' + igP(F) + '.';
    return {F, html, simple: false, method: 'bölekleýin integrirlemek'};
  }
  if(!expT.length && logI.length === 1){
    const L = logI[0], Pn = polyF.length ? igProduct(polyF) : igN(1), pc = polyCoeffs(Pn);
    if(!pc) return null;
    const v = igS(igPolyInt(pc)), dL = derivNice(L), restRaw = igS(igMul(v, dL)), ur = unwrap(restRaw);
    const neg = ur.type === 'OperatorNode' && ur.fn === 'unaryMinus', rest = neg ? ur.args[0] : restRaw, op = neg ? ' + ' : ' − ';
    const sub = igSolve(rest, depth + 1);
    if(!sub || !sub.F) return null;
    const F = igS(neg ? igAdd(igMul(L, v), sub.F) : igSub(igMul(L, v), sub.F));
    const head = '<b>Bölekleýin integrirlemek</b>: ∫ u dv = u·v − ∫ v du. ' + igP(L) + ' önümlenende ýönekeýleşýär, şonuň üçin u = ' + igP(L) + ', dv = ' + (polyF.length ? igP(Pn) + ' dx' : 'dx') + ' alýarys: du = ' + (igConst(dL) === 1 ? '' : igPp(dL) + ' ') + 'dx, v = ' + igP(v) + '.';
    const uv = igPp(v) + '·' + igPp(L);
    const mid = '⇒ ' + igI(node) + ' = ' + uv + op + igI(rest);
    const html = sub.simple ? head + ' ' + mid + ' = ' + uv + op + igPp(sub.F) + ' = ' + igP(F) + '.' : igNest(head + ' ' + mid + ':', [sub.html]) + '⇒ ' + igI(node) + ' = ' + uv + op + igPp(sub.F) + ' = ' + igP(F) + '.';
    return {F, html, simple: false, method: 'bölekleýin integrirlemek'};
  }
  return null;
}

/* ---------- ýaýlary açmak, droby agzalara bölmek ---------- */
function igExpand(node, depth){
  node = unwrap(node);
  const isSum = n => { n = unwrap(n); return n.type === 'OperatorNode' && (n.fn === 'add' || n.fn === 'subtract'); };
  let rw = null, why = '';
  if(node.type === 'OperatorNode' && node.fn === 'multiply'){
    const fs = igFactors(node, []), i = fs.findIndex(isSum);
    if(i !== -1){
      const others = igProduct(fs.filter((f, j) => j !== i)), terms = flattenSum(unwrap(fs[i]), 1, []);
      rw = terms.reduce((acc, t) => { const p = igMul(others, t.node); return acc === null ? (t.sign > 0 ? p : igNeg(p)) : (t.sign > 0 ? igAdd(acc, p) : igSub(acc, p)); }, null);
      why = 'Ýaýy açýarys';
    }
  } else if(node.type === 'OperatorNode' && node.fn === 'divide' && isSum(node.args[0]) && igConst(node.args[1]) === null){
    const terms = flattenSum(unwrap(node.args[0]), 1, []), q = node.args[1];
    rw = terms.reduce((acc, t) => { const p = igS(igDiv(t.node, q)); return acc === null ? (t.sign > 0 ? p : igNeg(p)) : (t.sign > 0 ? igAdd(acc, p) : igSub(acc, p)); }, null);
    why = 'Droby agzalara bölýäris';
  } else if(node.type === 'OperatorNode' && node.fn === 'pow' && igConst(node.args[1]) === 2 && isSum(node.args[0])){
    const t = flattenSum(unwrap(node.args[0]), 1, []);
    if(t.length === 2){
      const a = t[0].sign > 0 ? t[0].node : igNeg(t[0].node), b = t[1].sign > 0 ? t[1].node : igNeg(t[1].node);
      rw = igAdd(igAdd(igPow(a, igN(2)), igMul(igMul(igN(2), a), b)), igPow(b, igN(2)));
      why = 'Kwadraty açýarys: (a + b)² = a² + 2ab + b²';
    }
  }
  if(!rw) return null;
  const sub = igSolve(rw, depth + 1);
  if(!sub || !sub.F) return null;
  const items = sub.sum ? sub.sum.items : [sub.html];
  return {F: sub.F, html: igNest(why + ': ' + igP(node) + ' = ' + igP(rw) + '.', items) + (sub.sum ? sub.sum.tail : ''), simple: false, method: sub.method || 'çyzyklylyk'};
}

function igNorm(n){
  n = unwrap(n);
  if(n.type === 'OperatorNode' && n.fn === 'unaryPlus') return igNorm(n.args[0]);
  return n;
}

/* {F, html, simple, rule?, method} ýa-da null (ýatda saklanýar: şol bir aňlatma gaýtadan çözülmeýär) */
function igSolve(node, depth){
  node = igNorm(node);
  if(depth > 8 || --IG_BUDGET < 0) return null;
  const key = node.toString(), hit = IG_CACHE.get(key);
  if(hit && (hit.r || hit.depth <= depth)) return hit.r;
  const r = igSolveRaw(node, depth);
  IG_CACHE.set(key, {r, depth});
  return r;
}

function igSolveRaw(node, depth){
  if(!igHasX(node)){
    const F = igS(igMul(node, igX()));
    return {F, html: igI(node) + ' = ' + igP(F) + ' — hemişeligiň integraly: ∫ c dx = c·x.', simple: true, rule: 'hemişelik', method: 'tablisa'};
  }
  if(node.type === 'OperatorNode' && (node.fn === 'add' || node.fn === 'subtract')) return igSum(node, depth);
  const t0 = igTable(node);
  if(!t0 && node.type === 'OperatorNode' && node.fn === 'divide' && igHasX(node.args[0]) && !polyCoeffs(node)){
    const rr = igRationalS(node, depth);                                   // 2x/(x² + 1): sanawjy maýdalawjynyň önümi — göni görünýär
    if(rr) return rr;
  }
  const cs = t0 ? null : igConstSplit(node);
  if(cs) return igConstMul(node, cs, depth);
  const t = t0;
  if(t){ const F = igS(t.F); return {F, html: igI(node) + ' = ' + igP(F) + ' — ' + t.rule + '.', simple: true, rule: t.lin ? 'çyzykly argument' : 'tablisa', method: t.lin ? 'tablisa (çyzykly argument)' : 'tablisa'}; }
  return igPowCombine(node, depth) || (igSmallPoly(node) ? igPolyExpand(node, depth) : null) || igRationalS(node, depth) || igTrig(node, depth)
    || igSubst(node, depth) || igLinSubst(node, depth) || igParts(node, depth) || igExpand(node, depth) || igPolyExpand(node, depth);
}

/* köpagzany açmak ýeňilmi (jemiň uly derejesi ýok): (x + 1)¹⁰·x ýaly halatda ilki ornuna goýma synanyşylýar */
function igSmallPoly(node){
  let big = false;
  node.traverse(m => {
    if(m.type === 'OperatorNode' && m.fn === 'pow'){
      const b = unwrap(m.args[0]), e = igConst(m.args[1]);
      if(e !== null && e >= 4 && b.type === 'OperatorNode' && (b.fn === 'add' || b.fn === 'subtract')) big = true;
    }
  });
  return !big;
}

/* ln|eᵘ| → u, ln(eᵘ) → u */
function igLogExp(F){
  return F.transform(function le(m){
    if(m.type === 'FunctionNode' && m.fn.name === 'log' && m.args.length === 1){
      let a = unwrap(m.args[0]);
      if(a.type === 'FunctionNode' && a.fn.name === 'abs') a = unwrap(a.args[0]);
      if(a.type === 'FunctionNode' && a.fn.name === 'exp') return igLogExp(a.args[0]);
      if(a.type === 'OperatorNode' && a.fn === 'pow' && unwrap(a.args[0]).type === 'SymbolNode' && unwrap(a.args[0]).name === 'e') return igLogExp(a.args[1]);
    }
    return m;
  });
}

/* Esasy: f(x) üçin {F, steps, method}; F tapylmasa F = null. F mydama önüm bilen barlanýar. */
function integrateSteps(node){
  let r = null;
  IG_BUDGET = 400; IG_NEST = 0; IG_CACHE.clear();
  try{ r = igSolve(node, 0); }catch(e){ r = null; }
  IG_CACHE.clear();
  if(!r || !r.F) return {F: null, steps: [], method: null};
  const F = igS(igLogExp(r.F));
  if(!igVerify(F, node)) return {F: null, steps: [], method: null};
  let steps;
  if(r.sum) steps = [r.sum.title.replace(/:$/, '.')].concat(r.sum.items, [r.sum.tail]);
  else if(r.flat) steps = r.flat.slice();
  else steps = [r.html];
  let dS = '';
  try{ dS = igP(derivNice(F)); }catch(e){ dS = ''; }
  steps.push('<b>Barlag</b>: F′(x) = ' + (dS && dS.length < 160 ? dS + (dS === igP(node) ? '' : ' = f(x)') : 'f(x)') + ' ✓ (önüm integral astyndaky funksiýa deň; birnäçe nokatda san taýdan hem barlandy).');
  return {F, steps, method: r.method || 'tablisa'};
}

/* belli elementar däl integrallar (antiwönümi elementar funksiýa bilen aňladylmaýar): e^(−x²), sin(x²), sin(x)/x, eˣ/x, 1/ln x, √(1 + x³) */
function integralNonElementary(node){
  const cs = igConstSplit(node), n = unwrap(cs ? cs.rest : node);
  const deg2 = u => { const c = polyCoeffs(u); return !!(c && c.length >= 3); };
  if(n.type === 'FunctionNode' && n.args.length === 1){
    const a = n.args[0], name = n.fn.name;
    if(['exp', 'sin', 'cos', 'sinh', 'cosh'].indexOf(name) !== -1 && deg2(a)) return true;
    if(name === 'sqrt'){ const c = polyCoeffs(a); if(c && c.length >= 4) return true; }
  }
  if(n.type === 'OperatorNode' && n.fn === 'pow'){
    const b = unwrap(n.args[0]);
    if(b.type === 'SymbolNode' && b.name === 'e' && deg2(n.args[1])) return true;
  }
  if(n.type === 'OperatorNode' && n.fn === 'divide'){
    const p = unwrap(n.args[0]), q = unwrap(n.args[1]);
    if(igIsX(q) && ((p.type === 'FunctionNode' && ['sin', 'cos', 'exp'].indexOf(p.fn.name) !== -1 && igIsX(p.args[0])) || (p.type === 'OperatorNode' && p.fn === 'pow' && igConst(p.args[0]) !== null && igIsX(p.args[1])))) return true;
    if(igConst(p) !== null && q.type === 'FunctionNode' && q.fn.name === 'log' && igIsX(q.args[0])) return true;
    if(igConst(p) !== null && q.type === 'FunctionNode' && q.fn.name === 'sqrt'){ const c = polyCoeffs(q.args[0]); if(c && c.length >= 4) return true; }
  }
  return false;
}

/* F(x)-i görkezmek */
function integralPretty(F){ return igP(F); }

/* ===== modules/solvers/limit-steps.js ===== */
/* Limit: mugallym ýaly ädimme-ädim çözgüt.
   Ilki göni goýmak (funksiýa üznüksiz bolsa); bolmasa kesgitsizligiň görnüşini anyklamak (0/0, c/0, ∞/∞, 0·∞, ∞ − ∞, 1^∞, 0⁰, ∞⁰)
   we oňa laýyk usuly saýlamak: köpeldijilere dagytmak (Gorneriň shemasy), goşma (konýugat) aňlatma bilen köpeltmek, modul,
   umumy maýdalawja getirmek, baş derejä bölmek, gysyş teoremasy, logarifmlemek, Lopitalyň düzgüni, jemiň / köpeltmek
   hasylynyň / derejäniň / üznüksiz funksiýanyň limit düzgünleri. Jogap soňra san barlagy bilen deňeşdirilýär (limit.js).
   Netije: san | ±Infinity | {side: ±1, v} (diňe bir tarapda kesgitlenen) | {none: true, left, right} | {none: true, osc: true} | null */

const LS_T = [1e-2, 1e-3, 1e-4, 1e-5, 1e-6, 1e-7];

const LS_X = [1e2, 1e3, 1e4, 1e5, 1e6, 1e7];

const LS_FN_NAME = {tan: 'tg', cot: 'ctg', asin: 'arcsin', acos: 'arccos', atan: 'arctg', acot: 'arcctg', log10: 'lg'};

function lsFn(node){ const c = node.compile(); return x => safeEval(xx => c.evaluate({x: xx}), x); }

const lsInf = v => v === Infinity || v === -Infinity;

const lsInfS = v => v > 0 ? '+∞' : '−∞';

function lsZ(v, s){ return isFinite(v) && Math.abs(v) <= 1e-10*Math.max(1, s || 0); }

function lsHasX(n){ let f = false; n.traverse(c => { if(c.type === 'SymbolNode' && c.name === 'x') f = true; }); return f; }

function lsHasFn(n, names){ let f = false; n.traverse(c => { if(c.type === 'FunctionNode' && names.indexOf(c.fn.name) !== -1) f = true; }); return f; }

const lsDiv = (p, q) => new math.OperatorNode('/', 'divide', [p, q]);

const lsMul = (p, q) => new math.OperatorNode('*', 'multiply', [p, q]);

const lsNeg = p => new math.OperatorNode('-', 'unaryMinus', [p]);

const lsOne = () => new math.ConstantNode(1);

const lsWhere = C => C.s ? lsInfS(C.s) : C.label;

const lsP = n => prettyNode(n);

function lsPp(n){
  const u = unwrap(n), s = lsP(n);
  return (u.type === 'OperatorNode' && ['add', 'subtract', 'unaryMinus'].indexOf(u.fn) !== -1) ? '(' + s + ')' : s;
}

/* qysga ýazgy (aralyk ädimler üçin): 3, −1/2, π/2, e */
function lsVal(v){
  if(v === Infinity) return '+∞';
  if(v === -Infinity) return '−∞';
  const n = niceConst(v, 1e-9*Math.max(1, Math.abs(v)));
  const s = n.exact ? n.label.split(' ≈ ')[0] : fmt(v);
  return s.charAt(0) === '-' ? '−' + s.slice(1) : s;
}

function lsValP(v){ const s = lsVal(v); return (s.charAt(0) === '−' || s.indexOf(' ') !== -1) ? '(' + s + ')' : s; }

/* jogap ýazgysy: 2, 1/4 = 0.25, 1/3 ≈ 0.333333, e ≈ 2.71828 */
function lsFull(v){
  const s = lsVal(v);
  if(!isFinite(v) || /^−?\d+$/.test(s)) return s;
  const n = niceConst(v, 1e-9*Math.max(1, Math.abs(v)));
  if(!n.exact){
    /* eᵏ (k — bitin ýa-da ýönekeý drob): e⁶ ≈ 403.429 */
    if(v > 0){
      const L = Math.log(v);
      for(const q of [1, 2, 3]){ const p = Math.round(L*q); if(p !== 0 && Math.abs(L*q - p) < 1e-9*Math.max(1, Math.abs(L*q)) && Math.abs(p/q) <= 12) return 'e<sup>' + (q === 1 ? String(p).replace('-', '−') : String(p).replace('-', '−') + '/' + q) + '</sup> ≈ ' + fmt(v); }
    }
    return s;
  }
  const d = fmt(n.v), dd = d.charAt(0) === '-' ? '−' + d.slice(1) : d;
  return s + (Math.abs(Number(d) - n.v) <= 1e-15*Math.max(1, Math.abs(n.v)) ? ' = ' : ' ≈ ') + dd;
}

/* geometrik ädimli nokatlardaky bahalardan yzygiderligiň limiti: san (Aitken bilen takyklanan), ±Infinity ýa-da null.
   Iň kiçi tapawutly ýerde saklanýar — kiçi ädimlerde ýüze çykýan tegelekleme ýalňyşlygy netijä täsir etmez ýaly. */
function lsSeq(v){
  const n = v.length;
  if(v.some(z => isNaN(z))) return null;
  const fi = v.findIndex(z => !isFinite(z));
  if(fi !== -1) return v.slice(fi).every(z => z === v[n - 1]) ? v[n - 1] : null;
  const d = [];
  for(let i = 1; i < n; i++) d.push(v[i] - v[i - 1]);
  const m = d.length, A = v.map(Math.abs);
  if(d[m - 1]*d[m - 2] > 0 && d[m - 2]*d[m - 3] > 0 && A[n - 1] > A[n - 2] && A[n - 2] > A[n - 3] && Math.abs(d[m - 1]) >= 0.5*Math.abs(d[m - 2]) && A[n - 1] >= 10)
    return v[n - 1] > 0 ? Infinity : -Infinity;
  let kb = 0;
  for(let i = 1; i < m; i++) if(Math.abs(d[i]) < Math.abs(d[kb])) kb = i;
  const sc = Math.max(1, Math.abs(v[kb + 1])), db = Math.abs(d[kb]);
  const snap = L => Math.abs(L) <= Math.max(1e-10, db) ? 0 : L;
  if(db <= 1e-12*sc) return snap(v[kb + 1]);
  if(kb >= 1 && db <= 1e-3*sc){
    let geo = true;
    for(let i = 1; i <= kb; i++) if(!(Math.abs(d[i]) <= 0.6*Math.abs(d[i - 1]))) geo = false;
    if(geo){
      const den = d[kb] - d[kb - 1];
      let L = v[kb + 1] - (den !== 0 ? d[kb]*d[kb]/den : 0);
      if(!isFinite(L) || Math.abs(L - v[kb + 1]) > 10*db) L = v[kb + 1];
      return snap(L);
    }
  }
  return null;
}

function lsSide(fn, a, s){ const sc = Math.max(1, Math.abs(a)); return lsSeq(LS_T.map(t => fn(a + s*t*sc))); }

function lsTrend(fn, s){ return lsSeq(LS_X.map(t => fn(s*t))); }

/* a nokadyň töweregindäki umumy baha: taraplar gabat gelse — baha; ikisi hem çäksiz (alamatlary dürli bolsa-da) — Infinity;
   bir tarap kesgitlenmedik — beýleki tarap; ýogsam NaN */
function lsNear(fn, a){
  const l = lsSide(fn, a, -1), r = lsSide(fn, a, 1);
  if(l === null) return r === null ? NaN : r;
  if(r === null) return l;
  if(l === r) return l;
  if(lsInf(l) && lsInf(r)) return Infinity;
  if(isFinite(l) && isFinite(r) && Math.abs(l - r) <= 1e-6*Math.max(1, Math.abs(l))) return (l + r)/2;
  return NaN;
}

function lsAt(fn, a){ const v = fn(a); return isFinite(v) ? v : lsNear(fn, a); }

function lsNearC(fn, C){ if(C.s){ const t = lsTrend(fn, C.s); return t === null ? NaN : t; } return lsAt(fn, C.a); }

/* bir tarapda kesgitlenenmi (golaý nokatlaryň hemmesi NaN bolsa — ýok) */
function lsSideDef(fn, a, s){ const sc = Math.max(1, Math.abs(a)); return [1e-3, 1e-5, 1e-7].some(t => !isNaN(fn(a + s*t*sc))); }

/* bir tarapdan üznüksizlik: true | false | 'nan' (şol tarapda kesgitlenmedik) */
function lsSideCont(f, a, v, s){
  const sc = Math.max(1, Math.abs(a)), V = Math.max(1, Math.abs(v));
  const dv = [1e-4, 1e-7, 1e-10].map(t => Math.abs(f(a + s*t*sc) - v));
  if(dv.some(z => isNaN(z))) return 'nan';
  if(!dv.every(isFinite)) return false;
  return dv[2] <= 1e-6*V || (dv[2] <= 1e-3*V && dv[2] < 0.5*dv[1] && dv[1] < 0.5*dv[0]);
}

/* 0⁰, 1^∞, ∞⁰ görnüşli dereje bar bolsa göni goýmak bolmaýar (JS 0^0 = 1 berýär) */
function lsPowForm(node, a){
  let bad = false;
  node.traverse(n => {
    if(bad || n.type !== 'OperatorNode' || n.fn !== 'pow' || !lsHasX(n.args[0]) || !lsHasX(n.args[1])) return;
    const u = lsFn(n.args[0])(a), w = lsFn(n.args[1])(a);
    if((lsZ(u) && lsZ(w)) || (Math.abs(u - 1) < 1e-12 && !isFinite(w)) || (lsInf(u) && lsZ(w))) bad = true;
  });
  return bad;
}

function lsSubst(node, C){
  const rep = C.aNode || new math.ConstantNode(Number.isInteger(C.a) ? C.a : Number(C.a.toPrecision(6)));
  const t = node.transform(n => (n.type === 'SymbolNode' && n.name === 'x') ? rep : n)
    .transform(n => (n.type === 'OperatorNode' && n.fn === 'unaryMinus' && unwrap(n.args[0]).type === 'ConstantNode' && unwrap(n.args[0]).value === 0) ? new math.ConstantNode(0) : n);
  return lsP(t);
}

function lsNorm(n){
  n = unwrap(n);
  if(n.type === 'OperatorNode' && n.fn === 'unaryPlus') return lsNorm(n.args[0]);
  if(n.type === 'OperatorNode' && n.fn === 'unaryMinus'){
    const a = unwrap(n.args[0]);
    if(a.type === 'OperatorNode' && a.fn === 'divide') return lsDiv(lsNeg(a.args[0]), a.args[1]);
  }
  return n;
}

/* limit obýektlerinden san almak */
function lsNum(v){ if(typeof v === 'number') return isNaN(v) ? null : v; if(v && v.side) return v.v; return null; }

function lsPick(v, s){
  if(v === null || v === undefined) return null;
  if(typeof v === 'number') return v;
  if(v.side) return v.side === s ? v.v : NaN;
  if(v.none && !v.osc) return s < 0 ? v.left : v.right;
  return null;
}

const lsUInf = v => !!(v && v.none && !v.osc && lsInf(v.left) && lsInf(v.right));

function lsKeepSide(v, raw){ return (raw && raw.side && typeof v === 'number') ? {side: raw.side, v} : v; }

function lsScale(v, k){
  const mul = x => (k === 0 && lsInf(x)) ? NaN : (lsInf(x) ? Math.sign(k)*x : k*x);
  if(typeof v === 'number') return mul(v);
  if(v && v.side) return {side: v.side, v: mul(v.v)};
  if(v && v.none && !v.osc) return {none: true, left: mul(v.left), right: mul(v.right)};
  return v;
}

/* jogaby ýazmak: san, ±∞, bir taraply ýa-da "ýok" */
function limitValStr(v){
  if(v === null || v === undefined) return '—';
  if(v.osc) return 'ýok (funksiýa yrgyldaýar)';
  if(v.side) return lsFull(v.v) + ' (diňe ' + (v.side > 0 ? 'sag' : 'çep') + ' tarapdan)';
  if(v.none){
    const part = (s, x) => (x === undefined || isNaN(x)) ? '' : s + ' limit ' + lsFull(x);
    const parts = [part('çep', v.left), part('sag', v.right)].filter(Boolean);
    return 'ýok' + (parts.length ? ' (' + parts.join(', ') + ')' : '');
  }
  return lsFull(v);
}

function lsNest(title, st){ return title + (st && st.length ? '<ol class="steps sub">' + st.map(s => '<li>' + s + '</li>').join('') + '</ol>' : ''); }

function lsSub(node, C, depth){ const st = []; const v = lsSolve(node, C, st, depth + 1); return {v: v === undefined ? null : v, st}; }

/* çäksiz jogap: alamaty taraplar boýunça barlap */
function lsInfAns(fn, C, steps, why){
  if(C.s){
    const t = lsTrend(fn, C.s);
    if(lsInf(t)){ steps.push(why + ' ⇒ lim = <b>' + lsInfS(t) + '</b>.'); return t; }
    return null;
  }
  const l = lsSide(fn, C.a, -1), r = lsSide(fn, C.a, 1), L = C.label;
  if(lsInf(l) && lsInf(r)){
    if(l === r){ steps.push(why + ' Iki tarapda hem ' + lsInfS(l) + ' ⇒ lim = <b>' + lsInfS(l) + '</b>.'); return l; }
    steps.push(why + ' Alamaty taraplara görä dürli: x → ' + L + '⁻ bolanda ' + lsInfS(l) + ', x → ' + L + '⁺ bolanda ' + lsInfS(r) + ' ⇒ bir taraply limitler deň däl, <b>limit ýok</b>.');
    return {none: true, left: l, right: r};
  }
  if(lsInf(r) && l === null){ steps.push(why + ' Funksiýa diňe x &gt; ' + L + ' tarapda kesgitlenen: lim(x→' + L + '⁺) = <b>' + lsInfS(r) + '</b>.'); return {side: 1, v: r}; }
  if(lsInf(l) && r === null){ steps.push(why + ' Funksiýa diňe x &lt; ' + L + ' tarapda kesgitlenen: lim(x→' + L + '⁻) = <b>' + lsInfS(l) + '</b>.'); return {side: -1, v: l}; }
  return null;
}

/* c/0 (c ≠ 0): bir taraply alamatlar */
function lsPole(c, Q, C, steps){
  const a = C.a, L = C.label, d = 1e-6*Math.max(1, Math.abs(a)), qL = Q(a - d), qR = Q(a + d);
  const desc = q => isNaN(q) ? 'kesgitlenmedik' : q < 0 ? 'otrisatel' : 'položitel';
  steps.push('Sanawjy ' + lsVal(c) + ' ≠ 0, maýdalawjy bolsa 0 — <b>c/0 görnüşi</b>: drobuň moduly çäksiz ulalýar. Alamatyny ýakyn nokatlarda barlaýarys: x → ' + L + '⁻ bolanda maýdalawjy ' + desc(qL) + ', x → ' + L + '⁺ bolanda ' + desc(qR) + '.');
  const sL = isNaN(qL) ? NaN : Math.sign(c*qL), sR = isNaN(qR) ? NaN : Math.sign(c*qR);
  if(isNaN(sL) && isNaN(sR)) return null;
  if(isNaN(sL) || isNaN(sR)){
    const s = isNaN(sL) ? 1 : -1, v = (isNaN(sL) ? sR : sL)*Infinity;
    steps.push('Funksiýa diňe ' + (s > 0 ? 'sag' : 'çep') + ' tarapda kesgitlenen: lim(x→' + L + (s > 0 ? '⁺' : '⁻') + ') = <b>' + lsInfS(v) + '</b>.');
    return {side: s, v};
  }
  if(sL === sR){ steps.push('Iki tarapda hem ' + lsInfS(sL) + ' ⇒ lim = <b>' + lsInfS(sL) + '</b>.'); return sL*Infinity; }
  steps.push('Çep limit ' + lsInfS(sL) + ', sag limit ' + lsInfS(sR) + ' — bir taraply limitler dürli ⇒ <b>limit ýok</b>.');
  return {none: true, left: sL*Infinity, right: sR*Infinity};
}

/* çäklilik we yrgyldy: {B, lo, hi, osc} ýa-da null (çäksiz / kesgitlenmedik) */
function lsBound(fn, C){
  const sc = Math.max(1, Math.abs(C.a || 0)), sides = C.s ? [C.s] : [-1, 1];
  let Mo = 0, Mi = 0, lo = Infinity, hi = -Infinity, changes = 0, bad = 0, total = 0;
  for(const s of sides){
    let prev = null, prevD = 0;
    for(let k = 2; k <= 7; k++) for(let jj = 0; jj < 9; jj++){
      const j = C.s ? jj : 8 - jj, m = 1 + 0.1093*j + 0.0371*k;                 // nokatlar a-a / ∞-e tarap monoton
      const x = C.s ? s*Math.pow(10, k)*m : C.a + s*Math.pow(10, -k)*m*sc, v = fn(x);
      total++;
      if(isNaN(v)){ bad++; continue; }
      if(!isFinite(v)) return null;
      const Av = Math.abs(v);
      if(k <= 4) Mo = Math.max(Mo, Av); else { Mi = Math.max(Mi, Av); lo = Math.min(lo, v); hi = Math.max(hi, v); }
      if(prev !== null){ const dd = v - prev; if(dd*prevD < 0) changes++; if(dd !== 0) prevD = dd; }
      prev = v;
    }
  }
  if(bad > total/2 || !isFinite(lo) || Mi > 2*Mo + 1e-9 || Mi > 1e6) return null;
  return {B: Math.max(1, Math.ceil(Math.max(Mo, Mi) - 1e-6)), lo: Math.floor(lo + 1e-6), hi: Math.ceil(hi - 1e-6), osc: changes >= 6 && (hi - lo) > 1e-3*Math.max(1, Math.abs(hi))};
}

function lsOsc(node, C, steps){
  const b = lsBound(lsFn(node), C);
  if(!b || !b.osc) return undefined;
  steps.push(lsP(node) + ' funksiýasy x → ' + lsWhere(C) + ' bolanda ' + lsVal(b.lo) + ' bilen ' + lsVal(b.hi) + ' aralygynda yrgyldaýar: çäkli, ýöne hiç bir sana ýakynlaşmaýar ⇒ <b>limit ýok</b>.');
  return {none: true, osc: true};
}

/* bir tarapda kesgitlenmedik funksiýa: netije bir taraply limitdir */
function lsDomain(r, f, C, steps){
  if(r === null || r === undefined || (typeof r === 'object' && (r.side || r.osc))) return r;
  const dl = lsSideDef(f, C.a, -1), dr = lsSideDef(f, C.a, 1);
  if(dl === dr) return r;
  const s = dr ? 1 : -1, v = lsPick(r, s);
  if(v === null || isNaN(v)) return r;
  steps.push('Funksiýa diňe x ' + (s > 0 ? '&gt;' : '&lt;') + ' ' + C.label + ' tarapda kesgitlenen, şonuň üçin bu ' + (s > 0 ? 'sag' : 'çep') + ' limit: lim(x→' + C.label + (s > 0 ? '⁺' : '⁻') + ') f(x) = <b>' + lsFull(v) + '</b>.');
  return {side: s, v};
}

/* ---------- drob: p/q ---------- */

/* 0/0, ikisi hem köpagza: (x − a) köpeldijini Gorneriň shemasy bilen aýyrmak */
function lsFactor(p, q, C, steps){
  const Pc0 = polyCoeffs(p), Qc0 = polyCoeffs(q), a = C.a, L = C.label;
  if(!(Pc0 && Qc0 && Pc0.length > 1 && Qc0.length > 1)) return undefined;
  let k = 0, Pc = Pc0, Qc = Qc0;
  while(k < 5 && lsZ(polyEval(Pc, a), 1) && lsZ(polyEval(Qc, a), 1) && Pc.length > 1 && Qc.length > 1){ Pc = polyDivLinear(Pc, a).q; Qc = polyDivLinear(Qc, a).q; k++; }
  if(!k) return undefined;
  const F = linFactor(a) + (k > 1 ? '<sup>' + k + '</sup>' : '');
  const nz = c => c.filter(t => Math.abs(t) > 1e-12).length;
  const fac = c => (c.length === 1 && Math.abs(c[0] - 1) < 1e-12) ? F : (c.length === 1 ? lsValP(c[0]) + '·' + F : F + '·(' + polyHtml(c) + ')');
  steps.push('Sanawjy we maýdalawjy köpagza, ikisiniň hem köki x = ' + L + '. Diýmek, ikisi hem ' + linFactor(a) + ' köpeldijä bölünýär (Gorneriň shemasy): ' +
    polyHtml(Pc0) + ' = ' + fac(Pc) + ', &nbsp;' + polyHtml(Qc0) + ' = ' + fac(Qc) + '.');
  const qOne = Qc.length === 1 && Math.abs(Qc[0] - 1) < 1e-12;
  const rest = qOne ? polyHtml(Pc) : (nz(Pc) > 1 ? '(' + polyHtml(Pc) + ')' : polyHtml(Pc)) + '/' + ((nz(Qc) > 1 || (Qc.length === 1 && Qc[0] < 0) || (Qc.length > 1 && Qc[Qc.length - 1] !== 1)) ? '(' + polyHtml(Qc) + ')' : polyHtml(Qc));
  steps.push(F + ' köpeldijini gysgaldýarys (x ≠ ' + L + '): f(x) = ' + rest + '.');
  const pv = polyEval(Pc, a), qv = polyEval(Qc, a);
  if(!lsZ(qv, 1)){ const v = pv/qv; steps.push('Indi x = ' + L + ' goýýarys: ' + (qOne ? '' : lsVal(pv) + ' / ' + lsValP(qv) + ' = ') + '<b>' + lsFull(v) + '</b>.'); return v; }
  if(lsZ(pv, 1)) return undefined;
  return lsPole(pv, x => polyEval(Qc, x), C, steps);
}

/* √u ± v görnüşi: goşma aňlatma we köpeltmek hasyly u² − v² */
function lsConj(node){
  const n = lsNorm(node);
  if(!(n.type === 'OperatorNode' && (n.fn === 'add' || n.fn === 'subtract'))) return null;
  const U = unwrap(n.args[0]), V = unwrap(n.args[1]);
  const isR = m => m.type === 'FunctionNode' && m.fn.name === 'sqrt' && m.args.length === 1;
  if(!(isR(U) || isR(V))) return null;
  if((isR(U) && !isR(V) && lsHasFn(V, ['sqrt'])) || (isR(V) && !isR(U) && lsHasFn(U, ['sqrt']))) return null;
  const sq = m => isR(m) ? m.args[0] : new math.OperatorNode('^', 'pow', [m, new math.ConstantNode(2)]);
  const conj = n.fn === 'add' ? new math.OperatorNode('-', 'subtract', [U, V]) : new math.OperatorNode('+', 'add', [U, V]);
  return {conj, num: simplifySafe(new math.OperatorNode('-', 'subtract', [sq(U), sq(V)]))};
}

function lsConjQuot(p, q, C, steps, depth){
  const cp = lsConj(p), cq = cp ? null : lsConj(q);
  if(!cp && !cq) return undefined;
  let raw, txt;
  if(cp){
    raw = lsDiv(cp.num, lsMul(q, cp.conj));
    txt = 'Sanawjyda kök bar: sanawjyny we maýdalawjyny goşma aňlatma ' + lsPp(cp.conj) + '-a köpeldýäris. (u − v)(u + v) = u² − v² bolany üçin sanawjy ' + lsP(cp.num) + ' bolýar: f(x) = ' + lsP(raw);
  } else {
    raw = lsDiv(lsMul(p, cq.conj), cq.num);
    txt = 'Maýdalawjyda kök bar: sanawjyny we maýdalawjyny goşma aňlatma ' + lsPp(cq.conj) + '-a köpeldýäris. (u − v)(u + v) = u² − v² bolany üçin maýdalawjy ' + lsP(cq.num) + ' bolýar: f(x) = ' + lsP(raw);
  }
  const R = lsNorm(simplifySafe(raw));
  steps.push(txt + (lsP(R) !== lsP(raw) ? ' = ' + lsP(R) + ' (x ≠ ' + lsWhere(C) + ' bolanda gysgaltdyk)' : '') + '.');
  if(R.type === 'OperatorNode' && R.fn === 'divide') return lsQuot(R.args[0], R.args[1], C, steps, depth, 0, true);
  const sub = lsSub(R, C, depth);
  sub.st.forEach(s => steps.push(s));
  return sub.v;
}

/* Lopitalyň düzgüni: p′/q′ ýönekeýleşdirilýär; drob galsa — ýene derňew, galmasa — aňlatmanyň limiti */
function lsLhop(p, q, C, steps, depth, round, kind){
  if(round >= 3){ steps.push('Lopitalyň düzgüni 3 gezek ulanyldy, kesgitsizlik galdy — netije san barlagy bilen anyklanýar.'); return null; }
  let dp, dq;
  try{ dp = derivNice(p); dq = derivNice(q); }catch(e){ dp = simplifySafe(math.derivative(p, 'x')); dq = simplifySafe(math.derivative(q, 'x')); }
  const raw = lsDiv(dp, dq), Rs = lsNorm(simplifySafe(raw));
  /* jemiň / köpeltmegiň içinde drob barmy (funksiýanyň argumentine we derejä girilmeýär) */
  const hasDiv = n => {
    n = unwrap(n);
    if(n.type !== 'OperatorNode') return false;
    if(n.fn === 'divide') return true;
    return ['add', 'subtract', 'multiply', 'unaryMinus', 'unaryPlus'].indexOf(n.fn) !== -1 && n.args.some(hasDiv);
  };
  const clean = Rs.type === 'OperatorNode' && Rs.fn === 'divide' ? !hasDiv(Rs.args[0]) && !hasDiv(Rs.args[1]) : !hasDiv(Rs);
  const size = n => { let k = 0; n.traverse(() => { k++; }); return k; };
  const R = (clean && size(Rs) <= size(raw) + 2) ? Rs : raw;
  const same = R === raw;
  steps.push('<b>Lopitalyň düzgüni</b> (' + kind + '): lim p/q = lim p′/q′, bu ýerde p′ = ' + derivPretty(dp) + ', q′ = ' + derivPretty(dq) + (same ? '' : '; ýönekeýleşdirsek p′/q′ = ' + derivPretty(R)) + '.');
  if(R.type === 'OperatorNode' && R.fn === 'divide') return lsQuot(R.args[0], R.args[1], C, steps, depth, round + 1, true);
  if(!C.s){
    const f = lsFn(R), v = f(C.a);
    if(isFinite(v) && lsSideCont(f, C.a, v, -1) === true && lsSideCont(f, C.a, v, 1) === true){ steps.push('Indi x = ' + C.label + ' goýýarys: lim = <b>' + lsFull(v) + '</b>.'); return v; }
  }
  const sub = lsSub(R, C, depth);
  sub.st.forEach(s => steps.push(s));
  return sub.v;
}

/* x → ±∞: ösüşiň derejesi k (|f| ~ |x|^k), k bitin ýa-da ýarym bitin bolsa */
function lsOrder(fn, s){
  const v1 = Math.abs(fn(s*1e5)), v2 = Math.abs(fn(s*1e6)), v3 = Math.abs(fn(s*1e7));
  if(!(v1 > 0 && v2 > 0 && v3 > 0) || !isFinite(v3)) return null;
  const k1 = Math.log10(v2/v1), k2 = Math.log10(v3/v2), k = Math.round(2*k2)/2;
  if(Math.abs(k1 - k2) > 0.01 || Math.abs(k2 - k) > 0.02) return null;
  return k;
}

function lsPowStr(k, s){
  const base = s < 0 ? '|x|' : 'x';
  if(k === 1) return base;
  return base + '<sup>' + (Number.isInteger(k) ? k : (2*k) + '/2') + '</sup>';
}

/* ∞/∞, x → ±∞: sanawjyny we maýdalawjyny maýdalawjynyň baş derejesine bölmek */
function lsOrders(fp, fq, C, steps){
  const s = C.s, kp = lsOrder(fp, s), kq = lsOrder(fq, s);
  if(kp === null || kq === null || kp <= 0 || kq <= 0) return undefined;
  const X = lsPowStr(kq, s);
  const cp = lsTrend(x => fp(x)/Math.pow(Math.abs(x), kq), s), cq = lsTrend(x => fq(x)/Math.pow(Math.abs(x), kq), s);
  if(cp === null || cq === null || !isFinite(cq) || lsZ(cq)) return undefined;
  steps.push('Sanawjy ' + lsPowStr(kp, s) + ', maýdalawjy ' + X + ' ýaly ösýär (baş agzalar). Sanawjyny we maýdalawjyny ' + X + '-a bölýäris: sanawjy/' + X + ' → ' + lsVal(cp) + ', maýdalawjy/' + X + ' → ' + lsVal(cq) + '.');
  if(isFinite(cp)){ const v = cp/cq; steps.push('Diýmek, lim = ' + lsVal(cp) + ' / ' + lsValP(cq) + ' = <b>' + lsFull(v) + '</b>.'); return v; }
  const v = Math.sign(cp)*Math.sign(cq)*Infinity;
  steps.push('Sanawjy maýdalawjydan çalt ösýär ⇒ lim = <b>' + lsInfS(v) + '</b>.');
  return v;
}

function lsQuot(p, q, C, steps, depth, round, noConj){
  const W = lsWhere(C), fp = lsFn(p), fq = lsFn(q), fpq = x => fp(x)/fq(x);
  if(C.s && round > 0){ const Rr = ratCoeffs(lsDiv(p, q)); if(Rr) return lsRatInf(Rr, C, steps); }
  const pa = lsNearC(fp, C), qa = lsNearC(fq, C), what = round ? 'p′/q′' : 'p/q';
  const direct = !C.s && isFinite(fp(C.a)) && isFinite(fq(C.a));
  if(isFinite(pa) && isFinite(qa) && !lsZ(qa)){
    const v = pa/qa;
    steps.push((C.s || !direct ? 'x → ' + W + ': sanawjy → ' + lsVal(pa) + ', maýdalawjy → ' + lsVal(qa) + ' ⇒ lim = ' : 'x = ' + W + ' goýýarys: ' + what + ' = ' + lsVal(pa) + ' / ' + lsValP(qa) + ' = ') + '<b>' + lsFull(v) + '</b>.');
    return v;
  }
  if(isFinite(pa) && lsInf(qa)){ steps.push('Sanawjy ' + lsVal(pa) + ' sana, maýdalawjy çäksizlige ymtylýar ⇒ lim = <b>0</b>.'); return 0; }
  if(lsInf(pa) && isFinite(qa) && !lsZ(qa)) return lsInfAns(fpq, C, steps, 'Sanawjy çäksiz, maýdalawjy ' + lsVal(qa) + ' sana ymtylýar — drob çäksiz ulalýar.');
  if(lsZ(pa) && lsZ(qa)){
    steps.push(round === 0 ? (C.s ? 'x → ' + W + ' bolanda sanawjy hem, maýdalawjy hem 0-a ymtylýar' : 'x = ' + W + ' goýsak, sanawjy hem, maýdalawjy hem 0 bolýar') + ' — <b>0/0 kesgitsizlik</b>. Göni goýup bolmaýar, aňlatmany özgertmeli.' : 'Ýene-de 0/0 kesgitsizlik.');
    if(!C.s && round === 0){ const r = lsFactor(p, q, C, steps); if(r !== undefined) return r; }
    if(!noConj && round === 0){ const r = lsConjQuot(p, q, C, steps, depth); if(r !== undefined) return r; }
    return lsLhop(p, q, C, steps, depth, round, '0/0');
  }
  if(isFinite(pa) && !lsZ(pa) && lsZ(qa)){
    if(!C.s) return lsPole(pa, fq, C, steps);
    return lsInfAns(fpq, C, steps, 'Sanawjy ' + lsVal(pa) + ' ≠ 0, maýdalawjy 0-a ymtylýar — drob çäksiz ulalýar.');
  }
  if(lsInf(pa) && lsZ(qa)) return lsInfAns(fpq, C, steps, 'Sanawjy çäksiz, maýdalawjy 0-a ymtylýar — drob çäksiz ulalýar.');
  if(lsInf(pa) && lsInf(qa)){
    steps.push(round === 0 ? 'x → ' + W + ' bolanda sanawjy hem, maýdalawjy hem çäksiz — <b>∞/∞ kesgitsizlik</b>.' : 'Ýene-de ∞/∞ kesgitsizlik.');
    if(C.s && round === 0){ const r = lsOrders(fp, fq, C, steps); if(r !== undefined) return r; }
    return lsLhop(p, q, C, steps, depth, round, '∞/∞');
  }
  if(isNaN(pa) && lsInf(qa)){
    const bd = lsBound(fp, C);
    if(bd){
      steps.push('Sanawjy ' + lsP(p) + ' çäkli: |' + lsP(p) + '| ≤ ' + bd.B + ', maýdalawjy bolsa çäksizlige ymtylýar ⇒ |f(x)| ≤ ' + bd.B + '/|' + lsP(q) + '| → 0 ⇒ <b>gysyş teoremasy</b> boýunça lim = <b>0</b>.');
      return 0;
    }
  }
  return null;
}

/* ---------- jem, köpeltmek hasyly, dereje, funksiýa ---------- */

function lsPolyNode(c){ return math.parse(c.map((v, k) => '(' + v + ')*x^' + k).join(' + ')); }

/* A/B ± C/D = (A·D ± C·B)/(B·D) */
function lsFrac(node){
  const n = lsNorm(node);
  if(!(n.type === 'OperatorNode' && (n.fn === 'add' || n.fn === 'subtract'))) return null;
  const parts = n.args.map(m => { m = lsNorm(m); return (m.type === 'OperatorNode' && m.fn === 'divide') ? [m.args[0], m.args[1]] : [m, null]; });
  if(!parts[0][1] && !parts[1][1]) return null;
  const A = parts[0][0], B = parts[0][1], Cn = parts[1][0], D = parts[1][1];
  const num = simplifySafe(new math.OperatorNode(n.op, n.fn, [D ? lsMul(A, D) : A, B ? lsMul(Cn, B) : Cn]));
  const den = simplifySafe(B && D ? lsMul(B, D) : (B || D));
  return {num, den};
}

function lsInfMinusInf(node, C, steps, depth){
  const R = C.s ? null : ratCoeffs(node);
  if(R && R.den.length > 1){
    steps.push('Droblary umumy maýdalawja getirýäris: f(x) = (' + polyHtml(R.num) + ')/(' + polyHtml(R.den) + ').');
    return lsQuot(lsPolyNode(R.num), lsPolyNode(R.den), C, steps, depth, 0);
  }
  const cj = lsConj(node);
  if(cj){
    steps.push('Goşma (konýugat) aňlatma ' + lsPp(cj.conj) + ' bilen köpeldip-bölýäris: (u − v)(u + v) = u² − v² ⇒ f(x) = ' + lsP(lsDiv(cj.num, cj.conj)) + '.');
    return lsQuot(cj.num, cj.conj, C, steps, depth, 0, true);
  }
  if(C.s){
    const n = lsNorm(node), sg = n.fn === 'add' ? 1 : -1, U = n.args[0], V = n.args[1];
    /* first: u ± v = u·(1 ± v/u);  ýogsam: u ± v = v·(u/v ± 1) */
    const tryOut = (big, small, first) => {
      const ratio = simplifySafe(lsDiv(small, big)), sub = lsSub(ratio, C, depth), L = lsNum(sub.v), tb = lsTrend(lsFn(big), C.s);
      if(L === null || !isFinite(L) || !lsInf(tb)) return undefined;
      const k = first ? 1 + sg*L : L + sg;
      if(Math.abs(k) < 1e-9) return undefined;
      const form = first ? '(1 ' + (sg > 0 ? '+' : '−') + ' ' + lsPp(ratio) + ')' : '(' + lsPp(ratio) + (sg > 0 ? ' + 1' : ' − 1') + ')';
      steps.push('Iň çalt ösýän agzany daşyna çykarýarys: ' + lsP(n) + ' = ' + lsPp(big) + '·' + form + '.');
      steps.push(lsNest(lsP(ratio) + ' → ' + lsVal(L) + ':', sub.st));
      const v = Math.sign(tb)*Math.sign(k)*Infinity;
      steps.push('Skobkadaky aňlatma → ' + lsVal(k) + ' ≠ 0, ' + lsP(big) + ' → ' + lsInfS(tb) + ' ⇒ lim = <b>' + lsInfS(v) + '</b>.');
      return v;
    };
    let r = tryOut(U, V, true);
    if(r === undefined) r = tryOut(V, U, false);
    if(r !== undefined) return r;
  }
  const fr = lsFrac(node);
  if(fr){
    steps.push('Umumy maýdalawja getirýäris: f(x) = ' + lsP(lsDiv(fr.num, fr.den)) + '.');
    return lsQuot(fr.num, fr.den, C, steps, depth, 0);
  }
  return null;
}

function lsSum(node, C, steps, depth){
  const A = node.args[0], B = node.args[1], sg = node.fn === 'add' ? 1 : -1, opS = sg > 0 ? ' + ' : ' − ';
  const a = lsSub(A, C, depth), b = lsSub(B, C, depth), va = lsNum(a.v), vb = lsNum(b.v);
  const show = () => { steps.push(lsNest(lsP(A) + ':', a.st)); steps.push(lsNest(lsP(B) + ':', b.st)); };
  const side = (a.v && a.v.side) ? a.v : (b.v && b.v.side) ? b.v : null;
  if(va !== null && vb !== null && isFinite(va) && isFinite(vb)){
    steps.push('Jemiň (tapawudyň) limiti limitleriň jemine (tapawudyna) deň: lim(u' + opS + 'v) = lim u' + opS + 'lim v.');
    show();
    const v = va + sg*vb;
    steps.push('Diýmek, lim = ' + lsVal(va) + opS + lsValP(vb) + ' = <b>' + lsFull(v) + '</b>.');
    return lsKeepSide(v, side);
  }
  const ia = va !== null && lsInf(va), ib = vb !== null && lsInf(vb);
  if((ia && vb !== null && isFinite(vb)) || (ib && va !== null && isFinite(va))){
    const v = ia ? va : sg*vb;
    show();
    steps.push((ia ? 'Birinji' : 'Ikinji') + ' goşulyjy çäksiz, beýlekisi tükenikli sana ymtylýar ⇒ lim = <b>' + lsInfS(v) + '</b>.');
    return lsKeepSide(v, side);
  }
  if(ia && ib && Math.sign(va) === Math.sign(sg*vb)){
    show();
    steps.push('Iki goşulyjy hem şol bir alamatly çäksizlige ymtylýar (' + lsInfS(va) + ') ⇒ lim = <b>' + lsInfS(va) + '</b>.');
    return lsKeepSide(va, side);
  }
  if((ia || lsUInf(a.v)) && (ib || lsUInf(b.v))){
    const l1 = lsPick(a.v, -1), l2 = sg*lsPick(b.v, -1), r1 = lsPick(a.v, 1), r2 = sg*lsPick(b.v, 1);
    if(!C.s && Math.sign(l1) === Math.sign(l2) && Math.sign(r1) === Math.sign(r2)){
      show();
      if(Math.sign(l1) === Math.sign(r1)){ steps.push('Iki goşulyjy hem şol bir alamatly çäksizlige ymtylýar ⇒ lim = <b>' + lsInfS(l1) + '</b>.'); return l1; }
      steps.push('Çep tarapda ' + lsInfS(l1) + ', sag tarapda ' + lsInfS(r1) + ' ⇒ <b>limit ýok</b>.');
      return {none: true, left: l1, right: r1};
    }
    steps.push('Iki goşulyjy hem çäksiz, alamatlary garşylykly — <b>∞ − ∞ kesgitsizlik</b>. Aňlatmany özgertmeli.');
    return lsInfMinusInf(node, C, steps, depth);
  }
  return undefined;
}

/* 1/z: görkezijili z = b^w üçin b^(−w) (ýönekeýleşdirilen), ýogsam 1/z */
function lsRecip(z){
  const u = unwrap(z);
  if(u.type === 'OperatorNode' && u.fn === 'pow' && !lsHasX(u.args[0])) return new math.OperatorNode('^', 'pow', [u.args[0], simplifySafe(lsNeg(u.args[1]))]);
  if(u.type === 'FunctionNode' && u.fn.name === 'exp') return new math.FunctionNode('exp', [simplifySafe(lsNeg(u.args[0]))]);
  if(u.type === 'FunctionNode' && (u.fn.name === 'tan' || u.fn.name === 'cot') && u.args.length === 1) return new math.FunctionNode(u.fn.name === 'tan' ? 'cot' : 'tan', [u.args[0]]);
  return simplifySafe(lsDiv(lsOne(), z));
}

function lsIsExp(n){
  n = unwrap(n);
  if(n.type === 'FunctionNode' && n.fn.name === 'exp') return true;
  return n.type === 'OperatorNode' && n.fn === 'pow' && !lsHasX(n.args[0]) && lsHasX(n.args[1]);
}

function lsProd(node, C, steps, depth){
  const A = node.args[0], B = node.args[1];
  if(!lsHasX(A) || !lsHasX(B)){
    const kn = !lsHasX(A) ? A : B, g = !lsHasX(A) ? B : A, k = lsFn(kn)(0);
    if(!isFinite(k)) return undefined;
    const sub = lsSub(g, C, depth);
    if(sub.v === null) return undefined;
    steps.push('Hemişelik köpeldijini limitiň daşyna çykarýarys: lim(' + lsP(node) + ') = ' + lsValP(k) + '·lim ' + lsPp(g) + '.');
    sub.st.forEach(s => steps.push(s));
    const v = lsScale(sub.v, k), vn = lsNum(v), gn = lsNum(sub.v);
    steps.push('Diýmek, lim = ' + lsValP(k) + '·' + (gn !== null ? lsValP(gn) : '(…)') + ' = <b>' + (vn !== null ? lsFull(vn) : limitValStr(v)) + '</b>.');
    return v;
  }
  const a = lsSub(A, C, depth), b = lsSub(B, C, depth), va = lsNum(a.v), vb = lsNum(b.v);
  const show = () => { steps.push(lsNest(lsP(A) + ':', a.st)); steps.push(lsNest(lsP(B) + ':', b.st)); };
  const side = (a.v && a.v.side) ? a.v : (b.v && b.v.side) ? b.v : null;
  if(va !== null && vb !== null && isFinite(va) && isFinite(vb)){
    steps.push('Köpeltmek hasylynyň limiti limitleriň köpeltmek hasylyna deň: lim(u·v) = lim u · lim v.');
    show();
    const v = va*vb;
    steps.push('Diýmek, lim = ' + lsValP(va) + '·' + lsValP(vb) + ' = <b>' + lsFull(v) + '</b>.');
    return lsKeepSide(v, side);
  }
  const z0 = v => v !== null && isFinite(v) && lsZ(v);
  const infA = (va !== null && lsInf(va)) || lsUInf(a.v), infB = (vb !== null && lsInf(vb)) || lsUInf(b.v);
  if((z0(va) && infB) || (z0(vb) && infA)){
    const z = z0(va) ? A : B, big = z0(va) ? B : A;
    let p, q;
    if(lsIsExp(z) || (lsHasFn(big, ['log', 'log10']) && !lsHasFn(z, ['log', 'log10']))){ p = big; q = lsRecip(z); }
    else { p = z; q = lsRecip(big); }
    steps.push('Bir köpeldiji 0-a, beýlekisi çäksizlige ymtylýar — <b>0·∞ kesgitsizlik</b>. Köpeltmek hasylyny drob görnüşine getirýäris: ' + lsP(node) + ' = ' + lsP(lsDiv(p, q)) + '.');
    return lsQuot(p, q, C, steps, depth, 0);
  }
  if(z0(va) || z0(vb)){
    const z = z0(va) ? A : B, w = z0(va) ? B : A, wraw = z0(va) ? b.v : a.v;
    if(wraw === null || (wraw && wraw.osc)){
      const bd = lsBound(lsFn(w), C);
      if(bd){
        steps.push(lsP(z) + ' → 0, ' + lsP(w) + ' bolsa çäkli: |' + lsP(w) + '| ≤ ' + bd.B + '. Onda |' + lsP(node) + '| ≤ ' + (bd.B === 1 ? '' : bd.B + '·') + '|' + lsP(z) + '| → 0 ⇒ <b>gysyş teoremasy</b> boýunça lim = <b>0</b>.');
        return 0;
      }
    }
  }
  const cA = va !== null && isFinite(va) && !lsZ(va), cB = vb !== null && isFinite(vb) && !lsZ(vb);
  if((cA && vb !== null && lsInf(vb)) || (cB && va !== null && lsInf(va))){
    const c = cA ? va : vb, I = cA ? vb : va, v = Math.sign(c)*I;
    show();
    steps.push('Nola deň däl ' + lsVal(c) + ' san bilen çäksiz ululygyň köpeltmek hasyly çäksiz ⇒ lim = <b>' + lsInfS(v) + '</b>.');
    return lsKeepSide(v, side);
  }
  if(va !== null && vb !== null && lsInf(va) && lsInf(vb)){
    const v = Math.sign(va)*Math.sign(vb)*Infinity;
    show();
    steps.push('Iki köpeldiji hem çäksiz ⇒ lim = <b>' + lsInfS(v) + '</b>.');
    return lsKeepSide(v, side);
  }
  return undefined;
}

function lsPow(node, C, steps, depth){
  const U = node.args[0], Wn = node.args[1], hu = lsHasX(U), hw = lsHasX(Wn);
  if(hu && !hw){
    const n = lsFn(Wn)(0);
    if(!isFinite(n)) return undefined;
    const sub = lsSub(U, C, depth), L = lsNum(sub.v);
    if(L === null) return undefined;
    let v;
    if(isFinite(L)){ v = Math.pow(L, n); if(isNaN(v) || !isFinite(v)) return undefined; }
    else if(n > 0) v = L > 0 ? Infinity : (Number.isInteger(n) ? (Math.abs(n) % 2 === 1 ? -Infinity : Infinity) : NaN);
    else v = 0;
    if(isNaN(v)) return undefined;
    steps.push('Derejäniň limiti: lim u<sup>n</sup> = (lim u)<sup>n</sup>, bu ýerde u = ' + lsP(U) + ', n = ' + lsVal(n) + '.');
    steps.push(lsNest('lim u:', sub.st));
    steps.push('Diýmek, lim = (' + lsVal(L) + ')<sup>' + lsVal(n) + '</sup> = <b>' + lsFull(v) + '</b>.');
    return lsKeepSide(v, sub.v);
  }
  if(!hu && hw){
    const b = lsFn(U)(0);
    if(!isFinite(b) || b <= 0) return undefined;
    const sub = lsSub(Wn, C, depth), L = lsNum(sub.v), bs = lsP(U);
    const ev = t => b === 1 ? 1 : isFinite(t) ? Math.pow(b, t) : ((b > 1) === (t > 0) ? Infinity : 0);
    const intro = 'Görkezijili funksiýa üznüksiz: lim ' + bs + '<sup>w</sup> = ' + bs + '<sup>lim w</sup>, bu ýerde w = ' + lsP(Wn) + '.';
    if(L === null){
      if(!(sub.v && sub.v.none && !sub.v.osc)) return undefined;
      const vl = ev(sub.v.left), vr = ev(sub.v.right);
      steps.push(intro);
      steps.push(lsNest('lim w:', sub.st));
      if(vl === vr){ steps.push('Iki tarapda hem ' + bs + '<sup>w</sup> → ' + lsVal(vl) + ' ⇒ lim = <b>' + lsFull(vl) + '</b>.'); return vl; }
      steps.push('Çep tarapda ' + bs + '<sup>' + lsVal(sub.v.left) + '</sup> → ' + lsVal(vl) + ', sag tarapda ' + bs + '<sup>' + lsVal(sub.v.right) + '</sup> → ' + lsVal(vr) + ' ⇒ bir taraply limitler dürli, <b>limit ýok</b>.');
      return {none: true, left: vl, right: vr};
    }
    const v = ev(L);
    steps.push(intro);
    steps.push(lsNest('lim w:', sub.st));
    steps.push('Diýmek, lim = ' + bs + '<sup>' + lsVal(L) + '</sup> = <b>' + lsFull(v) + '</b>.');
    return lsKeepSide(v, sub.v);
  }
  const bu = lsNearC(lsFn(U), C), bw = lsNearC(lsFn(Wn), C);
  let kind = null;
  if(isFinite(bu) && Math.abs(bu - 1) < 1e-9 && lsInf(bw)) kind = '1<sup>∞</sup>';
  else if(lsZ(bu) && lsZ(bw)) kind = '0<sup>0</sup>';
  else if(lsInf(bu) && lsZ(bw)) kind = '∞<sup>0</sup>';
  if(kind){
    const lnY = lsMul(Wn, new math.FunctionNode('log', [U]));
    steps.push('<b>' + kind + ' kesgitsizlik</b>: esas → ' + (lsInf(bu) ? '∞' : lsVal(bu)) + ', dereje → ' + (lsInf(bw) ? '∞' : lsVal(bw)) + '. Logarifmlaýarys: y = ' + lsP(node) + ' ⇒ ln y = ' + lsP(lnY) + '.');
    const sub = lsSub(lnY, C, depth), M = lsNum(sub.v);
    steps.push(lsNest('lim ln y:', sub.st));
    if(M === null) return null;
    const v = isFinite(M) ? Math.exp(M) : (M > 0 ? Infinity : 0);
    const eM = 'e<sup>' + lsVal(M) + '</sup>', fv = lsFull(v);
    steps.push('lim ln y = ' + lsVal(M) + ' ⇒ lim y = ' + (fv.indexOf(eM) === 0 ? '' : eM + ' = ') + '<b>' + fv + '</b>.');
    return lsKeepSide(v, sub.v);
  }
  if(isFinite(bu) && bu > 0 && isFinite(bw)){
    const v = Math.pow(bu, bw);
    steps.push('Esas → ' + lsVal(bu) + ' > 0, dereje → ' + lsVal(bw) + ' ⇒ lim = ' + lsValP(bu) + '<sup>' + lsVal(bw) + '</sup> = <b>' + lsFull(v) + '</b>.');
    return v;
  }
  return undefined;
}

/* çäksizlikdäki bahalar: [x → −∞, x → +∞] */
const LS_AT_INF = {exp: [0, Infinity], log: [NaN, Infinity], log10: [NaN, Infinity], sqrt: [NaN, Infinity], cbrt: [-Infinity, Infinity],
  atan: [-Math.PI/2, Math.PI/2], tanh: [-1, 1], sinh: [-Infinity, Infinity], cosh: [Infinity, Infinity], asinh: [-Infinity, Infinity], abs: [Infinity, Infinity]};

const LS_TRIG_Q = {tan: ['sin', 'cos'], cot: ['cos', 'sin'], sec: [null, 'cos'], csc: [null, 'sin']};

function lsFnAt(name, lbl){
  const simple = /^[\w.π√]+$/.test(lbl);
  if(name === 'exp') return 'e<sup>' + lbl + '</sup>';
  if(name === 'sqrt') return '√' + (simple ? lbl : '(' + lbl + ')');
  if(name === 'abs') return '|' + lbl + '|';
  if(name === 'log') return 'ln(' + lbl + ')';
  return (LS_FN_NAME[name] || name) + '(' + lbl + ')';
}

function lsFunc(node, C, steps, depth){
  const name = node.fn.name;
  if(node.args.length !== 1) return undefined;
  const g = node.args[0];
  if(LS_TRIG_Q[name]){
    const pq = LS_TRIG_Q[name], p = pq[0] ? new math.FunctionNode(pq[0], [g]) : lsOne(), q = new math.FunctionNode(pq[1], [g]);
    steps.push(lsP(node) + ' = ' + lsP(lsDiv(p, q)) + ' görnüşinde ýazýarys.');
    return lsQuot(p, q, C, steps, depth, 0);
  }
  const sub = lsSub(g, C, depth), raw = sub.v, L = lsNum(raw);
  const F = lsFn(new math.FunctionNode(name, [new math.SymbolNode('x')]));
  const inner = 'lim ' + lsP(node) + ' = ' + lsFnAt(name, 'lim ' + lsP(g));
  if(L !== null && isFinite(L)){
    if((name === 'log' || name === 'log10') && lsZ(L)){
      steps.push(lsNest('Içki aňlatma: ' + lsP(g) + ' → 0 (položitel bahalar bilen).', sub.st));
      steps.push('ln t → −∞, t → 0⁺ bolanda ⇒ lim = <b>−∞</b>.');
      return lsKeepSide(-Infinity, raw);
    }
    const v = F(L), e = 1e-7*Math.max(1, Math.abs(L)), l = F(L - e), r = F(L + e), tol = 1e-4*Math.max(1, Math.abs(v));
    const ok = isFinite(v) && (Math.abs(l - v) <= tol || isNaN(l)) && (Math.abs(r - v) <= tol || isNaN(r)) && !(isNaN(l) && isNaN(r));
    if(ok){
      steps.push('Funksiýa üznüksiz, şonuň üçin limiti içine geçirýäris: ' + inner + '.');
      steps.push(lsNest('lim ' + lsP(g) + ':', sub.st));
      const lhs = lsFnAt(name, lsVal(L));
      steps.push('Diýmek, lim = ' + (lhs === lsVal(v) ? '' : lhs + ' = ') + '<b>' + lsFull(v) + '</b>.');
      return lsKeepSide(v, raw);
    }
    return undefined;
  }
  if(L !== null && lsInf(L) && LS_AT_INF[name]){
    const v = LS_AT_INF[name][L > 0 ? 1 : 0];
    if(isNaN(v)) return undefined;
    steps.push(inner + ', içki aňlatma → ' + lsInfS(L) + '.');
    steps.push(lsNest('lim ' + lsP(g) + ':', sub.st));
    steps.push(lsFnAt(name, 't') + ' → ' + lsVal(v) + ', t → ' + lsInfS(L) + ' bolanda ⇒ lim = <b>' + lsFull(v) + '</b>.');
    return lsKeepSide(v, raw);
  }
  if(L === null && raw && raw.none && !raw.osc && !((name === 'sin' || name === 'cos') && lsUInf(raw))){
    const at = t => {
      if(lsInf(t)) return LS_AT_INF[name] ? LS_AT_INF[name][t > 0 ? 1 : 0] : NaN;
      const v = F(t), e = 1e-7*Math.max(1, Math.abs(t));
      return (isFinite(v) && Math.abs(F(t - e) - v) <= 1e-4*Math.max(1, Math.abs(v)) && Math.abs(F(t + e) - v) <= 1e-4*Math.max(1, Math.abs(v))) ? v : NaN;
    };
    const vl = at(raw.left), vr = at(raw.right);
    if(isNaN(vl) || isNaN(vr)) return undefined;
    steps.push('Içki aňlatmanyň bir taraply limitleri dürli, şonuň üçin funksiýany her tarapda aýratyn alýarys: ' + inner + '.');
    steps.push(lsNest('lim ' + lsP(g) + ':', sub.st));
    if(vl === vr || (isFinite(vl) && Math.abs(vl - vr) <= 1e-12*Math.max(1, Math.abs(vl)))){ steps.push('Iki tarapda hem ' + lsFnAt(name, 't') + ' → ' + lsVal(vl) + ' ⇒ lim = <b>' + lsFull(vl) + '</b>.'); return vl; }
    steps.push('Çep tarapda ' + lsFnAt(name, lsVal(raw.left)) + ' → ' + lsVal(vl) + ', sag tarapda ' + lsFnAt(name, lsVal(raw.right)) + ' → ' + lsVal(vr) + ' ⇒ bir taraply limitler dürli, <b>limit ýok</b>.');
    return {none: true, left: vl, right: vr};
  }
  if((name === 'sin' || name === 'cos') && ((L !== null && lsInf(L)) || lsUInf(raw))){
    steps.push('Içki aňlatma ' + lsP(g) + ' çäksiz ulalýar, ' + lsFnAt(name, 't') + ' bolsa −1 bilen 1 aralygynda yrgyldaýar we hiç bir sana ýakynlaşmaýar ⇒ <b>limit ýok</b>.');
    return {none: true, osc: true};
  }
  return undefined;
}

function lsNegate(node, C, steps, depth){
  const sub = lsSub(node.args[0], C, depth);
  if(sub.v === null) return undefined;
  sub.st.forEach(s => steps.push(s));
  const v = lsScale(sub.v, -1), vn = lsNum(v);
  steps.push('Alamaty garşylykly ⇒ lim = <b>' + (vn !== null ? lsFull(vn) : limitValStr(v)) + '</b>.');
  return v;
}

/* modul: |g| aňlatmasy, g(a) = 0 */
function lsAbsSplit(node, C, steps, depth){
  let target = null;
  node.traverse(n => { if(!target && n.type === 'FunctionNode' && n.fn.name === 'abs' && n.args.length === 1 && lsZ(lsFn(n.args[0])(C.a), 1)) target = n; });
  if(!target) return undefined;
  const g = target.args[0], gf = lsFn(g), d = 1e-6*Math.max(1, Math.abs(C.a));
  const sL = Math.sign(gf(C.a - d)), sR = Math.sign(gf(C.a + d));
  if(!sL || !sR) return undefined;
  const G = lsP(g), piece = s => s > 0 ? '|' + G + '| = ' + G : '|' + G + '| = −' + lsPp(g);
  const repl = s => lsNorm(simplifySafe(node.transform(n => (n.type === 'FunctionNode' && n.fn.name === 'abs' && n.equals(target)) ? (s > 0 ? new math.ParenthesisNode(g) : lsNeg(new math.ParenthesisNode(g))) : n)));
  if(sL === sR){
    const nn = repl(sL);
    steps.push('Modul: x = ' + C.label + ' nokadyň golaýynda ' + G + (sL > 0 ? ' ≥ 0' : ' ≤ 0') + ', şonuň üçin ' + piece(sL) + '. Onda f(x) = ' + lsP(nn) + '.');
    return lsSolve(nn, C, steps, depth + 1);
  }
  steps.push('Modulyň içindäki ' + G + ' aňlatmasy x = ' + C.label + ' nokatda alamatyny üýtgedýär: x &lt; ' + C.label + ' bolanda ' + piece(sL) + ', x &gt; ' + C.label + ' bolanda ' + piece(sR) + '. Bir taraply limitleri aýratyn hasaplaýarys.');
  const nl = repl(sL), nr = repl(sR), l = lsSub(nl, C, depth), r = lsSub(nr, C, depth);
  const vl = lsPick(l.v, -1), vr = lsPick(r.v, 1);
  const okv = v => v !== null && !isNaN(v);
  steps.push(lsNest('x → ' + C.label + '⁻: f(x) = ' + lsP(nl) + (okv(vl) ? ' ⇒ çep limit = ' + lsVal(vl) : ''), lsHasX(nl) ? l.st : []));
  steps.push(lsNest('x → ' + C.label + '⁺: f(x) = ' + lsP(nr) + (okv(vr) ? ' ⇒ sag limit = ' + lsVal(vr) : ''), lsHasX(nr) ? r.st : []));
  if(!okv(vl) || !okv(vr)) return null;
  if(vl === vr || (isFinite(vl) && isFinite(vr) && Math.abs(vl - vr) <= 1e-9*Math.max(1, Math.abs(vl)))){ steps.push('Çep we sag limitler deň ⇒ lim = <b>' + lsFull(vl) + '</b>.'); return vl; }
  steps.push('Çep limit (' + lsVal(vl) + ') sag limitden (' + lsVal(vr) + ') tapawutly ⇒ <b>limit ýok</b>.');
  return {none: true, left: vl, right: vr};
}

/* x → ±∞, rasional funksiýa: derejeleri deňeşdirmek */
function lsDivided(c, m){
  const parts = [];
  for(let k = c.length - 1; k >= 0; k--){
    const a = c[k];
    if(Math.abs(a) < 1e-12) continue;
    const e = k - m, abs = Math.abs(a);
    let t;
    if(e === 0) t = numStr(abs);
    else if(e > 0) t = (Math.abs(abs - 1) < 1e-12 ? '' : numStr(abs)) + 'x' + (e > 1 ? '<sup>' + e + '</sup>' : '');
    else t = numStr(abs) + '/x' + (-e > 1 ? '<sup>' + (-e) + '</sup>' : '');
    parts.push((a < 0 ? (parts.length ? ' − ' : '−') : (parts.length ? ' + ' : '')) + t);
  }
  return parts.join('') || '0';
}

function lsRatInf(R, C, steps){
  const s = C.s, where = lsInfS(s), n = R.num.length - 1, m = R.den.length - 1, an = R.num[n], bm = R.den[m];
  if(m === 0){
    if(n === 0){ const v = an/bm; steps.push('Hemişelik: lim = <b>' + lsFull(v) + '</b>.'); return v; }
    const sg = Math.sign(an/bm)*Math.pow(s, n), v = sg > 0 ? Infinity : -Infinity, lead = new Array(n).fill(0);
    lead.push(an/bm);
    steps.push('Köpagza: x → ' + where + ' bolanda onuň özüni alyp barşyny <b>baş agza</b> ' + polyHtml(lead) + ' kesgitleýär ⇒ lim = <b>' + lsFull(v) + '</b>.');
    return v;
  }
  const wrapP = c => c.filter(t => Math.abs(t) > 1e-12).length > 1 ? '(' + polyHtml(c) + ')' : polyHtml(c);
  steps.push('Rasional funksiýa: f(x) = ' + wrapP(R.num) + '/' + wrapP(R.den) + '. Sanawjynyň derejesi ' + n + ', maýdalawjynyňky ' + m + (n > 0 ? ' — <b>∞/∞ kesgitsizlik</b>' : '') + '.');
  steps.push('Sanawjyny we maýdalawjyny maýdalawjynyň iň uly derejesine x' + (m > 1 ? '<sup>' + m + '</sup>' : '') + ' bölýäris: f(x) = ' + (/[+−] /.test(lsDivided(R.num, m).slice(1)) ? '(' + lsDivided(R.num, m) + ')' : lsDivided(R.num, m)) + '/' + (/[+−] /.test(lsDivided(R.den, m).slice(1)) ? '(' + lsDivided(R.den, m) + ')' : lsDivided(R.den, m)) + '; x → ' + where + ' bolanda c/xᵏ → 0.');
  let v;
  if(n < m){ v = 0; steps.push('Sanawjynyň derejesi kiçi: sanawjy → 0, maýdalawjy → ' + numStr(bm) + ' ⇒ lim = <b>0</b>.'); }
  else if(n === m){ v = an/bm; const r = numStr(an) + '/' + lsValP(bm); steps.push('Derejeler deň: limit baş koeffisiýentleriň gatnaşygyna deň: ' + (r === lsVal(v) ? '' : r + ' = ') + '<b>' + lsFull(v) + '</b>.'); }
  else { const sg = Math.sign(an/bm)*Math.pow(s, n - m); v = sg > 0 ? Infinity : -Infinity; steps.push('Sanawjynyň derejesi uly: sanawjy çäksiz ösýär ⇒ lim = <b>' + lsFull(v) + '</b>.'); }
  return v;
}

/* ---------- esasy rekursiw çözüji ---------- */
function lsSolve(node, C, steps, depth){
  node = lsNorm(node);
  const f = lsFn(node);
  if(!lsHasX(node)){
    const v = f(0);
    if(isFinite(v)){ steps.push('Hemişelik: ' + lsP(node) + (lsP(node) === lsVal(v) ? '' : ' = ' + lsFull(v)) + '.'); return v; }
    return null;
  }
  if(depth > 6) return null;
  if(!C.s){
    const v = f(C.a);
    if(isFinite(v) && !lsPowForm(node, C.a)){
      const cl = lsSideCont(f, C.a, v, -1), cr = lsSideCont(f, C.a, v, 1);
      if(cl === true && cr === true){
        steps.push(depth === 0
          ? 'Funksiýa x = ' + C.label + ' nokatda kesgitlenen we üznüksiz, şonuň üçin göni goýýarys: f(' + C.label + ') = ' + lsSubst(node, C) + ' = <b>' + lsFull(v) + '</b>.'
          : lsP(node) + ' üznüksiz, x = ' + C.label + ' goýýarys: ' + lsSubst(node, C) + ' = <b>' + lsFull(v) + '</b>.');
        return v;
      }
      if((cl === true && cr === 'nan') || (cl === 'nan' && cr === true)){
        const s = cl === true ? -1 : 1;
        steps.push((depth === 0 ? 'f(' + C.label + ') = ' : lsP(node) + ': x = ' + C.label + ' goýsak ') + lsSubst(node, C) + ' = ' + lsVal(v) + ', ýöne funksiýa x = ' + C.label + ' nokadyň ' + (s > 0 ? 'çep' : 'sag') + ' tarapynda kesgitlenmedik (kesgitleniş ýaýlasynyň çägi).');
        steps.push('Diňe ' + (s > 0 ? 'sag' : 'çep') + ' limit bar: lim(x→' + C.label + (s > 0 ? '⁺' : '⁻') + ') = <b>' + lsFull(v) + '</b>.');
        return {side: s, v};
      }
    }
  } else {
    const R = ratCoeffs(node);
    if(R) return lsRatInf(R, C, steps);
  }
  let r;
  if(!C.s){ r = lsAbsSplit(node, C, steps, depth); if(r !== undefined) return lsDomain(r, f, C, steps); }
  if(node.type === 'OperatorNode'){
    if(node.fn === 'divide') r = lsQuot(node.args[0], node.args[1], C, steps, depth, 0);
    else if(node.fn === 'add' || node.fn === 'subtract') r = lsSum(node, C, steps, depth);
    else if(node.fn === 'multiply') r = lsProd(node, C, steps, depth);
    else if(node.fn === 'pow') r = lsPow(node, C, steps, depth);
    else if(node.fn === 'unaryMinus') r = lsNegate(node, C, steps, depth);
  } else if(node.type === 'FunctionNode') r = lsFunc(node, C, steps, depth);
  if(r === undefined || r === null){ const o = lsOsc(node, C, steps); if(o !== undefined) return o; }
  if(r === undefined) r = null;
  return C.s ? r : lsDomain(r, f, C, steps);
}

/* Esasy: node — f(x), a — san ýa-da ±Infinity, label — a-nyň ýazgysy (π/2 ýaly), aNode — a-nyň math.js düwüni (goýmagy görkezmek üçin).
   Gaýtarýar {steps: [html], value} */
function limitSteps(node, a, label, aNode){
  const steps = [], C = {a: isFinite(a) ? a : 0, s: isFinite(a) ? 0 : (a > 0 ? 1 : -1), label, aNode: aNode || null};
  let value = null;
  try{ value = lsSolve(node, C, steps, 0); }catch(e){ value = null; }
  if(value === undefined || (typeof value === 'number' && isNaN(value))) value = null;
  if(value === null) steps.push(steps.length ? 'Algebraik usul bilen jogaba çenli ýetip bolmady — netije aşakdaky san barlagyndan alynýar.' : 'Bu aňlatma üçin ýönekeý algebraik usul tapylmady — limit aşakdaky san barlagy bilen tapylýar.');
  return {steps, value};
}

/* ===== ai-engine.js ===== */
const ENGINE_CONSTS = ['e', 'pi', 'E', 'PI', 'i', 'Infinity'];

/* aňlatmany okamak: diňe x üýtgeýjisi (we e, π) rugsat */
function engineParse(expr){
  const src = String(expr == null ? '' : expr).trim();
  if(!src) throw new Error('Aňlatma boş.');
  if(src.length > 400) throw new Error('Aňlatma örän uzyn.');
  let node;
  try{ node = math.parse(prep(src)); }catch(e){ throw new Error('Aňlatmany okap bolmady: ' + e.message); }
  const bad = [];
  node.traverse((n, path) => {
    if(n.type === 'SymbolNode' && path !== 'fn' && n.name !== 'x' && ENGINE_CONSTS.indexOf(n.name) === -1 && bad.indexOf(n.name) === -1) bad.push(n.name);
  });
  if(bad.length) throw new Error('Diňe x üýtgeýjisi goldanýar (näbelli: ' + bad.join(', ') + ').');
  return node;
}

function engineFail(task, err){
  return {ok: false, task, title: '', answer: '', answerText: '', steps: [], check: {status: 'none', text: ''}, error: String(err && err.message || err)};
}

/* lim x→a f(x): algebraik ädimler + san barlagy (çep we sag tarapdan ýakynlaşma) */
function engineLimit(expr, point){
  const node = engineParse(expr);
  const fFn = node.compile(), evalAt = x => fFn.evaluate({x});
  const aRaw = String(point == null ? '' : point).trim();
  const a = parseBound(aRaw);
  if(typeof a !== 'number' || isNaN(a)) throw new Error('Nokat san ýa-da inf / -inf bolmaly.');
  let aNode = null;
  if(isFinite(a)){ try{ aNode = math.parse(prep(aRaw).trim().toLowerCase()); }catch(e){ aNode = null; } }
  const where = !isFinite(a) ? (a > 0 ? '+∞' : '−∞') : aNode ? prettyNode(aNode) : fmt(a);
  const S = limitSteps(node, a, where, aNode);
  let num;
  if(!isFinite(a)){
    const sign = a > 0 ? 1 : -1, vals = [10, 100, 1000, 10000, 100000].map(x => safeEval(evalAt, sign*x));
    const c = classify(vals);
    num = c.t === 'val' ? {k: 'val', v: c.v} : c.t === 'inf' ? {k: 'inf', s: c.s} : {k: '?'};
  } else {
    const hs = [0.1, 0.01, 0.001, 0.0001, 0.00001];
    num = numOutcome(classify(hs.map(h => safeEval(evalAt, a - h))), classify(hs.map(h => safeEval(evalAt, a + h))));
  }
  const ok = limAgree(S.value, num);
  const numText = num.k === 'val' ? '≈ ' + fmt(num.v) : num.k === 'inf' ? (num.s > 0 ? '+∞' : '−∞') : num.k === 'none' ? 'limit ýok' : num.k === 'one' ? (num.side > 0 ? 'diňe sag' : 'diňe çep') + ' tarapdan ' + fmt(num.v) : 'anyklanmady';
  let answer = S.value !== null ? limitValStr(S.value) : numText;
  let check;
  if(ok === true) check = {status: 'ok', text: 'San barlagy (x-i ' + where + ' nokada ýakynlaşdyryp) şu jogaby tassyklaýar.'};
  else if(ok === false){ check = {status: 'warn', text: 'Algebraik jogap san barlagy bilen gabat gelmedi; san barlagy: ' + numText + '.'}; answer = numText; }
  else check = {status: 'none', text: S.value === null ? 'Algebraik usul tapylmady — jogap san barlagyndan alyndy: ' + numText + '.' : 'San barlagy bu ýerde durnuksyz.'};
  return {ok: S.value !== null || num.k !== '?', task: 'limit', title: 'lim<sub>x→' + where + '</sub> ' + prettyNode(node), answer, answerText: answer, steps: S.steps, check};
}

/* f′(x): düzgünler bilen ädimme-ädim, math.js-iň önümi bilen san taýdan barlanýar */
function engineDerivative(expr){
  const node = engineParse(expr);
  const r = derivSteps(node);
  let check = {status: 'none', text: ''};
  try{
    const ref = math.derivative(node, 'x').compile(), mine = r.d.compile();
    let n = 0, bad = 0;
    [0.37, 1.21, 2.53, -0.83, 3.7].forEach(x => {
      const u = safeEval(t => ref.evaluate({x: t}), x), w = safeEval(t => mine.evaluate({x: t}), x);
      if(!isFinite(u) || !isFinite(w)) return;
      n++; if(Math.abs(u - w) > 1e-7*Math.max(1, Math.abs(u))) bad++;
    });
    if(n >= 2) check = bad ? {status: 'warn', text: 'San barlagynda tapawut tapyldy — jogaby täzeden barlaň.'} : {status: 'ok', text: 'Önüm birnäçe nokatda san taýdan barlandy.'};
  }catch(e){ /* barlag mümkin däl */ }
  return {ok: true, task: 'derivative', title: '(' + prettyNode(node) + ')′', answer: derivPretty(r.d), answerText: r.d.toString(), steps: r.steps, check};
}

/* ∫ f(x) dx (a, b berlen bolsa kesgitli integral): usul saýlamak, ädimler, F′ = f barlagy, Nýuton–Leýbnis + Simpson */
function engineIntegral(expr, lower, upper){
  const node = engineParse(expr);
  const IS = integrateSteps(node);
  const hasBounds = lower != null && String(lower).trim() !== '' && upper != null && String(upper).trim() !== '';
  const nonEl = !IS.F && integralNonElementary(node);
  if(!hasBounds){
    if(!IS.F) return {ok: false, task: 'integral', title: '∫ ' + prettyNode(node) + ' dx', answer: '', answerText: '', steps: [],
      check: {status: 'none', text: nonEl ? 'Bu funksiýanyň antiwönümi elementar funksiýalar bilen aňladylmaýar.' : 'Motor bu integral üçin usul tapmady.'}};
    return {ok: true, task: 'integral', title: '∫ ' + prettyNode(node) + ' dx', answer: integralPretty(IS.F) + ' + C', answerText: IS.F.toString() + ' + C',
      steps: IS.steps, check: {status: 'ok', text: 'F′(x) = f(x) barlandy (usul: ' + IS.method + ').'}};
  }
  const a = parseBound(String(lower)), b = parseBound(String(upper));
  if(!isFinite(a) || !isFinite(b)) throw new Error('Çäkler anyk san bolmaly (çäksiz çäkli integral goldanmaýar).');
  const fFn = node.compile(), f = x => safeEval(t => fFn.evaluate({x: t}), x);
  const numVal = simpson(f, a, b, 2000);
  const title = '∫<sub>' + fmtNice(a) + '</sub><sup>' + fmtNice(b) + '</sup> ' + prettyNode(node) + ' dx';
  if(!isFinite(numVal)) return {ok: false, task: 'definite_integral', title, answer: '', answerText: '', steps: [], check: {status: 'warn', text: 'Funksiýa [a, b] aralykda kesgitlenmedik ýa-da üzülýär — integral ynamly hasaplanmady.'}};
  if(IS.F){
    const Ff = IS.F.compile(), Fa = Ff.evaluate({x: a}), Fb = Ff.evaluate({x: b}), exact = Fb - Fa;
    if(typeof exact === 'number' && isFinite(exact) && Math.abs(exact - numVal) <= 1e-6*Math.max(1, Math.abs(numVal))){
      const steps = IS.steps.concat(['<b>Nýuton–Leýbnis</b>: F(' + fmtNice(b) + ') − F(' + fmtNice(a) + ') = ' + fmtNice(Fb) + ' − (' + fmtNice(Fa) + ') = <b>' + fmtNice(exact) + '</b>.']);
      return {ok: true, task: 'definite_integral', title, answer: fmtNice(exact) + (/^[−-]?\d+$/.test(fmtNice(exact)) ? '' : ' ≈ ' + fmt(exact)), answerText: fmtNice(exact) + ' ≈ ' + fmt(exact),
        steps, check: {status: 'ok', text: 'San usuly (Simpson, n = 2000) bilen barlandy: ' + fmt(numVal) + '.'}};
    }
  }
  return {ok: true, task: 'definite_integral', title, answer: '≈ ' + fmt(numVal), answerText: '≈ ' + fmt(numVal), steps: [],
    check: {status: 'none', text: (nonEl ? 'Antiwönüm elementar däl — ' : '') + 'netije san usuly (Simpson, n = 2000) bilen tapyldy.'}};
}

window.AmatlyEngine = {
  version: 1,
  /* task: 'limit' | 'derivative' | 'integral' | 'definite_integral'; i: {expression, point, lower, upper} */
  run(task, i){
    i = i || {};
    try{
      if(task === 'limit') return engineLimit(i.expression, i.point);
      if(task === 'derivative') return engineDerivative(i.expression);
      if(task === 'integral') return engineIntegral(i.expression);
      if(task === 'definite_integral') return engineIntegral(i.expression, i.lower, i.upper);
      return engineFail(task, 'Näbelli mesele görnüşi: ' + task);
    }catch(e){ return engineFail(task, e); }
  }
};

})();
