/*!
 * Amatly.com — Kalkulus bölümi
 * Giriş nokady: kalkulýatorlary sahypa üçin window-a çykarýar we sahypa ulgamyny (test, ösüş, mysallar, grafikleriň temasy) işledýär.
 * Saýtyň umumy bölekleri (menýu, gözleg, tema) assets/nav/ faýllarynda — olary saýtyň özi ýükleýär (components/layout.html).
 * Modullar (src/scripts/modules/): core — matematika ýadrosy, solvers — ädimme-ädim çözüjiler, graphs — grafikler,
 * calculators — sahypadaky kalkulýator kartlary, ui — sahypa interfeýsi (README: "Arhitektura").
 * math.js (mathjs.org) kitaphanasyna daýanýar: sahypada oňa çenli saýtyň umumy assets/vendor/math.js faýly ýüklenmeli
 * (sahypanyň front-matter-ine "math: true" ýazylanda build özi goşýar).
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

/* ===== modules/core/analysis.js ===== */
/* Funksiýanyň san derňewi: kökler, alamat aralyklary, üzülmeler, aýrylýan üzülmeleri dikeltmek (removable),
   önüm funksiýasy (derivativeFn: simwolik, başartmasa merkezi tapawut). */

/* funksiýanyň [a,b] aralykdaky üzülmesini (polýus, bökme) takmynan tapýar: tapylsa x gaýtarýar, tapylmasa null */
function findJump(f, a, b){
  const N = 1200, v = [], xs = [];
  for(let i=0; i<=N; i++){ const x = a + (b-a)*i/N; xs.push(x); v.push(safeEval(f, x)); }
  for(let i=0; i<=N; i++) if(!isFinite(v[i])) return xs[i];
  const mags = v.map(Math.abs).sort((p,q) => p-q), med = mags[Math.floor(N/2)];
  const d = i => Math.abs(v[i] - v[i-1]);
  for(let i=2; i<N; i++){
    const di = d(i), nb = Math.max(d(i-1), d(i+1), 1e-12), m = Math.min(Math.abs(v[i-1]), Math.abs(v[i]));
    if(di > 100*nb && di > 1e-3*Math.max(1, Math.abs(v[i]))) return (xs[i-1] + xs[i])/2;                    // bökme
    if(v[i-1]*v[i] < 0 && m > 4*med && m > 1e-9 && Math.abs(v[i-1]) > 1.2*Math.abs(v[i-2]) && Math.abs(v[i]) > 1.2*Math.abs(v[i+1]))
      return (xs[i-1] + xs[i])/2;                                                                            // polýus (alamat çalşýar, bahalar çäksizlige ösýär)
  }
  return null;
}

/* [a,b] kesimde f(x) = 0 deňlemäniň köküni bisection usuly bilen takyklaýar (f(a)·f(b) < 0 bolmaly) */
function bisect(f, a, b, tol, maxIter){
  let lo = a, hi = b, flo = f(lo);
  for(let k = 0; k < (maxIter || 200) && (hi - lo) > (tol || 1e-12); k++){
    const mid = (lo + hi)/2, fm = f(mid);
    if(fm === 0) return mid;
    if(flo*fm < 0){ hi = mid; } else { lo = mid; flo = fm; }
  }
  return (lo + hi)/2;
}

/* [a,b] aralykda alamat çalşýan g üçin kök / bökme / polýus kesgitleýär: {x, jump} ýa-da null (polýus) */
function bracketRoot(g, a, b, fa, fb){
  let lo = a, hi = b, flo = fa, undef = false;
  for(let k=0; k<60; k++){
    const mid = (lo+hi)/2, fm = g(mid);
    if(!isFinite(fm)){ undef = true; lo = hi = mid; break; }
    if(flo*fm <= 0){ hi = mid; } else { lo = mid; flo = fm; }
  }
  const x = (lo+hi)/2, ref = Math.max(1, Math.abs(fa), Math.abs(fb)), d = (b-a)*1e-6;
  if(undef){                                                        // g(x) kesgitlenmedik — kök, bökme ýa-da polýus?
    const gl = g(x-d), gr = g(x+d);
    if(!isFinite(gl) || !isFinite(gr)) return null;
    if(Math.abs(gl) <= 1e-6*ref && Math.abs(gr) <= 1e-6*ref) return {x, jump:false};
    return (Math.abs(gl) <= 10*ref && Math.abs(gr) <= 10*ref) ? {x, jump:true} : null;
  }
  const gx = g(x);
  if(isFinite(gx) && Math.abs(gx) <= 1e-7*ref) return {x, jump:false};     // hakyky nol
  if(isFinite(gx) && Math.abs(gx) <= 10*ref) return {x, jump:true};        // bökme (burç nokady)
  return null;                                                              // polýus
}

/* g funksiýasynyň [xMin,xMax] aralykdaky nollaryny tapýar: alamat çalşýan we galtaşýan (x^3 ýaly) kökler, üzülme (burç) nokatlary. Polýuslar taşlanýar. */
function findRoots(g, xMin, xMax){
  const N = 600, xs = [], vs = [];
  for(let i=0; i<=N; i++){ xs.push(xMin + (xMax-xMin)*i/N); vs.push(g(xs[i])); }
  if(vs.filter(v => v === 0).length > N/2) return [];          // hemişe nol (hemişelik funksiýa)
  let scale = 0; vs.forEach(v => { if(isFinite(v)) scale = Math.max(scale, Math.abs(v)); });
  const tol = 1e-9*Math.max(scale, 1), roots = [], valid = [];
  for(let i=0; i<=N; i++) if(isFinite(vs[i])) valid.push(i);
  for(let k=0; k<valid.length-1; k++){
    const ia = valid[k], ib = valid[k+1];
    if(ib - ia > 2) continue;                                   // ikiden köp kesgitlenmedik nokat — baglanyşyk ýok
    const fa = vs[ia], fb = vs[ib];
    if(fa === 0){ roots.push({x:xs[ia], jump:false}); continue; }
    if(fa*fb < 0){ const r = bracketRoot(g, xs[ia], xs[ib], fa, fb); if(r) roots.push(r); }
  }
  if(vs[N] === 0) roots.push({x:xs[N], jump:false});
  for(let i=1; i<N; i++){                                          // galtaşýan kökler (alamat çalyşmaýar)
    const v0 = vs[i-1], v1 = vs[i], v2 = vs[i+1];
    if(!isFinite(v0) || !isFinite(v1) || !isFinite(v2)) continue;
    const m1 = Math.abs(v1);
    if(m1 > 0 && m1 <= Math.abs(v0) && m1 <= Math.abs(v2) && v0*v2 >= 0){
      let lo = xs[i-1], hi = xs[i+1];
      for(let k=0; k<80; k++){
        const p = lo + (hi-lo)/3, q = hi - (hi-lo)/3;
        if(Math.abs(g(p)) < Math.abs(g(q))) hi = q; else lo = p;
      }
      const xr = (lo+hi)/2, gr = g(xr);
      if(isFinite(gr) && Math.abs(gr) <= tol) roots.push({x:xr, jump:false});
    }
  }
  roots.sort((u,v) => u.x - v.x);
  const out = [];
  roots.forEach(r => { if(!out.length || Math.abs(r.x - out[out.length-1].x) > 1e-4*(xMax-xMin)) out.push(r); });
  return out;
}

/* g-iň alamaty boýunça aralyklary bölýär we yzyna gabat gelýän bir alamatly bölekleri birleşdirýär */
function signRuns(g, edges){
  const runs = [];
  for(let i=0; i<edges.length-1; i++){
    const lo = edges[i], hi = edges[i+1];
    if(!(hi - lo > 0)) continue;
    const m = g((lo+hi)/2), s = isNaN(m) ? NaN : (m > 1e-12 ? 1 : m < -1e-12 ? -1 : 0);
    const last = runs[runs.length-1];
    if(last && !isNaN(s) && last.s === s) last.to = hi; else runs.push({from:lo, to:hi, s});
  }
  return runs;
}

/* aýrylýan üzülmeleri (0/0 ýaly) goňşy bahalar boýunça dikeldýär: sin(x)/x ýaly funksiýalar x = 0-da hem hasaplanýar */
function removable(f){
  return function(x){
    const y = f(x);
    if(isFinite(y)) return y;
    const d = 1e-7*(1 + Math.abs(x)), d2 = 1e-4*(1 + Math.abs(x));
    const l = safeEval(f, x - d), r = safeEval(f, x + d), l2 = safeEval(f, x - d2), r2 = safeEval(f, x + d2);
    if(isFinite(l) && isFinite(r) && isFinite(l2) && isFinite(r2) && Math.abs(l) < 1e8 &&
       Math.abs(l - r) < 1e-4*Math.max(1, Math.abs(l)) && Math.abs(l - l2) < 1e-2*Math.max(1, Math.abs(l)) && Math.abs(r - r2) < 1e-2*Math.max(1, Math.abs(r))) return (l + r)/2;
    return y;
  };
}

/* f(x) aňlatmasynyň önümi (x boýunça): simwol usuly; başartmasa merkezi tapawut */
function derivativeFn(node){
  try{
    const d = math.derivative(node, 'x').compile();
    return x => safeEval(xx => d.evaluate({x:xx}), x);
  }catch(e){
    const f = node.compile(), g = x => safeEval(xx => f.evaluate({x:xx}), x);
    return x => { const h = 1e-6*Math.max(1, Math.abs(x)); return (g(x + h) - g(x - h))/(2*h); };
  }
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

/* ===== modules/graphs/palette.js ===== */
/* Grafikleriň reňkleri açyk we gara tema üçin. Saýtyň tema düwmesi / Sazlamalar sahypasy <html data-theme="dark|light"> goýýar
   (assets/nav/theme.js). Kömekçi reňkler (fon, gözenek, oklar, ýazgylar, legenda) temadan alynýar; kalkulýatorlaryň
   maglumat reňkleriniň gara fonda görünmeýänleri (gara, goýy gök, goýy sary ...) themeColor() bilen açyk reňke çalşylýar.
   Açyk temada ähli reňkler öňküsi ýaly galýar (grafikler pikseli-pikseline öňki ýaly). */

const GRAPH_LIGHT = {
  bg: '#fff', grid: '#ececec', axis: '#8a8a8a', frame: '#c7c7c7', tick: '#666', label: '#444',
  legendBg: 'rgba(255,255,255,.88)', legendLine: '#d5d5d5', legendText: '#222',
  ring: '#fff', halo: 'rgba(255,255,255,.9)', undef: [232, 232, 232],
  heatAxis: 'rgba(60,60,60,.55)', level: 'rgba(30,30,30,.38)', levelZero: 'rgba(20,20,20,.75)',
  floor: '#f6f8fb', floorLine: '#c7c7c7', floorGrid: '#e3e6ea', zAxis: '#a9a9a9', mesh: '25,35,55',
  seq: ['#e3effc', '#b7d3f6', '#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#184f95'],
  div: ['#184f95', '#3987e5', '#86b6ef', '#f0efec', '#eba08f', '#d65a43', '#a8261c']
};

const GRAPH_DARK = {
  bg: '#121a26', grid: '#222c3b', axis: '#6f7d93', frame: '#33415a', tick: '#93a1b7', label: '#c6d0e2',
  legendBg: 'rgba(18,26,38,.9)', legendLine: '#33415a', legendText: '#e3e9f3',
  ring: '#121a26', halo: 'rgba(18,26,38,.9)', undef: [42, 50, 64],
  heatAxis: 'rgba(220,228,240,.5)', level: 'rgba(225,232,245,.3)', levelZero: 'rgba(240,244,250,.75)',
  floor: '#172131', floorLine: '#3a475c', floorGrid: '#243042', zAxis: '#6f7d93', mesh: '8,14,24',
  seq: ['#1e3f6e', '#24518a', '#2d64a8', '#3b7ac4', '#5292da', '#73abeb', '#a6cbf6'],
  div: ['#8cbaf2', '#4a88d6', '#2a4f80', '#2c333f', '#83392d', '#d4604a', '#f2a08b']
};

/* Gara fonda pes kontrastly maglumat reňkleri → açyk görnüşi (açar: kiçi harp, boşluksyz) */
const DARK_DATA_COLORS = {
  '#222': '#e8edf5', '#154a92': '#6fa4ec', '#8a6d00': '#d6b74a', '#a8261c': '#ea7462',
  '#b3261e': '#ef6c5e', '#6250d6': '#9587f0'
};

/* rgba(...) görnüşindäki reňkler üçin (aýdyňlyk saklanýar) */
const DARK_DATA_RGB = { '21,74,146': '111,164,236', '150,40,25': '234,116,98' };

let _graphPrinting = false;

/* Çap edilýän wagty grafikler hemişe açyk temada çyzylýar (kagyz ak) — plot.js: beforeprint / afterprint */
function setGraphPrinting(on){ _graphPrinting = !!on; }

function graphDark(){
  return !_graphPrinting && typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
}

function graphPalette(){ return graphDark() ? GRAPH_DARK : GRAPH_LIGHT; }

/* Kalkulýatoryň beren reňki: gara temada pes kontrastly bolsa açyk görnüşi, beýle bolmasa özi */
function themeColor(c){
  if(typeof c !== 'string' || !graphDark()) return c;
  const k = c.toLowerCase().replace(/\s+/g, '');
  if(DARK_DATA_COLORS[k]) return DARK_DATA_COLORS[k];
  const m = /^rgba?\((\d+),(\d+),(\d+)(,[\d.]+)?\)$/.exec(k), rgb = m && DARK_DATA_RGB[m[1] + ',' + m[2] + ',' + m[3]];
  return rgb ? 'rgba(' + rgb + (m[4] || ',1') + ')' : c;
}

/* Tema çalşylanda netije gutularyndaky legenda nokatlaryny (.dot) täze reňke geçirýär */
function _rgbKey(css){
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css || '');
  if(m) return m[1] + ',' + m[2] + ',' + m[3];
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(css || '');
  if(!h) return '';
  const s = h[1].length === 3 ? h[1].replace(/./g, '$&$&') : h[1], n = parseInt(s, 16);
  return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
}

function swapDotColors(root){
  const dark = graphDark(), pairs = Object.keys(DARK_DATA_COLORS).map(k => [_rgbKey(k), DARK_DATA_COLORS[k]]);
  (root || document).querySelectorAll('.dot[style]').forEach(el => {
    const key = _rgbKey(el.style.backgroundColor);
    pairs.forEach(([lightKey, darkHex]) => {
      if(dark && key === lightKey) el.style.backgroundColor = darkHex;
      else if(!dark && key === _rgbKey(darkHex)) el.style.backgroundColor = Object.keys(DARK_DATA_COLORS).find(k => DARK_DATA_COLORS[k] === darkHex);
    });
  });
}

/* ===== modules/graphs/plot.js ===== */
/* Umumy grafik gurallary: okalýan belgiler, bölünen çyzyklar, nokatlar, legenda.
   Reňkler graphs/palette.js-den: açyk we gara tema (tema çalşylanda grafikler täzeden çyzylýar — initPlotTheme). */

const PLOT_FONT = '11px Arial, Helvetica, sans-serif';

function niceTicks(min, max, target){
  const span = max - min;
  if(!(span > 0) || !isFinite(span)) return [];
  const raw = span / Math.max(2, target || 6), mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag, out = [];
  for(let t = Math.ceil(min/step - 1e-9); t*step <= max + 1e-9*step; t++){
    const v = t*step; out.push(Math.abs(v) < 1e-12*step ? 0 : Number(v.toPrecision(12)));
  }
  return out;
}

function tickLabel(v){
  if(v === 0) return '0';
  const a = Math.abs(v);
  return (a >= 1e6 || a < 1e-3) ? Number(v.toPrecision(3)).toExponential().replace('e+','e') : String(Number(v.toPrecision(6)));
}

/* Kanwany taýýarlaýar (HiDPI + giňlige görä), koordinata ulgamyny we kömekçi çyzgylary gaýtarýar */
function makePlot(canvasId, xMin, xMax, yMin, yMax, redraw, o){
  o = o || {};
  const canvas = document.getElementById(canvasId);
  if(!canvas) throw new Error('canvas tapylmady: ' + canvasId);
  const w0 = canvas._w0 || (canvas._w0 = canvas.width), h0 = canvas._h0 || (canvas._h0 = canvas.height);
  canvas.style.width = '100%'; canvas.style.maxWidth = w0 + 'px'; canvas.style.height = 'auto';
  const rw = canvas.getBoundingClientRect().width;
  const cssW = Math.round(rw > 40 ? Math.min(rw, w0) : w0);
  const cssH = Math.round(Math.min(h0, Math.max(cssW*h0/w0, 0.6*cssW)));
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(cssW*dpr); canvas.height = Math.round(cssH*dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,cssW,cssH);
  canvas._redraw = redraw || null;
  const L = o.noLabels ? 8 : 46, R = 16, T = 10, B = o.noLabels ? 8 : 24, pw = cssW - L - R, ph = cssH - T - B;
  if(o.equal === 'fit'){                                                  // deň masştab, ähli gönüburçluk görünýär
    const k = Math.max((xMax - xMin)/pw, (yMax - yMin)/ph), mx = (xMin + xMax)/2, my = (yMin + yMax)/2;
    xMin = mx - k*pw/2; xMax = mx + k*pw/2; yMin = my - k*ph/2; yMax = my + k*ph/2;
  } else if(o.equal){ const k = (xMax - xMin)/pw, mid = (yMin + yMax)/2; yMin = mid - k*ph/2; yMax = mid + k*ph/2; }   // x we y üçin deň masştab
  const P = {canvas, ctx, W:cssW, H:cssH, L, R, T, B, pw, ph, xMin, xMax, yMin, yMax,
    X: x => L + (x-xMin)/(xMax-xMin)*pw,
    Y: y => T + (1-(y-yMin)/(yMax-yMin))*ph};
  const pal = graphPalette();
  P.pal = pal;
  P.axes = function(){
    const xt = niceTicks(xMin, xMax, Math.max(3, Math.floor(pw/80))).filter(t => !o.xInt || Number.isInteger(t)), yt = niceTicks(yMin, yMax, Math.max(3, Math.floor(ph/36)));
    ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = pal.grid; ctx.beginPath();
    xt.forEach(t => { const x = Math.round(P.X(t)) + .5; ctx.moveTo(x,T); ctx.lineTo(x,T+ph); });
    yt.forEach(t => { const y = Math.round(P.Y(t)) + .5; ctx.moveTo(L,y); ctx.lineTo(L+pw,y); });
    ctx.stroke();
    ctx.strokeStyle = pal.axis; ctx.beginPath();
    if(yMin < 0 && yMax > 0){ const y = Math.round(P.Y(0)) + .5; ctx.moveTo(L,y); ctx.lineTo(L+pw,y); }
    if(xMin < 0 && xMax > 0){ const x = Math.round(P.X(0)) + .5; ctx.moveTo(x,T); ctx.lineTo(x,T+ph); }
    ctx.stroke();
    ctx.strokeStyle = pal.frame; ctx.strokeRect(L+.5, T+.5, pw-1, ph-1);
    if(!o.noLabels){
      ctx.font = PLOT_FONT; ctx.fillStyle = pal.tick;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; xt.forEach(t => ctx.fillText(tickLabel(t), P.X(t), T+ph+5));
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; yt.forEach(t => ctx.fillText(tickLabel(t), L-6, P.Y(t)));
    }
    ctx.restore();
  };
  canvas._P = P;   // kursoryň astyndaky bahany hasaplamak üçin (bindReadout)
  P.clip = function(){ ctx.save(); ctx.beginPath(); ctx.rect(L, T, pw, ph); ctx.clip(); };
  P.unclip = function(){ ctx.restore(); };
  P.vline = function(x, color, dash){
    if(!isFinite(x) || x < xMin || x > xMax) return;
    ctx.save(); ctx.strokeStyle = themeColor(color || '#b3261e'); ctx.lineWidth = 1; ctx.setLineDash(dash || [4,3]);
    ctx.beginPath(); ctx.moveTo(P.X(x), T); ctx.lineTo(P.X(x), T+ph); ctx.stroke(); ctx.restore();
  };
  P.hline = function(y, color, dash){
    if(!isFinite(y) || y < yMin || y > yMax) return;
    ctx.save(); ctx.strokeStyle = themeColor(color || '#b3261e'); ctx.lineWidth = 1; ctx.setLineDash(dash || [4,3]);
    ctx.beginPath(); ctx.moveTo(L, P.Y(y)); ctx.lineTo(L+pw, P.Y(y)); ctx.stroke(); ctx.restore();
  };
  P.seg = function(x1, y1, x2, y2, color, dash, width){
    if(![x1,y1,x2,y2].every(isFinite)) return;
    ctx.save(); ctx.strokeStyle = themeColor(color || '#3a9a3a'); ctx.lineWidth = width || 1.6; ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(P.X(x1), P.Y(y1)); ctx.lineTo(P.X(x2), P.Y(y2)); ctx.stroke(); ctx.restore();
  };
  P.dot = function(x, y, color, d){
    if(!isFinite(x) || !isFinite(y)) return;
    d = d || {};
    color = themeColor(color);
    const px = P.X(x), py = P.Y(y);
    ctx.save(); ctx.beginPath(); ctx.arc(px, py, 4.5, 0, 2*Math.PI);
    ctx.fillStyle = d.hole ? pal.bg : color; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = d.hole ? color : pal.ring; ctx.stroke();
    if(d.label){
      ctx.font = 'bold 11px Arial, Helvetica, sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center';
      const above = py - 9 > T + 12;
      ctx.textBaseline = above ? 'bottom' : 'top';
      ctx.fillText(d.label, px, above ? py - 8 : py + 8);
    }
    ctx.restore();
  };
  P.legend = function(items, pos){
    if(!items || !items.length) return;
    ctx.save(); ctx.font = '12px Arial, Helvetica, sans-serif';
    let w = 0; items.forEach(it => { w = Math.max(w, ctx.measureText(it.label).width); });
    const bw = w + 40, bh = items.length*17 + 8;
    if(Array.isArray(pos)){                     // pos — gaçylmaly nokatlar [[px, py], ...]: iň az nokat düşýän burç saýlanýar
      const box = c => ({x: (c === 'tr' || c === 'br') ? L + pw - bw - 8 : L + 8, y: (c === 'bl' || c === 'br') ? T + ph - bh - 8 : T + 8});
      const hits = c => { const b = box(c); return pos.filter(p => p[0] >= b.x - 4 && p[0] <= b.x + bw + 4 && p[1] >= b.y - 4 && p[1] <= b.y + bh + 4).length; };
      pos = ['tl', 'tr', 'br', 'bl'].reduce((p, q) => hits(q) < hits(p) ? q : p, 'tl');
    }
    const bx = (pos === 'tr' || pos === 'br') ? L + pw - bw - 8 : L + 8, by = (pos === 'bl' || pos === 'br') ? T + ph - bh - 8 : T + 8;
    ctx.fillStyle = pal.legendBg; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = pal.legendLine; ctx.lineWidth = 1; ctx.strokeRect(bx+.5, by+.5, bw-1, bh-1);
    items.forEach((it, i) => {
      const cy = by + 4 + i*17 + 8.5;
      ctx.strokeStyle = themeColor(it.color); ctx.lineWidth = 2; ctx.setLineDash(it.dash || []);
      ctx.beginPath(); ctx.moveTo(bx+7, cy); ctx.lineTo(bx+27, cy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = pal.legendText; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(it.label, bx+33, cy);
    });
    ctx.restore();
  };
  return P;
}

/* y aralygyny saýlaýar: aşa uly bahalar (asimptota) grafigi ezmez */
function autoYRange(ys){
  if(!ys.length) return [-1, 1];
  ys.sort((p,q) => p-q);
  let lo = ys[0], hi = ys[ys.length-1];
  const at = f => ys[Math.min(ys.length-1, Math.max(0, Math.round(f*(ys.length-1))))];
  const p5 = at(0.05), p95 = at(0.95), span = p95 - p5;
  if(ys.length > 20 && span > 0 && (hi-lo) > 8*span){ lo = Math.max(lo, p5 - 0.6*span); hi = Math.min(hi, p95 + 0.6*span); }
  if(hi - lo < 1e-9){ lo -= 1; hi += 1; }
  const pad = (hi-lo)*0.1;
  return [lo - pad, hi + pad];
}

/* fns: [{fn,color,label?,dash?,width?}]  opts: {markX, markY, fillBetween:{a,b,lower?,colors?}, points:[{x,y,color,label}], holes:[{x,y,color}], segments:[{x1,y1,x2,y2,color,dash,width}], yRange:[lo,hi], legend:[{label,color,dash}]} */
function plotFunctions(canvasId, fns, xMin, xMax, opts){
  opts = opts || {};
  const N = 440, xs = [];
  for(let i=0; i<=N; i++) xs.push(xMin + (xMax-xMin)*i/N);
  const series = fns.map(fo => xs.map(x => safeEval(fo.fn, x)));
  const ys = [];
  series.forEach(s => s.forEach(y => { if(isFinite(y)) ys.push(y); }));
  (opts.points || []).concat(opts.holes || []).forEach(p => { if(isFinite(p.y)) ys.push(p.y); });
  (opts.segments || []).forEach(g => { if(isFinite(g.y1)) ys.push(g.y1); if(isFinite(g.y2)) ys.push(g.y2); });
  const yr = opts.yRange || autoYRange(ys), yMin = yr[0], yMax = yr[1];
  const P = makePlot(canvasId, xMin, xMax, yMin, yMax, () => plotFunctions(canvasId, fns, xMin, xMax, opts));
  const ctx = P.ctx;
  P.axes();
  P.clip();
  if(opts.fillBetween){
    const fb = opts.fillBetween, up = fns[0].fn, lo = fb.lower || (() => 0), M = 300;
    const cols = fb.colors || ['rgba(47,119,201,0.28)', 'rgba(201,67,47,0.28)'];
    const pos = new Path2D(), neg = new Path2D();
    let prev = null;
    for(let i=0; i<=M; i++){
      const x = fb.a + (fb.b-fb.a)*i/M, u = safeEval(up, x), l = safeEval(lo, x);
      const cur = {x, u: isFinite(u) ? u : 0, l: isFinite(l) ? l : 0};
      if(prev){
        const path = ((prev.u + cur.u) - (prev.l + cur.l)) >= 0 ? pos : neg;
        path.moveTo(P.X(prev.x), P.Y(prev.u)); path.lineTo(P.X(cur.x), P.Y(cur.u));
        path.lineTo(P.X(cur.x), P.Y(cur.l)); path.lineTo(P.X(prev.x), P.Y(prev.l)); path.closePath();
      }
      prev = cur;
    }
    ctx.fillStyle = themeColor(cols[0]); ctx.fill(pos);
    ctx.fillStyle = themeColor(cols[1]); ctx.fill(neg);
    P.vline(fb.a, '#7a9cc8', [3,3]); P.vline(fb.b, '#7a9cc8', [3,3]);
  }
  const jumpTol = 0.8*(yMax - yMin);
  fns.forEach((fo, idx) => {
    ctx.save();
    ctx.strokeStyle = themeColor(fo.color); ctx.lineWidth = fo.width || 2; ctx.setLineDash(fo.dash || []); ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false, prevY = 0;
    xs.forEach((x, i) => {
      const y = series[idx][i];
      if(!isFinite(y)){ started = false; return; }
      if(started && Math.abs(y - prevY) > jumpTol) started = false;
      const px = P.X(x), py = P.Y(y);
      if(!started){ ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      prevY = y;
    });
    ctx.stroke(); ctx.restore();
  });
  (opts.segments || []).forEach(g => P.seg(g.x1, g.y1, g.x2, g.y2, g.color, g.dash, g.width));
  if(opts.markX !== undefined) P.vline(opts.markX);
  if(opts.markY !== undefined) P.hline(opts.markY);
  (opts.holes || []).forEach(p => P.dot(p.x, p.y, p.color || '#2f77c9', {hole:true}));
  (opts.points || []).forEach(p => P.dot(p.x, p.y, p.color || '#2f77c9', {label:p.label}));
  P.unclip();
  const items = fns.filter(f => f.label).map(f => ({label:f.label, color:f.color, dash:f.dash})).concat(opts.legend || []);
  P.legend(items);
}

/* Diskret nokatlar (yzygiderlik, hatar): sets:[{pts:[[n, v], ...], color, label, stem, line, r}]
   o: {band:{lo, hi, color}, hlines:[{y, color, dash}], vlines:[{x, color, dash}], yRange:[lo, hi], legend:[...]} */
function plotPoints(canvasId, sets, o){
  o = o || {};
  const xs = [], ys = [];
  sets.forEach(s => s.pts.forEach(p => { if(isFinite(p[0])) xs.push(p[0]); if(isFinite(p[0]) && isFinite(p[1])) ys.push(p[1]); }));
  (o.hlines || []).forEach(h => { if(isFinite(h.y)) ys.push(h.y); });
  if(o.band && isFinite(o.band.lo) && isFinite(o.band.hi)){ ys.push(o.band.lo, o.band.hi); }
  if(!xs.length) xs.push(0, 1);
  const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), padX = Math.max(0.5, (x1 - x0)*0.03);
  let yr = o.yRange;
  if(!yr){                                         // diňe hakyky "partlama" (aşa uly agzalar) kesilýär, ilkinji agzalar görünýär
    const v = ys.slice().sort((p, q) => p - q), at = f => v[Math.round(f*(v.length - 1))];
    let lo = v.length ? v[0] : -1, hi = v.length ? v[v.length - 1] : 1;
    if(v.length > 20 && (hi - lo) > 50*(at(0.95) - at(0.05)) && at(0.95) > at(0.05)){ const sp = at(0.95) - at(0.05); lo = Math.max(lo, at(0.05) - 2*sp); hi = Math.min(hi, at(0.95) + 2*sp); }
    if(hi - lo < 1e-12*Math.max(1, Math.abs(hi))){ lo -= 1; hi += 1; }
    const pad = 0.08*(hi - lo); yr = [lo - pad, hi + pad];
  }
  const P = makePlot(canvasId, x0 - padX, x1 + padX, yr[0], yr[1], () => plotPoints(canvasId, sets, o), {xInt: true});
  const ctx = P.ctx;
  P.axes();
  P.clip();
  if(o.band && isFinite(o.band.lo) && isFinite(o.band.hi)){
    const top = P.Y(o.band.hi), bot = P.Y(o.band.lo);
    ctx.fillStyle = themeColor(o.band.color || 'rgba(232,163,61,0.22)'); ctx.fillRect(P.L, Math.min(top, bot), P.pw, Math.abs(bot - top));
  }
  (o.hlines || []).forEach(h => P.hline(h.y, h.color || '#b3261e', h.dash));
  (o.vlines || []).forEach(v => P.vline(v.x, v.color || '#8a6d00', v.dash));
  const base = (yr[0] <= 0 && yr[1] >= 0) ? 0 : (yr[0] > 0 ? yr[0] : yr[1]);
  sets.forEach(s => {
    const pts = s.pts.filter(p => isFinite(p[0]) && isFinite(p[1])), col = themeColor(s.color);
    ctx.save();
    if(s.stem && pts.length <= 40){
      ctx.strokeStyle = col; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.2; ctx.beginPath();
      pts.forEach(p => { ctx.moveTo(P.X(p[0]), P.Y(base)); ctx.lineTo(P.X(p[0]), P.Y(p[1])); });
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    if(s.line){
      ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.setLineDash(s.dash || []); ctx.lineJoin = 'round'; ctx.beginPath();
      pts.forEach((p, i) => i ? ctx.lineTo(P.X(p[0]), P.Y(p[1])) : ctx.moveTo(P.X(p[0]), P.Y(p[1])));
      ctx.stroke(); ctx.setLineDash([]);
    }
    const r = s.r || (pts.length > 400 ? 1.4 : pts.length > 120 ? 2.2 : pts.length > 50 ? 3 : 4);
    pts.forEach(p => {
      ctx.beginPath(); ctx.arc(P.X(p[0]), P.Y(p[1]), r, 0, 2*Math.PI);
      ctx.fillStyle = col; ctx.fill();
      if(r >= 3){ ctx.lineWidth = 1.2; ctx.strokeStyle = P.pal.ring; ctx.stroke(); }
    });
    ctx.restore();
  });
  P.unclip();
  // legenda: nokatlaryň (we çyzyklaryň) iň az düşýän burçunda
  const avoid = [];
  sets.forEach(s => s.pts.forEach(p => { if(isFinite(p[0]) && isFinite(p[1])) avoid.push([P.X(p[0]), P.Y(p[1])]); }));
  (o.hlines || []).forEach(h => { if(isFinite(h.y)) for(let x = P.L; x <= P.L + P.pw; x += 12) avoid.push([x, P.Y(h.y)]); });
  P.legend(sets.filter(s => s.label).map(s => ({label: s.label, color: s.color, dash: s.dash})).concat(o.legend || []), avoid);
  return P;
}

let _resizeTimer = null;

/* Tema (açyk / gara) çalşylanda: ähli grafikler täze reňklerde täzeden çyzylýar, legenda nokatlary täzelenýär.
   Çap edilende grafikler wagtlaýyn açyk temada çyzylýar (kagyz ak), çapdan soň öňki temasyna gaýdýar. */
function initPlotTheme(){
  let last = graphDark();
  const sync = function(){
    const now = graphDark();
    if(now === last) return;
    last = now;
    document.querySelectorAll('canvas').forEach(c => { if(typeof c._redraw === 'function'){ try{ c._redraw(); }catch(e){} } });
    swapDotColors(document);
  };
  if(typeof MutationObserver !== 'undefined') new MutationObserver(sync).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  window.addEventListener('beforeprint', function(){ setGraphPrinting(true); sync(); });
  window.addEventListener('afterprint', function(){ setGraphPrinting(false); sync(); });
}

function initPlotResize(){
  window.addEventListener('resize', function(){
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(function(){
      document.querySelectorAll('canvas.graph').forEach(c => {
        if(typeof c._redraw === 'function' && c.getBoundingClientRect().width > 0){ try{ c._redraw(); }catch(e){} }
      });
    }, 150);
  });
}

/* ===== modules/ui/dom.js ===== */
/* Netije gutusyny görkezmek. */

function showResult(id, html, isError){
  const el = document.getElementById(id);
  el.className = "result " + (isError ? "err" : "ok");
  el.innerHTML = html;
}

/* ===== modules/calculators/continuity.js ===== */
/* Üznüksizlik barlagy we aralyk orta baha teoremasy (IVT). */

function calcContinuity(){
  try{
    const node = math.parse(prep(document.getElementById("cont-f").value));
    const fFn = node.compile();
    const evalAt = x => fFn.evaluate({x});
    const a = parseBound(document.getElementById("cont-a").value);
    if(!isFinite(a)){ showResult("cont-result","<strong>Ýalňyşlyk:</strong> Üznüksizlik diňe anyk san nokatda barlanýar.",true); return; }

    const fa0 = safeEval(evalAt, a), fa = isFinite(fa0) ? fa0 : NaN;     // f(a) = ±∞ ýa-da NaN — kesgitlenmedik
    const hs = [0.1,0.01,0.001,0.0001,0.00001];
    const Lv = hs.map(h=>safeEval(evalAt,a-h)), Rv = hs.map(h=>safeEval(evalAt,a+h));
    const rows = hs.map((h,i)=>`<tr><td>${h}</td><td>${fmt(Lv[i])}</td><td>${fmt(Rv[i])}</td></tr>`).join('');
    const L = classify(Lv), R = classify(Rv);
    let limExists=false, limVal=null, limStr='ýok';
    if(L.t==='val' && R.t==='val' && Math.abs(L.v-R.v)<=1e-3*Math.max(1,Math.abs(L.v))){ limExists=true; limVal=(L.v+R.v)/2; limStr=fmt(limVal); }
    else if(L.t==='inf' && R.t==='inf' && L.s===R.s){ limStr = L.s>0?'+∞':'-∞'; }
    else if(L.t==='inf' || R.t==='inf'){ limStr = `ýok (çep ${fmtSide(L)}, sag ${fmtSide(R)})`; }

    const faStr = isNaN(fa) ? 'kesgitlenmedik' : fmt(fa);
    let s1ok = !isNaN(fa), s3ok = s1ok && limExists && Math.abs(fa-limVal)<=1e-3*Math.max(1,Math.abs(fa));
    let verdict, kind='';
    if(s1ok && limExists && s3ok){ verdict = `<b>ÜZNÜKSIZ</b> (üç şert hem ýerine ýetdi)`; }
    else {
      if(limExists && (!s1ok || !s3ok)) kind = 'aýrylýan üznüksizlik (deşik)';
      else if(L.t==='val' && R.t==='val' && !limExists) kind = 'bökme görnüşli üznüksizlik';
      else if(L.t==='inf' || R.t==='inf') kind = 'çäksiz üznüksizlik';
      else kind = 'üznüksizlik ýok';
      verdict = `<b>ÜZNÜKSIZ DÄL</b> — ${kind}`;
    }
    const html = `<strong>1) f(${fmt(a)}) =</strong> ${faStr}<br>` +
      `<strong>2) lim(x→${fmt(a)}) f(x) =</strong> ${limStr}${(!limExists && L.t==='val' && R.t==='val') ? ` (çep ≈ ${fmt(L.v)}, sag ≈ ${fmt(R.v)})` : ''}<br>` +
      `<strong>3) Deňlik lim = f(a):</strong> ${s3ok ? 'ýerine ýetdi' : 'ýerine ýetmedi'}<br>` +
      `<strong>Netije:</strong> ${verdict}<br>` +
      `<table class="conv"><tr><th>h</th><th>f(a−h)</th><th>f(a+h)</th></tr>${rows}</table>`;
    showResult("cont-result", html, false);
    const gOpts = {markX:a};
    if(limExists){
      if(s3ok) gOpts.points = [{x:a, y:fa, color:'#2f77c9'}];
      else { gOpts.holes = [{x:a, y:limVal, color:'#2f77c9'}]; if(s1ok && isFinite(fa)) gOpts.points = [{x:a, y:fa, color:'#c9432f'}]; }
    } else if(L.t==='val' && R.t==='val'){
      gOpts.holes = [{x:a, y:L.v, color:'#2f77c9'}, {x:a, y:R.v, color:'#2f77c9'}];
      if(s1ok && isFinite(fa)) gOpts.points = [{x:a, y:fa, color:'#c9432f'}];
    }
    plotFunctions("cont-graph", [{fn:evalAt, color:'#2f77c9'}], a-5, a+5, gOpts);
  } catch(e){
    showResult("cont-result", "<strong>Ýalňyşlyk:</strong> Aňlatmany barlaň (mysal: x^2, 1/x, sin(x), x<0 ? -1 : 1).", true);
  }
}

/* Aralyk orta baha teoremasy + ýarym bölmek usuly */
function calcIVT(){
  try{
    const node = math.parse(prep(document.getElementById('ivt-f').value));
    const fFn = node.compile(), f = x => safeEval(xx => fFn.evaluate({x:xx}), x);
    const a = parseBound(document.getElementById('ivt-a').value), b = parseBound(document.getElementById('ivt-b').value);
    const nRaw = document.getElementById('ivt-n').value.trim(), N = nRaw === '' ? 0 : parseBound(nRaw);
    if(!isFinite(a) || !isFinite(b) || !(a < b) || !isFinite(N)){
      showResult('ivt-result', '<strong>Ýalňyşlyk:</strong> a we b san bolmaly, a &lt; b; N hem san bolmaly (mysal: 1, 2 we 0).', true); return;
    }
    const fa = f(a), fb = f(b);
    if(!isFinite(fa) || !isFinite(fb)){
      showResult('ivt-result', '<strong>Ýalňyşlyk:</strong> f(a) ýa-da f(b) kesgitlenmedik — başga aralyk saýla.', true); return;
    }
    const jump = findJump(f, a, b);
    let html = `<strong>f(${fmt(a)}) =</strong> ${fmt(fa)}, &nbsp;<strong>f(${fmt(b)}) =</strong> ${fmt(fb)}, &nbsp;<strong>N =</strong> ${fmt(N)}<br>`;
    const pad = 0.15*(b - a), segs = [{x1:a-pad, y1:N, x2:b+pad, y2:N, color:'#c9432f', dash:[5,4], width:1.2}];
    const pts = [{x:a, y:fa, color:'#2f77c9', label:'a'}, {x:b, y:fb, color:'#2f77c9', label:'b'}];
    const between = (N - fa)*(N - fb) < 0;
    if(jump !== null){
      html += `<strong>Üznüksizlik:</strong> f funksiýa [${fmt(a)}; ${fmt(b)}] kesimde x ≈ ${fmt(jump)} nokadynda üzülýär (kesgitlenmedik ýa-da bökýär). Teoremanyň esasy şerti bozulýar, şonuň üçin IVT ulanyp bolmaýar — f(c) = N bolýan c hökman bar diýip bolmaz.`;
    } else if(N === fa || N === fb){
      html += `<strong>Netije:</strong> N = f(${N === fa ? fmt(a) : fmt(b)}) — gözlenýän baha kesimiň uçunda alynýar (c = ${N === fa ? fmt(a) : fmt(b)}).`;
    } else if(!between){
      html += `<strong>Netije:</strong> N = ${fmt(N)} sany f(a) = ${fmt(fa)} bilen f(b) = ${fmt(fb)} sanlarynyň arasynda däl — IVT bu ýagdaýda netije bermeýär (f(c) = N bolýan c bolup hem biler, bolmaz hem biler). Aralygy ýa-da N-i üýtget.`;
    } else {
      html += `<strong>Üznüksizlik:</strong> [${fmt(a)}; ${fmt(b)}] kesimde üzülme tapylmady (san taýdan barlag).<br>` +
              `<strong>IVT:</strong> N f(a) bilen f(b)-niň arasynda, şonuň üçin (${fmt(a)}; ${fmt(b)}) aralykda f(c) = ${fmt(N)} bolýan c bar.<br>`;
      const g = x => f(x) - N;
      let lo = a, hi = b, glo = g(lo), rows = '';
      const maxRows = 12;
      for(let k = 1; k <= maxRows; k++){
        const m = (lo + hi)/2, gm = g(m);
        const side = (gm === 0) ? 'f(m) = N' : (glo*gm < 0 ? '(a; m)' : '(m; b)');
        rows += `<tr><td>${k}</td><td>${fmtPrec(lo, 8)}</td><td>${fmtPrec(hi, 8)}</td><td>${fmtPrec(m, 8)}</td><td>${fmtPrec(gm, 4)}</td><td>${side}</td></tr>`;
        if(gm === 0){ lo = hi = m; break; }
        if(glo*gm < 0){ hi = m; } else { lo = m; glo = gm; }
      }
      const c = bisect(g, a, b, 1e-13, 200), fc = f(c);
      html += `<strong>Ýarym bölmek (bisection):</strong> c ≈ ${fmtPrec(c, 10)}, f(c) = ${fmtPrec(fc, 8)}<br>` +
              `<span class="muted" style="font-size:.85rem">Ilkinji ${maxRows} ädim (her ädimde kesimiň uzynlygy 2 esse kiçelýär):</span>` +
              `<table class="conv"><tr><th>ädim</th><th>a</th><th>b</th><th>m = (a+b)/2</th><th>f(m) − N</th><th>saklanýan</th></tr>${rows}</table>`;
      pts.push({x:c, y:N, color:'#c9432f', label:'c'});
    }
    showResult('ivt-result', html, false);
    plotFunctions('ivt-graph', [{fn:f, color:'#2f77c9', label:'f(x)'}], a - pad, b + pad, {segments:segs, points:pts});
  } catch(e){
    showResult('ivt-result', '<strong>Ýalňyşlyk:</strong> Aňlatmany barlaň (mysal: x^3 - x - 1, cos(x) - x). Diňe x üýtgeýjisi goldanýar.', true);
  }
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

/* ===== modules/calculators/derivative.js ===== */
/* Önüm hasaplaýjy: düzgünleri düşündirýän ädimme-ädim çözgüt (derivative-steps.js), kesgitleme barlagy, galtaşýan çyzyk. */

function calcDerivative(){
  try{
    const fullNode = math.parse(prep(document.getElementById('der-f').value));
    let S;
    try{ S = derivSteps(fullNode); }catch(err){ const d = simplifySafe(math.derivative(fullNode, 'x')); S = {steps: ['f′(x) = ' + prettyNode(d)], d}; }
    const fullDeriv = S.d;
    const fFn = fullNode.compile(), fpFn = fullDeriv.compile();
    const f = x => safeEval(xx => fFn.evaluate({x:xx}), x), fp = x => safeEval(xx => fpFn.evaluate({x:xx}), x);
    let html = `<strong>Ädimme-ädim:</strong><ol class="steps">${S.steps.map(t => '<li>' + t + '</li>').join('')}</ol><strong>f′(x) =</strong> ${derivPretty(fullDeriv)}`;

    const x0str = document.getElementById('der-x0').value.trim();
    const fns = [{fn:f, color:'#2f77c9', label:'f(x)'}, {fn:fp, color:'#c9432f', label:'f′(x)'}];
    const opts = {};
    let c = 0;
    if(x0str !== ''){
      const x0 = parseBound(x0str);
      if(!isFinite(x0)){
        showResult('der-result', '<strong>Ýalňyşlyk:</strong> x₀ anyk san bolmaly (mysal: 1 ýa-da pi/2). Nokady islemeseň, meýdany boş goý.', true); return;
      }
      c = x0;
      const slope = fp(x0), y0 = f(x0);
      html += `<br><strong>f′(${fmt(x0)}) =</strong> ${fmt(slope)}`;
      if(isFinite(slope) && isFinite(y0)){
        html += `<br><strong>Galtaşýan çyzyk:</strong> ${lineEq(slope, x0, y0)} <span class="muted" style="font-size:.82rem">(y − f(x₀) = f′(x₀)·(x − x₀))</span>`;
        fns.push({fn:x => y0 + slope*(x - x0), color:'#3a9a3a', label:'galtaşýan çyzyk'});
        opts.points = [{x:x0, y:y0, color:'#c9432f'}];
      }
      const hs = [0.1, 0.01, 0.001, 0.0001, 0.00001];
      const rows = hs.map(h => `<tr><td>${h}</td><td>${fmt((f(x0 + h) - y0)/h)}</td><td>${fmt((y0 - f(x0 - h))/h)}</td></tr>`).join('');
      html += `<br><span class="muted" style="font-size:.85rem">Kesgitleme boýunça barlag: h kiçelende sag we çep tapawut gatnaşyklary f′(x₀)-a ýakynlaşýar:</span>` +
              `<table class="conv"><tr><th>h</th><th>(f(x₀+h) − f(x₀))/h</th><th>(f(x₀) − f(x₀−h))/h</th></tr>${rows}</table>`;
    }
    showResult('der-result', html, false);
    plotFunctions('der-graph', fns, c - 4, c + 4, opts);
  } catch(e){
    showResult('der-result', '<strong>Ýalňyşlyk:</strong> Aňlatmany barlaň (mysal: x^3, sin(x), e^x, ln(x), sqrt(x)). Diňe x üýtgeýjisi goldanýar.', true);
  }
}

/* ===== modules/solvers/extrema-steps.js ===== */
/* Ekstremum: mugallym ýaly çözgüt — 1) f′(x); 2) f′(x) = 0 deňlemäni çözmek (köpagza bolsa takyk, köpeldijilere dagydyp;
   elmydama položitel köpeldijileri taşlap; galan ýagdaýda san usuly bilen); 3) alamat tablisasy (f′-iň alamaty we f-iň ösüşi);
   4) her kritiki nokat üçin netije: birinji önüm synagy (alamat çalşygy) we ikinji önüm synagy bilen barlag. */

function exHasX(n){ let f = false; n.traverse(c => { if(c.type === 'SymbolNode' && c.name === 'x') f = true; }); return f; }

function exFn(n){ const c = n.compile(); return x => safeEval(xx => c.evaluate({x: xx}), x); }

/* köpeldijiler: köpeltmek, bölmek (maýdalawjy aýratyn), alamat */
function exFactors(n, out, den){
  n = unwrap(n);
  if(n.type === 'OperatorNode' && n.fn === 'multiply'){ exFactors(n.args[0], out, den); exFactors(n.args[1], out, den); }
  else if(n.type === 'OperatorNode' && n.fn === 'divide'){ exFactors(n.args[0], out, den); exFactors(n.args[1], den, out); }
  else if(n.type === 'OperatorNode' && n.fn === 'unaryMinus') exFactors(n.args[0], out, den);
  else out.push(n);
  return out;
}

/* aralykda hemişe položitelmi (san taýdan) */
function exPositive(fn, a, b){
  for(let i = 0; i <= 200; i++){ const v = fn(a + (b - a)*i/200); if(!(v > 0)) return false; }
  return true;
}

/* köpagzany köpeldijilere dagytmak: 3(x + 1)(x − 1); kompleks kökli bölek bolsa null */
function exFactorStr(c, roots){
  const lead = c[c.length - 1];
  let s = Math.abs(lead - 1) < 1e-12 ? '' : Math.abs(lead + 1) < 1e-12 ? '−' : fmtNice(lead);
  roots.forEach(r => {
    const lin = Math.abs(r.x) < 1e-12 ? 'x' : '(x ' + (r.x < 0 ? '+ ' + fmtNice(-r.x) : '− ' + fmtNice(r.x)) + ')';
    s += lin + (r.m > 1 ? '<sup>' + r.m + '</sup>' : '');
  });
  return s;
}

/* f′(x) = 0 deňlemäniň çözülişi: {html, exact: [x]} */
function exSolve(fp, xMin, xMax){
  const inR = x => x >= xMin - 1e-9 && x <= xMax + 1e-9;
  const list = xs => xs.map(x => 'x = ' + fmtNice(x) + (inR(x) ? '' : ' (aralykdan daşarda)')).join(', ');
  const c = polyCoeffs(fp);
  if(c && c.length >= 2 && c.length <= 4){
    const R = polyRealRoots(c);
    if(R && !R.complexCount){
      const xs = R.roots.map(r => r.x), fs = exFactorStr(c, R.roots);
      const fac = c.length > 2 && fs !== polyHtml(c) ? ' ⇒ ' + fs + ' = 0' : '';
      const even = R.roots.filter(r => r.m % 2 === 0);
      return {html: polyHtml(c) + ' = 0' + fac + ' ⇒ ' + (xs.length ? list(xs) : 'hakyky kök ýok') + '.' +
        (even.length ? ' (' + even.map(r => 'x = ' + fmtNice(r.x)).join(', ') + ' — jübüt gaýtalanýan kök: f′ şol nokatda alamatyny çalyşmaýar.)' : ''), exact: xs};
    }
    if(R && R.roots.length === 0) return {html: polyHtml(c) + ' = 0 deňlemäniň hakyky köki ýok (diskriminant otrisatel) ⇒ f′ alamatyny çalyşmaýar.', exact: []};
  }
  if(c && c.length === 1) return {html: 'f′(x) = ' + fmtNice(c[0]) + ' hemişelik ' + (Math.abs(c[0]) < 1e-12 ? '(funksiýa hemişelik).' : '≠ 0 ⇒ kritiki nokat ýok.'), exact: []};
  const den = [], num = exFactors(fp, [], den), parts = [], xs = [];
  let ok = true, solved = 0;
  num.forEach(f => {
    if(!exHasX(f)) return;
    const fn = exFn(f), pc = polyCoeffs(f);
    if(exPositive(fn, xMin, xMax)){ parts.push(prettyNode(f) + ' &gt; 0 (nola deň bolmaýar)'); return; }
    if(pc && pc.length >= 2 && pc.length <= 4){
      const R = polyRealRoots(pc);
      if(R){ parts.push(polyHtml(pc) === 'x' ? 'x = 0' : polyHtml(pc) + ' = 0 ⇒ ' + (R.roots.length ? list(R.roots.map(r => r.x)) : 'hakyky kök ýok')); R.roots.forEach(r => xs.push(r.x)); solved++; return; }
    }
    ok = false;
  });
  den.forEach(f => {
    if(!exHasX(f)) return;
    if(exPositive(exFn(f), xMin, xMax)) parts.push('maýdalawjy ' + prettyNode(f) + ' &gt; 0');
    else parts.push('maýdalawjy ' + prettyNode(f) + ' nola deň bolýan ýerde f′ kesgitlenmedik');
  });
  const bad = xs.filter(r => den.some(f => { const v = exFn(f)(r); return !(Math.abs(v) > 1e-12); }));
  if(ok && bad.length){
    const good = xs.filter(r => bad.indexOf(r) === -1);
    parts.push(bad.map(r => 'x = ' + fmtNice(r)).join(', ') + ' bolanda maýdalawjy hem 0 — bu ýerde f′ kesgitlenmedik, ol f′(x) = 0 deňlemäniň köki däl');
    xs.length = 0; good.forEach(r => xs.push(r));
  }
  if(ok && (solved || parts.length)) return {html: (num.filter(exHasX).length > 1 ? 'Köpeltmek hasyly nola deň bolýar, haçan-da köpeldijileriň biri nola deň bolsa: ' : 'Drob nola deň bolýar, haçan-da sanawjy nola deň bolsa: ') + parts.join('; ') + '.', exact: xs};
  return null;
}

/* Esasy: ädimler we alamat tablisasy.
   A — extrema.js-iň analizi: {f, fp, fpp, crit: [{x, y, kind, corner, fpp}]} */
function extremaSteps(fNode, A, xMin, xMax){
  const steps = [];
  let fp;
  try{ fp = derivNice(fNode); }catch(e){ fp = simplifySafe(math.derivative(fNode, 'x')); }
  steps.push('<b>Önüm</b>: f′(x) = ' + derivPretty(fp) + '.');
  const sol = exSolve(fp, xMin, xMax);
  const label = x => {
    if(sol) for(const r of sol.exact) if(Math.abs(r - x) < 1e-6*Math.max(1, Math.abs(r))) return fmtNice(r);
    const s = fmtNice(x);
    return /[√π/]/.test(s) || Number.isInteger(Number(s.replace('−', '-'))) ? s : '≈ ' + s;
  };
  const stat = A.crit.filter(c => !c.corner), corners = A.crit.filter(c => c.corner);
  let line = '<b>Kritiki nokatlar</b>: f′(x) = 0 deňlemäni çözýäris. ';
  if(sol) line += sol.html;
  else if(stat.length){
    const exactAll = stat.every(c => label(c.x).charAt(0) !== '≈');
    line += 'Kökleri san usuly bilen tapýarys (f′ alamatyny çalyşýan aralyklarda ýarym bölmek)' + (exactAll ? ' we takyk bahalaryny tanaýarys' : '') + ': ' + stat.map(c => 'x ' + (label(c.x).charAt(0) === '≈' ? label(c.x) : '= ' + label(c.x))).join(', ') + '.';
  }
  else line += 'Aralykda f′(x) = 0 bolýan nokat ýok.';
  if(corners.length) line += ' Mundan başga, ' + corners.map(c => (label(c.x).charAt(0) === '≈' ? 'x ' : 'x = ') + label(c.x)).join(', ') + ' nokatda f′ kesgitlenmedik (burç / dik galtaşma) — bu hem kritiki nokat.';
  steps.push(line);

  /* alamat tablisasy: aralyklar we kritiki nokatlar */
  const cs = A.crit.slice().sort((p, q) => p.x - q.x), edges = [xMin].concat(cs.map(c => c.x), [xMax]);
  const head = ['<th>x</th>'], rowS = ['<th>f′(x)</th>'], rowF = ['<th>f(x)</th>'];
  const sgn = v => isNaN(v) ? '∄' : v > 1e-12 ? '+' : v < -1e-12 ? '−' : '0';
  for(let i = 0; i < edges.length - 1; i++){
    const a = edges[i], b = edges[i + 1], m = A.fp((a + b)/2), s = sgn(m);
    head.push('<td>(' + fmtNice(a) + '; ' + fmtNice(b) + ')</td>');
    rowS.push('<td class="' + (s === '+' ? 'pos' : s === '−' ? 'neg' : '') + '">' + s + '</td>');
    rowF.push('<td class="arrow">' + (s === '+' ? '↗' : s === '−' ? '↘' : '→') + '</td>');
    if(i < cs.length){
      const c = cs[i];
      head.push('<td class="cp">' + label(c.x) + '</td>');
      rowS.push('<td class="cp">' + (c.corner ? '∄' : '0') + '</td>');
      rowF.push('<td class="cp">' + fmtNice(c.y) + (c.kind === 'max' ? '<br><b>max</b>' : c.kind === 'min' ? '<br><b>min</b>' : '') + '</td>');
    }
  }
  steps.push('<b>Alamat tablisasy</b>: her aralykda f′-iň alamatyny bir nokatda barlaýarys (f′ &gt; 0 — artýar ↗, f′ &lt; 0 — kemelýär ↘):' +
    '<div class="signchart-wrap"><table class="signchart"><tr>' + head.join('') + '</tr><tr>' + rowS.join('') + '</tr><tr>' + rowF.join('') + '</tr></table></div>');

  /* her nokat üçin netije */
  cs.forEach(c => {
    const e = Math.max(1e-6, (xMax - xMin)*1e-4), l = sgn(A.fp(c.x - e)), r = sgn(A.fp(c.x + e));
    const xl = label(c.x), xe = xl.charAt(0) === '≈' ? 'x ' + xl : 'x = ' + xl;
    let t = xe + ': f′ alamatyny ' + l + ' → ' + r + ' çalyşýar ⇒ ';
    if(c.kind === 'max') t += '<b>lokal maksimum</b>, f(' + label(c.x).replace('≈ ', '') + ') = ' + fmtNice(c.y) + '.';
    else if(c.kind === 'min') t += '<b>lokal minimum</b>, f(' + label(c.x).replace('≈ ', '') + ') = ' + fmtNice(c.y) + '.';
    else t = xe + ': f′ alamatyny çalyşmaýar (' + l + ' → ' + r + ') ⇒ <b>ekstremum däl</b>' + (Math.abs(c.fpp) < 1e-9 ? ' (galtaşýan gorizontal — egrilik nokady bolmagy mümkin)' : '') + '.';
    if(!c.corner && isFinite(c.fpp) && Math.abs(c.fpp) > 1e-9 && c.kind !== 'flat') t += ' Ikinji önüm bilen barlag: f″ = ' + fmtNice(c.fpp) + (c.fpp < 0 ? ' &lt; 0 (güberçek ∩) ⇒ maksimum ✓' : ' &gt; 0 (çukur ∪) ⇒ minimum ✓');
    else if(!c.corner && c.kind !== 'flat') t += ' (f″ = 0 — ikinji önüm synagy jogap bermeýär, şonuň üçin alamat çalşygyna seredýäris.)';
    steps.push(t);
  });
  return steps;
}

/* ===== modules/calculators/extrema.js ===== */
/* Önümiň ulanylyşy: kritiki nokatlar, ekstremum, monotonlyk. */

const KIND_LABEL = {min:'lokal minimum', max:'lokal maksimum', flat:'ekstremum däl'};

function analyzeFunction(fNode, xMin, xMax){
  const fFn = fNode.compile();
  const fpNode = math.derivative(fNode, 'x'), fppNode = math.derivative(fpNode, 'x');
  const fpFn = fpNode.compile(), fppFn = fppNode.compile();
  const f = removable(x => safeEval(xx => fFn.evaluate({x:xx}), x));
  const fp = removable(x => safeEval(xx => fpFn.evaluate({x:xx}), x));
  const fpp = removable(x => safeEval(xx => fppFn.evaluate({x:xx}), x));
  const span = xMax - xMin, inside = x => x > xMin + 1e-9*span && x < xMax - 1e-9*span;
  const crit = findRoots(fp, xMin, xMax).filter(r => inside(r.x) && isFinite(f(r.x))).map(r => {
    const x0 = r.x, y0 = f(x0), v = fpp(x0);
    let kind;
    if(r.jump){
      const e = span*1e-4, l = fp(x0-e), rr = fp(x0+e);
      kind = (l < 0 && rr > 0) ? 'min' : (l > 0 && rr < 0) ? 'max' : 'flat';
    } else if(v > 1e-6){ kind = 'min'; }
    else if(v < -1e-6){ kind = 'max'; }
    else {
      const e = Math.max(1e-6, span*1e-5), l = fp(x0-e), rr = fp(x0+e);
      kind = (l > 0 && rr < 0) ? 'max' : (l < 0 && rr > 0) ? 'min' : 'flat';
    }
    return {x:x0, y:y0, kind, corner:r.jump, fpp:v};
  });
  const infl = findRoots(fpp, xMin, xMax).filter(r => !r.jump && inside(r.x) && isFinite(f(r.x))).filter(r => {
    const e = Math.max(1e-6, span*1e-5), l = fpp(r.x-e), rr = fpp(r.x+e);
    return isFinite(l) && isFinite(rr) && l*rr < 0;
  }).map(r => ({x:r.x, y:f(r.x)}));
  const monoEdges = [xMin].concat(crit.map(c => c.x), [xMax]);
  const concEdges = [xMin].concat(infl.map(c => c.x), [xMax]);
  return {f, fp, fpp, fpNode, fppNode, crit, infl,
    mono: signRuns(fp, monoEdges), conc: signRuns(fpp, concEdges)};
}

function runsText(runs, up, down, zero){
  return runs.map(r => `(${fmtNice(r.from)}; ${fmtNice(r.to)}) — ${r.s > 0 ? up : r.s < 0 ? down : (zero || 'hemişelik')}`);
}

function calcExtrema(){
  try{
    const node = math.parse(prep(document.getElementById('ext-f').value));
    const xMin = parseBound(document.getElementById('ext-min').value), xMax = parseBound(document.getElementById('ext-max').value);
    if(!isFinite(xMin) || !isFinite(xMax) || !(xMin < xMax)){
      showResult('ext-result', '<strong>Ýalňyşlyk:</strong> Aralygyň başy ahyryndan kiçi bolmaly, ikisi hem san bolsun (mysal: −3 we 3).', true); return;
    }
    const A = analyzeFunction(node, xMin, xMax);
    const sf = n => prettyNode(simplifySafe(n));
    let steps;
    try{ steps = extremaSteps(node, A, xMin, xMax); }catch(err){ steps = null; }
    let html = '';
    if(steps) html += `<strong>Çözgüt (ädimme-ädim):</strong><ol class="steps">${steps.map(t => '<li>' + t + '</li>').join('')}</ol>`;
    else {
      html += `<strong>f′(x) =</strong> ${sf(A.fpNode)}<br>`;
      html += A.crit.length ? `<strong>Kritiki nokatlar:</strong> ` + A.crit.map(c => `x ≈ ${fmt(c.x)} (${KIND_LABEL[c.kind]})`).join(', ') + '<br>' : `<strong>Kritiki nokatlar:</strong> tapylmady — funksiýa monoton.<br>`;
    }
    html += `<strong>Artýar / kemelýär:</strong> ` + runsText(A.mono, 'artýar ↗', 'kemelýär ↘').join('; ') + `<br>`;
    html += `<strong>f″(x) =</strong> ${sf(A.fppNode)}<br>`;
    html += `<strong>Egrilik nokatlary (f″ alamat çalyşýar):</strong> ` +
      (A.infl.length ? A.infl.map(p => `(${fmtNice(p.x)}; ${fmtNice(p.y)})`).join(', ') : 'tapylmady') + `<br>`;
    html += `<strong>Çukur / güberçek:</strong><br>` + runsText(A.conc, 'çukur ∪ (f″ > 0)', 'güberçek ∩ (f″ < 0)', 'göni (f″ = 0)').join('<br>') + `<br>`;
    const cand = [{x:xMin, y:A.f(xMin)}, {x:xMax, y:A.f(xMax)}].concat(A.crit.map(c => ({x:c.x, y:c.y})));
    if(cand.every(c => isFinite(c.y))){
      const hi = cand.reduce((p,q) => q.y > p.y ? q : p), lo = cand.reduce((p,q) => q.y < p.y ? q : p);
      html += `<strong>[${fmtNice(xMin)}; ${fmtNice(xMax)}] kesimde:</strong> iň uly baha f(${fmtNice(hi.x)}) = ${fmtNice(hi.y)}, iň kiçi baha f(${fmtNice(lo.x)}) = ${fmtNice(lo.y)} <span class="muted" style="font-size:.82rem">(uçlar we kritiki nokatlar deňeşdirildi)</span>`;
    } else {
      html += `<span class="muted" style="font-size:.82rem">Bellik: funksiýa aralygyň käbir nokadynda kesgitlenmedik, şonuň üçin iň uly/iň kiçi baha hasaplanmady.</span>`;
    }
    showResult('ext-result', html, false);
    const colors = {min:'#2f9a4a', max:'#c9432f', flat:'#8a6d00'};
    const pts = A.crit.map(c => ({x:c.x, y:c.y, color:colors[c.kind], label:c.kind === 'min' ? 'min' : c.kind === 'max' ? 'max' : ''}))
      .concat(A.infl.map(p => ({x:p.x, y:p.y, color:'#e8a33d', label:'egr.'})));
    plotFunctions('ext-graph', [{fn:A.f, color:'#2f77c9', label:'f(x)'}, {fn:A.fp, color:'#c9432f', dash:[6,4], width:1.6, label:'f′(x)'}], xMin, xMax, {points:pts});
  } catch(e){
    showResult('ext-result', '<strong>Ýalňyşlyk:</strong> Aňlatmany barlaň (mysal: x^3 - 3*x, sin(x), x^2*e^(-x)). Diňe x üýtgeýjisi goldanýar.', true);
  }
}

/* ===== modules/calculators/functions.js ===== */
/* Funksiýa derňewçisi: kesgitlenmedik nokatlar, nol nokatlar, jübüt/täk, baha tablisasy. */

function fnEdge(f, good, bad){
  for(let k = 0; k < 40; k++){ const m = (good + bad) / 2; if(isFinite(safeEval(f, m))) good = m; else bad = m; }
  const r = Math.abs(good) < 1e-9 ? 0 : Number(good.toPrecision(8));
  return {v: r, ok: isFinite(safeEval(f, r))};
}

function fnGaps(f, xs, ys, a, b){
  const out = [], add = s => { if(out.indexOf(s) < 0) out.push(s); };
  for(let k = Math.ceil(a), n = 0; k <= b && n < 60; k++, n++) if(!isFinite(safeEval(f, k))) add('x = ' + k);
  let s = -1;
  for(let i = 0; i <= ys.length; i++){
    const bad = i < ys.length && !isFinite(ys[i]);
    if(bad && s < 0) s = i;
    if(bad || s < 0) continue;
    const e = i - 1;
    if(s === e) add('x = ' + fmt(xs[s]));
    else {
      const L = s > 0 ? fnEdge(f, xs[s-1], xs[s]) : null, R = i < ys.length ? fnEdge(f, xs[i], xs[e]) : null;
      if(L && R) add(fmt(L.v) + (L.ok ? ' < ' : ' ≤ ') + 'x' + (R.ok ? ' < ' : ' ≤ ') + fmt(R.v));
      else if(R) add('x' + (R.ok ? ' < ' : ' ≤ ') + fmt(R.v));
      else if(L) add('x' + (L.ok ? ' > ' : ' ≥ ') + fmt(L.v));
      else add('ähli aralykda');
    }
    s = -1;
  }
  return out;
}

function fnZeros(f, xs, ys){
  const z = [];
  for(let i = 0; i < ys.length - 1 && z.length < 8; i++){
    const y0 = ys[i], y1 = ys[i+1];
    if(y0 === 0){ z.push(xs[i]); continue; }
    if(!(isFinite(y0) && isFinite(y1) && y0 * y1 < 0)) continue;
    let lo = xs[i], hi = xs[i+1];
    for(let k = 0; k < 50; k++){ const m = (lo + hi) / 2; if(safeEval(f, m) * y0 > 0) lo = m; else hi = m; }
    const r = (lo + hi) / 2;
    if(Math.abs(safeEval(f, r)) < 1e-6) z.push(r);
  }
  return z;
}

function fnParity(f){
  let even = true, odd = true, n = 0;
  [0.5, 1, 1.5, 2, 3].forEach(t => {
    const p = safeEval(f, t), m = safeEval(f, -t);
    if(!isFinite(p) || !isFinite(m)) return;
    n++;
    const tol = 1e-9 * Math.max(1, Math.abs(p), Math.abs(m));
    if(Math.abs(p - m) > tol) even = false;
    if(Math.abs(p + m) > tol) odd = false;
  });
  return n < 2 ? 'barlap bolmady (f(x) we f(−x) bir wagtda kesgitlenmedik)' : even && odd ? 'jübüt we täk (f(x) = 0)' : even ? 'jübüt' : odd ? 'täk' : 'ne jübüt, ne täk';
}

function calcFunction(){
  try{
    const fFn = math.parse(prep(document.getElementById('fn-f').value)).compile();
    const f = x => fFn.evaluate({x});
    const a = parseBound(document.getElementById('fn-a').value), b = parseBound(document.getElementById('fn-b').value);
    if(!isFinite(a) || !isFinite(b) || a >= b) throw new Error('aralyk');
    const N = 400, xs = [], ys = [];
    for(let i = 0; i <= N; i++){ const x = a + (b - a) * i / N; xs.push(x); ys.push(safeEval(f, x)); }
    const fin = ys.filter(isFinite);
    if(!fin.length) throw new Error('kesgitlenmedik');
    const gaps = fnGaps(f, xs, ys, a, b), zs = fnZeros(f, xs, ys);
    const rows = [0,1,2,3,4,5,6,7,8].map(k => { const x = a + (b - a) * k / 8; return `<tr><td>${fmt(x)}</td><td>${fmt(safeEval(f, x))}</td></tr>`; }).join('');
    showResult('fn-result', `<strong>Kesgitlenmedik nokatlar (${fmt(a)} ≤ x ≤ ${fmt(b)} aralykda):</strong> ${gaps.length ? gaps.join('; ') : 'ýok — funksiýa bu aralykda hemme ýerde kesgitlenen'}<br><strong>Nol nokatlar (f(x) = 0):</strong> ${zs.length ? zs.map(z => 'x ≈ ' + fmt(z)).join('; ') : 'ýok'}<br><strong>Jübüt / täk:</strong> ${fnParity(f)}<br><strong>Bahalar (bu aralykda):</strong> ${fmt(Math.min.apply(null, fin))} ≤ f(x) ≤ ${fmt(Math.max.apply(null, fin))}<table class="conv"><tr><th>x</th><th>f(x)</th></tr>${rows}</table>`, false);
    plotFunctions('fn-graph', [{fn:f, color:'#2f77c9', label:'f(x)'}, {fn:x => f(-x), color:'#c9432f', dash:[5,4], label:'f(−x)'}], a, b, {});
  } catch(e){
    showResult('fn-result', '<strong>Ýalňyşlyk:</strong> Aňlatmany we aralygy barlaň (mysal: x^2, sqrt(x-1), ln(x); aralyk: -5 we 5).', true);
  }
}

/* ===== modules/graphs/contour.js ===== */
/* Iki üýtgeýänli funksiýalar üçin umumy gurallar: derejeli egriler (marching squares), reňk şkalalary,
   ýylylyk kartasy + derejeli egriler grafigi (plotField), reňk zolagy, kursoryň astyndaky baha we deň masştab (equalOk). */

/* Gözenekde (vals[j][i], j — y boýunça, i — x boýunça) F = level egrisiniň kesimlerini tapýar */
function contourSegments(vals, xMin, yMin, dx, dy, level){
  const ny = vals.length - 1, nx = vals[0].length - 1, segs = [];
  const lerp = (p1, p2, v1, v2) => p1 + (p2 - p1)*(v1/(v1 - v2));
  for(let j=0; j<ny; j++) for(let i=0; i<nx; i++){
    const v00 = vals[j][i] - level, v10 = vals[j][i+1] - level, v11 = vals[j+1][i+1] - level, v01 = vals[j+1][i] - level;
    if(!isFinite(v00) || !isFinite(v10) || !isFinite(v11) || !isFinite(v01)) continue;
    const x0 = xMin + i*dx, x1 = x0 + dx, y0 = yMin + j*dy, y1 = y0 + dy, pts = [];
    if((v00 < 0) !== (v10 < 0)) pts.push([lerp(x0, x1, v00, v10), y0]);   // aşaky gyra
    if((v10 < 0) !== (v11 < 0)) pts.push([x1, lerp(y0, y1, v10, v11)]);   // sag gyra
    if((v01 < 0) !== (v11 < 0)) pts.push([lerp(x0, x1, v01, v11), y1]);   // ýokarky gyra
    if((v00 < 0) !== (v01 < 0)) pts.push([x0, lerp(y0, y1, v00, v01)]);   // çep gyra
    if(pts.length === 2) segs.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1]]);
    else if(pts.length === 4){
      const c = (v00 + v10 + v11 + v01)/4;
      if((c < 0) === (v00 < 0)) segs.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1]], [pts[2][0], pts[2][1], pts[3][0], pts[3][1]]);
      else segs.push([pts[0][0], pts[0][1], pts[3][0], pts[3][1]], [pts[1][0], pts[1][1], pts[2][0], pts[2][1]]);
    }
  }
  return segs;
}

/* F(x, y) = level egrisi: gözenegi özi hasaplaýar (anyk däl differensirlemek sapagy hem ulanýar) */
function marchingSquares(F, xMin, xMax, yMin, yMax, nx, ny, level){
  const dx = (xMax - xMin)/nx, dy = (yMax - yMin)/ny, vals = [];
  for(let j=0; j<=ny; j++){
    const row = [];
    for(let i=0; i<=nx; i++){ let v; try{ v = F(xMin + i*dx, yMin + j*dy); }catch(e){ v = NaN; } row.push(typeof v === 'number' ? v : NaN); }
    vals.push(row);
  }
  return contourSegments(vals, xMin, yMin, dx, dy, level || 0);
}

/* ---------------------------------------------------------------- reňk şkalalary
   Yzygiderli (ululyk): bir reňk — gök, açykdan garaňka (gara temada garaňkydan açyga). Bölünýän (alamat): gök ↔ gyzyl,
   ortasy (0) — çal. Reňkleriň özi graphs/palette.js-de (seq, div). */
function _hex(h){ return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

const _rampRgb = new Map();
function rampRgb(stops){
  if(!_rampRgb.has(stops)) _rampRgb.set(stops, stops.map(_hex));
  return _rampRgb.get(stops);
}

function _ramp(stops, t){
  t = Math.max(0, Math.min(1, t));
  const p = t*(stops.length - 1), i = Math.min(stops.length - 2, Math.floor(p)), f = p - i, a = stops[i], b = stops[i+1];
  return [a[0] + (b[0] - a[0])*f, a[1] + (b[1] - a[1])*f, a[2] + (b[2] - a[2])*f];
}

/* lo..hi aralygy üçin şkala: 0-yň iki tarapynda hem ep-esli baha bolsa bölünýän, ýogsam yzygiderli */
function colorScale(lo, hi){
  const div = lo < 0 && hi > 0 && Math.min(-lo, hi) > 0.08*Math.max(-lo, hi);
  const M = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
  const t = v => div ? 0.5 + v/(2*M) : (hi > lo ? (v - lo)/(hi - lo) : 0.5);
  const pal = graphPalette(), stops = div ? pal.div : pal.seq, rgbStops = rampRgb(stops);
  return {
    diverging: div, lo: div ? -M : lo, hi: div ? M : hi,
    rgb: v => _ramp(rgbStops, t(v)),
    stops
  };
}

/* Bahalaryň aralygy: aşa uly bahalar (polýus) şkalany ezmez ýaly göterimler boýunça kesilýär */
function robustRange(values){
  const v = values.filter(isFinite).sort((p, q) => p - q);
  if(!v.length) return [-1, 1];
  const at = f => v[Math.min(v.length - 1, Math.max(0, Math.round(f*(v.length - 1))))];
  let lo = v[0], hi = v[v.length - 1];
  const p2 = at(0.02), p98 = at(0.98), span = p98 - p2;
  if(v.length > 30 && span > 0 && (hi - lo) > 6*span){ lo = Math.max(lo, p2 - 0.25*span); hi = Math.min(hi, p98 + 0.25*span); }
  if(!(hi - lo > 1e-12*Math.max(1, Math.abs(hi)))){ const c = (lo + hi)/2, d = Math.max(1e-6, Math.abs(c)*0.1, 0.5); lo = c - d; hi = c + d; }
  return [lo, hi];
}

/* HTML reňk zolagy: şkalanyň gradiýenti we gyralaryndaky bahalar */
function renderColorbar(id, scale, fmtFn, label){
  const el = document.getElementById(id);
  if(!el) return;
  const span = Math.abs(scale.hi - scale.lo) || 1;
  const f = v => { if(Math.abs(v) < 1e-6*span) return '0'; const s = String(Number(v.toPrecision(3))); return s.replace('-', '−'); };
  const mid = scale.diverging ? 0 : (scale.lo + scale.hi)/2;
  el.innerHTML = '<span class="cb-label">' + (label || '') + '</span>' +
    '<span class="cb-val">' + f(scale.lo) + '</span>' +
    '<span class="cb-bar" style="background:linear-gradient(90deg,' + scale.stops.join(',') + ')"></span>' +
    '<span class="cb-val">' + f(scale.hi) + '</span>' +
    '<span class="cb-mid">orta: ' + f(mid) + '</span>';
  el.style.display = '';
}

/* Ok (wektor) çyzmak: (x, y) nokatdan (x + dx, y + dy) nokada, uçunda üçburçluk */
function drawArrow(P, x, y, dx, dy, color, width, label){
  const x1 = P.X(x), y1 = P.Y(y), x2 = P.X(x + dx), y2 = P.Y(y + dy), ctx = P.ctx;
  if(![x1, y1, x2, y2].every(isFinite)) return;
  const len = Math.hypot(x2 - x1, y2 - y1);
  if(len < 1) return;
  const ux = (x2 - x1)/len, uy = (y2 - y1)/len, hl = Math.min(11, 0.4*len + 4);
  color = themeColor(color);
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width || 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - ux*hl*0.6, y2 - uy*hl*0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - ux*hl - uy*hl*0.45, y2 - uy*hl + ux*hl*0.45); ctx.lineTo(x2 - ux*hl + uy*hl*0.45, y2 - uy*hl - ux*hl*0.45); ctx.closePath(); ctx.fill();
  if(label){
    ctx.font = 'bold 12px Arial, Helvetica, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = graphPalette().halo;
    ctx.strokeText(label, x2 + ux*12, y2 + uy*12); ctx.fillText(label, x2 + ux*12, y2 + uy*12);
  }
  ctx.restore();
}

/* Kursoryň astyndaky bahany görkezmek: fn(x, y) → tekst. Her canvas üçin bir gezek baglanýar. */
function bindReadout(canvasId, readoutId, fn, idle){
  const canvas = document.getElementById(canvasId), out = document.getElementById(readoutId);
  if(!canvas || !out) return;
  canvas._readFn = fn; canvas._readIdle = idle || '';
  out.textContent = canvas._readIdle;
  if(canvas._readBound) return;
  canvas._readBound = true;
  const show = function(e){
    const P = canvas._P;
    if(!P || typeof canvas._readFn !== 'function') return;
    const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if(px < P.L || px > P.L + P.pw || py < P.T || py > P.T + P.ph){ out.textContent = canvas._readIdle; return; }
    const x = P.xMin + (px - P.L)/P.pw*(P.xMax - P.xMin), y = P.yMax - (py - P.T)/P.ph*(P.yMax - P.yMin);
    out.textContent = canvas._readFn(x, y);
  };
  canvas.addEventListener('mousemove', show);
  canvas.addEventListener('pointerdown', show);
  canvas.addEventListener('mouseleave', function(){ out.textContent = canvas._readIdle; });
}

/* Ýylylyk kartasy + derejeli egriler.
   F(x, y) → san; box: {xMin, xMax, yMin, yMax}
   o: {equal, levels (san ýa-da sanaw), range:[lo, hi], heat (true), mask(x, y) → bool, highlight:[{level, color, width, label}],
       arrows:[{x, y, dx, dy, color, label, width}], points:[{x, y, color, label}], segments:[{x1, y1, x2, y2, color, dash, width}],
       polylines:[{pts:[[x, y], ...], color, width, dash}], legend:[{label, color, dash}], colorbar:'id', fmt}
   Gaýtarýar: {scale, levels, undefinedShare} */
function plotField(canvasId, F, box, o){
  o = o || {};
  let out = null;
  const draw = function(){
    const P = makePlot(canvasId, box.xMin, box.xMax, box.yMin, box.yMax, draw, {equal: o.equal ? 'fit' : false});
    const ctx = P.ctx, nx = Math.max(40, Math.min(170, Math.round(P.pw/4))), ny = Math.max(24, Math.round(nx*P.ph/P.pw));
    const dx = (P.xMax - P.xMin)/nx, dy = (P.yMax - P.yMin)/ny, vals = [], flat = [];
    let undef = 0, total = 0;
    for(let j=0; j<=ny; j++){
      const row = [], y = P.yMin + j*dy;
      for(let i=0; i<=nx; i++){
        const x = P.xMin + i*dx, inside = !o.mask || o.mask(x, y);
        let v = inside ? F(x, y) : NaN;
        if(typeof v !== 'number') v = NaN;
        row.push(v);
        if(inside){ total++; if(isFinite(v)) flat.push(v); else undef++; }
      }
      vals.push(row);
    }
    const range = o.range || robustRange(flat), scale = colorScale(range[0], range[1]), pal = P.pal;
    P.axes();
    P.clip();
    if(o.heat !== false && flat.length){                                // ýylylyk kartasy: kiçi kanwa çyzyp ulaldylýar
      const off = document.createElement('canvas'); off.width = nx; off.height = ny;
      const octx = off.getContext('2d'), img = octx.createImageData(nx, ny);
      for(let j=0; j<ny; j++) for(let i=0; i<nx; i++){
        const a = vals[j][i], b = vals[j][i+1], c = vals[j+1][i], d = vals[j+1][i+1], k = 4*((ny - 1 - j)*nx + i);
        if(isFinite(a) && isFinite(b) && isFinite(c) && isFinite(d)){
          const col = scale.rgb((a + b + c + d)/4);
          img.data[k] = col[0]; img.data[k+1] = col[1]; img.data[k+2] = col[2]; img.data[k+3] = 215;
        } else { img.data[k] = pal.undef[0]; img.data[k+1] = pal.undef[1]; img.data[k+2] = pal.undef[2]; img.data[k+3] = (o.mask ? 0 : 255); }
      }
      octx.putImageData(img, 0, 0);
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(off, P.L, P.T, P.pw, P.ph); ctx.restore();
      P.vline(0, pal.heatAxis, []); P.hline(0, pal.heatAxis, []);   // koordinata oklary ýylylyk kartasynyň üstünde
    }
    let levels = Array.isArray(o.levels) ? o.levels : niceTicks(scale.lo, scale.hi, o.levels || 10);
    levels = levels.filter(c => c > range[0] && c < range[1]);
    ctx.save(); ctx.lineWidth = 1; ctx.lineCap = 'round';
    levels.forEach(c => {
      const segs = contourSegments(vals, P.xMin, P.yMin, dx, dy, c);
      ctx.strokeStyle = (scale.diverging && Math.abs(c) < 1e-12) ? pal.levelZero : pal.level;
      ctx.beginPath();
      segs.forEach(g => { ctx.moveTo(P.X(g[0]), P.Y(g[1])); ctx.lineTo(P.X(g[2]), P.Y(g[3])); });
      ctx.stroke();
    });
    ctx.restore();
    (o.highlight || []).forEach(h => {
      const segs = contourSegments(vals, P.xMin, P.yMin, dx, dy, h.level);
      ctx.save(); ctx.strokeStyle = themeColor(h.color || '#c9432f'); ctx.lineWidth = h.width || 2.6; ctx.lineCap = 'round'; ctx.beginPath();
      segs.forEach(g => { ctx.moveTo(P.X(g[0]), P.Y(g[1])); ctx.lineTo(P.X(g[2]), P.Y(g[3])); });
      ctx.stroke(); ctx.restore();
    });
    (o.polylines || []).forEach(pl => {
      ctx.save(); ctx.strokeStyle = themeColor(pl.color || '#2f77c9'); ctx.lineWidth = pl.width || 2; ctx.setLineDash(pl.dash || []); ctx.lineJoin = 'round';
      ctx.beginPath(); let on = false;
      pl.pts.forEach(p => {
        if(!isFinite(p[0]) || !isFinite(p[1])){ on = false; return; }
        if(on) ctx.lineTo(P.X(p[0]), P.Y(p[1])); else { ctx.moveTo(P.X(p[0]), P.Y(p[1])); on = true; }
      });
      ctx.stroke(); ctx.restore();
    });
    (o.segments || []).forEach(g => P.seg(g.x1, g.y1, g.x2, g.y2, g.color, g.dash, g.width));
    (o.arrows || []).forEach(a => drawArrow(P, a.x, a.y, a.dx, a.dy, a.color || '#c9432f', a.width, a.label));
    (o.points || []).forEach(p => P.dot(p.x, p.y, p.color || '#c9432f', {label: p.label}));
    P.unclip();
    P.legend(o.legend);
    if(o.colorbar) renderColorbar(o.colorbar, scale, o.fmt, o.colorbarLabel);
    out = {scale, levels, undefinedShare: total ? undef/total : 0, P};
  };
  draw();
  return out;
}

/* Grafikler üçin deň masştab: aralyklaryň gatnaşygy 1:2-den uly tapawutlanmasa */
function equalOk(box){ const r = (box.xMax - box.xMin)/(box.yMax - box.yMin); return r > 0.5 && r < 2; }

/* ===== modules/calculators/implicit.js ===== */
/* Anyk däl differensirlemek: F(x, y) = 0 egrisi (marching squares). */

/* F(x,y) = 0 egrisini (deň masştabda) çyzýar. opts: {segments:[...], points:[{x,y,color,label}], color} */
function plotImplicit(canvasId, F, cx, cy, halfW, opts){
  opts = opts || {};
  const P = makePlot(canvasId, cx - halfW, cx + halfW, cy - 1, cy + 1, () => plotImplicit(canvasId, F, cx, cy, halfW, opts), {equal:true});
  const ctx = P.ctx;
  P.axes(); P.clip();
  const nx = 240, ny = Math.max(20, Math.round(nx*P.ph/P.pw));
  const segs = marchingSquares(F, P.xMin, P.xMax, P.yMin, P.yMax, nx, ny, 0);
  ctx.save(); ctx.strokeStyle = themeColor(opts.color || '#2f77c9'); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
  segs.forEach(g => { ctx.moveTo(P.X(g[0]), P.Y(g[1])); ctx.lineTo(P.X(g[2]), P.Y(g[3])); });
  ctx.stroke(); ctx.restore();
  (opts.segments || []).forEach(g => P.seg(g.x1, g.y1, g.x2, g.y2, g.color, g.dash, g.width));
  (opts.points || []).forEach(p => P.dot(p.x, p.y, p.color || '#c9432f', {label:p.label}));
  P.unclip();
  P.legend(opts.legend);
}

/* Anyk däl differensirlemek: F(x, y) = 0 ⇒ dy/dx = −Fx/Fy */
function calcImplicit(){
  try{
    let src = document.getElementById('imp-f').value.trim();
    const parts = src.split('=');
    if(parts.length > 2){ showResult('imp-result', '<strong>Ýalňyşlyk:</strong> deňlemede diňe bir "=" belgisi bolup biler (mysal: x^2 + y^2 = 25).', true); return; }
    if(parts.length === 2) src = '(' + parts[0] + ') - (' + parts[1] + ')';
    const node = math.parse(prep(src)), Fc = node.compile();
    const F = (x, y) => { try{ const v = Fc.evaluate({x:x, y:y}); return typeof v === 'number' ? v : NaN; }catch(e){ return NaN; } };
    const x0 = parseBound(document.getElementById('imp-x0').value), y0 = parseBound(document.getElementById('imp-y0').value), w = Number(document.getElementById('imp-w').value);
    if(!isFinite(x0) || !isFinite(y0)){ showResult('imp-result', '<strong>Ýalňyşlyk:</strong> x₀ we y₀ anyk san bolmaly (mysal: 3 we 4).', true); return; }
    if(!(w > 0) || w > 1000){ showResult('imp-result', '<strong>Ýalňyşlyk:</strong> görnüşiň ini položitel san bolmaly (mysal: 7).', true); return; }
    const FxN = simplifySafe(math.derivative(node, 'x')), FyN = simplifySafe(math.derivative(node, 'y'));
    const FxC = FxN.compile(), FyC = FyN.compile();
    const ev = (c, x, y) => { try{ const v = c.evaluate({x:x, y:y}); return typeof v === 'number' ? v : NaN; }catch(e){ return NaN; } };
    const ratio = simplifySafe(new math.OperatorNode('/', 'divide', [new math.OperatorNode('-', 'unaryMinus', [FxN]), FyN]));
    const f0 = F(x0, y0), fx = ev(FxC, x0, y0), fy = ev(FyC, x0, y0);
    let html = `<strong>F(x, y) =</strong> ${prettyNode(simplifySafe(node))} <span class="muted" style="font-size:.82rem">(egri: F(x, y) = 0)</span><br>` +
      `<strong>F<sub>x</sub> =</strong> ${prettyNode(FxN)}<br><strong>F<sub>y</sub> =</strong> ${prettyNode(FyN)}<br>` +
      `<strong>dy/dx = −F<sub>x</sub>/F<sub>y</sub> =</strong> ${prettyNode(ratio)}<br>`;
    const opts = {points:[{x:x0, y:y0, color:'#c9432f'}], segments:[]};
    const onCurve = isFinite(f0) && Math.abs(f0) <= 1e-6*Math.max(1, Math.abs(x0), Math.abs(y0))**2;
    if(!isFinite(f0)){
      html += `<strong>Barlag:</strong> F(${fmt(x0)}, ${fmt(y0)}) kesgitlenmedik — nokat egriniň kesgitleniş ýaýlasynda däl.`;
      opts.points = [];
    } else if(!onCurve){
      html += `<strong>Barlag:</strong> F(${fmt(x0)}, ${fmt(y0)}) = ${fmt(f0)} ≠ 0 — nokat egrinde ýatmaýar. (x₀; y₀) nokady egrä getir.`;
    } else if(!isFinite(fx) || !isFinite(fy)){
      html += `<strong>Netije:</strong> F<sub>x</sub> ýa-da F<sub>y</sub> bu nokatda kesgitlenmedik.`;
    } else if(Math.abs(fy) < 1e-9 && Math.abs(fx) < 1e-9){
      html += `<strong>Netije:</strong> F<sub>x</sub> = F<sub>y</sub> = 0 — bu <i>aýratyn nokat</i> (mysal: düwün ýa-da burç), ýeke galtaşýan çyzyk ýok.`;
    } else if(Math.abs(fy) < 1e-9){
      html += `<strong>Barlag:</strong> F(${fmt(x0)}, ${fmt(y0)}) = 0 ✓<br><strong>Netije:</strong> F<sub>y</sub> = 0 we F<sub>x</sub> ≠ 0 — galtaşýan çyzyk <b>dik</b>: x = ${fmt(x0)}.`;
      opts.segments.push({x1:x0, y1:y0 - w, x2:x0, y2:y0 + w, color:'#3a9a3a', width:1.8});
    } else {
      const m = -fx/fy;
      html += `<strong>Barlag:</strong> F(${fmt(x0)}, ${fmt(y0)}) = 0 ✓<br><strong>(${fmt(x0)}; ${fmt(y0)}) nokatda:</strong> F<sub>x</sub> = ${fmt(fx)}, F<sub>y</sub> = ${fmt(fy)}, dy/dx = ${fmt(m)}<br>` +
        `<strong>Galtaşýan çyzyk:</strong> ${lineEq(m, x0, y0)} <span class="muted" style="font-size:.82rem">(y − y₀ = y′·(x − x₀))</span>`;
      const d = 0.9*w;
      opts.segments.push({x1:x0 - d, y1:y0 - m*d, x2:x0 + d, y2:y0 + m*d, color:'#3a9a3a', width:1.8});
    }
    showResult('imp-result', html, false);
    plotImplicit('imp-graph', F, x0, y0, w, opts);
  } catch(e){
    showResult('imp-result', '<strong>Ýalňyşlyk:</strong> Deňlemäni barlaň (mysal: x^2 + y^2 = 25, x*y = 1, x^3 + y^3 = 9*x*y). Diňe x we y üýtgeýjileri goldanýar.', true);
  }
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

/* ===== modules/calculators/integral.js ===== */
/* Integral hasaplaýjy: Simpson, elementar antiwönüm, Newton–Leibniz deňeşdirmesi. */

function integrateTermBasic(node){
  if(node.type==='ParenthesisNode') return integrateTerm(node.content);
  const whole = constVal(node);
  if(whole!==null) return `${whole}*x`;
  if(isX(node)) return 'x^2/2';
  if(node.type==='OperatorNode' && node.fn==='unaryMinus'){
    const inner = integrateTerm(node.args[0]); return inner===null ? null : `-(${inner})`;
  }
  if(node.type==='OperatorNode' && node.fn==='pow'){
    const [base,exp] = node.args;
    const n = constVal(exp);
    if(n!==null){
      if(isX(base)) return (n===-1) ? 'log(abs(x))' : `x^(${n+1})/(${n+1})`;
      const k1 = constVal(math.simplify(math.derivative(base,'x')));
      if(k1!==null && k1!==0){
        const bs = base.toString();
        return (n===-1) ? `log(abs(${bs}))/(${k1})` : `(${bs})^(${n+1})/((${n+1})*(${k1}))`;
      }
      return null;
    }
    const b = constVal(base);
    if(b!==null || isE(base)){
      const k2 = constVal(math.simplify(math.derivative(exp,'x')));
      if(k2===null || k2===0) return null;
      if(isE(base)) return `exp(${exp.toString()})/(${k2})`;
      return `(${b}^(${exp.toString()}))/((${k2})*log(${b}))`;
    }
    return null;
  }
  if(node.type==='OperatorNode' && node.fn==='multiply'){
    const [p,q] = node.args;
    const cp = constVal(p), cq = constVal(q);
    if(cp!==null){ const inner=integrateTerm(q); return inner===null?null:`${cp}*(${inner})`; }
    if(cq!==null){ const inner=integrateTerm(p); return inner===null?null:`${cq}*(${inner})`; }
    return null;
  }
  if(node.type==='OperatorNode' && node.fn==='divide'){
    const [p,q] = node.args;
    const cq = constVal(q);
    if(cq!==null){ const inner=integrateTerm(p); return inner===null?null:`(${inner})/(${cq})`; }
    const cp = constVal(p);
    if(cp!==null){
      if(q.type==='OperatorNode' && q.fn==='pow' && constVal(q.args[1])!==null){
        const m = constVal(q.args[1]);
        const rewritten = math.parse(`(${cp})*(${q.args[0].toString()})^(${-m})`);
        return integrateTerm(rewritten);
      }
      const k = constVal(math.simplify(math.derivative(q,'x')));
      if(k!==null && k!==0) return `${cp}*log(abs(${q.toString()}))/(${k})`;
    }
    return null;
  }
  if(node.type==='FunctionNode'){
    const n = node.fn.name, arg = node.args[0];
    if(!arg) return null;
    const argStr = arg.toString();
    let core = null;
    if(n==='sin') core = `-cos(${argStr})`;
    else if(n==='cos') core = `sin(${argStr})`;
    else if(n==='tan') core = `-log(abs(cos(${argStr})))`;
    else if(n==='exp') core = `exp(${argStr})`;
    else if(n==='sqrt') core = `(2*(${argStr})^(3/2))/3`;
    else if(n==='sinh') core = `cosh(${argStr})`;
    else if(n==='cosh') core = `sinh(${argStr})`;
    else if(n==='log') core = `(${argStr})*log(${argStr}) - (${argStr})`;
    if(core===null) return null;
    if(isX(arg)) return core;
    const k = constVal(math.simplify(math.derivative(arg,'x')));
    if(k===null || k===0) return null;
    return `(${core})/(${k})`;
  }
  return null;
}

/* F′(x) = f(x) deňligini birnäçe nokatda san taýdan barlaýar */
function verifyAntiderivative(F, f){
  const Ff = F.compile(), Fx = x => safeEval(xx => Ff.evaluate({x:xx}), x);
  const pts = [-2.3, -1.1, 0.4, 0.9, 1.7, 2.6], bad = [];
  let ok = 0;
  pts.forEach(x => {
    const h = 1e-5*Math.max(1, Math.abs(x)), d = (Fx(x+h) - Fx(x-h))/(2*h), y = safeEval(f, x);
    if(!isFinite(d) || !isFinite(y)) return;
    if(Math.abs(d - y) <= 1e-5*Math.max(1, Math.abs(y))) ok++; else bad.push(x);
  });
  if(bad.length) return `<span class="muted" style="font-size:.82rem">⚠ Barlag: F′(x) ≠ f(x) (x = ${bad.map(fmt).join(', ')}) — netijä ynanmazdan öň elde barlaň.</span><br>`;
  if(ok >= 3) return `<span class="muted" style="font-size:.82rem">✓ Barlag: F′(x) = f(x) (${ok} nokatda san taýdan gabat geldi)</span><br>`;
  return '';
}

/* x boýunça çyzykly u üçin u′ = k (hemişelik ≠ 0), ýogsam null */
function _linK(u){
  const k = constVal(math.simplify(math.derivative(u, 'x')));
  return (k !== null && k !== 0) ? k : null;
}

/* q(x) = c·x² + k görnüşli bolsa {c, k}, ýogsam null (san taýdan barlanýar) */
function _quadParams(q){
  const g = x => safeEval(xx => q.compile().evaluate({x:xx}), x);
  const f0 = g(0), f1 = g(1), fm1 = g(-1), f2 = g(2), fa = g(0.37);
  if(![f0, f1, fm1, f2, fa].every(isFinite)) return null;
  const c = (f1 + fm1)/2 - f0, k = f0, tol = 1e-9*Math.max(1, Math.abs(c), Math.abs(k));
  if(Math.abs(f1 - fm1) > tol || Math.abs(f2 - (4*c + k)) > tol || Math.abs(fa - (c*0.37*0.37 + k)) > tol) return null;
  return {c, k};
}

function _rootStr(v){ const r = Math.round(Math.sqrt(v)); return Math.abs(r*r - v) < 1e-9 ? String(r) : `sqrt(${Number(v.toPrecision(12))})`; }

/* esasy düzgünlerden daşary kadalar: sin², cos², tg², 1/cos², 1/sin², 1/(c·x²+k) → arctg, 1/√(k−c·x²) → arcsin, 1/√(çyzykly). Ulanylmasa undefined */
function integrateExtra(node){
  node = unwrap(node);
  if(node.type === 'OperatorNode' && node.fn === 'pow'){
    const base = unwrap(node.args[0]);
    if(base.type === 'FunctionNode' && base.args.length === 1 && constVal(node.args[1]) === 2){
      const u = base.args[0], k = _linK(u), us = u.toString();
      if(k === null) return undefined;
      switch(base.fn.name){
        case 'sin': return `((${us})/2 - sin(2*(${us}))/4)/(${k})`;
        case 'cos': return `((${us})/2 + sin(2*(${us}))/4)/(${k})`;
        case 'tan': return `(tan(${us}) - (${us}))/(${k})`;
        case 'sec': return `tan(${us})/(${k})`;
        case 'csc': return `-cot(${us})/(${k})`;
        case 'cot': return `(-cot(${us}) - (${us}))/(${k})`;
      }
    }
    return undefined;
  }
  if(node.type === 'OperatorNode' && node.fn === 'divide'){
    const cp = constVal(node.args[0]), q = unwrap(node.args[1]);
    if(cp === null) return undefined;
    if(q.type === 'OperatorNode' && q.fn === 'pow' && constVal(q.args[1]) === 2){
      const b = unwrap(q.args[0]);
      if(b.type === 'FunctionNode' && b.args.length === 1 && (b.fn.name === 'cos' || b.fn.name === 'sin')){
        const k = _linK(b.args[0]), us = b.args[0].toString();
        if(k === null) return undefined;
        return b.fn.name === 'cos' ? `${cp}*tan(${us})/(${k})` : `-(${cp})*cot(${us})/(${k})`;
      }
    }
    if(q.type === 'FunctionNode' && q.fn.name === 'sqrt' && q.args.length === 1){
      const u = q.args[0], k = _linK(u);
      if(k !== null) return `${cp}*2*sqrt(${u.toString()})/(${k})`;
      const w = _quadParams(u);
      if(w && w.c < 0 && w.k > 0){ const a = -w.c; return `${cp}/${_rootStr(a)}*asin(x*${_rootStr(a)}/${_rootStr(w.k)})`; }
      return undefined;
    }
    const w = _quadParams(q);
    if(w && w.c > 0 && w.k > 0) return `${cp}/(${_rootStr(w.c)}*${_rootStr(w.k)})*atan(x*${_rootStr(w.c)}/${_rootStr(w.k)})`;
  }
  return undefined;
}

function integrateTerm(node){
  const e = integrateExtra(node);
  return e !== undefined ? e : integrateTermBasic(node);
}

/* agza-agma antiwönüm: {F: ýönekeýleşdirilen aňlatma (Node) ýa-da null, stepsHtml, allOk} */
function antiderivativeOf(node){
  const terms = flattenSum(node, 1, []);
  const neg = n => new math.OperatorNode('-', 'unaryMinus', [n]);
  let stepsHtml = '<ol class="steps">', allOk = true, F = null;
  terms.forEach(t => {
    const r = integrateTerm(t.node), ng = t.sign < 0, integrand = prettyNode(ng ? neg(t.node) : t.node);
    if(r === null){
      stepsHtml += `<li>∫ ${integrand} dx — bu agza üçin antiwönüm awtomatik tapylmady.</li>`;
      allOk = false;
    } else {
      const rn = simplifySafe(math.parse(r)), shown = ng ? simplifySafe(neg(rn)) : rn;
      stepsHtml += `<li>∫ ${integrand} dx = ${prettyNode(shown)}</li>`;
      F = F === null ? shown : new math.OperatorNode('+', 'add', [F, shown]);
    }
  });
  stepsHtml += '</ol>';
  return {F: (allOk && F !== null) ? simplifySafe(F) : null, stepsHtml, allOk};
}

/* serhedi (ulanyjynyň ýazan görnüşinde) owadan görkezmek: pi → π, inf → ∞ */
function boundLabel(s){ return _esc(String(s).trim()).replace(/\bpi\b/gi, 'π').replace(/\binf\b|\bcheksiz\b/gi, '∞'); }

/* täze çözüji (usul saýlamak bilen), başartmasa köne agza-agma usul */
function solveIntegral(node){
  const IS = integrateSteps(node);
  if(IS.F) return {F: IS.F, stepsHtml: `<div class="steps-head">Usul: ${IS.method}</div><ol class="steps">${IS.steps.map(t => '<li>' + t + '</li>').join('')}</ol>`, checked: true};
  const AD = antiderivativeOf(node);
  return AD.F ? {F: AD.F, stepsHtml: AD.stepsHtml, checked: false} : {F: null, stepsHtml: '', checked: false};
}

function noAntiderivativeNote(node){
  return integralNonElementary(node)
    ? '<span class="muted" style="font-size:.82rem">Bellik: bu funksiýanyň antiwönümi elementar funksiýalar (köpagza, kök, eˣ, ln, sin, arctg …) arkaly aňladylmaýar — şonuň üçin kesgitli integral diňe san usuly bilen hasaplanýar.</span>'
    : '<span class="muted" style="font-size:.82rem">Bellik: bu aňlatma üçin antiwönüm awtomatik tapylmady; kesgitli integral san usuly bilen hasaplanýar.</span>';
}

/* ∫ f dx ýazgysy: jem bolsa skobkada */
function intSign(node){ const u = unwrap(node), t = prettyNode(node); return (u.type === 'OperatorNode' && (u.fn === 'add' || u.fn === 'subtract')) ? '(' + t + ')' : t; }

/* takyk bahany owadan ýazmak: 1/3 ≈ 0.333333, π/4 ≈ 0.785398; shortLabel — diňe 1/3, π/4 */
function exactLabel(v){
  const n = niceConst(v, 1e-9*Math.max(1, Math.abs(v)));
  const s = n.exact ? n.label : fmt(v);
  return s.charAt(0) === '-' ? '−' + s.slice(1) : s;
}

function shortLabel(v){ const s = exactLabel(v).split(' ≈ ')[0]; return s.charAt(0) === '−' ? '(' + s + ')' : s; }

function calcIntegral(){
  try{
    const node = math.parse(prep(document.getElementById('int-f').value));
    const fFn = node.compile(), f = removable(x => fFn.evaluate({x}));
    const aStr = document.getElementById('int-a').value.trim(), bStr = document.getElementById('int-b').value.trim();
    const AD = solveIntegral(node);
    const Fstr = AD.F ? integralPretty(AD.F) : null;

    if(aStr === '' && bStr === ''){                                   // kesgitlenmedik integral
      let html = `<strong>Kesgitlenmedik integral:</strong> ∫ ${intSign(node)} dx<br>` + (AD.stepsHtml ? `<strong>Çözgüt (ädimme-ädim):</strong>${AD.stepsHtml}` : '');
      if(AD.F){
        html += `<strong>Netije:</strong> ∫ f(x) dx = ${Fstr} + C<br>` + (AD.checked ? '' : verifyAntiderivative(AD.F, f));
        const Ff = AD.F.compile();
        showResult('int-result', html, false);
        plotFunctions('int-graph', [{fn:f, color:'#2f77c9', label:'f(x)'}, {fn:x => safeEval(xx => Ff.evaluate({x:xx}), x), color:'#c9432f', dash:[6,4], width:1.6, label:'F(x), C = 0'}], -5, 5, {});
      } else {
        html += noAntiderivativeNote(node);
        showResult('int-result', html, false);
        plotFunctions('int-graph', [{fn:f, color:'#2f77c9', label:'f(x)'}], -5, 5, {});
      }
      return;
    }
    if(aStr === '' || bStr === ''){
      showResult('int-result', '<strong>Ýalňyşlyk:</strong> a we b ikisini hem ýaz (ýa-da ikisini hem boş goý — onda kesgitlenmedik integral tapylýar).', true); return;
    }
    const a = parseBound(aStr), b = parseBound(bStr);
    if(!isFinite(a) || !isFinite(b)){
      showResult('int-result', '<strong>Ýalňyşlyk:</strong> a we b anyk san bolmaly. Çäksiz serhetli (improper) integraly Integral usullary sapagynda hasapla.', true); return;
    }
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const jump = hi > lo ? findJump(f, lo, hi) : null;
    if(jump !== null){
      showResult('int-result', `<strong>Netije:</strong> funksiýa x ≈ ${fmt(jump)} nokadynda üzülýär (kesgitlenmedik ýa-da çäksiz). Şonuň üçin [${fmt(lo)}; ${fmt(hi)}] aralykda adaty kesgitli integral ynamly hasaplanmaýar — bu <i>çäksiz (improper) integral</i> bolup, ýaýraýan bolmagy mümkin.`, true); return;
    }
    const numResult = simpson(f, a, b, 2000);
    if(!isFinite(numResult)){
      showResult('int-result', '<strong>Netije:</strong> Integral hasaplanyp bolmady — funksiýa [a, b] aralykda kesgitlenmedik ýa-da üzülýär.', true); return;
    }
    const A = boundLabel(aStr), B = boundLabel(bStr);
    let head = `<strong>Netije (san usuly, Simpson):</strong> ∫<sub>${A}</sub><sup>${B}</sup> ${intSign(node)} dx ≈ ${fmt(numResult)}`, body = AD.stepsHtml ? `<br><strong>Çözgüt (ädimme-ädim):</strong>${AD.stepsHtml}` : '<br>';
    if(AD.F){
      const Ff = AD.F.compile(), Fa = Ff.evaluate({x:a}), Fb = Ff.evaluate({x:b}), exact = Fb - Fa;
      body += `<strong>Antiwönüm:</strong> F(x) = ${Fstr} + C<br>` + (AD.checked ? '' : verifyAntiderivative(AD.F, f));
      if(typeof exact === 'number' && isFinite(exact) && Math.abs(exact - numResult) <= 1e-6*Math.max(1, Math.abs(numResult))){
        head = `<strong>Netije:</strong> ∫<sub>${A}</sub><sup>${B}</sup> ${intSign(node)} dx = ${exactLabel(exact)}`;
        body += `<strong>Nýuton–Leýbnisiň formulasy:</strong> ∫<sub>a</sub><sup>b</sup> f(x) dx = F(b) − F(a) = F(${B}) − F(${A}) = ${shortLabel(Fb).replace(/^\((.*)\)$/, '$1')} − ${shortLabel(Fa)} = <b>${exactLabel(exact)}</b><br>` +
          `<p class="check ok">✓ San usuly (Simpson, n = 2000) bilen barlag: ${fmt(numResult)} — tapawut ${fmt(Math.abs(exact - numResult))}.</p>`;
      } else {
        body += `<span class="muted" style="font-size:.82rem">Bellik: F(b) − F(a) san netijesi bilen gabat gelmedi — funksiýa [a, b] aralykda üznüksiz däl bolmagy mümkin, diňe san netijä ynanyň.</span>`;
      }
    } else {
      body += noAntiderivativeNote(node);
    }
    showResult('int-result', head + body, false);
    const pad = Math.max((hi - lo)*0.2, 0.5);
    plotFunctions('int-graph', [{fn:f, color:'#2f77c9'}], lo - pad, hi + pad, {fillBetween:{a, b}});
  } catch(e){
    showResult('int-result', '<strong>Ýalňyşlyk:</strong> Aňlatmany we serhetleri barlaň (mysal: x^2, sin(x), e^(-x)). Diňe x üýtgeýjisi goldanýar.', true);
  }
}

/* 8-nji sapak: integraly ädimme-ädim çözmek — usul saýlamak, ädimler, barlag, f we F grafigi */
function calcIntegralSteps(){
  try{
    const node = math.parse(prep(document.getElementById('is-f').value));
    const fFn = node.compile(), f = removable(x => fFn.evaluate({x}));
    const IS = integrateSteps(node);
    if(!IS.F){
      showResult('is-result', `<strong>∫ ${intSign(node)} dx</strong><br>` + noAntiderivativeNote(node) + '<br><span class="muted" style="font-size:.82rem">Synap görüň: x*e^x, x*sin(x), ln(x), 2*x/(x^2+1), 1/(x^2-1), sin(x)^2.</span>', false);
      plotFunctions('is-graph', [{fn:f, color:'#2f77c9', label:'f(x)'}], -5, 5, {});
      return;
    }
    const html = `<strong>Netije:</strong> ∫ ${intSign(node)} dx = ${integralPretty(IS.F)} + C<div class="steps-head">Saýlanan usul: ${IS.method}</div><ol class="steps">${IS.steps.map(t => '<li>' + t + '</li>').join('')}</ol>`;
    showResult('is-result', html, false);
    const Ff = IS.F.compile();
    plotFunctions('is-graph', [{fn:f, color:'#2f77c9', label:'f(x)'}, {fn:x => safeEval(xx => Ff.evaluate({x:xx}), x), color:'#c9432f', dash:[6,4], width:1.6, label:'F(x), C = 0'}], -5, 5, {});
  } catch(e){
    showResult('is-result', '<strong>Ýalňyşlyk:</strong> Aňlatmany barlaň (mysal: x*e^x, ln(x), 1/(x^2-1)). Diňe x üýtgeýjisi goldanýar.', true);
  }
}

/* ===== modules/calculators/integral-apps.js ===== */
/* Integralyň ulanylyşy: egriler arasyndaky meýdan, aýlanma göwrümi, ortaça baha, egriniň uzynlygy (Simpson usuly). */

function iaSimpson(h, a, b){
  const n = 2000, s = (b - a) / n;
  let t = h(a) + h(b);
  for(let i = 1; i < n; i++) t += (i % 2 ? 4 : 2) * h(a + i * s);
  return t * s / 3;
}

function iaDer(f, x){
  const h = 1e-6 * Math.max(1, Math.abs(x));
  let d = (f(x + h) - f(x - h)) / (2 * h);
  if(!isFinite(d)) d = (f(x + h) - f(x)) / h;
  if(!isFinite(d)) d = (f(x) - f(x - h)) / h;
  return d;
}

function calcIntegralApps(){
  try{
    const fFn = math.parse(prep(document.getElementById('ia-f').value)).compile();
    const gSrc = document.getElementById('ia-g').value.trim();
    const gFn = gSrc ? math.parse(prep(gSrc)).compile() : null;
    const f = x => safeEval(t => fFn.evaluate({x: t}), x);
    const g = gFn ? (x => safeEval(t => gFn.evaluate({x: t}), x)) : (() => 0);
    const a = parseBound(document.getElementById('ia-a').value), b = parseBound(document.getElementById('ia-b').value);
    if(!isFinite(a) || !isFinite(b) || a >= b) throw new Error('aralyk');
    const S = iaSimpson(x => Math.abs(f(x) - g(x)), a, b);
    const V = Math.PI * iaSimpson(x => Math.abs(f(x) * f(x) - g(x) * g(x)), a, b);
    const A = iaSimpson(f, a, b) / (b - a);
    const L = iaSimpson(x => Math.sqrt(1 + Math.pow(iaDer(f, x), 2)), a, b);
    if(![S, V, A, L].some(isFinite)) throw new Error('kesgitlenmedik');
    const row = (k, v) => `<tr><td>${k}</td><td>${fmt(v)}</td></tr>`;
    showResult('ia-result', `<strong>Netije (${fmt(a)} ≤ x ≤ ${fmt(b)}):</strong>${gFn ? '' : ' g(x) = 0 (x oky)'}<table class="conv"><tr><th>Ululyk</th><th>Baha</th></tr>${row('Meýdan S = ∫|f − g| dx', S)}${row('Göwrüm V = π∫|f² − g²| dx (x oky daşynda)', V)}${row('f-iň ortaça bahasy = (1/(b−a))∫f dx', A)}${row('f egrisiniň uzynlygy L = ∫√(1 + f′²) dx', L)}</table>`, false);
    const pad = (b - a) * 0.12;
    const fns = gFn ? [{fn:f, color:'#2f77c9', label:'f(x)'}, {fn:g, color:'#c9432f', label:'g(x)'}] : [{fn:f, color:'#2f77c9', label:'f(x)'}];
    plotFunctions('ia-graph', fns, a - pad, b + pad, {fillBetween:{a, b, lower:g}, markY: isFinite(A) ? A : undefined, legend:[{label:'ortaça baha', color:'#b3261e', dash:[4,3]}]});
  } catch(e){
    showResult('ia-result', '<strong>Ýalňyşlyk:</strong> Aňlatmalary we aralygy barlaň (mysal: x^2, sqrt(x), sin(x); aralyk: 0 we pi).', true);
  }
}

/* ===== modules/calculators/integral-methods.js ===== */
/* Integral usullary: antiwönümi önüm arkaly barlamak (math.js derivative), çäksiz integralyň ýygnaklylygy. */

function imSimpson(h, a, b, n){
  n = n || 2000;
  const s = (b - a) / n;
  let t = h(a) + h(b);
  for(let i = 1; i < n; i++) t += (i % 2 ? 4 : 2) * h(a + i * s);
  return t * s / 3;
}

function imFn(src){
  const c = math.parse(prep(src)).compile();
  return x => safeEval(t => c.evaluate({x: t}), x);
}

function calcAntiderivative(){
  try{
    const FSrc = document.getElementById('ad-anti').value;
    const f = imFn(document.getElementById('ad-f').value), F = imFn(FSrc);
    const a = parseBound(document.getElementById('ad-a').value), b = parseBound(document.getElementById('ad-b').value);
    if(!isFinite(a) || !isFinite(b) || a >= b) throw new Error('aralyk');
    let sym = '';
    try{ sym = math.derivative(math.parse(prep(FSrc)), 'x').toString(); }catch(e){}
    let err = 0, n = 0;
    for(let i = 0; i < 21; i++){
      const x = a + (b - a) * (i + 0.5) / 21, h = 1e-5 * Math.max(1, Math.abs(x));
      const d = (F(x + h) - F(x - h)) / (2 * h), y = f(x);
      if(!isFinite(d) || !isFinite(y)) continue;
      n++; err = Math.max(err, Math.abs(d - y) / Math.max(1, Math.abs(y)));
    }
    if(!n) throw new Error('barlag');
    const ok = err < 1e-5, S = imSimpson(f, a, b), N = F(b) - F(a);
    showResult('ad-result', `<strong>Barlag:</strong> ${ok ? '✓ F′(x) = f(x) — F dogry antiwönüm' : '✗ F′(x) ≠ f(x) — F antiwönüm däl'}<br>${sym ? 'math.js boýunça F′(x) = ' + sym + '<br>' : ''}Iň uly tapawut |F′ − f| ≈ ${err.toExponential(1)} (${n} nokatda)<br>∫<sub>a</sub><sup>b</sup> f dx (Simpson) = ${fmt(S)}<br>F(b) − F(a) = ${fmt(N)}${ok ? '' : ' (nädogry F üçin manysyz)'}`, !ok);
    const pad = (b - a) * 0.12;
    plotFunctions('ad-graph', [{fn:f, color:'#2f77c9', label:'f(x)'}, {fn:F, color:'#c9432f', label:'F(x)'}], a - pad, b + pad, {fillBetween:{a, b}});
  } catch(e){
    showResult('ad-result', '<strong>Ýalňyşlyk:</strong> f(x), F(x) we aralygy barlaň (mysal: x*e^x, e^x*(x-1); a = 0, b = 1).', true);
  }
}

function calcImproper(){
  try{
    const f = imFn(document.getElementById('ip-f').value), a = parseBound(document.getElementById('ip-a').value);
    if(!isFinite(a)) throw new Error('a');
    const I = [1, 2, 3, 4, 5].map(k => imSimpson(s => f(a - 1 + Math.exp(s)) * Math.exp(s), 0, Math.log(Math.pow(10, k) + 1), 4000));
    const rows = I.map((v, i) => `<tr><td>${fmt(a + Math.pow(10, i + 1))}</td><td>${fmt(v)}</td></tr>`).join('');
    const d4 = I[4] - I[3], d3 = I[3] - I[2];
    const concl = !I.every(isFinite) ? 'Hasaplap bolmady (funksiýa kesgitlenmedik ýa-da çäksiz).'
      : Math.abs(d4) < 1e-3 * Math.max(1, Math.abs(I[4])) ? `Ýygnaklanýar: ∫ f dx ≈ ${fmt(I[4])}`
      : Math.abs(d4) >= 0.9 * Math.abs(d3) ? 'Dargaýar (T ulalanda integral çäksiz ösýär ýa-da yrgyldaýar).'
      : 'Anyk däl: baha haýal üýtgeýär — p-düzgüni bilen barla.';
    showResult('ip-result', `<strong>Netije:</strong> ${concl}<br>T ulalanda ∫<sub>a</sub><sup>T</sup> f dx:<table class="conv"><tr><th>T</th><th>∫ f dx</th></tr>${rows}</table>`, false);
    plotFunctions('ip-graph', [{fn:f, color:'#2f77c9', label:'f(x)'}], a, a + 10, {fillBetween:{a, b:a + 10}});
  } catch(e){
    showResult('ip-result', '<strong>Ýalňyşlyk:</strong> Aňlatmany barlaň (mysal: 1/x^2, e^(-x); a = 1).', true);
  }
}

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

/* ===== modules/calculators/limit.js ===== */
/* Limit hasaplaýjy: ädimme-ädim algebraik çözgüt (limit-steps.js) + san taýdan barlag (ýakynlaşma tablisasy), grafik. */

const UNSTABLE_MSG = 'Baha durnuklaşmaýar (yrgyldaýar ýa-da örän haýal üýtgeýär) — limit anyk kesgitlenmedi.';

function limStepsHtml(S){
  return '<div class="steps-head">Çözgüt (ädimme-ädim):</div><ol class="steps">' + S.steps.map(t => '<li>' + t + '</li>').join('') + '</ol>';
}

/* netije setiri + barlag belligi */
function limVerdict(S, num, where, numConcl){
  const ok = limAgree(S.value, num), v = S.value;
  const head = () => (v && v.side)
    ? `lim(x→${where}${v.side > 0 ? '⁺' : '⁻'}) f(x) = ${limitValStr(v.v)} <span class="muted">(funksiýa diňe x ${v.side > 0 ? '&gt;' : '&lt;'} ${where} tarapda kesgitlenen)</span>`
    : `lim(x→${where}) f(x) = ${limitValStr(v)}`;
  if(ok === true) return {head: head(), note: '<p class="check ok">✓ San taýdan barlag (aşakdaky tablisa) şu jogaby tassyklaýar.</p>', open: false};
  if(ok === null && v !== null) return {head: head(), note: '<p class="check">San barlagy bu ýerde durnuksyz — jogap algebraik çözgütden alyndy.</p>', open: true};
  if(ok === false) return {head: numConcl, note: `<p class="check warn">⚠ Algebraik ädimleriň jogaby (${limitValStr(v)}) san barlagy bilen gabat gelmedi — san netijesi görkezildi. Aňlatmany we nokady barlaň.</p>`, open: true};
  return {head: numConcl, note: '', open: true};
}

function calcLimit(){
  try{
    const node = math.parse(prep(document.getElementById("lim-f").value));
    const fFn = node.compile();
    const evalAt = x => fFn.evaluate({x});
    const aRaw = document.getElementById("lim-a").value;
    const a = parseBound(aRaw);
    if(typeof a !== 'number' || isNaN(a)) throw new Error('a');
    let aNode = null;
    if(isFinite(a)){ try{ aNode = math.parse(prep(aRaw).trim().toLowerCase()); }catch(e){ aNode = null; } }
    const where = !isFinite(a) ? (a > 0 ? '+∞' : '−∞') : aNode ? prettyNode(aNode) : fmt(a);
    const S = limitSteps(node, a, where, aNode);

    if(!isFinite(a)){
      const sign = a>0?1:-1, xs=[10,100,1000,10000,100000];
      const vals = xs.map(x=>safeEval(evalAt, sign*x));
      const rows = xs.map((x,i)=>`<tr><td>${sign*x}</td><td>${fmt(vals[i])}</td></tr>`).join('');
      const c = classify(vals);
      const concl = c.t==='val' ? `lim(x→${where}) f(x) ≈ ${fmt(c.v)}`
        : c.t==='inf' ? `lim(x→${where}) f(x) = ${c.s>0?'+∞':'−∞'} (çäksiz)`
        : c.t==='nan' ? 'Funksiýa uly x-lerde kesgitlenmedik.' : UNSTABLE_MSG;
      const num = c.t==='val' ? {k:'val', v:c.v} : c.t==='inf' ? {k:'inf', s:c.s} : {k:'?'};
      const V = limVerdict(S, num, where, concl);
      showResult("lim-result", `<strong>Netije:</strong> ${V.head}${limStepsHtml(S)}${V.note}` +
        `<details class="numcheck"${V.open ? ' open' : ''}><summary>San taýdan barlag: x barha ulalanda f(x)-iň üýtgeýşi</summary><table class="conv"><tr><th>x</th><th>f(x)</th></tr>${rows}</table></details>`, false);
      plotFunctions("lim-graph", [{fn:evalAt, color:'#2f77c9'}], sign*1, sign*50, {});
      return;
    }

    const hs = [0.1, 0.01, 0.001, 0.0001, 0.00001];
    const Lv = hs.map(h=>safeEval(evalAt, a-h)), Rv = hs.map(h=>safeEval(evalAt, a+h));
    const rows = hs.map((h,i)=>`<tr><td>${h}</td><td>${fmt(Lv[i])}</td><td>${fmt(Rv[i])}</td></tr>`).join('');
    const L = classify(Lv), R = classify(Rv);
    let concl;
    if(L.t==='unstable' || R.t==='unstable') concl = UNSTABLE_MSG;
    else if(L.t==='nan' && R.t==='nan') concl = 'Funksiýa a-nyň golaýynda kesgitlenmedik — limit anyklanmady.';
    else if(L.t==='nan' || R.t==='nan'){
      const missing = L.t==='nan' ? 'çep' : 'sag', known = L.t==='nan' ? R : L, label = L.t==='nan' ? 'sag' : 'çep', sup = L.t==='nan' ? '⁺' : '⁻';
      concl = `Funksiýa ${where} nokadyň ${missing} tarapynda kesgitlenmedik — diňe ${label} limit bar: lim(x→${where}${sup}) f(x) ${known.t==='val' ? '≈' : '='} ${fmtSide(known)}.`;
    }
    else if(L.t==='val' && R.t==='val')
      concl = Math.abs(L.v-R.v) <= 1e-3*Math.max(1,Math.abs(L.v)) ? `lim(x→${where}) f(x) ≈ ${fmt(L.v)}` : `Limit ýok (çep limit ≈ ${fmt(L.v)}, sag limit ≈ ${fmt(R.v)}).`;
    else if(L.t==='inf' && R.t==='inf' && L.s===R.s) concl = `lim(x→${where}) f(x) = ${L.s>0?'+∞':'−∞'} (çäksiz)`;
    else concl = `Limit ýok (çep limit ${fmtSide(L)}, sag limit ${fmtSide(R)}).`;

    const V = limVerdict(S, numOutcome(L, R), where, concl);
    showResult("lim-result", `<strong>Netije:</strong> ${V.head}${limStepsHtml(S)}${V.note}` +
      `<details class="numcheck"${V.open ? ' open' : ''}><summary>San taýdan barlag: h kiçelende f(a−h) we f(a+h)-iň ýakynlaşyşy</summary><table class="conv"><tr><th>h</th><th>f(a−h)</th><th>f(a+h)</th></tr>${rows}</table></details>`, false);
    const gOpts = {markX:a};
    if(L.t==='val' && R.t==='val' && Math.abs(L.v-R.v) <= 1e-3*Math.max(1,Math.abs(L.v))){
      const lim = (typeof S.value === 'number' && isFinite(S.value) && Math.abs(S.value - L.v) <= 2e-3*Math.max(1, Math.abs(L.v))) ? S.value : (L.v+R.v)/2, fa = safeEval(evalAt, a);
      if(isFinite(fa) && Math.abs(fa-lim) <= 1e-3*Math.max(1,Math.abs(lim))) gOpts.points = [{x:a, y:fa, color:'#2f77c9'}];
      else { gOpts.holes = [{x:a, y:lim, color:'#2f77c9'}]; if(isFinite(fa)) gOpts.points = [{x:a, y:fa, color:'#c9432f'}]; }
    }
    plotFunctions("lim-graph", [{fn:evalAt, color:'#2f77c9'}], a-5, a+5, gOpts);
  } catch(e){
    showResult("lim-result", "<strong>Ýalňyşlyk:</strong> Aňlatmany barlaň (mysal: x^2, sin(x), e^x, ln(x)).", true);
  }
}

/* ===== modules/graphs/surface3d.js ===== */
/* 3D grafik: z = f(x, y) üstleri, nokatlar we egriler. Programma 3D-si (perspektiwa + suratkeşiň algoritmi),
   syçan / barmak bilen aýlamak, klawiatura (oklar, +/−, Home) we düwmeler (.view3d-ctrl) arkaly dolandyrmak. */

const S3_DEFAULT_VIEW = {az: -0.72, el: 0.52, zoom: 1};

const S3_LIGHT = (function(){ const v = [-0.42, 0.55, 0.72], n = Math.hypot(v[0], v[1], v[2]); return v.map(c => c/n); })();

const S3_FONT = '11px Arial, Helvetica, sans-serif';

function s3Tick(v){
  if(v === 0) return '0';
  const a = Math.abs(v);
  return (a >= 1e5 || a < 1e-3) ? Number(v.toPrecision(2)).toExponential().replace('e+', 'e') : String(Number(v.toPrecision(4)));
}

function s3HexRgb(h){
  const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
  if(!m) return [47, 119, 201];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* scene: {box:{xMin, xMax, yMin, yMax}, surfaces:[{f(x, y), n, mask(x, y) ýa-da param(s, v) → [x, y], color, alpha, mesh, excludeRange}], points:[{x, y, z, color, label}],
           curves:[{pts:[[x, y, z], ...], color, width}], floorCurves:[{pts:[[x, y], ...], color, width}], zRange:[lo, hi],
           labels:{x, y, z}, colorbar:'id', fmt} — birinji üst beýiklige görä reňklenýär (color berilmese). */
function plotSurface3D(canvasId, scene){
  const canvas = document.getElementById(canvasId);
  if(!canvas) throw new Error('canvas tapylmady: ' + canvasId);
  if(!canvas._view) canvas._view = Object.assign({}, S3_DEFAULT_VIEW);
  s3Bind(canvas);
  const box = scene.box, xSpan = box.xMax - box.xMin, ySpan = box.yMax - box.yMin, maxSpan = Math.max(xSpan, ySpan);
  const ax = Math.max(0.45, xSpan/maxSpan), ay = Math.max(0.45, ySpan/maxSpan);
  let zh = 0.62;
  const xMid = (box.xMin + box.xMax)/2, yMid = (box.yMin + box.yMax)/2;

  // 1) Gözenekler: her üst üçin (x, y, z) depeler. s.param(s, v) → [x, y] berlen bolsa, gözenek oblasta "geýdirilýär"
  //    (birlik kwadrat oblasta şekillendirilýär) — oblastyň gyrasy tekiz bolýar.
  const grids = (scene.surfaces || []).map((s, si) => {
    const n = s.n || (s.mask ? 46 : 36), z = [], X = [], Y = [];
    for(let j=0; j<=n; j++){
      const row = [], rx = [], ry = [];
      for(let i=0; i<=n; i++){
        let x, y;
        if(s.param){ const q = s.param(i/n, j/n); x = q[0]; y = q[1]; }
        else { x = box.xMin + xSpan*i/n; y = box.yMin + ySpan*j/n; }
        let v = NaN;
        if(isFinite(x) && isFinite(y) && (s.param || !s.mask || s.mask(x, y))){ try{ v = s.f(x, y); }catch(e){ v = NaN; } }
        row.push(typeof v === 'number' ? v : NaN); rx.push(x); ry.push(y);
      }
      z.push(row); X.push(rx); Y.push(ry);
    }
    return {s, n, z, X, Y, colored: si === 0 && !s.color};
  });
  let zr = scene.zRange;
  if(!zr){
    const all = [];
    grids.forEach(g => { if(!g.s.excludeRange) g.z.forEach(r => r.forEach(v => { if(isFinite(v)) all.push(v); })); });
    (scene.points || []).forEach(p => { if(isFinite(p.z)) all.push(p.z); });
    zr = robustRange(all);
    const pad = 0.04*(zr[1] - zr[0]); zr = [zr[0] - pad, zr[1] + pad];
  }
  const zLo = zr[0], zHi = zr[1], zSpan = zHi - zLo, zMid = (zLo + zHi)/2;
  if(scene.equalZ) zh = Math.max(0.35, Math.min(1.3, zSpan/maxSpan));   // jisimler üçin hakyky gatnaşyklar (şar tegelek görünýär)
  const colorG = grids.find(g => g.colored);
  let scaleRange = null;                                          // reňk şkalasy her çyzylanda häzirki tema üçin gurulýar
  if(colorG){ const vals = []; colorG.z.forEach(r => r.forEach(v => { if(isFinite(v) && v >= zLo && v <= zHi) vals.push(v); })); scaleRange = vals.length ? robustRange(vals) : [zLo, zHi]; }
  const W = (x, y, z) => [(x - xMid)/(xSpan/2)*ax, (y - yMid)/(ySpan/2)*ay, (z - zMid)/(zSpan/2)*zh];

  // 2) Dörtburçluklar (dünýä koordinatalarynda): depelerin, ortaça beýiklik (reňk üçin), normal
  const quads = [];
  grids.forEach(g => {
    const n = g.n, tol = 0.02*zSpan, alpha = g.s.alpha === undefined ? 1 : g.s.alpha;
    const fixed = g.s.color || (g.colored ? null : '');          // null — beýiklige görä reňk, '' — çal
    for(let j=0; j<n; j++) for(let i=0; i<n; i++){
      const zz = [g.z[j][i], g.z[j][i+1], g.z[j+1][i+1], g.z[j+1][i]];
      if(!zz.every(v => isFinite(v) && v >= zLo - tol && v <= zHi + tol)) continue;
      const xs = [g.X[j][i], g.X[j][i+1], g.X[j+1][i+1], g.X[j+1][i]], ys = [g.Y[j][i], g.Y[j][i+1], g.Y[j+1][i+1], g.Y[j+1][i]];
      const v = [0, 1, 2, 3].map(k => W(xs[k], ys[k], zz[k]));
      const d1 = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]], d2 = [v[3][0] - v[1][0], v[3][1] - v[1][1], v[3][2] - v[1][2]];
      const nn = [d1[1]*d2[2] - d1[2]*d2[1], d1[2]*d2[0] - d1[0]*d2[2], d1[0]*d2[1] - d1[1]*d2[0]], nl = Math.hypot(nn[0], nn[1], nn[2]);
      if(!(nl > 1e-12)) continue;                                  // nokada ýygrylan öýjük (mysal, polýar merkezde)
      quads.push({v, nrm: nn.map(c => c/nl), zm: (zz[0] + zz[1] + zz[2] + zz[3])/4, fixed, alpha, mesh: g.s.mesh !== false && n <= 48, bias: g.s.depthBias || 0});
    }
  });

  let cbDark = null;
  const draw = function(){
    const P = makePlot(canvasId, 0, 1, 0, 1, draw, {noLabels: true}), ctx = P.ctx, view = canvas._view, pal = P.pal, dark = graphDark();
    const scale = scaleRange ? colorScale(scaleRange[0], scaleRange[1]) : null, fixedRgb = {};
    const quadRgb = q => q.fixed === null ? scale.rgb(q.zm) : q.fixed ? (fixedRgb[q.fixed] || (fixedRgb[q.fixed] = s3HexRgb(themeColor(q.fixed)))) : [150, 150, 150];
    const ca = Math.cos(view.az), sa = Math.sin(view.az), ce = Math.cos(view.el), se = Math.sin(view.el);
    const vext = Math.max(1.32, zh*Math.abs(ce) + 1.414*Math.max(ax, ay)*Math.abs(se));
    const Rr = Math.min((P.W/2 - 34)/1.5, (P.H/2 - 16)/vext)*view.zoom, cx = P.W/2, cy = P.H/2 + 6, D = 6;
    const rot = p => { const x1 = p[0]*ca - p[1]*sa, y1 = p[0]*sa + p[1]*ca; return [x1, p[2]*ce + y1*se, -y1*ce + p[2]*se]; };
    const proj = p => { const r = rot(p), s = D/(D - r[2]); return [cx + Rr*r[0]*s, cy - Rr*r[1]*s, r[2]]; };
    ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, P.W, P.H);

    // pol (z = zLo) we gözenek
    const fz = -zh, corners = [[-ax, -ay, fz], [ax, -ay, fz], [ax, ay, fz], [-ax, ay, fz]].map(proj);
    ctx.save();
    ctx.fillStyle = pal.floor; ctx.strokeStyle = pal.floorLine; ctx.lineWidth = 1;
    ctx.beginPath(); corners.forEach((c, k) => k ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1])); ctx.closePath(); ctx.fill(); ctx.stroke();
    const xt = niceTicks(box.xMin, box.xMax, 5), yt = niceTicks(box.yMin, box.yMax, 5);
    ctx.strokeStyle = pal.floorGrid; ctx.beginPath();
    xt.forEach(t => { const X = (t - xMid)/(xSpan/2)*ax, a = proj([X, -ay, fz]), b = proj([X, ay, fz]); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); });
    yt.forEach(t => { const Y = (t - yMid)/(ySpan/2)*ay, a = proj([-ax, Y, fz]), b = proj([ax, Y, fz]); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); });
    ctx.stroke();
    // z oky: iň daşdaky burçda dik çyzyk
    let far = 0; corners.forEach((c, k) => { if(c[2] < corners[far][2]) far = k; });
    const fc = [[-ax, -ay], [ax, -ay], [ax, ay], [-ax, ay]][far], zb = proj([fc[0], fc[1], -zh]), zt = proj([fc[0], fc[1], zh]);
    ctx.strokeStyle = pal.zAxis; ctx.beginPath(); ctx.moveTo(zb[0], zb[1]); ctx.lineTo(zt[0], zt[1]); ctx.stroke();
    const zTicks = niceTicks(zLo, zHi, 4), leftSide = zb[0] < cx;
    ctx.font = S3_FONT; ctx.fillStyle = pal.tick; ctx.textBaseline = 'middle'; ctx.textAlign = leftSide ? 'right' : 'left';
    zTicks.forEach(t => {
      const p = proj([fc[0], fc[1], (t - zMid)/(zSpan/2)*zh]);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + (leftSide ? -4 : 4), p[1]); ctx.stroke();
      ctx.fillText(s3Tick(t), p[0] + (leftSide ? -6 : 6), p[1]);
    });
    ctx.font = 'bold 12px Arial, Helvetica, sans-serif'; ctx.fillStyle = pal.label; ctx.textAlign = 'center';
    ctx.fillText((scene.labels && scene.labels.z) || 'z', zt[0], zt[1] - 9);
    // x we y belgileri: tomaşaça has ýakyn gyralarda
    const edgeLabels = function(ticks, isX){
      const sides = isX ? [[-ay], [ay]] : [[-ax], [ax]];
      const pick = sides.map(s => { const m = isX ? proj([0, s[0], fz]) : proj([s[0], 0, fz]); return {s: s[0], w: m[2], m}; }).sort((p, q) => q.w - p.w)[0];
      const fcx = (corners[0][0] + corners[2][0])/2, fcy = (corners[0][1] + corners[2][1])/2;
      let ox = pick.m[0] - fcx, oy = pick.m[1] - fcy; const ol = Math.hypot(ox, oy) || 1; ox /= ol; oy /= ol;
      ctx.font = S3_FONT; ctx.fillStyle = pal.tick; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ticks.forEach(t => {
        const c = isX ? (t - xMid)/(xSpan/2)*ax : (t - yMid)/(ySpan/2)*ay, p = isX ? proj([c, pick.s, fz]) : proj([pick.s, c, fz]);
        ctx.fillText(s3Tick(t), p[0] + ox*13, p[1] + oy*11);
      });
      ctx.font = 'bold 12px Arial, Helvetica, sans-serif'; ctx.fillStyle = pal.label;
      ctx.fillText((scene.labels && scene.labels[isX ? 'x' : 'y']) || (isX ? 'x' : 'y'), pick.m[0] + ox*30, pick.m[1] + oy*27);
    };
    edgeLabels(xt, true); edgeLabels(yt, false);
    (scene.floorCurves || []).forEach(c => {
      ctx.strokeStyle = themeColor(c.color || '#154a92'); ctx.lineWidth = c.width || 1.6; ctx.setLineDash(c.dash || []); ctx.beginPath(); let on = false;
      c.pts.forEach(p => { if(!isFinite(p[0]) || !isFinite(p[1])){ on = false; return; } const q = proj(W(p[0], p[1], zLo)); if(on) ctx.lineTo(q[0], q[1]); else { ctx.moveTo(q[0], q[1]); on = true; } });
      ctx.stroke(); ctx.setLineDash([]);
    });
    ctx.restore();

    // üstler: daşdakydan ýakyndaka
    const items = quads.map(q => {
      const pr = q.v.map(proj), r = rot(q.nrm), lam = Math.abs(r[0]*S3_LIGHT[0] + r[1]*S3_LIGHT[1] + r[2]*S3_LIGHT[2]);
      return {pr, depth: (pr[0][2] + pr[1][2] + pr[2][2] + pr[3][2])/4 + q.bias, sh: 0.58 + 0.42*lam, q, rgb: quadRgb(q)};
    }).sort((p, q) => p.depth - q.depth);
    ctx.save(); ctx.lineJoin = 'round';
    items.forEach(it => {
      const c = it.rgb, k = it.sh, col = 'rgba(' + Math.round(Math.min(255, c[0]*k)) + ',' + Math.round(Math.min(255, c[1]*k)) + ',' + Math.round(Math.min(255, c[2]*k)) + ',' + it.q.alpha + ')';
      ctx.beginPath(); it.pr.forEach((p, m) => m ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.lineWidth = 0.6; ctx.strokeStyle = it.q.mesh ? 'rgba(' + pal.mesh + ',' + (0.2*it.q.alpha) + ')' : col; ctx.stroke();
    });
    ctx.restore();

    // egriler we nokatlar (üstde)
    (scene.curves || []).forEach(c => {
      ctx.save(); ctx.strokeStyle = themeColor(c.color || '#c9432f'); ctx.lineWidth = c.width || 2.2; ctx.lineJoin = 'round'; ctx.setLineDash(c.dash || []);
      ctx.beginPath(); let on = false;
      c.pts.forEach(p => {
        if(!p.every(isFinite) || p[2] < zLo - 0.02*zSpan || p[2] > zHi + 0.02*zSpan){ on = false; return; }
        const q = proj(W(p[0], p[1], p[2]));
        if(on) ctx.lineTo(q[0], q[1]); else { ctx.moveTo(q[0], q[1]); on = true; }
      });
      ctx.stroke(); ctx.restore();
    });
    (scene.points || []).forEach(p => {
      if(![p.x, p.y, p.z].every(isFinite)) return;
      const q = proj(W(p.x, p.y, p.z)), pc = themeColor(p.color || '#c9432f');
      ctx.save(); ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, 2*Math.PI); ctx.fillStyle = pc; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = pal.ring; ctx.stroke();
      if(p.label){
        ctx.font = 'bold 11px Arial, Helvetica, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.lineWidth = 3; ctx.strokeStyle = pal.halo; ctx.strokeText(p.label, q[0] + 7, q[1] - 4);
        ctx.fillStyle = pc; ctx.fillText(p.label, q[0] + 7, q[1] - 4);
      }
      ctx.restore();
    });
    // reňk zolagy: ilkinji gezek we tema çalşylanda (aýlananda gaýtadan ýazylmaýar)
    if(scene.colorbar && scale && dark !== cbDark){ cbDark = dark; renderColorbar(scene.colorbar, scale, scene.fmt, 'z reňki:'); }
  };
  draw();
  return {zRange: [zLo, zHi], scale: scaleRange ? colorScale(scaleRange[0], scaleRange[1]) : null, cells: quads.length};
}

/* Syçan / barmak / klawiatura bilen aýlamak (her canvas üçin bir gezek) */
function s3Bind(canvas){
  if(canvas._s3Bound) return;
  canvas._s3Bound = true;
  canvas.classList.add('graph3d');
  if(!canvas.hasAttribute('tabindex')) canvas.setAttribute('tabindex', '0');
  let drag = null, pending = false;
  const redraw = function(){
    if(pending) return;
    pending = true;
    requestAnimationFrame(function(){ pending = false; if(typeof canvas._redraw === 'function') canvas._redraw(); });
  };
  canvas._s3Redraw = redraw;
  canvas.addEventListener('pointerdown', function(e){
    if(e.button !== 0) return;
    drag = {x: e.clientX, y: e.clientY};
    try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
  });
  canvas.addEventListener('pointermove', function(e){
    if(!drag) return;
    const v = canvas._view;
    v.az -= (e.clientX - drag.x)*0.009;
    v.el = Math.max(-0.15, Math.min(1.55, v.el + (e.clientY - drag.y)*0.009));
    drag = {x: e.clientX, y: e.clientY};
    redraw();
  });
  const stop = function(){ drag = null; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('dblclick', function(){ canvas._view = Object.assign({}, S3_DEFAULT_VIEW); redraw(); });
  canvas.addEventListener('keydown', function(e){
    if(s3Step(canvas, {ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', '+': 'in', '=': 'in', '-': 'out', Home: 'reset', '0': 'reset'}[e.key])) e.preventDefault();
  });
}

function s3Step(canvas, act){
  if(!act || !canvas._view) return false;
  const v = canvas._view;
  if(act === 'left') v.az += 0.2;
  else if(act === 'right') v.az -= 0.2;
  else if(act === 'up') v.el = Math.min(1.55, v.el + 0.15);
  else if(act === 'down') v.el = Math.max(-0.15, v.el - 0.15);
  else if(act === 'in') v.zoom = Math.min(2.2, v.zoom*1.15);
  else if(act === 'out') v.zoom = Math.max(0.5, v.zoom/1.15);
  else if(act === 'reset') canvas._view = Object.assign({}, S3_DEFAULT_VIEW);
  else return false;
  if(typeof canvas._s3Redraw === 'function') canvas._s3Redraw();
  return true;
}

/* <div class="view3d-ctrl" data-for="canvasId"> içindäki <button data-view3d="left|right|up|down|in|out|reset"> düwmeleri */
function initView3dControls(){
  document.addEventListener('click', function(e){
    const b = e.target && e.target.closest ? e.target.closest('button[data-view3d]') : null;
    if(!b) return;
    const wrap = b.closest('.view3d-ctrl'), canvas = wrap && document.getElementById(wrap.getAttribute('data-for'));
    if(canvas) s3Step(canvas, b.getAttribute('data-view3d'));
  });
}

/* ===== modules/solvers/multi-common.js ===== */
/* Köp üýtgeýjili ädimli çözüjileriň umumy kömekçileri: math.js düwünlerini gurmak, goýmak (substitution), hemişelik bölekleri hasaplamak,
   owadan sanlar (√2/2, π/2), formulany görkezmek we köpagzanyň hakyky kökleri (xᵏ köpeldiji, t = xᵍ, rasional kökler). */

const msN = v => new math.ConstantNode(v);

const msSym = n => new math.SymbolNode(n);

const msOp = (op, fn, a) => new math.OperatorNode(op, fn, a);

const msAdd = (a, b) => msOp('+', 'add', [a, b]);

const msSub = (a, b) => msOp('-', 'subtract', [a, b]);

const msMul = (a, b) => msOp('*', 'multiply', [a, b]);

const msDiv = (a, b) => msOp('/', 'divide', [a, b]);

const msPow = (a, b) => msOp('^', 'pow', [a, b]);

const msNeg = a => msOp('-', 'unaryMinus', [a]);

const msNodes = {msN, msSym, msAdd, msSub, msMul, msDiv, msPow, msNeg};

function msHas(n, v){ let f = false; n.traverse((c, path) => { if(c.type === 'SymbolNode' && path !== 'fn' && c.name === v) f = true; }); return f; }

function msSubst(n, map){ return n.transform((m, path) => (m.type === 'SymbolNode' && path !== 'fn' && map[m.name]) ? map[m.name] : m); }

function msEval(n){
  const c = n.compile();
  return sc => { try{ const v = c.evaluate(Object.assign({}, sc)); return typeof v === 'number' ? v : NaN; }catch(e){ return NaN; } };
}

function msConstTree(n){
  let ok = true;
  n.traverse((c, path) => { if(c.type === 'SymbolNode' && path !== 'fn' && c.name !== 'pi' && c.name !== 'e') ok = false; });
  return ok;
}

function msConstVal(n){ try{ const v = n.compile().evaluate({}); return (typeof v === 'number' && isFinite(v)) ? v : null; }catch(e){ return null; } }

/* san → owadan düwün (2, 3/5, √3/3, π/2) ýa-da null (onluk drob bolsa) */
function msNiceNode(v){
  if(!isFinite(v)) return null;
  const s = fmtNice(v);
  if(/[.e]/.test(s)) return null;
  try{ return math.parse(prep(s)); }catch(e){ return null; }
}

function msNum(v){ return msNiceNode(v) || (v < 0 ? msNeg(msN(-v)) : msN(v)); }

/* hemişelik bölekleri hasaplamak: sin(π/2) → 1, e^(−0²) → 1, (−1)² → 1; owadan bolmasa (e⁻⁹, ln 2) şol görnüşde galýar */
function msFold(n){
  return n.transform(m => {
    if(m.type === 'ConstantNode' || m.type === 'SymbolNode' || m.type === 'ParenthesisNode') return m;
    if(!msConstTree(m)) return m;
    const v = msConstVal(m), nn = v === null ? null : msNiceNode(v);
    return nn || m;
  });
}

const msP = (n, K) => prettyVar(n, K);

const msNest = (title, items) => title + (items.length ? '<ol class="steps sub">' + items.map(s => '<li>' + s + '</li>').join('') + '</ol>' : '');

/* köpeltmekde san: otrisatel ýa-da drob bolsa skobkada */
function msNumP(v){ const s = fmtNice(v); return /^(\d+(\.\d+)?|\d*π|√\d+)$/.test(s) ? s : '(' + s + ')'; }

function msK(vals){ const K = {}; Object.keys(vals).forEach(k => { K[k] = msNum(vals[k]); }); return K; }

/* "x = 2" ýa-da "x ≈ 0.739" */
function msEqLbl(v){ const s = fmtNice(v); return /[.e]/.test(s) ? '≈ ' + s : '= ' + s; }

function msPt(x, y){ return '(' + fmtNice(x) + '; ' + fmtNice(y) + ')'; }

function msGcd(a, b){ a = Math.abs(a); b = Math.abs(b); while(b){ const t = a % b; a = b; b = t; } return a; }

/* √v owadan görnüşde (5√17, √2/2) ýa-da null */
function msSqrtNice(v){
  if(!(v >= 0)) return null;
  if(v < 1e-14) return '0';
  const r = ratApprox(v, 1000, 1e-10);
  if(!r || r[0]*r[1] > 1e8) return null;
  const pq = r[0]*r[1];
  let s = 1, m = pq;
  for(let k = 2; k*k <= m; k++) while(m % (k*k) === 0){ m /= k*k; s *= k; }
  const g = msGcd(s, r[1]), S = s/g, Q = r[1]/g;
  const core = m === 1 ? String(S) : (S === 1 ? '' : S) + '√' + m;
  return Q === 1 ? core : core + '/' + Q;
}

/* √(a² + b²) = … */
function msNormStr(a, b){
  const v = Math.hypot(a, b), n2 = a*a + b*b, n2s = fmtNice(n2), nice = msSqrtNice(n2);
  let s = '√(' + msNumP(a) + '² + ' + msNumP(b) + '²)';
  if(nice === null) return s + ' ≈ ' + fmt(v);
  if(!/√/.test(nice)) return s + ' = ' + nice;
  if('√' + n2s !== nice && !/[.e]/.test(n2s)) s += ' = √' + (/\//.test(n2s) ? '(' + n2s + ')' : n2s);
  return s + ' = ' + nice + ' ≈ ' + fmt(v);
}

/* köpagzanyň hakyky kökleri (islendik dereje): xᵏ köpeldiji, t = xᵍ ornuna goýma, rasional kökler, galan ýagdaýda san usuly */
function msPolyBasic(c){
  c = c.slice();
  while(c.length > 1 && Math.abs(c[c.length - 1]) < 1e-14) c.pop();
  if(c.length - 1 <= 3){ const R = polyRealRoots(c); return R ? R.roots.map(r => r.x) : (c.length === 1 ? [] : null); }
  const roots = [];
  if(c.every(v => Math.abs(v - Math.round(v)) < 1e-9) && Math.abs(c[0]) <= 1e6 && Math.abs(c[c.length - 1]) <= 1e6){
    const divs = n => { n = Math.abs(Math.round(n)); const d = []; for(let i = 1; i <= Math.min(n, 2000); i++) if(n % i === 0) d.push(i); return d; };
    let P = c.map(Math.round), again = true;
    while(again && P.length - 1 > 3 && Math.abs(P[0]) > 0){
      again = false;
      for(const p of divs(P[0])) for(const q of divs(P[P.length - 1])) for(const s of [1, -1]){
        const r = s*p/q, D = polyDivLinear(P, r);
        if(Math.abs(D.r) < 1e-9*Math.max(1, ...P.map(Math.abs))){ roots.push(r); P = D.q.map(v => Math.round(v*1e9)/1e9); again = true; break; }
      }
    }
    c = P;
  }
  if(c.length - 1 <= 3){ const R = polyRealRoots(c); return R ? roots.concat(R.roots.map(r => r.x)) : null; }
  const B = 1 + Math.max(...c.slice(0, -1).map(v => Math.abs(v/c[c.length - 1])));
  return roots.concat(findRoots(x => polyEval(c, x), -B, B).filter(r => !r.jump).map(r => r.x));
}

function msPolyRoots(c){
  c = c.slice();
  while(c.length > 1 && Math.abs(c[c.length - 1]) < 1e-14) c.pop();
  let k = 0;
  while(k < c.length - 1 && Math.abs(c[k]) < 1e-14) k++;
  const Q = c.slice(k), out = k > 0 ? [0] : [];
  let g = 0;
  Q.forEach((v, i) => { if(i > 0 && Math.abs(v) > 1e-14) g = msGcd(g, i); });
  let rq;
  if(Q.length === 1) rq = [];
  else if(g >= 2){
    const T = Q.filter((v, i) => i % g === 0), rt = msPolyBasic(T);
    if(!rt) return null;
    rq = [];
    rt.forEach(t => {
      if(g % 2 === 0){ if(t > 1e-14){ const r = Math.pow(t, 1/g); rq.push(-r, r); } else if(Math.abs(t) <= 1e-14) rq.push(0); }
      else rq.push(Math.sign(t)*Math.pow(Math.abs(t), 1/g));
    });
  } else { rq = msPolyBasic(Q); if(!rq) return null; }
  const all = out.concat(rq).map(x => Math.abs(x) < 1e-12 ? 0 : x).sort((p, q) => p - q), roots = [];
  all.forEach(x => { if(!roots.length || Math.abs(roots[roots.length - 1] - x) > 1e-9*Math.max(1, Math.abs(x))) roots.push(x); });
  return {roots, k, g: Q.length > 1 ? g : 0, Q};
}

/* setirde skobkadan daşarda + ýa-da − barmy */
function mpTopSum(s){
  let d = 0;
  const t = s.replace(/<sup>.*?<\/sup>/g, 'S');
  for(let i = 0; i < t.length; i++){
    const ch = t.charAt(i);
    if(ch === '(') d++; else if(ch === ')') d--;
    else if(d === 0 && i > 0 && (ch === '+' || ch === '−') && t.charAt(i - 1) === ' ') return true;
  }
  return false;
}

/* ===== modules/solvers/multi-int-steps.js ===== */
/* Köp integrallar: mugallym ýaly ädimme-ädim çözgüt (13-nji sapak).
   Goşa integral (I görnüş — dy dx, II görnüş — dx dy, polýar — r dr dθ) we üçleýin integral (dz dy dx):
   oblasty beýan etmek → içki integral (daşky üýtgeýji hemişelik: integral astyndaky funksiýa g(daşky)·h(içki) agzalara bölünýär,
   h-yň integraly integral moduly bilen ädimme-ädim tapylýar) → serhetleri goýmak (Nýuton–Leýbnis) → daşky integral → san barlagy.
   Ädimleriň haýsydyr biri analitik başartmasa, şol ýerden san usuly (Gauss–Ležandr) bilen dowam edilýär. */

const { msN: miN, msSym: miSym, msAdd: miAdd, msSub: miSub, msMul: miMul, msDiv: miDiv, msPow: miPow, msNeg: miNeg } = msNodes;

const MI_VARS = ['x', 'y', 'z', 'r', 't'];

const MI_SUP = {x: 'ˣ', y: 'ʸ', z: 'ᶻ', r: 'ʳ', 'θ': 'ᶿ'};

const MI_MAXT = 40;

/* integral moduly x boýunça ýazýar: ädimlerde x harpyny başga harp bilen çalyşmak (türkmen dilinde x harpy ýok) */
function miSwap(html, v){ return v === 'x' ? html : html.replace(/x/g, v).replace(/ˣ/g, MI_SUP[v] || v); }

function miRen(n, from, to){ return from === to ? n : msSubst(n, {[from]: miSym(to)}); }

function miIsConst(n){ let ok = true; n.traverse((c, path) => { if(c.type === 'SymbolNode' && path !== 'fn' && MI_VARS.indexOf(c.name) !== -1) ok = false; }); return ok; }

function miHasOther(n, v){ let f = false; n.traverse((c, path) => { if(c.type === 'SymbolNode' && path !== 'fn' && c.name !== v && MI_VARS.indexOf(c.name) !== -1) f = true; }); return f; }

/* görkezmek: polýar halatda t → θ */
function miShow(n, K){
  const th = {t: miSym('θ')}, K2 = {};
  if(K) Object.keys(K).forEach(k => { K2[k] = msSubst(K[k], th); });
  return msP(msSubst(n, th), K ? K2 : undefined);
}

const miPar = s => mpTopSum(s) ? '(' + s + ')' : s;

const miParM = s => (mpTopSum(s) || s.charAt(0) === '−') ? '(' + s + ')' : s;

function miParse(s){ return math.parse(prep(String(s).replace(/θ/g, 't'))); }

/* 1/q: e^u → e^(−u), b^k → b^(−k) */
function miInv(q){
  const u = unwrap(q);
  if(u.type === 'OperatorNode' && u.fn === 'pow'){
    const b = unwrap(u.args[0]);
    if(b.type === 'SymbolNode' && b.name === 'e') return miPow(b, miNeg(u.args[1]));
    if(miIsConst(u.args[1])){ const k = msConstVal(u.args[1]); if(k !== null) return miPow(u.args[0], msNum(-k)); }
  }
  if(u.type === 'FunctionNode' && u.fn.name === 'exp' && u.args.length === 1) return miPow(miSym('e'), miNeg(u.args[0]));
  return miPow(q, miN(-1));
}

/* "= <b>8π</b>" ýa-da "≈ <b>0.6035</b>" */
const miEqB = l => l.charAt(0) === '≈' ? '≈ <b>' + l.replace(/^≈\s*/, '') + '</b>' : '= <b>' + l + '</b>';

/* aňlatmany agzalara açmak: [{c, fs}] — c san, fs köpeldijiler (köpeltmek jemiň üstünden paýlanýar); gaty köp bolsa null */
function miTerms(n){
  n = unwrap(n);
  if(n.type === 'ConstantNode' && typeof n.value === 'number') return [{c: n.value, fs: []}];
  const neg = T => T && T.map(t => ({c: -t.c, fs: t.fs}));
  const expSplit = arg => {                                  // e^(u + v) → e^u·e^v
    const ts = flattenSum(unwrap(arg), 1, []);
    return [{c: 1, fs: ts.map(t => miPow(miSym('e'), t.sign > 0 ? t.node : miNeg(t.node)))}];
  };
  if(n.type === 'OperatorNode'){
    const f = n.fn;
    if(f === 'add' || f === 'subtract'){
      const A = miTerms(n.args[0]), B = miTerms(n.args[1]);
      if(!A || !B || A.length + B.length > MI_MAXT) return null;
      return A.concat(f === 'add' ? B : neg(B));
    }
    if(f === 'unaryMinus') return neg(miTerms(n.args[0]));
    if(f === 'unaryPlus') return miTerms(n.args[0]);
    if(f === 'multiply'){
      const A = miTerms(n.args[0]), B = miTerms(n.args[1]);
      if(!A || !B || A.length*B.length > MI_MAXT) return null;
      const out = [];
      A.forEach(s => B.forEach(t => out.push({c: s.c*t.c, fs: s.fs.concat(t.fs)})));
      return out;
    }
    if(f === 'divide'){
      const A = miTerms(n.args[0]);
      if(!A) return null;
      const dv = miIsConst(n.args[1]) ? msConstVal(n.args[1]) : null;
      if(dv !== null && dv !== 0 && Number.isFinite(dv) && unwrap(n.args[1]).type === 'ConstantNode') return A.map(t => ({c: t.c/dv, fs: t.fs}));
      const B = miTerms(n.args[1]);
      if(B && B.length === 1 && B[0].c !== 0) return A.map(t => ({c: t.c/B[0].c, fs: t.fs.concat(B[0].fs.map(miInv))}));
      return A.map(t => ({c: t.c, fs: t.fs.concat([miInv(n.args[1])])}));
    }
    if(f === 'pow'){
      const base = unwrap(n.args[0]), e = miIsConst(n.args[1]) ? msConstVal(n.args[1]) : null;
      const bs = base.type === 'OperatorNode' && (base.fn === 'add' || base.fn === 'subtract');
      if(base.type === 'SymbolNode' && base.name === 'e'){
        const ex = unwrap(n.args[1]);
        if(ex.type === 'OperatorNode' && (ex.fn === 'add' || ex.fn === 'subtract')) return expSplit(ex);
        return [{c: 1, fs: [n]}];
      }
      if(e !== null && Number.isInteger(e) && e >= 2 && e <= 4 && bs){
        const B = miTerms(base);
        if(!B) return [{c: 1, fs: [n]}];
        let R = [{c: 1, fs: []}];
        for(let i = 0; i < e; i++){
          if(R.length*B.length > MI_MAXT) return [{c: 1, fs: [n]}];
          const nx = [];
          R.forEach(s => B.forEach(t => nx.push({c: s.c*t.c, fs: s.fs.concat(t.fs)})));
          R = nx;
        }
        return R;
      }
      if(e !== null && !bs){
        const B = miTerms(base);
        if(B && B.length === 1 && (B[0].c > 0 || Number.isInteger(e))) return [{c: Math.pow(B[0].c, e), fs: B[0].fs.map(q => miPow(q, miN(e)))}];
      }
      return [{c: 1, fs: [n]}];
    }
  }
  if(n.type === 'FunctionNode' && n.fn.name === 'exp' && n.args.length === 1){
    const a = unwrap(n.args[0]);
    if(a.type === 'OperatorNode' && (a.fn === 'add' || a.fn === 'subtract')) return expSplit(a);
  }
  return [{c: 1, fs: [n]}];
}

/* köpeldijileriň köpeltmek hasyly, birmeňzeş esaslaryň derejeleri goşulýar (r·r·r → r³); boş bolsa null */
function miMerge(fs){
  const m = new Map();
  fs.forEach(f => {
    let base = unwrap(f), e = 1;
    if(base.type === 'OperatorNode' && base.fn === 'pow'){
      const ev = miIsConst(base.args[1]) ? msConstVal(base.args[1]) : null, b = unwrap(base.args[0]);
      if(ev !== null && !(b.type === 'SymbolNode' && b.name === 'e')){ base = b; e = ev; }
    }
    const k = base.toString(), o = m.get(k);
    if(o) o.e += e; else m.set(k, {base, e});
  });
  let out = null;
  m.forEach(o => {
    if(Math.abs(o.e) < 1e-12) return;
    const t = Math.abs(o.e - 1) < 1e-12 ? o.base : miPow(o.base, msNum(o.e));
    out = out === null ? t : miMul(out, t);
  });
  return out;
}

function miBuild(terms){
  let out = null;
  terms.forEach(t => {
    if(Math.abs(t.c) < 1e-15) return;
    const p = miMerge(t.fs), a = Math.abs(t.c);
    const node = p === null ? msNum(a) : (Math.abs(a - 1) < 1e-12 ? p : miMul(msNum(a), p));
    out = out === null ? (t.c < 0 ? miNeg(node) : node) : (t.c < 0 ? miSub(out, node) : miAdd(out, node));
  });
  return out || miN(0);
}

/* f = Σ g_k(daşky)·h_k(içki): [{g, h}] (h = null ⇒ 1) ýa-da null (garyşyk köpeldiji bar bolsa) */
function miSeparate(node, inner){
  const T = miTerms(node);
  if(!T) return null;
  const groups = new Map();
  for(const t of T){
    if(Math.abs(t.c) < 1e-15) continue;
    const gf = [], hf = [];
    for(const f of t.fs){
      const hi = msHas(f, inner), ho = miHasOther(f, inner);
      if(hi && ho) return null;
      (hi ? hf : gf).push(f);
    }
    const h = miMerge(hf), key = h ? h.toString() : '1';
    if(!groups.has(key)) groups.set(key, {h, g: []});
    groups.get(key).g.push({c: t.c, fs: gf});
  }
  return [...groups.values()].map(G => ({h: G.h, g: miBuild(G.g)}));
}

/* ∫ h(v) dv: {H, steps, rule} ýa-da null */
function miAnti(h, v){
  if(!h) return {H: miSym(v), steps: [], rule: '∫ d' + v + ' = ' + v};
  const u = unwrap(h);
  const pw = u.type === 'SymbolNode' && u.name === v ? 1 : (u.type === 'OperatorNode' && u.fn === 'pow' && unwrap(u.args[0]).type === 'SymbolNode' && unwrap(u.args[0]).name === v && miIsConst(u.args[1])) ? msConstVal(u.args[1]) : null;
  if(pw !== null && Math.abs(pw + 1) > 1e-12){
    const H = miDiv(miPow(miSym(v), msNum(pw + 1)), msNum(pw + 1));
    return {H: niceSimplifyVar(H), steps: [], rule: 'derejeli funksiýa'};
  }
  const X = miRen(h, v, 'x');
  let r;
  try{ r = integrateSteps(X); }catch(e){ r = null; }
  if(!r || !r.F) return null;
  return {H: miRen(r.F, 'x', v), steps: r.steps.map(s => miSwap(s, v)), rule: r.method};
}

/* aňlatmany bir üýtgeýji (v) boýunça owadan ýönekeýleşdirmek */
function miSimp1(n, v){
  const X = miRen(msFold(n), v, 'x');
  let s;
  try{ s = niceSimplify(X); }catch(e){ s = X; }
  return miRen(s, 'x', v);
}

function miSimpN(n){ try{ return niceSimplifyVar(msFold(n)); }catch(e){ return n; } }

/* ∫ G dv ornuna goýma bilen: G-de v diňe s = v·k + c(daşky) görnüşli çyzykly aňlatmanyň içinde bolsa — cos(x + y), 1/(x + y), ln(1 + x + y) */
function miLinArg(G, v, show){
  const cands = [];
  G.traverse((c, path) => { if(path !== 'fn' && c.type === 'OperatorNode' && (c.fn === 'add' || c.fn === 'subtract') && msHas(c, v) && miHasOther(c, v)) cands.push(c); });
  for(const sN of cands){
    const se = msEval(sN), others = MI_VARS.filter(w => w !== v && msHas(sN, w));
    let k = null, ok = true;
    for(const o of [0.37, 1.21]){
      const sc = w => { const o2 = {}; others.forEach(n => { o2[n] = o; }); o2[v] = w; return o2; };
      const d1 = se(sc(1)) - se(sc(0)), d2 = se(sc(2.5)) - se(sc(1));
      if(!isFinite(d1) || Math.abs(d2 - 1.5*d1) > 1e-9*Math.max(1, Math.abs(d1))){ ok = false; break; }
      if(k === null) k = d1; else if(Math.abs(k - d1) > 1e-9*Math.max(1, Math.abs(k))){ ok = false; break; }
    }
    if(!ok || k === null || Math.abs(k) < 1e-12) continue;
    const key = sN.toString(), G2 = G.transform(m => m.toString() === key ? miSym('x') : m);
    if(msHas(G2, v) || others.some(w => !msHas(G2, w)) && false) continue;
    const parts = miSeparate(G2, 'x');
    if(!parts) continue;
    let F = null, items = [];
    for(const p of parts){
      if(miHasOther(p.h || miN(1), 'x')) { F = null; break; }
      let r = null;
      try{ r = p.h ? integrateSteps(p.h) : {F: miSym('x'), steps: []}; }catch(e){ r = null; }
      if(!r || !r.F){ F = null; break; }
      const H = msSubst(r.F, {x: sN}), isOne = unwrap(p.g).type === 'ConstantNode' && unwrap(p.g).value === 1;
      const term = isOne ? H : miMul(p.g, H);
      F = F === null ? term : miAdd(F, term);
      if(r.steps.length) items = items.concat(r.steps.map(s2 => miSwap(s2, 't')));
    }
    if(F === null) continue;
    if(Math.abs(k - 1) > 1e-12) F = miDiv(F, msNum(k));
    const kS = Math.abs(k - 1) < 1e-12 ? '' : fmtNice(k) + '·';
    const head = 't = ' + show(sN) + ' ornuna goýýarys (' + v + ' boýunça çyzykly, dt = ' + kS + 'd' + v + '): ∫ ' + miPar(show(G2).replace(/x/g, 't')) + ' dt' + (kS ? '/' + fmtNice(k) : '');
    return {F, items: [items.length ? msNest(head + ':', items) : head + '.'], outerOnly: true};
  }
  return null;
}

/* ∫ G dv: {F, items, outerOnly} ýa-da {fail: 'nonelem'|'other'} */
function miAntiAll(G, v, show){
  const parts = miSeparate(G, v);
  let nonelem = false;
  if(parts){
    const items = [];
    let F = null;
    for(const p of parts){
      const A = miAnti(p.h, v);
      if(!A){ if(p.h && integralNonElementary(miRen(p.h, v, 'x'))) nonelem = true; F = null; break; }
      const hs = p.h ? show(p.h) : '1';
      if(A.steps.length) items.push(msNest('∫ ' + miPar(hs) + ' d' + v + ':', A.steps));
      const isOne = unwrap(p.g).type === 'ConstantNode' && unwrap(p.g).value === 1;
      const term = isOne ? A.H : miMul(p.g, A.H);
      F = F === null ? term : miAdd(F, term);
    }
    if(F !== null) return {F, items, outerOnly: parts.some(p => !(unwrap(p.g).type === 'ConstantNode'))};
  }
  const L = miLinArg(G, v, show);
  if(L) return L;
  return {fail: nonelem ? 'nonelem' : 'other'};
}

/* içki integral: ∫_{lo}^{hi} G dv. Gaýtarýar {html, I} ýa-da {fail}. simp — netijäni ýönekeýleşdirmek */
function miInner(G, v, lo, hi, outerName, simp, show){
  const A = miAntiAll(G, v, show);
  if(A.fail) return A;
  const items = A.items, F = A.F;
  const Fs = miSimpN(F);
  const sub = b => msFold(msSubst(Fs, {[v]: b}));
  const raw = miSub(sub(hi), sub(lo)), I = simp(raw);
  const outerOnly = A.outerOnly;
  let html = '<b>Içki integral</b> (' + v + ' boýunça, ' + outerName + ' hemişelik' + (outerOnly ? ' — ' + outerName + '-e bagly köpeldijiler integralyň daşyna çykýar' : '') + '): ∫ ' + miPar(show(G)) + ' d' + v + ' = ' + show(Fs);
  if(items.length) html = msNest(html + ', bu ýerde', items);
  const Kh = {[v]: hi}, Kl = {[v]: lo};
  const subS = show(Fs, Kh) + ' − ' + miParM(show(Fs, Kl));
  html += (items.length ? '' : '. ') + 'Serhetleri goýýarys: [' + show(Fs) + ']<sub>' + v + ' = ' + show(lo) + '</sub><sup>' + v + ' = ' + show(hi) + '</sup> = ' + (subS.length <= 220 ? subS + ' = ' : '') + '<b>' + show(I) + '</b>.';
  return {html, I};
}

/* bir üýtgeýjili (x) aňlatmada birmeňzeş köpagzaly esaslary birleşdirmek: √(4 − x²)·(8 − 2x²) − 2(√(4 − x²))³/3 → 4(4 − x²)^(3/2)/3 */
function miCanonPow(n){
  const terms = flattenSum(unwrap(n), 1, []);
  if(terms.length > 12) return null;
  const bases = [], map = new Map();
  const ratio = (c, d) => { let r = null; for(let i = 0; i < c.length; i++){ if(Math.abs(d[i]) < 1e-14){ if(Math.abs(c[i]) > 1e-14) return null; continue; } const q = c[i]/d[i]; if(r === null) r = q; else if(Math.abs(q - r) > 1e-12*Math.max(1, Math.abs(r))) return null; } return r; };
  for(const t of terms){
    let c = t.sign, bad = false;
    const facts = [];
    const walk = (u, e) => {
      u = unwrap(u);
      if(u.type === 'OperatorNode' && u.fn === 'multiply'){ walk(u.args[0], e); walk(u.args[1], e); return; }
      if(u.type === 'OperatorNode' && u.fn === 'divide'){ walk(u.args[0], e); walk(u.args[1], -e); return; }
      if(u.type === 'OperatorNode' && u.fn === 'unaryMinus'){ if(!Number.isInteger(e)){ bad = true; return; } if(e % 2 !== 0) c = -c; walk(u.args[0], e); return; }
      if(u.type === 'ConstantNode' && typeof u.value === 'number'){ c *= Math.pow(u.value, e); return; }
      if(u.type === 'OperatorNode' && u.fn === 'pow' && miIsConst(u.args[1]) && !(unwrap(u.args[0]).type === 'SymbolNode' && unwrap(u.args[0]).name === 'e')){
        const k = msConstVal(u.args[1]);
        if(k !== null){ walk(u.args[0], e*k); return; }
      }
      if(u.type === 'FunctionNode' && u.fn.name === 'sqrt' && u.args.length === 1){ walk(u.args[0], e*0.5); return; }
      const cf = polyCoeffs(u);
      if(cf && cf.length > 2){
        for(const B of bases) if(B.c.length === cf.length){
          const r = ratio(cf, B.c);
          if(r !== null && (r > 0 || Number.isInteger(e))){ c *= Math.pow(r, e); facts.push({base: B.node, e}); return; }
        }
        bases.push({node: u, c: cf});
      }
      facts.push({base: u, e});
    };
    walk(t.node, 1);
    if(bad || !isFinite(c)) return null;
    const m = new Map();
    facts.forEach(f => { const k = f.base.toString(), o = m.get(k); if(o) o.e += f.e; else m.set(k, {base: f.base, e: f.e}); });
    const keys = [...m.keys()].filter(k => Math.abs(m.get(k).e) > 1e-12).sort();
    let prod = null;
    keys.forEach(k => { const o = m.get(k), f = Math.abs(o.e - 1) < 1e-12 ? o.base : miPow(o.base, msNum(o.e)); prod = prod === null ? f : miMul(prod, f); });
    const key = keys.map(k => k + '^' + m.get(k).e).join('*') || '1', o = map.get(key);
    if(o) o.c += c; else map.set(key, {c, fs: prod ? [prod] : []});
  }
  const out = miBuild([...map.values()].filter(t => Math.abs(t.c) > 1e-12));
  if(out.toString() === n.toString()) return null;
  const f1 = msEval(n), f2 = msEval(out);
  let ok = 0;
  for(const x of [-1.37, -0.61, 0.23, 0.88, 1.53, 2.71]){ const u = f1({x}), w = f2({x}); if(!isFinite(u) || !isFinite(w)) continue; if(Math.abs(u - w) > 1e-9*Math.max(1, Math.abs(u))) return null; ok++; }
  return ok >= 3 ? out : null;
}

/* daşky integral ∫_a^b I(u) du: {html, value, label} ýa-da null */

/* [a, b] kesimde alamatyny çalyşmaýan |w| → w ýa-da −w (ln|x + 2| → ln(x + 2)) */
function miStripAbs(n, a, b){
  return n.transform(m => {
    const w = unwrap(m);
    if(!(w.type === 'FunctionNode' && w.fn.name === 'abs' && w.args.length === 1)) return m;
    const f = msEval(w.args[0]);
    let mn = Infinity, mx = -Infinity;
    for(let i = 0; i <= 40; i++){ const v = f({x: a + (b - a)*i/40}); if(!isFinite(v)) return m; mn = Math.min(mn, v); mx = Math.max(mx, v); }
    if(mn > 0) return miStripAbs(w.args[0], a, b);
    if(mx < 0) return miNeg(miStripAbs(w.args[0], a, b));
    return m;
  });
}

function miOuter(I, u, a, b, aNode, bNode, show, uShow){
  const X = miStripAbs(miRen(I, u, 'x'), a, b);
  let r = null;
  if(miIsConst(X)){
    const c = msConstVal(X);
    if(c === null) return null;
    const F = miMul(X, miSym('x'));
    r = {F, steps: ['∫ c d' + uShow + ' = c·' + uShow + ' — hemişeligiň integraly.'], method: 'tablisa'};
  } else {
    try{ r = integrateSteps(X); }catch(e){ r = null; }
  }
  let pre = null;
  if((!r || !r.F) && !miIsConst(X)){
    const C = miCanonPow(X);
    if(C){
      let r2 = null;
      try{ r2 = integrateSteps(C); }catch(e){ r2 = null; }
      if(r2 && r2.F){ r = r2; pre = 'Birmeňzeş esaslary birleşdirip ýönekeýleşdirýäris: ' + show(miRen(X, 'x', u)) + ' = ' + show(miRen(C, 'x', u)) + '.'; }
    }
  }
  if(!r || !r.F) return null;
  const ev = msEval(r.F), Fb = ev({x: b}), Fa = ev({x: a}), value = Fb - Fa;
  if(!isFinite(value)) return null;
  const Fu = miRen(r.F, 'x', u);
  let label = fmtNice(value);
  if(/[.e]/.test(label)){
    let ss = null;
    try{ ss = miConstLabel(miSub(msSubst(r.F, {x: bNode}), msSubst(r.F, {x: aNode}))); }catch(e){ ss = null; }
    label = (ss && ss.length <= 70 && /[πe√]|ln|lg|log|sin|cos|tg|arc/.test(ss) ? ss + ' ≈ ' : '≈ ') + fmtPrec(value, 9).replace(/^-/, '−');
  }
  const Is = show(I), Fs = show(Fu);
  const head = '<b>Daşky integral</b> (' + uShow + ' boýunça): ∫<sub>' + show(aNode) + '</sub><sup>' + show(bNode) + '</sup> ' + miPar(Is) + ' d' + uShow + ':';
  const steps = (pre ? [pre] : []).concat(r.steps.map(s => miSwap(s, uShow)));
  const fv = v => { const t = fmtNice(v); return /[.e]/.test(t) ? fmt(v) : t; };
  const nl = 'Nýuton–Leýbnis formulasy: [' + Fs + ']<sub>' + show(aNode) + '</sub><sup>' + show(bNode) + '</sup> = ' + fv(Fb) + ' − ' + (Fa < 0 ? '(' + fv(Fa) + ')' : fv(Fa)) + ' ' + miEqB(label) + '.';
  return {html: msNest(head, steps.concat([nl])), value, label};
}

/* hemişelik aňlatmanyň owadan ýazgysy: meňzeş agzalar jemlenýär, umumy köpeldiji çykarylýar — 2·(1/2 − e⁻⁹/2)·π → π·(1 − e⁻⁹) */
function miConstLabel(node){
  const n = msFold(node).transform(m => (m.type === 'OperatorNode' && m.fn === 'pow' && unwrap(m.args[1]).type === 'ConstantNode' && unwrap(m.args[1]).value === 1) ? m.args[0] : m);
  const T = miTerms(n);
  if(!T || T.length > 12) return null;
  const flat = (m, out) => { m = unwrap(m); if(m.type === 'OperatorNode' && m.fn === 'multiply'){ flat(m.args[0], out); flat(m.args[1], out); } else out.push(m); return out; };
  const map = new Map();
  T.forEach(t => {
    const mg = miMerge(t.fs), key = mg ? mg.toString() : '1', o = map.get(key);
    if(o) o.c += t.c; else map.set(key, {c: t.c, fs: mg ? flat(mg, []) : []});
  });
  let terms = [...map.values()].filter(t => Math.abs(t.c) > 1e-12);
  if(!terms.length) return '0';
  let common = [];
  if(terms.length >= 2){
    const k0 = terms[0].fs.map(f => f.toString());
    common = terms[0].fs.filter((f, i) => k0.indexOf(k0[i]) === i && terms.every(t => t.fs.some(g => g.toString() === k0[i])));
    if(common.length){
      const ck = common.map(f => f.toString());
      terms = terms.map(t => { const left = ck.slice(); return {c: t.c, fs: t.fs.filter(g => { const i = left.indexOf(g.toString()); if(i !== -1){ left.splice(i, 1); return false; } return true; })}; });
    }
  }
  if(terms[0].c < 0){ const i = terms.findIndex(t => t.c > 0); if(i > 0) terms.unshift(terms.splice(i, 1)[0]); }
  /* umumy maýdalawjy: (1/2)·e − 1/2 → (e − 1)/2 */
  let den = 1;
  if(terms.length >= 1 && !(terms.length === 1 && !terms[0].fs.length)){
    const rs = terms.map(t => ratApprox(t.c, 100, 1e-11));
    if(rs.every(Boolean)){
      const q0 = rs[0][1];
      if(q0 > 1 && rs.every(r => r[1] === q0)){ den = q0; terms = terms.map(t => ({c: t.c*q0, fs: t.fs})); }
    }
  }
  let sum = miBuild(terms);
  if(den > 1) sum = miDiv(sum, miN(den));
  const res = common.length ? miMul(common.reduce((acc, f) => acc === null ? f : miMul(acc, f), null), sum) : sum;
  return prettyNode(res);
}

/* san usuly bilen barlag setiri: tapawut san usulynyň öz ýalňyşlygyndan uly bolmasa ✓ */
function miCheck(value, num, numErr){
  const close = Math.abs(value - num) <= 1e-6*Math.max(1, Math.abs(num));
  return '<p class="check ok">Barlag: san usuly (Gauss–Ležandr kwadraturasy) bilen ≈ ' + fmtPrec(num, 10).replace(/^-/, '−') +
    (close ? ' — gabat gelýär ✓' : ' (funksiýa güýçli üýtgeýär, san usulynyň takmynan ýalňyşlygy ≈ ' + fmt(numErr || Math.abs(value - num)).replace(/^-/, '−') + ') — takyk jogap şol ýalňyşlyk çäginde gabat gelýär ✓') + '</p>';
}

/* ---------- goşa integral ---------- */

/* oblastyň beýany (I, II görnüş ýa-da polýar) */
function miRegionText(mode, aN, bN, g1, g2, show){
  if(mode === 'I') return '<b>Oblast</b>: D = {' + show(aN) + ' ≤ x ≤ ' + show(bN) + ', ' + show(g1) + ' ≤ y ≤ ' + show(g2) + '} — I görnüşli oblast (her dik çyzyk D-ni aşakdan y = ' + show(g1) + ', ýokardan y = ' + show(g2) + ' egri bilen kesýär). Şonuň üçin ilki içki integraly y boýunça (x hemişelik), soň daşky integraly x boýunça alýarys: ∬<sub>D</sub> f dA = ∫<sub>' + show(aN) + '</sub><sup>' + show(bN) + '</sup> (∫<sub>' + show(g1) + '</sub><sup>' + show(g2) + '</sup> f dy) dx.';
  if(mode === 'II') return '<b>Oblast</b>: D = {' + show(aN) + ' ≤ y ≤ ' + show(bN) + ', ' + show(g1) + ' ≤ x ≤ ' + show(g2) + '} — II görnüşli oblast (her gorizontal çyzyk D-ni çepden x = ' + show(g1) + ', sagdan x = ' + show(g2) + ' egri bilen kesýär). Ilki x boýunça (y hemişelik), soň y boýunça integrirleýäris: ∬<sub>D</sub> f dA = ∫<sub>' + show(aN) + '</sub><sup>' + show(bN) + '</sup> (∫<sub>' + show(g1) + '</sub><sup>' + show(g2) + '</sup> f dx) dy.';
  return '<b>Polýar koordinatalar</b>: x = r·cos θ, y = r·sin θ, x² + y² = r², meýdan elementi dA = r dr dθ (Ýakobian r). Oblast: D = {' + show(aN) + ' ≤ θ ≤ ' + show(bN) + ', ' + show(g1) + ' ≤ r ≤ ' + show(g2) + '}, şonuň üçin ∬<sub>D</sub> f dA = ∫<sub>' + show(aN) + '</sub><sup>' + show(bN) + '</sup> (∫<sub>' + show(g1) + '</sub><sup>' + show(g2) + '</sup> f(r cos θ, r sin θ)·r dr) dθ.';
}

/* içki we daşky integral: {ok, steps, label, value} ýa-da {ok: false, fail: 'inner'|'outer', nonelem, I} */
function miDoubleCore(G, mode, aN, bN, g1, g2, show){
  const polar = mode === 'polar', out = mode === 'I' ? 'x' : mode === 'II' ? 'y' : 't', inn = mode === 'I' ? 'y' : mode === 'II' ? 'x' : 'r';
  const uShow = polar ? 'θ' : out, a = msConstVal(aN), b = msConstVal(bN);
  if(a === null || b === null) return {ok: false, fail: 'inner'};
  const In = miInner(G, inn, g1, g2, polar ? 'θ' : out, n => miSimp1(n, out), show);
  if(!In || In.fail) return {ok: false, fail: 'inner', nonelem: !!(In && In.fail === 'nonelem')};
  const O = miOuter(In.I, out, a, b, aN, bN, show, uShow);
  if(!O) return {ok: false, fail: 'outer', I: In.I, innerHtml: In.html, nonelem: integralNonElementary(miRen(In.I, out, 'x'))};
  return {ok: true, steps: [In.html, O.html], label: O.label, value: O.value};
}

/* L(u) = v deňlemeden u = … (ters funksiýa; birnäçe şaha bolup biler) — v-e bagly düwünler */
function miInverse(Ln, u, v){
  const X = miRen(msFold(Ln), u, 'x'), V = miSym(v), out = [];
  const lin = n => { const c = polyCoeffs(n); return (c && c.length === 2 && Math.abs(c[1]) > 1e-14) ? {k: c[1], m: c[0]} : null; };
  const unlin = (W, L) => Math.abs(L.k - 1) < 1e-14 && Math.abs(L.m) < 1e-14 ? W : miDiv(miSub(W, msNum(L.m)), msNum(L.k));
  const c = polyCoeffs(X);
  if(c){
    while(c.length > 1 && Math.abs(c[c.length - 1]) < 1e-14) c.pop();
    const d = c.length - 1;
    if(d === 1) out.push(unlin(V, {k: c[1], m: c[0]}));
    else if(d === 2){
      const [c0, b1, a2] = c;
      if(Math.abs(b1) < 1e-14){                                  // a·u² + c = v ⇒ u = ±√((v − c)/a)
        const inner = Math.abs(c0) < 1e-14 && Math.abs(a2 - 1) < 1e-14 ? V : miDiv(miSub(V, msNum(c0)), msNum(a2)), sq = new math.FunctionNode('sqrt', [inner]);
        out.push(sq, miNeg(sq));
      } else {
        const sq = new math.FunctionNode('sqrt', [miAdd(msNum(b1*b1 - 4*a2*c0), miMul(msNum(4*a2), V))]);
        out.push(miDiv(miAdd(msNum(-b1), sq), msNum(2*a2)), miDiv(miSub(msNum(-b1), sq), msNum(2*a2)));
      }
    } else if(d >= 3 && c.slice(1, d).every(t => Math.abs(t) < 1e-14)){
      const base = miDiv(miSub(V, msNum(c[0])), msNum(c[d]));
      if(d === 3) out.push(new math.FunctionNode('cbrt', [base]));
      else if(d % 2 === 0){ const r = miPow(base, miDiv(miN(1), miN(d))); out.push(r, miNeg(r)); }
    }
  } else {
    let alpha = 1, beta = 0, Gx = unwrap(X);
    const cv = n => miIsConst(n) ? msConstVal(n) : null;
    if(Gx.type === 'OperatorNode' && (Gx.fn === 'add' || Gx.fn === 'subtract')){
      const p0 = cv(Gx.args[0]), q0 = cv(Gx.args[1]);
      if(q0 !== null){ beta = Gx.fn === 'add' ? q0 : -q0; Gx = unwrap(Gx.args[0]); }
      else if(p0 !== null){ beta = p0; if(Gx.fn === 'subtract') alpha = -1; Gx = unwrap(Gx.args[1]); }
    }
    if(Gx.type === 'OperatorNode' && Gx.fn === 'unaryMinus'){ alpha = -alpha; Gx = unwrap(Gx.args[0]); }
    if(Gx.type === 'OperatorNode' && Gx.fn === 'multiply'){
      const p0 = cv(Gx.args[0]), q0 = cv(Gx.args[1]);
      if(p0 !== null){ alpha *= p0; Gx = unwrap(Gx.args[1]); } else if(q0 !== null){ alpha *= q0; Gx = unwrap(Gx.args[0]); }
    }
    if(Gx.type === 'OperatorNode' && Gx.fn === 'divide'){ const q0 = cv(Gx.args[1]); if(q0 !== null && q0 !== 0){ alpha /= q0; Gx = unwrap(Gx.args[0]); } }
    if(Math.abs(alpha) < 1e-14) return [];
    const W = (Math.abs(alpha - 1) < 1e-14 && Math.abs(beta) < 1e-14) ? V : miDiv(miSub(V, msNum(beta)), msNum(alpha));
    const fnArg = (name) => Gx.type === 'FunctionNode' && Gx.fn.name === name && Gx.args.length === 1 ? lin(Gx.args[0]) : null;
    let L;
    if((L = fnArg('sqrt'))) out.push(unlin(miPow(W, miN(2)), L));
    else if((L = fnArg('cbrt'))) out.push(unlin(miPow(W, miN(3)), L));
    else if((L = fnArg('exp'))) out.push(unlin(new math.FunctionNode('log', [W]), L));
    else if((L = fnArg('log'))) out.push(unlin(miPow(miSym('e'), W), L));
    else if(Gx.type === 'OperatorNode' && Gx.fn === 'pow'){
      const bb = unwrap(Gx.args[0]), ee = cv(Gx.args[1]);
      if(bb.type === 'SymbolNode' && bb.name === 'e' && (L = lin(Gx.args[1]))) out.push(unlin(new math.FunctionNode('log', [W]), L));
      else if(ee !== null && ee !== 0 && (L = lin(Gx.args[0]))) out.push(unlin(miPow(W, msNum(1/ee)), L));
    }
  }
  return out.map(n => { try{ return miSimp1(n, v); }catch(e){ return n; } });
}

/* D oblasty beýleki görnüşe geçirmek (I ↔ II): {mode, aN, bN, g1, g2, notes} ýa-da null */
function miSwapRegion(mode, aN, bN, g1, g2){
  const u = mode === 'I' ? 'x' : 'y', v = mode === 'I' ? 'y' : 'x';
  const A = msConstVal(aN), B = msConstVal(bN);
  if(A === null || B === null || !(B > A)) return null;
  const Le = msEval(g1), Ue = msEval(g2), L = w => Le({[u]: w}), U = w => Ue({[u]: w});
  const N = 400;
  let iMin = 0, iMax = 0, vmin = Infinity, vmax = -Infinity;
  for(let i = 0; i <= N; i++){
    const w = A + (B - A)*i/N, l = L(w), h = U(w);
    if(!isFinite(l) || !isFinite(h) || l > h + 1e-12) return null;
    if(l < vmin){ vmin = l; iMin = i; }
    if(h > vmax){ vmax = h; iMax = i; }
  }
  const golden = (f, lo, hi, sgn) => { for(let it = 0; it < 80; it++){ const m1 = lo + (hi - lo)*0.382, m2 = lo + (hi - lo)*0.618; if(sgn*f(m1) < sgn*f(m2)) hi = m2; else lo = m1; } return f((lo + hi)/2); };
  const at = i => A + (B - A)*Math.max(0, Math.min(N, i))/N;
  if(iMin > 0 && iMin < N) vmin = Math.min(vmin, golden(L, at(iMin - 1), at(iMin + 1), 1));
  if(iMax > 0 && iMax < N) vmax = Math.max(vmax, golden(U, at(iMax - 1), at(iMax + 1), -1));
  const An = msNiceNode(vmin), Bn = msNiceNode(vmax);
  if(!An || !Bn || !(vmax > vmin)) return null;
  const cands = [{node: aN, c: A, from: null}, {node: bN, c: B, from: null}];
  [g1, g2].forEach(g => miInverse(g, u, v).forEach(n => cands.push({node: n, ev: msEval(n), from: g})));
  const K = 24, M = 600, lo = [], hi = [];
  for(let k = 0; k < K; k++){
    const vv = vmin + (vmax - vmin)*(k + 0.5)/K, inside = w => L(w) <= vv + 1e-12 && vv <= U(w) + 1e-12;
    let first = -1, last = -1;
    for(let i = 0; i <= M; i++){
      if(!inside(A + (B - A)*i/M)) continue;
      if(first < 0) first = i; else if(last !== i - 1) return null;         // kesişme iki bölekden ybarat — bir görnüşde ýazyp bolmaýar
      last = i;
    }
    if(first < 0) return null;
    const refine = (wOut, wIn) => { for(let it = 0; it < 60; it++){ const m = (wOut + wIn)/2; if(inside(m)) wIn = m; else wOut = m; } return (wOut + wIn)/2; };
    lo.push({v: vv, u: first === 0 ? A : refine(A + (B - A)*(first - 1)/M, A + (B - A)*first/M)});
    hi.push({v: vv, u: last === M ? B : refine(A + (B - A)*(last + 1)/M, A + (B - A)*last/M)});
  }
  const tol = 1e-6*Math.max(1, B - A);
  const pick = arr => cands.find(c => arr.every(p => { const val = c.ev ? c.ev({[v]: p.v}) : c.c; return isFinite(val) && Math.abs(val - p.u) <= tol; }));
  const cl = pick(lo), ch = pick(hi);
  if(!cl || !ch) return null;
  const notes = [cl, ch].filter(c => c.from).map(c => v + ' = ' + msP(c.from) + ' ⇔ ' + u + ' = ' + msP(c.node));
  return {mode: mode === 'I' ? 'II' : 'I', aN: An, bN: Bn, g1: cl.node, g2: ch.node, notes: notes.filter((t, i) => notes.indexOf(t) === i)};
}

/* mode: 'I' | 'II' | 'polar'; S: {a, b, g1, g2} setirler; num — san usulynyň netijesi. Gaýtarýar {html, label, value} ýa-da null */
function doubleSteps(fNode, mode, S, num, numErr){
  const polar = mode === 'polar', show = (n, K) => miShow(n, K);
  let aN, bN, g1, g2;
  try{ aN = miParse(S.a); bN = miParse(S.b); g1 = miParse(S.g1); g2 = miParse(S.g2); }catch(e){ return null; }
  if(msConstVal(aN) === null || msConstVal(bN) === null) return null;
  const steps = [miRegionText(mode, aN, bN, g1, g2, show)];
  let G = fNode;
  if(polar){
    const fe = msEval(fNode);
    let rad = true, n = 0;
    for(const r of [0.31, 0.77, 1.43]){ const v0 = fe({x: r, y: 0}); for(let k = 1; k < 8; k++){ const v = fe({x: r*Math.cos(k*0.8), y: r*Math.sin(k*0.8)}); if(!isFinite(v0) || !isFinite(v)) continue; n++; if(Math.abs(v - v0) > 1e-9*Math.max(1, Math.abs(v0))) rad = false; } }
    if(rad && n >= 6){
      const r0 = miSimp1(msSubst(fNode, {x: miSym('r'), y: miN(0)}), 'r').transform(m => {   // r ≥ 0: √(r²) = |r| = r
        const w = unwrap(m);
        if(w.type === 'FunctionNode' && w.fn.name === 'abs' && unwrap(w.args[0]).type === 'SymbolNode' && unwrap(w.args[0]).name === 'r') return miSym('r');
        if(w.type === 'FunctionNode' && w.fn.name === 'sqrt'){ const a0 = unwrap(w.args[0]); if(a0.type === 'OperatorNode' && a0.fn === 'pow' && unwrap(a0.args[0]).type === 'SymbolNode' && unwrap(a0.args[0]).name === 'r' && msConstVal(a0.args[1]) === 2) return miSym('r'); }
        return m;
      });
      const fr = miSimp1(r0, 'r');
      G = miSimp1(miMul(fr, miSym('r')), 'r');
      steps.push('<b>Integral astyndaky funksiýa</b>: f diňe x² + y² = r²-a bagly, şonuň üçin f(r cos θ, r sin θ) = ' + show(fr) + ' (θ ýitýär) ⇒ f·r = ' + show(G) + '.');
    } else {
      const P = miMul(msSubst(fNode, {x: miMul(miSym('r'), new math.FunctionNode('cos', [miSym('t')])), y: miMul(miSym('r'), new math.FunctionNode('sin', [miSym('t')]))}), miSym('r'));
      const parts = miSeparate(P, 'r');
      if(!parts) return null;
      let usedId = false;
      const terms = parts.map(p => {
        let g = miSimp1(p.g, 't');
        const ge = msEval(g), v0 = ge({t: 0.3});
        if(!miIsConst(g) && isFinite(v0) && [0.9, 1.7, 2.6, 4.1].every(t => Math.abs(ge({t}) - v0) < 1e-10*Math.max(1, Math.abs(v0)))){ g = msNum(v0); usedId = true; }   // cos²θ + sin²θ = 1
        return {g, h: p.h};
      }).filter(p => !(unwrap(p.g).type === 'ConstantNode' && unwrap(p.g).value === 0));
      G = terms.map(p => p.h ? (unwrap(p.g).type === 'ConstantNode' && unwrap(p.g).value === 1 ? p.h : miMul(p.g, p.h)) : p.g).reduce((acc, t) => acc === null ? t : miAdd(acc, t), null) || miN(0);
      steps.push('<b>Integral astyndaky funksiýa</b>: x = r cos θ, y = r sin θ goýup r-e köpeldýäris: f(r cos θ, r sin θ)·r = ' + show(G) + (usedId ? ' (cos²θ + sin²θ = 1 ulanyldy)' : '') + '.');
    }
  }
  const ok = v => isFinite(num) && isFinite(v) && Math.abs(v - num) <= Math.max(1e-6*Math.max(1, Math.abs(num)), 20*(numErr || 0));
  let R = miDoubleCore(G, mode, aN, bN, g1, g2, show), label, value;
  if(!(R.ok && ok(R.value)) && !polar){
    /* tertibi çalyşmak: integral şu tertipde elementar däl ýa-da tapylmady */
    const sw = miSwapRegion(mode, aN, bN, g1, g2);
    const R2 = sw ? miDoubleCore(fNode, sw.mode, sw.aN, sw.bN, sw.g1, sw.g2, show) : null;
    if(R2 && R2.ok && ok(R2.value)){
      const inn = mode === 'I' ? 'y' : 'x', why = R.fail === 'outer' ? 'daşky integral elementar funksiýalarda tapylmaýar' : 'içki integral (' + inn + ' boýunça) elementar funksiýalarda alynmaýar';
      steps.push('<b>Integrirleme tertibini çalyşýarys</b>: bu tertipde ' + why + '. Şol bir D oblasty ' + sw.mode + ' görnüşde ýazýarys' +
        (sw.notes.length ? ' (çäk egrilerini beýleki üýtgeýji boýunça çözýäris: ' + sw.notes.join('; ') + ')' : '') + ':');
      steps.push(miRegionText(sw.mode, sw.aN, sw.bN, sw.g1, sw.g2, show));
      R = R2;
    }
  }
  if(R.ok && ok(R.value)){ steps.push(...R.steps); label = R.label; value = R.value; }
  else if(R.fail === 'outer' && R.I){
    const nc = niceConst(num, 1e-9*Math.max(1, Math.abs(num)));
    label = nc.exact ? nc.label : '≈ ' + fmtPrec(num, 9);
    value = num;
    const uShow = polar ? 'θ' : mode === 'I' ? 'x' : 'y';
    steps.push(R.innerHtml);
    steps.push('<b>Daşky integral</b> ∫<sub>' + show(aN) + '</sub><sup>' + show(bN) + '</sup> (' + show(R.I) + ') d' + uShow + ' elementar usullar bilen bu ýerde tapylmady — san usuly (Gauss–Ležandr) bilen: ' + miEqB(label) + '.');
  } else {
    if(!(R.fail === 'inner' && R.nonelem) || !isFinite(num)) return null;
    const nc = niceConst(num, 1e-9*Math.max(1, Math.abs(num))), lab = nc.exact ? nc.label : '≈ ' + fmtPrec(num, 9), inn = mode === 'I' ? 'y' : mode === 'II' ? 'x' : 'r';
    steps.push('<b>Içki integral</b> (' + inn + ' boýunça) elementar funksiýalarda alynmaýar (mysal, ∫ e<sup>x²</sup> dx ýaly)' +
      (polar ? '.' : ', integrirleme tertibini çalyşmak hem kömek etmeýär (beýleki tertipde-de integral elementar däl ýa-da oblast bir görnüşde ýazylmaýar).'));
    steps.push('<b>San usuly</b> (Gauss–Ležandr) bilen: ∬<sub>D</sub> f dA ' + miEqB(lab) + '.');
    return {html: '<div class="steps-head">Çözgüt ädimme-ädim</div><ol class="steps">' + steps.map(s2 => '<li>' + s2 + '</li>').join('') + '</ol>', label: lab, value: num};
  }
  if(!ok(value)) return null;
  steps.push('<b>Jogap</b>: ∬<sub>D</sub> f dA ' + miEqB(label) + '.');
  const check = miCheck(value, num, numErr);
  return {html: '<div class="steps-head">Çözgüt ädimme-ädim</div><ol class="steps">' + steps.map(s2 => '<li>' + s2 + '</li>').join('') + '</ol>' + check, label, value};
}

/* ---------- üçleýin integral ---------- */

/* ∫_{−√A}^{√A} c(x)·√(A − y²) dy = c·πA/2 (ýarym tegelek); 0 … √A bolsa πA/4 */
function miSemi(J, lo, hi){
  const T = miTerms(J);
  if(!T || T.length !== 1) return null;
  const t = T[0], sq = t.fs.filter(f => msHas(f, 'y'));
  if(sq.length !== 1 || t.fs.some(f => f !== sq[0] && msHas(f, 'y'))) return null;
  const s0 = unwrap(sq[0]);
  let P = null;
  if(s0.type === 'FunctionNode' && s0.fn.name === 'sqrt') P = s0.args[0];
  else if(s0.type === 'OperatorNode' && s0.fn === 'pow' && Math.abs((msConstVal(s0.args[1]) || 0) - 0.5) < 1e-12) P = s0.args[0];
  if(!P) return null;
  const A = miSimpN(msSubst(P, {y: miN(0)})), pe = msEval(P), ae = msEval(A), le = msEval(lo), he = msEval(hi);
  let sym = true, half = true, n = 0;
  for(const x of [-0.53, -0.21, 0.17, 0.44]){
    for(const y of [0.05, 0.13]){ const p = pe({x, y}), q = ae({x}) - y*y; if(isFinite(p) && Math.abs(p - q) > 1e-10*Math.max(1, Math.abs(q))) return null; }
    const av = ae({x}), h = he({x}), l = le({x});
    if(!(av > 0) || !isFinite(h) || !isFinite(l)) continue;
    n++;
    if(Math.abs(h - Math.sqrt(av)) > 1e-9) return null;
    if(Math.abs(l + Math.sqrt(av)) > 1e-9) sym = false;
    if(Math.abs(l) > 1e-12) half = false;
  }
  if(n < 2 || (!sym && !half)) return null;
  const c = miMerge(t.fs.filter(f => f !== sq[0])), cn = c === null ? msNum(t.c) : (Math.abs(t.c - 1) < 1e-12 ? c : miMul(msNum(t.c), c));
  const K = miSimp1(miMul(miMul(cn, miDiv(miSym('pi'), miN(sym ? 2 : 4))), A), 'x');
  return {K, A, txt: '∫<sub>' + msP(lo) + '</sub><sup>' + msP(hi) + '</sup> √(' + msP(A) + ' − y<sup>2</sup>) dy = π·(' + msP(A) + ')/' + (sym ? 2 : 4) + ' — radiusy √(' + msP(A) + ') bolan ' + (sym ? 'ýarym tegelegiň' : 'çärýek tegelegiň') + ' meýdany'};
}

/* S: {a, b, g1, g2, h1, h2} setirler; num — san netijesi. Gaýtarýar {html, label, value} ýa-da null */
function tripleSteps(fNode, S, num, numErr){
  let aN, bN, g1, g2, h1, h2;
  try{ aN = miParse(S.a); bN = miParse(S.b); g1 = miParse(S.g1); g2 = miParse(S.g2); h1 = miParse(S.h1); h2 = miParse(S.h2); }catch(e){ return null; }
  const a = msConstVal(aN), b = msConstVal(bN);
  if(a === null || b === null) return null;
  const show = (n, K) => msP(n, K), steps = [];
  steps.push('<b>Jisim</b>: E = {' + show(aN) + ' ≤ x ≤ ' + show(bN) + ', ' + show(g1) + ' ≤ y ≤ ' + show(g2) + ', ' + show(h1) + ' ≤ z ≤ ' + show(h2) + '}. Üçleýin integraly yzygiderli hasaplaýarys: ∭<sub>E</sub> f dV = ∫<sub>' + show(aN) + '</sub><sup>' + show(bN) + '</sup> ∫<sub>' + show(g1) + '</sub><sup>' + show(g2) + '</sup> ∫<sub>' + show(h1) + '</sub><sup>' + show(h2) + '</sup> f dz dy dx — ilki z boýunça (x, y hemişelik), soň y boýunça (x hemişelik), iň soňunda x boýunça.');
  const Z = miInner(fNode, 'z', h1, h2, 'x, y', miSimpN, show);
  if(!Z || Z.fail) return null;
  steps.push(Z.html.replace('<b>Içki integral</b>', '<b>Birinji (içki) integral</b>'));
  let Y = miInner(Z.I, 'y', g1, g2, 'x', n => miSimp1(n, 'x'), show), K;
  if(Y && Y.fail) Y = null;
  if(Y){ steps.push(Y.html.replace('<b>Içki integral</b>', '<b>Ikinji integral</b>')); K = Y.I; }
  else {
    const sm = miSemi(Z.I, g1, g2);
    if(sm){ K = sm.K; steps.push('<b>Ikinji integral</b> (y boýunça, x hemişelik): ' + sm.txt + ' ⇒ ∫ ' + miPar(show(Z.I)) + ' dy = <b>' + show(K) + '</b>.'); }
  }
  let label, value, O = null;
  if(K){
    O = miOuter(K, 'x', a, b, aN, bN, show, 'x');
    if(O){ steps.push(O.html.replace('<b>Daşky integral</b>', '<b>Üçünji (daşky) integral</b>')); label = O.label; value = O.value; }
  }
  if(!O){
    const nc = niceConst(num, 1e-8*Math.max(1, Math.abs(num)));
    label = nc.exact ? nc.label : '≈ ' + fmtPrec(num, 9);
    value = num;
    steps.push((K ? '<b>Üçünji integral</b> ∫ (' + show(K) + ') dx' : '<b>Galan ikileýin integral</b> ∫∫ (' + show(Z.I) + ') dy dx') + ' elementar usullar bilen bu ýerde tapylmady — san usuly (Gauss–Ležandr) bilen: ' + miEqB(label) + '.');
  }
  const ok = isFinite(num) && Math.abs(value - num) <= Math.max(1e-6*Math.max(1, Math.abs(num)), 20*(numErr || 0));
  if(!ok) return null;
  steps.push('<b>Jogap</b>: ∭<sub>E</sub> f dV ' + miEqB(label) + '.');
  const check = miCheck(value, num, numErr);
  return {html: '<div class="steps-head">Çözgüt ädimme-ädim</div><ol class="steps">' + steps.map(s => '<li>' + s + '</li>').join('') + '</ol>' + check, label, value};
}

/* ===== modules/ui/inputs.js ===== */
/* Iki üýtgeýjili kalkulýatorlaryň girizmeleri: gönüburçluk aralygyny okamak we f(x, y) aňlatmasyndaky ýalňyşlyk üçin türkmençe habar. */

function xyError(id, e, examples, vars){
  const m = /^symbol:(.+)$/.exec((e && e.message) || '');
  showResult(id, m ? '<strong>Ýalňyşlyk:</strong> "' + _esc(m[1]) + '" näbelli — diňe ' + (vars || '<b>x</b> we <b>y</b>') + ' üýtgeýjilerini ulan (mysal: ' + examples + ').'
    : '<strong>Ýalňyşlyk:</strong> aňlatmany we aralyklary barlaň (mysal: ' + examples + ').', true);
}

/* Gönüburçluk aralygyny okamak: {x1, x2, y1, y2} ýa-da null */
function readBox(ids){
  const v = ids.map(id => parseBound(document.getElementById(id).value));
  if(!v.every(isFinite) || !(v[0] < v[1]) || !(v[2] < v[3])) return null;
  return {xMin: v[0], xMax: v[1], yMin: v[2], yMax: v[3]};
}

/* ===== modules/calculators/multi-integral.js ===== */
/* Köp integrallar: goşa integral (I görnüş — dy dx, II görnüş — dx dy, polýar — r dr dθ) we üçleýin integral.
   Mugallym ýaly ädimler (multi-int-steps.js): içki integral → serhetleri goýmak → daşky integral, takyk jogap;
   san usuly: birleşdirilen Gauss–Ležandr (8 nokatly) kwadraturasy — barlag üçin; oblast we üst 2D / 3D görnüşde çyzylýar. */

/* takyk baha (9π, 4π/3, 1/6) — mümkin bolsa, ýogsam niceConst */
function miNice(v, tol){
  const s = fmtNice(v);
  if(!/[.e]/.test(s) || /^[−-]?\d*\/?\(?\d*e/.test(s)) return {exact: true, label: /[π√e]/.test(s) && !Number.isInteger(v) ? s + ' ≈ ' + fmt(v) : s};
  return niceConst(v, tol);
}

/* Bir üýtgeýjili serhet funksiýasy (g₁(x), h₁(y), r₁(θ)) */
function miBound(src, v){
  const node = math.parse(prep(String(src).replace(/θ/g, 't')));
  let bad = null;
  node.traverse((c, path, parent) => {
    if(c.type === 'SymbolNode' && !(parent && parent.type === 'FunctionNode' && path === 'fn') && [v, 'pi', 'e', 'E', 'PI', 'tau', 'phi'].indexOf(c.name) === -1) bad = c.name;
  });
  if(bad) throw new Error('bound:' + bad + ':' + v);
  const c = node.compile(), scope = {};
  return s => { try{ scope[v] = s; const r = c.evaluate(scope); return typeof r === 'number' ? r : NaN; }catch(e){ return NaN; } };
}

/* serhediň owadan ýazgysy: −√(1 − x²), 2π, 1 + cos(θ) */
function miLabel(s){
  try{ return prettyNode(math.parse(prep(String(s).replace(/θ/g, 't')))).replace(/\bt\b/g, 'θ'); }
  catch(e){ return _esc(String(s).trim()).replace(/\bpi\b/gi, 'π').replace(/\bt\b/g, 'θ'); }
}

const MI_LABELS = {
  I: ['x: a', 'x: b', 'y: g₁(x) — aşaky egri', 'y: g₂(x) — ýokarky egri'],
  II: ['y: c', 'y: d', 'x: h₁(y) — çep egri', 'x: h₂(y) — sag egri'],
  polar: ['θ: α', 'θ: β', 'r: r₁(θ) — içki', 'r: r₂(θ) — daşky']
};

/* Görnüş saýlananda meýdanlaryň atlaryny täzeleýär */
function dblModeChanged(){
  const sel = document.getElementById('di-type');
  if(!sel) return;
  const L = MI_LABELS[sel.value] || MI_LABELS.I;
  ['di-a', 'di-b', 'di-g1', 'di-g2'].forEach((id, i) => { const lab = document.querySelector('label[for="' + id + '"]'); if(lab) lab.textContent = L[i]; });
}

/* Oblastyň çägi (polyline-lar) we degişlilik funksiýasy */
function miRegion(mode, a, b, g1, g2){
  const lines = [], M = 120, lo = [], hi = [];
  for(let i = 0; i <= M; i++){
    const s = a + (b - a)*i/M, u = g1(s), w = g2(s);
    if(mode === 'I'){ lo.push([s, u]); hi.push([s, w]); }
    else if(mode === 'II'){ lo.push([u, s]); hi.push([w, s]); }
    else { lo.push([u*Math.cos(s), u*Math.sin(s)]); hi.push([w*Math.cos(s), w*Math.sin(s)]); }
  }
  lines.push(lo, hi);
  if(!(mode === 'polar' && b - a >= 2*Math.PI - 1e-9)) lines.push([lo[0], hi[0]], [lo[M], hi[M]]);   // doly aýlaw bolsa şöhleler gerek däl
  const inside = (x, y) => {
    if(mode === 'I'){ if(x < a || x > b) return false; const u = g1(x), w = g2(x); return y >= Math.min(u, w) && y <= Math.max(u, w); }
    if(mode === 'II'){ if(y < a || y > b) return false; const u = g1(y), w = g2(y); return x >= Math.min(u, w) && x <= Math.max(u, w); }
    const r = Math.hypot(x, y), th = Math.atan2(y, x);
    for(const t of [th, th + 2*Math.PI, th - 2*Math.PI, th + 4*Math.PI]){
      if(t >= a - 1e-12 && t <= b + 1e-12){ const u = g1(t), w = g2(t); if(r >= Math.min(u, w) && r <= Math.max(u, w)) return true; }
    }
    return false;
  };
  const param = (u, v) => {                                   // birlik kwadrat → D (3D gözenegi oblasta geýdirmek üçin)
    const sv = a + (b - a)*(1 - Math.cos(Math.PI*u))/2, lo2 = g1(sv), hi2 = g2(sv), t = lo2 + (hi2 - lo2)*(1 - Math.cos(Math.PI*v))/2;   // gyralara ýygnalýan gözenek
    return mode === 'I' ? [sv, t] : mode === 'II' ? [t, sv] : [t*Math.cos(sv), t*Math.sin(sv)];
  };
  const pts = lines.flat().filter(p => isFinite(p[0]) && isFinite(p[1]));
  let x0 = Math.min.apply(null, pts.map(p => p[0])), x1 = Math.max.apply(null, pts.map(p => p[0]));
  let y0 = Math.min.apply(null, pts.map(p => p[1])), y1 = Math.max.apply(null, pts.map(p => p[1]));
  const px = Math.max(0.08*(x1 - x0), 0.1), py = Math.max(0.08*(y1 - y0), 0.1);
  return {lines, inside, param, box: {xMin: x0 - px, xMax: x1 + px, yMin: y0 - py, yMax: y1 + py}};
}

function calcDouble(){
  dblModeChanged();
  let F;
  try{ F = xyCompile(document.getElementById('di-f').value); }
  catch(e){ xyError('di-result', e, 'x*y, x^2 + y^2, 1, e^(-x^2 - y^2)'); return; }
  try{
    const mode = document.getElementById('di-type').value, vin = mode === 'I' ? 'x' : mode === 'II' ? 'y' : 't';
    const aStr = document.getElementById('di-a').value, bStr = document.getElementById('di-b').value;
    const g1Str = document.getElementById('di-g1').value, g2Str = document.getElementById('di-g2').value;
    const a = parseBound(aStr), b = parseBound(bStr);
    if(!isFinite(a) || !isFinite(b) || !(a < b)){ showResult('di-result', '<strong>Ýalňyşlyk:</strong> daşky serhetler san bolmaly we birinjisi ikinjisinden kiçi bolmaly (mysal: 0 we 1, polýar üçin 0 we 2*pi).', true); return; }
    let g1, g2;
    try{ g1 = miBound(g1Str, vin); g2 = miBound(g2Str, vin); }
    catch(e){
      const m = /^bound:(.+):(.+)$/.exec(e.message), vn = vin === 't' ? 'θ (ýa-da t)' : vin;
      showResult('di-result', '<strong>Ýalňyşlyk:</strong> içki serhetlerde diňe <b>' + vn + '</b> üýtgeýjisini ulan' + (m ? ' ("' + _esc(m[1]) + '" bolmaz)' : '') + '. Mysal: ' + (vin === 'x' ? 'x^2, sqrt(1 - x^2)' : vin === 'y' ? 'y, 2 - y' : '0, 1 + cos(θ)') + '.', true);
      return;
    }
    const f = F.f;
    const integrand = mode === 'polar' ? ((s, r) => f(r*Math.cos(s), r*Math.sin(s))*r) : mode === 'I' ? ((s, t) => f(s, t)) : ((s, t) => f(t, s));
    const unit = mode === 'polar' ? ((s, r) => r) : (() => 1);
    const dbl = (h, P) => glIntegrate(s => { const u = g1(s), w = g2(s); return (isFinite(u) && isFinite(w)) ? glIntegrate(t => h(s, t), u, w, P) : NaN; }, a, b, P);
    let neg = false;
    for(let i = 0; i <= 40; i++){ const s = a + (b - a)*i/40; if(g1(s) > g2(s) + 1e-12) neg = true; }
    const I8 = dbl(integrand, 8), I4 = dbl(integrand, 4), S = dbl(unit, 8);
    if(!isFinite(I8)){ showResult('di-result', '<strong>Ýalňyşlyk:</strong> integral hasaplanmady — f(x, y) ýa-da serhetler oblastyň käbir nokadynda kesgitlenmedik (mysal, kök astynda otrisatel san).', true); return; }
    const err = Math.abs(I8 - I4), niceS = miNice(S, 1e-9*Math.max(1, Math.abs(S)));
    let nice = niceConst(I8, Math.max(err, 1e-12*Math.max(1, Math.abs(I8)))), St = null;
    try{ St = doubleSteps(F.node, mode, {a: aStr, b: bStr, g1: g1Str, g2: g2Str}, I8, err); }catch(e){ St = null; }
    if(St && !/^≈/.test(St.label)) nice = {exact: true, label: St.label};
    const vOut = mode === 'I' ? 'x' : mode === 'II' ? 'y' : 'θ', vIn = mode === 'I' ? 'y' : mode === 'II' ? 'x' : 'r';
    const dd = mode === 'I' ? 'dy dx' : mode === 'II' ? 'dx dy' : 'r dr dθ';
    const fShow = mode === 'polar' ? 'f(r cos θ, r sin θ)' : prettyNode(F.node);
    let html = '<strong>Integral:</strong> ∫<sub>' + miLabel(aStr) + '</sub><sup>' + miLabel(bStr) + '</sup> ∫<sub>' + miLabel(g1Str) + '</sub><sup>' + miLabel(g2Str) + '</sup> ' + fShow + ' ' + dd +
      (mode === 'polar' ? ' <span class="muted" style="font-size:.82rem">(f(x, y) = ' + prettyNode(F.node) + ', x = r cos θ, y = r sin θ, dA = r dr dθ)</span>' : '') + (St ? St.html : '<br>') +
      '<strong>Netije:</strong> ∬<sub>D</sub> f dA ' + (nice.exact ? '= <b>' + nice.label + '</b>' : '≈ <b>' + fmtPrec(I8, 9) + '</b>') + (St ? '' : ' <span class="muted" style="font-size:.82rem">(takmynan ýalňyşlyk ' + fmt(Math.max(err, 1e-15)) + ')</span>') + '<br>' +
      '<strong>D oblastyň meýdany:</strong> S = ∬<sub>D</sub> 1 dA ' + (niceS.exact ? '= ' + niceS.label : '≈ ' + fmtPrec(S, 8)) + '<br>' +
      (Math.abs(S) > 1e-12 ? '<strong>f-iň ortaça bahasy:</strong> f<sub>ort</sub> = (1/S)·∬ f dA ≈ ' + fmtPrec(I8/S, 8) + '<br>' : '');
    const rows = [0, 1, 2, 3, 4].map(k => {
      const s = a + (b - a)*k/4, u = g1(s), w = g2(s), v = glIntegrate(t => integrand(s, t), u, w, 8);
      return '<tr><td>' + fmt(s) + '</td><td>' + fmt(u) + ' … ' + fmt(w) + '</td><td>' + fmtPrec(v, 8) + '</td></tr>';
    }).join('');
    const tbl = '<table class="conv"><tr><th>' + vOut + '</th><th>' + vIn + ' aralygy</th><th>içki integral</th></tr>' + rows + '</table>';
    html += St ? '<details class="numcheck"><summary>San usuly: içki integralyň käbir ' + vOut + ' bahalaryndaky san bahalary</summary>' + tbl + '</details>'
      : '<span class="muted" style="font-size:.85rem">Yzygiderli integrirleme: ilki içki integral (' + vIn + ' boýunça, ' + vOut + ' hemişelik), soň daşky (' + vOut + ' boýunça):</span>' + tbl;
    if(neg) html += '<span class="muted" style="font-size:.85rem">⚠ Käbir ýerlerde aşaky serhet ýokarkysyndan uly — şol bölekde integral alamatyny çalşýar.</span><br>';
    const R = miRegion(mode, a, b, g1, g2), box = R.box;
    let pos = true, seen = 0;                                      // f ≥ 0 bolsa integral — üstüň aşagyndaky jisimiň göwrümi
    for(let j = 0; j <= 30 && pos; j++) for(let i = 0; i <= 30 && pos; i++){
      const x = box.xMin + (box.xMax - box.xMin)*i/30, y = box.yMin + (box.yMax - box.yMin)*j/30;
      if(!R.inside(x, y)) continue;
      const v = f(x, y); if(isFinite(v)){ seen++; if(v < -1e-12) pos = false; }
    }
    if(pos && seen > 10) html += '<span class="muted" style="font-size:.85rem">D oblastda f ≥ 0, şonuň üçin bu integral — D-niň üstündäki z = f(x, y) üstüň aşagyndaky jisimiň <b>göwrümi</b>.</span>';
    showResult('di-result', html, false);
    const polys = R.lines.map(l => ({pts: l, color: '#154a92', width: 2}));
    plotField('di-graph2d', f, box, {equal: true, mask: R.inside, levels: 10, polylines: polys, colorbar: 'di-cbar2d'});
    bindReadout('di-graph2d', 'di-read', (x, y) => R.inside(x, y) ? 'x = ' + fmtPrec(x, 4) + ',  y = ' + fmtPrec(y, 4) + ',  f(x, y) = ' + fmtPrec(f(x, y), 6) : 'D oblastyň daşy', 'D oblast reňklenen (reňk — f-iň bahasy); gök çyzyklar — oblastyň çägi.');
    // 3D: üst D-niň üstünde, pol z = 0 (göwrüm manysy üçin), gyralarda dik "diwarlar"
    let zlo = 0, zhi = 0;
    for(let j = 0; j <= 40; j++) for(let i = 0; i <= 40; i++){ const x = box.xMin + (box.xMax - box.xMin)*i/40, y = box.yMin + (box.yMax - box.yMin)*j/40; if(!R.inside(x, y)) continue; const v = f(x, y); if(isFinite(v)){ zlo = Math.min(zlo, v); zhi = Math.max(zhi, v); } }
    if(zhi - zlo < 1e-9) zhi = zlo + 1;
    const lifted = R.lines.map(l => ({pts: l.map(p => [p[0], p[1], f(p[0], p[1])]), color: '#154a92', width: 1.8}));
    const walls = [];
    R.lines.forEach(l => { for(let k = 0; k < l.length; k += 10){ const p = l[k], z = f(p[0], p[1]); if(isFinite(z)) walls.push({pts: [[p[0], p[1], 0], [p[0], p[1], z]], color: 'rgba(21,74,146,.35)', width: 1}); } });
    plotSurface3D('di-graph3d', {box, surfaces: [{f, param: R.param, n: 40}], zRange: [zlo - 0.04*(zhi - zlo), zhi + 0.04*(zhi - zlo)], curves: walls.concat(lifted),
      floorCurves: R.lines.map(l => ({pts: l, color: '#154a92', width: 1.6})), colorbar: 'di-cbar3d'});
  } catch(e){
    xyError('di-result', e, 'x*y, x^2 + y^2, 1');
  }
}

/* f(x, y, z) */
function miXYZ(src){
  const node = math.parse(prep(src));
  let bad = null;
  node.traverse((c, path, parent) => { if(c.type === 'SymbolNode' && !(parent && parent.type === 'FunctionNode' && path === 'fn') && ['x', 'y', 'z', 'pi', 'e', 'E', 'PI', 'tau', 'phi'].indexOf(c.name) === -1) bad = c.name; });
  if(bad) throw new Error('symbol:' + bad);
  const c = node.compile(), scope = {x: 0, y: 0, z: 0};
  return {node, f: (x, y, z) => { try{ scope.x = x; scope.y = y; scope.z = z; const r = c.evaluate(scope); return typeof r === 'number' ? r : NaN; }catch(e){ return NaN; } }};
}

function calcTriple(){
  let F, g1, g2, H1, H2;
  try{ F = miXYZ(document.getElementById('ti-f').value); }
  catch(e){ xyError('ti-result', e, 'x*y*z, 1, x^2 + y^2 + z^2', '<b>x</b>, <b>y</b> we <b>z</b>'); return; }
  const ids = ['ti-a', 'ti-b', 'ti-g1', 'ti-g2', 'ti-h1', 'ti-h2'], S = ids.map(id => document.getElementById(id).value);
  try{ g1 = miBound(S[2], 'x'); g2 = miBound(S[3], 'x'); }
  catch(e){ showResult('ti-result', '<strong>Ýalňyşlyk:</strong> y serhetlerinde (g₁, g₂) diňe <b>x</b> üýtgeýjisini ulan (mysal: 0, 1 - x, sqrt(1 - x^2)).', true); return; }
  try{ H1 = xyCompile(S[4]); H2 = xyCompile(S[5]); }
  catch(e){ showResult('ti-result', '<strong>Ýalňyşlyk:</strong> z serhetlerinde (h₁, h₂) diňe <b>x</b> we <b>y</b> üýtgeýjilerini ulan (mysal: 0, 1 - x - y).', true); return; }
  try{
    const a = parseBound(S[0]), b = parseBound(S[1]);
    if(!isFinite(a) || !isFinite(b) || !(a < b)){ showResult('ti-result', '<strong>Ýalňyşlyk:</strong> x serhetleri san bolmaly we a &lt; b (mysal: 0 we 1).', true); return; }
    const f = F.f, h1 = H1.f, h2 = H2.f;
    const tri = P => glIntegrate(x => {
      const u = g1(x), w = g2(x);
      if(!isFinite(u) || !isFinite(w)) return NaN;
      return glIntegrate(y => { const p = h1(x, y), q = h2(x, y); return (isFinite(p) && isFinite(q)) ? glIntegrate(z => f(x, y, z), p, q, P) : NaN; }, u, w, P);
    }, a, b, P);
    const vol = P => glIntegrate(x => { const u = g1(x), w = g2(x); return glIntegrate(y => h2(x, y) - h1(x, y), u, w, P); }, a, b, P);
    const I4 = tri(4), I2 = tri(2), V = vol(8), A = glIntegrate(x => g2(x) - g1(x), a, b, 8);
    if(!isFinite(I4)){ showResult('ti-result', '<strong>Ýalňyşlyk:</strong> integral hasaplanmady — f ýa-da serhetler käbir nokatda kesgitlenmedik.', true); return; }
    const err = Math.abs(I4 - I2), niceV = miNice(V, Math.max(Math.abs(V - vol(4)), 1e-12));
    let nice = niceConst(I4, Math.max(err, 1e-12)), St = null;
    try{ St = tripleSteps(F.node, {a: S[0], b: S[1], g1: S[2], g2: S[3], h1: S[4], h2: S[5]}, I4, err); }catch(e){ St = null; }
    if(St && !/^≈/.test(St.label)) nice = {exact: true, label: St.label};
    let html = '<strong>Integral:</strong> ∫<sub>' + miLabel(S[0]) + '</sub><sup>' + miLabel(S[1]) + '</sup> ∫<sub>' + miLabel(S[2]) + '</sub><sup>' + miLabel(S[3]) + '</sup> ∫<sub>' + miLabel(S[4]) + '</sub><sup>' + miLabel(S[5]) + '</sup> ' + prettyNode(F.node) + ' dz dy dx' + (St ? St.html : '<br>') +
      '<strong>Netije:</strong> ∭<sub>E</sub> f dV ' + (nice.exact ? '= <b>' + nice.label + '</b>' : '≈ <b>' + fmtPrec(I4, 8) + '</b>') + (St ? '' : ' <span class="muted" style="font-size:.82rem">(takmynan ýalňyşlyk ' + fmt(Math.max(err, 1e-15)) + ')</span>') + '<br>' +
      '<strong>E jisimiň göwrümi:</strong> V = ∭ 1 dV = ∬<sub>D</sub> (h₂ − h₁) dA ' + (niceV.exact ? '= ' + niceV.label : '≈ ' + fmtPrec(V, 8)) + '<br>' +
      (Math.abs(V) > 1e-12 ? '<strong>f-iň ortaça bahasy:</strong> (1/V)·∭ f dV ≈ ' + fmtPrec(I4/V, 8) + '<br>' : '') +
      '<strong>D (xy tekizlige proýeksiýa) meýdany:</strong> ' + (function(){ const n = miNice(A, 1e-9*Math.max(1, Math.abs(A))); return n.exact ? n.label : fmtPrec(A, 8); })() + '<br>' +
      (St ? '' : '<span class="muted" style="font-size:.85rem">Tertip: ilki z boýunça (h₁(x, y) … h₂(x, y)), soň y boýunça (g₁(x) … g₂(x)), iň soňunda x boýunça (a … b).</span>');
    showResult('ti-result', html, false);
    const R = miRegion('I', a, b, g1, g2);
    plotSurface3D('ti-graph3d', {box: R.box, surfaces: [{f: h2, param: R.param, n: 40}, {f: h1, param: R.param, n: 40, color: '#9aa5b1', alpha: 0.9, depthBias: -0.08}],
      floorCurves: R.lines.map(l => ({pts: l, color: '#154a92', width: 1.8})), colorbar: 'ti-cbar3d', equalZ: true});
  } catch(e){
    xyError('ti-result', e, 'x*y*z, 1', '<b>x</b>, <b>y</b> we <b>z</b>');
  }
}

/* ===== modules/solvers/limit2d-steps.js ===== */
/* Iki üýtgeýänli limit — mugallym ýaly ädimme-ädim (11-nji sapak): göni goýmak; y = kx, y = kx², x = ky² … ýollar (rasional funksiýa —
   iň pes derejeli agzalar bilen köp agzaly arifmetika, aýratyn k bahalary); polýar koordinatalar (|f − L| ≤ C·rᵖ), radial simmetriýa
   (bir üýtgeýjili limite getirmek) we bir jynsly funksiýalar. */

/* köp agzaly köpagza: Map("i,j" → c) — Xⁱ·Yʲ (X = x − a, Y = y − b) */
const MP_MAX = 24;

function mpC(c){ const m = new Map(); if(c !== 0) m.set('0,0', c); return m; }

function mpXY(i, j){ const m = new Map(); m.set(i + ',' + j, 1); return m; }

function mpAdd(A, B, s){
  const R = new Map(A);
  B.forEach((v, k) => { const w = (R.get(k) || 0) + s*v; if(Math.abs(w) < 1e-12) R.delete(k); else R.set(k, w); });
  return R;
}

function mpMul(A, B){
  const R = new Map();
  A.forEach((a, ka) => {
    const [i1, j1] = ka.split(',').map(Number);
    B.forEach((b, kb) => {
      const [i2, j2] = kb.split(',').map(Number);
      if(i1 + i2 + j1 + j2 > MP_MAX) throw new Error('dereje');
      const k = (i1 + i2) + ',' + (j1 + j2);
      R.set(k, (R.get(k) || 0) + a*b);
    });
  });
  R.forEach((v, k) => { if(Math.abs(v) < 1e-12) R.delete(k); });
  return R;
}

function mpScale(A, c){ const R = new Map(); A.forEach((v, k) => { if(Math.abs(v*c) >= 1e-12) R.set(k, v*c); }); return R; }

/* rasional funksiýa {n, d} (x = a + X, y = b + Y) ýa-da null */
function mrFrom(node, a, b){
  node = unwrap(node);
  if(msConstTree(node)){ const v = msConstVal(node); return v === null ? null : {n: mpC(v), d: mpC(1)}; }
  if(node.type === 'SymbolNode'){
    if(node.name === 'x') return {n: mpAdd(mpC(a), mpXY(1, 0), 1), d: mpC(1)};
    if(node.name === 'y') return {n: mpAdd(mpC(b), mpXY(0, 1), 1), d: mpC(1)};
    return null;
  }
  if(node.type !== 'OperatorNode') return null;
  const f = node.fn;
  if(f === 'unaryPlus') return mrFrom(node.args[0], a, b);
  if(f === 'unaryMinus'){ const r = mrFrom(node.args[0], a, b); return r && {n: mpScale(r.n, -1), d: r.d}; }
  if(f === 'add' || f === 'subtract' || f === 'multiply' || f === 'divide'){
    const p = mrFrom(node.args[0], a, b), q = mrFrom(node.args[1], a, b);
    if(!p || !q) return null;
    const s = f === 'subtract' ? -1 : 1;
    if(f === 'add' || f === 'subtract'){
      const one = r => r.d.size === 1 && r.d.get('0,0') === 1;
      if(one(p) && one(q)) return {n: mpAdd(p.n, q.n, s), d: mpC(1)};
      return {n: mpAdd(mpMul(p.n, q.d), mpMul(q.n, p.d), s), d: mpMul(p.d, q.d)};
    }
    if(f === 'multiply') return {n: mpMul(p.n, q.n), d: mpMul(p.d, q.d)};
    if(!q.n.size) return null;
    return {n: mpMul(p.n, q.d), d: mpMul(p.d, q.n)};
  }
  if(f === 'pow'){
    const k = msConstTree(node.args[1]) ? msConstVal(node.args[1]) : null;
    if(k === null || !Number.isInteger(k) || Math.abs(k) > 12) return null;
    const r = mrFrom(node.args[0], a, b);
    if(!r) return null;
    let n = mpC(1), d = mpC(1);
    for(let i = 0; i < Math.abs(k); i++){ n = mpMul(n, r.n); d = mpMul(d, r.d); }
    return k >= 0 ? {n, d} : {n: d, d: n};
  }
  return null;
}

/* Y = k·Xᵐ ýol: p → k-nyň köpagzasy (koeffisiýentler) */
function mpPath(P, m){
  const out = new Map();
  P.forEach((c, key) => {
    const [i, j] = key.split(',').map(Number), p = i + m*j;
    if(!out.has(p)) out.set(p, []);
    const arr = out.get(p);
    while(arr.length <= j) arr.push(0);
    arr[j] += c;
  });
  out.forEach((arr, p) => { while(arr.length > 1 && Math.abs(arr[arr.length - 1]) < 1e-12) arr.pop(); if(arr.every(v => Math.abs(v) < 1e-12)) out.delete(p); });
  return out;
}

const mpLow = M => M.size ? Math.min(...M.keys()) : null;

/* Σ c_p(k)·tᵖ görnüşi */
function mpPathHtml(M, t, shift){
  const ps = [...M.keys()].sort((p, q) => p - q);
  if(!ps.length) return '0';
  if(ps.length === 1 && ps[0] === (shift || 0)) return polyHtml(M.get(ps[0]), 'k');
  const parts = ps.map(p0 => {
    const arr = M.get(p0), p = p0 - (shift || 0), nz = arr.filter(v => Math.abs(v) > 1e-12).length, cs = polyHtml(arr, 'k');
    const tp = p === 0 ? '' : p === 1 ? t : t + '<sup>' + p + '</sup>';
    if(!tp) return {neg: false, s: nz > 1 ? '(' + cs + ')' : cs};
    if(cs === '1') return {neg: false, s: tp};
    if(cs === '−1') return {neg: true, s: tp};
    if(nz > 1) return {neg: false, s: '(' + cs + ')' + tp};
    return cs.charAt(0) === '−' ? {neg: true, s: cs.slice(1) + tp} : {neg: false, s: cs + tp};
  });
  return parts.map((q, i) => i === 0 ? (q.neg ? '−' : '') + q.s : (q.neg ? ' − ' : ' + ') + q.s).join('');
}

const mpFrac = (u, v) => (mpTopSum(u) ? '(' + u + ')' : u) + '/' + (/^([a-zθ](<sup>\d+<\/sup>)?|\d+)$/.test(v) ? v : '(' + v + ')');

/* x ↔ y çalyşmak (x = k·yᵐ ýollar üçin) */
function mpSwap(P){ const R = new Map(); P.forEach((c, key) => { const [i, j] = key.split(','); R.set(j + ',' + i, c); }); return R; }

/* ýoluň k-a degişli bahasyndaky iň pes agzalar: {p, c} */
function mpAtK(M, kv){
  let best = null;
  [...M.keys()].sort((p, q) => p - q).forEach(p => { if(best) return; const c = polyEval(M.get(p), kv); if(Math.abs(c) > 1e-12) best = {p, c}; });
  return best;
}

/* ýol boýunça limit: {kind: 'const'|'k'|'inf'|'deg', L?, txt}. sw — x = k·yᵐ ýollar */
function mpPathLimit(R, m, a, b, sw){
  const N = mpPath(sw ? mpSwap(R.n) : R.n, m), D = mpPath(sw ? mpSwap(R.d) : R.d, m), q = mpLow(D);
  const origin = Math.abs(a) < 1e-12 && Math.abs(b) < 1e-12, t = origin ? (sw ? 'y' : 'x') : 't';
  const mp = m === 1 ? '' : m === 2 ? '²' : m === 3 ? '³' : '<sup>' + m + '</sup>';
  const pathS = origin ? (sw ? 'x = ky' + mp : 'y = kx' + mp) : (sw ? 'y = ' + fmtNice(b) + ' + t, x = ' + fmtNice(a) + ' + kt' + mp : 'x = ' + fmtNice(a) + ' + t, y = ' + fmtNice(b) + ' + kt' + mp);
  const fS = origin ? (sw ? 'f(ky' + mp + ', y)' : 'f(x, kx' + mp + ')') : 'f';
  if(q === null) return {kind: 'deg', txt: pathS + ' ýollar boýunça maýdalawjy nola deň — funksiýa kesgitlenmedik.'};
  const p = mpLow(N);
  let txt = '<b>' + pathS + '</b> ýollar boýunça (' + t + ' → 0): ' + fS + ' = ' + mpFrac(mpPathHtml(N, t), mpPathHtml(D, t));
  if(q > 0) txt += ' = ' + mpFrac(mpPathHtml(N, t, q), mpPathHtml(D, t, q)) + ' (' + t + (q > 1 ? '<sup>' + q + '</sup>' : '') + '-a gysgaltdyk)';
  const dk = D.get(q), kr = dk.length > 1 ? (msPolyRoots(dk) || {roots: []}).roots : [];
  /* aýratyn k bahalary (iň pes agza ýitýär): şol ýol boýunça limit başga bolup biler */
  const special = L0 => {
    for(const kv of kr){
      const n0 = mpAtK(N, kv), d0 = mpAtK(D, kv);
      if(!d0) continue;                                       // ýol kesgitleniş ýaýlasynyň daşynda
      const Lk = !n0 || n0.p > d0.p ? 0 : n0.p === d0.p ? n0.c/d0.c : Infinity;
      if(!isFinite(Lk) || Math.abs(Lk - L0) > 1e-9) return {kv, Lk};
    }
    return null;
  };
  const kNote = kr.length ? ' (k ≠ ' + kr.map(r => fmtNice(r)).join(', ') + ' bolanda)' : '';
  const spTxt = sp => ' Emma k = ' + fmtNice(sp.kv) + ' bolanda maýdalawjynyň iň pes agzasy ýitýär: bu ýol boýunça limit ' + (isFinite(sp.Lk) ? fmtNice(sp.Lk) : '∞') + '.';
  if(p === null || p > q){
    const sp = special(0);
    if(sp) return {kind: 'k', txt: txt + ' → 0' + kNote + '.' + spTxt(sp)};
    return {kind: 'const', L: 0, txt: txt + ' → <b>0</b>' + kNote + ' — ähli şeýle ýollar boýunça şol bir baha.'};
  }
  if(p < q) return {kind: 'inf', txt: txt + ' → ∞ — limit tükenikli däl.'};
  const nk = N.get(p), len = Math.max(nk.length, dk.length), nn = [], dd = [];
  for(let i = 0; i < len; i++){ nn.push(nk[i] || 0); dd.push(dk[i] || 0); }
  const i0 = dd.findIndex(v => Math.abs(v) > 1e-12), ratio = nn[i0]/dd[i0];
  if(nn.every((v, i) => Math.abs(v - ratio*dd[i]) <= 1e-9*Math.max(1, Math.abs(v)))){
    const sp = special(ratio);
    if(sp) return {kind: 'k', txt: txt + ' → ' + fmtNice(ratio) + kNote + '.' + spTxt(sp)};
    return {kind: 'const', L: ratio, txt: txt + ' → <b>' + fmtNice(ratio) + '</b> — k-a bagly däl.'};
  }
  const phi = kv => polyEval(nk, kv)/polyEval(dk, kv), ks = [0, 1, -1, 2, 0.5, 3].filter(kv => Math.abs(polyEval(dk, kv)) > 1e-12);
  let k1 = ks[0], k2 = null;
  for(const kv of ks.slice(1)) if(Math.abs(phi(kv) - phi(k1)) > 1e-9){ k2 = kv; break; }
  txt += ' → ' + mpFrac(polyHtml(nk, 'k'), polyHtml(dk, 'k')) + ' — netije k-a bagly';
  if(k2 !== null) txt += ': mysal üçin k = ' + fmtNice(k1) + ' bolanda ' + fmtNice(phi(k1)) + ', k = ' + fmtNice(k2) + ' bolanda ' + fmtNice(phi(k2));
  return {kind: 'k', txt: txt + '.'};
}

/* bir jynsly bölek: Σ c_ij cosⁱθ sinʲθ (i + j = p) */
function mpHomog(P, p){
  const terms = [];
  P.forEach((c, key) => { const [i, j] = key.split(',').map(Number); if(i + j === p) terms.push({i, j, c}); });
  return terms;
}

function mpLowDeg(P){ let d = Infinity; P.forEach((c, key) => { const [i, j] = key.split(',').map(Number); d = Math.min(d, i + j); }); return d; }

function mpHomogNode(terms){
  const th = msSym('θ');
  let out = null;
  terms.forEach(({i, j, c}) => {
    let t = null;
    const pw = (fn, k) => k === 0 ? null : k === 1 ? new math.FunctionNode(fn, [th]) : msPow(new math.FunctionNode(fn, [th]), msN(k));
    [pw('cos', i), pw('sin', j)].forEach(f => { if(f) t = t === null ? f : msMul(t, f); });
    const a = Math.abs(c);
    t = t === null ? msNum(a) : Math.abs(a - 1) < 1e-12 ? t : msMul(msNum(a), t);
    out = out === null ? (c < 0 ? msNeg(t) : t) : (c < 0 ? msSub(out, t) : msAdd(out, t));
  });
  return out || msN(0);
}

const mpHomogVal = (terms, th) => terms.reduce((s, {i, j, c}) => s + c*Math.pow(Math.cos(th), i)*Math.pow(Math.sin(th), j), 0);

/* f(a + r cos θ, b + r sin θ) θ-a bagly dälmi (radial simmetriýa) */
function msRadial(f, a, b){
  let n = 0;
  for(const r of [0.13, 0.41, 0.77]){
    const v0 = f({x: a + r, y: b});
    for(let k = 1; k < 9; k++){
      const th = k*0.7, v = f({x: a + r*Math.cos(th), y: b + r*Math.sin(th)});
      if(!isFinite(v0) || !isFinite(v)) continue;
      if(Math.abs(v - v0) > 1e-9*Math.max(1, Math.abs(v0))) return false;
      n++;
    }
  }
  return n >= 8;
}

function msContAt(f, a, b, v0){
  for(const r of [1e-4, 1e-6]) for(let k = 0; k < 12; k++){
    const v = f({x: a + r*Math.cos(k*0.52), y: b + r*Math.sin(k*0.52)});
    if(!isFinite(v) || Math.abs(v - v0) > 1e-3*Math.max(1, Math.abs(v0))) return false;
  }
  return true;
}

/* Gaýtarýar {html, verdict: 'yes'|'no'|null, L} ýa-da null (ädimler gurulmasa) */
function limit2DSteps(fNode, a, b){
  const f = msEval(fNode), fab = f({x: a, y: b}), A0 = fmtNice(a) + ', ' + fmtNice(b), K = msK({x: a, y: b});
  const steps = [];
  const wrap = (verdict, L) => ({html: '<div class="steps-head">Çözgüt ädimme-ädim</div><ol class="steps">' + steps.map(s => '<li>' + s + '</li>').join('') + '</ol>', verdict, L});
  if(isFinite(fab) && msContAt(f, a, b, fab)){
    const s = msP(fNode, K);
    steps.push('<b>Göni goýmak</b>: f — elementar funksiýa we (' + fmtNice(a) + '; ' + fmtNice(b) + ') nokat onuň kesgitleniş ýaýlasynyň içinde, şol ýerde f üznüksiz. Şonuň üçin limit funksiýanyň bahasyna deň: lim f = f(' + A0 + ') = ' + (s.length <= 150 ? s + ' = ' : '') + '<b>' + fmtNice(fab) + '</b>.');
    return wrap('yes', fab);
  }
  const u = unwrap(fNode);
  let form = 'kesgitlenmedik baha';
  if(u.type === 'OperatorNode' && u.fn === 'divide'){
    const nv = msEval(u.args[0])({x: a, y: b}), dv = msEval(u.args[1])({x: a, y: b});
    if(Math.abs(nv) < 1e-12 && Math.abs(dv) < 1e-12) form = '<b>0/0</b> görnüşli näbellilik';
    else if(Math.abs(dv) < 1e-12) form = fmtNice(nv) + '/0 (maýdalawjy nola ymtylýar)';
  }
  steps.push('<b>Göni goýmak</b>: x = ' + fmtNice(a) + ', y = ' + fmtNice(b) + ' goýsak ' + form + ' alynýar. Limit bar bolsa, nokada <i>islendik</i> ýol bilen ýakynlaşanda şol bir baha alynmaly — şony barlaýarys.');
  let R = null;
  try{ R = mrFrom(fNode, a, b); }catch(e){ R = null; }
  if(R && R.d.size){
    const L1 = mpPathLimit(R, 1, a, b);
    steps.push(L1.txt);
    if(L1.kind === 'k'){ steps.push('<b>Netije</b>: nokada dürli göni çyzyklar boýunça ýakynlaşanda dürli bahalar alynýar ⇒ limit <b>ýok</b>.'); return wrap('no', null); }
    if(L1.kind !== 'const') return L1.kind === 'inf' ? (steps.push('<b>Netije</b>: tükenikli limit ýok.'), wrap('no', null)) : null;
    const L2 = mpPathLimit(R, 2, a, b);
    steps.push(L2.txt.replace(' ýollar boýunça', ' parabolalar boýunça'));
    if(L2.kind === 'k' || (L2.kind === 'const' && Math.abs(L2.L - L1.L) > 1e-9) || L2.kind === 'inf'){
      steps.push('<b>Netije</b>: göni çyzyklar boýunça ' + fmtNice(L1.L) + ', ýöne parabolalar boýunça başga baha alynýar ⇒ limit <b>ýok</b>.');
      return wrap('no', null);
    }
    const L = L1.L, Np = mpAdd(R.n, mpScale(R.d, L), -1), q = mpLowDeg(R.d), p = Np.size ? mpLowDeg(Np) : Infinity;
    const Dt = mpHomog(R.d, q), mD = Math.min(...Array.from({length: 360}, (_, i) => Math.abs(mpHomogVal(Dt, i*Math.PI/180))));
    const sD = Dt.reduce((s, t) => s + Math.abs(t.c), 0);
    const xs = Math.abs(a) < 1e-12 ? 'r·cos θ' : fmtNice(a) + ' + r·cos θ', ys = Math.abs(b) < 1e-12 ? 'r·sin θ' : fmtNice(b) + ' + r·sin θ';
    if(p === Infinity){ steps.push('<b>Polýar barlag</b>: f − ' + fmtNice(L) + ' ≡ 0 nokadyň töwereginde ⇒ limit <b>' + fmtNice(L) + '</b>.'); return wrap('yes', L); }
    if(mD > 1e-9*sD && p > q){
      const Nt = mpHomog(Np, p), M = Nt.reduce((s, t) => s + Math.abs(t.c), 0);
      const exact = mpLowDeg(R.d) === q && [...R.d.keys()].every(k => k.split(',').map(Number).reduce((x, y) => x + y) === q) && [...Np.keys()].every(k => k.split(',').map(Number).reduce((x, y) => x + y) === p);
      const dConst = Math.max(...Array.from({length: 36}, (_, i) => Math.abs(mpHomogVal(Dt, i*0.17) - mpHomogVal(Dt, 0)))) < 1e-9*sD;
      const nN = mpHomogNode(Nt), un = unwrap(nN), nS = msP(nN), nP = (un.type === 'OperatorNode' && (un.fn === 'add' || un.fn === 'subtract')) ? '(' + nS + ')' : nS;
      const dv = mpHomogVal(Dt, 0), dS = dConst ? fmtNice(dv) : '(' + msP(mpHomogNode(Dt)) + ')', e = p - q, dots = exact ? '' : ' + …';
      const rp = k => k === 1 ? 'r' : 'r<sup>' + k + '</sup>';
      const lhs = Math.abs(L) < 1e-12 ? 'f' : 'f − ' + msNumP(L);
      const bound = M/mD, bS = /[.e]/.test(fmtNice(bound)) ? fmt(bound) : fmtNice(bound);
      const den = dConst && Math.abs(dv - 1) < 1e-12 ? rp(q) : rp(q) + '·' + dS;
      steps.push('<b>Polýar koordinatalar</b>: x = ' + xs + ', y = ' + ys + ' (r → 0, θ — islendik)' + (exact ? '' : ', iň pes derejeli agzalary saklaýarys') + ': ' +
        lhs + ' = ' + rp(p) + '·' + nP + '/' + (dots || den !== rp(q) ? '(' + den + dots + ')' : den) + ' ' + (exact ? '= ' : '≈ ') + rp(e) + '·' + nP + (dConst && Math.abs(dv - 1) < 1e-12 ? '' : '/' + dS) + '. ' +
        '|cos θ| ≤ 1, |sin θ| ≤ 1 bolany üçin |' + lhs + '| ≤ ' + (bS === '1' ? '' : (/[\/√]/.test(bS) ? '(' + bS + ')' : bS) + '·') + rp(e) + (exact ? '' : ' (kiçi r üçin)') + ' → 0, θ-a bagly bolmazdan.');
      steps.push('<b>Netije</b>: f nokada islendik ýol bilen ýakynlaşanda ' + fmtNice(L) + '-e ymtylýar ⇒ limit <b>bar</b>: lim f = <b>' + fmtNice(L) + '</b>.');
      return wrap('yes', L);
    }
    for(const [m, sw] of [[2, true], [3, false], [3, true], [4, false], [4, true]]){   // beýleki egri ýollar: x = ky², y = kx³, …
      const Lm = mpPathLimit(R, m, a, b, sw);
      if(Lm.kind === 'k' || Lm.kind === 'inf' || (Lm.kind === 'const' && Math.abs(Lm.L - L) > 1e-9)){
        steps.push(Lm.txt);
        steps.push('<b>Netije</b>: dürli egri ýollar boýunça dürli bahalar alynýar ⇒ limit <b>ýok</b>.');
        return wrap('no', null);
      }
    }
    steps.push('<b>Polýar barlag</b>: maýdalawjynyň iň pes derejeli bölegi käbir ugurda nola deň bolýar, şonuň üçin bu usul bilen bahalandyryp bolmady; barlanan ähli ýollar boýunça baha ' + fmtNice(L) + ' — aşakdaky san barlagyna serediň.');
    return wrap(null, null);
  }
  if(msRadial(f, a, b)){
    const r = msSym('x'), phi0 = msSubst(fNode, {x: Math.abs(a) < 1e-12 ? r : msAdd(msNum(a), r), y: msNum(b)});
    let phi = phi0;
    try{ phi = niceSimplify(msFold(phi0)); }catch(e){ phi = phi0; }
    const S = limitSteps(phi, 0, '0', msN(0)), v = S.value;
    const val = typeof v === 'number' ? v : (v && v.side) ? v.v : (v && v.none && isFinite(v.right)) ? v.right : null;
    const sw = h => h.replace(/x/g, 'r').replace(/ˣ/g, 'ʳ');
    const r2 = (Math.abs(a) < 1e-12 ? 'x²' : '(x − ' + fmtNice(a) + ')²') + ' + ' + (Math.abs(b) < 1e-12 ? 'y²' : '(y − ' + fmtNice(b) + ')²') + ' = r²';
    steps.push(msNest('<b>Radial simmetriýa</b>: x = ' + (Math.abs(a) < 1e-12 ? '' : fmtNice(a) + ' + ') + 'r·cos θ, y = ' + (Math.abs(b) < 1e-12 ? '' : fmtNice(b) + ' + ') + 'r·sin θ goýsak (' + r2 + '), θ ýitýär — f diňe nokada çenli uzaklyga r bagly: f = φ(r) = ' + sw(msP(phi)) + '. Iki üýtgeýänli limit bir üýtgeýänli lim<sub>r→0⁺</sub> φ(r) limite getirilýär:', S.steps.map(sw)));
    if(val !== null && isFinite(val)){ steps.push('<b>Netije</b>: limit θ-a bagly däl ⇒ limit <b>bar</b>: lim f = <b>' + fmtNice(val) + '</b>.'); return wrap('yes', val); }
    if(v){ steps.push('<b>Netije</b>: lim<sub>r→0⁺</sub> φ(r) = ' + limitValStr(v) + '.'); return wrap(val === null ? null : 'no', null); }
    return wrap(null, null);
  }
  const H = msHomogDeg(f, a, b);
  if(H){
    const xs = Math.abs(a) < 1e-12 ? 'r·cos θ' : fmtNice(a) + ' + r·cos θ', ys = Math.abs(b) < 1e-12 ? 'r·sin θ' : fmtNice(b) + ' + r·sin θ';
    const pS = fmtNice(H.p), rp = H.p === 1 ? 'r' : 'r<sup>' + pS + '</sup>', g = th => f({x: a + Math.cos(th), y: b + Math.sin(th)});
    const gs = Array.from({length: 720}, (_, i) => g(i*Math.PI/360)).filter(isFinite);
    const M = Math.max(...gs.map(Math.abs)), mn = Math.min(...gs), mx = Math.max(...gs);
    let txt = '<b>Polýar koordinatalar</b>: x = ' + xs + ', y = ' + ys + '. f bir jynsly funksiýa (derejesi ' + pS + '): f = ' + (H.p === 0 ? '' : rp + '·') + 'g(θ), bu ýerde g(θ) = f(' + (Math.abs(a) < 1e-12 ? '' : fmtNice(a) + ' + ') + 'cos θ, ' + (Math.abs(b) < 1e-12 ? '' : fmtNice(b) + ' + ') + 'sin θ) — r-e bagly däl.';
    if(H.p > 0){
      const MS = /[.e]/.test(fmtNice(M)) ? fmt(M) : fmtNice(M);
      steps.push(txt + ' |g(θ)| ≤ ' + MS + ' bolany üçin |f| ≤ ' + (MS === '1' ? '' : (/[\/√]/.test(MS) ? '(' + MS + ')' : MS) + '·') + rp + ' → 0 (r → 0), θ-a bagly bolmazdan.');
      steps.push('<b>Netije</b>: limit <b>bar</b>: lim f = <b>0</b>.');
      return wrap('yes', 0);
    }
    if(H.p === 0 && mx - mn > 1e-9*Math.max(1, M)){
      steps.push(txt + ' g(θ) hemişelik däl: ' + fmtNice(mn) + ' ≤ g ≤ ' + fmtNice(mx) + ' — nokada dürli ugurlardan ýakynlaşanda dürli bahalar alynýar.');
      steps.push('<b>Netije</b>: limit <b>ýok</b>.');
      return wrap('no', null);
    }
  }
  return null;
}

/* f(a + λX, b + λY) = λᵖ·f(a + X, b + Y) (san taýdan barlanýar): {p} ýa-da null */
function msHomogDeg(f, a, b){
  const th = [0.37, 1.13, 2.29, 3.71, 5.03], ps = [];
  for(const t of th){
    const v1 = f({x: a + 0.1*Math.cos(t), y: b + 0.1*Math.sin(t)}), v2 = f({x: a + 0.01*Math.cos(t), y: b + 0.01*Math.sin(t)});
    if(isFinite(v1) && isFinite(v2) && Math.abs(v1) > 1e-300 && Math.abs(v2) > 1e-300) ps.push(Math.log(Math.abs(v1/v2))/Math.LN10);
  }
  if(ps.length < 3) return null;
  const p = Math.round(ps[0]*2)/2;
  if(ps.some(q => Math.abs(q - p) > 1e-6)) return null;
  for(const t of th) for(const lam of [0.3, 0.05]){
    const u = f({x: a + Math.cos(t), y: b + Math.sin(t)}), w = f({x: a + lam*Math.cos(t), y: b + lam*Math.sin(t)});
    if(!isFinite(u) || !isFinite(w)) continue;
    if(Math.abs(w - Math.pow(lam, p)*u) > 1e-9*Math.max(1e-12, Math.abs(w))) return null;
  }
  return {p};
}

/* ===== modules/calculators/multivar.js ===== */
/* Köp üýtgeýänli funksiýalar: z = f(x, y) üsti (aýlanýan 3D), derejeli egriler, kesgitleniş ýaýlasy, simmetriýa;
   iki üýtgeýänli limit — mugallym ýaly ädimler (göni goýmak, y = kx / y = kx² ýollar, polýar koordinatalar; solvers/limit2d-steps.js)
   we san barlagy (dürli ýollar boýunça, töwerekler boýunça). */

/* Simmetriýa barlagy (birnäçe nokatda) */
function mvSymmetry(f){
  const P = [[0.37, 1.21], [-1.13, 0.58], [1.74, -0.92], [0.61, 0.29], [-0.45, -1.66], [2.3, 1.7], [-1.9, 2.2]];
  const eq = (u, v) => isFinite(u) && isFinite(v) && Math.abs(u - v) <= 1e-9*Math.max(1, Math.abs(u), Math.abs(v));
  const test = g => { let n = 0; for(const [x, y] of P){ const u = f(x, y), v = g(x, y); if(!isFinite(u) || !isFinite(v)) continue; if(!eq(u, v)) return false; n++; } return n >= 3; };
  const out = [];
  let radial = true, nr = 0;
  for(const r of [0.4, 1.1, 1.9]){
    const v0 = f(r, 0);
    for(let k = 1; k < 8; k++){ const v = f(r*Math.cos(k*0.8), r*Math.sin(k*0.8)); if(!isFinite(v0) || !isFinite(v)) continue; nr++; if(!eq(v0, v)) radial = false; }
  }
  if(radial && nr >= 6) out.push('aýlanma simmetriýasy: f diňe x² + y²-a (merkezden uzaklyga) bagly — derejeli egriler töwerekler');
  if(test((x, y) => f(-x, y))) out.push('y okuna görä simmetrik: f(−x, y) = f(x, y)');
  if(test((x, y) => f(x, -y))) out.push('x okuna görä simmetrik: f(x, −y) = f(x, y)');
  if(test((x, y) => -f(-x, -y))) out.push('merkezi antisimmetrik (täk): f(−x, −y) = −f(x, y)');
  if(test((x, y) => f(y, x))) out.push('y = x çyzygyna görä simmetrik: f(y, x) = f(x, y)');
  return out;
}

function calcSurface(){
  let F;
  try{ F = xyCompile(document.getElementById('mv-f').value); }
  catch(e){ xyError('mv-result', e, 'x^2 + y^2, x^2 - y^2, sin(x)*cos(y), sqrt(9 - x^2 - y^2)'); return; }
  try{
    const box = readBox(['mv-x1', 'mv-x2', 'mv-y1', 'mv-y2']);
    if(!box){ showResult('mv-result', '<strong>Ýalňyşlyk:</strong> aralyklar san bolmaly we başy ahyryndan kiçi bolmaly (mysal: x: −3 … 3, y: −3 … 3).', true); return; }
    const cStr = document.getElementById('mv-c').value.trim(), c = cStr === '' ? NaN : parseBound(cStr);
    if(cStr !== '' && !isFinite(c)){ showResult('mv-result', '<strong>Ýalňyşlyk:</strong> derejeli egriniň bahasy c san bolmaly ýa-da boş goý.', true); return; }
    const N = 90;
    let total = 0, defined = 0, lo = {v: Infinity}, hi = {v: -Infinity};
    for(let j = 0; j <= N; j++) for(let i = 0; i <= N; i++){
      const x = box.xMin + (box.xMax - box.xMin)*i/N, y = box.yMin + (box.yMax - box.yMin)*j/N, v = F.f(x, y);
      total++;
      if(!isFinite(v)) continue;
      defined++;
      if(v < lo.v) lo = {v, x, y};
      if(v > hi.v) hi = {v, x, y};
    }
    if(!defined){ showResult('mv-result', '<strong>Netije:</strong> f bu gönüburçlukda hiç ýerde kesgitlenmedik — başga aralyk saýla.', true); return; }
    const share = defined/total, sym = mvSymmetry(F.f);
    let html = '<strong>z = f(x, y) =</strong> ' + prettyNode(F.node) + '<br>' +
      '<strong>Kesgitleniş ýaýlasy:</strong> ' + (share > 0.9999 ? 'f saýlanan gönüburçlugyň ähli nokadynda kesgitlenen.' :
        'f gönüburçlugyň takmynan ' + Math.round(share*100) + '%-inde kesgitlenen — derejeli egriler kartasynda çal reňkli ýerler kesgitleniş ýaýlasynyň daşy.') + '<br>' +
      '<strong>Bahalary (gözenek boýunça):</strong> ' + fmt(lo.v) + ' ≤ f ≤ ' + fmt(hi.v) + ' <span class="muted" style="font-size:.82rem">(iň kiçi: (' + fmt(lo.x) + '; ' + fmt(lo.y) + ') nokatda, iň uly: (' + fmt(hi.x) + '; ' + fmt(hi.y) + ') nokatda)</span><br>' +
      '<strong>Simmetriýa:</strong> ' + (sym.length ? sym.join('; ') : 'tapylmady') + '<br>';
    const curves = [];
    if(isFinite(c)){
      const segs = marchingSquares(F.f, box.xMin, box.xMax, box.yMin, box.yMax, 120, 120, c);
      html += '<strong>Derejeli egri f(x, y) = ' + fmt(c) + ':</strong> ' + (segs.length ? 'gyzyl çyzyk bilen görkezilýär (3D grafikde — z = ' + fmt(c) + ' beýiklikdäki kesik).' : 'f bu ýaýlada ' + fmt(c) + ' bahany almaýar — egri ýok.');
      segs.forEach(g => curves.push({pts: [[g[0], g[1], c], [g[2], g[3], c]], color: '#c9432f', width: 2.4}));
    } else {
      html += '<span class="muted" style="font-size:.85rem">"c" meýdanyna san ýazsaň, f(x, y) = c derejeli egri aýratyn görkeziler.</span>';
    }
    showResult('mv-result', html, false);
    plotSurface3D('mv-graph3d', {box, surfaces: [{f: F.f}], curves, colorbar: 'mv-cbar3d', fmt: v => fmt(v)});
    plotField('mv-graph2d', F.f, box, {equal: equalOk(box), levels: 12, highlight: isFinite(c) ? [{level: c, color: '#c9432f', width: 2.8}] : [], colorbar: 'mv-cbar2d', fmt: v => fmt(v),
      legend: isFinite(c) ? [{label: 'f(x, y) = ' + fmt(c), color: '#c9432f'}] : []});
    bindReadout('mv-graph2d', 'mv-read', (x, y) => 'x = ' + fmtPrec(x, 4) + ',  y = ' + fmtPrec(y, 4) + ',  f(x, y) = ' + fmtPrec(F.f(x, y), 6), 'Kursory derejeli egriler kartasynyň üstünde süýşür — nokadyň koordinatalary we f(x, y) bahasy şu ýerde görüner.');
  } catch(e){
    xyError('mv-result', e, 'x^2 + y^2, x^2 - y^2, sin(x)*cos(y)');
  }
}

/* Iki üýtgeýänli limit: dürli ýollar boýunça we töwerekler (polýar) boýunça barlag */
function calcLimit2D(){
  let F;
  try{ F = xyCompile(document.getElementById('l2-f').value); }
  catch(e){ xyError('l2-result', e, 'x*y/(x^2 + y^2), x^2*y/(x^2 + y^2), sin(x^2 + y^2)/(x^2 + y^2)'); return; }
  try{
    const a = parseBound(document.getElementById('l2-a').value), b = parseBound(document.getElementById('l2-b').value);
    if(!isFinite(a) || !isFinite(b)){ showResult('l2-result', '<strong>Ýalňyşlyk:</strong> (a; b) nokadyň koordinatalary anyk san bolmaly (mysal: 0 we 0).', true); return; }
    const f = F.f, hs = [0.1, 0.01, 0.001, 0.0001, 0.00001];
    let St = null;
    try{ St = limit2DSteps(F.node, a, b); }catch(e){ St = null; }
    const paths = [
      {name: 'y = b (x okuna parallel)', fx: t => [a + t, b], color: '#2f77c9'},
      {name: 'x = a (y okuna parallel)', fx: t => [a, b + t], color: '#c9432f'},
      {name: 'y − b = x − a', fx: t => [a + t, b + t], color: '#3a9a3a'},
      {name: 'y − b = −2(x − a)', fx: t => [a + t, b - 2*t], color: '#e8a33d'},
      {name: 'y − b = (x − a)² (parabola)', fx: t => [a + t, b + t*t], color: '#6250d6'}
    ];
    const close = (u, v) => Math.abs(u - v) <= 1e-3*Math.max(1, Math.abs(u), Math.abs(v));
    const res = paths.map(p => {
      const R = classify(hs.map(h => f.apply(null, p.fx(h)))), L = classify(hs.map(h => f.apply(null, p.fx(-h))));
      let txt, val = null;
      if(L.t === 'val' && R.t === 'val' && close(L.v, R.v)){ val = (L.v + R.v)/2; txt = fmt(val); }
      else if(L.t === 'inf' && R.t === 'inf' && L.s === R.s){ txt = L.s > 0 ? '+∞' : '−∞'; val = L.s*Infinity; }
      else txt = 'ýok (t → 0⁻: ' + fmtSide(L) + ', t → 0⁺: ' + fmtSide(R) + ')';
      return {p, val, txt};
    });
    const vals = res.map(r => r.val);
    const allFin = vals.every(v => v !== null && isFinite(v)), same = allFin && vals.every(v => close(v, vals[0]));
    let verdict, Lval = null;
    let polar = '';
    if(same){
      Lval = vals[0];
      const M = [0.1, 0.01, 0.001, 0.0001].map(r => {
        let m = 0;
        for(let k = 0; k < 72; k++){ const v = f(a + r*Math.cos(k*Math.PI/36), b + r*Math.sin(k*Math.PI/36)); m = isFinite(v) ? Math.max(m, Math.abs(v - Lval)) : Infinity; }
        return m;
      });
      polar = '<strong>Polýar barlag:</strong> (a; b) merkezli r radiusly töwerekde iň uly tapawut max|f − L|:' +
        '<table class="conv"><tr><th>r</th><th>max |f − L|</th></tr>' + M.map((m, i) => '<tr><td>' + [0.1, 0.01, 0.001, 0.0001][i] + '</td><td>' + fmtPrec(m, 4) + '</td></tr>').join('') + '</table>';
      const ok = isFinite(M[3]) && M[3] <= 1e-3*Math.max(1, Math.abs(Lval)) && M[3] <= M[1];
      verdict = ok ? 'Limit <b>bar</b>: lim f(x, y) = <b>' + fmt(Lval) + '</b> — ähli barlanan ýollar boýunça we töwerekleriň boýunça f şol sana ýakynlaşýar.'
        : 'Barlanan göni ýollar boýunça bahalar deň (' + fmt(Lval) + '), ýöne töwerekde iň uly tapawut kiçelmeýär — limit <b>ýok bolmagy mümkin</b> (başga egri ýol boýunça dürli baha alynýar).';
      if(!ok) Lval = null;
    } else {
      verdict = 'Limit <b>ýok</b> — dürli ýollar boýunça dürli bahalar alynýar (limit bar bolsa, ähli ýollar boýunça deň bolmalydy).';
    }
    if(St && St.verdict === 'yes' && allFin && !vals.every(v => close(v, St.L))) St = null;   // ädimler san barlagy bilen gabat gelmese, olara ynanmaýarys
    if(St && St.verdict === 'yes'){ Lval = St.L; verdict = 'limit <b>bar</b>: lim f(x, y) = <b>' + fmtNice(St.L) + '</b>.'; }
    else if(St && St.verdict === 'no'){ Lval = null; verdict = 'limit <b>ýok</b> — nokada dürli ýollar bilen ýakynlaşanda dürli bahalar alynýar.'; }
    const fab = f(a, b);
    let cont = 'f(' + fmt(a) + ', ' + fmt(b) + ') ' + (isFinite(fab) ? '= ' + fmt(fab) : 'kesgitlenmedik');
    if(Lval !== null){
      if(isFinite(fab) && close(fab, Lval)) cont += ' = limit ⇒ f bu nokatda <b>üznüksiz</b>.';
      else if(isFinite(fab)) cont += ' ≠ limit (' + fmt(Lval) + ') ⇒ f bu nokatda <b>üznüksiz däl</b>.';
      else cont += ' ⇒ f bu nokatda <b>üznüksiz däl</b>. Bu aýrylýan üzülme: f(' + fmt(a) + ', ' + fmt(b) + ') = ' + fmt(Lval) + ' diýip goşmaça kesgitlesek, funksiýa üznüksiz bolar.';
    } else cont += ' — limit ýok, şonuň üçin f bu nokatda <b>üznüksiz däl</b>.';
    const table = '<strong>Dürli ýollar boýunça</strong> (t → 0):<table class="conv"><tr><th>Ýol</th><th>Limit</th></tr>' + res.map(r => '<tr><td><span class="dot" style="background:' + themeColor(r.p.color) + '"></span>' + r.p.name + '</td><td>' + r.txt + '</td></tr>').join('') + '</table>' + polar;
    const html = '<strong>f(x, y) =</strong> ' + prettyNode(F.node) + ', &nbsp;<strong>(x, y) → (' + fmt(a) + '; ' + fmt(b) + ')</strong>' +
      (St ? St.html + '<details class="numcheck"><summary>San barlagy: dürli ýollar we töwerekler boýunça bahalar (grafikdäki reňkli çyzyklar)</summary>' + table + '</details>' : '<br>' + table) +
      '<strong>Netije:</strong> ' + verdict.charAt(0).toUpperCase() + verdict.slice(1) + '<br><strong>Üznüksizlik:</strong> ' + cont;
    showResult('l2-result', html, false);
    const w = 1, box = {xMin: a - w, xMax: a + w, yMin: b - w, yMax: b + w}, polys = paths.map(p => {
      const pts = [];
      for(let i = -60; i <= 60; i++){ const t = 1.5*w*i/60; pts.push(p.fx(t)); }
      return {pts, color: p.color, width: 2.2};
    });
    plotField('l2-graph', f, box, {equal: true, heat: false, levels: 16, polylines: polys, points: [{x: a, y: b, color: '#222', label: '(a; b)'}]});
    bindReadout('l2-graph', 'l2-read', (x, y) => 'x = ' + fmtPrec(x, 4) + ',  y = ' + fmtPrec(y, 4) + ',  f(x, y) = ' + fmtPrec(f(x, y), 6), 'Reňkli çyzyklar — tablisadaky ýollar; inçe çal çyzyklar — f-iň derejeli egrileri. Kursory süýşürip f(x, y) bahasyny gör.');
  } catch(e){
    xyError('l2-result', e, 'x*y/(x^2 + y^2), x^2*y/(x^2 + y^2)');
  }
}

/* ===== modules/calculators/newton.js ===== */
/* Newton usuly: x[n+1] = x[n] − f(x[n]) / f′(x[n]). */

/* Newton usuly: x[n+1] = x[n] - f(x[n])/f'(x[n]) */
function newtonSteps(f, fp, x0, nMax){
  const xs = [x0];
  let x = x0, stop = null;
  for(let k = 0; k < nMax; k++){
    const y = f(x), d = fp(x);
    if(!isFinite(y) || !isFinite(d)){ stop = 'undef'; break; }
    if(Math.abs(y) < 1e-13*Math.max(1, Math.abs(x))){ stop = 'conv'; break; }
    if(Math.abs(d) < 1e-12*Math.max(1, Math.abs(y))){ stop = 'flat'; break; }
    x = x - y/d;
    xs.push(x);
    if(!isFinite(x) || Math.abs(x) > 1e9){ stop = 'diverge'; break; }
    if(xs.length >= 3 && Math.abs(xs[xs.length-1] - xs[xs.length-3]) < 1e-9 && Math.abs(xs[xs.length-1] - xs[xs.length-2]) > 1e-6){ stop = 'cycle'; break; }
  }
  return {xs, stop};
}

function calcNewton(){
  try{
    const node = math.parse(prep(document.getElementById('new-f').value));
    const fFn = node.compile(), f = x => safeEval(xx => fFn.evaluate({x:xx}), x), fp = derivativeFn(node);
    const x0 = parseBound(document.getElementById('new-x0').value), nMax = Number(document.getElementById('new-n').value);
    if(!isFinite(x0)){ showResult('new-result', '<strong>Ýalňyşlyk:</strong> başlangyç x₀ anyk san bolmaly (mysal: 1).', true); return; }
    if(!Number.isInteger(nMax) || nMax < 1 || nMax > 30){ showResult('new-result', '<strong>Ýalňyşlyk:</strong> iterasiýalaryň sany 1-den 30-a çenli bitin san bolmaly.', true); return; }
    const R = newtonSteps(f, fp, x0, nMax), xs = R.xs;
    const ys = xs.map(f), ds = xs.map(fp), last = xs[xs.length-1], fl = ys[ys.length-1];
    let html = '<strong>f(x) = 0 deňlemesi üçin Newton usuly:</strong> x<sub>n+1</sub> = x<sub>n</sub> − f(x<sub>n</sub>)/f′(x<sub>n</sub>)<br>' +
      '<table class="conv"><tr><th>n</th><th>x<sub>n</sub></th><th>f(x<sub>n</sub>)</th><th>f′(x<sub>n</sub>)</th></tr>' +
      xs.map((x, k) => '<tr><td>' + k + '</td><td>' + fmtPrec(x, 12) + '</td><td>' + fmtPrec(ys[k], 4) + '</td><td>' + fmtPrec(ds[k], 6) + '</td></tr>').join('') + '</table>';
    const good = isFinite(fl) && Math.abs(fl) < 1e-9*Math.max(1, Math.abs(last));
    if(R.stop === 'flat'){
      html += '<strong>Duruldy:</strong> x = ' + fmtPrec(last, 8) + ' nokatda f′(x) = 0, galtaşýan çyzyk gorizontal — indiki ädim hasaplanyp bilinmeýär. Başga x₀ saýla.';
    } else if(R.stop === 'undef'){
      html += '<strong>Duruldy:</strong> f ýa-da f′ x = ' + fmtPrec(last, 8) + ' nokatda kesgitlenmedik. Başga x₀ saýla.';
    } else if(R.stop === 'diverge'){
      html += '<strong>Ýaýrady:</strong> ýakynlaşmalar çäksizlige gidýär — Newton usuly bu x₀ üçin köke ýetmeýär. Köke has golaý x₀ saýla.';
    } else if(R.stop === 'cycle'){
      html += '<strong>Tsikl:</strong> ýakynlaşmalar iki nokadyň arasynda gaýtalanýar (' + fmtPrec(xs[xs.length-2], 6) + ' ↔ ' + fmtPrec(last, 6) + ') we köke ýakynlaşmaýar. Başga x₀ saýla.';
    } else if(good){
      html += '<strong>Netije:</strong> x ≈ ' + fmtPrec(last, 12) + ', f(x) ≈ ' + fmtPrec(fl, 3) + ' ' + (R.stop === 'conv' ? '(ýeterlik takyklyga ' + (xs.length-1) + ' ädimde ýetildi)' : '');
    } else {
      html += '<strong>Netije:</strong> ' + (xs.length-1) + ' ädimde x ≈ ' + fmtPrec(last, 8) + ', f(x) ≈ ' + fmtPrec(fl, 3) + ' — ýeterlik takyklyga ýetilmedi, iterasiýalaryň sanyny köpelt.';
    }
    showResult('new-result', html, false);
    // grafik: galtaşýan çyzyklar we nokatlar
    let use = xs.filter(isFinite);
    if(use.length > 7 && (R.stop === 'diverge')) use = use.slice(0, 6);
    let lo = Math.min.apply(null, use), hi = Math.max.apply(null, use);
    if(!(hi - lo > 1e-9)){ lo -= 1; hi += 1; }
    const pad = Math.max(0.35*(hi - lo), 0.5);
    const segs = [], pts = [], sub = ['x₀','x₁','x₂','x₃','x₄'];
    for(let k = 0; k < use.length; k++){
      const xk = use[k], yk = ys[k];
      if(!isFinite(yk)) continue;
      segs.push({x1:xk, y1:0, x2:xk, y2:yk, color:'#b8b8b8', dash:[3,3], width:1});
      if(k + 1 < use.length) segs.push({x1:xk, y1:yk, x2:use[k+1], y2:0, color:'#3a9a3a', width:1.6});
      pts.push({x:xk, y:0, color:'#c9432f', label:k < 3 ? sub[k] : ''});
    }
    plotFunctions('new-graph', [{fn:f, color:'#2f77c9', label:'f(x)'}], lo - pad, hi + pad, {segments:segs, points:pts});
  } catch(e){
    showResult('new-result', '<strong>Ýalňyşlyk:</strong> Aňlatmany barlaň (mysal: x^2 - 2, cos(x) - x, x^3 - 2*x - 5). Diňe x üýtgeýjisi goldanýar.', true);
  }
}

/* ===== modules/solvers/ode-steps.js ===== */
/* Differensial deňlemäni analitik çözmek (mugallym ýaly, ädimme-ädim) — deňlemäniň görnüşini tanamak we usuly saýlamak:
   y′ = g(x) (göni integrirlemek), y′ = a·y + b (deňagramlylyk we eksponenta), y′ = g(x)·y (aýrylýan üýtgeýänli),
   y′ + p(x)·y = q(x) (integrirleýji köpeldiji), logistik y′ = r·y·(1 − y/K), y′ = g(x)·y² we y′ = g(x)/y.
   Integrallar integral-steps.js bilen alynýar; başlangyç şert y(x₀) = y₀ boýunça C tapylýar; çözgüt deňlemä goýlup barlanýar. */

const odN = v => new math.ConstantNode(v);

const odOp = (op, fn, a) => new math.OperatorNode(op, fn, a);

const odAdd = (a, b) => odOp('+', 'add', [a, b]);

const odSub = (a, b) => odOp('-', 'subtract', [a, b]);

const odMul = (a, b) => odOp('*', 'multiply', [a, b]);

const odDiv = (a, b) => odOp('/', 'divide', [a, b]);

const odNeg = a => odOp('-', 'unaryMinus', [a]);

const odExp = a => new math.FunctionNode('exp', [a]);

function odS(n){ try{ return niceSimplify(n); }catch(e){ return n; } }

const odP = n => derivPretty(n);

/* san düwüni: bitin ýa-da ýönekeý drob; galan ýagdaýda 6 möhüm sanly */
function odNum(v){
  if(Math.abs(v) < 1e-13) return odN(0);
  const neg = v < 0, a = Math.abs(v);
  let node;
  if(Math.abs(a - Math.round(a)) < 1e-10) node = odN(Math.round(a));
  else { const r = ratApprox(a, 100, 1e-10); node = r ? odDiv(odN(r[0]), odN(r[1])) : odN(Number(a.toPrecision(8))); }
  return neg ? odNeg(node) : node;
}

function odHas(n, name){ let f = false; n.traverse((c, path, parent) => { if(c.type === 'SymbolNode' && c.name === name && !(parent && parent.type === 'FunctionNode' && path === 'fn')) f = true; }); return f; }

function odSubY(n, v){ return n.transform(c => (c.type === 'SymbolNode' && c.name === 'y') ? (typeof v === 'number' ? odN(v) : v) : c); }

function odFnX(n){ const c = n.compile(); return x => safeEval(xx => c.evaluate({x: xx}), x); }

function odIsZero(n){ const f = odFnX(n); return [-1.3, -0.4, 0.7, 1.9, 2.6].every(x => { const v = f(x); return isFinite(v) && Math.abs(v) < 1e-10; }); }

function odIsConst(n){ return !odHas(n, 'x'); }

function odVal(n){ try{ const v = n.compile().evaluate({}); return typeof v === 'number' ? v : NaN; }catch(e){ return NaN; } }

/* e^(c·ln|u|) → |u|^c, e^(ln u) → u; x₀ nokatda u-nyň alamaty belli bolsa |u| → ±u (bellik bilen) */
function odExpLog(n){
  return n.transform(function el(m){
    if(m.type === 'FunctionNode' && m.fn.name === 'exp' && m.args.length === 1){
      let a = m.args[0], c = 1;
      while(a.type === 'ParenthesisNode') a = a.content;
      if(a.type === 'OperatorNode' && a.fn === 'unaryMinus'){ c = -1; a = a.args[0]; }
      if(a.type === 'OperatorNode' && a.fn === 'multiply' && a.args[0].type === 'ConstantNode'){ c *= a.args[0].value; a = a.args[1]; }
      if(a.type === 'FunctionNode' && a.fn.name === 'log' && a.args.length === 1){
        const u = a.args[0];
        return c === 1 ? u : new math.OperatorNode('^', 'pow', [u, odNum(c)]);
      }
    }
    return m;
  });
}

function odDropAbs(n, x0, notes){
  return n.transform(function da(m){
    if(m.type === 'FunctionNode' && m.fn.name === 'abs' && m.args.length === 1){
      const u = m.args[0], v = odFnX(u)(x0);
      if(isFinite(v) && Math.abs(v) > 1e-12){
        const t = odP(u);
        if(notes.indexOf(t) === -1) notes.push(t);
        return v > 0 ? u : odNeg(u);
      }
    }
    return m;
  });
}

/* köpeltmek hasylyndaky görkezijili köpeldijileri birleşdirmek: e^(−x)·(x + 1)·eˣ → x + 1 */
function odMergeExp(n){
  let sign = 1;
  const fs = [], un = m => { while(m.type === 'ParenthesisNode') m = m.content; return m; };
  const walk = m => {
    m = un(m);
    if(m.type === 'OperatorNode' && m.fn === 'multiply'){ walk(m.args[0]); walk(m.args[1]); }
    else if(m.type === 'OperatorNode' && m.fn === 'unaryMinus'){ sign = -sign; walk(m.args[0]); }
    else fs.push(m);
  };
  walk(n);
  const ex = [], other = [];
  fs.forEach(f => {
    if(f.type === 'FunctionNode' && f.fn.name === 'exp') ex.push(f.args[0]);
    else if(f.type === 'OperatorNode' && f.fn === 'pow' && un(f.args[0]).type === 'SymbolNode' && un(f.args[0]).name === 'e') ex.push(f.args[1]);
    else other.push(f);
  });
  if(ex.length < 2) return n;
  const sumE = odS(ex.reduce((a, b) => odAdd(a, b)));
  let out = other.length ? other.reduce((a, b) => odMul(a, b)) : odN(1);
  if(!(odIsConst(sumE) && Math.abs(odVal(sumE)) < 1e-14)) out = odMul(out, odExp(sumE));
  return sign < 0 ? odNeg(out) : out;
}

/* ∫ g dx: {F, steps} ýa-da null */
function odInt(g){ const r = integrateSteps(g); return r.F ? r : null; }

const odIntHtml = (label, g, r) => label + ': ∫ ' + odP(g) + ' dx = ' + integralPretty(r.F) + (r.steps.length > 2 ? '<ol class="steps sub">' + r.steps.slice(0, -1).map(t => '<li>' + t + '</li>').join('') + '</ol>' : '.');

/* çözgüdi deňlemä goýup barlamak: y′(x) ≈ f(x, y(x)) */
function odCheck(sol, f, x0){
  const s = odFnX(sol);
  let ok = 0;
  for(const t of [0.13, 0.41, 0.77, 1.12, -0.29]){
    const x = x0 + t, h = 1e-5*Math.max(1, Math.abs(x)), y = s(x), d = (s(x + h) - s(x - h))/(2*h), r = f(x, y);
    if(![y, d, r].every(isFinite)) continue;
    if(Math.abs(d - r) > 1e-4*Math.max(1, Math.abs(r))) return false;
    ok++;
  }
  return ok >= 3;
}

/* node — f(x, y), f — san funksiýasy f(x, y). Gaýtarýar {steps, sol (x-iň funksiýasy), kind} ýa-da null */
function odeAnalytic(node, f, x0, y0){
  try{ return odeAnalyticRaw(node, f, x0, y0); }catch(e){ return null; }
}

function odeAnalyticRaw(node, f, x0, y0){
  const steps = [], hasY = odHas(node, 'y'), X0 = fmtNice(x0), Y0 = fmtNice(y0);
  const fin = (sol, kind) => {
    sol = odS(sol);
    if(!odCheck(sol, f, x0)) return null;
    steps.push('<b>Barlag</b>: y = ' + odP(sol) + ' funksiýany deňlemä goýanyňda y′ = f(x, y) ýerine ýetýär we y(' + X0 + ') = ' + fmtNice(odFnX(sol)(x0)) + ' ✓');
    return {steps, sol, kind};
  };

  /* 1) y′ = g(x) */
  if(!hasY){
    const r = odInt(node);
    if(!r) return null;
    steps.push('<b>Görnüşi</b>: sag tarap y-e bagly däl — y′ = g(x). Şonuň üçin göni integrirleýäris: y = ∫ g(x) dx + C.');
    steps.push(odIntHtml('∫ g(x) dx', node, r));
    const G0 = odFnX(r.F)(x0), C = y0 - G0;
    steps.push('Umumy çözgüt: y = ' + integralPretty(r.F) + ' + C. Başlangyç şert y(' + X0 + ') = ' + Y0 + ' ⇒ ' + fmtNice(G0) + ' + C = ' + Y0 + ' ⇒ C = ' + fmtNice(C) + '.');
    return fin(odAdd(r.F, odNum(C)), 'g(x)');
  }

  /* çyzyklymy: f(x, y) = A(x)·y + B(x) */
  const A = odS(odSub(odSubY(node, 1), odSubY(node, 0))), B = odS(odSubY(node, 0));
  const fa = odFnX(A), fb = odFnX(B);
  let linear = true, nOk = 0;
  for(const [x, y] of [[0.3, 0.7], [1.1, -0.4], [-0.8, 1.3], [1.7, 2.2], [-1.4, -0.9], [2.3, 0.4]]){
    const v = f(x, y), w = fa(x)*y + fb(x);
    if(!isFinite(v) || !isFinite(w)) continue;
    nOk++;
    if(Math.abs(v - w) > 1e-8*Math.max(1, Math.abs(v))) linear = false;
  }
  if(nOk < 3) linear = false;

  if(linear && odIsConst(A) && odIsConst(B)){
    const a = odVal(A), b = odVal(B);
    if(!(Math.abs(a) > 1e-14)) return null;
    const ys = -b/a, C = (y0 - ys)*Math.exp(-a*x0);
    steps.push('<b>Görnüşi</b>: y′ = a·y + b (a = ' + fmtNice(a) + ', b = ' + fmtNice(b) + ') — hemişelik koeffisiýentli çyzykly deňleme.');
    if(Math.abs(b) > 1e-14){
      steps.push('Deňagramlylyk çözgüdi: a·y + b = 0 ⇒ y* = −b/a = ' + fmtNice(ys) + '. Täze üýtgeýji z = y − y* alýarys: z′ = y′ = a·(y − y*) = a·z.');
      steps.push('z′ = a·z deňlemäniň çözgüdi z = C·e<sup>ax</sup> (önümi özüne proporsional funksiýa — eksponenta). Diýmek, umumy çözgüt: y = ' + fmtNice(ys) + ' + C·e<sup>' + odP(odMul(odNum(a), new math.SymbolNode('x'))) + '</sup>.');
    } else steps.push('y′ = a·y: önümi özüne proporsional funksiýa — eksponenta. Umumy çözgüt: y = C·e<sup>' + odP(odMul(odNum(a), new math.SymbolNode('x'))) + '</sup>.');
    steps.push('Başlangyç şert y(' + X0 + ') = ' + Y0 + ' ⇒ C = ' + (Math.abs(b) > 1e-14 ? '(y₀ − y*)' : 'y₀') + '·e<sup>−a·x₀</sup> = ' + fmtNice(C) + '.' + (a < 0 && Math.abs(b) > 1e-14 ? ' a &lt; 0 bolany üçin x → ∞ bolanda y → y* = ' + fmtNice(ys) + ' (durnukly deňagramlylyk).' : a > 0 && Math.abs(b) > 1e-14 ? ' a &gt; 0: çözgüt y*-dan daşlaşýar (durnuksyz deňagramlylyk).' : ''));
    const ex = odExp(odMul(odNum(a), new math.SymbolNode('x')));
    return fin(Math.abs(ys) > 1e-14 ? odAdd(odNum(ys), odMul(odNum(C), ex)) : odMul(odNum(C), ex), 'ay+b');
  }

  if(linear && odIsZero(B)){
    const r = odInt(A);
    if(!r) return null;
    steps.push('<b>Görnüşi</b>: y′ = g(x)·y, bu ýerde g(x) = ' + odP(A) + ' — <b>aýrylýan üýtgeýänli</b> deňleme. Üýtgeýänleri aýyrýarys: dy/y = g(x) dx.');
    steps.push('Iki tarapy integrirleýäris: ∫ dy/y = ln|y|; ' + odIntHtml('∫ g(x) dx', A, r).replace(/^∫ g\(x\) dx: /, '∫ g(x) dx: '));
    const G = r.F, G0 = odFnX(G)(x0), C = y0*Math.exp(-G0), notes = [];
    let eG = odExp(G);
    const eG2 = odDropAbs(odS(odExpLog(eG)), x0, notes);
    const changed = odP(eG2) !== odP(eG);
    if(!odHas(eG2, 'x') || odP(eG2).length < odP(eG).length + 4) eG = eG2;
    steps.push('ln|y| = ' + integralPretty(G) + ' + C₁ ⇒ y = C·e<sup>' + integralPretty(G) + '</sup>' + (eG === eG2 && changed ? ' = C·' + (/^[\w√]+$/.test(odP(eG)) ? odP(eG) : '(' + odP(eG) + ')') : '') + (notes.length ? ' (x₀ nokadyň töwereginde ' + notes.map(t => t + (odFnX(math.parse(t.replace(/−/g, '-')))(x0) > 0 ? ' &gt; 0' : ' &lt; 0')).join(', ') + ', şonuň üçin modul taşlanýar)' : '') + '. Başlangyç şert: y(' + X0 + ') = ' + Y0 + ' ⇒ C = ' + fmtNice(C) + '.');
    return fin(odMul(odNum(C), eG), 'g(x)y');
  }

  if(linear){
    const p = odS(odNeg(A)), q = B;
    const rP = odInt(p);
    if(!rP) return null;
    const notes = [], mu = odDropAbs(odS(odExpLog(odExp(rP.F))), x0, notes), muq = odS(odMul(mu, q)), rI = odInt(muq);
    if(!rI) return null;
    steps.push('<b>Görnüşi</b>: y′ + p(x)·y = q(x) — <b>çyzykly</b> deňleme, bu ýerde p(x) = ' + odP(p) + ', q(x) = ' + odP(q) + '.');
    steps.push('Integrirleýji köpeldiji: μ(x) = e<sup>∫p dx</sup>; ∫ p dx = ' + integralPretty(rP.F) + ' ⇒ μ(x) = ' + odP(mu) + (notes.length ? ' (x₀ nokadyň töwereginde modul alamaty bilen taşlandy)' : '') + '. Deňlemäni μ-a köpeldenimizde çep tarap (μ·y)′ bolýar: (μ·y)′ = μ·q.');
    steps.push(odIntHtml('Integrirleýäris: ∫ μ·q dx', muq, rI));
    const I0 = odFnX(rI.F)(x0), m0 = odFnX(mu)(x0), C = m0*y0 - I0;
    steps.push('μ·y = ∫ μ·q dx + C ⇒ y = (' + integralPretty(rI.F) + ' + C)/' + (/^[\w√]+$/.test(odP(mu)) ? odP(mu) : '(' + odP(mu) + ')') + '. Başlangyç şert y(' + X0 + ') = ' + Y0 + ' ⇒ C = μ(x₀)·y₀ − I(x₀) = ' + fmtNice(m0*y0) + ' − ' + (I0 < 0 ? '(' + fmtNice(I0) + ')' : fmtNice(I0)) + ' = ' + fmtNice(C) + '.');
    const inv = odDropAbs(odS(odExpLog(odExp(odS(odNeg(rP.F))))), x0, []), solA = odAdd(odS(odMergeExp(odMul(rI.F, inv))), odS(odMul(odNum(C), inv))), solB = odDiv(odAdd(rI.F, odNum(C)), mu);
    return fin(odP(odS(solA)).length <= odP(odS(solB)).length ? solA : solB, 'linear');
  }

  /* logistik: f = α·y + β·y², x-a bagly däl */
  if(!odHas(node, 'x')){
    const g = y => f(0, y), a0 = g(0), a1 = (g(1) - g(-1))/2, a2 = (g(1) + g(-1))/2 - a0;
    const quad = [0.4, 1.7, -2.3].every(y => Math.abs(g(y) - (a0 + a1*y + a2*y*y)) < 1e-8*Math.max(1, Math.abs(g(y))));
    if(quad && Math.abs(a0) < 1e-12 && Math.abs(a2) > 1e-12 && Math.abs(a1) > 1e-12 && Math.abs(y0) > 1e-12){
      const r = a1, K = -a1/a2, Aa = (K - y0)/y0*Math.exp(r*x0);
      steps.push('<b>Görnüşi</b>: y′ = r·y·(1 − y/K) — <b>logistik</b> deňleme, r = ' + fmtNice(r) + ', K = ' + fmtNice(K) + ' (sygym).');
      steps.push('Üýtgeýänleri aýyrýarys: dy/(y·(1 − y/K)) = r dx. Ýönekeý droblar: 1/(y·(1 − y/K)) = 1/y + 1/(K − y) ⇒ ln|y/(K − y)| = r·x + C₁.');
      steps.push('y-i tapýarys: y = K/(1 + A·e<sup>−r·x</sup>). Başlangyç şert y(' + X0 + ') = ' + Y0 + ' ⇒ A = (K − y₀)/y₀·e<sup>r·x₀</sup> = ' + fmtNice(Aa) + '. ' + (r > 0 ? 'x → ∞ bolanda y → K = ' + fmtNice(K) + '.' : ''));
      return fin(odDiv(odNum(K), odAdd(odN(1), odMul(odNum(Aa), odExp(odMul(odNum(-r), new math.SymbolNode('x')))))), 'logistic');
    }
  }

  /* y′ = g(x)·y² ýa-da y′ = g(x)/y */
  const S = [[0.3, 0.7], [1.1, -0.4], [-0.8, 1.3], [1.7, 2.2]];
  const sepPow = n => S.every(([x, y]) => { const u = f(x, y)/Math.pow(y, n), w = f(x, 1); return isFinite(u) && isFinite(w) && Math.abs(u - w) < 1e-8*Math.max(1, Math.abs(w)); });
  for(const n of [2, -1]){
    if(!sepPow(n) || Math.abs(y0) < 1e-12) continue;
    const g = odS(odSubY(node, 1)), r = odInt(g);
    if(!r) continue;
    const G = r.F, G0 = odFnX(G)(x0);
    if(n === 2){
      const C = -1/y0 - G0;
      steps.push('<b>Görnüşi</b>: y′ = g(x)·y², g(x) = ' + odP(g) + ' — aýrylýan üýtgeýänli: dy/y² = g(x) dx ⇒ −1/y = ∫ g dx + C.');
      steps.push(odIntHtml('∫ g(x) dx', g, r));
      steps.push('y = −1/(' + integralPretty(G) + ' + C). Başlangyç şert y(' + X0 + ') = ' + Y0 + ' ⇒ C = −1/y₀ − ' + fmtNice(G0) + ' = ' + fmtNice(C) + '.');
      return fin(odNeg(odDiv(odN(1), odAdd(G, odNum(C)))), 'gy2');
    }
    const C = y0*y0/2 - G0, sg = y0 > 0 ? 1 : -1;
    steps.push('<b>Görnüşi</b>: y′ = g(x)/y, g(x) = ' + odP(g) + ' — aýrylýan üýtgeýänli: y dy = g(x) dx ⇒ y²/2 = ∫ g dx + C.');
    steps.push(odIntHtml('∫ g(x) dx', g, r));
    steps.push('y = ' + (sg > 0 ? '' : '−') + '√(2·(' + integralPretty(G) + ' + C)) (alamat y₀ boýunça). Başlangyç şert ⇒ C = y₀²/2 − ' + fmtNice(G0) + ' = ' + fmtNice(C) + '.');
    const root = new math.FunctionNode('sqrt', [odS(odMul(odN(2), odAdd(G, odNum(C))))]);
    return fin(sg > 0 ? root : odNeg(root), 'g/y');
  }
  return null;
}

/* ===== modules/calculators/ode.js ===== */
/* Differensial deňlemeler y′ = f(x, y): ugur meýdany (basylan nokatdan çözgüt egrisi), deňagramlylyk çözgütleri we olaryň durnuklylygy,
   deňlemäniň görnüşi (awtonom, aýrylýan, çyzykly); san usullary — Eýler, gowulandyrylan Eýler (Hoýn), Runge–Kutta (RK4), tertibi. */

const ODE_COLORS = ['#2f77c9', '#c9432f', '#3a9a3a', '#6250d6', '#e8a33d', '#154a92', '#8a6d00', '#a8261c'];

/* RK4 bilen çözgüt egrisi (dir = +1 sag, −1 çep) */
function odeTrace(f, x0, y0, box, dir){
  const h = dir*(box.xMax - box.xMin)/500, ys = box.yMax - box.yMin, pts = [[x0, y0]];
  let x = x0, y = y0;
  for(let k = 0; k < 1000; k++){
    const k1 = f(x, y), k2 = f(x + h/2, y + h/2*k1), k3 = f(x + h/2, y + h/2*k2), k4 = f(x + h, y + h*k3);
    const yn = y + h/6*(k1 + 2*k2 + 2*k3 + k4);
    if(!isFinite(yn)) break;
    x += h; y = yn;
    pts.push([x, y]);
    if(x < box.xMin - 1e-9 || x > box.xMax + 1e-9 || y < box.yMin - 2*ys || y > box.yMax + 2*ys) break;
  }
  return pts;
}

/* Deňlemäniň görnüşini san taýdan kesgitlemek */
function odeKind(node, f){
  let hasX = false, hasY = false;
  node.traverse((c, path, parent) => { if(c.type === 'SymbolNode' && !(parent && parent.type === 'FunctionNode' && path === 'fn')){ if(c.name === 'x') hasX = true; if(c.name === 'y') hasY = true; } });
  const S = [[0.3, 0.7], [1.1, -0.4], [-0.8, 1.3], [1.7, 0.2], [-1.4, -0.9], [0.6, 2.1]];
  const eq = (u, v) => Math.abs(u - v) <= 1e-8*Math.max(1, Math.abs(u), Math.abs(v));
  let sep = true, lin = true, n = 0;
  for(let i = 0; i < S.length; i++){
    const [x1, y1] = S[i], [x2, y2] = S[(i + 2) % S.length];
    const a = f(x1, y1)*f(x2, y2), b = f(x1, y2)*f(x2, y1);
    if(isFinite(a) && isFinite(b)){ n++; if(!eq(a, b)) sep = false; }
    const d = f(x1, y1 + 1) - 2*f(x1, y1) + f(x1, y1 - 1);
    if(isFinite(d) && Math.abs(d) > 1e-8*Math.max(1, Math.abs(f(x1, y1)))) lin = false;
  }
  const out = [];
  if(!hasY) out.push('y-e bagly däl: y′ = g(x) ⇒ y = ∫ g(x) dx + C — çözgütler biri-biriniň dikligine süýşürilmesi');
  else if(!hasX) out.push('<b>awtonom</b> (x-a göni bagly däl): ugur meýdany gorizontal ugur boýunça gaýtalanýar');
  if(hasY && n >= 4 && sep) out.push('<b>aýrylýan üýtgeýänli</b>: f(x, y) = g(x)·h(y) ⇒ ∫ dy/h(y) = ∫ g(x) dx');
  if(hasY && lin) out.push('<b>çyzykly</b>: y′ + p(x)·y = q(x) görnüşinde — integrirleýji köpeldiji μ = e<sup>∫p dx</sup>');
  return {hasX, hasY, txt: out};
}

function odeRender(canvas){
  const S = canvas._ode;
  if(!S) return;
  const draw = function(){
    const box = S.box, P = makePlot(canvas.id, box.xMin, box.xMax, box.yMin, box.yMax, draw), ctx = P.ctx;
    P.axes(); P.clip();
    const nx = Math.max(12, Math.round(P.pw/28)), ny = Math.max(8, Math.round(P.ph/28)), cw = P.pw/nx, ch = P.ph/ny, len = 0.36*Math.min(cw, ch);
    const sx = P.pw/(box.xMax - box.xMin), sy = P.ph/(box.yMax - box.yMin);
    ctx.save(); ctx.strokeStyle = '#8796ab'; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.beginPath();
    for(let j = 0; j < ny; j++) for(let i = 0; i < nx; i++){
      const px = P.L + (i + 0.5)*cw, py = P.T + (j + 0.5)*ch, x = box.xMin + (px - P.L)/sx, y = box.yMax - (py - P.T)/sy, m = S.f(x, y);
      if(!isFinite(m)) continue;
      let ux = sx, uy = -m*sy; const ul = Math.hypot(ux, uy); ux /= ul; uy /= ul;
      ctx.moveTo(px - len*ux, py - len*uy); ctx.lineTo(px + len*ux, py + len*uy);
    }
    ctx.stroke(); ctx.restore();
    S.eq.forEach(e => P.hline(e.y, e.stable === 1 ? '#2f9a4a' : e.stable === -1 ? '#c9432f' : '#8a6d00', [6, 4]));
    S.curves.forEach((c, k) => {
      ctx.save(); ctx.strokeStyle = themeColor(ODE_COLORS[k % ODE_COLORS.length]); ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.beginPath();
      [c.left, c.right].forEach(pts => pts.forEach((p, i) => i ? ctx.lineTo(P.X(p[0]), P.Y(p[1])) : ctx.moveTo(P.X(p[0]), P.Y(p[1]))));
      ctx.stroke(); ctx.restore();
      P.dot(c.x0, c.y0, ODE_COLORS[k % ODE_COLORS.length]);
    });
    P.unclip();
    const leg = [];
    if(S.eq.some(e => e.stable === 1)) leg.push({label: 'durnukly deňagramlylyk', color: '#2f9a4a', dash: [6, 4]});
    if(S.eq.some(e => e.stable === -1)) leg.push({label: 'durnuksyz deňagramlylyk', color: '#c9432f', dash: [6, 4]});
    if(S.eq.some(e => e.stable === 0)) leg.push({label: 'ýarym durnukly', color: '#8a6d00', dash: [6, 4]});
    P.legend(leg);
  };
  draw();
}

function odeAddCurve(S, x0, y0){
  S.curves.push({x0, y0, left: odeTrace(S.f, x0, y0, S.box, -1), right: odeTrace(S.f, x0, y0, S.box, 1)});
  if(S.curves.length > 12) S.curves.shift();
}

function calcSlopeField(){
  let F;
  try{ F = xyCompile(document.getElementById('sf-f').value); }
  catch(e){ xyError('sf-result', e, 'x - y, y*(1 - y), x*y, sin(x) - y'); return; }
  try{
    const box = readBox(['sf-x1', 'sf-x2', 'sf-y1', 'sf-y2']);
    if(!box){ showResult('sf-result', '<strong>Ýalňyşlyk:</strong> görnüşiň aralyklary san bolmaly we başy ahyryndan kiçi bolmaly (mysal: x: −3 … 3, y: −3 … 3).', true); return; }
    const raw = document.getElementById('sf-pts').value.trim(), init = [];
    if(raw !== ''){
      for(const part of raw.split(';')){
        const t = part.replace(/[()]/g, ' ').trim();
        if(!t) continue;
        const v = t.split(/[\s,]+/).filter(Boolean).map(parseBound);
        if(v.length !== 2 || !v.every(isFinite)){ showResult('sf-result', '<strong>Ýalňyşlyk:</strong> başlangyç nokatlary "x₀ y₀" jübütleri görnüşinde nokatly otur bilen aýyryp ýaz (mysal: 0 1; 0 -1; 0 0.5).', true); return; }
        init.push(v);
      }
    }
    const f = F.f, kind = odeKind(F.node, f);
    let eq = [];
    if(!kind.hasX && kind.hasY){
      const g = y => f(0, y);
      eq = findRoots(g, box.yMin, box.yMax).filter(r => !r.jump).map(r => {
        const c = Math.abs(r.x) < 1e-9*(box.yMax - box.yMin) ? 0 : r.x, h = 1e-5*Math.max(1, Math.abs(c)), d = (g(c + h) - g(c - h))/(2*h);
        let st = d < -1e-9 ? 1 : d > 1e-9 ? -1 : 0;
        if(st === 0){ const l = g(c - 1e-3), rr = g(c + 1e-3); if(l > 0 && rr < 0) st = 1; else if(l < 0 && rr > 0) st = -1; }
        return {y: c, d, stable: st};
      });
    }
    const canvas = document.getElementById('sf-graph');
    canvas._ode = {f, box, eq, curves: []};
    init.forEach(p => odeAddCurve(canvas._ode, p[0], p[1]));
    let html = '<strong>y′ = f(x, y) =</strong> ' + prettyNode(F.node) + '<br>' +
      '<strong>Görnüşi:</strong> ' + (kind.txt.length ? kind.txt.join('; ') : 'umumy birinji tertipli deňleme (çözgüdi san usullary bilen ýakynlaşdyrylýar)') + '<br>';
    if(!kind.hasX && kind.hasY){
      html += '<strong>Deňagramlylyk çözgütleri</strong> (f(y) = 0 ⇒ y = c hemişelik çözgüt): ' + (eq.length ? '<br>' + eq.map(e => 'y = ' + fmt(e.y) + ' — ' + (e.stable === 1 ? '<b>durnukly</b> (golaýdaky çözgütler oňa ýakynlaşýar)' : e.stable === -1 ? '<b>durnuksyz</b> (golaýdaky çözgütler ondan daşlaşýar)' : 'ýarym durnukly')).join('<br>') : 'görnüşiň aralygynda ýok') + '<br>';
    }
    html += '<strong>Çözgüt egrileri:</strong> ' + (init.length ? init.map((p, k) => '<span class="dot" style="background:' + themeColor(ODE_COLORS[k % ODE_COLORS.length]) + '"></span>y(' + fmt(p[0]) + ') = ' + fmt(p[1])).join(', ') + ' — RK4 usuly bilen çyzyldy.' : 'başlangyç nokat berilmedi.') +
      ' <span class="muted" style="font-size:.85rem">Grafigiň islendik ýerine bas — şol nokatdan geçýän çözgüt egrisi goşular.</span>';
    showResult('sf-result', html, false);
    if(!canvas._odeBound){
      canvas._odeBound = true;
      canvas.classList.add('clickable');
      canvas.addEventListener('click', function(e){
        const P = canvas._P, S = canvas._ode;
        if(!P || !S) return;
        const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
        if(px < P.L || px > P.L + P.pw || py < P.T || py > P.T + P.ph) return;
        odeAddCurve(S, P.xMin + (px - P.L)/P.pw*(P.xMax - P.xMin), P.yMax - (py - P.T)/P.ph*(P.yMax - P.yMin));
        odeRender(canvas);
      });
    }
    odeRender(canvas);
    bindReadout('sf-graph', 'sf-read', (x, y) => 'x = ' + fmtPrec(x, 4) + ',  y = ' + fmtPrec(y, 4) + ',  y′ = f(x, y) = ' + fmtPrec(f(x, y), 5), 'Kursory süýşür: nokadyň koordinatalary we şol nokatdaky ýapgytlyk y′. Bas — täze çözgüt egrisi.');
  } catch(e){
    xyError('sf-result', e, 'x - y, y*(1 - y), x*y');
  }
}

/* Eýler, gowulandyrylan Eýler (Hoýn) we RK4 */
function odeSolve(f, x0, y0, h, N){
  const xs = [x0], E = [y0], H = [y0], R = [y0];
  for(let n = 0; n < N; n++){
    const x = xs[n], e = E[n], hy = H[n], r = R[n];
    E.push(e + h*f(x, e));
    const k1 = f(x, hy), k2 = f(x + h, hy + h*k1);
    H.push(hy + h/2*(k1 + k2));
    const q1 = f(x, r), q2 = f(x + h/2, r + h/2*q1), q3 = f(x + h/2, r + h/2*q2), q4 = f(x + h, r + h*q3);
    R.push(r + h/6*(q1 + 2*q2 + 2*q3 + q4));
    xs.push(x0 + (n + 1)*h);
  }
  return {xs, E, H, R};
}

function calcODE(){
  let F;
  try{ F = xyCompile(document.getElementById('ode-f').value); }
  catch(e){ xyError('ode-result', e, 'y, x + y, -2*y + 4, y*(1 - y)'); return; }
  try{
    const x0 = parseBound(document.getElementById('ode-x0').value), y0 = parseBound(document.getElementById('ode-y0').value);
    let h = parseBound(document.getElementById('ode-h').value);
    const X = parseBound(document.getElementById('ode-X').value), exStr = document.getElementById('ode-exact').value.trim();
    if(![x0, y0, h, X].every(isFinite)){ showResult('ode-result', '<strong>Ýalňyşlyk:</strong> x₀, y₀, ädim h we ahyrky X san bolmaly (mysal: 0, 1, 0.1, 1).', true); return; }
    if(h === 0 || X === x0){ showResult('ode-result', '<strong>Ýalňyşlyk:</strong> ädim h nol bolmaly däl we X ≠ x₀.', true); return; }
    if(Math.sign(h) !== Math.sign(X - x0)) h = -h;
    let N = Math.round((X - x0)/h), note = '';
    if(N < 1 || N > 5000){ showResult('ode-result', '<strong>Ýalňyşlyk:</strong> ädimleriň sany (X − x₀)/h 1-den 5000-e çenli bolmaly.', true); return; }
    if(Math.abs(N*h - (X - x0)) > 1e-9*Math.max(1, Math.abs(X - x0))){ h = (X - x0)/N; note = ' <span class="muted" style="font-size:.82rem">(h aralyga gabat gelmegi üçin ' + fmt(h) + ' edildi)</span>'; }
    let ex = null, exNode = null;
    if(exStr !== ''){
      try{ const c = xyCompile(exStr); exNode = c.node; ex = x => c.f(x, 0); }
      catch(e){ showResult('ode-result', '<strong>Ýalňyşlyk:</strong> takyk çözgüt y(x) diňe x üýtgeýjisine bagly aňlatma bolmaly (mysal: e^x).', true); return; }
    }
    /* analitik çözgüt (deňlemäniň görnüşi tanalsa): ädimler; takyk çözgüt meýdany boş bolsa şony ulanýarys */
    const AN = odeAnalytic(F.node, F.f, x0, y0);
    let anHtml = '', autoEx = false;
    if(AN){
      anHtml = '<strong>Analitik çözgüt (ädimme-ädim):</strong><ol class="steps">' + AN.steps.map(t => '<li>' + t + '</li>').join('') + '</ol>';
      const ac = AN.sol.compile(), af = x => safeEval(xx => ac.evaluate({x: xx}), x);
      if(!ex){ ex = af; exNode = AN.sol; autoEx = true; }
      else {
        const diff = [0.2, 0.5, 0.9].map(t => x0 + t*(X - x0)).some(x => isFinite(ex(x)) && isFinite(af(x)) && Math.abs(ex(x) - af(x)) > 1e-6*Math.max(1, Math.abs(af(x))));
        if(diff) anHtml += '<p class="check warn">⚠ Siziň ýazan takyk çözgüdiňiz analitik çözgütden tapawutlanýar — barlaň.</p>';
      }
    }
    const f = F.f, S = odeSolve(f, x0, y0, h, N);
    let bad = -1;
    for(let n = 0; n <= N; n++) if(![S.E[n], S.H[n], S.R[n]].every(isFinite)){ bad = n; break; }
    const ref = ex ? null : odeSolve(f, x0, y0, h/16, 16*N), yRef = n => ex ? ex(S.xs[n]) : ref.R[16*n];
    const idx = [];
    if(N <= 12) for(let n = 0; n <= N; n++) idx.push(n);
    else { const st = Math.ceil(N/10); for(let n = 0; n < N; n += st) idx.push(n); idx.push(N); }
    const lim = bad >= 0 ? bad : N + 1, rows = idx.filter(n => n < lim).map(n => '<tr><td>' + n + '</td><td>' + fmt(S.xs[n]) + '</td><td>' + fmtPrec(S.E[n], 8) + '</td><td>' + fmtPrec(S.H[n], 8) + '</td><td>' + fmtPrec(S.R[n], 10) + '</td><td>' + fmtPrec(yRef(n), 10) + '</td></tr>').join('');
    let html = '<strong>Koşi meselesi:</strong> y′ = ' + prettyNode(F.node) + ', y(' + fmt(x0) + ') = ' + fmt(y0) + '; &nbsp;<strong>h =</strong> ' + fmt(h) + note + ', <strong>ädim sany:</strong> ' + N + '<br>' + anHtml +
      '<strong>San usullary:</strong>' +
      '<table class="conv"><tr><th>n</th><th>xₙ</th><th>Eýler</th><th>Gowulandyrylan Eýler</th><th>RK4</th><th>' + (ex ? 'takyk y(xₙ)' : 'salgy (RK4, h/16)') + '</th></tr>' + rows + '</table>';
    if(bad >= 0) html += '<span class="muted" style="font-size:.85rem">⚠ n = ' + bad + ' ädimde baha çäksiz/kesgitlenmedik boldy — çözgüt "partlaýar" ýa-da f kesgitlenmedik.</span><br>';
    else {
      const yT = yRef(N), eE = Math.abs(S.E[N] - yT), eH = Math.abs(S.H[N] - yT), eR = Math.abs(S.R[N] - yT);
      html += '<strong>x = ' + fmt(X) + ' nokatda ýalňyşlyk</strong> (' + (ex ? 'takyk çözgüt' : 'salgy çözgüt') + ' bilen deňeşdirilende): Eýler ' + fmtPrec(eE, 3) + ', gowulandyrylan Eýler ' + fmtPrec(eH, 3) + ', RK4 ' + fmtPrec(eR, 3) + '<br>';
      if(ex && N <= 2500){
        const S2 = odeSolve(f, x0, y0, h/2, 2*N), yT2 = ex(S2.xs[2*N]);
        const p = (e1, e2) => (e1 > 1e-13 && e2 > 1e-15) ? Math.log2(e1/e2) : NaN;
        const pe = p(eE, Math.abs(S2.E[2*N] - yT2)), ph = p(eH, Math.abs(S2.H[2*N] - yT2)), pr = p(eR, Math.abs(S2.R[2*N] - yT2));
        html += '<strong>Usulyň tertibi</strong> (h iki esse kiçelende ýalňyşlyk 2ᵖ esse kiçelýär): Eýler p ≈ ' + (isFinite(pe) ? fmtPrec(pe, 3) : '—') + ', gowulandyrylan Eýler p ≈ ' + (isFinite(ph) ? fmtPrec(ph, 3) : '—') + ', RK4 p ≈ ' + (isFinite(pr) ? fmtPrec(pr, 3) : '— (ýalňyşlyk tegelekleme derejesinde)') + ' <span class="muted" style="font-size:.82rem">(nazary: 1, 2, 4)</span>';
      } else if(!ex) html += '<span class="muted" style="font-size:.85rem">Takyk çözgüt berilmedi — deňeşdirmek üçin 16 esse kiçi ädimli RK4 netijesi ulanyldy. Takyk y(x) belli bolsa, ony ýaz: usullaryň tertibi hem hasaplanar.</span>';
    }
    if(exNode && !autoEx) html += '<br><span class="muted" style="font-size:.85rem">Takyk çözgüt: y(x) = ' + prettyNode(exNode) + (Math.abs(ex(x0) - y0) > 1e-9*Math.max(1, Math.abs(y0)) ? ' — ⚠ y(x₀) = ' + fmt(ex(x0)) + ' ≠ y₀: başlangyç şerti kanagatlandyrmaýar!' : '') + '</span>';
    showResult('ode-result', html, false);
    // grafik
    const last = bad >= 0 ? bad : N + 1, xa = Math.min(x0, X), xb = Math.max(x0, X), all = [];
    for(let n = 0; n < last; n++) all.push(S.E[n], S.H[n], S.R[n]);
    const fine = [];
    for(let i = 0; i <= 300; i++){ const x = xa + (xb - xa)*i/300, y = ex ? ex(x) : NaN; fine.push([x, y]); if(isFinite(y)) all.push(y); }
    let lo = Math.min.apply(null, all.filter(isFinite)), hi = Math.max.apply(null, all.filter(isFinite));
    if(!(hi - lo > 1e-12)){ lo -= 1; hi += 1; }
    const pad = 0.08*(hi - lo), pw = (xb - xa)*0.04;
    const draw = function(){
      const P = makePlot('ode-graph', xa - pw, xb + pw, lo - pad, hi + pad, draw), ctx = P.ctx;
      P.axes(); P.clip();
      const line = (pts, color, width, dash) => { ctx.save(); ctx.strokeStyle = themeColor(color); ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.lineJoin = 'round'; ctx.beginPath(); let on = false; pts.forEach(p => { if(!isFinite(p[1])){ on = false; return; } if(on) ctx.lineTo(P.X(p[0]), P.Y(p[1])); else { ctx.moveTo(P.X(p[0]), P.Y(p[1])); on = true; } }); ctx.stroke(); ctx.restore(); };
      if(ex) line(fine, '#2f77c9', 2.4);
      const series = [[S.E, '#c9432f'], [S.H, '#e8a33d'], [S.R, '#3a9a3a']];
      series.forEach(([Y, col]) => {
        const pts = []; for(let n = 0; n < last; n++) pts.push([S.xs[n], Y[n]]);
        line(pts, col, 1.6, col === '#3a9a3a' ? [5, 3] : []);
        if(N <= 40) pts.forEach(p => { ctx.beginPath(); ctx.arc(P.X(p[0]), P.Y(p[1]), 3, 0, 2*Math.PI); ctx.fillStyle = themeColor(col); ctx.fill(); });
      });
      P.unclip();
      P.legend((ex ? [{label: 'takyk çözgüt', color: '#2f77c9'}] : []).concat([{label: 'Eýler', color: '#c9432f'}, {label: 'gowulandyrylan Eýler', color: '#e8a33d'}, {label: 'RK4', color: '#3a9a3a', dash: [5, 3]}]));
    };
    draw();
  } catch(e){
    xyError('ode-result', e, 'y, x + y, -2*y + 4');
  }
}

/* ===== modules/solvers/critical-steps.js ===== */
/* Kritiki nokatlar — mugallym ýaly ädimme-ädim (12-nji sapak): f_x = 0, f_y = 0 ulgamy — köpeldijilere dagytmak (umumy köpeldiji,
   elmydama položitel köpeldijiler), ýagdaýlara bölmek, bir üýtgeýjili deňleme ýa-da çyzykly deňlemeden ornuna goýmak; Gessian (D-test). */

function msBoxPt(box, s, t){ return {x: box.xMin + (box.xMax - box.xMin)*s, y: box.yMin + (box.yMax - box.yMin)*t}; }

/* gurluşy boýunça alamat: 2 — hemişe položitel, 1 — otrisatel däl, 0 — belli däl */
function msPosStruct(n){
  n = unwrap(n);
  if(n.type === 'ConstantNode') return typeof n.value === 'number' && n.value > 0 ? 2 : 0;
  if(n.type === 'SymbolNode') return (n.name === 'pi' || n.name === 'e') ? 2 : 0;
  if(n.type === 'FunctionNode'){
    const nm = n.fn.name;
    if(nm === 'exp' || nm === 'cosh') return 2;
    if(nm === 'abs' || nm === 'sqrt') return 1;
    return 0;
  }
  if(n.type === 'OperatorNode'){
    if(n.fn === 'pow'){
      const b = unwrap(n.args[0]), e = msConstVal(n.args[1]);
      if(b.type === 'SymbolNode' && b.name === 'e') return 2;
      const pb = msPosStruct(b);
      if(pb === 2) return 2;
      if(e !== null && Number.isInteger(e) && e % 2 === 0) return 1;
      return pb === 1 && e !== null && e > 0 ? 1 : 0;
    }
    if(n.fn === 'add'){ const p = n.args.map(msPosStruct); return p.every(v => v > 0) ? (p.some(v => v === 2) ? 2 : 1) : 0; }
    if(n.fn === 'multiply' || n.fn === 'divide'){ const p = n.args.map(msPosStruct); return p.every(v => v === 2) ? 2 : p.every(v => v > 0) ? 1 : 0; }
  }
  return 0;
}

/* köpeldiji gönüburçlukda nola deň bolmaýarmy (hemişe položitel ýa-da hemişe otrisatel) */
function msNoZero(f, box){
  if(msPosStruct(f) === 2) return true;
  const u = unwrap(f);
  if(u.type === 'OperatorNode' && u.fn === 'unaryMinus' && msPosStruct(u.args[0]) === 2) return true;
  const ev = msEval(f);
  let mn = Infinity, mx = -Infinity;
  for(let j = 0; j <= 24; j++) for(let i = 0; i <= 24; i++){
    const v = ev(msBoxPt(box, i/24, j/24));
    if(!isFinite(v)) return false;
    mn = Math.min(mn, v); mx = Math.max(mx, v);
  }
  return (mn > 0 && mn >= 1e-3*mx) || (mx < 0 && -mx >= -1e-3*mn);
}

/* köpeldijiler: köpeltmek, bölmek (maýdalawjy aýratyn), alamat; jübüt/položitel derejäniň esasy */
function msFactorList(n, num, den){
  n = unwrap(n);
  if(n.type === 'OperatorNode' && n.fn === 'multiply'){ msFactorList(n.args[0], num, den); msFactorList(n.args[1], num, den); return; }
  if(n.type === 'OperatorNode' && n.fn === 'divide'){ msFactorList(n.args[0], num, den); msFactorList(n.args[1], den, num); return; }
  if(n.type === 'OperatorNode' && (n.fn === 'unaryMinus' || n.fn === 'unaryPlus')){ msFactorList(n.args[0], num, den); return; }
  if(n.type === 'OperatorNode' && n.fn === 'pow'){
    const b = unwrap(n.args[0]), e = msConstVal(n.args[1]);
    if(!(b.type === 'SymbolNode' && b.name === 'e') && e !== null && e !== 0){ msFactorList(b, e > 0 ? num : den, e > 0 ? den : num); return; }
  }
  if(n.type === 'FunctionNode' && n.fn.name === 'sqrt' && n.args.length === 1){ msFactorList(n.args[0], num, den); return; }
  num.push(n);
}

/* jemden umumy köpeldijini çykarmak: y − 2xy − y² → y·(1 − 2x − y). Gaýtarýar {common: Node, rest: Node} ýa-da null */
function msCommonFactor(n){
  const terms = flattenSum(unwrap(n), 1, []);
  if(terms.length < 2) return null;
  const parse = t => {
    const fs = [], m = new Map();
    let c = t.sign;
    const walk = u => {
      u = unwrap(u);
      if(u.type === 'OperatorNode' && u.fn === 'multiply'){ walk(u.args[0]); walk(u.args[1]); return; }
      if(u.type === 'OperatorNode' && u.fn === 'unaryMinus'){ c = -c; walk(u.args[0]); return; }
      if(u.type === 'OperatorNode' && u.fn === 'divide'){ const dv = msConstVal(u.args[1]); if(dv !== null && dv !== 0){ c /= dv; walk(u.args[0]); return; } }
      if(u.type === 'ConstantNode' && typeof u.value === 'number'){ c *= u.value; return; }
      fs.push(u);
    };
    walk(t.node);
    for(const f of fs){
      let base = f, e = 1;
      if(f.type === 'OperatorNode' && f.fn === 'pow'){ const ev = msConstVal(f.args[1]); const b = unwrap(f.args[0]); if(ev !== null && ev > 0 && !(b.type === 'SymbolNode' && b.name === 'e')){ base = b; e = ev; } }
      const key = base.toString(), o = m.get(key);
      if(o) o.e += e; else m.set(key, {base, e});
    }
    return {c, m};
  };
  const P = terms.map(parse), common = [];
  P[0].m.forEach((o, key) => {
    let e = o.e;
    for(let i = 1; i < P.length && e > 0; i++){ const q = P[i].m.get(key); e = q ? Math.min(e, q.e) : 0; }
    if(e > 0) common.push({key, base: o.base, e});
  });
  if(!common.length) return null;
  const pw = (b, e) => Math.abs(e - 1) < 1e-12 ? b : msPow(b, msNum(e));
  let rest = null;
  P.forEach(p => {
    let node = null;
    p.m.forEach((o, key) => {
      const cm = common.find(q => q.key === key), e = cm ? o.e - cm.e : o.e;
      if(e > 1e-12) node = node === null ? pw(o.base, e) : msMul(node, pw(o.base, e));
    });
    const a = Math.abs(p.c);
    node = node === null ? msNum(a) : (Math.abs(a - 1) < 1e-12 ? node : msMul(msNum(a), node));
    rest = rest === null ? (p.c < 0 ? msNeg(node) : node) : (p.c < 0 ? msSub(rest, node) : msAdd(rest, node));
  });
  const comm = common.map(q => pw(q.base, q.e)).reduce((acc, f) => acc === null ? f : msMul(acc, f), null);
  return {common: comm, rest};
}

/* bir üýtgeýjili deňleme E(v) = 0: {roots, txt} ýa-da null */
function msUni(E, v, lo, hi){
  E = msFold(E);
  const X = v === 'x' ? E : msSubst(E, {[v]: msSym('x')}), f = msEval(X), fx = x => f({x});
  const c = polyCoeffs(X);
  if(c && c.length === 1) return {roots: [], txt: msP(E) + ' ≠ 0'};
  if(c && c.length >= 2){
    const R = msPolyRoots(c);
    if(R){
      if(c.length === 2 && Math.abs(c[0]) < 1e-14) return {roots: [0], txt: v + ' = 0'};
      let txt = polyHtml(c, v) + ' = 0';
      if(R.k > 0 && R.Q.length > 1) txt += ' ⇒ ' + v + (R.k > 1 ? '<sup>' + R.k + '</sup>' : '') + '·(' + polyHtml(R.Q, v) + ') = 0';
      if(R.g >= 2 && R.Q.length - 1 > 3) txt += ' (' + v + '<sup>' + R.g + '</sup> = t ornuna goýup)';
      txt += ' ⇒ ' + (R.roots.length ? R.roots.map(r => v + ' ' + msEqLbl(r)).join(', ') : 'hakyky kök ýok');
      return {roots: R.roots, txt};
    }
  }
  const span = hi - lo, a = lo - 0.02*span, b = hi + 0.02*span;
  let mn = Infinity, mx = -Infinity;
  for(let i = 0; i <= 200; i++){ const w = fx(a + (b - a)*i/200); if(isFinite(w)){ mn = Math.min(mn, w); mx = Math.max(mx, w); } }
  if(mn > 0 || mx < 0) return {roots: [], txt: msP(E) + ' = 0 deňlemäniň aralykda köki ýok'};
  const roots = findRoots(fx, a, b).filter(r => !r.jump).map(r => {
    const nn = msNiceNode(r.x), w = nn ? msConstVal(nn) : null;
    return (w !== null && Math.abs(w - r.x) < 1e-7*Math.max(1, Math.abs(r.x))) ? w : r.x;
  });
  return {roots, txt: msP(E) + ' = 0 ⇒ ' + (roots.length ? roots.map(r => v + ' ' + msEqLbl(r)).join(', ') + ' (' + fmtNice(lo) + ' ≤ ' + v + ' ≤ ' + fmtNice(hi) + ' aralykda)' : 'aralykda kök ýok')};
}

/* E deňleme v boýunça çyzykly we koeffisiýenti hemişelik san bolsa: v = aňlatma */
function msLinSolve(E, v){
  if(!msHas(E, v)) return null;
  let D;
  try{ D = derivNiceVar(E, v); }catch(e){ return null; }
  const dv = msConstTree(D) ? msConstVal(D) : null;
  if(dv === null || Math.abs(dv) < 1e-12) return null;
  const E0 = msFold(msSubst(E, {[v]: msN(0)}));
  return niceSimplifyVar(msFold(Math.abs(dv + 1) < 1e-12 ? E0 : Math.abs(dv - 1) < 1e-12 ? msNeg(E0) : msNeg(msDiv(E0, msNum(dv)))));
}

const msOther = v => v === 'x' ? 'y' : 'x';

const msRange = (box, v) => v === 'x' ? [box.xMin, box.xMax] : [box.yMin, box.yMax];

/* A(v) = 0 (diňe bir üýtgeýji), B = 0 */
function msPairUni(A, v, B, box){
  const w = msOther(v), [lo, hi] = msRange(box, v), [lo2, hi2] = msRange(box, w);
  const U = msUni(A, v, lo, hi);
  if(!U) return null;
  if(!U.roots.length) return {pts: [], txt: U.txt + ' — çözüw ýok.'};
  const pts = [], P = (r, s) => v === 'x' ? {x: r, y: s} : {x: s, y: r};
  if(msHas(B, v) && !msHas(B, w)){                       // iki deňleme hem diňe v-e bagly: umumy kök gerek
    const fb = msEval(B), com = U.roots.filter(r => { const q = fb({[v]: r}); return isFinite(q) && Math.abs(q) < 1e-9; });
    if(!com.length) return {pts: [], txt: U.txt + ', ýöne bu bahalarda ' + msP(B) + ' ≠ 0 — iki deňlemäniň umumy köki ýok, çözüw ýok.'};
    return {pts: [], inf: true, txt: U.txt + '; ' + com.map(r => v + ' ' + msEqLbl(r)).join(', ') + ' — iki deňlemäniň umumy köki: şol çyzygyň ähli nokatlary kritiki.'};
  }
  if(!msHas(B, v)){
    if(!msHas(B, w)) return {pts: [], txt: U.txt + '; ' + msP(B) + ' ≠ 0 — çözüw ýok.'};
    const V = msUni(B, w, lo2, hi2);
    if(!V) return null;
    U.roots.forEach(r => V.roots.forEach(s => pts.push(P(r, s))));
    return {pts, txt: U.txt + '; ' + V.txt + (pts.length ? ' ⇒ ' + pts.length + ' nokat: ' + pts.map(p => msPt(p.x, p.y)).join(', ') + '.' : ' — çözüw ýok.')};
  }
  const parts = [];
  let inf = false;
  for(const r of U.roots){
    const Br = niceSimplifyVar(msFold(msSubst(B, {[v]: msNum(r)})));
    const lead = v + ' ' + msEqLbl(r) + ' bolanda ' + msP(B) + ' = ' + msP(Br);
    if(!msHas(Br, w)){
      const c = msConstVal(msFold(Br));
      if(c !== null && Math.abs(c) < 1e-12){ inf = true; parts.push(lead + ' ≡ 0 — ' + v + ' ' + msEqLbl(r) + ' çyzygynyň ähli nokatlary'); }
      else parts.push(lead + ' ≠ 0 — çözüw ýok');
      continue;
    }
    const V = msUni(Br, w, lo2, hi2);
    if(!V) return null;
    V.roots.forEach(s => pts.push(P(r, s)));
    parts.push(lead + ' = 0 ⇒ ' + (V.roots.length ? V.roots.map(s => w + ' ' + msEqLbl(s)).join(', ') : 'çözüw ýok'));
  }
  return {pts, inf, txt: U.txt + '. ' + parts.join('; ') + '.'};
}

/* E = 0 deňlemeden v = aňlatma(w), O = 0 deňlemä goýmak */
function msPairLin(E, v, ex, O, box){
  const w = msOther(v), [lo2, hi2] = msRange(box, w);
  const O2 = niceSimplifyVar(msFold(msSubst(O, {[v]: ex})));
  let txt = msP(E) + ' = 0 ⇒ ' + v + ' = ' + msP(ex) + '. Muny ' + msP(O) + ' = 0 deňlemä goýýarys: ' + msP(O2);
  if(msHas(O2, v)) return null;
  if(!msHas(O2, w)){
    const c = msConstVal(msFold(O2));
    if(c !== null && Math.abs(c) < 1e-12) return {pts: [], inf: true, txt: txt + ' ≡ 0 — ' + v + ' = ' + msP(ex) + ' egrisiniň ähli nokatlary kritiki.'};
    return {pts: [], txt: txt + ' ≠ 0 — çözüw ýok.'};
  }
  const V = msUni(O2, w, lo2, hi2);
  if(!V) return null;
  const fe = msEval(ex), pts = V.roots.map(s => { const r = fe({[w]: s}); return v === 'x' ? {x: r, y: s} : {x: s, y: r}; }).filter(p => isFinite(p.x) && isFinite(p.y));
  txt += ' = 0 ⇒ ' + V.txt.replace(/^.*? = 0 ⇒ /, '') + (pts.length ? '. Onda ' + v + ' = ' + msP(ex) + ': ' + pts.map(p => msPt(p.x, p.y)).join(', ') + '.' : '.');
  return {pts, txt};
}

function msPair(A, B, box){
  const ax = msHas(A, 'x'), ay = msHas(A, 'y'), bx = msHas(B, 'x'), by = msHas(B, 'y');
  if(ax !== ay) return msPairUni(A, ax ? 'x' : 'y', B, box);
  if(bx !== by) return msPairUni(B, bx ? 'x' : 'y', A, box);
  for(const [E, O] of [[A, B], [B, A]]) for(const v of ['y', 'x']){
    const ex = msLinSolve(E, v);
    if(ex && !msHas(ex, v)) return msPairLin(E, v, ex, O, box);
  }
  return null;
}

/* deňlemäniň köpeldijileri: {facs, pos, shown} ýa-da {zero: true} */
function msEqFactors(E, box){
  const ev = msEval(E);
  let nz = 0, tot = 0;
  for(let j = 0; j <= 6; j++) for(let i = 0; i <= 6; i++){ const v = ev(msBoxPt(box, (i + 0.31)/7, (j + 0.57)/7)); if(isFinite(v)){ tot++; if(Math.abs(v) > 1e-12) nz++; } }
  if(tot > 10 && nz === 0) return {zero: true};
  const cf = msCommonFactor(E), num = [], den = [];
  if(cf){ msFactorList(cf.common, num, den); msFactorList(cf.rest, num, den); }
  else msFactorList(E, num, den);
  const facs = [], pos = [], seen = new Set();
  num.forEach(f => {
    if(!msHas(f, 'x') && !msHas(f, 'y')) return;
    if(msNoZero(f, box)){ pos.push(f); return; }
    const key = f.toString();
    if(!seen.has(key)){ seen.add(key); facs.push(f); }
  });
  return {facs, pos, shown: cf ? msMul(cf.common, cf.rest) : null};
}

function msSolveSystem(P, Q, box){
  const e1 = msEqFactors(P, box), e2 = msEqFactors(Q, box);
  if(e1.zero || e2.zero){
    const z = e1.zero ? 'f<sub>x</sub>' : 'f<sub>y</sub>', o = e1.zero ? e2 : e1, on = e1.zero ? 'f<sub>y</sub>' : 'f<sub>x</sub>';
    let curves = '';
    if(!o.zero && o.facs && o.facs.length && o.facs.every(f => msHas(f, 'x') !== msHas(f, 'y'))){
      const parts = [];
      o.facs.forEach(f => { const v = msHas(f, 'x') ? 'x' : 'y', U = msUni(f, v, ...msRange(box, v)); if(U) U.roots.forEach(r => parts.push(v + ' ' + msEqLbl(r))); });
      if(parts.length) curves = ' ' + on + ' = 0 ⇒ ' + parts.join(', ') + ' — bu ' + (parts.length > 1 ? 'çyzyklaryň' : 'çyzygyň') + ' ähli nokatlary kritiki (tükeniksiz köp).';
    }
    return {degenerate: true, lines: [z + ' ≡ 0 — bu deňleme ähli nokatlarda ýerine ýetýär, kritiki nokatlar tutuş egri (çyzyk) boýunça ýerleşýär.' + curves]};
  }
  const eqLine = (name, E, e) => {
    let s = name + ' = 0: ' + (e.shown ? msP(e.shown) + ' = 0' : msP(E) + ' = 0');
    if(e.facs.length > 1) s += ' ⇒ ' + e.facs.map(f => msP(f) + ' = 0').join(' ýa-da ');
    else if(e.facs.length === 1 && (e.shown || e.pos.length)) s += ' ⇒ ' + msP(e.facs[0]) + ' = 0';
    if(e.pos.length) s += ' (' + e.pos.map(f => msP(f)).join(', ') + ' nola deň bolmaýar)';
    if(!e.facs.length) s += ' — bu deňlemäniň çözüwi ýok';
    return s + '.';
  };
  const lines = [eqLine('f<sub>x</sub>', P, e1), eqLine('f<sub>y</sub>', Q, e2)];
  if(!e1.facs.length || !e2.facs.length) return {lines, cases: [], pts: [], inf: false};
  if(e1.facs.length*e2.facs.length > 9) return null;
  const cases = [];
  let pts = [], inf = false;
  const many = e1.facs.length*e2.facs.length > 1;
  for(const A of e1.facs) for(const B of e2.facs){
    let r;
    try{ r = msPair(A, B, box); }catch(e){ r = null; }
    if(!r) return null;
    if(r.inf) inf = true;
    cases.push((many ? msP(A) + ' = 0 we ' + msP(B) + ' = 0: ' : '') + r.txt);
    pts = pts.concat(r.pts);
  }
  return {lines, cases, pts, inf};
}

const MS_KIND = {min: 'lokal minimum', max: 'lokal maksimum', saddle: 'eýer nokady', none: 'test netije bermeýär'};

/* Gaýtarýar {html, pts: [{x, y, xl, yl}] | null}. numPts — Nýutonyň usuly bilen tapylan nokatlar (deňeşdirmek üçin) */
function critical2DSteps(fNode, box, numPts){
  const fx = derivNiceVar(fNode, 'x'), fy = derivNiceVar(fNode, 'y');
  const steps = [], Sx = derivStepsVar(fNode, 'x'), Sy = derivStepsVar(fNode, 'y');
  steps.push('<b>Birinji tertipli önümler</b> (f<sub>x</sub> üçin y hemişelik, f<sub>y</sub> üçin x hemişelik): f<sub>x</sub> = ' + msP(fx) + ', f<sub>y</sub> = ' + msP(fy) + '.' +
    '<details class="numcheck"><summary>Önümleriň tapylyşy</summary><ol class="steps sub">' + Sx.steps.concat(Sy.steps).map(s => '<li>' + s + '</li>').join('') + '</ol></details>');
  let sol = null;
  try{ sol = msSolveSystem(fx, fy, box); }catch(e){ sol = null; }
  const span = Math.max(box.xMax - box.xMin, box.yMax - box.yMin), efx = msEval(fx), efy = msEval(fy);
  let gs = 0;
  for(let j = 0; j <= 8; j++) for(let i = 0; i <= 8; i++){ const p = msBoxPt(box, i/8, j/8), g = Math.hypot(efx(p), efy(p)); if(isFinite(g)) gs = Math.max(gs, g); }
  const inBox = p => p.x >= box.xMin - 1e-9*span && p.x <= box.xMax + 1e-9*span && p.y >= box.yMin - 1e-9*span && p.y <= box.yMax + 1e-9*span;
  const isCrit = p => { const g = Math.hypot(efx(p), efy(p)); return isFinite(g) && g <= 1e-7*Math.max(1, gs); };
  let pts = null, outside = [];
  if(sol && !sol.degenerate && !sol.inf){
    const uniq = [];
    sol.pts.forEach(p => { if(isCrit(p) && !uniq.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 1e-7*Math.max(1, span))) uniq.push(p); });
    outside = uniq.filter(p => !inBox(p));
    pts = uniq.filter(inBox).map(p => ({x: p.x, y: p.y, xl: fmtNice(p.x), yl: fmtNice(p.y)}));
    const extra = (numPts || []).filter(q => !pts.some(p => Math.hypot(p.x - q.x, p.y - q.y) < 1e-5*span));
    let line = '<b>Kritiki nokatlar</b> — f<sub>x</sub> = 0 we f<sub>y</sub> = 0 ulgamyny çözýäris:' + '<ol class="steps sub">' + sol.lines.concat(sol.cases.length > 1 ? ['Iki deňlemäniň köpeldijilerini jübütläp, ýagdaýlara bölýäris:'] : []).map(s => '<li>' + s + '</li>').join('') +
      sol.cases.map((c, i) => '<li>' + (sol.cases.length > 1 ? (i + 1) + ') ' : '') + c + '</li>').join('') + '</ol>';
    if(extra.length){
      extra.forEach(q => pts.push({x: q.x, y: q.y, xl: '≈ ' + fmt(q.x), yl: '≈ ' + fmt(q.y)}));
      line += 'San usuly bilen goşmaça tapylan nokatlar: ' + extra.map(q => '(' + fmt(q.x) + '; ' + fmt(q.y) + ')').join(', ') + '. ';
    }
    line += pts.length ? 'Gönüburçlukdaky kritiki nokatlar: ' + pts.map(p => '(' + p.xl + '; ' + p.yl + ')').join(', ') + '.' : 'Gönüburçlukda kritiki nokat ýok.';
    if(outside.length) line += ' <span class="muted">(Gönüburçlukdan daşarda: ' + outside.map(p => msPt(p.x, p.y)).join(', ') + '.)</span>';
    steps.push(line);
  } else {
    const why = sol && sol.degenerate ? sol.lines[0] : sol && sol.inf ? 'Ulgamyň tükeniksiz köp çözüwi bar (kritiki nokatlar egri boýunça ýerleşýär).' : 'Bu ulgamy ýönekeý analitik usullar bilen çözüp bolmady.';
    steps.push('<b>Kritiki nokatlar</b> — f<sub>x</sub> = 0, f<sub>y</sub> = 0 ulgamy: ' + why + ' Şonuň üçin nokatlar san usuly (Nýutonyň usuly) bilen tapyldy.');
  }
  const fxx = derivNiceVar(fx, 'x'), fyy = derivNiceVar(fy, 'y'), fxy = derivNiceVar(fx, 'y');
  let Dn = null;
  if(msP(fxx).length + msP(fyy).length + msP(fxy).length <= 160){   // uzyn aňlatmalarda D-ni simwolik ýazmak peýdasyz we haýal
    try{ Dn = niceSimplifyVar(msSub(msMul(fxx, fyy), msPow(fxy, msN(2)))); }catch(e){ Dn = null; }
  }
  const Ds = Dn ? msP(Dn) : '';
  steps.push('<b>Ikinji tertipli önümler</b>: f<sub>xx</sub> = ' + msP(fxx) + ', f<sub>yy</sub> = ' + msP(fyy) + ', f<sub>xy</sub> = ' + msP(fxy) +
    '. Gessianyň kesgitleýjisi D = f<sub>xx</sub>·f<sub>yy</sub> − f<sub>xy</sub>²' + (Ds && Ds.length <= 110 ? ' = ' + Ds : '') + '.');
  const list = (pts || (numPts || []).map(q => ({x: q.x, y: q.y, xl: '≈ ' + fmt(q.x), yl: '≈ ' + fmt(q.y)})));
  if(list.length){
    const E = [fxx, fyy, fxy].map(msEval), ef = msEval(fNode);
    const rows = list.slice(0, 8).map(p => {
      const a = E[0](p), c = E[1](p), b = E[2](p), d = a*c - b*b, z = ef(p), tz = 1e-8*Math.max(1, a*a, b*b, c*c);
      const kind = !isFinite(d) ? 'none' : d > tz ? (a > 0 ? 'min' : 'max') : d < -tz ? 'saddle' : 'none';
      const exact = !/≈/.test(p.xl + p.yl), nv = v => exact ? fmtNice(v) : fmt(v);
      const why = kind === 'min' ? 'D &gt; 0, f<sub>xx</sub> &gt; 0' : kind === 'max' ? 'D &gt; 0, f<sub>xx</sub> &lt; 0' : kind === 'saddle' ? 'D &lt; 0' : 'D = 0';
      const np = v => { const t = nv(v); return /^[\d.]+$|^√\d+$/.test(t) ? t : '(' + t + ')'; };
      return '(' + p.xl + '; ' + p.yl + '): f<sub>xx</sub> = ' + nv(a) + ', f<sub>yy</sub> = ' + nv(c) + ', f<sub>xy</sub> = ' + nv(b) + ' ⇒ D = ' + np(a) + '·' + np(c) + ' − ' + np(b) + '² = ' + nv(d) +
        ' ⇒ ' + why + ' ⇒ <b>' + MS_KIND[kind] + '</b>' + (kind === 'none' ? ' (goşmaça derňew gerek)' : '') + ', f = ' + nv(z) + '.';
    });
    steps.push(msNest('<b>D-test</b> (D &gt; 0 we f<sub>xx</sub> &gt; 0 ⇒ minimum; D &gt; 0 we f<sub>xx</sub> &lt; 0 ⇒ maksimum; D &lt; 0 ⇒ eýer nokady; D = 0 ⇒ test netije bermeýär):', rows) +
      (list.length > 8 ? 'Galan nokatlar aşakdaky tablisada.' : ''));
  }
  return {html: '<div class="steps-head">Çözgüt ädimme-ädim</div><ol class="steps">' + steps.map(s => '<li>' + s + '</li>').join('') + '</ol>', pts};
}

/* ===== modules/solvers/partial-steps.js ===== */
/* Bölekleýin önümler — mugallym ýaly ädimme-ädim (12-nji sapak): f_x (y hemişelik) we f_y (x hemişelik) düzgünleriň özi bilen;
   nokatda bahalar (goýmak bilen), gradient, ugur boýunça önüm, galtaşýan tekizlik, ikinji tertipli önümler we Kleronyň teoremasy. */

/* k·v ýazgysy: 16x, (1/2)x, √2·x, 0.5x */
function msCoef(k, v){
  const s = fmtNice(k);
  if(!v) return s;
  if(Math.abs(k - 1) < 1e-12) return v;
  if(/^[\d.]+$/.test(s)) return s + v;
  if(/^√\d+$/.test(s)) return s + '·' + v;
  return '(' + s + ')' + v;
}

function msTermN(c, v, v0){
  if(Math.abs(c) < 1e-12) return '';
  const base = Math.abs(v0) < 1e-12 ? v : '(' + v + (v0 < 0 ? ' + ' + fmtNice(-v0) : ' − ' + fmtNice(v0)) + ')';
  return (c < 0 ? ' − ' : ' + ') + msCoef(Math.abs(c), base);
}

function msLinearN(A, B, C){
  let s = '';
  const add = (c, v) => {
    if(Math.abs(c) < 1e-12) return;
    const ks = msCoef(Math.abs(c), v);
    s += s === '' ? (c < 0 ? '−' : '') + ks : (c < 0 ? ' − ' : ' + ') + ks;
  };
  add(A, 'x'); add(B, 'y'); add(C, '');
  return 'z = ' + (s || '0');
}

function msSameXY(a, b){
  const fa = msEval(a), fb = msEval(b);
  let n = 0;
  for(const [x, y] of [[0.37, 0.83], [1.21, -0.47], [-0.66, 1.39], [2.03, 0.58], [0.91, 1.77]]){
    const u = fa({x, y}), v = fb({x, y});
    if(!isFinite(u) || !isFinite(v)) continue;
    if(Math.abs(u - v) > 1e-9*Math.max(1, Math.abs(u))) return false;
    n++;
  }
  return n >= 2;
}

/* Gaýtarýar {html} ýa-da null. x0, y0 — nokat, u1, u2 — ugur wektory */
function partialSteps(fNode, x0, y0, u1, u2){
  const fx = derivNiceVar(fNode, 'x'), fy = derivNiceVar(fNode, 'y');
  const Sx = derivStepsVar(fNode, 'x'), Sy = derivStepsVar(fNode, 'y');
  const at = {x: x0, y: y0}, ev = n => msEval(n)(at), K = msK(at);
  const z0 = ev(fNode), gx = ev(fx), gy = ev(fy);
  if(![z0, gx, gy].every(isFinite)) return null;
  const P0 = msPt(x0, y0), A0 = fmtNice(x0) + ', ' + fmtNice(y0);
  const sub = (n, val) => { const s = msP(n, K), vs = fmtNice(val); return (s.length <= 150 && s !== vs ? s + ' = ' : '') + vs; };
  const steps = [];
  steps.push(msNest('<b>∂f/∂x</b> — y-i hemişelik san hasaplap, x boýunça adaty önüm alýarys (′<sub>x</sub> — x boýunça önüm):', Sx.steps) + '⇒ <b>f<sub>x</sub> = ' + msP(fx) + '</b>.');
  steps.push(msNest('<b>∂f/∂y</b> — x-i hemişelik san hasaplap, y boýunça önüm alýarys:', Sy.steps) + '⇒ <b>f<sub>y</sub> = ' + msP(fy) + '</b>.');
  steps.push('<b>' + P0 + ' nokatdaky bahalar</b> (x = ' + fmtNice(x0) + ', y = ' + fmtNice(y0) + ' goýýarys): f(' + A0 + ') = ' + sub(fNode, z0) +
    '; f<sub>x</sub>(' + A0 + ') = ' + sub(fx, gx) + '; f<sub>y</sub>(' + A0 + ') = ' + sub(fy, gy) + '.');
  const gn = Math.hypot(gx, gy);
  steps.push('<b>Gradient</b>: ∇f(' + A0 + ') = (f<sub>x</sub>; f<sub>y</sub>) = (' + fmtNice(gx) + '; ' + fmtNice(gy) + ')' +
    (gn > 1e-12 ? ', |∇f| = ' + msNormStr(gx, gy) + '. Gradient f-iň <i>iň çalt artýan</i> ugruny görkezýär, şol ugurdaky üýtgeme tizligi |∇f|-e deň; −∇f ugrunda f iň çalt kemelýär.'
      : ' = 0 ⇒ ' + P0 + ' — <b>kritiki nokat</b>: galtaşýan tekizlik gorizontal, birinji tertipde hiç bir ugurda üýtgeme ýok.'));
  const un = Math.hypot(u1, u2), ux = u1/un, uy = u2/un, Du = gx*ux + gy*uy;
  let dir = '<b>Ugur boýunça önüm</b>: u = (' + fmtNice(u1) + '; ' + fmtNice(u2) + ')';
  dir += Math.abs(un - 1) < 1e-12 ? ' — birlik wektor (|u| = 1), şonuň üçin û = u' : ', |u| = ' + msNormStr(u1, u2) + ', birlik wektor û = u/|u| = (' + fmtNice(ux) + '; ' + fmtNice(uy) + ')';
  dir += '. D<sub>û</sub>f = ∇f·û = f<sub>x</sub>·û<sub>1</sub> + f<sub>y</sub>·û<sub>2</sub> = ' + msNumP(gx) + '·' + msNumP(ux) + ' + ' + msNumP(gy) + '·' + msNumP(uy) + ' = <b>' + fmtNice(Du) + '</b>' +
    (Math.abs(Du) < 1e-12 ? ' — bu ugurda f üýtgemeýär (ugur derejeli egrä galtaşýar).' : Du > 0 ? ' &gt; 0 — bu ugurda f artýar.' : ' &lt; 0 — bu ugurda f kemelýär.');
  steps.push(dir);
  const c0 = z0 - gx*x0 - gy*y0;
  let tp = (Math.abs(z0) < 1e-12 ? '' : fmtNice(z0)) + msTermN(gx, 'x', x0) + msTermN(gy, 'y', y0);
  tp = tp.replace(/^ \+ /, '').replace(/^ − /, '−') || '0';
  const lin = msLinearN(gx, gy, c0);
  steps.push('<b>Galtaşýan tekizlik</b>: z = f(x₀, y₀) + f<sub>x</sub>(x₀, y₀)·(x − x₀) + f<sub>y</sub>(x₀, y₀)·(y − y₀) ⇒ ' + ('z = ' + tp === lin ? '' : 'z = ' + tp + ' ⇒ ') + '<b>' + lin + '</b>.');
  const fxx = derivNiceVar(fx, 'x'), fyy = derivNiceVar(fy, 'y'), fxy = derivNiceVar(fx, 'y'), fyx = derivNiceVar(fy, 'x');
  const same = msSameXY(fxy, fyx), vals = [fxx, fyy, fxy].map(ev);
  steps.push('<b>Ikinji tertipli önümler</b>: f<sub>xx</sub> = (f<sub>x</sub>)′<sub>x</sub> = ' + msP(fxx) + '; f<sub>yy</sub> = (f<sub>y</sub>)′<sub>y</sub> = ' + msP(fyy) +
    '; f<sub>xy</sub> = (f<sub>x</sub>)′<sub>y</sub> = ' + msP(fxy) + '; f<sub>yx</sub> = (f<sub>y</sub>)′<sub>x</sub> = ' + msP(fyx) +
    (same ? ' ⇒ <b>f<sub>xy</sub> = f<sub>yx</sub></b> (Kleronyň teoremasy: garyşyk önümler üznüksiz bolsa, olar deňdir) ✓' : '') +
    (vals.every(isFinite) ? '. ' + P0 + ' nokatda: f<sub>xx</sub> = ' + fmtNice(vals[0]) + ', f<sub>yy</sub> = ' + fmtNice(vals[1]) + ', f<sub>xy</sub> = ' + fmtNice(vals[2]) + '.' : '.'));
  /* san barlagy: merkezi tapawutlar */
  const f = msEval(fNode), h = 1e-5*Math.max(1, Math.abs(x0)), k = 1e-5*Math.max(1, Math.abs(y0));
  const nx = (f({x: x0 + h, y: y0}) - f({x: x0 - h, y: y0}))/(2*h), ny = (f({x: x0, y: y0 + k}) - f({x: x0, y: y0 - k}))/(2*k);
  const ok = Math.abs(nx - gx) <= 1e-5*Math.max(1, Math.abs(gx)) && Math.abs(ny - gy) <= 1e-5*Math.max(1, Math.abs(gy));
  const fp = v => fmtPrec(v, 8).replace(/^-/, '−');
  const check = isFinite(nx) && isFinite(ny) ? '<p class="check ' + (ok ? 'ok' : 'warn') + '">Barlag (san taýdan önüm, h = 10⁻⁵): [f(x₀ + h, y₀) − f(x₀ − h, y₀)]/(2h) ≈ ' + fp(nx) +
    ', [f(x₀, y₀ + h) − f(x₀, y₀ − h)]/(2h) ≈ ' + fp(ny) + (ok ? ' — tapylan f<sub>x</sub>, f<sub>y</sub> bilen gabat gelýär ✓' : ' — tapawut bar (funksiýa bu nokatda tekiz däl bolmagy mümkin)') + '.</p>' : '';
  return {html: '<div class="steps-head">Çözgüt ädimme-ädim</div><ol class="steps">' + steps.map(s => '<li>' + s + '</li>').join('') + '</ol>' + check};
}

/* ===== modules/calculators/partial.js ===== */
/* Bölekleýin önüm: ∂f/∂x, ∂f/∂y, gradient, ugur boýunça önüm, galtaşýan tekizlik, çyzykly ýakynlaşma, ikinji tertipli önümler
   (Klero teoremasy) — mugallym ýaly ädimme-ädim (solvers/partial-steps.js, solvers/critical-steps.js); kritiki nokatlar: ulgamy analitik çözmek (başartmasa Nýutonyň
   usuly) we Gessian boýunça klassifikasiýa. */

/* a·(x − x0) agzasynyň ýazgysy: " + 4(x − 1)" */
function pdTerm(c, v, v0){
  if(Math.abs(c) < 1e-12) return '';
  const base = Math.abs(v0) < 1e-12 ? v : '(' + v + (v0 < 0 ? ' + ' + fmt(-v0) : ' − ' + fmt(v0)) + ')';
  const k = Math.abs(c), ks = Math.abs(k - 1) < 1e-12 ? '' : fmt(k) + (base === v ? '' : '·');
  return (c < 0 ? ' − ' : ' + ') + ks + base;
}

/* köpeltmekde otrisatel sany ýaýyň içinde: (−1) */
function pdF(v){ return v < 0 ? '(−' + fmt(-v) + ')' : fmt(v); }

/* z = A·x + B·y + C görnüşi */
function pdLinear(A, B, C){
  let s = '';
  const add = (c, v) => {
    if(Math.abs(c) < 1e-12) return;
    const k = Math.abs(c), ks = (v && Math.abs(k - 1) < 1e-12) ? '' : fmt(k);
    s += s === '' ? (c < 0 ? '−' : '') + ks + v : (c < 0 ? ' − ' : ' + ') + ks + v;
  };
  add(A, 'x'); add(B, 'y'); add(C, '');
  return 'z = ' + (s || '0');
}

function calcPartial(){
  let F;
  try{ F = xyCompile(document.getElementById('pd-f').value); }
  catch(e){ xyError('pd-result', e, 'x^2*y + 3*x*y^2, x^2 + y^2, sin(x)*e^y'); return; }
  try{
    const x0 = parseBound(document.getElementById('pd-x0').value), y0 = parseBound(document.getElementById('pd-y0').value);
    const u1 = parseBound(document.getElementById('pd-u1').value), u2 = parseBound(document.getElementById('pd-u2').value);
    if(![x0, y0].every(isFinite)){ showResult('pd-result', '<strong>Ýalňyşlyk:</strong> nokadyň koordinatalary x₀, y₀ anyk san bolmaly (mysal: 1 we 2).', true); return; }
    if(![u1, u2].every(isFinite) || Math.hypot(u1, u2) === 0){ showResult('pd-result', '<strong>Ýalňyşlyk:</strong> ugur wektory u = (u₁; u₂) nol däl bolmaly (mysal: 3 we 4).', true); return; }
    const D = (n, v) => simplifySafe(math.derivative(n, v));
    const fxN = D(F.node, 'x'), fyN = D(F.node, 'y');
    const fxxN = D(fxN, 'x'), fxyN = D(fxN, 'y'), fyxN = D(fyN, 'x'), fyyN = D(fyN, 'y');
    const ev = n => evalXY(n.compile());
    const fx = ev(fxN), fy = ev(fyN), z0 = F.f(x0, y0), gx = fx(x0, y0), gy = fy(x0, y0);
    if(!isFinite(z0)){ showResult('pd-result', '<strong>Ýalňyşlyk:</strong> f(' + fmt(x0) + ', ' + fmt(y0) + ') kesgitlenmedik — başga nokat saýla.', true); return; }
    if(!isFinite(gx) || !isFinite(gy)){ showResult('pd-result', '<strong>Netije:</strong> bölekleýin önümler bu nokatda kesgitlenmedik (mysal: √(x² + y²) üçin (0; 0) — konusyň ujy). Başga nokat saýla.', true); return; }
    const gn = Math.hypot(gx, gy), un = Math.hypot(u1, u2), ux = u1/un, uy = u2/un, Du = gx*ux + gy*uy;
    const A = ev(fxxN)(x0, y0), B = ev(fxyN)(x0, y0), B2 = ev(fyxN)(x0, y0), C = ev(fyyN)(x0, y0);
    const P0 = '(' + fmt(x0) + '; ' + fmt(y0) + ')';
    let S = null;
    try{ S = partialSteps(F.node, x0, y0, u1, u2); }catch(e){ S = null; }
    if(S){
      let html = '<strong>f(x, y) =</strong> ' + prettyNode(F.node) + S.html;
      const xa = x0 + 0.1, ya = y0 + 0.1, La = z0 + 0.1*gx + 0.1*gy, fa = F.f(xa, ya), extra = [];
      if(isFinite(fa)) extra.push('<b>Çyzykly ýakynlaşma</b> (galtaşýan tekizlik boýunça): f(' + fmt(xa) + ', ' + fmt(ya) + ') ≈ ' + fmt(La) + ' — takyk baha ' + fmt(fa) + ', tapawut ' + fmt(Math.abs(fa - La)) + '.');
      if(gn > 1e-12) extra.push('∇f bilen û arasyndaky burç ≈ ' + fmt(Math.round(Math.acos(Math.max(-1, Math.min(1, Du/gn)))*18000/Math.PI)/100) + '° (D<sub>û</sub>f = |∇f|·cos φ).');
      if(extra.length) html += '<p class="muted" style="font-size:.88rem">' + extra.join('<br>') + '</p>';
      showResult('pd-result', html, false);
    } else {
    let html = '<strong>f(x, y) =</strong> ' + prettyNode(F.node) + '<br>' +
      '<strong>∂f/∂x =</strong> ' + prettyNode(fxN) + ' <span class="rule" style="color:var(--muted);font-size:.8rem">(y hemişelik)</span><br>' +
      '<strong>∂f/∂y =</strong> ' + prettyNode(fyN) + ' <span class="rule" style="color:var(--muted);font-size:.8rem">(x hemişelik)</span><br>' +
      '<strong>' + P0 + ' nokatda:</strong> f = ' + fmt(z0) + ', f<sub>x</sub> = ' + fmt(gx) + ', f<sub>y</sub> = ' + fmt(gy) + '<br>' +
      '<strong>Gradient:</strong> ∇f = (' + fmt(gx) + '; ' + fmt(gy) + '), |∇f| = ' + fmt(gn) +
      (gn > 1e-12 ? ' — f iň çalt <i>artýan</i> ugur ∇f/|∇f| = (' + fmt(gx/gn) + '; ' + fmt(gy/gn) + '), iň uly üýtgeme tizligi |∇f| = ' + fmt(gn) + '.' : ' — ∇f = 0: bu <b>kritiki nokat</b> (galtaşýan tekizlik gorizontal).') + '<br>' +
      '<strong>Ugur boýunça önüm:</strong> u = (' + fmt(u1) + '; ' + fmt(u2) + '), birlik wektor û = u/|u| = (' + fmt(ux) + '; ' + fmt(uy) + ')<br>' +
      '&nbsp;&nbsp;D<sub>û</sub>f = ∇f · û = ' + pdF(gx) + '·' + pdF(ux) + ' + ' + pdF(gy) + '·' + pdF(uy) + ' = <b>' + fmt(Du) + '</b>' +
      (gn > 1e-12 ? ' <span class="muted" style="font-size:.82rem">(∇f bilen û arasyndaky burç ≈ ' + fmt(Math.round(Math.acos(Math.max(-1, Math.min(1, Du/gn)))*18000/Math.PI)/100) + '°)</span>' : '') + '<br>' +
      '<strong>Galtaşýan tekizlik:</strong> z = ' + fmt(z0) + pdTerm(gx, 'x', x0) + pdTerm(gy, 'y', y0) + ' &nbsp;⇔&nbsp; ' + pdLinear(gx, gy, z0 - gx*x0 - gy*y0) + '<br>';
    const xa = x0 + 0.1, ya = y0 + 0.1, La = z0 + 0.1*gx + 0.1*gy, fa = F.f(xa, ya);
    if(isFinite(fa)) html += '<strong>Çyzykly ýakynlaşma:</strong> f(' + fmt(xa) + ', ' + fmt(ya) + ') ≈ ' + fmt(La) + ' <span class="muted" style="font-size:.82rem">(takyk baha ' + fmt(fa) + ', tapawut ' + fmt(Math.abs(fa - La)) + ')</span><br>';
    html += '<strong>Ikinji tertipli önümler:</strong> f<sub>xx</sub> = ' + prettyNode(fxxN) + ', f<sub>yy</sub> = ' + prettyNode(fyyN) + ', f<sub>xy</sub> = ' + prettyNode(fxyN) + '<br>' +
      '&nbsp;&nbsp;' + P0 + ' nokatda: f<sub>xx</sub> = ' + fmt(A) + ', f<sub>yy</sub> = ' + fmt(C) + ', f<sub>xy</sub> = ' + fmt(B) + ', f<sub>yx</sub> = ' + fmt(B2) +
      (isFinite(B) && isFinite(B2) && Math.abs(B - B2) <= 1e-9*Math.max(1, Math.abs(B)) ? ' — <b>f<sub>xy</sub> = f<sub>yx</sub></b> (Kleronyň teoremasy) ✓' : '');
    showResult('pd-result', html, false);
    }

    const W = 2, box = {xMin: x0 - W, xMax: x0 + W, yMin: y0 - W, yMax: y0 + W}, r = 0.9;
    const plane = (x, y) => z0 + gx*(x - x0) + gy*(y - y0);
    const along = (dx, dy, color) => { const pts = []; for(let i = -30; i <= 30; i++){ const t = 1.1*i/30; pts.push([x0 + t*dx, y0 + t*dy, F.f(x0 + t*dx, y0 + t*dy)]); } return {pts, color, width: 2.6}; };
    const curves = [along(ux, uy, '#3a9a3a')];
    if(gn > 1e-12) curves.unshift(along(gx/gn, gy/gn, '#c9432f'));
    plotSurface3D('pd-graph3d', {box, surfaces: [{f: F.f}, {f: plane, mask: (x, y) => Math.abs(x - x0) <= r && Math.abs(y - y0) <= r, color: '#e8a33d', alpha: 0.62, n: 14, mesh: true, excludeRange: true}],
      points: [{x: x0, y: y0, z: z0, color: '#222', label: P0}], curves, colorbar: 'pd-cbar3d', fmt: v => fmt(v)});
    const arrows = [], L = 0.62*W;
    if(gn > 1e-12) arrows.push({x: x0, y: y0, dx: L*gx/gn, dy: L*gy/gn, color: '#c9432f', label: '∇f'});
    arrows.push({x: x0, y: y0, dx: 0.8*L*ux, dy: 0.8*L*uy, color: '#3a9a3a', label: 'û'});
    const segs = gn > 1e-12 ? [{x1: x0 - 0.7*W*gy/gn, y1: y0 + 0.7*W*gx/gn, x2: x0 + 0.7*W*gy/gn, y2: y0 - 0.7*W*gx/gn, color: '#222', dash: [5, 4], width: 1.3}] : [];
    plotField('pd-graph2d', F.f, box, {equal: true, levels: 12, highlight: [{level: z0, color: '#222', width: 2.2}], arrows, segments: segs, points: [{x: x0, y: y0, color: '#222'}], colorbar: 'pd-cbar2d', fmt: v => fmt(v),
      legend: [{label: 'f = ' + fmt(z0) + ' (nokatdan geçýän derejeli egri)', color: '#222'}, {label: '∇f (masştablanan)', color: '#c9432f'}, {label: 'û ugry', color: '#3a9a3a'}]});
    bindReadout('pd-graph2d', 'pd-read', (x, y) => 'x = ' + fmtPrec(x, 4) + ',  y = ' + fmtPrec(y, 4) + ',  f = ' + fmtPrec(F.f(x, y), 6) + ',  ∇f = (' + fmtPrec(fx(x, y), 4) + '; ' + fmtPrec(fy(x, y), 4) + ')',
      'Gradient (gyzyl ok) derejeli egrä (nokatdan geçýän galyň çyzyk) perpendikulýar. Kursory süýşürip islendik nokatda ∇f-i gör.');
  } catch(e){
    xyError('pd-result', e, 'x^2*y + 3*x*y^2, x^2 + y^2, sin(x)*e^y');
  }
}

const CP_LABEL = {min: 'lokal minimum', max: 'lokal maksimum', saddle: 'eýer nokady', none: 'test netije bermeýär (D = 0)'};

const CP_COLOR = {min: '#2f9a4a', max: '#c9432f', saddle: '#e8a33d', none: '#8a8a8a'};

function calcCritical2D(){
  let F;
  try{ F = xyCompile(document.getElementById('cp-f').value); }
  catch(e){ xyError('cp-result', e, 'x^3 - 3*x + y^2, x^2 + y^2 - 2*x, x*y*e^(-x^2-y^2)'); return; }
  try{
    const box = readBox(['cp-x1', 'cp-x2', 'cp-y1', 'cp-y2']);
    if(!box){ showResult('cp-result', '<strong>Ýalňyşlyk:</strong> aralyklar san bolmaly we başy ahyryndan kiçi bolmaly (mysal: −2 … 2).', true); return; }
    const D = (n, v) => math.derivative(n, v);
    const fxN = D(F.node, 'x'), fyN = D(F.node, 'y'), fxxN = D(fxN, 'x'), fxyN = D(fxN, 'y'), fyyN = D(fyN, 'y');
    const ev = n => evalXY(n.compile());
    const fx = ev(fxN), fy = ev(fyN), fxx = ev(fxxN), fxy = ev(fxyN), fyy = ev(fyyN);
    const sx = box.xMax - box.xMin, sy = box.yMax - box.yMin, span = Math.max(sx, sy);
    let gscale = 0;
    for(let j = 0; j <= 10; j++) for(let i = 0; i <= 10; i++){ const x = box.xMin + sx*i/10, y = box.yMin + sy*j/10, g = Math.hypot(fx(x, y), fy(x, y)); if(isFinite(g)) gscale = Math.max(gscale, g); }
    const tol = 1e-9*Math.max(1, gscale), found = [];
    for(let j = 0; j <= 8; j++) for(let i = 0; i <= 8; i++){
      let x = box.xMin + sx*(i + 0.5)/9.0, y = box.yMin + sy*(j + 0.5)/9.0, ok = false;
      for(let it = 0; it < 60; it++){
        const gx = fx(x, y), gy = fy(x, y);
        if(!isFinite(gx) || !isFinite(gy)) break;
        if(Math.hypot(gx, gy) <= tol){ ok = true; break; }
        const a = fxx(x, y), b = fxy(x, y), c = fyy(x, y), det = a*c - b*b;
        if(!isFinite(det) || Math.abs(det) < 1e-300) break;
        let dx = (-gx*c + gy*b)/det, dy = (-a*gy + b*gx)/det;
        const st = Math.hypot(dx, dy);
        if(st > 0.5*span){ dx *= 0.5*span/st; dy *= 0.5*span/st; }
        x += dx; y += dy;
        if(!isFinite(x) || !isFinite(y)) break;
      }
      if(!ok) continue;
      if(x < box.xMin - 1e-9*sx || x > box.xMax + 1e-9*sx || y < box.yMin - 1e-9*sy || y > box.yMax + 1e-9*sy) continue;
      const cl = v => Math.abs(v) < 1e-9*span ? 0 : v;
      x = cl(x); y = cl(y);
      if(found.some(p => Math.hypot(p.x - x, p.y - y) < 1e-5*span)) continue;
      found.push({x, y});
    }
    found.sort((p, q) => p.x - q.x || p.y - q.y);
    let St = null;
    try{ St = critical2DSteps(F.node, box, found.slice()); }catch(e){ St = null; }
    if(St && St.pts){                                        // analitik çözüw: takyk nokatlar (√3/3, π/2 ýaly ýazgylar bilen)
      found.length = 0;
      St.pts.slice().sort((p, q) => p.x - q.x || p.y - q.y).forEach(p => found.push({x: p.x, y: p.y, xl: p.xl, yl: p.yl}));
    }
    let minGap = Infinity;
    for(let i = 0; i < found.length; i++) for(let k = i + 1; k < found.length; k++) minGap = Math.min(minGap, Math.hypot(found[i].x - found[k].x, found[i].y - found[k].y));
    const dense = found.length > 12 && minGap < 0.15*span, CAP = dense ? 12 : 24;   // dykyz bolsa — kritiki nokatlar egri boýunça (mysal, f = x²)
    const pts = found.slice(0, CAP).map(p => {
      const a = fxx(p.x, p.y), b = fxy(p.x, p.y), c = fyy(p.x, p.y), d = a*c - b*b, z = F.f(p.x, p.y);
      const tz = 1e-8*Math.max(1, a*a, b*b, c*c);
      const kind = !isFinite(d) ? 'none' : d > tz ? (a > 0 ? 'min' : 'max') : d < -tz ? 'saddle' : 'none';
      return Object.assign(p, {a, b, c, d, z, kind});
    });
    let gmax = {v: -Infinity}, gmin = {v: Infinity};
    for(let j = 0; j <= 120; j++) for(let i = 0; i <= 120; i++){
      const x = box.xMin + sx*i/120, y = box.yMin + sy*j/120, v = F.f(x, y);
      if(!isFinite(v)) continue;
      if(v > gmax.v) gmax = {v, x, y};
      if(v < gmin.v) gmin = {v, x, y};
    }
    let html = '<strong>f(x, y) =</strong> ' + prettyNode(F.node) + '<br>';
    if(St) html = '<strong>f(x, y) =</strong> ' + prettyNode(F.node) + St.html;
    else html += '<strong>f<sub>x</sub> =</strong> ' + prettyNode(simplifySafe(fxN)) + ', &nbsp;<strong>f<sub>y</sub> =</strong> ' + prettyNode(simplifySafe(fyN)) + '<br>' +
      '<strong>f<sub>xx</sub> =</strong> ' + prettyNode(simplifySafe(fxxN)) + ', &nbsp;<strong>f<sub>yy</sub> =</strong> ' + prettyNode(simplifySafe(fyyN)) + ', &nbsp;<strong>f<sub>xy</sub> =</strong> ' + prettyNode(simplifySafe(fxyN)) + '<br>';
    if(!pts.length) html += '<strong>Kritiki nokatlar:</strong> bu gönüburçlukda f<sub>x</sub> = f<sub>y</sub> = 0 bolýan nokat tapylmady.<br>';
    else {
      html += '<strong>Kritiki nokatlar</strong> (f<sub>x</sub> = 0, f<sub>y</sub> = 0), D = f<sub>xx</sub>·f<sub>yy</sub> − f<sub>xy</sub>²:' +
        '<table class="conv"><tr><th>(x; y)</th><th>f</th><th>f<sub>xx</sub></th><th>f<sub>yy</sub></th><th>f<sub>xy</sub></th><th>D</th><th>Görnüşi</th></tr>' +
        pts.map(p => '<tr><td>(' + (p.xl || fmt(p.x)) + '; ' + (p.yl || fmt(p.y)) + ')</td><td>' + fmt(p.z) + '</td><td>' + fmt(p.a) + '</td><td>' + fmt(p.c) + '</td><td>' + fmt(p.b) + '</td><td>' + fmt(p.d) + '</td><td><span class="dot" style="background:' + themeColor(CP_COLOR[p.kind]) + '"></span>' + CP_LABEL[p.kind] + '</td></tr>').join('') + '</table>';
      if(dense) html += '<span class="muted" style="font-size:.85rem">⚠ Kritiki nokatlar biri-birine örän ýakyn we köp — olar tutuş egri boýunça ýerleşýän bolmagy mümkin (mysal, f = x² üçin x = 0 çyzygy); ilkinji 12-si görkezildi.</span><br>';
      else if(found.length > CAP) html += '<span class="muted" style="font-size:.85rem">Ilkinji ' + CAP + ' kritiki nokat görkezildi (jemi ' + found.length + ').</span><br>';
    }
    if(isFinite(gmax.v)) html += '<strong>Ýapyk gönüburçlukda (gyralary bilen):</strong> iň uly baha ≈ ' + fmt(gmax.v) + ' (' + fmt(gmax.x) + '; ' + fmt(gmax.y) + '), iň kiçi baha ≈ ' + fmt(gmin.v) + ' (' + fmt(gmin.x) + '; ' + fmt(gmin.y) + ') <span class="muted" style="font-size:.82rem">(gözenek boýunça — absolýut ekstremumlar gyralarda hem bolup biler)</span>';
    showResult('cp-result', html, false);
    const ptsShow = pts.map(p => ({x: p.x, y: p.y, color: CP_COLOR[p.kind], label: p.kind === 'min' ? 'min' : p.kind === 'max' ? 'max' : p.kind === 'saddle' ? 'eýer' : '?'}));
    const kinds = Array.from(new Set(pts.map(p => p.kind)));
    plotSurface3D('cp-graph3d', {box, surfaces: [{f: F.f}], points: pts.map((p, i) => ({x: p.x, y: p.y, z: p.z, color: CP_COLOR[p.kind], label: ptsShow[i].label})), colorbar: 'cp-cbar3d', fmt: v => fmt(v)});
    plotField('cp-graph2d', F.f, box, {equal: equalOk(box), levels: 14, points: ptsShow, colorbar: 'cp-cbar2d', fmt: v => fmt(v), legend: kinds.map(k => ({label: CP_LABEL[k], color: CP_COLOR[k]}))});
    bindReadout('cp-graph2d', 'cp-read', (x, y) => 'x = ' + fmtPrec(x, 4) + ',  y = ' + fmtPrec(y, 4) + ',  f = ' + fmtPrec(F.f(x, y), 6), 'Minimumyň töweregindäki derejeli egriler ýapyk egriler, eýer nokadynda bolsa "X" görnüşinde kesişýär.');
  } catch(e){
    xyError('cp-result', e, 'x^3 - 3*x + y^2, x^2 + y^2 - 2*x');
  }
}

/* ===== modules/calculators/riemann.js ===== */
/* Riemann jemi (çep / sag / orta nokatlar). */

const RIEMANN_LABEL = {left:'çep nokatlar', right:'sag nokatlar', mid:'orta nokatlar'};

function riemannPoint(a, h, i, method){ return method === 'left' ? a + i*h : method === 'right' ? a + (i+1)*h : a + (i+0.5)*h; }

function riemannSum(f, a, b, n, method){
  const h = (b-a)/n; let s = 0;
  for(let i=0; i<n; i++) s += f(riemannPoint(a, h, i, method));
  return s*h;
}

function plotRiemann(canvasId, f, a, b, n, method){
  const span = b - a, pad = span*0.12, xMin = a - pad, xMax = b + pad, M = 320, h = span/n;
  const curve = [], hts = [];
  for(let i=0; i<=M; i++) curve.push(safeEval(f, xMin + (xMax-xMin)*i/M));
  for(let i=0; i<n; i++) hts.push(safeEval(f, riemannPoint(a, h, i, method)));
  let lo = 0, hi = 0;
  curve.concat(hts).forEach(y => { if(isFinite(y)){ if(y < lo) lo = y; if(y > hi) hi = y; } });
  if(hi - lo < 1e-9) hi = lo + 1;
  const p = (hi - lo)*0.12; if(lo < 0) lo -= p; hi += p;
  const P = makePlot(canvasId, xMin, xMax, lo, hi, () => plotRiemann(canvasId, f, a, b, n, method));
  const ctx = P.ctx;
  P.axes(); P.clip();
  const y0 = P.Y(0);
  for(let i=0; i<n; i++){
    const y = hts[i]; if(!isFinite(y)) continue;
    const x1 = P.X(a + i*h), x2 = P.X(a + (i+1)*h), yy = P.Y(y), top = Math.min(y0, yy), hh = Math.abs(yy - y0);
    ctx.fillStyle = themeColor(y >= 0 ? 'rgba(47,119,201,0.30)' : 'rgba(201,67,47,0.30)');
    ctx.fillRect(x1, top, x2 - x1, hh);
    if(n <= 60){ ctx.strokeStyle = themeColor(y >= 0 ? 'rgba(21,74,146,0.85)' : 'rgba(150,40,25,0.85)'); ctx.lineWidth = 1; ctx.strokeRect(x1 + .5, top + .5, Math.max(0, x2 - x1 - 1), Math.max(0, hh - 1)); }
    if(n <= 24 && isFinite(y)){                       // nokatlaryň ýerleşişi
      const sx = method === 'left' ? x1 : method === 'right' ? x2 : (x1 + x2)/2;
      ctx.beginPath(); ctx.arc(sx, yy, 2.6, 0, 2*Math.PI); ctx.fillStyle = themeColor('#154a92'); ctx.fill();
    }
  }
  ctx.save(); ctx.strokeStyle = themeColor('#2f77c9'); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
  let started = false;
  curve.forEach((y, i) => {
    if(!isFinite(y)){ started = false; return; }
    const px = P.X(xMin + (xMax-xMin)*i/M), py = P.Y(y);
    if(!started){ ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
  });
  ctx.stroke(); ctx.restore();
  P.vline(a, '#7a9cc8', [3,3]); P.vline(b, '#7a9cc8', [3,3]);
  P.unclip();
}

function calcRiemann(){
  try{
    const node = math.parse(prep(document.getElementById('rie-f').value));
    const fFn = node.compile(), f = removable(x => fFn.evaluate({x}));
    const a = parseBound(document.getElementById('rie-a').value), b = parseBound(document.getElementById('rie-b').value);
    const n = Number(document.getElementById('rie-n').value), method = document.getElementById('rie-method').value;
    if(!isFinite(a) || !isFinite(b) || !(a < b)){
      showResult('rie-result', '<strong>Ýalňyşlyk:</strong> a we b san bolmaly, a < b (mysal: 0 we 2).', true); return;
    }
    if(!Number.isInteger(n) || n < 1 || n > 1000){
      showResult('rie-result', '<strong>Ýalňyşlyk:</strong> bölekleriň sany n — 1-den 1000-e çenli bitin san bolmaly.', true); return;
    }
    const S = riemannSum(f, a, b, n, method), h = (b-a)/n;
    if(!isFinite(S)){
      showResult('rie-result', '<strong>Ýalňyşlyk:</strong> funksiýa aralykda kesgitlenmedik ýa-da üzülýär (çäksiz bahasy bar) — Riemann jemi hasaplanyp bilinmedi.', true); return;
    }
    const jump = findJump(f, a, b);
    const exact = simpson(f, a, b, 2000);
    let html = `<strong>Riemann jemi (${RIEMANN_LABEL[method]}, n = ${n}):</strong> S<sub>n</sub> = Σ f(x<sub>i</sub>*)·Δx ≈ ${fmt(S)}<br>` +
      `<strong>Δx = (b − a)/n =</strong> ${fmt(h)}<br>`;
    if(jump !== null){
      html += `<span class="muted" style="font-size:.85rem">⚠ Funksiýa x ≈ ${fmt(jump)} nokadynda üzülýär — jemiň integrala ýakynlaşmagy kepillendirilmeýär.</span><br>`;
    } else if(isFinite(exact)){
      html += `<strong>Takyk baha (Simpson, n = 2000):</strong> ${fmt(exact)}<br><strong>Tapawut |S<sub>n</sub> − ∫|:</strong> ${fmt(Math.abs(S - exact))}<br>`;
    }
    const ns = [4, 8, 16, 32, 64, 128];
    html += `<span class="muted" style="font-size:.85rem">n artdygyça jemler integrala ýakynlaşýar:</span>` +
      `<table class="conv"><tr><th>n</th><th>Çep</th><th>Sag</th><th>Orta</th></tr>` +
      ns.map(k => `<tr><td>${k}</td><td>${fmt(riemannSum(f,a,b,k,'left'))}</td><td>${fmt(riemannSum(f,a,b,k,'right'))}</td><td>${fmt(riemannSum(f,a,b,k,'mid'))}</td></tr>`).join('') + `</table>`;
    showResult('rie-result', html, false);
    plotRiemann('rie-graph', f, a, b, n, method);
  } catch(e){
    showResult('rie-result', '<strong>Ýalňyşlyk:</strong> Aňlatmany barlaň (mysal: x^2, sin(x), e^(-x)). Diňe x üýtgeýjisi goldanýar.', true);
  }
}

/* ===== modules/calculators/sequence.js ===== */
/* Yzygiderlikler: agzalar, monotonlyk, çäklilik, limit we ε–N; rekurent yzygiderlik we örümçek (cobweb) diagrammasy. */

function seqMonotone(a, n0){
  const M = 400, d = [];
  let prev = a(n0);
  for(let k = n0 + 1; k <= n0 + M; k++){
    const cur = a(k);
    if(!isFinite(cur) || !isFinite(prev)) return {txt: 'barlap bolmady (käbir agzalar kesgitlenmedik)'};
    const tol = 1e-12*Math.max(1, Math.abs(cur), Math.abs(prev)), df = cur - prev;
    d.push(df > tol ? 1 : df < -tol ? -1 : 0);
    prev = cur;
  }
  const has = s => d.some(v => v === s);
  if(!has(1) && !has(-1)) return {txt: 'hemişelik (ähli agzalar deň)', s: 0};
  if(!has(-1)) return {txt: has(0) ? 'artýan (kemelmeýän): aₙ₊₁ ≥ aₙ' : 'berk artýan: aₙ₊₁ > aₙ ↗', s: 1};
  if(!has(1)) return {txt: has(0) ? 'kemelýän (artmaýan): aₙ₊₁ ≤ aₙ' : 'berk kemelýän: aₙ₊₁ < aₙ ↘', s: -1};
  let last = -1;
  for(let i = 1; i < d.length; i++) if(d[i] !== 0 && d[i - 1] !== 0 && d[i] !== d[i - 1]) last = i;
  if(last >= 0 && last < M/2){
    const s = d[d.length - 1], K = n0 + last;
    return {txt: 'monoton däl, ýöne n ≥ ' + K + ' bolanda ' + (s > 0 ? 'artýan ↗' : 'kemelýän ↘'), s};
  }
  return {txt: 'monoton däl (agzalar gezekli-gezegine ulalýar we kiçelýär)', s: null};
}

function seqBounds(a, n0, lim){
  let lo = Infinity, hi = -Infinity, cnt = 0;
  for(let k = n0; k < n0 + 1000; k++){ const v = a(k); if(isFinite(v)){ lo = Math.min(lo, v); hi = Math.max(hi, v); cnt++; } }
  [1e4, 1e4 + 1, 1e5, 1e5 + 1, 1e6, 1e6 + 1].forEach(k => { const v = a(k + n0 - 1); if(isFinite(v)){ lo = Math.min(lo, v); hi = Math.max(hi, v); } });
  if(!cnt) return {txt: 'barlap bolmady'};
  if(lim.t === 'inf') return {txt: lim.s > 0 ? 'ýokardan çäklenmedik (aₙ → +∞), aşakdan ' + fmt(lo) + ' bilen çäkli' : 'aşakdan çäklenmedik (aₙ → −∞), ýokardan ' + fmt(hi) + ' bilen çäkli', bounded: false};
  if(lim.t === 'osc' && lim.inf) return {txt: 'çäklenmedik (agzalaryň moduly çäksiz ösýär)', bounded: false};
  return {txt: 'çäkli: ' + fmt(lo) + ' ≤ aₙ ≤ ' + fmt(hi) + ' <span class="muted" style="font-size:.82rem">(barlanan agzalar boýunça)</span>', bounded: true, lo, hi};
}

/* ε–N: n ≥ N bolanda |aₙ − L| < ε. Doly barlag n ≤ n0 + 20000, soň geometrik ädimler bilen 10⁶-a çenli */
function seqEpsN(a, n0, L, eps){
  let last = null;
  const lim = n0 + 20000;
  for(let k = n0; k <= lim; k++){ const v = a(k); if(!isFinite(v) || Math.abs(v - L) >= eps) last = k; }
  let k = lim, far = false;
  while(k < 1e6){ k = Math.ceil(k*1.01); const v = a(k); if(!isFinite(v) || Math.abs(v - L) >= eps){ last = k; far = true; } }
  return {N: last === null ? n0 : last + 1, far};
}

function calcSequence(){
  try{
    const src = document.getElementById('seq-f').value;
    let S;
    try{ S = seqCompile(src); }
    catch(e){
      const m = /^symbol:(.+)$/.exec(e.message);
      showResult('seq-result', m ? '<strong>Ýalňyşlyk:</strong> "' + m[1].replace(/</g, '&lt;') + '" näbelli — aňlatmada diňe <b>n</b> üýtgeýjisini ulan (mysal: 1/n, (2n+1)/(n+3), (-1)^n/n).' : '<strong>Ýalňyşlyk:</strong> Aňlatmany barlaň (mysal: 1/n, (1+1/n)^n, (-1)^n, n/(n+1)).', true);
      return;
    }
    const n0 = Number(document.getElementById('seq-n0').value), N = Number(document.getElementById('seq-N').value);
    const epsStr = document.getElementById('seq-eps').value.trim(), eps = epsStr === '' ? NaN : parseBound(epsStr);
    if(!Number.isInteger(n0) || n0 < 0 || n0 > 1000){ showResult('seq-result', '<strong>Ýalňyşlyk:</strong> başlangyç indeks n₀ — 0-dan 1000-e çenli bitin san bolmaly (adatça 1).', true); return; }
    if(!Number.isInteger(N) || N < 3 || N > 60){ showResult('seq-result', '<strong>Ýalňyşlyk:</strong> görkezilýän agzalaryň sany 3-den 60-a çenli bitin san bolmaly.', true); return; }
    if(epsStr !== '' && !(eps > 0)){ showResult('seq-result', '<strong>Ýalňyşlyk:</strong> ε položitel san bolmaly (mysal: 0.01) ýa-da meýdany boş goý.', true); return; }
    const a = S.a, first = [];
    for(let k = n0; k < n0 + N; k++) first.push([k, a(k)]);
    if(first.filter(p => isFinite(p[1])).length < 2){ showResult('seq-result', '<strong>Ýalňyşlyk:</strong> yzygiderligiň agzalary kesgitlenmedik (mysal: n = 0 üçin 1/n). n₀-y üýtgedip gör.', true); return; }

    const lim = seqLimit(a, n0), mono = seqMonotone(a, n0), bnd = seqBounds(a, n0, lim);
    const rows = first.map((p, i) => '<tr><td>' + p[0] + '</td><td>' + fmt(p[1]) + '</td><td>' + (i ? fmt(p[1] - first[i - 1][1]) : '—') + '</td></tr>').join('');
    let html = '<strong>aₙ =</strong> ' + prettyNode(S.node) + ' <span class="muted" style="font-size:.82rem">(n = ' + n0 + ', ' + (n0 + 1) + ', ' + (n0 + 2) + ', …)</span><br>' +
      '<strong>Ilkinji ' + N + ' agza:</strong><table class="conv"><tr><th>n</th><th>aₙ</th><th>aₙ − aₙ₋₁</th></tr>' + rows + '</table>' +
      '<strong>Monotonlyk:</strong> ' + mono.txt + '<br><strong>Çäklilik:</strong> ' + bnd.txt + '<br>';
    let L = NaN, nice = null;
    if(lim.t === 'val'){
      nice = niceConst(lim.L, lim.err); L = nice.v;
      html += '<strong>Limit:</strong> lim<sub>n→∞</sub> aₙ = <b>' + nice.label + '</b> — yzygiderlik <b>ýygnaklanýar</b>.<br>';
    } else if(lim.t === 'inf'){
      html += '<strong>Limit:</strong> aₙ → ' + (lim.s > 0 ? '+∞' : '−∞') + ' — yzygiderlik <b>dargaýar</b> (çäksiz ösýär).<br>';
    } else if(lim.t === 'osc'){
      html += '<strong>Limit:</strong> ýok — yzygiderlik <b>dargaýar</b>: ' + (lim.inf ? 'agzalar alamatyny çalşyp, moduly boýunça çäksiz ösýär.' :
        'jübüt we täk belgili agzalar dürli sanlara ýakynlaşýar (≈ ' + fmt(lim.L1) + ' we ≈ ' + fmt(lim.L2) + ').') + '<br>';
    } else if(lim.t === 'nan'){
      html += '<strong>Limit:</strong> uly n-lerde agzalar kesgitlenmedik — limit anyklanmady.<br>';
    } else {
      html += '<strong>Limit:</strong> agzalar durnuklaşmaýar (yrgyldaýar ýa-da örän haýal üýtgeýär) — limit san taýdan anyklanmady.<br>';
    }
    html += '<span class="muted" style="font-size:.85rem">Uly n-lerde agzalar:</span><table class="conv"><tr><th>n</th><th>aₙ</th><th>n</th><th>aₙ</th></tr>' +
      lim.pts.map((p, i) => '<tr><td>' + p + '</td><td>' + fmtPrec(lim.ev[i], 8) + '</td><td>' + (p + 1) + '</td><td>' + fmtPrec(lim.od[i], 8) + '</td></tr>').join('') + '</table>';
    let Neps = null, epsFar = false;
    if(isFinite(L) && eps > 0){
      const r = seqEpsN(a, n0, L, eps);
      Neps = r.N; epsFar = r.far;
      html += '<strong>ε–N (ε = ' + fmt(eps) + '):</strong> ' + (r.far ? 'n ≥ ' + Neps + ' — örän uly N gerek (ýakynlaşma haýal ýa-da ε örän kiçi).' :
        'n ≥ <b>N = ' + Neps + '</b> bolanda ähli agzalar üçin |aₙ − L| &lt; ε' + (Neps > n0 ? ' (aₙ ' + fmt(L - eps) + ' we ' + fmt(L + eps) + ' aralygynda galýar; a<sub>' + (Neps - 1) + '</sub> entek daşarda).' : ' — ilkinji agzadan başlap.'));
    } else if(eps > 0 && lim.t !== 'val'){
      html += '<span class="muted" style="font-size:.85rem">ε–N barlagy diňe ýygnaklanýan yzygiderlik üçin manyly.</span>';
    }
    showResult('seq-result', html, false);

    const shown = Math.max(N, 20, (Neps !== null && !epsFar) ? Math.min(Math.ceil((Neps - n0)*1.15) + 6, 1000) : 0), pts = [];
    for(let k = n0; k < n0 + shown; k++) pts.push([k, a(k)]);
    const o = {};
    if(isFinite(L)){ o.hlines = [{y: L, color: '#b3261e'}]; o.legend = [{label: 'L = ' + fmt(L), color: '#b3261e', dash: [4, 3]}]; }
    if(isFinite(L) && eps > 0){ o.band = {lo: L - eps, hi: L + eps}; if(Neps !== null && Neps <= n0 + shown) o.vlines = [{x: Neps, color: '#8a6d00'}]; o.legend.push({label: 'L ± ε, N = ' + Neps, color: '#e8a33d'}); }
    plotPoints('seq-graph', [{pts, color: '#2f77c9', label: 'aₙ', stem: true}], o);
    bindReadout('seq-graph', 'seq-read', (x) => {
      const k = Math.round(x);
      if(k < n0 || k >= n0 + shown) return '';
      const v = a(k);
      return 'n = ' + k + ':  aₙ = ' + fmtPrec(v, 10) + (isFinite(L) ? ',  |aₙ − L| = ' + fmtPrec(Math.abs(v - L), 4) : '');
    }, 'Grafigiň üstünde kursory süýşür — n we aₙ bahasy şu ýerde görüner.');
  } catch(e){
    showResult('seq-result', '<strong>Ýalňyşlyk:</strong> Aňlatmany barlaň (mysal: 1/n, (1+1/n)^n, (-1)^n, n/(n+1)).', true);
  }
}

/* Rekurent yzygiderlik aₙ₊₁ = g(aₙ): örümçek (cobweb) diagrammasy, gozganmaýan nokatlar we olaryň durnuklylygy */
function calcCobweb(){
  try{
    const node = math.parse(prep(document.getElementById('cob-g').value));
    const gc = node.compile(), g = x => safeEval(xx => gc.evaluate({x: xx}), x), gp = derivativeFn(node);
    const a1 = parseBound(document.getElementById('cob-a1').value), N = Number(document.getElementById('cob-n').value);
    if(!isFinite(a1)){ showResult('cob-result', '<strong>Ýalňyşlyk:</strong> a₁ anyk san bolmaly (mysal: 1).', true); return; }
    if(!Number.isInteger(N) || N < 1 || N > 100){ showResult('cob-result', '<strong>Ýalňyşlyk:</strong> ädimleriň sany 1-den 100-e çenli bitin san bolmaly.', true); return; }
    const seq = [a1];
    let stop = null;
    for(let k = 1; k <= N; k++){
      const v = g(seq[k - 1]);
      if(!isFinite(v)){ stop = 'undef'; break; }
      seq.push(v);
      if(Math.abs(v) > 1e9){ stop = 'big'; break; }
    }
    const last = seq[seq.length - 1], prev = seq.length > 1 ? seq[seq.length - 2] : NaN, prev2 = seq.length > 2 ? seq[seq.length - 3] : NaN;
    const cap = 10*Math.max(1, Math.abs(a1)), fin = seq.filter(v => isFinite(v) && Math.abs(v) <= cap);   // dargaýan ýagdaýda penjire ilkinji agzalar boýunça
    let lo = Math.min.apply(null, fin), hi = Math.max.apply(null, fin);
    const span = Math.max(hi - lo, 1);
    lo -= 0.35*span; hi += 0.35*span;
    const clean = v => Math.abs(v) < 1e-12*Math.max(1, span) ? 0 : v;
    const fixed = findRoots(x => g(x) - x, lo, hi).filter(r => !r.jump).map(r => {
      const x = clean(r.x), d = gp(x), ad = Math.abs(d);
      return {x, d, kind: !isFinite(d) ? 'önüm kesgitlenmedik' : ad < 1 - 1e-6 ? 'özüne çekiji (durnukly): |g′(L)| < 1' : ad > 1 + 1e-6 ? 'itekleýji (durnuksyz): |g′(L)| > 1' : 'neýtral: |g′(L)| = 1 — test netije bermeýär'};
    });
    const near = fixed.find(f => Math.abs(last - f.x) <= 1e-6*Math.max(1, Math.abs(f.x)));
    const show = seq.length <= 16 ? seq.map((v, i) => [i, v]) : seq.slice(0, 12).map((v, i) => [i, v]).concat([[-1, NaN]], seq.slice(-3).map((v, i) => [seq.length - 3 + i, v]));
    const rows = show.map(p => p[0] < 0 ? '<tr><td>…</td><td>…</td><td>…</td></tr>' :
      '<tr><td>' + (p[0] + 1) + '</td><td>' + fmtPrec(p[1], 10) + '</td><td>' + (p[0] ? fmtPrec(Math.abs(p[1] - seq[p[0] - 1]), 3) : '—') + '</td></tr>').join('');
    let verdict;
    if(stop === 'undef') verdict = 'Duruldy: g(a<sub>' + seq.length + '</sub>) kesgitlenmedik — yzygiderlik dowam etdirilip bilinmeýär.';
    else if(stop === 'big') verdict = '<b>Dargaýar:</b> agzalar çäksiz ösýär.';
    else if(near && Math.abs(last - prev) <= 1e-4*Math.max(1, Math.abs(last))) verdict = '<b>Ýygnaklanýar:</b> aₙ → L ≈ ' + fmtPrec(near.x, 10) + ' (L = g(L) — gozganmaýan nokat).';
    else if(Math.abs(last - prev) <= 1e-9*Math.max(1, Math.abs(last))) verdict = '<b>Ýygnaklanýar:</b> aₙ → L ≈ ' + fmtPrec(last, 10) + ' (L = g(L) — gozganmaýan nokat).';
    else if(isFinite(prev2) && Math.abs(last - prev2) <= 1e-7*Math.max(1, Math.abs(last)) && Math.abs(last - prev) > 1e-5) verdict = '<b>2 periodly tsikl:</b> agzalar ' + fmtPrec(prev, 6) + ' ↔ ' + fmtPrec(last, 6) + ' arasynda gaýtalanýar — limit ýok.';
    else if(Math.abs(last - prev) < 1e-3*Math.max(1, Math.abs(last))) verdict = 'Ýakynlaşýar, ýöne ' + N + ' ädimde doly durnuklaşmady: a<sub>' + seq.length + '</sub> ≈ ' + fmtPrec(last, 8) + ' — ädimleriň sanyny köpelt.';
    else verdict = 'Durnuklaşmaýar: agzalar ýakynlaşmaýar (tsikl ýa-da "haos") — limit ýok bolmagy mümkin.';
    let html = '<strong>aₙ₊₁ = g(aₙ), g(x) =</strong> ' + prettyNode(node) + ', <strong>a₁ =</strong> ' + fmt(a1) + '<br>' +
      '<table class="conv"><tr><th>n</th><th>aₙ</th><th>|aₙ − aₙ₋₁|</th></tr>' + rows + '</table>' +
      '<strong>Netije:</strong> ' + verdict + '<br>';
    html += '<strong>Gozganmaýan nokatlar (g(L) = L) [' + fmt(lo) + '; ' + fmt(hi) + '] aralykda:</strong> ' +
      (fixed.length ? '<br>' + fixed.map(f => 'L ≈ ' + fmtPrec(f.x, 10) + ', g′(L) ≈ ' + fmt(f.d) + ' — ' + f.kind).join('<br>') : 'tapylmady');
    showResult('cob-result', html, false);
    const segs = [];
    for(let k = 0; k + 1 < seq.length && k < 60; k++){
      const x = seq[k], y = seq[k + 1];
      if(!isFinite(x) || !isFinite(y)) break;
      segs.push({x1: x, y1: x, x2: x, y2: y, color: '#3a9a3a', width: 1.4});   // dik: (aₖ, aₖ) → (aₖ, aₖ₊₁)
      segs.push({x1: x, y1: y, x2: y, y2: y, color: '#3a9a3a', width: 1.4});   // gorizontal: y = x çyzygyna
    }
    const pts = [{x: a1, y: a1, color: '#c9432f', label: 'a₁'}].concat(fixed.map(f => ({x: f.x, y: f.x, color: Math.abs(f.d) < 1 ? '#2f9a4a' : '#8a6d00', label: 'L'})));
    plotFunctions('cob-graph', [{fn: g, color: '#2f77c9', label: 'y = g(x)'}, {fn: x => x, color: '#8a8a8a', dash: [5, 4], width: 1.4, label: 'y = x'}], lo, hi,
      {segments: segs, points: pts, legend: [{label: 'aₙ ýoly (örümçek)', color: '#3a9a3a'}]});
  } catch(e){
    showResult('cob-result', '<strong>Ýalňyşlyk:</strong> g(x) aňlatmasyny barlaň (mysal: sqrt(2 + x), cos(x), x/2 + 1/x). Diňe x üýtgeýjisi goldanýar.', true);
  }
}

/* ===== modules/core/jet.js ===== */
/* Taylor koeffisiýentleri: math.js aňlatma agajyny kesilen derejeli hatarlaryň ("jet") arifmetikasy bilen hasaplaýar.
   f(a + t) = c₀ + c₁t + c₂t² + …,  cₖ = f⁽ᵏ⁾(a)/k!  — simwolik önümiň ulalmagy ýok, ýokary derejelerde hem tiz we takyk.
   Goldanýar: + − · / ^, sin cos tan cot sec csc, asin acos atan acot, sinh cosh tanh, asinh acosh atanh,
   exp log (ln, log(x, b)) log10 log2 sqrt cbrt nthRoot abs square cube; aýrylýan üzülmeler (sin(x)/x ýaly) hem. */

let _jM = 0, _jLost = 0;

function jZ(){ return new Array(_jM + 1).fill(0); }

function jC(c){ const r = jZ(); r[0] = c; return r; }

function jIsC(u){ for(let k = 1; k <= _jM; k++) if(u[k] !== 0) return false; return true; }

function jAdd(u, v){ return u.map((x, k) => x + v[k]); }

function jSub(u, v){ return u.map((x, k) => x - v[k]); }

function jScale(u, c){ return u.map(x => x*c); }

function jMul(u, v){
  const r = jZ();
  for(let k = 0; k <= _jM; k++){ let s = 0; for(let i = 0; i <= k; i++) s += u[i]*v[k - i]; r[k] = s; }
  return r;
}

function jShift(u, m){ const r = jZ(); for(let k = 0; k + m <= _jM; k++) r[k] = u[k + m]; return r; }

function jErr(msg){ const e = new Error(msg); e.jet = true; return e; }

/* u / v; v(a) = 0 we u(a) = 0 bolsa (aýrylýan üzülme) ikisini hem t^m-e bölýär */
function jDiv(u, v){
  let big = 0;
  for(let k = 0; k <= Math.min(_jM, 6); k++) big = Math.max(big, Math.abs(u[k]), Math.abs(v[k]));
  const tiny = 1e-11*Math.max(big, 1e-300);
  let m = 0;
  while(m < _jM && Math.abs(v[m]) <= tiny) m++;
  if(Math.abs(v[m]) <= tiny) throw jErr('bölüji nola deň (0-a bölmek)');
  if(m > 0){
    for(let k = 0; k < m; k++) if(Math.abs(u[k]) > 1e-9*Math.max(1, Math.abs(v[m]))) throw jErr('bu nokatda bölüji 0 — f(a) kesgitlenmedik');
    u = jShift(u, m); v = jShift(v, m); _jLost += m;
  }
  const r = jZ();
  r[0] = u[0]/v[0];
  for(let k = 1; k <= _jM; k++){ let s = u[k]; for(let i = 1; i <= k; i++) s -= v[i]*r[k - i]; r[k] = s/v[0]; }
  return r;
}

function jPowInt(u, n){
  let r = jC(1), b = u;
  while(n > 0){ if(n & 1) r = jMul(r, b); n >>= 1; if(n) b = jMul(b, b); }
  return r;
}

/* u^r (r — hemişelik, bitin däl): u(a) > 0 bolmaly */
function jPowReal(u, r){
  if(!(u[0] > 0)){
    if(u[0] === 0 || Math.abs(u[0]) < 1e-14) throw jErr('bu nokatda funksiýa differensirlenmeýär (kök / drob dereje 0-da)');
    throw jErr('otrisatel sanyň drob derejesi hakyky san däl');
  }
  const p = jZ();
  p[0] = Math.pow(u[0], r);
  for(let k = 1; k <= _jM; k++){
    let s = 0;
    for(let j = 1; j <= k; j++) s += (r*j - (k - j))*u[j]*p[k - j];
    p[k] = s/(k*u[0]);
  }
  return p;
}

function jPow(u, r){
  if(Number.isInteger(r) && Math.abs(r) <= 1024) return r >= 0 ? jPowInt(u, r) : jDiv(jC(1), jPowInt(u, -r));
  return jPowReal(u, r);
}

function jExp(u){
  const e = jZ();
  e[0] = Math.exp(u[0]);
  for(let k = 1; k <= _jM; k++){ let s = 0; for(let j = 1; j <= k; j++) s += j*u[j]*e[k - j]; e[k] = s/k; }
  return e;
}

function jLog(u){
  if(!(u[0] > 0)) throw jErr(u[0] === 0 ? 'ln(0) kesgitlenmedik' : 'otrisatel sanyň logarifmi kesgitlenmedik');
  const l = jZ();
  l[0] = Math.log(u[0]);
  for(let k = 1; k <= _jM; k++){ let s = 0; for(let j = 1; j < k; j++) s += j*l[j]*u[k - j]; l[k] = (u[k] - s/k)/u[0]; }
  return l;
}

/* [sin u, cos u] (hyp: [sinh u, cosh u]) */
function jSinCos(u, hyp){
  const s = jZ(), c = jZ();
  s[0] = hyp ? Math.sinh(u[0]) : Math.sin(u[0]);
  c[0] = hyp ? Math.cosh(u[0]) : Math.cos(u[0]);
  for(let k = 1; k <= _jM; k++){
    let ss = 0, cc = 0;
    for(let j = 1; j <= k; j++){ ss += j*u[j]*c[k - j]; cc += j*u[j]*s[k - j]; }
    s[k] = ss/k; c[k] = (hyp ? cc : -cc)/k;
  }
  return [s, c];
}

function jDeriv(u){ const d = jZ(); for(let k = 0; k < _jM; k++) d[k] = (k + 1)*u[k + 1]; return d; }

function jInteg(d, c0){ const r = jZ(); r[0] = c0; for(let k = 1; k <= _jM; k++) r[k] = d[k - 1]/k; return r; }

/* g(u)·u′ integraly: önümi belli funksiýalar üçin (arcsin, arctg, ...) */
function jByDeriv(u, g, f0){ return jInteg(jMul(g, jDeriv(u)), f0); }

const J_CONST = {pi: Math.PI, PI: Math.PI, e: Math.E, E: Math.E, tau: 2*Math.PI, phi: (1 + Math.sqrt(5))/2};

function jFn(name, args, a, v){
  const A = args.map(n => jEval(n, a, v)), u = A[0], one = () => jC(1);
  if(!u) throw jErr(name + ' — argument ýok');
  const sq = () => jMul(u, u);
  switch(name){
    case 'sin': return jSinCos(u)[0];
    case 'cos': return jSinCos(u)[1];
    case 'tan': { const sc = jSinCos(u); return jDiv(sc[0], sc[1]); }
    case 'cot': { const sc = jSinCos(u); return jDiv(sc[1], sc[0]); }
    case 'sec': return jDiv(one(), jSinCos(u)[1]);
    case 'csc': return jDiv(one(), jSinCos(u)[0]);
    case 'sinh': return jSinCos(u, true)[0];
    case 'cosh': return jSinCos(u, true)[1];
    case 'tanh': { const sc = jSinCos(u, true); return jDiv(sc[0], sc[1]); }
    case 'coth': { const sc = jSinCos(u, true); return jDiv(sc[1], sc[0]); }
    case 'sech': return jDiv(one(), jSinCos(u, true)[1]);
    case 'csch': return jDiv(one(), jSinCos(u, true)[0]);
    case 'exp': return jExp(u);
    case 'log':
      if(A.length === 2){ if(!jIsC(A[1]) || !(A[1][0] > 0) || A[1][0] === 1) throw jErr('logarifmiň esasy položitel hemişelik (≠ 1) bolmaly'); return jScale(jLog(u), 1/Math.log(A[1][0])); }
      return jLog(u);
    case 'log10': return jScale(jLog(u), 1/Math.LN10);
    case 'log2': return jScale(jLog(u), 1/Math.LN2);
    case 'log1p': return jLog(jAdd(one(), u));
    case 'expm1': return jSub(jExp(u), one());
    case 'sqrt': return jPowReal(u, 0.5);
    case 'square': return sq();
    case 'cube': return jMul(sq(), u);
    case 'cbrt':
      if(u[0] > 0) return jPowReal(u, 1/3);
      if(u[0] < 0) return jScale(jPowReal(jScale(u, -1), 1/3), -1);
      throw jErr('∛x funksiýasy 0-da differensirlenmeýär');
    case 'nthRoot': {
      const n = A[1] ? A[1][0] : 2;
      if(A[1] && !jIsC(A[1])) throw jErr('kök görkezijisi hemişelik bolmaly');
      if(u[0] < 0 && Number.isInteger(n) && n % 2 === 1) return jScale(jPowReal(jScale(u, -1), 1/n), -1);
      return jPowReal(u, 1/n);
    }
    case 'abs':
      if(u[0] > 1e-14) return u;
      if(u[0] < -1e-14) return jScale(u, -1);
      throw jErr('|x| funksiýasy 0-da differensirlenmeýär (burç nokady)');
    case 'asin': case 'acos': {
      if(!(Math.abs(u[0]) < 1)) throw jErr(Math.abs(u[0]) === 1 ? name + ' ±1 nokatda differensirlenmeýär' : name + ' diňe [−1; 1] aralykda kesgitlenen');
      const g = jPowReal(jSub(one(), sq()), -0.5);
      return name === 'asin' ? jByDeriv(u, g, Math.asin(u[0])) : jByDeriv(u, jScale(g, -1), Math.acos(u[0]));
    }
    case 'atan': return jByDeriv(u, jDiv(one(), jAdd(one(), sq())), Math.atan(u[0]));
    case 'acot':
      if(u[0] === 0) throw jErr('arcctg (math.js görnüşi) 0-da üzülýär');
      return jByDeriv(u, jScale(jDiv(one(), jAdd(one(), sq())), -1), Math.atan(1/u[0]));
    case 'asinh': return jByDeriv(u, jPowReal(jAdd(one(), sq()), -0.5), Math.asinh(u[0]));
    case 'acosh':
      if(!(u[0] > 1)) throw jErr('arch diňe x > 1 üçin differensirlenýär');
      return jByDeriv(u, jPowReal(jSub(sq(), one()), -0.5), Math.acosh(u[0]));
    case 'atanh':
      if(!(Math.abs(u[0]) < 1)) throw jErr('arth diňe (−1; 1) aralykda kesgitlenen');
      return jByDeriv(u, jDiv(one(), jSub(one(), sq())), Math.atanh(u[0]));
    case 'pow': return jPowNode(u, A[1]);
  }
  throw jErr('"' + name + '" funksiýasy Taylor hasaplaýjysynda goldanmaýar');
}

function jPowNode(u, w){
  if(jIsC(w)) return jPow(u, w[0]);
  if(jIsC(u)){
    if(!(u[0] > 0)) throw jErr('üýtgeýän derejäniň esasy položitel bolmaly');
    return jExp(jScale(w, Math.log(u[0])));
  }
  return jExp(jMul(w, jLog(u)));
}

function jEval(node, a, v){
  switch(node.type){
    case 'ParenthesisNode': return jEval(node.content, a, v);
    case 'ConstantNode':
      if(typeof node.value !== 'number') throw jErr('san däl hemişelik');
      return jC(node.value);
    case 'SymbolNode':
      if(node.name === v){ const r = jC(a); if(_jM >= 1) r[1] = 1; return r; }
      if(Object.prototype.hasOwnProperty.call(J_CONST, node.name)) return jC(J_CONST[node.name]);
      throw jErr('näbelli üýtgeýji "' + node.name + '" — diňe ' + v + ' ulanyp bolýar');
    case 'OperatorNode': {
      const f = node.fn, A = node.args;
      if(f === 'unaryMinus') return jScale(jEval(A[0], a, v), -1);
      if(f === 'unaryPlus') return jEval(A[0], a, v);
      if(A.length !== 2) throw jErr('"' + node.op + '" amaly Taylor hasaplaýjysynda goldanmaýar');
      const p = jEval(A[0], a, v), q = jEval(A[1], a, v);
      if(f === 'add') return jAdd(p, q);
      if(f === 'subtract') return jSub(p, q);
      if(f === 'multiply') return jMul(p, q);
      if(f === 'divide') return jDiv(p, q);
      if(f === 'pow') return jPowNode(p, q);
      throw jErr('"' + node.op + '" amaly Taylor hasaplaýjysynda goldanmaýar');
    }
    case 'FunctionNode': return jFn(node.fn.name, node.args, a, v);
  }
  throw jErr('bu aňlatma görnüşi goldanmaýar');
}

/* node — math.js agajy, a — merkez, order — iň uly dereje. Gaýtarýar: [c₀, c₁, …, c_order].
   Ýalňyşlyk (e.jet = true) — funksiýa a nokatda analitik däl ýa-da goldanmaýan bölek bar. */
function taylorCoeffs(node, a, order, v){
  _jM = order + 8; _jLost = 0;
  const r = jEval(node, a, v || 'x');
  if(_jLost > 8) throw jErr('aýrylýan üzülme aşa çuň');
  if(!r.slice(0, order + 1).every(isFinite)) throw jErr('koeffisiýentler çäksiz — funksiýa bu nokatda analitik däl');
  return r.slice(0, order + 1);
}

/* ===== modules/calculators/series.js ===== */
/* Hatarlar: bölekleýin jemler we ýygnaklyk alamatlary (n-nji agza, geometrik, Dalamber, Koşi, Leýbnis, p-hatar bilen deňeşdirme);
   Taylor köpagzasy (jet arifmetikasy bilen takyk koeffisiýentler) we ýygnaklylyk radiusy. */

/* Aitken tizlendirmesi: üç baha boýunça limit (ýaramasa — iň soňky baha) */
function serAitken(v0, v1, v2){
  const d1 = v1 - v0, d2 = v2 - v1;
  if(Math.abs(d1) > 1e-300 && Math.abs(d2/d1) < 0.95){ const ex = v2 - d2*d2/(d2 - d1); if(isFinite(ex)) return ex; }
  return v2;
}

/* Gatnaşyk (Dalamber) ýa-da kök (Koşi) alamatynyň limiti: uly n-lerde, agzalar nola çenli kiçelmeýän iň uly n-ler toplumy */
function serTestLimit(a, n0, kind){
  const sets = [[1000, 10000, 100000], [100, 1000, 10000], [30, 100, 300], [10, 20, 40]];
  for(const set of sets){
    const ns = set.map(t => t + n0 - 1), vals = [];
    for(const n of ns){
      const u = a(n);
      if(!isFinite(u) || u === 0){ vals.length = 0; break; }
      if(kind === 'ratio'){ const v = a(n + 1); if(!isFinite(v)){ vals.length = 0; break; } vals.push(Math.abs(v/u)); }
      else vals.push(Math.pow(Math.abs(u), 1/n));
    }
    if(vals.length === 3 && vals.every(isFinite)){
      const d1 = Math.abs(vals[1] - vals[0]), d2 = Math.abs(vals[2] - vals[1]), sc = Math.max(1e-12, Math.abs(vals[2]));
      if(d2 > 0.6*d1 + 1e-9*sc && d2 > 0.01*sc) return {L: NaN, osc: true, at: ns[2]};    // gatnaşyk durnuklaşmaýar (sin(n) ýaly) — limit ýok
      return {L: Math.max(0, serAitken(vals[0], vals[1], vals[2])), at: ns[2], last: vals[2]};
    }
  }
  return null;
}

function serVerdict(L){ return !isFinite(L) ? 'none' : L < 1 - 1e-4 ? 'conv' : L > 1 + 1e-4 ? 'div' : 'none'; }

function calcSeries(){
  try{
    let S;
    try{ S = seqCompile(document.getElementById('ser-f').value); }
    catch(e){
      const m = /^symbol:(.+)$/.exec(e.message);
      showResult('ser-result', m ? '<strong>Ýalňyşlyk:</strong> "' + _esc(m[1]) + '" näbelli — aňlatmada diňe <b>n</b> üýtgeýjisini ulan (mysal: 1/n^2, (-1)^(n+1)/n, 1/2^n).' : '<strong>Ýalňyşlyk:</strong> Aňlatmany barlaň (mysal: 1/n^2, 1/n, (2/3)^n, 1/factorial(n)).', true);
      return;
    }
    const n0 = Number(document.getElementById('ser-n0').value);
    if(!Number.isInteger(n0) || n0 < 0 || n0 > 1000){ showResult('ser-result', '<strong>Ýalňyşlyk:</strong> başlangyç indeks n₀ — 0-dan 1000-e çenli bitin san bolmaly (adatça 1).', true); return; }
    const a = S.a, NMAX = 100000, marks = [10, 100, 1000, 10000, 100000];
    let sum = 0, comp = 0, before = 0, bad = null, count = 0, tailZero = null, prevAbs = [];
    const first = [], sums = [];
    for(let i = 0; i < NMAX; i++){
      const k = n0 + i, v = a(k);
      if(!isFinite(v)){
        /* agzalar eýýäm örän kiçelen we kemelýän bolsa (2ⁿ/n! ýaly), uly n-de san aşmasy jeme täsir etmeýär */
        const L = prevAbs.length, dec = L >= 10 && prevAbs.slice(-10).every((u, j, arr) => j === 0 || u <= arr[j - 1]);
        if(dec && prevAbs[L - 1] <= 1e-16*Math.max(Math.abs(sum), 1e-300)){ tailZero = k; break; }
        bad = k; break;
      }
      prevAbs.push(Math.abs(v)); if(prevAbs.length > 12) prevAbs.shift();
      before = sum;
      const y = v - comp, t = sum + y; comp = (t - sum) - y; sum = t;   // Kahan jemlemesi
      count = i + 1;
      if(i < 40) first.push([k, v, sum]);
      if(marks.indexOf(i + 1) !== -1) sums.push([k, sum]);
    }
    if(bad !== null && count < 10){ showResult('ser-result', '<strong>Ýalňyşlyk:</strong> a<sub>' + bad + '</sub> kesgitlenmedik (mysal: 1/n üçin n = 0). Başlangyç n₀-y üýtget.', true); return; }
    const kN = n0 + count - 1, aN = a(kN);
    const scale = Math.max.apply(null, first.slice(0, 10).map(p => Math.abs(p[1]))) || 1;
    if(first.slice(0, 40).every(p => p[1] === 0)){ showResult('ser-result', '<strong>Netije:</strong> ähli agzalar 0 — hatar ýygnaklanýar we S = 0.', false); return; }

    // 1) n-nji agza alamaty
    const lim = seqLimit(a, n0);
    let zero;                                      // true / false / null (uly n-lerde hasaplanmady)
    if(lim.t === 'val') zero = Math.abs(lim.L) <= Math.max(1e-7*scale, 3*lim.err);
    else if(lim.t === 'unstable'){
      const dec = v => v.every((x, i) => i === 0 || Math.abs(x) < Math.abs(v[i - 1]));
      zero = dec(lim.ev) && dec(lim.od) && Math.abs(lim.ev[4]) < 0.5*Math.abs(lim.ev[0]);
    } else if(lim.t === 'nan') zero = null;
    else zero = false;
    // 2) geometrik hatar?
    let geo = null;
    if(a(n0) !== 0){
      const q0 = a(n0 + 1)/a(n0);
      let ok = isFinite(q0);
      for(let k = n0; ok && k < n0 + 25; k++){ const q = a(k + 1)/a(k); if(!(Math.abs(q - q0) <= 1e-9*Math.max(1, Math.abs(q0)))) ok = false; }
      if(ok) geo = q0;
    }
    // 3) Dalamber we Koşi
    const ratio = serTestLimit(a, n0, 'ratio'), root = serTestLimit(a, n0, 'root');
    const impliedZero = zero === null && ((ratio && serVerdict(ratio.L) === 'conv') || (root && serVerdict(root.L) === 'conv'));
    if(impliedZero) zero = true;
    // 4) Leýbnis (gezekli-gezegine alamatly)
    let alt = true;
    for(let k = n0; k < n0 + 200 && alt; k++){ if(!(a(k)*a(k + 1) < 0)) alt = false; }
    let altDec = alt;
    for(let k = n0 + 20; k < n0 + 300 && altDec; k++){ if(Math.abs(a(k + 1)) > Math.abs(a(k))*(1 + 1e-12)) altDec = false; }
    // 5) p-hatar bilen deňeşdirme (|aₙ| ≈ C/nᵖ)
    const pAt = n => { const u = Math.abs(a(n)), v = Math.abs(a(2*n)); if(!(u > 0) || !isFinite(u) || !isFinite(v)) return NaN; return v === 0 ? Infinity : -Math.log2(v/u); };
    const pA = pAt(5000 + n0 - 1), pB = pAt(50000 + n0 - 1);
    const pStable = isFinite(pB) && isFinite(pA) && Math.abs(pA - pB) < 0.05;
    let positive = true;
    for(let k = n0 + 10; k < n0 + 400 && positive; k++) if(!(a(k) > 0)) positive = false;
    // garmoniki hatar bilen çäk deňeşdirmesi: n·|aₙ| → L > 0 bolsa Σ|aₙ| dargaýar
    const h1 = (10000 + n0 - 1)*Math.abs(a(10000 + n0 - 1)), h2 = (100000 + n0 - 1)*Math.abs(a(100000 + n0 - 1));
    const harmonic = isFinite(h1) && isFinite(h2) && h2 > 1e-12 && Math.abs(h2 - h1) <= 1e-3*h2;
    // çäkli deňeşdirme: nᑫ·|aₙ| ösmeýär (q > 1) bolsa |aₙ| ≤ C/nᑫ we Σ|aₙ| ýygnaklanýar (sin(n)/n² ýaly yrgyldaýan agzalar üçin)
    let boundQ = null, boundM = 0;
    if(zero) for(const q of [2, 1.5, 1.2]){
      let M1 = 0, M2 = 0;
      for(let k = 1000; k <= 2000; k++){ const v = Math.pow(k, q)*Math.abs(a(k + n0 - 1)); if(isFinite(v)) M1 = Math.max(M1, v); else { M1 = NaN; break; } }
      for(let k = 50000; k <= 100000; k += 7){ const v = Math.pow(k, q)*Math.abs(a(k + n0 - 1)); if(isFinite(v)) M2 = Math.max(M2, v); else { M2 = NaN; break; } }
      if(isFinite(M1) && isFinite(M2) && M1 > 0 && M2 <= 1.05*M1){ boundQ = q; boundM = Math.max(M1, M2); break; }
    }

    // Netije
    const rows = [];
    let verdict = null, how = '', est = null, err = 0, exact = false;
    rows.push(['n-nji agza alamaty', lim.t === 'val' ? 'lim aₙ ≈ ' + fmt(zero ? 0 : lim.L) : lim.t === 'inf' ? 'aₙ → ' + (lim.s > 0 ? '+∞' : '−∞') : lim.t === 'osc' ? 'lim aₙ ýok' :
      lim.t === 'nan' ? (impliedZero ? 'aₙ → 0 (Dalamber/Koşi alamatyndan gelip çykýar)' : 'uly n-lerde aₙ hasaplanmady (aşa uly ýa-da kiçi sanlar)') : zero ? 'aₙ → 0 (haýal)' : 'aₙ 0-a ýakynlaşmaýar',
      zero ? 'aₙ → 0: alamat netije bermeýär (zerur şert ýerine ýetdi)' : zero === null ? 'barlanmady' : '<b>dargaýar</b> (aₙ ↛ 0)']);
    if(zero === false){ verdict = 'div'; how = 'n-nji agza alamaty: aₙ ↛ 0'; }
    if(geo !== null){
      rows.push(['Geometrik hatar', 'q = aₙ₊₁/aₙ = ' + fmt(geo), Math.abs(geo) < 1 ? '|q| < 1 — <b>ýygnaklanýar</b>, S = a₁/(1 − q)' : '|q| ≥ 1 — <b>dargaýar</b>']);
      if(Math.abs(geo) < 1){ verdict = 'conv'; how = 'geometrik hatar, |q| < 1'; est = a(n0)/(1 - geo); exact = true; }
      else { verdict = 'div'; how = 'geometrik hatar, |q| ≥ 1'; }
    }
    if(ratio) rows.push(['Dalamberiň alamaty (gatnaşyk)', ratio.osc ? '|aₙ₊₁/aₙ| durnuklaşmaýar' : 'ρ = lim |aₙ₊₁/aₙ| ≈ ' + fmtPrec(ratio.L, 6), ratio.osc ? 'ρ limiti ýok — alamat ulanylmaýar' : {conv: 'ρ &lt; 1 — <b>ýygnaklanýar</b> (absolýut)', div: 'ρ &gt; 1 — <b>dargaýar</b>', none: 'ρ = 1 — alamat netije bermeýär'}[serVerdict(ratio.L)]]);
    if(root) rows.push(['Koşiniň alamaty (kök)', root.osc ? 'ⁿ√|aₙ| durnuklaşmaýar' : 'σ = lim ⁿ√|aₙ| ≈ ' + fmtPrec(root.L, 6), root.osc ? 'σ limiti ýok — alamat ulanylmaýar' : {conv: 'σ &lt; 1 — <b>ýygnaklanýar</b> (absolýut)', div: 'σ &gt; 1 — <b>dargaýar</b>', none: 'σ = 1 — alamat netije bermeýär'}[serVerdict(root.L)]]);
    if(!verdict && ratio && serVerdict(ratio.L) !== 'none'){ verdict = serVerdict(ratio.L); how = 'Dalamberiň alamaty'; }
    if(!verdict && root && serVerdict(root.L) !== 'none'){ verdict = serVerdict(root.L); how = 'Koşiniň alamaty'; }
    if(alt){
      rows.push(['Leýbnisiň alamaty', 'alamatlar gezekleşýär, |aₙ| ' + (altDec ? 'kemelýär' : 'monoton kemelmeýär') + ', aₙ ' + (zero ? '→ 0' : '↛ 0'), altDec && zero ? '<b>ýygnaklanýar</b>' : 'şertler ýerine ýetmeýär']);
      if(!verdict && altDec && zero){ verdict = 'conv'; how = 'Leýbnisiň alamaty'; }
    }
    if(isFinite(pB) && zero && verdict !== 'div' && geo === null){
      const pTxt = pB === Infinity ? 'agzalar derejeli funksiýadan çalt kiçelýär' : '|aₙ| ≈ C/nᵖ, p ≈ ' + fmtPrec(pB, 4);
      let res;
      if(!pStable && pB !== Infinity) res = 'agzalar C/nᵖ görnüşinde däl — netije ýok';
      else if(pB >= 1.3) res = 'p &gt; 1 — Σ|aₙ| <b>ýygnaklanýar</b>';
      else if(pB <= 0.95) res = 'p ≤ 1 — Σ|aₙ| <b>dargaýar</b>';
      else res = 'p ≈ 1 — araçäk ýagdaý, netije ýok (integral alamatyny ulan)';
      rows.push(['p-hatar bilen deňeşdirme', pTxt, res]);
      if(!verdict && (pStable || pB === Infinity)){
        if(pB >= 1.3){ verdict = 'conv'; how = 'p-hatar bilen deňeşdirme (p ≈ ' + fmtPrec(pB, 3) + ' > 1)'; }
        else if(pB <= 0.95 && positive){ verdict = 'div'; how = 'p-hatar bilen deňeşdirme (p ≈ ' + fmtPrec(pB, 3) + ' ≤ 1)'; }
      }
    }
    if(harmonic && zero && geo === null){
      rows.push(['Garmoniki hatar bilen çäk deňeşdirmesi', 'n·|aₙ| → ' + fmtPrec(h2, 6) + ' &gt; 0', 'Σ1/n dargaýar ⇒ Σ|aₙ| <b>dargaýar</b>']);
      if(!verdict && positive){ verdict = 'div'; how = 'garmoniki hatar Σ1/n bilen çäk deňeşdirmesi'; }
    }
    if(boundQ !== null && !verdict){
      rows.push(['Deňeşdirme alamaty', 'n<sup>' + boundQ + '</sup>·|aₙ| çäkli (ösmeýär)', '|aₙ| ≤ C/n<sup>' + boundQ + '</sup> ⇒ <b>absolýut ýygnaklanýar</b>']);
      verdict = 'conv'; how = 'deňeşdirme alamaty: |aₙ| ≤ C/n<sup>' + boundQ + '</sup>';
    }
    let absNote = '';
    if(verdict === 'conv' && alt && how === 'Leýbnisiň alamaty'){
      absNote = (pStable && pB >= 1.3) ? ' Σ|aₙ| hem ýygnaklanýar — <b>absolýut ýygnaklanýar</b>.' : ((pStable && pB <= 0.95) || harmonic) ? ' Σ|aₙ| dargaýar — <b>şertli ýygnaklanýar</b>.' : '';
    }
    // Jemiň bahasy
    if(verdict === 'conv' && est === null && bad === null){
      if(how === 'Leýbnisiň alamaty'){ est = (sum + before)/2; err = Math.abs(aN)/2; }
      else if(how.indexOf('p-hatar') === 0 && isFinite(pB) && pB !== Infinity){
        const C = aN*Math.pow(kN, pB), tail = C*Math.pow(kN + 0.5, 1 - pB)/(pB - 1);
        est = sum + tail; err = Math.abs(tail)*0.02 + 1e-12;
      } else if(how.indexOf('deňeşdirme alamaty') === 0){ est = sum; err = boundM*Math.pow(kN, 1 - boundQ)/(boundQ - 1) + 1e-12; }
      else { est = sum; err = Math.abs(aN)*10 + 1e-14*Math.abs(sum); }
    }
    let html = '<strong>Hatar:</strong> Σ<sub>n=' + n0 + '</sub><sup>∞</sup> ' + prettyNode(S.node) + '<br>' +
      '<strong>Ilkinji agzalar we bölekleýin jemler</strong> Sₙ = a<sub>' + n0 + '</sub> + … + aₙ:' +
      '<table class="conv"><tr><th>n</th><th>aₙ</th><th>Sₙ</th></tr>' + first.slice(0, 8).map(p => '<tr><td>' + p[0] + '</td><td>' + fmt(p[1]) + '</td><td>' + fmtPrec(p[2], 8) + '</td></tr>').join('') + '</table>' +
      '<span class="muted" style="font-size:.85rem">Köp agzanyň jemi:</span><table class="conv"><tr><th>Agza sany</th><th>S</th></tr>' + sums.map((s, i) => '<tr><td>' + marks[i] + '</td><td>' + fmtPrec(s[1], 10) + '</td></tr>').join('') + '</table>' +
      '<strong>Ýygnaklyk alamatlary:</strong><table class="conv"><tr><th>Alamat</th><th>Hasaplama</th><th>Netije</th></tr>' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('') + '</table>';
    let nice = null;
    if(verdict === 'conv'){
      nice = est !== null ? (exact ? niceConst(est, 1e-12*Math.max(1, Math.abs(est))) : niceConst(est, err)) : null;
      html += '<strong>Netije:</strong> hatar <b>ýygnaklanýar</b> (' + how + ').' + absNote + (nice ? ' Jemi: <b>S ' + (nice.exact || exact ? '= ' : '≈ ') + nice.label + '</b>' + (exact ? '' : ' <span class="muted" style="font-size:.82rem">(san taýdan, takmynan ýalňyşlyk ' + fmt(Math.max(err, 1e-12)) + ')</span>') : '');
    } else if(verdict === 'div'){
      html += '<strong>Netije:</strong> hatar <b>dargaýar</b> (' + how + ').';
    } else {
      html += '<strong>Netije:</strong> alamatlar anyk netije bermedi. Bölekleýin jemleriň üýtgeýşine seret' + (sums.length >= 2 ? ' (S<sub>100000</sub> − S<sub>10000</sub> = ' + fmt(sums[sums.length - 1][1] - sums[sums.length - 2][1]) + ')' : '') + '; aýratyn derňew (mysal, integral alamaty) gerek.';
    }
    if(bad !== null) html += '<br><span class="muted" style="font-size:.82rem">⚠ a<sub>' + bad + '</sub> hasaplanyp bilinmedi (san aşa uly ýa-da kesgitlenmedik) — jem şol agza çenli hasaplandy.</span>';
    else if(tailZero !== null) html += '<br><span class="muted" style="font-size:.82rem">Bellik: n ≥ ' + tailZero + ' agzalaryň sanawjysy/maýdalawjysy kompýuterde aşa uly bolýar, ýöne agzalaryň özi eýýäm nola gaty ýakyn (|aₙ| &lt; 10<sup>−16</sup>·|S|) — jeme täsiri ýok.</span>';
    showResult('ser-result', html, false);
    const ptsA = first.slice(0, 30).map(p => [p[0], p[1]]), ptsS = first.slice(0, 30).map(p => [p[0], p[2]]);
    const o = {};
    const Sline = nice ? nice.v : est;
    if(verdict === 'conv' && isFinite(Sline)){ o.hlines = [{y: Sline, color: '#b3261e'}]; o.legend = [{label: 'S ≈ ' + fmt(Sline), color: '#b3261e', dash: [4, 3]}]; }
    plotPoints('ser-graph', [{pts: ptsA, color: '#2f77c9', label: 'aₙ', stem: true}, {pts: ptsS, color: '#c9432f', label: 'Sₙ (bölekleýin jem)', line: true}], o);
  } catch(e){
    showResult('ser-result', '<strong>Ýalňyşlyk:</strong> Aňlatmany barlaň (mysal: 1/n^2, (-1)^(n+1)/n, (1/2)^n, 1/factorial(n)).', true);
  }
}

/* ---------------------------------------------------------------- Taylor */
function tayGcd(p, q){ p = Math.abs(p); q = Math.abs(q); while(q){ const t = p % q; p = q; q = t; } return p; }

function tayFact(k){ let f = 1; for(let i = 2; i <= k; i++) f *= i; return f; }

/* cₖ koeffisiýentiniň ýazgysy: {num, den} (drob) ýa-da {dec} */
function tayCoef(c, k){
  if(k <= 17){
    const F = tayFact(k), m = c*F, M = Math.round(m);
    if(M !== 0 && Math.abs(m - M) <= 1e-8*Math.max(1, Math.abs(m)) && Math.abs(M) < 1e12){ const g = tayGcd(M, F); return {num: M/g, den: F/g}; }
  }
  const r = ratApprox(c, 10000, 1e-12);
  if(r) return {num: r[0], den: r[1]};
  const b = ratApprox(c, 1 << 22, 1e-14);                       // ikilik droblar: √x ýaly funksiýalarda 5/16384
  if(b && (b[1] & (b[1] - 1)) === 0) return {num: b[0], den: b[1]};
  return {dec: c};
}

/* Taylor köpagzasynyň HTML ýazgysy */
function tayPolyHtml(c, base){
  let out = '';
  c.forEach((ck, k) => {
    if(ck === 0) return;
    const f = tayCoef(ck, k), neg = f.dec !== undefined ? f.dec < 0 : f.num < 0;
    const pw = k === 0 ? '' : k === 1 ? base : base + '<sup>' + k + '</sup>';
    let term;
    if(f.dec !== undefined){ const d = fmt(Math.abs(f.dec)); term = k === 0 ? d : d + '·' + pw; }
    else {
      const p = Math.abs(f.num), q = f.den;
      if(k === 0) term = q === 1 ? String(p) : p + '/' + q;
      else term = (p === 1 ? '' : p + (base === 'x' ? '' : '·')) + pw + (q === 1 ? '' : '/' + q);
    }
    out += out === '' ? (neg ? '−' : '') + term : (neg ? ' − ' : ' + ') + term;
  });
  return out || '0';
}

/* Ýygnaklylyk radiusy koeffisiýentler boýunça (Domb–Sykes usuly): R (san / Infinity) ýa-da null (anyk däl) */
function tayRadius(c){
  const K = c.length - 1, big = Math.max.apply(null, c.map(Math.abs));
  const nz = [];
  for(let k = 0; k <= K; k++) if(c[k] !== 0 && Math.abs(c[k]) > 1e-280*big) nz.push(k);
  if(nz.length < 10 || nz[nz.length - 1] < K - 4) return null;
  const m = nz[nz.length - 1] - nz[nz.length - 2];
  let t = nz.length - 1;
  while(t > 0 && nz[t] - nz[t - 1] === m) t--;
  const tail = nz.slice(t);
  if(tail.length < 8) return null;
  const r = k => Math.pow(Math.abs(c[k + m]/c[k]), 1/m);
  const pick = target => tail.reduce((p, q) => Math.abs(q - target) < Math.abs(p - target) ? q : p, tail[0]);
  const k2 = tail[tail.length - 2], k1 = pick(k2/2), km = pick((k1 + k2)/2);
  if(!(k2 - k1 >= 6*m)) return null;
  const r1 = r(k1), r2 = r(k2), rm = r(km);
  if(!(r1 > 0 && r2 > 0 && isFinite(r1) && isFinite(r2))) return null;
  if(r2 < 0.85*r1) return Infinity;
  const inv = (k2*r2 - k1*r1)/(k2 - k1), inv2 = (k2*r2 - km*rm)/(k2 - km);
  if(!(inv > 0) || !(inv2 > 0) || Math.abs(inv - inv2) > 0.03*inv) return null;
  return 1/inv2;
}

function calcTaylor(){
  try{
    const src = document.getElementById('tay-f').value, node = math.parse(prep(src)), fc = node.compile();
    const f = x => safeEval(xx => fc.evaluate({x: xx}), x);
    const aStr = document.getElementById('tay-a').value.trim() || '0', a = parseBound(aStr);
    const n = Number(document.getElementById('tay-n').value);
    const xStr = document.getElementById('tay-x').value.trim(), x1 = xStr === '' ? NaN : parseBound(xStr);
    if(!isFinite(a)){ showResult('tay-result', '<strong>Ýalňyşlyk:</strong> merkez a anyk san bolmaly (mysal: 0, 1, pi/2).', true); return; }
    if(!Number.isInteger(n) || n < 0 || n > 20){ showResult('tay-result', '<strong>Ýalňyşlyk:</strong> köpagzanyň derejesi n — 0-dan 20-ä çenli bitin san bolmaly.', true); return; }
    if(xStr !== '' && !isFinite(x1)){ showResult('tay-result', '<strong>Ýalňyşlyk:</strong> barlag nokady x₁ san bolmaly ýa-da boş goý.', true); return; }
    let raw;
    try{ raw = taylorCoeffs(node, a, 48); }
    catch(e){
      if(e.jet){ showResult('tay-result', '<strong>Taylor hatary gurulmaýar:</strong> ' + _esc(e.message) + '. Başga merkez a saýlap gör.', true); return; }
      throw e;
    }
    const C = raw.map((v, k) => {                              // tegelekleme "galyndylaryny" (1e-17 ýaly) nol edýär
      const nb = Math.max(k > 0 ? Math.abs(raw[k - 1]) : 0, k < raw.length - 1 ? Math.abs(raw[k + 1]) : 0);
      return Math.abs(v) < 1e-12*nb ? 0 : v;
    });
    const c = C.slice(0, n + 1);
    const aLabel = a === 0 ? '0' : /[a-z]/i.test(aStr) ? _esc(aStr).replace(/\bpi\b/gi, 'π') : fmt(a);
    const aAbs = a === 0 ? '' : (/[a-z]/i.test(aStr) ? (a < 0 ? _esc(aStr.replace(/^\s*-/, '')).replace(/\bpi\b/gi, 'π') : aLabel) : fmt(Math.abs(a)));
    const base = a === 0 ? 'x' : '(x ' + (a < 0 ? '+ ' : '− ') + aAbs + ')';
    const T = (x, deg) => { let s = 0; for(let k = (deg === undefined ? n : deg); k >= 0; k--) s = s*(x - a) + C[k]; return s; };
    const rows = c.map((ck, k) => {
      const fk = ck*tayFact(k), cf = tayCoef(ck, k);
      const cs = ck === 0 ? '0' : cf.dec !== undefined ? fmt(cf.dec) : (cf.den === 1 ? String(cf.num) : (cf.num < 0 ? '−' : '') + Math.abs(cf.num) + '/' + cf.den);
      return '<tr><td>' + k + '</td><td>' + (ck === 0 ? '0' : fmtPrec(fk, 8)) + '</td><td>' + cs + '</td></tr>';
    }).join('');
    let html = '<strong>f(x) =</strong> ' + prettyNode(node) + ', <strong>a =</strong> ' + aLabel + ', <strong>n =</strong> ' + n + '<br>' +
      '<strong>Koeffisiýentler</strong> cₖ = f⁽ᵏ⁾(a)/k!:<table class="conv"><tr><th>k</th><th>f⁽ᵏ⁾(a)</th><th>cₖ</th></tr>' + rows + '</table>' +
      '<strong>T<sub>' + n + '</sub>(x) =</strong> ' + tayPolyHtml(c, base) + '<br>';
    let R = tayRadius(C);
    if(R !== null && isFinite(R)){
      const nr = niceConst(R, 0.002*R); R = nr.v;
      html += '<strong>Ýygnaklylyk radiusy:</strong> R ≈ ' + (nr.exact ? nr.label : String(Number(R.toPrecision(3)))) + ' — Taylor hatary |x − a| &lt; R aralykda f(x)-e ýygnaklanýar, daşynda dargaýar <span class="muted" style="font-size:.82rem">(koeffisiýentler boýunça takmynan)</span><br>';
    }
    else if(R === Infinity) html += '<strong>Ýygnaklylyk radiusy:</strong> R = ∞ — hatar ähli x üçin ýygnaklanýar.<br>';
    else if(C.every((v, k) => k <= 30 || v === 0)) html += '<strong>Bellik:</strong> f köpagza — Taylor hatary tükenikli we f-iň özi bilen gabat gelýär.<br>';
    if(isFinite(x1)){
      const fx = f(x1);
      const show = [];
      for(let k = 0; k <= n; k++) show.push(k);
      const pick = show.length > 10 ? show.filter(k => k < 4 || k % Math.ceil(n/8) === 0 || k === n) : show;
      html += '<strong>x₁ = ' + fmt(x1) + ' nokatda:</strong> f(x₁) = ' + fmtPrec(fx, 12) + ', T<sub>' + n + '</sub>(x₁) = ' + fmtPrec(T(x1), 12) + ', ýalňyşlyk |f − T<sub>' + n + '</sub>| = ' + fmtPrec(Math.abs(fx - T(x1)), 3) +
        '<table class="conv"><tr><th>k</th><th>T<sub>k</sub>(x₁)</th><th>|f(x₁) − T<sub>k</sub>(x₁)|</th></tr>' + pick.map(k => '<tr><td>' + k + '</td><td>' + fmtPrec(T(x1, k), 10) + '</td><td>' + fmtPrec(Math.abs(fx - T(x1, k)), 3) + '</td></tr>').join('') + '</table>';
      if(R !== null && isFinite(R) && Math.abs(x1 - a) > R) html += '<span class="muted" style="font-size:.85rem">⚠ |x₁ − a| &gt; R: bu nokatda hatar dargaýar — derejäni ulaltmak ýalňyşlygy kiçeltmeýär.</span>';
    }
    showResult('tay-result', html, false);
    let W = (R !== null && isFinite(R)) ? Math.min(Math.max(1.6*R, 1), 8) : 4;
    if(isFinite(x1)) W = Math.max(W, 1.25*Math.abs(x1 - a));
    const ys = [], rr = (R !== null && isFinite(R)) ? Math.min(0.95*R, W) : W;     // y aralygy: ýygnaklylyk aralygynyň içindäki f boýunça (polýuslar ezmesin)
    for(let i = 0; i <= 200; i++){ const y = f(a - rr + 2*rr*i/200); if(isFinite(y)) ys.push(y); }
    if(isFinite(x1)){ const y = f(x1); if(isFinite(y)) ys.push(y); }
    const yr = robustRange(ys.concat([T(a)])), pad = 0.25*(yr[1] - yr[0]);
    const segs = [];
    if(R !== null && isFinite(R) && R < W){ [a - R, a + R].forEach(x => segs.push({x1: x, y1: yr[0] - pad, x2: x, y2: yr[1] + pad, color: '#8a6d00', dash: [5, 4], width: 1.2})); }
    const pts = [{x: a, y: f(a), color: '#2f77c9', label: 'a'}];
    if(isFinite(x1)) pts.push({x: x1, y: f(x1), color: '#2f77c9'}, {x: x1, y: T(x1), color: '#c9432f', label: 'x₁'});
    plotFunctions('tay-graph', [{fn: f, color: '#2f77c9', label: 'f(x)'}, {fn: x => T(x), color: '#c9432f', dash: [7, 4], label: 'T' + String(n).split('').map(d => '₀₁₂₃₄₅₆₇₈₉'[d]).join('') + '(x)'}], a - W, a + W,
      {yRange: [yr[0] - pad, yr[1] + pad], segments: segs, points: pts, legend: segs.length ? [{label: 'a ± R', color: '#8a6d00', dash: [5, 4]}] : []});
  } catch(e){
    showResult('tay-result', '<strong>Ýalňyşlyk:</strong> Aňlatmany barlaň (mysal: e^x, sin(x), ln(1+x), 1/(1-x)). Diňe x üýtgeýjisi goldanýar.', true);
  }
}

/* ===== modules/ui/topics.js ===== */
/* Kurs gurluşy: derejeler we sapaklaryň sanawy (TOPICS:BEGIN / TOPICS:END aralygy generator bilen täzelenip bilner).
   keys — saýt gözlegi üçin açar sözler: tools/search-curated.txt-däki sapak setirlerine ýazylýar (README: "Gözleg indeksi"). */

const KALKULUS_LEVELS = {
  basic:{icon:'🟢', name:'Başlangyç',   course:'Precalculus'},
  mid:  {icon:'🔵', name:'Orta',        course:'Kalkulus I'},
  high: {icon:'🟣', name:'Ýokary',      course:'Kalkulus II'},
  univ: {icon:'🔴', name:'Uniwersitet', course:'Kalkulus III'},
  extra:{icon:'🟡', name:'Goşmaça',     course:'Differensial deňlemeler'},
  exam: {icon:'🏁', name:'Synag',       course:'Jemleýji synag'}
};

/*TOPICS:BEGIN*/
const KALKULUS_TOPICS = [
 {
  "id": "funksiyalar",
  "num": 1,
  "name": "Funksiýalar",
  "level": "basic",
  "href": "kalkulus-funksiyalar.html",
  "desc": "Funksiýanyň düşünjesi, kesgitleniş we bahalar ýaýlasy, esasy funksiýa görnüşleri.",
  "keys": [
   "funksiýa",
   "funksiya",
   "domain",
   "range",
   "kesgitleniş",
   "bahalar ýaýlasy",
   "polinom",
   "rasional",
   "görkezijili",
   "eksponensial",
   "logarifm",
   "trigonometriýa",
   "ters funksiýa",
   "kompozisiýa",
   "jübüt",
   "täk",
   "precalculus",
   "grafik",
   "funksiýa derňewçisi"
  ],
  "ready": true
 },
 {
  "id": "limitler",
  "num": 2,
  "name": "Limitler",
  "level": "mid",
  "href": "kalkulus-limitler.html",
  "desc": "Limit düşünjesi, çep we sag limit, çäksizlikdäki limit, limit hasaplamak.",
  "keys": [
   "limit",
   "çep limit",
   "sag limit",
   "çäk",
   "ýakynlaşma",
   "çäksizlikde limit",
   "asimptota",
   "sin(x)/x",
   "lopital",
   "lopitalyň düzgüni",
   "kesgitsizlik",
   "meşhur limit"
  ],
  "ready": true
 },
 {
  "id": "uznuksizlik",
  "num": 3,
  "name": "Üznüksizlik",
  "level": "mid",
  "href": "kalkulus-uznuksizlik.html",
  "desc": "Üznüksizligiň üç şerti, üzülme görnüşleri, aralyk orta baha teoremasy (IVT).",
  "keys": [
   "üznüksiz",
   "continuity",
   "ivt",
   "orta baha",
   "aralyk orta baha",
   "intermediate value",
   "üzülme",
   "bökme",
   "aýrylýan",
   "bisection",
   "kök",
   "ýarym bölmek",
   "bolzano"
  ],
  "ready": true
 },
 {
  "id": "onum",
  "num": 4,
  "name": "Önüm",
  "level": "mid",
  "href": "kalkulus-onum.html",
  "desc": "Önümiň kesgitlemesi, esasy düzgünler, çylşyrymly we anyk däl önüm.",
  "keys": [
   "önüm",
   "türev",
   "differensial",
   "derivative",
   "galtaşýan çyzyk",
   "tangent",
   "chain rule",
   "zynjyr",
   "product rule",
   "quotient rule",
   "power rule",
   "implicit",
   "anyk däl",
   "düzgünler",
   "differensirlemek",
   "köpeltmek hasyly",
   "paý"
  ],
  "ready": true
 },
 {
  "id": "onum-ulanylysy",
  "num": 5,
  "name": "Önümiň ulanylyşy",
  "level": "mid",
  "href": "kalkulus-onum-ulanylysy.html",
  "desc": "Kritiki nokatlar, ekstremum, egrilik, optimizasiýa we Newton usuly.",
  "keys": [
   "ekstremum",
   "maksimum",
   "minimum",
   "kritiki",
   "critical",
   "egrilik",
   "inflection",
   "optimizasiýa",
   "optimization",
   "newton",
   "related rates",
   "baglanyşykly tizlikler",
   "concavity",
   "çukur",
   "güberçek",
   "artýar",
   "kemelýär",
   "monoton",
   "nýuton",
   "nýutonyň usuly",
   "alamat tablisasy"
  ],
  "ready": true
 },
 {
  "id": "integral",
  "num": 6,
  "name": "Integral",
  "level": "mid",
  "href": "kalkulus-integral.html",
  "desc": "Antiwönüm, kesgitlenmedik we kesgitli integral, Riemann jemi, Newton–Leibniz.",
  "keys": [
   "integral",
   "antiwönüm",
   "antiderivative",
   "riemann",
   "ftc",
   "newton leibniz",
   "meýdan",
   "area",
   "kesgitli integral",
   "kesgitlenmedik integral",
   "primitiw",
   "simpson",
   "nýuton–leýbnis",
   "riemann jemi"
  ],
  "ready": true
 },
 {
  "id": "integral-ulanylysy",
  "num": 7,
  "name": "Integralyň ulanylyşy",
  "level": "high",
  "href": "kalkulus-integral-ulanylysy.html",
  "desc": "Egriler arasyndaky meýdan, aýlanma jisimleriň göwrümi, ortaça baha, egriniň uzynlygy.",
  "keys": [
   "egriler arasyndaky meýdan",
   "göwrüm",
   "volume",
   "aýlanma",
   "revolution",
   "ortaça baha",
   "average value",
   "uzynlyk",
   "arc length",
   "disk",
   "aýlanma jisimiň göwrümi",
   "washer",
   "gabyk"
  ],
  "ready": true
 },
 {
  "id": "integral-usullary",
  "num": 8,
  "name": "Integral usullary",
  "level": "high",
  "href": "kalkulus-integral-usullary.html",
  "desc": "Üýtgeýjini çalyşmak, bölekleýin integrirleme, bölekleýin drobler, çäksiz integrallar.",
  "keys": [
   "substitution",
   "çalyşma",
   "bölekleýin integrirleme",
   "by parts",
   "partial fractions",
   "bölekleýin drobler",
   "improper",
   "çäksiz integral",
   "trigonometrik integral",
   "trig substitution",
   "usullar",
   "ornuna goýma",
   "bölekleýin integrirlemek",
   "ýönekeý droblar"
  ],
  "ready": true
 },
 {
  "id": "yzygiderlikler",
  "num": 9,
  "name": "Yzygiderlikler",
  "level": "high",
  "href": "kalkulus-yzygiderlikler.html",
  "desc": "Sanly yzygiderlikler, monotonluk, çäklilik, ýygnaklylyk we limit.",
  "keys": [
   "yzygiderlik",
   "sequence",
   "ýygnaklyk",
   "convergence",
   "monoton",
   "çäkli",
   "fibonacci",
   "rekurent",
   "a_n",
   "örümçek diagrammasy",
   "cobweb",
   "epsilon"
  ],
  "ready": true
 },
 {
  "id": "hatarlar",
  "num": 10,
  "name": "Hatarlar",
  "level": "high",
  "href": "kalkulus-hatarlar.html",
  "desc": "Sanly hatarlar, geometrik hatar, ýygnaklyk alamatlary, Taylor hatary.",
  "keys": [
   "hatar",
   "hatarlyk",
   "series",
   "geometrik hatar",
   "taylor",
   "maclaurin",
   "ratio test",
   "dalamber",
   "comparison",
   "integral test",
   "ýygnaklyk alamaty",
   "derejeli hatar",
   "p-hatar",
   "koşi",
   "leýbnis",
   "garmoniki hatar",
   "makloren",
   "taylor köpagzasy",
   "ýygnaklylyk radiusy"
  ],
  "ready": true
 },
 {
  "id": "kop-funksiya",
  "num": 11,
  "name": "Köp üýtgeýänli funksiýalar",
  "level": "univ",
  "href": "kalkulus-kop-funksiya.html",
  "desc": "f(x, y) funksiýalar, derejeli egriler, üst ýüzler we kesgitleniş ýaýlasy.",
  "keys": [
   "köp üýtgeýänli",
   "multivariable",
   "f(x,y)",
   "level curve",
   "derejeli egri",
   "contour",
   "üst ýüz",
   "surface",
   "3d",
   "iki üýtgeýänli",
   "iki üýtgeýänli limit",
   "polýar"
  ],
  "ready": true
 },
 {
  "id": "bolekleyin-onum",
  "num": 12,
  "name": "Bölekleýin önüm",
  "level": "univ",
  "href": "kalkulus-bolekleyin-onum.html",
  "desc": "Bölekleýin önümler, gradient, ugur boýunça önüm, galtaşýan tekizlik.",
  "keys": [
   "bölekleýin önüm",
   "partial derivative",
   "gradient",
   "directional derivative",
   "ugur boýunça önüm",
   "tangent plane",
   "galtaşýan tekizlik",
   "hessian",
   "wektor",
   "gessian",
   "kritiki nokat",
   "eýer nokady",
   "kleron"
  ],
  "ready": true
 },
 {
  "id": "kop-integral",
  "num": 13,
  "name": "Köp integrallar",
  "level": "univ",
  "href": "kalkulus-kop-integral.html",
  "desc": "Goşa we üçleýin integrallar, yzygiderli integrirleme, meýdan we göwrüm.",
  "keys": [
   "köp integral",
   "double integral",
   "triple integral",
   "goşa integral",
   "üçleýin integral",
   "iterated",
   "ikileýin integral",
   "fubini",
   "polýar koordinatalar",
   "jisimiň göwrümi"
  ],
  "ready": true
 },
 {
  "id": "diff-denlemeler",
  "num": 14,
  "name": "Differensial deňlemelere giriş",
  "level": "extra",
  "href": "kalkulus-diff-denlemeler.html",
  "desc": "Birinji tertipli deňlemeler, aýrylýan üýtgeýänli deňlemeler, Euler usuly, ugur meýdany.",
  "keys": [
   "differensial deňleme",
   "differential equation",
   "ode",
   "euler",
   "slope field",
   "ugur meýdany",
   "separable",
   "aýrylýan",
   "runge kutta",
   "eýler usuly",
   "rk4",
   "runge–kutta",
   "logistik",
   "deňagramlylyk"
  ],
  "ready": true
 },
 {
  "id": "jemleyji-synag",
  "num": 15,
  "name": "Jemleýji synag",
  "level": "exam",
  "href": "kalkulus-jemleyji-synag.html",
  "desc": "Ähli temalar boýunça umumy synag — netijäňi we gaýtalamaly temalaryňy görkezýär.",
  "keys": [
   "synag",
   "exam",
   "final",
   "test",
   "jemleýji",
   "barlag",
   "baha",
   "jemleýji test"
  ],
  "ready": true
 }
];
/*TOPICS:END*/

/* ===== modules/ui/exam.js ===== */
/* Jemleýji synag: temalar boýunça netije, baha we gaýtalamaly sapaklar.
   Soraglar .quiz-q[data-topic="…"] — ýagdaý DOM-dan okalýar (quiz.js her jogapdan soň "kalkulus:quiz" wakasyny iberýär). */

function exGrade(pct){
  return pct >= 90 ? {g: 5, cls: 'g5', txt: '5 — ajaýyp'} : pct >= 75 ? {g: 4, cls: 'g4', txt: '4 — gowy'} : pct >= 60 ? {g: 3, cls: 'g3', txt: '3 — kanagatlanarly'} : {g: 2, cls: 'g2', txt: '2 — gaýtadan taýýarlan'};
}

function exRender(){
  const box = document.getElementById('exam-report');
  if(!box) return;
  const qs = Array.prototype.slice.call(document.querySelectorAll('.quiz-q[data-topic]'));
  if(!qs.length) return;
  const by = {}, order = [];
  let answered = 0, correct = 0;
  qs.forEach(q => {
    const id = q.dataset.topic;
    if(!by[id]){ by[id] = {n: 0, a: 0, c: 0}; order.push(id); }
    const t = by[id]; t.n++;
    if(q.classList.contains('answered')){ t.a++; answered++; if(!q.querySelector('.quiz-opts button.wrong')){ t.c++; correct++; } }
  });
  const n = qs.length, pct = Math.round(100*correct/n), done = answered === n;
  const name = id => { const t = KALKULUS_TOPICS.find(x => x.id === id); return t ? t : {name: id, href: '#', num: ''}; };
  let html = '<h3>Netije we maslahatlar</h3><p class="er-summary">';
  if(!answered) html += 'Synag entek başlanmady: soraglara jogap beriň — netije her jogapdan soň şu ýerde täzelenýär.';
  else if(!done) html += 'Synag dowam edýär: <b>' + answered + ' / ' + n + '</b> soraga jogap berildi, şolardan <b>' + correct + '</b>-si dogry.';
  else { const G = exGrade(pct); html += 'Synag tamamlandy: <b>' + correct + ' / ' + n + '</b> dogry jogap (' + pct + '%). Baha: <span class="er-grade ' + G.cls + '">' + G.txt + '</span>'; }
  html += '</p><div class="table-wrap"><table class="conv"><tr><th>Tema</th><th>Netije</th><th>Ýagdaýy</th></tr>';
  const weak = [];
  order.forEach(id => {
    const t = by[id], T = name(id);
    let st;
    if(!t.a) st = '<span class="st-none">— jogap berilmedi</span>';
    else if(t.c === t.a && t.a === t.n) st = '<span class="st-ok">✓ gowy özleşdirilen</span>';
    else if(t.c === 0){ st = '<span class="st-bad">✗ gaýtalamaly</span>'; weak.push(T); }
    else if(t.c < t.a){ st = '<span class="st-part">⚠ gaýtadan seret</span>'; weak.push(T); }
    else st = '<span class="st-ok">✓ häzirlikçe dogry</span>';
    html += '<tr><td>' + (T.num ? T.num + '. ' : '') + '<a href="' + T.href + '">' + T.name + '</a></td><td><span class="er-bar"><i style="width:' + (t.a ? Math.round(100*t.c/t.n) : 0) + '%"></i></span>' + t.c + ' / ' + t.n + (t.a && t.a < t.n ? ' (jogap: ' + t.a + ')' : '') + '</td><td>' + st + '</td></tr>';
  });
  html += '</table></div>';
  if(weak.length) html += '<p class="er-summary" style="margin-top:8px"><b>Gaýtalamaly sapaklar:</b></p><ul class="er-review">' + weak.map(T => '<li><a href="' + T.href + '">' + (T.num ? T.num + '. ' : '') + T.name + '</a> — sapagyň "Düşünje" we "Mysal" bölümlerini gaýtadan okap, sapagyň testini çöz.</li>').join('') + '</ul>';
  else if(done) html += '<p class="er-summary" style="margin-top:8px">Ähli temalar boýunça dogry jogap berdiň — Kalkulus kursuny üstünlikli tamamladyň! 🎉</p>';
  box.innerHTML = html;
}

function initExam(){
  if(!document.getElementById('exam-report')) return;
  document.addEventListener('kalkulus:quiz', exRender);
  exRender();
}

/* ===== modules/ui/storage.js ===== */
/* localStorage — ähli çagyryşlar goralan (gizlin režim, brauzer petigi). */

/* localStorage — ähli çagyryşlar goralan (private mode, brauzer petigi) */
function lsGet(k){ try{ return window.localStorage.getItem(k); }catch(e){ return null; } }

function lsSet(k, v){ try{ window.localStorage.setItem(k, v); return true; }catch(e){ return false; } }

function lsDel(k){ try{ window.localStorage.removeItem(k); }catch(e){} }

/* ===== modules/ui/progress.js ===== */
/* Sapagyň ösüşi: "öwrenildi" belligi we test netijesi. */

function lessonId(){ return (document.body && document.body.dataset.lesson) || ''; }

function topicLearned(id){ return lsGet('kalkulus_progress_' + id) === '1'; }

function loadQuizState(id){
  try{
    const s = JSON.parse(lsGet('kalkulus_quiz_' + id) || 'null');
    return (s && Array.isArray(s.a) && s.n > 0) ? s : null;
  }catch(e){ return null; }
}

function topicPercent(id){
  const s = loadQuizState(id);
  if(!s) return 0;
  return Math.round(100 * s.a.filter(v => v && v[1] === 1).length / s.n);
}

function renderDone(){
  const id = lessonId(), btn = document.getElementById('doneBtn');
  if(!btn) return;
  const on = topicLearned(id);
  btn.classList.toggle('on', on);
  btn.textContent = on ? '✓ Öwrenildi (belligi aýyrmak üçin bas)' : '✓ Sapagy öwrenildi diýip belle';
  let msg = document.getElementById('doneMsg');
  if(!msg){ msg = document.createElement('span'); msg.id = 'doneMsg'; msg.className = 'done-msg'; btn.insertAdjacentElement('afterend', msg); }
  msg.textContent = on ? 'Bellendi. Ösüşiňi Kalkulus baş sahypasynda görüp bilersiň.' : '';
}

function markDone(){
  const id = lessonId();
  if(!id) return;
  if(topicLearned(id)){ lsDel('kalkulus_progress_' + id); }
  else if(!lsSet('kalkulus_progress_' + id, '1')){
    const msg = document.getElementById('doneMsg');
    if(msg) msg.textContent = 'Brauzer ösüşi ýatda saklamaýar (gizlin režim bolmagy mümkin).';
    return;
  }
  renderDone();
}

/* ===== modules/ui/hub.js ===== */
/* Bölümiň baş sahypasy (kalkulus/index.html): sapaklaryň kartalary we jemi ösüş. */

const LEVEL_ORDER = ['basic','mid','high','univ','extra','exam'];

function cardHtml(t){
  const pct = topicPercent(t.id), learned = topicLearned(t.id);
  const head = '<div class="tc-head"><span class="tc-num">' + t.num + '</span><b>' + t.name + '</b>' + (learned ? '<span class="chk" title="Öwrenildi">✓</span>' : '') + '</div>' +
    '<div class="tc-desc">' + t.desc + '</div>';
  if(!t.ready) return '<div class="topic-card locked">' + head + '<div class="tc-foot">Ýakynda goşular</div></div>';
  return '<a class="topic-card' + (learned ? ' done' : '') + '" href="' + t.href + '">' + head +
    '<div class="tc-bar"><div class="tc-fill" style="width:' + pct + '%"></div></div>' +
    '<div class="tc-foot">' + (pct > 0 ? 'Test: ' + pct + '%' : 'Test entek çözülmedi') + (learned ? ' · öwrenildi' : '') + '</div></a>';
}

function renderTopics(){
  const box = document.getElementById('topic-groups');
  let html = '', learnedCount = 0, sum = 0;
  LEVEL_ORDER.forEach(function(lv){
    const list = KALKULUS_TOPICS.filter(function(t){ return t.level === lv; });
    if(!list.length) return;
    const L = KALKULUS_LEVELS[lv];
    html += '<div class="level-head lvl-' + lv + '">' + L.icon + ' ' + L.name + ' <span class="sub">— ' + L.course + '</span></div><div class="topic-grid">' + list.map(cardHtml).join('') + '</div>';
  });
  KALKULUS_TOPICS.forEach(function(t){ if(topicLearned(t.id)) learnedCount++; sum += topicPercent(t.id); });
  box.innerHTML = html;
  const total = KALKULUS_TOPICS.length, pct = Math.round(sum / total);
  document.getElementById('progress-text').innerHTML = '<b>Jemi ösüş: ' + pct + '%</b> · ' + learnedCount + ' / ' + total + ' sapak öwrenildi';
  document.getElementById('progress-fill').style.width = pct + '%';
  const nextT = KALKULUS_TOPICS.filter(function(t){ return t.ready && !topicLearned(t.id); })[0];
  const link = document.getElementById('continue-link');
  if(nextT){
    link.href = nextT.href;
    link.textContent = (learnedCount === 0 && sum === 0 ? '▶ Başla: ' : '▶ Dowam et: ') + nextT.num + '. ' + nextT.name;
    link.style.display = '';
  } else { link.style.display = 'none'; }
}

/* ===== modules/ui/input-ux.js ===== */
/* Girizmegiň amatlylygy: 1) Enter basylanda kartadaky "Hasapla" düwmesi işleýär; 2) formula meýdanlarynyň aşagynda aňlatmanyň
   owadan görnüşi (ýazylyşyny barlamak üçin) we türkmençe ýalňyşlyk habarlary: haýsy belgide näme ýetmeýär, näbelli funksiýa ýa-da at. */

const UX_ALLOWED = ['x', 'y', 'z', 'n', 't', 'θ', 'e', 'E', 'pi', 'PI', 'tau', 'phi', 'i', 'Infinity', 'inf'];

/* math.js ýalňyşlygyny türkmençä: (char N) → N-nji belgide */
function uxMessage(err, src){
  let m = String(err && err.message || err);
  const pos = /\(char (\d+)\)/.exec(m), at = pos ? ' (' + pos[1] + '-nji belgide)' : '';
  m = m.replace(/\s*\(char \d+\)/, '');
  if(/Unexpected end of expression/i.test(m)) return 'Aňlatma doly däl — soňunda san, üýtgeýji ýa-da ýapylýan skobka ýetmeýär' + at + '.';
  if(/Parenthesis \) expected/i.test(m)) return 'Ýapylýan skobka ")" ýetmeýär' + at + '.';
  if(/Unexpected operator/i.test(m)) return 'Garaşylmadyk amal belgisi' + at + ' — iki amal belgisi yzly-yzyna gelendir ýa-da bir san/üýtgeýji ýetmeýär.';
  if(/Value expected/i.test(m)) return 'Bu ýerde san ýa-da üýtgeýji garaşylýar' + at + '.';
  if(/Unexpected "\)"|Unexpected type/i.test(m)) return 'Artyk ýa-da ýerinde däl skobka' + at + '.';
  if(/Syntax error in part/i.test(m)) return 'Ýazylyşda ýalňyşlyk' + at + '. Köpeltmegi * bilen, derejäni ^ bilen ýazyň: 2*x, x^2.';
  if(/Undefined function/i.test(m)){ const f = /Undefined function (\w+)/.exec(m); return 'Näbelli funksiýa: ' + (f ? f[1] : '') + '. Mysal üçin sin, cos, tan, exp, log (ln), sqrt, abs ulanyň.'; }
  const ch = (src || '').replace(/[0-9a-zA-Z_ .+\-*/^(),πθ√²³⁰¹⁴⁵⁶⁷⁸⁹⁻·×÷−<>=:?!|]/g, '');
  if(ch) return 'Tanalmaýan belgi: «' + ch.charAt(0) + '»' + at + '.';
  return 'Aňlatmany okap bolmady' + at + '.';
}

/* ýazylan aňlatmanyň barlagy: {html, err} */
function uxCheck(src, allowEq){
  const s = String(src || '').trim();
  if(!s) return {html: '', err: false};
  let node;
  try{
    const t = prep(s);
    if(allowEq && /=/.test(t) && !/[<>!]=|==/.test(t)){
      const parts = t.split('=');
      if(parts.length !== 2) throw new Error('Deňlemede diňe bir "=" bolmaly');
      const L = math.parse(parts[0]), R = math.parse(parts[1]);
      node = null;
      return {html: prettyNode(L) + ' = ' + prettyNode(R), err: false, nodes: [L, R]};
    }
    node = math.parse(t);
  }catch(e){ return {html: uxMessage(e, s), err: true}; }
  /* näbelli funksiýalar we atlar */
  const badFn = [], badSym = [];
  node.traverse((c, path, parent) => {
    if(c.type === 'FunctionNode'){ const n = c.fn.name || ''; if(typeof math[n] !== 'function' && badFn.indexOf(n) === -1) badFn.push(n); }
    else if(c.type === 'SymbolNode' && !(parent && parent.type === 'FunctionNode' && path === 'fn')){
      if(UX_ALLOWED.indexOf(c.name) === -1 && typeof math[c.name] !== 'number' && badSym.indexOf(c.name) === -1) badSym.push(c.name);
    }
  });
  if(badFn.length) return {html: 'Näbelli funksiýa: ' + badFn.join(', ') + '. Ulanyp bolýanlar: sin, cos, tan (tg), cot (ctg), asin, acos, atan (arctg), exp, log (ln), log10 (lg), sqrt, cbrt, abs, sinh, cosh, factorial.', err: true};
  if(badSym.length) return {html: 'Näbelli at: ' + badSym.join(', ') + ' — üýtgeýji x (gerek ýerinde y, n, t), hemişelikler pi we e. Köpeltmegi * bilen ýazyň: 2*x, x*y.', err: true};
  let html;
  try{ html = prettyNode(node); }catch(e){ html = ''; }
  return {html, err: false};
}

function uxPreviewFor(input){
  if(input._fxPrev) return input._fxPrev;
  const div = document.createElement('div');
  div.className = 'fx-preview';
  div.setAttribute('aria-live', 'polite');
  input.insertAdjacentElement('afterend', div);
  input._fxPrev = div;
  return div;
}

function uxUpdate(input){
  const div = uxPreviewFor(input), r = uxCheck(input.value, /=/.test(input.value) && /imp-/.test(input.id));
  div.classList.toggle('err', !!r.err);
  if(!r.html){ div.innerHTML = ''; input.removeAttribute('aria-invalid'); }
  else if(r.err){ div.innerHTML = '⚠ ' + r.html; input.setAttribute('aria-invalid', 'true'); }
  else { div.innerHTML = '<span class="fx-lbl">Görnüşi:</span>' + r.html; input.removeAttribute('aria-invalid'); }
  /* görnüş setiri absolýut ýerleşdirilýär (meýdanlaryň deňligi bozulmaz ýaly); setir üçin aşakda ýer goýulýar */
  const row = input.closest ? input.closest('.field-row') : null;
  if(row){
    let h = 0;
    row.querySelectorAll('.fx-preview').forEach(d => { if(getComputedStyle(d).position === 'absolute') h = Math.max(h, d.offsetHeight); });
    row.style.marginBottom = (10 + h + (h ? 4 : 0)) + 'px';
  }
}

function initInputUX(){
  /* 1) Enter → "Hasapla" */
  document.addEventListener('keydown', function(e){
    if(e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    const t = e.target;
    if(!t || t.tagName !== 'INPUT' || !t.closest) return;
    const card = t.closest('.calc-card');
    if(!card) return;
    const row = t.closest('.field-row');
    let btn = row ? row.querySelector('button.run') : null;
    if(!btn) btn = card.querySelector('button.run');
    if(btn){ e.preventDefault(); btn.click(); }
  });
  /* 2) formula meýdanlary: janly görnüş */
  const inputs = Array.prototype.slice.call(document.querySelectorAll('.calc-card .field.grow input[type="text"]')).filter(el => !/pts$/.test(el.id));
  inputs.forEach(el => {
    let tm = null;
    el.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => uxUpdate(el), 140); });
    uxUpdate(el);
  });
}

/* ===== modules/ui/quiz.js ===== */
/* Test: jogaplary barlamak, netijäni ýatda saklamak. */

let _quizState = null;

function quizList(){ return Array.prototype.slice.call(document.querySelectorAll('.quiz-q')); }

function saveQuizState(){ if(_quizState) lsSet('kalkulus_quiz_' + lessonId(), JSON.stringify(_quizState)); }

function optionHtml(btn){
  const c = btn.cloneNode(true), l = c.querySelector('.opt-letter');
  if(l) l.remove();
  return c.innerHTML.trim();
}

function applyAnswer(q, chosen){
  const btns = Array.prototype.slice.call(q.querySelectorAll('.quiz-opts button'));
  q.classList.add('answered');
  btns.forEach(b => { b.disabled = true; if(b.dataset.correct === 'true') b.classList.add('correct'); });
  const picked = btns[chosen], right = btns.filter(b => b.dataset.correct === 'true')[0];
  const ok = !!(picked && picked.dataset.correct === 'true');
  if(picked && !ok) picked.classList.add('wrong');
  const fb = q.querySelector('.quiz-fb');
  fb.innerHTML = '';
  const head = document.createElement('span');
  head.className = ok ? 'fb-ok' : 'fb-bad';
  head.innerHTML = ok ? '✓ <b>Dogry!</b> ' : '✗ <b>Nädogry.</b> <b>Dogry jogap:</b> ' + 'ABCDEF'.charAt(btns.indexOf(right)) + ') ' + (right ? optionHtml(right) : '') + '. ';
  fb.appendChild(head);
  if(q.dataset.explain){
    const why = document.createElement('span');
    why.appendChild(document.createElement('b')).textContent = 'Düşündiriş: ';
    why.appendChild(document.createTextNode(q.dataset.explain));
    fb.appendChild(why);
  }
  return ok;
}

function ensureScoreBox(){
  let box = document.getElementById('quiz-score');
  if(box) return box;
  const qs = quizList();
  if(!qs.length) return null;
  box = document.createElement('div');
  box.id = 'quiz-score'; box.className = 'quiz-score';
  box.innerHTML = '<div class="qs-line"><b class="qs-text"></b><span class="qs-pct"></span></div><div class="qs-bar"><div class="qs-fill"></div></div><div class="qs-msg"></div><button type="button" class="qs-reset">↻ Testi gaýtadan çöz</button>';
  qs[qs.length-1].insertAdjacentElement('afterend', box);
  return box;
}

function renderQuizScore(){
  const qs = quizList(), box = ensureScoreBox();
  if(!box || !_quizState) return;
  const n = qs.length, answered = _quizState.a.filter(v => v).length, correct = _quizState.a.filter(v => v && v[1] === 1).length;
  const pct = Math.round(100*correct/n);
  box.querySelector('.qs-text').textContent = 'Test netijesi: ' + correct + ' / ' + n + (answered < n ? ' (jogap berlen: ' + answered + ')' : '');
  box.querySelector('.qs-pct').textContent = pct + '%';
  box.querySelector('.qs-fill').style.width = pct + '%';
  box.querySelector('.qs-msg').textContent = answered < n ? '' :
    pct === 100 ? 'Ajaýyp! Ähli soraglara dogry jogap berdiň.' :
    pct >= 80 ? 'Gowy netije! Sapagy ýagşy özleşdirdiň.' :
    pct >= 60 ? 'Ýaramaýar, ýöne nädogry jogaplaryň düşündirişlerini gaýtadan oka.' :
    'Sapagy gaýtadan okap, testi ýene bir gezek çöz.';
  box.classList.toggle('complete', answered === n);
  try{ document.dispatchEvent(new CustomEvent('kalkulus:quiz', {detail: {answered, correct, n}})); }catch(e){}   // jemleýji synagyň hasabaty üçin
}

function checkQuiz(btn){
  const q = btn.closest('.quiz-q');
  if(!q || q.classList.contains('answered')) return;
  const qs = quizList(), idx = qs.indexOf(q), btns = Array.prototype.slice.call(q.querySelectorAll('.quiz-opts button'));
  if(!_quizState || _quizState.n !== qs.length) _quizState = {n:qs.length, a:qs.map(() => null)};
  const chosen = btns.indexOf(btn), ok = applyAnswer(q, chosen);
  _quizState.a[idx] = [chosen, ok ? 1 : 0];
  saveQuizState(); renderQuizScore();
}

function resetQuiz(){
  const qs = quizList();
  qs.forEach(q => {
    q.classList.remove('answered');
    q.querySelectorAll('.quiz-opts button').forEach(b => { b.disabled = false; b.classList.remove('correct', 'wrong'); });
    const fb = q.querySelector('.quiz-fb'); if(fb) fb.innerHTML = '';
  });
  _quizState = {n:qs.length, a:qs.map(() => null)};
  saveQuizState(); renderQuizScore();
  if(qs[0]) qs[0].scrollIntoView({behavior:'smooth', block:'center'});
}

function initQuiz(){
  const qs = quizList();
  if(!qs.length) return;
  qs.forEach(q => {
    q.querySelectorAll('.quiz-opts button').forEach((b, i) => {
      if(!b.querySelector('.opt-letter')) b.insertAdjacentHTML('afterbegin', '<span class="opt-letter">' + 'ABCDEF'.charAt(i) + ')</span> ');
    });
  });
  const saved = loadQuizState(lessonId());
  _quizState = (saved && saved.n === qs.length) ? saved : {n:qs.length, a:qs.map(() => null)};
  qs.forEach((q, i) => {
    const s = _quizState.a[i];
    if(s && typeof s[0] === 'number') applyAnswer(q, s[0]);
  });
  const box = ensureScoreBox();
  const rb = box && box.querySelector('.qs-reset');
  if(rb) rb.addEventListener('click', resetQuiz);
  renderQuizScore();
}

/* ===== modules/ui/lesson.js ===== */
/* Sapak sahypasynyň başlangyjy (test + "öwrenildi" düwmesi). */

function initLessonPage(){ initQuiz(); renderDone(); }

/* ===== modules/ui/presets.js ===== */
/* Mysal düwmeleri: data-fill = {meýdan_id: baha, ...}, data-run = çagyrylýan funksiýanyň ady (window-da bolmaly). */

function initPresets(){
  document.addEventListener('click', function(e){
    const b = e.target && e.target.closest ? e.target.closest('button.preset') : null;
    if(!b) return;
    let m = {};
    try{ m = JSON.parse(b.getAttribute('data-fill') || '{}'); }catch(err){ m = {}; }
    let card = null;
    Object.keys(m).forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;
      el.value = m[id];
      if(!card && el.closest) card = el.closest('.calc-card');
      el.dispatchEvent(new Event('input', {bubbles: true}));
      if(el.tagName === 'SELECT') el.dispatchEvent(new Event('change', {bubbles: true}));
    });
    /* saýlanan mysaly bellemek (şol kartadaky beýleki mysallardan belligi aýyrmak) */
    if(card){
      card.querySelectorAll('button.preset.active').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); });
      const twin = b.classList.contains('try') ? Array.prototype.find.call(card.querySelectorAll('button.preset'), x => x.getAttribute('data-fill') === b.getAttribute('data-fill')) : b;
      if(twin){ twin.classList.add('active'); twin.setAttribute('aria-pressed', 'true'); }
      card.dataset.presetLock = '1';
    }
    const fn = b.getAttribute('data-run');
    if(fn && typeof window[fn] === 'function') window[fn]();
    if(card) setTimeout(() => { delete card.dataset.presetLock; }, 0);
    /* mysal gutusyndaky "Kalkulýatorda çöz" düwmesi: kalkulýatora süýşmek we ony ýagtylandyrmak */
    if(b.classList.contains('try') && card){
      try{ card.scrollIntoView({behavior: 'smooth', block: 'start'}); }catch(err){ card.scrollIntoView(); }
      card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
      setTimeout(() => card.classList.remove('flash'), 1600);
    }
  });
  /* meýdan elde üýtgedilse, saýlanan mysalyň belligi aýrylýar */
  document.addEventListener('input', function(e){
    const t = e.target, card = t && t.closest ? t.closest('.calc-card') : null;
    if(!card || card.dataset.presetLock || !e.isTrusted) return;
    card.querySelectorAll('button.preset.active').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); });
  });
}

/* Sahypa açylanda her kalkulýatory öz mysal bahalary bilen bir gezek işledýär: netije we grafik derrew görünýär (boş kanwa galmaýar).
   Ekran okaýjylara bu awtomatik netijeler yglan edilmez ýaly, aria-live wagtlaýyn öçürilýär. */
function runDefaultExamples(){
  const btns = Array.prototype.slice.call(document.querySelectorAll('.calc-card button.run'));
  if(!btns.length) return;
  const live = Array.prototype.slice.call(document.querySelectorAll('.result[aria-live]'));
  live.forEach(el => el.setAttribute('aria-live', 'off'));
  let i = 0;
  const next = function(){
    if(i >= btns.length){ setTimeout(() => live.forEach(el => el.setAttribute('aria-live', 'polite')), 50); return; }
    const b = btns[i++];
    try{ b.click(); }catch(e){}
    setTimeout(next, 0);
  };
  next();
}

/* ===== main.js ===== */
// Sahypalardaky onclick="..." we button.preset[data-run] şu atlary window-dan gözleýär.
Object.assign(window, {
  calcLimit, calcDerivative, calcIntegral, calcIntegralSteps, calcExtrema, calcFunction, calcIntegralApps, calcAntiderivative, calcImproper, calcRiemann, calcImplicit, calcNewton, calcContinuity, calcIVT, checkQuiz, markDone,
  calcSequence, calcCobweb, calcSeries, calcTaylor, calcSurface, calcLimit2D, calcPartial, calcCritical2D,
  calcDouble, calcTriple, dblModeChanged, calcSlopeField, calcODE
});

initPlotResize();
initPlotTheme();
initPresets();
initView3dControls();

document.addEventListener('DOMContentLoaded', function(){
  if(document.querySelector('.calc-card') && !window.math) console.error('math.js ýüklenmedi: sahypanyň front-matter-ine "math: true" goşuň.');
  if(lessonId()) initLessonPage();
  initExam();
  if(document.body.dataset.page === 'hub') renderTopics();
  initInputUX();
  runDefaultExamples();
});

})();
