document.getElementById("searchForm").addEventListener("submit", function(e){ e.preventDefault(); });

/* ---------- Kiçi UX kömekçiler: toast, parol görkez, "ýakynda" düwmeler ---------- */

;
(function(){
  let toastEl = null;
  let toastTimer = null;
  function showToast(msg){
    if (!toastEl){
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role","status");
      toastEl.setAttribute("aria-live","polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(()=> toastEl.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> toastEl.classList.remove("show"), 1800);
  }

  document.querySelectorAll(".soon-link").forEach(function(el){
    el.addEventListener("click", function(e){
      e.preventDefault();
      showToast("Bu bölüm ýakynda goşular ✨");
    });
  });

  document.querySelectorAll(".pass-toggle").forEach(function(btn){
    btn.addEventListener("click", function(){
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const willShow = input.type === "password";
      input.type = willShow ? "text" : "password";
      btn.textContent = willShow ? "🙈" : "👁";
      btn.setAttribute("aria-label", willShow ? "Paroly gizle" : "Paroly görkeziň");
    });
  });
})();

/* ==================================================== */
/* ---- Geometriýa hasaplaýjysynyň mantygy  ---- */
/* ==================================================== */
(function(){
  "use strict";

  /* ==================================================== */
  /* Hasaplama ýadrosy: giriş → barlag → hasaplama → netije → öz-özüni barlamak */
  /* ==================================================== */
/* ---------- 1. Umumy kömekçiler ---------- */
const CONSIST_TOL = 5e-4;          /* tegeleklenen bahalar üçin ygtybarly çäk (ölçegiň 0.05%-i) */
const MIN_VAL = 1e-9, MAX_VAL = 1e9;
const UNITS = {mm:1, cm:10, dm:100, m:1000, km:1000000};
let PREC = 4;
const R2D = 180/Math.PI, D2R = Math.PI/180;
const SEP = '&emsp;';

/* Netijäni matematiki kalkulýator derejesinde formatlamak:
   - artykmaç nollar aýrylýar, uly sanlar toparlanýar, örän uly/kiçi sanlar ylmy görnüşde */
function fmt(n, p, plain){
  if(p === undefined || p === null) p = PREC;
  if(typeof n !== 'number' || !isFinite(n)) return '—';
  if(n === 0 || Math.abs(n) < 1e-300) return '0';
  const abs = Math.abs(n), neg = n < 0;
  let out;
  if(abs >= 1e12 || abs < 1e-6){
    let e = Math.floor(Math.log10(abs));
    let ms = Number((abs / Math.pow(10, e)).toFixed(p));
    if(ms >= 10){ ms = ms / 10; e += 1; }
    out = plain ? (ms + 'e' + e) : (ms + ' × 10<sup>' + e + '</sup>');
  } else {
    const dec = abs < 1 ? p + (-Math.floor(Math.log10(abs)) - 1) : p;
    let s = window.MathSafe ? window.MathSafe.fixed(abs, Math.min(dec, 20)) : abs.toFixed(Math.min(dec, 20));
    if(s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    const parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
    out = parts.join('.');
  }
  return (neg ? '−' : '') + out;
}
function fmtS(n){ return fmt(n, Math.min(PREC, 3), true); }   /* SVG tekstleri üçin */

function parseNum(str){
  if(typeof str !== 'string') return {ok:false, err:'empty'};
  let s = str.trim().replace(/\u2212/g, '-').replace(/\s+/g, '');
  if(s === '') return {ok:false, err:'empty'};
  if(s.indexOf(',') >= 0 && s.indexOf('.') < 0 && s.split(',').length === 2) s = s.replace(',', '.');
  if(!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(s)){ const ex = window.MathSafe && window.MathSafe.evalNumber(str); if(ex !== null && ex !== undefined) return {ok:true, value:ex}; return {ok:false, err:'nan'}; }
  const n = Number(s);
  if(!isFinite(n)) return {ok:false, err:'inf'};
  return {ok:true, value:n};
}

function cancel(x, a, b){ return Math.abs(x) <= 1e-12 * Math.max(Math.abs(a), Math.abs(b)) ? 0 : x; }
function near(x, y, scale){ return Math.abs(x - y) <= CONSIST_TOL * Math.max(scale, 1e-300); }
function hyp(a, b){ return Math.sqrt(a*a + b*b); }
function shoelace(pts){
  let s = 0;
  for(let i = 0; i < pts.length; i++){
    const p = pts[i], q = pts[(i+1) % pts.length];
    s += p[0]*q[1] - q[0]*p[1];
  }
  return Math.abs(s) / 2;
}
function distPts(p, q){ return Math.hypot(p[0]-q[0], p[1]-q[1]); }

function mkCtx(u){
  const su = u ? '\u00A0' + u : '';
  return {
    u: u,
    L: function(x){ return fmt(x) + su; },
    A: function(x){ return fmt(x) + su + (u ? '<sup>2</sup>' : ''); },
    V: function(x){ return fmt(x) + su + (u ? '<sup>3</sup>' : ''); }
  };
}

const MK_OK = '<span class="mk-ok">✔</span>', MK_BAD = '<span class="mk-bad">✖</span>';
function sl(s){ return '<div class="step-line">' + s + '</div>'; }
function newVR(){ return {errors:[], passed:[], notes:[]}; }
function bad(R, title, lines, hint){ R.errors.push({title:title, lines:lines || [], hint:hint || ''}); return R; }
function chk(label, x, y, tol, sc){ return {label:label, x:x, y:y, tol:(tol === undefined ? 1e-9 : tol), sc:sc || 0}; }

/* k·π görnüşinde takyk netije (mümkin bolsa) */
function piForm(k){
  const n3 = Math.round(k*3);
  if(!isFinite(k) || Math.abs(k*3 - n3) > 1e-9 * Math.max(1, Math.abs(k*3))) return null;
  if(n3 % 3 === 0) return fmt(n3/3) + 'π';
  return fmt(n3) + 'π/3';
}
function withPi(k, wrap){
  const f = piForm(k);
  const val = wrap(k * Math.PI);
  return f ? (f + ' ≈ ' + val) : val;
}

/* ---------- 2. Üçburçluk kömekçileri ---------- */
function triAngles(a, b, c){
  const s = (a + b + c) / 2;
  const half = function(x, y, z){          /* x-a garşy burç: tan(X/2) = √((s−y)(s−z)/(s(s−x))) */
    const den = s * (s - x);
    if(den <= 0) return 180;
    return 2 * Math.atan(Math.sqrt(Math.max((s-y)*(s-z), 0) / den)) * R2D;
  };
  return [half(a, b, c), half(b, a, c), half(c, a, b)];
}
function classifyTriangle(a, b, c){
  const t = [a, b, c].sort(function(x, y){ return x - y; });
  const m = t[2];
  const eq = function(x, y){ return Math.abs(x - y) <= 1e-9 * m; };
  const sideType = (eq(t[0], t[1]) && eq(t[1], t[2])) ? 'deň taraply' : (eq(t[0], t[1]) || eq(t[1], t[2])) ? 'deň gapdally' : 'dürli taraply';
  const dd = t[0]*t[0] + t[1]*t[1] - t[2]*t[2];
  const angleType = Math.abs(dd) <= 1e-9 * t[2]*t[2] ? 'dogry burçly' : (dd < 0 ? 'kütek burçly' : 'ýiti burçly');
  return sideType + ', ' + angleType;
}
function triSidesOK(a, b, c){
  const m = Math.max(a, b, c), eps = 1e-9 * m;
  return (a + b - c > eps) && (a + c - b > eps) && (b + c - a > eps);
}
/* Şekil (interaktiw çyzgy) üçin taraplary tapmak */
function sidesOf(mode, v){
  if(mode === 'sss'){
    return triSidesOK(v.a, v.b, v.c) ? {a:v.a, b:v.b, c:v.c} : null;
  }
  if(mode === 'sas'){
    if(!(v.C > 0 && v.C < 180)) return null;
    const cc = Math.pow(v.a - v.b, 2) + 4*v.a*v.b*Math.pow(Math.sin(v.C*D2R/2), 2);
    return cc > 0 ? {a:v.a, b:v.b, c:Math.sqrt(cc)} : null;
  }
  if(mode === 'asa'){
    if(!(v.A > 0 && v.B > 0 && v.A + v.B < 180 - 1e-9)) return null;
    const C = 180 - v.A - v.B, sc = Math.sin(C*D2R);
    return {a:v.c*Math.sin(v.A*D2R)/sc, b:v.c*Math.sin(v.B*D2R)/sc, c:v.c};
  }
  return null;
}

function validateTriSides(a, b, c){
  const R = newVR();
  const m = Math.max(a, b, c), eps = 1e-9 * m;
  const rows = [['a','b','c',a,b,c], ['a','c','b',a,c,b], ['b','c','a',b,c,a]];
  const lines = []; let fail = false;
  rows.forEach(function(r){
    const sum = r[3] + r[4], third = r[5], ok = sum - third > eps;
    if(!ok) fail = true;
    lines.push((ok ? MK_OK : MK_BAD) + ' ' + r[0] + ' + ' + r[1] + ' = ' + fmt(r[3]) + ' + ' + fmt(r[4]) + ' = ' + fmt(sum) + (ok ? ' > ' : ' ≤ ') + r[2] + ' = ' + fmt(third));
  });
  if(!fail){
    R.passed.push('Üçburçlugyň deňsizligi (islendik iki tarapyň jemi üçünji tarapdan uly):');
    lines.forEach(function(l){ R.passed.push(l); });
    return R;
  }
  const arr = [['a',a], ['b',b], ['c',c]].sort(function(x, y){ return y[1] - x[1]; });
  const L = arr[0], s1 = arr[1], s2 = arr[2], sum = s1[1] + s2[1];
  const eqCase = Math.abs(sum - L[1]) <= 1e-12 * L[1];
  const out = ['Üçburçluk bar bolmagy üçin islendik iki tarapyň jemi üçünji tarapdan <b>uly</b> bolmaly:'].concat(lines);
  out.push('Iň uly tarap ' + L[0] + ' = ' + fmt(L[1]) + ', galan ikisiniň jemi ' + s1[0] + ' + ' + s2[0] + ' = ' + fmt(sum) + '.');
  const tiny = !eqCase && (sum - L[1]) > 0 && (sum - L[1]) <= eps;
  out.push(tiny ? 'Tapawut (' + fmt(sum - L[1]) + ') iň uly tarapyň 10⁻⁹ bölegindenem kiçi: şekil praktiki taýdan dogry çyzyga öwrülýär, üçburçluk hasaplanyp bilinmeýär.' : eqCase ? 'Jem uly tarapa deň: üçburçluk dogry çyzyga «ýykylýar» (meýdany 0) — hakyky üçburçluk däl.'
                  : 'Iki gysga tarap uly tarapy ýapmaga ýetmeýär, şonuň üçin ýapyk şekil emele gelmeýär.');
  bad(R, 'Bu taraplardan üçburçluk gurlup bilinmeýär', out,
      L[0] + ' tarap ' + fmt(Math.abs(s1[1] - s2[1])) + ' bilen ' + fmt(sum) + ' aralygynda bolmaly (|' + s1[0] + ' − ' + s2[0] + '| < ' + L[0] + ' < ' + s1[0] + ' + ' + s2[0] + ').');
  return R;
}

function calcTriangle(a, b, c, ctx, o){
  o = o || {};
  const P = a + b + c, s = P / 2;
  const area = Math.sqrt(Math.max(s*(s-a)*(s-b)*(s-c), 0));
  const ang = triAngles(a, b, c), A = ang[0], B = ang[1], C = ang[2];
  const steps = (o.pre || []).slice();
  steps.push(sl('Perimetr: P = a + b + c = ' + fmt(a) + ' + ' + fmt(b) + ' + ' + fmt(c) + ' = ' + ctx.L(P)));
  steps.push(sl('Ýarym-perimetr: s = P / 2 = ' + ctx.L(s)));
  steps.push(sl('Meýdan (Geron formulasy): S = √(s·(s−a)·(s−b)·(s−c)) = √(' + fmt(s) + '×' + fmt(s-a) + '×' + fmt(s-b) + '×' + fmt(s-c) + ') = ' + ctx.A(area)));
  steps.push(sl('Burçlar (kosinuslar teoremasy): A = ' + fmt(A) + '°, &nbsp;B = ' + fmt(B) + '°, &nbsp;C = ' + fmt(C) + '°'));
  steps.push(sl('Görnüşi: ' + classifyTriangle(a, b, c)));
  const ha = 2*area/a, hb = 2*area/b, hc = 2*area/c, Rc = a*b*c/(4*area), rc = area/s;
  const ma = Math.sqrt(2*b*b + 2*c*c - a*a)/2, mb = Math.sqrt(2*a*a + 2*c*c - b*b)/2, mc = Math.sqrt(2*a*a + 2*b*b - c*c)/2;
  steps.push(sl('Beýiklikler: h<sub>a</sub> = 2S/a = ' + ctx.L(ha) + ', &nbsp;h<sub>b</sub> = 2S/b = ' + ctx.L(hb) + ', &nbsp;h<sub>c</sub> = 2S/c = ' + ctx.L(hc)));
  steps.push(sl('Medianalar: m<sub>a</sub> = ½√(2b² + 2c² − a²) = ' + ctx.L(ma) + ', &nbsp;m<sub>b</sub> = ' + ctx.L(mb) + ', &nbsp;m<sub>c</sub> = ' + ctx.L(mc)));
  steps.push(sl('Daşyndan çyzylan tegelegiň radiusy: R = abc / (4S) = ' + ctx.L(Rc) + ' &nbsp;|&nbsp; içinden çyzylan tegelegiň radiusy: r = S / s = ' + ctx.L(rc)));
  const checks = [
    chk('Meýdan: S = ½·a·b·sin C', 0.5*a*b*Math.sin(C*D2R), area, 1e-7),
    chk('Sinuslar teoremasy: a/sin A = b/sin B', a/Math.sin(A*D2R), b/Math.sin(B*D2R), 1e-7),
    chk('Sinuslar teoremasy: b/sin B = c/sin C', b/Math.sin(B*D2R), c/Math.sin(C*D2R), 1e-7),
    chk('Burçlaryň jemi: A + B + C = 180°', A + B + C, 180, 1e-9),
    chk('Sinuslar teoremasy: a / sin A = 2R', a/Math.sin(A*D2R), 2*Rc, 1e-7),
    chk('Beýiklik: h_a = b·sin C', b*Math.sin(C*D2R), ha, 1e-7),
    chk('Medianalar: m_a² + m_b² + m_c² = ¾(a² + b² + c²)', ma*ma + mb*mb + mc*mc, 0.75*(a*a + b*b + c*c), 1e-7),
    chk('Eýleriň deňsizligi: R ≥ 2r', Math.max(Rc, 2*rc), Rc, 1e-9)
  ];
  return {title:o.title, steps:steps, area:area,
    answer:'Meýdan S = ' + ctx.A(area) + SEP + 'Perimetr P = ' + ctx.L(P),
    checks:checks, values:[P, s, area, A, B, C]};
}

/* ---------- 3. Trapesiýanyň barlagy ---------- */
function trapConfigs(a, b, h, c, d){
  const scale = Math.max(a, b, h, c, d);
  const res = {scale:scale, legOK:true, p:NaN, q:NaN, e:Math.abs(a - b), cfgs:[]};
  const tol = CONSIST_TOL * scale;
  if(c < h - tol || d < h - tol){ res.legOK = false; return res; }
  const p = Math.sqrt(Math.max(c*c - h*h, 0));     /* c (sag gapdal) proýeksiýasy */
  const q = Math.sqrt(Math.max(d*d - h*h, 0));     /* d (çep gapdal) proýeksiýasy */
  res.p = p; res.q = q;
  const diff = a - b;
  [[1,1], [1,-1], [-1,1], [-1,-1]].forEach(function(ts){
    const t = ts[0], s = ts[1];
    if(near(diff, t*q - s*p, scale)) res.cfgs.push({t:t, s:s, x1:t*q});
  });
  return res;
}
function legSuggest(h, e, other){          /* «other» gapdalyň proýeksiýasy berlende, ikinji gapdal üçin mümkin bahalar */
  const qs = [e - other, other - e, e + other].filter(function(x){ return x >= 0; });
  const out = [];
  qs.forEach(function(q){
    const v = Math.sqrt(h*h + q*q);
    if(!out.some(function(o){ return Math.abs(o - v) < 1e-9 * Math.max(v, 1); })) out.push(v);
  });
  return out;
}

/* ---------- 4. ÝASY ŞEKILLER ---------- */
const FLAT = {};

FLAT.triangle_sss = {
  fields:[{id:'a', label:'a tarap', kind:'len'}, {id:'b', label:'b tarap', kind:'len'}, {id:'c', label:'c tarap', kind:'len'}],
  defaults:{a:3, b:4, c:5}, note:'Üçburçlugyň deňsizligi barlanýar: islendik iki tarapyň jemi üçünji tarapdan uly bolmaly.',
  fig:'tri3', figMode:'sss',
  validate:function(v){ return validateTriSides(v.a, v.b, v.c); },
  calc:function(v, ctx){ return calcTriangle(v.a, v.b, v.c, ctx, {title:'Üçburçluk (3 tarap)'}); }
};

FLAT.triangle_sas = {
  fields:[{id:'a', label:'a tarap', kind:'len'}, {id:'b', label:'b tarap', kind:'len'}, {id:'C', label:'Aralaryndaky burç (C)', kind:'angle'}],
  defaults:{a:5, b:7, C:60}, note:'Iki tarap we olaryň arasyndaky burç. Üçünji tarap kosinuslar teoremasy bilen tapylýar.',
  fig:'tri3', figMode:'sas',
  validate:function(v){
    const R = newVR();
    if(v.C >= 180){
      return bad(R, 'Burç 180°-dan kiçi bolmaly', [
        'Girizilen burç C = ' + fmt(v.C) + '° ≥ 180°.',
        'Üçburçlugyň bir burçy 180°-a ýetip ýa-da geçip bilmez: 180°-da iki tarap bir çyzyga öwrülýär, 180°-dan uly burçda bolsa şekil ýapylmaýar.'
      ], '0° < C < 180° aralygynda burç saýlaň.');
    }
    R.passed.push('Burç 0° < C < 180° aralygynda: C = ' + fmt(v.C) + '° ' + MK_OK);
    R.passed.push('Iki tarap we olaryň arasyndaky burç üçburçlugy bir manyly kesgitleýär (SAS) ' + MK_OK);
    return R;
  },
  calc:function(v, ctx){
    const a = v.a, b = v.b, C = v.C;
    const cc = Math.pow(a - b, 2) + 4*a*b*Math.pow(Math.sin(C*D2R/2), 2);
    const c = Math.sqrt(cc);
    const pre = [
      sl('Üçünji tarap (kosinuslar teoremasy): c² = a² + b² − 2·a·b·cos C = ' + fmt(a*a) + ' + ' + fmt(b*b) + ' − 2×' + fmt(a) + '×' + fmt(b) + '×cos(' + fmt(C) + '°) = ' + fmt(cc)),
      sl('c = √' + fmt(cc) + ' = ' + ctx.L(c))
    ];
    const r = calcTriangle(a, b, c, ctx, {title:'Üçburçluk (2 tarap we burç)', pre:pre});
    r.checks.push(chk('Meýdan: S = ½·a·b·sin C (berlen burçdan gönüden-göni)', 0.5*a*b*Math.sin(C*D2R), r.area, 1e-7));
    r.values.push(c);
    return r;
  }
};

FLAT.triangle_asa = {
  fields:[{id:'A', label:'A burç', kind:'angle'}, {id:'B', label:'B burç', kind:'angle'}, {id:'c', label:'Aralaryndaky tarap (c)', kind:'len'}],
  defaults:{A:50, B:60, c:8}, note:'Iki burç we olaryň arasyndaky tarap. Üçünji burç 180° − A − B bilen, taraplar sinuslar teoremasy bilen tapylýar.',
  fig:'tri3', figMode:'asa',
  validate:function(v){
    const R = newVR(), sum = v.A + v.B;
    if(sum >= 180 - 1e-9){
      return bad(R, 'Bu burçlardan üçburçluk gurlup bilinmeýär', [
        'Üçburçlugyň burçlarynyň jemi 180° bolmaly.',
        'A + B = ' + fmt(v.A) + '° + ' + fmt(v.B) + '° = ' + fmt(sum) + '° ' + MK_BAD + ' (180°-dan kiçi bolmaly)',
        'Üçünji burç C = 180° − ' + fmt(sum) + '° = ' + fmt(180 - sum) + '° bolardy — ol položitel däl, ýagny şeýle üçburçluk ýok.'
      ], 'A + B jemi 180°-dan kiçi bolmaly (mysal üçin A = ' + fmt(Math.min(v.A, 60)) + '°, B = ' + fmt(Math.min(v.B, 60)) + '°).');
    }
    R.passed.push('A + B = ' + fmt(v.A) + '° + ' + fmt(v.B) + '° = ' + fmt(sum) + '° < 180° ' + MK_OK);
    R.passed.push('Üçünji burç C = 180° − A − B = ' + fmt(180 - sum) + '° > 0° ' + MK_OK);
    return R;
  },
  calc:function(v, ctx){
    const A = v.A, B = v.B, c = v.c, C = 180 - A - B, sc = Math.sin(C*D2R);
    const a = c*Math.sin(A*D2R)/sc, b = c*Math.sin(B*D2R)/sc;
    const pre = [
      sl('Üçünji burç: C = 180° − A − B = 180° − ' + fmt(A) + '° − ' + fmt(B) + '° = ' + fmt(C) + '°'),
      sl('Sinuslar teoremasy: a = c·sin A / sin C = ' + ctx.L(a) + ', &nbsp;b = c·sin B / sin C = ' + ctx.L(b))
    ];
    const r = calcTriangle(a, b, c, ctx, {title:'Üçburçluk (2 burç we tarap)', pre:pre});
    r.values.push(a, b);
    return r;
  }
};

FLAT.triangle_bh = {
  fields:[{id:'base', label:'Esas (b)', kind:'len'}, {id:'height', label:'Beýiklik (h)', kind:'len'}],
  defaults:{base:6, height:4}, note:'Diňe meýdan hasaplanýar — perimetr üçin ähli taraplaryň uzynlygy gerek. Ýaldaw nokady gapdala süýşürseňiz meýdan üýtgemeýär.',
  fig:'tribh', figMode:'',
  validate:function(){
    const R = newVR();
    R.passed.push('Esas we beýiklik islendik položitel bahada üçburçlugy kesgitleýär ' + MK_OK);
    return R;
  },
  calc:function(v, ctx){
    const b = v.base, h = v.height, S = 0.5*b*h;
    return {title:'Üçburçluk (esas we beýiklik)',
      steps:[sl('Meýdan: S = ½ · b · h = ½ × ' + fmt(b) + ' × ' + fmt(h) + ' = ' + ctx.A(S))],
      answer:'Meýdan S = ' + ctx.A(S),
      checks:[chk('Meýdan (koordinatalar / Gauss formulasy)', shoelace([[0,0], [b,0], [b/2,h]]), S)],
      values:[S]};
  }
};

FLAT.square = {
  fields:[{id:'side', label:'Tarap (a)', kind:'len'}], defaults:{side:5}, note:'',
  fig:'square', figMode:'',
  validate:function(){ const R = newVR(); R.passed.push('Tarap položitel ' + MK_OK); return R; },
  calc:function(v, ctx){
    const a = v.side, P = 4*a, S = a*a, d = a*Math.SQRT2;
    return {title:'Inedördül',
      steps:[
        sl('Perimetr: P = 4a = 4 × ' + fmt(a) + ' = ' + ctx.L(P)),
        sl('Meýdan: S = a² = ' + fmt(a) + '² = ' + ctx.A(S)),
        sl('Diagonal: d = a√2 = ' + fmt(a) + ' × ' + fmt(Math.SQRT2) + ' = ' + ctx.L(d))],
      answer:'Perimetr P = ' + ctx.L(P) + SEP + 'Meýdan S = ' + ctx.A(S) + SEP + 'Diagonal d = ' + ctx.L(d),
      checks:[chk('Meýdan: S = d² / 2', d*d/2, S), chk('Diagonal: d = √(a² + a²) (Pifagor)', hyp(a, a), d),
              chk('Meýdan (Gauss formulasy)', shoelace([[0,0], [a,0], [a,a], [0,a]]), S)],
      values:[P, S, d]};
  }
};

FLAT.rectangle = {
  fields:[{id:'w', label:'Uzynlyk (a)', kind:'len'}, {id:'h', label:'Ini (b)', kind:'len'}], defaults:{w:6, h:4}, note:'',
  fig:'rect', figMode:'',
  validate:function(){ const R = newVR(); R.passed.push('Uzynlyk we ini položitel ' + MK_OK); return R; },
  calc:function(v, ctx){
    const a = v.w, b = v.h, P = 2*(a + b), S = a*b, d = hyp(a, b);
    return {title:'Gönüburçluk',
      steps:[
        sl('Perimetr: P = 2(a + b) = 2 × (' + fmt(a) + ' + ' + fmt(b) + ') = ' + ctx.L(P)),
        sl('Meýdan: S = a · b = ' + fmt(a) + ' × ' + fmt(b) + ' = ' + ctx.A(S)),
        sl('Diagonal: d = √(a² + b²) = √(' + fmt(a*a) + ' + ' + fmt(b*b) + ') = ' + ctx.L(d))],
      answer:'Perimetr P = ' + ctx.L(P) + SEP + 'Meýdan S = ' + ctx.A(S) + SEP + 'Diagonal d = ' + ctx.L(d),
      checks:[chk('Diagonal: d² = a² + b²', d*d, a*a + b*b), chk('Meýdan (Gauss formulasy)', shoelace([[0,0], [a,0], [a,b], [0,b]]), S)],
      values:[P, S, d]};
  }
};

FLAT.parallelogram = {
  fields:[{id:'base', label:'Esas (b)', kind:'len'}, {id:'height', label:'Beýiklik (h)', kind:'len'}, {id:'side', label:'Gapdal tarap (a)', kind:'len'}],
  defaults:{base:6, height:4, side:5}, note:'Gapdal tarap beýiklikden gysga bolup bilmez (a ≥ h).',
  fig:'para', figMode:'',
  validate:function(v){
    const R = newVR(), a = v.side, h = v.height, b = v.base;
    if(a < h - 1e-9 * Math.max(a, h)){
      return bad(R, 'Bu ölçeglerden parallelogram gurlup bilinmeýär', [
        'Beýiklik h — gapdal tarapdan esasa düşürilen perpendikulýar. Ol a gapdal tarap bilen gönüburçly üçburçlugy düzýär: a gipotenuza, h katet.',
        'Gipotenuza katetden gysga bolup bilmez: a ≥ h.',
        'Ýöne a = ' + fmt(a) + ' < h = ' + fmt(h) + ' ' + MK_BAD
      ], 'Gapdal tarap a iň az ' + fmt(h) + ' bolmaly (a = h bolsa parallelogram gönüburçluga öwrülýär), ýa-da beýiklik h ' + fmt(a) + '-dan kiçi bolmaly.');
    }
    R.passed.push('Gapdal tarap ≥ beýiklik: a = ' + fmt(a) + ' ≥ h = ' + fmt(h) + ' ' + MK_OK);
    const skew = Math.sqrt(Math.max(a*a - h*h, 0));
    R.passed.push('Gapdal tarapyň esasdaky proýeksiýasy: √(a² − h²) = √(' + fmt(a*a) + ' − ' + fmt(h*h) + ') = ' + fmt(skew) + ' ' + MK_OK);
    if(skew <= 1e-9 * a) R.notes.push('a = h: gapdal tarap esasa perpendikulýar — bu parallelogram aslynda gönüburçluk.');
    return R;
  },
  calc:function(v, ctx){
    const b = v.base, h = v.height, a = v.side;
    const P = 2*(a + b), S = b*h;
    const skew = Math.sqrt(Math.max(a*a - h*h, 0));
    const alpha = Math.asin(Math.min(1, h/a)) * R2D, beta = 180 - alpha;
    const d1 = hyp(b + skew, h), d2 = hyp(b - skew, h);
    return {title:'Parallelogram',
      steps:[
        sl('Perimetr: P = 2(a + b) = 2 × (' + fmt(a) + ' + ' + fmt(b) + ') = ' + ctx.L(P)),
        sl('Meýdan: S = b · h = ' + fmt(b) + ' × ' + fmt(h) + ' = ' + ctx.A(S)),
        sl('Burçlar: sin α = h / a = ' + fmt(h/a) + ' ⇒ α = ' + fmt(alpha) + '°, &nbsp;β = 180° − α = ' + fmt(beta) + '°'),
        sl('Diagonallar: d₁ = ' + ctx.L(d1) + ', &nbsp;d₂ = ' + ctx.L(d2))],
      answer:'Perimetr P = ' + ctx.L(P) + SEP + 'Meýdan S = ' + ctx.A(S),
      checks:[chk('Meýdan: S = a·b·sin α', a*b*Math.sin(alpha*D2R), S, 1e-7),
              chk('Parallelogramyň düzgüni: d₁² + d₂² = 2(a² + b²)', d1*d1 + d2*d2, 2*(a*a + b*b), 1e-9),
              chk('Meýdan (Gauss formulasy)', shoelace([[0,0], [b,0], [b+skew,h], [skew,h]]), S)],
      values:[P, S, alpha, d1, d2]};
  }
};

FLAT.trapezoid = {
  fields:[{id:'a', label:'Aşaky esas (a)', kind:'len'}, {id:'b', label:'Ýokarky esas (b)', kind:'len'}, {id:'h', label:'Beýiklik (h)', kind:'len'},
          {id:'c', label:'Sag gapdal (c)', kind:'len'}, {id:'d', label:'Çep gapdal (d)', kind:'len'}],
  defaults:{a:10, b:4, h:4, c:5, d:5},
  note:'a we b — parallel taraplar (esaslar). Ähli 5 ölçegiň hakykatdanam bir trapesiýa degişlidigi barlanýar. Çyzgydaky nokatlary süýşürseňiz gapdallar özi hasaplanýar.',
  fig:'trap', figMode:'',
  validate:function(v){
    const R = newVR(), a = v.a, b = v.b, h = v.h, c = v.c, d = v.d;
    const T = trapConfigs(a, b, h, c, d);
    if(!T.legOK){
      const lines = [
        'Her gapdal tarap h beýiklik bilen gönüburçly üçburçlugy düzýär: gapdal — gipotenuza, h — katet. Gipotenuza katetden gysga bolup bilmez.',
        (c >= h ? MK_OK : MK_BAD) + ' c = ' + fmt(c) + (c >= h ? ' ≥ ' : ' < ') + 'h = ' + fmt(h),
        (d >= h ? MK_OK : MK_BAD) + ' d = ' + fmt(d) + (d >= h ? ' ≥ ' : ' < ') + 'h = ' + fmt(h)
      ];
      return bad(R, 'Bu ölçeglerden trapesiýa gurlup bilinmeýär', lines,
        'Gapdal taraplaryň ikisi hem beýiklikden (h = ' + fmt(h) + ') gysga bolmaly däl; ýa-da h-ny kiçeldiň.');
    }
    const e = T.e, p = T.p, q = T.q;
    const lines = [
      'Beýiklik h esaslara perpendikulýar. Her gapdal tarap gipotenuza bolýar, onuň gorizontal kateti — gapdalyň esasdaky proýeksiýasy:',
      'c gapdalyň proýeksiýasy: p = √(c² − h²) = √(' + fmt(c*c) + ' − ' + fmt(h*h) + ') = ' + fmt(p),
      'd gapdalyň proýeksiýasy: q = √(d² − h²) = √(' + fmt(d*d) + ' − ' + fmt(h*h) + ') = ' + fmt(q),
      'Esaslaryň tapawudy: e = |a − b| = |' + fmt(a) + ' − ' + fmt(b) + '| = ' + fmt(e),
      'Trapesiýa emele gelmegi üçin diňe iki mümkinçilik bar: <b>e = p + q</b> (iki gapdal hem içe ýapyşýar) ýa-da <b>e = |p − q|</b> (bir gapdal daşa ýapyşýar).'
    ];
    const s1 = p + q, s2 = Math.abs(p - q);
    if(!T.cfgs.length){
      lines.push('p + q = ' + fmt(s1) + ', &nbsp;|p − q| = ' + fmt(s2) + ', &nbsp;e = ' + fmt(e) + ' ⇒ e ikisine hem deň däl ' + MK_BAD);
      lines.push('Diýmek, çep we sag gapdal taraplar esaslar bilen ýapylmaýar — şeýle trapesiýa ýok.');
      const dOpt = legSuggest(h, e, p), cOpt = legSuggest(h, e, q);
      let hint = 'a, b, h we c üýtgewsiz galsa, <b>d = ' + dOpt.map(function(x){ return fmt(x); }).join('</b> ýa-da <b>d = ') + '</b> bolmaly.';
      hint += ' Ýa-da a, b, h we d üýtgewsiz galsa, <b>c = ' + cOpt.map(function(x){ return fmt(x); }).join('</b> ýa-da <b>c = ') + '</b> bolmaly.';
      return bad(R, 'Bu ölçeglerden trapesiýa gurlup bilinmeýär', lines, hint);
    }
    R.passed = lines.slice(1, 4);
    R.passed.push('e = ' + fmt(e) + ' &nbsp;vs&nbsp; p + q = ' + fmt(s1) + ', &nbsp;|p − q| = ' + fmt(s2) + ' ⇒ ' + (near(e, s1, T.scale) ? 'e = p + q' : 'e = |p − q|') + ' ' + MK_OK + ' (trapesiýa bar)');
    const worst = Math.min.apply(null, [Math.abs(e - s1), Math.abs(e - s2)]);
    if(worst > 1e-9 * T.scale) R.notes.push('Ölçegler takyk däl (tegeleklenen bahalar ýaly): ýalňyşlyk ≈ ' + fmt(worst) + ', bu ölçegiň ' + fmt(worst / T.scale * 100, 3) + '%-i — kabul edildi.');
    if(Math.abs(a - b) <= 1e-9 * T.scale) R.notes.push('a = b: bu trapesiýa aslynda parallelogram.');
    return R;
  },
  calc:function(v, ctx){
    const a = v.a, b = v.b, h = v.h, c = v.c, d = v.d;
    const T = trapConfigs(a, b, h, c, d);
    const cfg = T.cfgs[0], x1 = cfg.x1;
    const pts = [[0,0], [a,0], [x1 + b, h], [x1, h]];
    const m = (a + b)/2, S = m*h, P = a + b + c + d;
    const d1 = distPts(pts[0], pts[2]), d2 = distPts(pts[1], pts[3]);
    const isIso = Math.abs(c - d) <= CONSIST_TOL * T.scale;
    const rightAngled = T.p <= CONSIST_TOL * T.scale || T.q <= CONSIST_TOL * T.scale;
    const kind = (Math.abs(a - b) <= 1e-9 * T.scale) ? 'parallelogram' : (isIso ? 'deň gapdally trapesiýa' : (rightAngled ? 'gönüburçly trapesiýa' : 'dürli gapdally trapesiýa'));
    return {title:'Trapesiýa',
      steps:[
        sl('Orta çyzyk: m = (a + b) / 2 = (' + fmt(a) + ' + ' + fmt(b) + ') / 2 = ' + ctx.L(m)),
        sl('Meýdan: S = (a + b)/2 · h = ' + fmt(m) + ' × ' + fmt(h) + ' = ' + ctx.A(S)),
        sl('Perimetr: P = a + b + c + d = ' + fmt(a) + ' + ' + fmt(b) + ' + ' + fmt(c) + ' + ' + fmt(d) + ' = ' + ctx.L(P)),
        sl('Diagonallar (gurlan şekilden): d₁ = ' + ctx.L(d1) + ', &nbsp;d₂ = ' + ctx.L(d2)),
        sl('Görnüşi: ' + kind)],
      answer:'Meýdan S = ' + ctx.A(S) + SEP + 'Perimetr P = ' + ctx.L(P),
      checks:[chk('Meýdan: gurlan şekiliň koordinatalary boýunça (Gauss)', shoelace(pts), S, 1e-9),
              chk('Perimetr: gurlan şekiliň gapdallary berlen c, d bilen gabat gelýär', distPts(pts[0], pts[1]) + distPts(pts[1], pts[2]) + distPts(pts[2], pts[3]) + distPts(pts[3], pts[0]), P, 4*CONSIST_TOL)],
      values:[m, S, P, d1, d2]};
  }
};

FLAT.rhombus = {
  fields:[{id:'d1', label:'1-nji diagonal', kind:'len'}, {id:'d2', label:'2-nji diagonal', kind:'len'}],
  defaults:{d1:6, d2:8}, note:'Tarap uzynlygy diagonallardan awtomatiki hasaplanýar.',
  fig:'rhomb', figMode:'',
  validate:function(){ const R = newVR(); R.passed.push('Diagonallar položitel — romb bir manyly kesgitlenýär ' + MK_OK); return R; },
  calc:function(v, ctx){
    const d1 = v.d1, d2 = v.d2, S = d1*d2/2, a = 0.5*hyp(d1, d2), P = 4*a;
    const al = 2*Math.atan(d2/d1)*R2D, be = 2*Math.atan(d1/d2)*R2D;
    return {title:'Romb',
      steps:[
        sl('Meýdan: S = d₁ · d₂ / 2 = ' + fmt(d1) + ' × ' + fmt(d2) + ' / 2 = ' + ctx.A(S)),
        sl('Tarap: a = √((d₁/2)² + (d₂/2)²) = √(' + fmt(d1/2) + '² + ' + fmt(d2/2) + '²) = ' + ctx.L(a)),
        sl('Perimetr: P = 4a = 4 × ' + fmt(a) + ' = ' + ctx.L(P)),
        sl('Burçlar: ' + fmt(al) + '° we ' + fmt(be) + '°')],
      answer:'Meýdan S = ' + ctx.A(S) + SEP + 'Perimetr P = ' + ctx.L(P) + SEP + 'Tarap a = ' + ctx.L(a),
      checks:[chk('Meýdan: S = a²·sin α', a*a*Math.sin(Math.min(al, be)*D2R), S, 1e-9),
              chk('Diagonallar: d₁² + d₂² = 4a²', d1*d1 + d2*d2, 4*a*a),
              chk('Meýdan (Gauss formulasy)', shoelace([[d1/2,0], [0,d2/2], [-d1/2,0], [0,-d2/2]]), S)],
      values:[S, a, P, al, be]};
  }
};

FLAT.circle = {
  fields:[{id:'r', label:'Radius (r)', kind:'len'}], defaults:{r:5}, note:'Diametri bar bolsa, ony 2-ä bölüp radiusy ýazyň.',
  fig:'circle', figMode:'',
  validate:function(){ const R = newVR(); R.passed.push('Radius položitel ' + MK_OK); return R; },
  calc:function(v, ctx){
    const r = v.r, C = 2*Math.PI*r, S = Math.PI*r*r, dia = 2*r;
    return {title:'Tegelek',
      steps:[
        sl('Diametr: d = 2r = ' + ctx.L(dia)),
        sl('Aýlaw uzynlygy: C = 2πr = 2 × π × ' + fmt(r) + ' = ' + withPi(2*r, ctx.L)),
        sl('Meýdan: S = πr² = π × ' + fmt(r) + '² = ' + withPi(r*r, ctx.A))],
      answer:'Aýlaw C = ' + withPi(2*r, ctx.L) + SEP + 'Meýdan S = ' + withPi(r*r, ctx.A),
      checks:[chk('Meýdan: S = C·r / 2', C*r/2, S), chk('Meýdan: S = π·d² / 4', Math.PI*dia*dia/4, S)],
      values:[C, S, dia]};
  }
};

FLAT.regular_polygon = {
  fields:[{id:'n', label:'Taraplaryň sany (n)', kind:'int', min:3, max:1000}, {id:'side', label:'Tarapyň uzynlygy (a)', kind:'len'}],
  defaults:{n:6, side:4}, note:'n diňe bitin san bolmaly: 3, 4, 5, 6 … (iň köp 1000). Kesir sanlar (mysal üçin 5.7) kabul edilmeýär.',
  fig:'poly', figMode:'',
  validate:function(v){
    const R = newVR();
    R.passed.push('n = ' + fmt(v.n) + ' — bitin san, 3 ≤ n ≤ 1000 ' + MK_OK);
    return R;
  },
  calc:function(v, ctx){
    const n = v.n, a = v.side, t = Math.tan(Math.PI/n);
    const P = n*a, apo = a/(2*t), S = n*a*a/(4*t), Rc = a/(2*Math.sin(Math.PI/n));
    const inner = (n - 2)*180/n;
    const pts = []; for(let i = 0; i < n; i++){ const th = Math.PI/2 + 2*Math.PI*i/n; pts.push([Rc*Math.cos(th), Rc*Math.sin(th)]); }
    return {title:'Dogry ' + n + '-burçluk',
      steps:[
        sl('Perimetr: P = n · a = ' + fmt(n) + ' × ' + fmt(a) + ' = ' + ctx.L(P)),
        sl('Meýdan: S = n·a² / (4·tan(180°/n)) = ' + fmt(n) + ' × ' + fmt(a*a) + ' / (4 × ' + fmt(t) + ') = ' + ctx.A(S)),
        sl('Içki çyzylan tegelegiň radiusy (apofema): r = a / (2·tan(180°/n)) = ' + ctx.L(apo)),
        sl('Daşky çyzylan tegelegiň radiusy: R = a / (2·sin(180°/n)) = ' + ctx.L(Rc)),
        sl('Içki burç: (n − 2)·180° / n = ' + fmt(inner) + '°')],
      answer:'Perimetr P = ' + ctx.L(P) + SEP + 'Meýdan S = ' + ctx.A(S),
      checks:[chk('Meýdan: S = ½ · P · r', 0.5*P*apo, S, 1e-9),
              chk('Meýdan (depeleriň koordinatalary boýunça, Gauss)', shoelace(pts), S, 1e-8),
              chk('Tarap: depeleriň arasyndaky aralyk = a', distPts(pts[0], pts[1]), a, 1e-9)],
      values:[P, S, apo, Rc, inner]};
  }
};

/* ---------- 5. GÖWRÜMLI ŞEKILLER ---------- */
/* ---------- Täze ýasy şekiller: sektor/segment, halka, ellips ---------- */
FLAT.sector = {
  fields:[{id:'r', label:'Radius (r)', kind:'len'}, {id:'A', label:'Merkezi burç (α)', kind:'angle'}],
  defaults:{r:6, A:75}, note:'Tegelegiň bölegi: radius we merkezi burç boýunça sektoryň meýdany, ýaýynyň uzynlygy, hordasy we segmenti hasaplanýar.',
  fig:'sector', figMode:'',
  validate:function(v){ const R = newVR(); if(!(v.A > 0 && v.A < 360)) return bad(R, 'Merkezi burç 0° bilen 360° aralygynda bolmaly', ['α = ' + fmt(v.A) + '°'], '0° < α < 360° bahany giriziň.'); R.passed.push('0° < α < 360° ' + MK_OK); return R; },
  calc:function(v, ctx){
    const r = v.r, A = v.A, th = A*D2R, arc = r*th, S = 0.5*r*r*th, ch = 2*r*Math.sin(th/2), seg = S - 0.5*r*r*Math.sin(th), P = 2*r + arc;
    return {title:'Tegelegiň sektory we segmenti',
      steps:[
        sl('Ýaýyň uzynlygy: l = 2πr·α/360° = ' + withPi(2*r*A/360, ctx.L)),
        sl('Sektoryň meýdany: S = πr²·α/360° = ' + withPi(r*r*A/360, ctx.A)),
        sl('Sektoryň perimetri: P = 2r + l = ' + ctx.L(P)),
        sl('Horda: c = 2r·sin(α/2) = ' + ctx.L(ch)),
        sl('Segmentiň meýdany: S<sub>seg</sub> = ½r²(θ − sin θ) = S − ½r²·sin α = ' + ctx.A(seg)),
        sl('Tegelegiň galan böleginiň (' + fmt(360 - A) + '°) meýdany: ' + withPi(r*r*(360 - A)/360, ctx.A))],
      answer:'Ýaý l = ' + withPi(2*r*A/360, ctx.L) + SEP + 'Meýdan S = ' + withPi(r*r*A/360, ctx.A),
      checks:[chk('Meýdan: S = l·r / 2', arc*r/2, S), chk('Horda: c² = 2r²(1 − cos α)', ch*ch, 2*r*r*(1 - Math.cos(th)), 1e-9), chk('Sektoryň paýy: S / (πr²) = α / 360°', S/(Math.PI*r*r), A/360)]};
  }
};
FLAT.annulus = {
  fields:[{id:'R', label:'Daşky radius (R)', kind:'len'}, {id:'r', label:'Içki radius (r)', kind:'len'}],
  defaults:{R:8, r:5}, note:'Umumy merkezli iki tegelegiň arasyndaky halka: daşky radius içki radiusdan uly bolmaly.',
  fig:'ring', figMode:'',
  validate:function(v){ const R = newVR(); if(!(v.R > v.r)) return bad(R, 'Daşky radius içki radiusdan uly bolmaly', ['R = ' + fmt(v.R) + ', r = ' + fmt(v.r)], 'R > r bolar ýaly bahalary giriziň.'); R.passed.push('R > r ' + MK_OK); return R; },
  calc:function(v, ctx){
    const Ro = v.R, r = v.r, S = Math.PI*(Ro*Ro - r*r), w = Ro - r, mid = (Ro + r)/2;
    return {title:'Halka (iki tegelegiň arasy)',
      steps:[
        sl('Halkanyň giňligi: w = R − r = ' + fmt(Ro) + ' − ' + fmt(r) + ' = ' + ctx.L(w)),
        sl('Meýdan: S = π(R² − r²) = π(R − r)(R + r) = ' + withPi(Ro*Ro - r*r, ctx.A)),
        sl('Iki aýlawyň jemi uzynlygy: P = 2π(R + r) = ' + withPi(2*(Ro + r), ctx.L)),
        sl('Orta aýlawyň uzynlygy: 2π·(R + r)/2 = ' + withPi(Ro + r, ctx.L) + ' — meýdan = orta aýlaw × giňlik')],
      answer:'Meýdan S = ' + withPi(Ro*Ro - r*r, ctx.A) + SEP + 'Giňlik w = ' + ctx.L(w),
      checks:[chk('Meýdan: S = πR² − πr²', Math.PI*Ro*Ro - Math.PI*r*r, S), chk('Meýdan: S = (orta aýlaw) × w', 2*Math.PI*mid*w, S)]};
  }
};
FLAT.ellipse = {
  fields:[{id:'a', label:'Ýarym ok (a)', kind:'len'}, {id:'b', label:'Ýarym ok (b)', kind:'len'}],
  defaults:{a:7, b:4}, note:'Ellips: a we b — iki ýarym ok. Perimetri Ramanujanyň formulasy bilen tapylýar we sanly integral bilen barlanýar.',
  fig:'ellipse', figMode:'',
  validate:function(){ const R = newVR(); R.passed.push('Ýarym oklar položitel ' + MK_OK); return R; },
  calc:function(v, ctx){
    const a = v.a, b = v.b, mj = Math.max(a, b), mn = Math.min(a, b), S = Math.PI*a*b, h = Math.pow((a - b)/(a + b), 2);
    const P = Math.PI*(a + b)*(1 + 3*h/(10 + Math.sqrt(4 - 3*h))), c = Math.sqrt(mj*mj - mn*mn), e = c/mj;
    const N = 4000, dt = (Math.PI/2)/N; let I = 0;
    for(let i = 0; i <= N; i++){ const t = i*dt, f = Math.sqrt(a*a*Math.sin(t)*Math.sin(t) + b*b*Math.cos(t)*Math.cos(t)); I += ((i === 0 || i === N) ? 1 : (i % 2 ? 4 : 2))*f; }
    const Pint = 4*I*dt/3;
    return {title:'Ellips',
      steps:[
        sl('Meýdan: S = π·a·b = ' + withPi(a*b, ctx.A)),
        sl('Perimetr (Ramanujan): P ≈ π(a + b)·[1 + 3h / (10 + √(4 − 3h))], &nbsp;h = ((a − b)/(a + b))² = ' + fmt(h) + ' ⇒ P ≈ ' + ctx.L(P)),
        sl('Fokus aralygy: c = √(a² − b²) = ' + ctx.L(c) + ', &nbsp;eksentrisitet: e = c / ' + (a >= b ? 'a' : 'b') + ' = ' + fmt(e))],
      answer:'Meýdan S = ' + withPi(a*b, ctx.A) + SEP + 'Perimetr P ≈ ' + ctx.L(P),
      checks:[chk('Perimetr: Ramanujan formulasy ≈ sanly integral (Simpson)', P, Pint, 1e-4), chk('Fokus: a² = b² + c²', mj*mj, mn*mn + c*c)]};
  }
};
/* ---------- Formulalar (saýlanan şekil üçin gysga maglumat) ---------- */
const FORMULAS = {
  triangle:'S = ½·a·h<sub>a</sub> = √(s(s−a)(s−b)(s−c)) = ½ab·sin C ; a / sin A = b / sin B = c / sin C = 2R ; c² = a² + b² − 2ab·cos C ; r = S / s',
  square:'S = a² ; P = 4a ; d = a√2', rectangle:'S = a·b ; P = 2(a + b) ; d = √(a² + b²)', parallelogram:'S = a·h<sub>a</sub> = ab·sin α ; P = 2(a + b)',
  trapezoid:'S = ½(a + b)·h ; P = a + b + c + d ; orta çyzyk m = (a + b)/2', rhombus:'S = ½·d₁·d₂ = a²·sin α ; P = 4a ; a = ½√(d₁² + d₂²)',
  circle:'C = 2πr ; S = πr² ; d = 2r', regular_polygon:'P = n·a ; S = n·a² / (4·tan(180°/n)) ; r = a / (2·tan(180°/n)) ; R = a / (2·sin(180°/n)) ; içki burç = (n − 2)·180° / n',
  sector:'l = πrα / 180° ; S = πr²α / 360° ; c = 2r·sin(α/2) ; S<sub>seg</sub> = ½r²(θ − sin θ), θ = α·π/180°', annulus:'S = π(R² − r²) ; P = 2π(R + r)',
  ellipse:'S = π·a·b ; P ≈ π(a + b)(1 + 3h / (10 + √(4 − 3h))), h = ((a − b)/(a + b))² ; e = √(1 − b²/a²)',
  cube:'V = a³ ; S = 6a² ; d = a√3', cuboid:'V = a·b·c ; S = 2(ab + bc + ca) ; d = √(a² + b² + c²)', sphere:'V = 4πr³ / 3 ; S = 4πr²', cylinder:'V = πr²h ; S<sub>ýanky</sub> = 2πrh ; S = 2πr(r + h)',
  frustum:'l = √(h² + (R − r)²) ; V = πh(R² + Rr + r²) / 3 ; S<sub>ýanky</sub> = π(R + r)l ; S = π(R² + r²) + π(R + r)l', prism:'S<sub>esas</sub> = n·a² / (4·tan(180°/n)) ; V = S<sub>esas</sub>·h ; S<sub>ýanky</sub> = n·a·h ; S = 2S<sub>esas</sub> + n·a·h', torus:'V = 2π²Rr² ; S = 4π²Rr ; a = R − r (içki radius) ; b = R + r (daşky radius)', cone:'l = √(r² + h²) ; V = πr²h / 3 ; S<sub>ýanky</sub> = πrl ; S = πr(r + l)', pyramid:'V = a²h / 3 ; l = √(h² + a²/4) ; e = √(h² + a²/2) ; S = a² + 2al',
  distance:'d = √((x₂ − x₁)² + (y₂ − y₁)²)', midpoint:'M = ((x₁ + x₂)/2 ; (y₁ + y₂)/2)', slope:'m = (y₂ − y₁) / (x₂ − x₁) ; y = m·x + b', triangle_pts:'S = ½|x₁(y₂ − y₃) + x₂(y₃ − y₁) + x₃(y₁ − y₂)|'
};
const SOLID = {};

SOLID.cube = {
  fields:[{id:'a', label:'Gyra (a)', kind:'len'}], defaults:{a:4}, note:'', fig:'cube', figMode:'',
  validate:function(){ const R = newVR(); R.passed.push('Gyra položitel ' + MK_OK); return R; },
  calc:function(v, ctx){
    const a = v.a, V = a*a*a, S = 6*a*a, df = a*Math.SQRT2, ds = a*Math.sqrt(3);
    return {title:'Kub',
      steps:[
        sl('Göwrüm: V = a³ = ' + fmt(a) + '³ = ' + ctx.V(V)),
        sl('Doly ýer ýüzi: S = 6a² = 6 × ' + fmt(a*a) + ' = ' + ctx.A(S)),
        sl('Ýüzüň diagonaly: a√2 = ' + ctx.L(df) + ', &nbsp;giňişleýin diagonal: a√3 = ' + ctx.L(ds))],
      answer:'Göwrüm V = ' + ctx.V(V) + SEP + 'Ýer ýüzi S = ' + ctx.A(S),
      checks:[chk('Göwrüm: V = D³ / (3√3) (giňişleýin diagonal D arkaly)', Math.pow(ds, 3)/(3*Math.sqrt(3)), V),
              chk('Ýer ýüzi: S = 2·D² (giňişleýin diagonal D arkaly)', 2*ds*ds, S)],
      values:[V, S, df, ds]};
  }
};

SOLID.cuboid = {
  fields:[{id:'a', label:'Uzynlyk (a)', kind:'len'}, {id:'b', label:'Ini (b)', kind:'len'}, {id:'c', label:'Beýiklik (c)', kind:'len'}],
  defaults:{a:4, b:3, c:2}, note:'', fig:'cuboid', figMode:'',
  validate:function(){ const R = newVR(); R.passed.push('Üç ölçeg hem položitel ' + MK_OK); return R; },
  calc:function(v, ctx){
    const a = v.a, b = v.b, c = v.c, V = a*b*c, S = 2*(a*b + b*c + a*c), D = Math.sqrt(a*a + b*b + c*c);
    return {title:'Gönüburçluklaýyn parallelepiped',
      steps:[
        sl('Göwrüm: V = a·b·c = ' + fmt(a) + ' × ' + fmt(b) + ' × ' + fmt(c) + ' = ' + ctx.V(V)),
        sl('Doly ýer ýüzi: S = 2(ab + bc + ac) = 2 × (' + fmt(a*b) + ' + ' + fmt(b*c) + ' + ' + fmt(a*c) + ') = ' + ctx.A(S)),
        sl('Giňişleýin diagonal: D = √(a² + b² + c²) = ' + ctx.L(D))],
      answer:'Göwrüm V = ' + ctx.V(V) + SEP + 'Ýer ýüzi S = ' + ctx.A(S),
      checks:[chk('Ýer ýüzi: S = 2·(esasyň ýüzi) + (esasyň perimetri)·c', 2*a*b + 2*(a + b)*c, S),
              chk('Diagonal: D² = a² + b² + c²', D*D, a*a + b*b + c*c)],
      values:[V, S, D]};
  }
};

SOLID.sphere = {
  fields:[{id:'r', label:'Radius (r)', kind:'len'}], defaults:{r:3}, note:'', fig:'sphere', figMode:'',
  validate:function(){ const R = newVR(); R.passed.push('Radius položitel ' + MK_OK); return R; },
  calc:function(v, ctx){
    const r = v.r, V = 4/3*Math.PI*r*r*r, S = 4*Math.PI*r*r;
    return {title:'Şar',
      steps:[
        sl('Göwrüm: V = (4/3)πr³ = (4/3) × π × ' + fmt(r*r*r) + ' = ' + withPi(4*r*r*r/3, ctx.V)),
        sl('Ýer ýüzi: S = 4πr² = 4 × π × ' + fmt(r*r) + ' = ' + withPi(4*r*r, ctx.A))],
      answer:'Göwrüm V = ' + withPi(4*r*r*r/3, ctx.V) + SEP + 'Ýer ýüzi S = ' + withPi(4*r*r, ctx.A),
      checks:[chk('Göwrüm: V = S·r / 3', S*r/3, V), chk('Göwrüm: V = π·d³ / 6 (diametr d arkaly)', Math.PI*Math.pow(2*r, 3)/6, V)],
      values:[V, S]};
  }
};

SOLID.cylinder = {
  fields:[{id:'r', label:'Radius (r)', kind:'len'}, {id:'h', label:'Beýiklik (h)', kind:'len'}],
  defaults:{r:3, h:5}, note:'', fig:'cylinder', figMode:'',
  validate:function(){ const R = newVR(); R.passed.push('Radius we beýiklik položitel ' + MK_OK); return R; },
  calc:function(v, ctx){
    const r = v.r, h = v.h, base = Math.PI*r*r, lat = 2*Math.PI*r*h, V = base*h, S = 2*base + lat;
    return {title:'Silindr',
      steps:[
        sl('Esasyň ýüzi: πr² = ' + withPi(r*r, ctx.A)),
        sl('Gapdal ýüzi: 2πrh = ' + withPi(2*r*h, ctx.A)),
        sl('Göwrüm: V = πr²h = π × ' + fmt(r*r) + ' × ' + fmt(h) + ' = ' + withPi(r*r*h, ctx.V)),
        sl('Doly ýer ýüzi: S = 2πr(r + h) = ' + withPi(2*r*(r + h), ctx.A))],
      answer:'Göwrüm V = ' + withPi(r*r*h, ctx.V) + SEP + 'Ýer ýüzi S = ' + withPi(2*r*(r + h), ctx.A),
      checks:[chk('Ýer ýüzi: S = 2·(esasyň ýüzi) + gapdal ýüzi', 2*base + lat, 2*Math.PI*r*(r + h)),
              chk('Göwrüm: V = (gapdal ýüzi)·r / 2', lat*r/2, V)],
      values:[V, S, base, lat]};
  }
};

SOLID.cone = {
  modes:{
    rh:{label:'r we h (radius, beýiklik)', fields:[{id:'r', label:'Radius (r)', kind:'len'}, {id:'h', label:'Beýiklik (h)', kind:'len'}], defaults:{r:3, h:4}},
    rl:{label:'r we l (radius, egri beýiklik)', fields:[{id:'r', label:'Radius (r)', kind:'len'}, {id:'l', label:'Egri beýiklik (l)', kind:'len'}], defaults:{r:3, l:5}},
    hl:{label:'h we l (beýiklik, egri beýiklik)', fields:[{id:'h', label:'Beýiklik (h)', kind:'len'}, {id:'l', label:'Egri beýiklik (l)', kind:'len'}], defaults:{h:4, l:5}},
    rhl:{label:'r, h we l (üçüsi — laýyklyk barlagy)', fields:[{id:'r', label:'Radius (r)', kind:'len'}, {id:'h', label:'Beýiklik (h)', kind:'len'}, {id:'l', label:'Egri beýiklik (l)', kind:'len'}], defaults:{r:3, h:4, l:5}}
  },
  note:'r, h we l özara l² = r² + h² bilen baglanyşykly. Käbir iki ölçegi ýa-da ählisini girizip, laýyklygy barlatmak bolýar.',
  fig:'cone',
  resolve:function(v, mode){
    if(mode === 'rl') return {r:v.r, h:Math.sqrt(v.l*v.l - v.r*v.r), l:v.l};
    if(mode === 'hl') return {r:Math.sqrt(v.l*v.l - v.h*v.h), h:v.h, l:v.l};
    return {r:v.r, h:v.h, l:hyp(v.r, v.h)};
  },
  validate:function(v, ctx, mode){
    const R = newVR();
    if(mode === 'rl' || mode === 'hl'){
      const x = mode === 'rl' ? v.r : v.h, nm = mode === 'rl' ? 'r' : 'h', lname = mode === 'rl' ? 'radius' : 'beýiklik';
      if(v.l <= x*(1 + 1e-9)){
        return bad(R, 'Bu ölçeglerden konus gurlup bilinmeýär', [
          'l — konusyň egri beýikligi (emele getiriji). Ol r, h ýa-da kateti we gipotenuzasy l bolan gönüburçly üçburçlugyň gipotenuzasy: l² = r² + h².',
          'Gipotenuza islendik katetden <b>uly</b> bolmaly: l > ' + nm + '.',
          'Ýöne l = ' + fmt(v.l) + ' ≤ ' + nm + ' = ' + fmt(x) + ' ' + MK_BAD
        ], 'Egri beýiklik l ' + fmt(x) + '-den uly bolmaly (mysal üçin l > ' + fmt(x) + ').');
      }
      const other = Math.sqrt(v.l*v.l - x*x), on = mode === 'rl' ? 'h' : 'r';
      R.passed.push('l > ' + nm + ': ' + fmt(v.l) + ' > ' + fmt(x) + ' ' + MK_OK);
      R.passed.push('Üçünji ölçeg: ' + on + ' = √(l² − ' + nm + '²) = √(' + fmt(v.l*v.l) + ' − ' + fmt(x*x) + ') = ' + fmt(other));
      return R;
    }
    if(mode === 'rhl'){
      const lc = hyp(v.r, v.h), sc = Math.max(v.r, v.h, v.l);
      if(!near(v.l, lc, sc)){
        return bad(R, 'Girizilen ölçegler biri-birine laýyk däl', [
          'Konusda ähli ölçegler l² = r² + h² baglanyşygy bilen baglanyşykly.',
          'r² + h² = ' + fmt(v.r*v.r) + ' + ' + fmt(v.h*v.h) + ' = ' + fmt(v.r*v.r + v.h*v.h) + ' ⇒ l = √' + fmt(v.r*v.r + v.h*v.h) + ' = ' + fmt(lc),
          'Ýöne girizilen l = ' + fmt(v.l) + ' ≠ ' + fmt(lc) + ' ' + MK_BAD
        ], 'l = ' + fmt(lc) + ' ýazyň, ýa-da r ýa-da h-ny üýtgediň. (r we h berlen bolsa, l-i girizmek hökmany däl: «r we h» görnüşini saýlaň.)');
      }
      R.passed.push('l² = r² + h²: ' + fmt(v.l*v.l) + ' ≈ ' + fmt(v.r*v.r + v.h*v.h) + ' ' + MK_OK + ' (ölçegler laýyk)');
      if(Math.abs(v.l - lc) > 1e-9*sc) R.notes.push('Ölçegler takyk däl (tegeleklenen bahalar ýaly): l girizilen ' + fmt(v.l) + ', hasaplanan ' + fmt(lc) + ' — kabul edildi.');
      return R;
    }
    R.passed.push('Radius we beýiklik položitel ' + MK_OK);
    return R;
  },
  calc:function(v, ctx, mode){
    const q = SOLID.cone.resolve(v, mode), r = q.r, h = q.h, l = q.l;
    const pre = [];
    if(mode === 'rl') pre.push(sl('Beýiklik: h = √(l² − r²) = √(' + fmt(l*l) + ' − ' + fmt(r*r) + ') = ' + ctx.L(h)));
    if(mode === 'hl') pre.push(sl('Radius: r = √(l² − h²) = √(' + fmt(l*l) + ' − ' + fmt(h*h) + ') = ' + ctx.L(r)));
    if(mode === 'rh' || mode === 'rhl') pre.push(sl('Egri beýiklik: l = √(r² + h²) = √(' + fmt(r*r) + ' + ' + fmt(h*h) + ') = ' + ctx.L(l)));
    const base = Math.PI*r*r, lat = Math.PI*r*l, V = base*h/3, S = base + lat;
    return {title:'Konus',
      steps:pre.concat([
        sl('Esasyň ýüzi: πr² = ' + withPi(r*r, ctx.A)),
        sl('Gapdal ýüzi: πrl = π × ' + fmt(r) + ' × ' + fmt(l) + ' = ' + ctx.A(lat)),
        sl('Göwrüm: V = (1/3)πr²h = (1/3) × π × ' + fmt(r*r) + ' × ' + fmt(h) + ' = ' + withPi(r*r*h/3, ctx.V)),
        sl('Doly ýer ýüzi: S = πr(r + l) = ' + ctx.A(S))]),
      answer:'Göwrüm V = ' + withPi(r*r*h/3, ctx.V) + SEP + 'Ýer ýüzi S = ' + ctx.A(S),
      checks:[chk('Egri beýiklik: l² = r² + h²', l*l, r*r + h*h),
              chk('Göwrüm: V = (1/3) × (esasy r we beýikligi h bolan silindriň göwrümi)', Math.PI*r*r*h/3, V),
              chk('Ýer ýüzi: S = πr(r + l)', Math.PI*r*(r + l), S)],
      values:[r, h, l, V, S, lat]};
  }
};

SOLID.pyramid = {
  modes:{
    ah:{label:'a we h (esas, beýiklik)', fields:[{id:'a', label:'Esasyň tarapy (a)', kind:'len'}, {id:'h', label:'Beýiklik (h)', kind:'len'}], defaults:{a:4, h:3}},
    al:{label:'a we l (esas, ýanky beýiklik)', fields:[{id:'a', label:'Esasyň tarapy (a)', kind:'len'}, {id:'l', label:'Ýanky beýiklik (l)', kind:'len'}], defaults:{a:4, l:3.6056}},
    ae:{label:'a we e (esas, ýanky gapyrga)', fields:[{id:'a', label:'Esasyň tarapy (a)', kind:'len'}, {id:'e', label:'Ýanky gapyrga (e)', kind:'len'}], defaults:{a:4, e:4.1231}},
    ahl:{label:'a, h we l (laýyklyk barlagy)', fields:[{id:'a', label:'Esasyň tarapy (a)', kind:'len'}, {id:'h', label:'Beýiklik (h)', kind:'len'}, {id:'l', label:'Ýanky beýiklik (l)', kind:'len'}], defaults:{a:4, h:3, l:3.6056}}
  },
  note:'Dogry inedördül piramida. l — ýanky ýüzüň beýikligi (apofema): l² = h² + (a/2)². e — ýanky gapyrga: e² = h² + a²/2.',
  fig:'pyramid',
  resolve:function(v, mode){
    if(mode === 'al') return {a:v.a, h:Math.sqrt(v.l*v.l - v.a*v.a/4)};
    if(mode === 'ae') return {a:v.a, h:Math.sqrt(v.e*v.e - v.a*v.a/2)};
    return {a:v.a, h:v.h};
  },
  validate:function(v, ctx, mode){
    const R = newVR(), a = v.a;
    if(mode === 'al'){
      if(v.l <= a/2*(1 + 1e-9)){
        return bad(R, 'Bu ölçeglerden piramida gurlup bilinmeýär', [
          'Ýanky ýüzüň beýikligi l — gipotenuza, esasyň ýarym tarapy a/2 — katet, piramidanyň h beýikligi — ikinji katet (l² = h² + (a/2)²).',
          'Gipotenuza katetden uly bolmaly: l > a/2 = ' + fmt(a/2),
          'Ýöne l = ' + fmt(v.l) + ' ≤ ' + fmt(a/2) + ' ' + MK_BAD
        ], 'l ' + fmt(a/2) + '-den uly bolmaly.');
      }
      R.passed.push('l > a/2: ' + fmt(v.l) + ' > ' + fmt(a/2) + ' ' + MK_OK);
      R.passed.push('Beýiklik: h = √(l² − (a/2)²) = √(' + fmt(v.l*v.l) + ' − ' + fmt(a*a/4) + ') = ' + fmt(Math.sqrt(v.l*v.l - a*a/4)));
      return R;
    }
    if(mode === 'ae'){
      const lim = a/Math.SQRT2;
      if(v.e <= lim*(1 + 1e-9)){
        return bad(R, 'Bu ölçeglerden piramida gurlup bilinmeýär', [
          'Ýanky gapyrga e — gipotenuza, esasyň ýarym diagonaly a/√2 — katet, beýiklik h — ikinji katet (e² = h² + a²/2).',
          'Gipotenuza katetden uly bolmaly: e > a/√2 = ' + fmt(lim),
          'Ýöne e = ' + fmt(v.e) + ' ≤ ' + fmt(lim) + ' ' + MK_BAD
        ], 'e ' + fmt(lim) + '-den uly bolmaly.');
      }
      R.passed.push('e > a/√2: ' + fmt(v.e) + ' > ' + fmt(lim) + ' ' + MK_OK);
      R.passed.push('Beýiklik: h = √(e² − a²/2) = √(' + fmt(v.e*v.e) + ' − ' + fmt(a*a/2) + ') = ' + fmt(Math.sqrt(v.e*v.e - a*a/2)));
      return R;
    }
    if(mode === 'ahl'){
      const lc = Math.sqrt(v.h*v.h + a*a/4), sc = Math.max(a, v.h, v.l);
      if(!near(v.l, lc, sc)){
        return bad(R, 'Girizilen ölçegler biri-birine laýyk däl', [
          'Piramidada a, h we l ölçegler l² = h² + (a/2)² bilen baglanyşykly.',
          'h² + (a/2)² = ' + fmt(v.h*v.h) + ' + ' + fmt(a*a/4) + ' = ' + fmt(v.h*v.h + a*a/4) + ' ⇒ l = ' + fmt(lc),
          'Ýöne girizilen l = ' + fmt(v.l) + ' ≠ ' + fmt(lc) + ' ' + MK_BAD
        ], 'l = ' + fmt(lc) + ' ýazyň, ýa-da a ýa-da h-ny üýtgediň.');
      }
      R.passed.push('l² = h² + (a/2)²: ' + fmt(v.l*v.l) + ' ≈ ' + fmt(v.h*v.h + a*a/4) + ' ' + MK_OK + ' (ölçegler laýyk)');
      if(Math.abs(v.l - lc) > 1e-9*sc) R.notes.push('Ölçegler takyk däl (tegeleklenen bahalar ýaly): l girizilen ' + fmt(v.l) + ', hasaplanan ' + fmt(lc) + ' — kabul edildi.');
      return R;
    }
    R.passed.push('Esasyň tarapy we beýiklik položitel ' + MK_OK);
    return R;
  },
  calc:function(v, ctx, mode){
    const q = SOLID.pyramid.resolve(v, mode), a = q.a, h = q.h;
    const pre = [];
    if(mode === 'al') pre.push(sl('Beýiklik: h = √(l² − (a/2)²) = ' + ctx.L(h)));
    if(mode === 'ae') pre.push(sl('Beýiklik: h = √(e² − a²/2) = ' + ctx.L(h)));
    const l = Math.sqrt(h*h + a*a/4), e = Math.sqrt(h*h + a*a/2);
    const base = a*a, lat = 2*a*l, V = base*h/3, S = base + lat;
    return {title:'Piramida (inedördül esasly)',
      steps:pre.concat([
        sl('Ýanky ýüzüň beýikligi (apofema): l = √(h² + (a/2)²) = ' + ctx.L(l) + ', &nbsp;ýanky gapyrga: e = √(h² + a²/2) = ' + ctx.L(e)),
        sl('Esasyň ýüzi: a² = ' + ctx.A(base)),
        sl('Gapdal ýüzi: 4 × (½ · a · l) = 2al = ' + ctx.A(lat)),
        sl('Göwrüm: V = (1/3)·a²·h = (1/3) × ' + fmt(base) + ' × ' + fmt(h) + ' = ' + ctx.V(V)),
        sl('Doly ýer ýüzi: S = a² + 2al = ' + ctx.A(S))]),
      answer:'Göwrüm V = ' + ctx.V(V) + SEP + 'Ýer ýüzi S = ' + ctx.A(S),
      checks:[chk('Ýanky ýüzde Pifagor: e² = l² + (a/2)²', e*e, l*l + a*a/4),
              chk('Ýer ýüzi: S = a² + 4·(½·a·l)', base + 4*(0.5*a*l), S),
              chk('Göwrüm: V = a²·h / 3', a*a*h/3, V)],
      values:[h, l, e, V, S]};
  }
};

SOLID.frustum = {
  modes:{
    Rrh:{label:'R, r we h (radiuslar, beýiklik)', fields:[{id:'R', label:'Uly esasyň radiusy (R)', kind:'len'}, {id:'r', label:'Kiçi esasyň radiusy (r)', kind:'len'}, {id:'h', label:'Beýiklik (h)', kind:'len'}], defaults:{R:5, r:2, h:4}},
    Rrl:{label:'R, r we l (radiuslar, egri beýiklik)', fields:[{id:'R', label:'Uly esasyň radiusy (R)', kind:'len'}, {id:'r', label:'Kiçi esasyň radiusy (r)', kind:'len'}, {id:'l', label:'Egri beýiklik (l)', kind:'len'}], defaults:{R:5, r:2, l:5}}
  },
  note:'Kesik konus (konus kesigi): l² = h² + (R − r)². Uly esasyň radiusy R kiçisinden r uly bolmaly (R = r bolsa, bu silindr).',
  fig:'frustum',
  resolve:function(v, mode){
    const d = v.R - v.r;
    return mode === 'Rrl' ? {R:v.R, r:v.r, h:Math.sqrt(v.l*v.l - d*d), l:v.l} : {R:v.R, r:v.r, h:v.h, l:hyp(v.h, d)};
  },
  validate:function(v, ctx, mode){
    const R = newVR(), d = v.R - v.r;
    if(d <= 1e-9*v.R){
      return bad(R, 'Bu ölçeglerden kesik konus gurlup bilinmeýär', ['Uly esasyň radiusy R kiçisinden r uly bolmaly: R > r.', 'Ýöne R = ' + fmt(v.R) + ' ≤ r = ' + fmt(v.r) + ' ' + MK_BAD], 'R-i r-den uly ýazyň.');
    }
    R.passed.push('R > r: ' + fmt(v.R) + ' > ' + fmt(v.r) + ' ' + MK_OK);
    if(mode === 'Rrl'){
      if(v.l <= d*(1 + 1e-9)){
        return bad(R, 'Bu ölçeglerden kesik konus gurlup bilinmeýär', ['l — gipotenuza, R − r we h — katetler: l² = h² + (R − r)².', 'Gipotenuza katetden uly bolmaly: l > R − r = ' + fmt(d), 'Ýöne l = ' + fmt(v.l) + ' ≤ ' + fmt(d) + ' ' + MK_BAD], 'Egri beýiklik l ' + fmt(d) + '-den uly bolmaly.');
      }
      R.passed.push('l > R − r: ' + fmt(v.l) + ' > ' + fmt(d) + ' ' + MK_OK);
    } else R.passed.push('Beýiklik položitel ' + MK_OK);
    return R;
  },
  calc:function(v, ctx, mode){
    const q = SOLID.frustum.resolve(v, mode), R = q.R, r = q.r, h = q.h, l = q.l, pi = Math.PI, d2 = (R - r)*(R - r);
    const pre = mode === 'Rrl' ? [sl('Beýiklik: h = √(l² − (R − r)²) = √(' + fmt(l*l) + ' − ' + fmt(d2) + ') = ' + ctx.L(h))]
                               : [sl('Egri beýiklik: l = √(h² + (R − r)²) = √(' + fmt(h*h) + ' + ' + fmt(d2) + ') = ' + ctx.L(l))];
    const q3 = R*R + R*r + r*r, V = pi*h*q3/3, lat = pi*(R + r)*l, S = pi*(R*R + r*r) + lat;
    const H = h*R/(R - r), Hs = H - h;
    return {title:'Kesik konus (konus kesigi)',
      steps:pre.concat([
        sl('Esaslaryň ýüzleri: πR² = ' + withPi(R*R, ctx.A) + ', &nbsp;πr² = ' + withPi(r*r, ctx.A)),
        sl('Gapdal ýüzi: π(R + r)l = π × ' + fmt(R + r) + ' × ' + fmt(l) + ' = ' + ctx.A(lat)),
        sl('Göwrüm: V = (1/3)πh(R² + Rr + r²) = (1/3) × π × ' + fmt(h) + ' × ' + fmt(q3) + ' = ' + withPi(h*q3/3, ctx.V)),
        sl('Doly ýer ýüzi: S = π(R² + r²) + π(R + r)l = ' + ctx.A(S))]),
      answer:'Göwrüm V = ' + withPi(h*q3/3, ctx.V) + SEP + 'Ýer ýüzi S = ' + ctx.A(S),
      checks:[chk('Egri beýiklik: l² = h² + (R − r)²', l*l, h*h + d2),
              chk('Göwrüm: V = (doly konusyň göwrümi) − (kesilen kiçi konusyň göwrümi)', pi*R*R*H/3 - pi*r*r*Hs/3, V),
              chk('Gapdal ýüzi: πR·L − πr·l′ (doly we kesilen konuslaryň gapdal ýüzleriniň tapawudy)', pi*R*hyp(R, H) - pi*r*hyp(r, Hs), lat)],
      values:[R, r, h, l, V, S, lat]};
  }
};

SOLID.prism = {
  fields:[{id:'n', label:'Esasyň taraplarynyň sany (n)', kind:'int', min:3, max:1000}, {id:'a', label:'Esasyň tarapy (a)', kind:'len'}, {id:'h', label:'Beýiklik (h)', kind:'len'}],
  defaults:{n:6, a:3, h:5}, note:'Dogry prizma: esasy dogry n-burçluk, gapdal gapyrgalary esasa perpendikulýar. n diňe bitin san bolmaly (3 ≤ n ≤ 1000).', fig:'prism', figMode:'',
  validate:function(v){ const R = newVR(); R.passed.push('n = ' + fmt(v.n) + ' — bitin san, 3 ≤ n ≤ 1000 ' + MK_OK); R.passed.push('Esasyň tarapy we beýiklik položitel ' + MK_OK); return R; },
  calc:function(v, ctx){
    const n = v.n, a = v.a, h = v.h, t = Math.tan(Math.PI/n), Sb = n*a*a/(4*t), apo = a/(2*t), Rc = a/(2*Math.sin(Math.PI/n));
    const P = n*a, lat = P*h, V = Sb*h, S = 2*Sb + lat;
    return {title:'Dogry ' + n + '-burçly prizma',
      steps:[
        sl('Esasyň ýüzi: S<sub>esas</sub> = n·a² / (4·tan(180°/n)) = ' + fmt(n) + ' × ' + fmt(a*a) + ' / (4 × ' + fmt(t) + ') = ' + ctx.A(Sb)),
        sl('Gapdal ýüzi: S<sub>gapdal</sub> = n·a·h = ' + fmt(n) + ' × ' + fmt(a) + ' × ' + fmt(h) + ' = ' + ctx.A(lat)),
        sl('Göwrüm: V = S<sub>esas</sub>·h = ' + fmt(Sb) + ' × ' + fmt(h) + ' = ' + ctx.V(V)),
        sl('Doly ýer ýüzi: S = 2·S<sub>esas</sub> + S<sub>gapdal</sub> = ' + ctx.A(S))],
      answer:'Göwrüm V = ' + ctx.V(V) + SEP + 'Ýer ýüzi S = ' + ctx.A(S),
      checks:[chk('Esasyň ýüzi: S = P·r / 2 (P — perimetr, r — apofema)', P*apo/2, Sb),
              chk('Esasyň ýüzi: S = n·R²·sin(360°/n) / 2 (R — daşky radius)', n*Rc*Rc*Math.sin(2*Math.PI/n)/2, Sb),
              chk('Göwrüm: V = (P·r / 2)·h', P*apo/2*h, V)],
      values:[Sb, lat, V, S, apo, Rc]};
  }
};

SOLID.torus = {
  modes:{
    Rr:{label:'R we r (turbanyň oky, turbanyň radiusy)', fields:[{id:'R', label:'Merkezden turbanyň ortasyna çenli (R)', kind:'len'}, {id:'r', label:'Turbanyň radiusy (r)', kind:'len'}], defaults:{R:5, r:2}},
    io:{label:'a we b (içki, daşky radius)', fields:[{id:'a', label:'Içki radius (a = R − r)', kind:'len'}, {id:'b', label:'Daşky radius (b = R + r)', kind:'len'}], defaults:{a:3, b:7}}
  },
  note:'Tor (simit): R — merkezden turbanyň ortasyna çenli uzaklyk, r — turbanyň radiusy. Halka görnüşli tor üçin R > r bolmaly.',
  fig:'torus',
  resolve:function(v, mode){ return mode === 'io' ? {R:(v.a + v.b)/2, r:(v.b - v.a)/2} : {R:v.R, r:v.r}; },
  validate:function(v, ctx, mode){
    const R = newVR();
    if(mode === 'io'){
      if(v.b <= v.a*(1 + 1e-9)) return bad(R, 'Bu ölçeglerden tor gurlup bilinmeýär', ['Daşky radius b içki radiusdan a uly bolmaly: b > a.', 'Ýöne b = ' + fmt(v.b) + ' ≤ a = ' + fmt(v.a) + ' ' + MK_BAD], 'b-ni a-dan uly ýazyň.');
      R.passed.push('b > a: ' + fmt(v.b) + ' > ' + fmt(v.a) + ' ' + MK_OK);
      return R;
    }
    if(v.R <= v.r*(1 + 1e-9)) return bad(R, 'Bu ölçeglerden tor gurlup bilinmeýär', ['Halka görnüşli torda R turbanyň radiusyndan r uly bolmaly: R > r.', 'Ýöne R = ' + fmt(v.R) + ' ≤ r = ' + fmt(v.r) + ' ' + MK_BAD], 'R-i r-den uly ýazyň.');
    R.passed.push('R > r: ' + fmt(v.R) + ' > ' + fmt(v.r) + ' ' + MK_OK);
    return R;
  },
  calc:function(v, ctx, mode){
    const q = SOLID.torus.resolve(v, mode), R = q.R, r = q.r, p2 = Math.PI*Math.PI, a = R - r, b = R + r;
    const pre = mode === 'io' ? [sl('R = (a + b)/2 = ' + ctx.L(R) + ', &nbsp;r = (b − a)/2 = ' + ctx.L(r))] : [];
    const V = 2*p2*R*r*r, S = 4*p2*R*r;
    return {title:'Tor (simit)',
      steps:pre.concat([
        sl('Göwrüm (Pappus): V = (πr²)·(2πR) = 2π²Rr² = 2π² × ' + fmt(R) + ' × ' + fmt(r*r) + ' = ' + ctx.V(V)),
        sl('Ýer ýüzi: S = (2πr)·(2πR) = 4π²Rr = 4π² × ' + fmt(R) + ' × ' + fmt(r) + ' = ' + ctx.A(S))]),
      answer:'Göwrüm V = ' + ctx.V(V) + SEP + 'Ýer ýüzi S = ' + ctx.A(S),
      checks:[chk('Göwrüm: V = S·r / 2', S*r/2, V),
              chk('Göwrüm: V = π²(a + b)(b − a)² / 4 (içki a we daşky b radius arkaly)', p2*(a + b)*(b - a)*(b - a)/4, V),
              chk('Ýer ýüzi: S = π²(a + b)(b − a)', p2*(a + b)*(b - a), S)],
      values:[R, r, V, S]};
  }
};

/* ---------- 6. KOORDINATA GEOMETRIÝASY ---------- */
function ptFields(n){
  const f = [];
  for(let i = 1; i <= n; i++){
    f.push({id:'x' + i, label:'x', group:'P' + i + ' nokat', kind:'coord'});
    f.push({id:'y' + i, label:'y', group:'P' + i + ' nokat', kind:'coord'});
  }
  return f;
}
function lineEq(m, b){
  if(Math.abs(m) < 1e-12) return 'y = ' + fmt(b);
  let s = 'y = ' + (Math.abs(m - 1) < 1e-12 ? 'x' : (Math.abs(m + 1) < 1e-12 ? '−x' : fmt(m) + 'x'));
  if(Math.abs(b) >= 1e-12) s += (b < 0 ? ' − ' : ' + ') + fmt(Math.abs(b));
  return s;
}

const COORD = {};

COORD.distance = {
  fields:ptFields(2), defaults:{x1:1, y1:2, x2:4, y2:6}, note:'Nokatlary çyzgyda süýşürip hem bolýar.', fig:'coord', figMode:'distance',
  validate:function(v){
    const R = newVR();
    R.passed.push('Koordinatalar çäkli sanlar ' + MK_OK);
    if(v.x1 === v.x2 && v.y1 === v.y2) R.notes.push('Iki nokat gabat gelýär: aralyk 0.');
    return R;
  },
  calc:function(v, ctx){
    const dx = cancel(v.x2 - v.x1, v.x1, v.x2), dy = cancel(v.y2 - v.y1, v.y1, v.y2), d = Math.hypot(dx, dy);
    const M = [(v.x1 + v.x2)/2, (v.y1 + v.y2)/2];
    return {title:'Iki nokadyň aralygy',
      steps:[
        sl('Δx = x₂ − x₁ = ' + fmt(v.x2) + ' − ' + fmt(v.x1) + ' = ' + fmt(dx) + ', &nbsp;Δy = y₂ − y₁ = ' + fmt(v.y2) + ' − ' + fmt(v.y1) + ' = ' + fmt(dy)),
        sl('d = √(Δx² + Δy²) = √(' + fmt(dx*dx) + ' + ' + fmt(dy*dy) + ') = √' + fmt(dx*dx + dy*dy) + ' = ' + ctx.L(d))],
      answer:'Aralyk d = ' + ctx.L(d),
      checks:[chk('Aralyk: d² = Δx² + Δy²', d*d, dx*dx + dy*dy, 1e-9),
              chk('Aralyk: |P₁M| + |MP₂| = d (M — orta nokat)', distPts([v.x1, v.y1], M) + distPts(M, [v.x2, v.y2]), d, 1e-9)],
      values:[dx, dy, d]};
  }
};

COORD.midpoint = {
  fields:ptFields(2), defaults:{x1:1, y1:2, x2:4, y2:6}, note:'', fig:'coord', figMode:'midpoint',
  validate:function(){ const R = newVR(); R.passed.push('Koordinatalar çäkli sanlar ' + MK_OK); return R; },
  calc:function(v, ctx){
    const mx = (v.x1 + v.x2)/2, my = (v.y1 + v.y2)/2;
    return {title:'Orta nokat',
      steps:[
        sl('x = (x₁ + x₂) / 2 = (' + fmt(v.x1) + ' + ' + fmt(v.x2) + ') / 2 = ' + fmt(mx)),
        sl('y = (y₁ + y₂) / 2 = (' + fmt(v.y1) + ' + ' + fmt(v.y2) + ') / 2 = ' + fmt(my))],
      answer:'Orta nokat M(' + fmt(mx) + '; ' + fmt(my) + ')',
      checks:[chk('M-den P₁-e we P₂-ä aralyklar deň', distPts([mx, my], [v.x1, v.y1]), distPts([mx, my], [v.x2, v.y2]), 1e-9,
                  Math.hypot(v.x2 - v.x1, v.y2 - v.y1))],
      values:[mx, my]};
  }
};

COORD.slope = {
  fields:ptFields(2), defaults:{x1:1, y1:2, x2:4, y2:6}, note:'', fig:'coord', figMode:'slope',
  validate:function(v){
    const R = newVR();
    if(v.x1 === v.x2 && v.y1 === v.y2){
      return bad(R, 'Iki nokat gabat gelýär — çyzyk kesgitlenmeýär', [
        'P₁(' + fmt(v.x1) + '; ' + fmt(v.y1) + ') we P₂(' + fmt(v.x2) + '; ' + fmt(v.y2) + ') — bir nokat.',
        'Bir nokatdan tükeniksiz köp çyzyk geçýär, şonuň üçin gyşarma bir manyly kesgitlenmeýär.'
      ], 'P₂-ni P₁-den tapawutly nokat edip saýlaň.');
    }
    R.passed.push('Nokatlar dürli ' + MK_OK);
    return R;
  },
  calc:function(v, ctx){
    const dx = cancel(v.x2 - v.x1, v.x1, v.x2), dy = cancel(v.y2 - v.y1, v.y1, v.y2);
    let steps, ans, chks;
    if(dx === 0){
      steps = [sl('Δx = ' + fmt(v.x2) + ' − ' + fmt(v.x1) + ' = 0 ⇒ çyzyk dikligine (wertikal), gyşarma kesgitlenmeýär.'), sl('Çyzyk deňlemesi: x = ' + fmt(v.x1))];
      ans = 'Wertikal çyzyk: x = ' + fmt(v.x1);
      chks = [chk('P₁ we P₂ x = ' + fmt(v.x1) + ' çyzygynda ýatýar', v.x2, v.x1)];
    } else {
      const m = dy/dx, b = v.y1 - m*v.x1;
      steps = [
        sl('m = Δy / Δx = ' + fmt(dy) + ' / ' + fmt(dx) + ' = ' + fmt(m)),
        sl('b = y₁ − m·x₁ = ' + fmt(v.y1) + ' − ' + fmt(m) + ' × ' + fmt(v.x1) + ' = ' + fmt(b)),
        sl('Çyzyk deňlemesi: ' + lineEq(m, b))];
      ans = 'Gyşarma m = ' + fmt(m) + SEP + lineEq(m, b);
      const sc = Math.max(Math.abs(v.y1), Math.abs(v.y2), Math.abs(m*v.x1), Math.abs(m*v.x2), Math.abs(b));
      chks = [chk('P₂ çyzyk deňlemesini kanagatlandyrýar: y₂ = m·x₂ + b', m*v.x2 + b, v.y2, 1e-9, sc),
              chk('P₁ çyzyk deňlemesini kanagatlandyrýar: y₁ = m·x₁ + b', m*v.x1 + b, v.y1, 1e-9, sc)];
    }
    return {title:'Gyşarma we çyzyk deňlemesi', steps:steps, answer:ans, checks:chks, values:[dx, dy]};
  }
};

COORD.triangle_pts = {
  fields:ptFields(3), defaults:{x1:0, y1:0, x2:4, y2:0, x3:0, y3:3}, note:'Üç nokat bir çyzykda ýatsa, üçburçluk emele gelmeýär.', fig:'coord', figMode:'triangle_pts',
  validate:function(v){
    const R = newVR();
    let cross = (v.x2 - v.x1)*(v.y3 - v.y1) - (v.x3 - v.x1)*(v.y2 - v.y1);
    const d12 = Math.hypot(v.x2 - v.x1, v.y2 - v.y1), d13 = Math.hypot(v.x3 - v.x1, v.y3 - v.y1), d23 = Math.hypot(v.x3 - v.x2, v.y3 - v.y2);
    if(Math.abs(cross) <= 1e-12*(d12*d13 + d12*d23 + d13*d23)){
      cross = 0;
      return bad(R, 'Bu üç nokat bir çyzykda ýatýar — üçburçluk emele gelmeýär', [
        'Üçburçlugyň meýdany ½·|(x₂−x₁)(y₃−y₁) − (x₃−x₁)(y₂−y₁)| formulasy bilen tapylýar.',
        '(x₂−x₁)(y₃−y₁) − (x₃−x₁)(y₂−y₁) = (' + fmt(v.x2 - v.x1) + ')(' + fmt(v.y3 - v.y1) + ') − (' + fmt(v.x3 - v.x1) + ')(' + fmt(v.y2 - v.y1) + ') = ' + fmt(cross),
        'Netije 0: meýdan 0, ýagny nokatlar bir çyzykda ýatýar ' + MK_BAD
      ], 'Nokatlaryň birini çyzykdan daşlaşdyryň (çyzgyda süýşürip hem bolýar).');
    }
    R.passed.push('Üç nokat bir çyzykda ýatmaýar (kesişme ≠ 0) ' + MK_OK);
    return R;
  },
  calc:function(v, ctx){
    const P = [[v.x1, v.y1], [v.x2, v.y2], [v.x3, v.y3]];
    const cross = (v.x2 - v.x1)*(v.y3 - v.y1) - (v.x3 - v.x1)*(v.y2 - v.y1);
    const S = Math.abs(cross)/2;
    const a = distPts(P[1], P[2]), b = distPts(P[0], P[2]), c = distPts(P[0], P[1]);
    const s = (a + b + c)/2;
    return {title:'Üçburçlugyň meýdany (3 nokat)',
      steps:[
        sl('S = ½ · |(x₂−x₁)(y₃−y₁) − (x₃−x₁)(y₂−y₁)| = ½ · |' + fmt(cross) + '| = ' + ctx.A(S)),
        sl('Taraplar: |P₁P₂| = ' + ctx.L(c) + ', &nbsp;|P₂P₃| = ' + ctx.L(a) + ', &nbsp;|P₁P₃| = ' + ctx.L(b)),
        sl('Perimetr: P = ' + ctx.L(a + b + c))],
      answer:'Meýdan S = ' + ctx.A(S) + SEP + 'Perimetr P = ' + ctx.L(a + b + c),
      checks:[chk('Meýdan: Geron formulasy bilen (taraplar arkaly)', Math.sqrt(Math.max(s*(s-a)*(s-b)*(s-c), 0)), S, 1e-6)],
      values:[S, a, b, c]};
  }
};

/* ---------- 7. INTERAKTIW ÇYZGYLAR ---------- */
const COL = {blue:'#1a56b4', fill:'#eef6fd', fill2:'#dcebfa', fill3:'#c9def5', amber:'#e8a33d', red:'#c62828', dark:'#154a92', green:'#2e8b57', mute:'#8ab3dd', grid:'#e6ebf1', axis:'#9aa7b6'};
const VW = 340, VH = 270;

function bbox(pts){
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pts.forEach(function(p){ if(p[0] < x0) x0 = p[0]; if(p[0] > x1) x1 = p[0]; if(p[1] < y0) y0 = p[1]; if(p[1] > y1) y1 = p[1]; });
  return {x0:x0, y0:y0, x1:x1, y1:y1};
}
function niceStep(x){
  if(!(x > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x))), m = x / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}
function clean(x){ return Number(x.toPrecision(12)) + 0; }

/* SVG kömekçileri (ähli hasaplamalar model koordinatalarynda, çyzgy pikselde) */
function P_(E, p){ const q = E.tx(p); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }
function svgLine(E, p1, p2, col, w, dash){
  const a = E.tx(p1), b = E.tx(p2);
  return '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '" stroke="' + col + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' stroke-linecap="round"/>';
}
function svgPoly(E, pts, fill, stroke, w){
  return '<polygon points="' + pts.map(function(p){ return P_(E, p); }).join(' ') + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + w + '" stroke-linejoin="round"/>';
}
function svgText(x, y, str, col, anchor, size){
  return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" font-size="' + (size || 12) + '" font-weight="bold" fill="' + col + '" text-anchor="' + (anchor || 'middle') + '" font-family="Georgia,serif" stroke="#fff" stroke-opacity=".8" stroke-width="3.4" stroke-linejoin="round" paint-order="stroke">' + str + '</text>';
}
function tagAt(E, p, dx, dy, str, col, anchor){
  const q = E.tx(p);
  return svgText(q[0] + dx, q[1] + dy, str, col || COL.dark, anchor || 'start', 12);
}
function edgeLab(E, p1, p2, cen, str, col){
  const a = E.tx(p1), b = E.tx(p2), c = E.tx(cen);
  const mx = (a[0] + b[0])/2, my = (a[1] + b[1])/2;
  let dx = mx - c[0], dy = my - c[1];
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  const anchor = dx > 0.4 ? 'start' : (dx < -0.4 ? 'end' : 'middle');
  const yOff = dy > 0.4 ? 12 : (dy < -0.4 ? -4 : 4);
  return svgText(mx + dx*9, my + dy*9 + yOff, str, col || COL.dark, anchor, 12);
}
function vertLab(E, p, cen, str, col){
  const a = E.tx(p), c = E.tx(cen);
  let dx = a[0] - c[0], dy = a[1] - c[1];
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  return svgText(a[0] + dx*13, a[1] + dy*13 + 4, str, col || COL.red, 'middle', 13);
}
function rightMark(E, corner, p1, p2){
  const c = E.tx(corner), a = E.tx(p1), b = E.tx(p2);
  let ux = a[0] - c[0], uy = a[1] - c[1], vx = b[0] - c[0], vy = b[1] - c[1];
  const lu = Math.hypot(ux, uy) || 1, lv = Math.hypot(vx, vy) || 1;
  ux = ux/lu*9; uy = uy/lu*9; vx = vx/lv*9; vy = vy/lv*9;
  return '<path d="M' + (c[0] + ux).toFixed(1) + ',' + (c[1] + uy).toFixed(1) + ' L' + (c[0] + ux + vx).toFixed(1) + ',' + (c[1] + uy + vy).toFixed(1) + ' L' + (c[0] + vx).toFixed(1) + ',' + (c[1] + vy).toFixed(1) + '" fill="none" stroke="' + COL.amber + '" stroke-width="1.5"/>';
}
function dotAt(E, p, col, r){
  const q = E.tx(p);
  return '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="' + (r || 3) + '" fill="' + (col || COL.red) + '"/>';
}
function angleDeg(P, Q, R){
  const ux = Q[0] - P[0], uy = Q[1] - P[1], vx = R[0] - P[0], vy = R[1] - P[1];
  const d = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if(d === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, (ux*vx + uy*vy) / d))) * R2D;
}

const KINDS = {};

/* --- Üçburçluk (nokatlar erkin süýşürilýär) --- */
KINDS.tri3 = {
  fromVals:function(v, mode){
    const S = sidesOf(mode, v); if(!S) return null;
    const cx = (S.b*S.b + S.c*S.c - S.a*S.a) / (2*S.c);
    const cy = Math.sqrt(Math.max(S.b*S.b - cx*cx, 0));
    return {P:[[0,0], [S.c,0], [cx,cy]]};
  },
  toVals:function(s, mode){
    const A = s.P[0], B = s.P[1], C = s.P[2];
    const a = distPts(B, C), b = distPts(A, C), c = distPts(A, B);
    if(mode === 'sss') return {a:a, b:b, c:c};
    if(mode === 'sas') return {a:a, b:b, C:angleDeg(C, A, B)};
    return {A:angleDeg(A, B, C), B:angleDeg(B, A, C), c:c};
  },
  bounds:function(s){ return bbox(s.P); },
  handles:function(s){ return s.P.map(function(p, i){ return {id:String(i), x:p[0], y:p[1]}; }); },
  drag:function(s, id, x, y){ s.P[+id] = [x, y]; },
  draw:function(s, E){
    const A = s.P[0], B = s.P[1], C = s.P[2];
    const cen = [(A[0]+B[0]+C[0])/3, (A[1]+B[1]+C[1])/3];
    return svgPoly(E, s.P, COL.fill, COL.blue, 2.2)
      + edgeLab(E, B, C, cen, 'a = ' + E.lab(distPts(B, C))) + edgeLab(E, A, C, cen, 'b = ' + E.lab(distPts(A, C))) + edgeLab(E, A, B, cen, 'c = ' + E.lab(distPts(A, B)))
      + vertLab(E, A, cen, 'A') + vertLab(E, B, cen, 'B') + vertLab(E, C, cen, 'C');
  }
};

/* --- Üçburçluk: esas we beýiklik --- */
KINDS.tribh = {
  fromVals:function(v, mode, prev){
    const ax = (prev && prev.ax !== undefined) ? Math.min(Math.max(prev.ax, -v.base), 2*v.base) : v.base/2;
    return {b:v.base, h:v.height, ax:ax};
  },
  toVals:function(s){ return {base:s.b, height:s.h}; },
  bounds:function(s){ return bbox([[0,0], [s.b,0], [s.ax,s.h], [s.ax,0]]); },
  handles:function(s){ return [{id:'B', x:s.b, y:0}, {id:'T', x:s.ax, y:s.h}]; },
  drag:function(s, id, x, y, q){ if(id === 'B') s.b = Math.max(x, q); else { s.ax = x; s.h = Math.max(y, q); } },
  draw:function(s, E){
    const O = [0,0], B = [s.b,0], T = [s.ax,s.h], F = [s.ax,0], cen = [(s.b + s.ax)/3, s.h/3];
    let o = '';
    if(s.ax < 0) o += svgLine(E, F, O, COL.mute, 1.4, '3,3'); else if(s.ax > s.b) o += svgLine(E, B, F, COL.mute, 1.4, '3,3');
    o += svgPoly(E, [O, B, T], COL.fill, COL.blue, 2.2);
    o += svgLine(E, T, F, COL.amber, 1.8, '4,3');
    o += rightMark(E, F, [s.ax + 1, 0], T);
    o += edgeLab(E, O, B, cen, 'b = ' + E.lab(s.b));
    o += tagAt(E, [s.ax, s.h/2], 6, 4, 'h = ' + E.lab(s.h), COL.dark, 'start');
    return o;
  }
};

/* --- Inedördül --- */
KINDS.square = {
  fromVals:function(v){ return {a:v.side}; },
  toVals:function(s){ return {side:s.a}; },
  bounds:function(s){ return {x0:0, y0:0, x1:s.a, y1:s.a}; },
  handles:function(s){ return [{id:'C', x:s.a, y:s.a}]; },
  drag:function(s, id, x, y, q){ s.a = Math.max((x + y)/2, q); },
  draw:function(s, E){
    const a = s.a, pts = [[0,0], [a,0], [a,a], [0,a]], cen = [a/2, a/2];
    return svgPoly(E, pts, COL.fill, COL.blue, 2.2) + svgLine(E, [0,0], [a,a], COL.mute, 1.3, '4,3')
      + edgeLab(E, pts[0], pts[1], cen, 'a = ' + E.lab(a)) + edgeLab(E, pts[1], pts[2], cen, 'a');
  }
};

/* --- Gönüburçluk --- */
KINDS.rect = {
  fromVals:function(v){ return {w:v.w, h:v.h}; },
  toVals:function(s){ return {w:s.w, h:s.h}; },
  bounds:function(s){ return {x0:0, y0:0, x1:s.w, y1:s.h}; },
  handles:function(s){ return [{id:'C', x:s.w, y:s.h}]; },
  drag:function(s, id, x, y, q){ s.w = Math.max(x, q); s.h = Math.max(y, q); },
  draw:function(s, E){
    const pts = [[0,0], [s.w,0], [s.w,s.h], [0,s.h]], cen = [s.w/2, s.h/2];
    return svgPoly(E, pts, COL.fill, COL.blue, 2.2) + svgLine(E, [0,0], [s.w,s.h], COL.mute, 1.3, '4,3')
      + edgeLab(E, pts[0], pts[1], cen, 'a = ' + E.lab(s.w)) + edgeLab(E, pts[1], pts[2], cen, 'b = ' + E.lab(s.h));
  }
};

/* --- Parallelogram --- */
KINDS.para = {
  fromVals:function(v, mode, prev){
    if(v.side < v.height - 1e-9*Math.max(v.side, v.height)) return null;
    const sg = (prev && prev.sk < 0) ? -1 : 1;
    return {b:v.base, h:v.height, sk:sg*Math.sqrt(Math.max(v.side*v.side - v.height*v.height, 0))};
  },
  toVals:function(s){ return {base:s.b, height:s.h, side:hyp(s.sk, s.h)}; },
  bounds:function(s){ return bbox([[0,0], [s.b,0], [s.b + s.sk,s.h], [s.sk,s.h], [s.sk,0]]); },
  handles:function(s){ return [{id:'B', x:s.b, y:0}, {id:'D', x:s.sk, y:s.h}]; },
  drag:function(s, id, x, y, q){ if(id === 'B') s.b = Math.max(x, q); else { s.sk = x; s.h = Math.max(y, q); } },
  draw:function(s, E){
    const A = [0,0], B = [s.b,0], C = [s.b + s.sk,s.h], D = [s.sk,s.h], F = [s.sk,0];
    const cen = [(s.b + s.sk)/2, s.h/2];
    let o = '';
    if(s.sk < 0) o += svgLine(E, F, A, COL.mute, 1.4, '3,3'); else if(s.sk > s.b) o += svgLine(E, B, F, COL.mute, 1.4, '3,3');
    o += svgPoly(E, [A, B, C, D], COL.fill, COL.blue, 2.2);
    o += svgLine(E, D, F, COL.amber, 1.8, '4,3') + rightMark(E, F, [s.sk + 1, 0], D);
    o += edgeLab(E, A, B, cen, 'b = ' + E.lab(s.b)) + edgeLab(E, B, C, cen, 'a = ' + E.lab(hyp(s.sk, s.h)));
    o += tagAt(E, [s.sk, s.h/2], 6, 4, 'h = ' + E.lab(s.h), COL.dark, 'start');
    return o;
  }
};

/* --- Trapesiýa --- */
KINDS.trap = {
  fromVals:function(v, mode, prev){
    const T = trapConfigs(v.a, v.b, v.h, v.c, v.d);
    if(!T.legOK || !T.cfgs.length) return null;
    let best = T.cfgs[0];
    if(prev){
      T.cfgs.forEach(function(c){ if(Math.abs(c.x1 - prev.x1) < Math.abs(best.x1 - prev.x1)) best = c; });
    }
    return {a:v.a, b:v.b, h:v.h, x1:best.x1};
  },
  toVals:function(s){ return {a:s.a, b:s.b, h:s.h, c:hyp(s.x1 + s.b - s.a, s.h), d:hyp(s.x1, s.h)}; },
  bounds:function(s){ return bbox([[0,0], [s.a,0], [s.x1 + s.b,s.h], [s.x1,s.h], [s.x1,0]]); },
  handles:function(s){ return [{id:'B', x:s.a, y:0}, {id:'C', x:s.x1 + s.b, y:s.h}, {id:'D', x:s.x1, y:s.h}]; },
  drag:function(s, id, x, y, q){
    if(id === 'B') s.a = Math.max(x, q);
    else if(id === 'D'){ s.x1 = x; s.h = Math.max(y, q); }
    else { s.h = Math.max(y, q); s.b = Math.max(x - s.x1, q); }
  },
  draw:function(s, E){
    const A = [0,0], B = [s.a,0], C = [s.x1 + s.b,s.h], D = [s.x1,s.h], F = [s.x1,0];
    const cen = [(s.a + s.b)/4 + s.x1/2, s.h/2];
    const c = hyp(s.x1 + s.b - s.a, s.h), d = hyp(s.x1, s.h);
    let o = '';
    if(s.x1 < 0) o += svgLine(E, F, A, COL.mute, 1.4, '3,3'); else if(s.x1 > s.a) o += svgLine(E, B, F, COL.mute, 1.4, '3,3');
    o += svgPoly(E, [A, B, C, D], COL.fill, COL.blue, 2.2);
    o += svgLine(E, D, F, COL.amber, 1.8, '4,3') + rightMark(E, F, [s.x1 + 1, 0], D);
    o += edgeLab(E, A, B, cen, 'a = ' + E.lab(s.a)) + edgeLab(E, D, C, cen, 'b = ' + E.lab(s.b));
    o += edgeLab(E, B, C, cen, 'c = ' + E.lab(c)) + edgeLab(E, A, D, cen, 'd = ' + E.lab(d));
    o += tagAt(E, [s.x1, s.h/2], 6, 4, 'h = ' + E.lab(s.h), COL.dark, 'start');
    return o;
  }
};

/* --- Romb --- */
KINDS.rhomb = {
  fromVals:function(v){ return {d1:v.d1, d2:v.d2}; },
  toVals:function(s){ return {d1:s.d1, d2:s.d2}; },
  bounds:function(s){ return {x0:-s.d1/2, y0:-s.d2/2, x1:s.d1/2, y1:s.d2/2}; },
  handles:function(s){ return [{id:'R', x:s.d1/2, y:0}, {id:'T', x:0, y:s.d2/2}]; },
  drag:function(s, id, x, y, q){ if(id === 'R') s.d1 = Math.max(2*Math.abs(x), q); else s.d2 = Math.max(2*Math.abs(y), q); },
  draw:function(s, E){
    const R = [s.d1/2,0], T = [0,s.d2/2], L = [-s.d1/2,0], Bm = [0,-s.d2/2], cen = [0,0];
    return svgPoly(E, [R, T, L, Bm], COL.fill, COL.blue, 2.2)
      + svgLine(E, L, R, COL.amber, 1.6, '4,3') + svgLine(E, Bm, T, COL.amber, 1.6, '4,3')
      + rightMark(E, [0,0], [1,0], [0,1]) + dotAt(E, [0,0], COL.blue, 2.5)
      + edgeLab(E, R, T, cen, 'a = ' + E.lab(0.5*hyp(s.d1, s.d2)))
      + tagAt(E, [s.d1/4, 0], -6, 16, 'd₁ = ' + E.lab(s.d1), COL.dark, 'middle')
      + tagAt(E, [0, s.d2/4], -7, 4, 'd₂ = ' + E.lab(s.d2), COL.dark, 'end');
  }
};

/* --- Tegelek --- */
KINDS.circle = {
  fromVals:function(v){ return {r:v.r}; },
  toVals:function(s){ return {r:s.r}; },
  bounds:function(s){ return {x0:-s.r, y0:-s.r, x1:s.r, y1:s.r}; },
  handles:function(s){ return [{id:'R', x:s.r, y:0}]; },
  drag:function(s, id, x, y, q){ s.r = Math.max(Math.hypot(x, y), q); },
  draw:function(s, E){
    const c = E.tx([0,0]);
    return '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="' + (s.r*E.s).toFixed(1) + '" fill="' + COL.fill + '" stroke="' + COL.blue + '" stroke-width="2.2"/>'
      + svgLine(E, [0,0], [s.r,0], COL.amber, 1.8, '4,3') + dotAt(E, [0,0], COL.blue, 2.5)
      + tagAt(E, [s.r/2, 0], 0, -7, 'r = ' + E.lab(s.r), COL.dark, 'middle');
  }
};

/* --- Sektor --- */
KINDS.sector = {
  fromVals:function(v){ return {r:v.r, a:v.A}; },
  toVals:function(s){ return {r:s.r, A:s.a}; },
  bounds:function(s){ return {x0:-s.r, y0:-s.r, x1:s.r, y1:s.r}; },
  handles:function(s){ const t = s.a*D2R; return [{id:'R', x:s.r, y:0}, {id:'A', x:s.r*Math.cos(t), y:s.r*Math.sin(t)}]; },
  drag:function(s, id, x, y, q){ if(id === 'R'){ s.r = Math.max(Math.hypot(x, y), q); } else { let d = Math.atan2(y, x)*R2D; if(d <= 0) d += 360; s.a = Math.min(Math.max(d, 1), 359); } },
  draw:function(s, E){
    const t = s.a*D2R, p0 = E.tx([0,0]), p1 = E.tx([s.r,0]), p2 = E.tx([s.r*Math.cos(t), s.r*Math.sin(t)]), rr = s.r*E.s;
    const d = 'M' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) + ' L' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ' A' + rr.toFixed(1) + ' ' + rr.toFixed(1) + ' 0 ' + (s.a > 180 ? 1 : 0) + ' 0 ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1) + ' Z';
    return '<circle cx="' + p0[0].toFixed(1) + '" cy="' + p0[1].toFixed(1) + '" r="' + rr.toFixed(1) + '" fill="none" stroke="' + COL.blue + '" stroke-width="1" stroke-dasharray="3,4" opacity=".45"/>'
      + '<path d="' + d + '" fill="' + COL.fill2 + '" stroke="' + COL.blue + '" stroke-width="2.2" stroke-linejoin="round"/>' + dotAt(E, [0,0], COL.blue, 2.5)
      + tagAt(E, [s.r/2, 0], 0, -7, 'r = ' + E.lab(s.r), COL.dark, 'middle') + tagAt(E, [s.r*0.38*Math.cos(t/2), s.r*0.38*Math.sin(t/2)], 0, 4, 'α = ' + fmtS(s.a) + '°', COL.amber, 'middle');
  }
};
/* --- Halka --- */
KINDS.ring = {
  fromVals:function(v){ return {R:v.R, r:v.r}; },
  toVals:function(s){ return {R:s.R, r:s.r}; },
  bounds:function(s){ return {x0:-s.R, y0:-s.R, x1:s.R, y1:s.R}; },
  handles:function(s){ return [{id:'R', x:s.R, y:0}, {id:'r', x:0, y:s.r}]; },
  drag:function(s, id, x, y, q){ const d = Math.hypot(x, y); if(id === 'R') s.R = Math.max(d, s.r + q); else s.r = Math.min(Math.max(d, q), s.R - q); },
  draw:function(s, E){
    const c = E.tx([0,0]);
    return '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="' + (s.R*E.s).toFixed(1) + '" fill="' + COL.fill2 + '" stroke="' + COL.blue + '" stroke-width="2.2"/>'
      + '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="' + (s.r*E.s).toFixed(1) + '" fill="#fff" stroke="' + COL.blue + '" stroke-width="2.2"/>'
      + svgLine(E, [0,0], [s.R,0], COL.amber, 1.8, '4,3') + svgLine(E, [0,0], [0,s.r], COL.red, 1.8, '4,3') + dotAt(E, [0,0], COL.blue, 2.5)
      + tagAt(E, [s.R*0.62, 0], 0, -7, 'R = ' + E.lab(s.R), COL.dark, 'middle') + tagAt(E, [0, s.r*0.5], 6, 0, 'r = ' + E.lab(s.r), COL.dark, 'start');
  }
};
/* --- Ellips --- */
KINDS.ellipse = {
  fromVals:function(v){ return {a:v.a, b:v.b}; },
  toVals:function(s){ return {a:s.a, b:s.b}; },
  bounds:function(s){ return {x0:-s.a, y0:-s.b, x1:s.a, y1:s.b}; },
  handles:function(s){ return [{id:'a', x:s.a, y:0}, {id:'b', x:0, y:s.b}]; },
  drag:function(s, id, x, y, q){ if(id === 'a') s.a = Math.max(Math.abs(x), q); else s.b = Math.max(Math.abs(y), q); },
  draw:function(s, E){
    const c = E.tx([0,0]), mj = Math.max(s.a, s.b), mn = Math.min(s.a, s.b), f = Math.sqrt(mj*mj - mn*mn), fa = s.a >= s.b;
    return '<ellipse cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" rx="' + (s.a*E.s).toFixed(1) + '" ry="' + (s.b*E.s).toFixed(1) + '" fill="' + COL.fill + '" stroke="' + COL.blue + '" stroke-width="2.2"/>'
      + svgLine(E, [0,0], [s.a,0], COL.amber, 1.8, '4,3') + svgLine(E, [0,0], [0,s.b], COL.red, 1.8, '4,3') + dotAt(E, [0,0], COL.blue, 2.5)
      + (f > 1e-9 ? dotAt(E, fa ? [f,0] : [0,f], COL.red, 3) + dotAt(E, fa ? [-f,0] : [0,-f], COL.red, 3) : '')
      + tagAt(E, [s.a/2, 0], 0, -7, 'a = ' + E.lab(s.a), COL.dark, 'middle') + tagAt(E, [0, s.b/2], 6, 0, 'b = ' + E.lab(s.b), COL.dark, 'start');
  }
};

/* --- Dogry köpburçluk --- */
KINDS.poly = {
  fromVals:function(v){ return {n:v.n, R:v.side/(2*Math.sin(Math.PI/v.n))}; },
  toVals:function(s){ return {n:s.n, side:2*s.R*Math.sin(Math.PI/s.n)}; },
  verts:function(s){ const pts = []; for(let i = 0; i < s.n; i++){ const th = Math.PI/2 + 2*Math.PI*i/s.n; pts.push([s.R*Math.cos(th), s.R*Math.sin(th)]); } return pts; },
  bounds:function(s){ return {x0:-s.R, y0:-s.R, x1:s.R, y1:s.R}; },
  handles:function(s){ return [{id:'V', x:0, y:s.R}]; },
  drag:function(s, id, x, y, q){ s.R = Math.max(Math.hypot(x, y), q); },
  draw:function(s, E){
    const pts = KINDS.poly.verts(s), side = 2*s.R*Math.sin(Math.PI/s.n);
    return svgPoly(E, pts, COL.fill, COL.blue, 2.2) + svgLine(E, [0,0], pts[0], COL.amber, 1.6, '4,3') + dotAt(E, [0,0], COL.blue, 2.5)
      + edgeLab(E, pts[0], pts[1 % s.n], [0,0], 'a = ' + E.lab(side)) + tagAt(E, [0,0], 8, 16, 'n = ' + s.n, COL.dark, 'start');
  }
};

/* --- Göwrümli şekiller (oblik proýeksiýa) --- */
const OB = 0.3536;
function drawBox(E, w, h, ox, oy){
  const F = [[0,0], [w,0], [w,h], [0,h]], Bk = [[ox,oy], [w+ox,oy], [w+ox,h+oy], [ox,h+oy]];
  return svgPoly(E, [F[3], F[2], Bk[2], Bk[3]], COL.fill, COL.blue, 1.8)
    + svgPoly(E, [F[1], Bk[1], Bk[2], F[2]], COL.fill3, COL.blue, 1.8)
    + svgPoly(E, F, COL.fill2, COL.blue, 2.2)
    + svgLine(E, F[0], Bk[0], COL.mute, 1.4, '4,3') + svgLine(E, Bk[0], Bk[1], COL.mute, 1.4, '4,3') + svgLine(E, Bk[0], Bk[3], COL.mute, 1.4, '4,3');
}
function ellipseArc(E, cx, cy, r, ry, front){       /* aşaky ýarym (görünýän) ýa-da ýokarky ýarym (dasheli) */
  const c = E.tx([cx, cy]), rx = r*E.s, y = ry*E.s;
  return '<path d="M' + (c[0] - rx).toFixed(1) + ',' + c[1].toFixed(1) + ' A' + rx.toFixed(1) + ',' + y.toFixed(1) + ' 0 0 ' + (front ? 0 : 1) + ' ' + (c[0] + rx).toFixed(1) + ',' + c[1].toFixed(1) + '" fill="none" stroke="' + (front ? COL.blue : COL.mute) + '" stroke-width="' + (front ? 2.2 : 1.4) + '"' + (front ? '' : ' stroke-dasharray="4,3"') + '/>';
}
function fullEllipse(E, cx, cy, r, ry, fill){
  const c = E.tx([cx, cy]);
  return '<ellipse cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" rx="' + (r*E.s).toFixed(1) + '" ry="' + (ry*E.s).toFixed(1) + '" fill="' + fill + '" stroke="' + COL.blue + '" stroke-width="2.2"/>';
}

KINDS.cube = {
  fromVals:function(v){ return {a:v.a}; },
  toVals:function(s){ return {a:s.a}; },
  bounds:function(s){ const o = OB*s.a; return {x0:0, y0:0, x1:s.a + o, y1:s.a + o}; },
  handles:function(s){ return [{id:'T', x:s.a, y:s.a}]; },
  drag:function(s, id, x, y, q){ s.a = Math.max((x + y)/2, q); },
  draw:function(s, E){
    const a = s.a, o = OB*a;
    return drawBox(E, a, a, o, o) + tagAt(E, [a/2, 0], 0, 16, 'a = ' + E.lab(a), COL.dark, 'middle');
  }
};

KINDS.cuboid = {
  fromVals:function(v){ return {a:v.a, b:v.b, c:v.c}; },
  toVals:function(s){ return {a:s.a, b:s.b, c:s.c}; },
  bounds:function(s){ const o = OB*s.b; return {x0:0, y0:0, x1:s.a + o, y1:s.c + o}; },
  handles:function(s){ const o = OB*s.b; return [{id:'W', x:s.a, y:0}, {id:'H', x:0, y:s.c}, {id:'D', x:s.a + o, y:o}]; },
  drag:function(s, id, x, y, q){
    if(id === 'W') s.a = Math.max(x, q);
    else if(id === 'H') s.c = Math.max(y, q);
    else s.b = Math.max((x - s.a)/OB, q);
  },
  draw:function(s, E){
    const o = OB*s.b;
    return drawBox(E, s.a, s.c, o, o)
      + tagAt(E, [s.a/2, 0], 0, 16, 'a = ' + E.lab(s.a), COL.dark, 'middle')
      + tagAt(E, [0, s.c/2], -8, 4, 'c = ' + E.lab(s.c), COL.dark, 'end')
      + tagAt(E, [s.a + o/2, o/2], 8, 14, 'b = ' + E.lab(s.b), COL.dark, 'start');
  }
};

KINDS.sphere = {
  fromVals:function(v){ return {r:v.r}; },
  toVals:function(s){ return {r:s.r}; },
  bounds:function(s){ return {x0:-s.r, y0:-s.r, x1:s.r, y1:s.r}; },
  handles:function(s){ return [{id:'R', x:s.r, y:0}]; },
  drag:function(s, id, x, y, q){ s.r = Math.max(Math.hypot(x, y), q); },
  draw:function(s, E){
    const c = E.tx([0,0]);
    return '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="' + (s.r*E.s).toFixed(1) + '" fill="' + COL.fill + '" stroke="' + COL.blue + '" stroke-width="2.2"/>'
      + ellipseArc(E, 0, 0, s.r, 0.3*s.r, false) + ellipseArc(E, 0, 0, s.r, 0.3*s.r, true)
      + svgLine(E, [0,0], [s.r,0], COL.amber, 1.8, '4,3') + dotAt(E, [0,0], COL.blue, 2.5)
      + tagAt(E, [s.r/2, 0], 0, -7, 'r = ' + E.lab(s.r), COL.dark, 'middle');
  }
};

KINDS.cylinder = {
  fromVals:function(v){ return {r:v.r, h:v.h}; },
  toVals:function(s){ return {r:s.r, h:s.h}; },
  bounds:function(s){ return {x0:-s.r, y0:-0.3*s.r, x1:s.r, y1:s.h + 0.3*s.r}; },
  handles:function(s){ return [{id:'R', x:s.r, y:s.h/2}, {id:'H', x:0, y:s.h}]; },
  drag:function(s, id, x, y, q){ if(id === 'R') s.r = Math.max(Math.abs(x), q); else s.h = Math.max(y, q); },
  draw:function(s, E){
    const r = s.r, h = s.h, ry = 0.3*r;
    return '<path d="M' + P_(E, [-r,0]) + ' L' + P_(E, [-r,h]) + ' L' + P_(E, [r,h]) + ' L' + P_(E, [r,0]) + ' A' + (r*E.s).toFixed(1) + ',' + (ry*E.s).toFixed(1) + ' 0 0 1 ' + P_(E, [-r,0]) + ' Z" fill="' + COL.fill2 + '" stroke="none"/>'
      + ellipseArc(E, 0, 0, r, ry, false) + ellipseArc(E, 0, 0, r, ry, true)
      + svgLine(E, [-r,0], [-r,h], COL.blue, 2.2) + svgLine(E, [r,0], [r,h], COL.blue, 2.2)
      + fullEllipse(E, 0, h, r, ry, COL.fill)
      + svgLine(E, [0,h], [r,h], COL.amber, 1.8, '4,3') + svgLine(E, [0,0], [0,h], COL.amber, 1.8, '4,3') + dotAt(E, [0,h], COL.blue, 2.5)
      + tagAt(E, [r/2, h], 0, -6, 'r = ' + E.lab(r), COL.dark, 'middle')
      + tagAt(E, [0, h/2], -6, 4, 'h = ' + E.lab(h), COL.dark, 'end');
  }
};

KINDS.cone = {
  fromVals:function(v, mode){
    const q = SOLID.cone.resolve(v, mode);
    return (q.r > 0 && q.h > 0 && isFinite(q.r) && isFinite(q.h)) ? {r:q.r, h:q.h} : null;
  },
  toVals:function(s, mode){
    const l = hyp(s.r, s.h);
    if(mode === 'rl') return {r:s.r, l:l};
    if(mode === 'hl') return {h:s.h, l:l};
    if(mode === 'rhl') return {r:s.r, h:s.h, l:l};
    return {r:s.r, h:s.h};
  },
  bounds:function(s){ return {x0:-s.r, y0:-0.3*s.r, x1:s.r, y1:s.h}; },
  handles:function(s){ return [{id:'R', x:s.r, y:0}, {id:'A', x:0, y:s.h}]; },
  drag:function(s, id, x, y, q){ if(id === 'R') s.r = Math.max(Math.abs(x), q); else s.h = Math.max(y, q); },
  draw:function(s, E){
    const r = s.r, h = s.h, ry = 0.3*r, l = hyp(r, h);
    return '<path d="M' + P_(E, [-r,0]) + ' L' + P_(E, [0,h]) + ' L' + P_(E, [r,0]) + ' A' + (r*E.s).toFixed(1) + ',' + (ry*E.s).toFixed(1) + ' 0 0 1 ' + P_(E, [-r,0]) + ' Z" fill="' + COL.fill2 + '" stroke="none"/>'
      + ellipseArc(E, 0, 0, r, ry, false) + ellipseArc(E, 0, 0, r, ry, true)
      + svgLine(E, [-r,0], [0,h], COL.blue, 2.2) + svgLine(E, [r,0], [0,h], COL.blue, 2.2)
      + svgLine(E, [0,0], [r,0], COL.amber, 1.8, '4,3') + svgLine(E, [0,0], [0,h], COL.amber, 1.8, '4,3') + dotAt(E, [0,0], COL.blue, 2.5)
      + tagAt(E, [r/2, 0], 0, 16, 'r = ' + E.lab(r), COL.dark, 'middle')
      + tagAt(E, [0, h/2], -6, 4, 'h = ' + E.lab(h), COL.dark, 'end')
      + tagAt(E, [r/2, h/2], 8, -2, 'l = ' + E.lab(l), COL.dark, 'start');
  }
};

KINDS.pyramid = {
  fromVals:function(v, mode){
    const q = SOLID.pyramid.resolve(v, mode);
    return (q.a > 0 && q.h > 0 && isFinite(q.h)) ? {a:q.a, h:q.h} : null;
  },
  toVals:function(s, mode){
    const l = Math.sqrt(s.h*s.h + s.a*s.a/4), e = Math.sqrt(s.h*s.h + s.a*s.a/2);
    if(mode === 'al') return {a:s.a, l:l};
    if(mode === 'ae') return {a:s.a, e:e};
    if(mode === 'ahl') return {a:s.a, h:s.h, l:l};
    return {a:s.a, h:s.h};
  },
  bounds:function(s){ const o = OB*s.a; return {x0:0, y0:0, x1:s.a + o, y1:s.h + o/2}; },
  handles:function(s){ const o = OB*s.a; return [{id:'W', x:s.a, y:0}, {id:'A', x:s.a/2 + o/2, y:s.h + o/2}]; },
  drag:function(s, id, x, y, q){ if(id === 'W') s.a = Math.max(x, q); else s.h = Math.max(y - OB*s.a/2, q); },
  draw:function(s, E){
    const a = s.a, h = s.h, o = OB*a;
    const F0 = [0,0], F1 = [a,0], B1 = [a + o,o], B0 = [o,o], cen = [a/2 + o/2, o/2], ap = [cen[0], cen[1] + h];
    return svgPoly(E, [ap, F1, B1], COL.fill3, COL.blue, 1.8) + svgPoly(E, [ap, F0, F1], COL.fill2, COL.blue, 2.2)
      + svgLine(E, F0, B0, COL.mute, 1.4, '4,3') + svgLine(E, B0, B1, COL.mute, 1.4, '4,3') + svgLine(E, ap, B0, COL.mute, 1.4, '4,3')
      + svgLine(E, ap, cen, COL.amber, 1.8, '4,3') + dotAt(E, cen, COL.blue, 2.5)
      + tagAt(E, [a/2, 0], 0, 16, 'a = ' + E.lab(a), COL.dark, 'middle')
      + tagAt(E, [cen[0], cen[1] + h/2], 6, 4, 'h = ' + E.lab(h), COL.dark, 'start');
  }
};

KINDS.frustum = {
  fromVals:function(v, mode){
    const q = SOLID.frustum.resolve(v, mode);
    return (q.r > 0 && q.R > q.r && q.h > 0 && isFinite(q.h)) ? {R:q.R, r:q.r, h:q.h} : null;
  },
  toVals:function(s, mode){ return mode === 'Rrl' ? {R:s.R, r:s.r, l:hyp(s.h, s.R - s.r)} : {R:s.R, r:s.r, h:s.h}; },
  bounds:function(s){ return {x0:-s.R, y0:-0.3*s.R, x1:s.R, y1:s.h + 0.3*s.r + 0.12*s.R}; },
  handles:function(s){ return [{id:'B', x:s.R, y:0}, {id:'T', x:s.r, y:s.h}, {id:'H', x:0, y:s.h}]; },
  drag:function(s, id, x, y, q){
    if(id === 'B') s.R = Math.max(Math.abs(x), s.r + q);
    else if(id === 'T') s.r = Math.min(Math.max(Math.abs(x), q), s.R - q);
    else s.h = Math.max(y, q);
  },
  draw:function(s, E){
    const R = s.R, r = s.r, h = s.h, l = hyp(h, R - r);
    return '<path d="M' + P_(E, [-R,0]) + ' L' + P_(E, [-r,h]) + ' L' + P_(E, [r,h]) + ' L' + P_(E, [R,0]) + ' A' + (R*E.s).toFixed(1) + ',' + (0.3*R*E.s).toFixed(1) + ' 0 0 1 ' + P_(E, [-R,0]) + ' Z" fill="' + COL.fill2 + '" stroke="none"/>'
      + ellipseArc(E, 0, 0, R, 0.3*R, false) + ellipseArc(E, 0, 0, R, 0.3*R, true)
      + svgLine(E, [-R,0], [-r,h], COL.blue, 2.2) + svgLine(E, [R,0], [r,h], COL.blue, 2.2)
      + fullEllipse(E, 0, h, r, 0.3*r, COL.fill)
      + svgLine(E, [0,0], [R,0], COL.amber, 1.8, '4,3') + svgLine(E, [0,0], [0,h], COL.amber, 1.8, '4,3') + svgLine(E, [0,h], [r,h], COL.amber, 1.8, '4,3')
      + dotAt(E, [0,0], COL.blue, 2.5) + dotAt(E, [0,h], COL.blue, 2.5)
      + tagAt(E, [R/2, 0], 0, 16, 'R = ' + E.lab(R), COL.dark, 'middle') + tagAt(E, [r/2, h + 0.3*r], 0, -8, 'r = ' + E.lab(r), COL.dark, 'middle')
      + tagAt(E, [0, h/2], -6, 4, 'h = ' + E.lab(h), COL.dark, 'end') + tagAt(E, [(R + r)/2, h/2], 8, -2, 'l = ' + E.lab(l), COL.dark, 'start');
  }
};

function prismGeom(s){
  const n = s.n, nd = Math.min(n, 72), Rc = s.a/(2*Math.sin(Math.PI/n)), B = [];
  for(let i = 0; i < nd; i++){ const t = -Math.PI/2 + 2*Math.PI*i/nd; B.push([Rc*Math.cos(t), 0.3*Rc*Math.sin(t)]); }
  let k = 0, j = 0;
  B.forEach(function(p, i){ if(p[0] > B[k][0] + 1e-12) k = i; if(p[0] < B[j][0] - 1e-12) j = i; });
  return {nd:nd, Rc:Rc, B:B, k:k, j:j};
}
KINDS.prism = {
  fromVals:function(v){ const n = Math.round(v.n); return (n >= 3 && n <= 1000 && v.a > 0 && v.h > 0) ? {n:n, a:v.a, h:v.h} : null; },
  toVals:function(s){ return {n:s.n, a:s.a, h:s.h}; },
  bounds:function(s){ const Rc = s.a/(2*Math.sin(Math.PI/s.n)); return {x0:-Rc, y0:-0.3*Rc, x1:Rc, y1:s.h + 0.3*Rc}; },
  handles:function(s){ const g = prismGeom(s); return [{id:'A', x:g.B[g.k][0], y:g.B[g.k][1]}, {id:'H', x:g.B[g.j][0], y:g.B[g.j][1] + s.h}]; },
  drag:function(s, id, x, y, q){
    const g = prismGeom(s);
    if(id === 'A') s.a = Math.max(2*Math.sin(Math.PI/s.n)*Math.abs(x)*g.Rc/g.B[g.k][0], q);
    else s.h = Math.max(y - g.B[g.j][1], q);
  },
  draw:function(s, E){
    const g = prismGeom(s), nd = g.nd, B = g.B, h = s.h, T = B.map(function(p){ return [p[0], p[1] + h]; });
    const vis = [];
    let faces = '', hid = '', best = 0, bs = 2;
    for(let i = 0; i < nd; i++){
      const sn = Math.sin(-Math.PI/2 + 2*Math.PI*(i + 0.5)/nd);
      vis.push(sn < -1e-9);
      if(sn < bs){ bs = sn; best = i; }
    }
    for(let i = 0; i < nd; i++){
      const i2 = (i + 1) % nd, ip = (i + nd - 1) % nd;
      if(vis[i]) faces += svgPoly(E, [B[i], B[i2], T[i2], T[i]], COL.fill2, COL.blue, 1.8);
      else hid += svgLine(E, B[i], B[i2], COL.mute, 1.4, '4,3');
      if(!vis[i] && !vis[ip] && !B.some(function(p, j){ return (vis[j] || vis[(j + nd - 1) % nd]) && Math.abs(p[0] - B[i][0]) < 1e-9*g.Rc; })) hid += svgLine(E, B[i], T[i], COL.mute, 1.4, '4,3');
    }
    const b2 = B[(best + 1) % nd], mid = [(B[best][0] + b2[0])/2, (B[best][1] + b2[1])/2];
    return faces + svgPoly(E, T, COL.fill, COL.blue, 2.2) + hid
      + tagAt(E, mid, 0, 16, 'a = ' + E.lab(s.a), COL.dark, 'middle')
      + tagAt(E, [B[g.j][0], B[g.j][1] + h/2], -6, 4, 'h = ' + E.lab(h), COL.dark, 'end')
      + tagAt(E, [0, h], 0, 4, 'n = ' + s.n, COL.dark, 'middle');
  }
};

KINDS.torus = {
  fromVals:function(v, mode){ const q = SOLID.torus.resolve(v, mode); return (q.r > 0 && q.R > q.r && isFinite(q.R)) ? {R:q.R, r:q.r} : null; },
  toVals:function(s, mode){ return mode === 'io' ? {a:s.R - s.r, b:s.R + s.r} : {R:s.R, r:s.r}; },
  bounds:function(s){ const o = s.R + s.r; return {x0:-o, y0:-0.35*o, x1:o, y1:0.35*o}; },
  handles:function(s){ return [{id:'R', x:s.R, y:0}, {id:'r', x:s.R + s.r, y:0}]; },
  drag:function(s, id, x, y, q){
    if(id === 'R') s.R = Math.max(Math.abs(x), s.r + q);
    else s.r = Math.min(Math.max(Math.abs(x) - s.R, q), s.R - q);
  },
  draw:function(s, E){
    const R = s.R, r = s.r, k = 0.35, o = R + r, i = R - r;
    return fullEllipse(E, 0, 0, o, k*o, COL.fill2) + fullEllipse(E, 0, 0, i, k*i, '#ffffff')
      + '<ellipse cx="' + E.tx([0,0])[0].toFixed(1) + '" cy="' + E.tx([0,0])[1].toFixed(1) + '" rx="' + (R*E.s).toFixed(1) + '" ry="' + (k*R*E.s).toFixed(1) + '" fill="none" stroke="' + COL.mute + '" stroke-width="1.4" stroke-dasharray="4,3"/>'
      + svgLine(E, [0,0], [R,0], COL.amber, 1.8, '4,3') + svgLine(E, [R,0], [o,0], COL.red, 2) + dotAt(E, [0,0], COL.blue, 2.5)
      + tagAt(E, [R/2, 0], 0, -8, 'R = ' + E.lab(R), COL.dark, 'middle') + tagAt(E, [R + r/2, 0], 0, 17, 'r = ' + E.lab(r), COL.dark, 'middle');
  }
};

/* --- Koordinata tekizligi --- */
KINDS.coord = {
  fromVals:function(v, mode){
    const n = mode === 'triangle_pts' ? 3 : 2, pts = [];
    for(let i = 1; i <= n; i++) pts.push([v['x' + i], v['y' + i]]);
    return {pts:pts};
  },
  toVals:function(s){ const v = {}; s.pts.forEach(function(p, i){ v['x' + (i+1)] = p[0]; v['y' + (i+1)] = p[1]; }); return v; },
  bounds:function(s){
    const b = bbox(s.pts.concat([[0,0]]));
    if(b.x1 - b.x0 < 1e-300 && b.y1 - b.y0 < 1e-300){ b.x0 = -1; b.x1 = 1; b.y0 = -1; b.y1 = 1; }
    const w = b.x1 - b.x0, h = b.y1 - b.y0, m = Math.max(w, h);
    b.x0 -= 0.12*m; b.y0 -= 0.12*m; b.x1 += 0.3*m; b.y1 += 0.12*m;
    return b;
  },
  handles:function(s){ return s.pts.map(function(p, i){ return {id:String(i), x:p[0], y:p[1]}; }); },
  drag:function(s, id, x, y){
    const lim = MAX_VAL;
    s.pts[+id] = [Math.max(-lim, Math.min(lim, x)) + 0, Math.max(-lim, Math.min(lim, y)) + 0];
  },
  draw:function(s, E){
    const R = E.view, span = Math.max(R.x1 - R.x0, R.y1 - R.y0), step = niceStep(span/6);
    let o = '', cnt = 0;
    const tl = function(v){ return fmt(clean(v), 3, true); };
    for(let gx = Math.ceil(R.x0/step); gx*step <= R.x1 && cnt < 80; gx++, cnt++){
      const x = gx*step;
      o += svgLine(E, [x,R.y0], [x,R.y1], x === 0 ? COL.axis : COL.grid, x === 0 ? 1.6 : 1);
      if(x !== 0){ const q = E.tx([x, R.y0]); o += svgText(q[0], q[1] - 4, tl(x), '#8a94a2', 'middle', 9); }
    }
    cnt = 0;
    for(let gy = Math.ceil(R.y0/step); gy*step <= R.y1 && cnt < 80; gy++, cnt++){
      const y = gy*step;
      o += svgLine(E, [R.x0,y], [R.x1,y], y === 0 ? COL.axis : COL.grid, y === 0 ? 1.6 : 1);
      if(y !== 0){ const q = E.tx([R.x0, y]); o += svgText(q[0] + 3, q[1] - 2, tl(y), '#8a94a2', 'start', 9); }
    }
    const pts = s.pts, mode = E.mode;
    if(mode === 'triangle_pts') o += svgPoly(E, pts, COL.fill, COL.blue, 2.2);
    else if(mode === 'slope'){
      const p = pts[0], q = pts[1];
      if(p[0] === q[0] && p[1] === q[1]) { /* nokatlar gabat gelýär */ }
      else if(p[0] === q[0]) o += svgLine(E, [p[0], R.y0], [p[0], R.y1], COL.blue, 2.2);
      else { const m = (q[1] - p[1])/(q[0] - p[0]); o += svgLine(E, [R.x0, p[1] + m*(R.x0 - p[0])], [R.x1, p[1] + m*(R.x1 - p[0])], COL.blue, 2.2); }
    } else {
      o += svgLine(E, pts[0], pts[1], COL.blue, 2.2);
      if(mode === 'distance') o += svgLine(E, pts[0], [pts[1][0], pts[0][1]], COL.mute, 1.4, '4,3') + svgLine(E, [pts[1][0], pts[0][1]], pts[1], COL.mute, 1.4, '4,3');
      if(mode === 'midpoint'){
        const M = [(pts[0][0] + pts[1][0])/2, (pts[0][1] + pts[1][1])/2];
        const fl = E.tx(M)[0] > VW - 100;
        o += dotAt(E, M, COL.green, 4.5) + tagAt(E, M, fl ? -8 : 8, 16, 'M(' + fmtS(M[0]) + '; ' + fmtS(M[1]) + ')', COL.green, fl ? 'end' : 'start');
      }
    }
    pts.forEach(function(p, i){
      const flip = E.tx(p)[0] > VW - 100;
      o += dotAt(E, p, COL.red, 3.5) + tagAt(E, p, flip ? -9 : 9, -9, 'P' + (i+1) + '(' + fmtS(p[0]) + '; ' + fmtS(p[1]) + ')', COL.dark, flip ? 'end' : 'start');
    });
    return o;
  }
};

/* --- Çyzgy hereketlendirijisi: nokatlary süýşürmek --- */
function makeFigure(host){
  host.innerHTML = '<svg class="fig-svg" viewBox="0 0 ' + VW + ' ' + VH + '" role="img" aria-label="Interaktiw çyzgy"><g class="fig-layer"></g></svg><div class="fig-caption"></div>';
  const svg = host.querySelector('svg'), layer = host.querySelector('.fig-layer'), cap = host.querySelector('.fig-caption');
  const F = {kind:null, mode:'', state:null, unit:'', stale:false, staleMsg:'', onChange:null, snapOn:null, view:null};
  let drag = null, frozen = null, pending = null, raf = 0;

  function makeView(bb){
    let w = bb.x1 - bb.x0, h = bb.y1 - bb.y0;
    if(!(w > 0)) w = Math.max(h, 1e-12);
    if(!(h > 0)) h = Math.max(w, 1e-12);
    const s = Math.min(VW*0.66/w, VH*0.66/h), cx = (bb.x0 + bb.x1)/2, cy = (bb.y0 + bb.y1)/2;
    const tx = function(p){ return [VW/2 + (p[0] - cx)*s, VH/2 - (p[1] - cy)*s]; };
    const inv = function(x, y){ return [cx + (x - VW/2)/s, cy - (y - VH/2)/s]; };
    const c1 = inv(0, VH), c2 = inv(VW, 0);
    return {s:s, tx:tx, inv:inv, range:{x0:c1[0], y0:c1[1], x1:c2[0], y1:c2[1]}, q:Math.pow(10, Math.floor(Math.log10(Math.max(w, h))) - 3)};
  }
  function env(view){
    return {tx:view.tx, s:view.s, view:view.range, mode:F.mode, u:F.unit,
            lab:function(x){ return fmtS(x) + (F.unit ? ' ' + F.unit : ''); }};
  }
  function render(){
    if(!F.kind || !F.state){ layer.innerHTML = ''; cap.className = 'fig-caption' + (F.stale ? ' warn' : ''); cap.textContent = F.stale ? ('⚠ ' + F.staleMsg) : ''; return; }
    const view = drag ? frozen : makeView(F.kind.bounds(F.state));
    F.view = view;
    const E = env(view);
    let hs = '';
    F.kind.handles(F.state).forEach(function(h){
      const p = view.tx([h.x, h.y]);
      hs += '<g class="fig-handle" data-h="' + h.id + '"><circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="18" fill="transparent"/><circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="7" fill="' + COL.amber + '" stroke="#fff" stroke-width="2"/></g>';
    });
    layer.innerHTML = '<g style="opacity:' + (F.stale ? 0.3 : 1) + '">' + F.kind.draw(F.state, E) + '</g>' + hs;
    cap.className = 'fig-caption' + (F.stale ? ' warn' : '');
    cap.textContent = F.stale ? ('⚠ ' + F.staleMsg) : 'Ýaldaw nokatlary süýşürip ölçegleri üýtgediň — meýdançalar we netije şoňa görä täzelenýär.';
  }
  function svgPt(e){
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM(); if(!m) return null;
    const p = pt.matrixTransform(m.inverse());
    return [p.x, p.y];
  }
  function step(){
    raf = 0;
    if(!drag || !pending) return;
    const p = svgPt(pending); pending = null;
    if(!p) return;
    const m = frozen.inv(p[0], p[1]);
    let stepQ = frozen.q;
    if(F.snapOn && F.snapOn()){
      const R = frozen.range;
      stepQ = niceStep(Math.max(R.x1 - R.x0, R.y1 - R.y0)/12);
    }
    const x = clean(Math.round(m[0]/stepQ)*stepQ), y = clean(Math.round(m[1]/stepQ)*stepQ);
    F.kind.drag(F.state, drag, x, y, stepQ);
    render();
    if(F.onChange) F.onChange(false);
  }
  svg.addEventListener('pointerdown', function(e){
    if(!F.kind || !F.state) return;
    const t = e.target.closest ? e.target.closest('[data-h]') : null;
    if(!t) return;
    drag = t.getAttribute('data-h');
    frozen = F.view || makeView(F.kind.bounds(F.state));
    if(F.stale){ F.stale = false; }
    try{ svg.setPointerCapture(e.pointerId); }catch(err){}
    e.preventDefault();
  });
  svg.addEventListener('pointermove', function(e){
    if(!drag) return;
    pending = {clientX:e.clientX, clientY:e.clientY};
    if(!raf) raf = requestAnimationFrame(step);
  });
  function end(e){
    if(!drag) return;
    if(pending){ step(); }
    drag = null; frozen = null; pending = null;
    try{ svg.releasePointerCapture(e.pointerId); }catch(err){}
    render();
    if(F.onChange) F.onChange(true);
  }
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('touchmove', function(e){ if(drag && e.cancelable) e.preventDefault(); }, {passive:false});

  F.setKind = function(kind, mode){ F.kind = kind; F.mode = mode || ''; F.state = null; F.stale = false; render(); };
  F.setState = function(st){ F.state = st; F.stale = false; render(); };
  F.setStale = function(msg){ F.stale = true; F.staleMsg = msg; render(); };
  F.rerender = render;
  F.snapshot = function(){
    if(!F.kind || !F.state) return '';
    const view = makeView(F.kind.bounds(F.state));
    return '<div style="text-align:center;"><svg viewBox="0 0 ' + VW + ' ' + VH + '" width="300" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;background:#fff;border:1px solid #c7c7c7;border-radius:6px;">' + F.kind.draw(F.state, env(view)) + '</svg></div>';
  };
  return F;
}

  /* ================= HASAPLAMA TARYHY ================= */
  const HISTORY_KEY = "calcHistory";
  const HIST_STORAGE_OK = !!(window.storage && typeof window.storage.get === "function" && typeof window.storage.set === "function");
  let HIST_LOCAL_OK = false;
  try{ const t="__amatly_ht__"; localStorage.setItem(t,"1"); localStorage.removeItem(t); HIST_LOCAL_OK = true; }
  catch(e){ HIST_LOCAL_OK = false; }
  let memHistory = [];

  async function getHistoryList(){
    if(HIST_STORAGE_OK){
      try{ const r = await window.storage.get(HISTORY_KEY, false); return r ? JSON.parse(r.value) : []; }
      catch(e){ return []; }
    }
    if(HIST_LOCAL_OK){
      try{ const raw = localStorage.getItem(HISTORY_KEY); return raw ? JSON.parse(raw) : []; }catch(e){ return []; }
    }
    return memHistory;
  }
  async function saveHistoryList(list){
    if(HIST_STORAGE_OK){
      try{ await window.storage.set(HISTORY_KEY, JSON.stringify(list), false); return; }catch(e){}
    }
    if(HIST_LOCAL_OK){
      try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); return; }catch(e){}
    }
    memHistory = list;
  }
  function renderHistory(list){
    const wrap = document.getElementById("historyList");
    if(!wrap) return;
    if(!list.length){
      wrap.innerHTML = '<p class="calc-intro">Entek hasaplama ýok. Ýasy, Göwrümli ýa-da Koordinata bölüminde "Hasaplaň" basanyňyzda bu ýere goşular.</p>';
      return;
    }
    wrap.innerHTML = list.map(function(item, idx){
      return '<div class="hist-item"><div class="hist-head" data-idx="'+idx+'">'
        + '<span class="hist-time">'+item.time+'</span>'
        + '<span class="hist-cat">'+item.cat+'</span>'
        + '<span class="hist-title">'+item.title+'</span>'
        + '</div><div class="hist-body" id="histBody'+idx+'">'+item.html+'</div></div>';
    }).join("");
    wrap.querySelectorAll(".hist-head").forEach(function(h){
      h.addEventListener("click", function(){
        document.getElementById("histBody"+h.getAttribute("data-idx")).classList.toggle("show");
      });
    });
  }
  async function addHistory(cat, title, html){
    const list = await getHistoryList();
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,"0");
    const mm = String(now.getMinutes()).padStart(2,"0");
    list.unshift({time: hh+":"+mm, cat:cat, title:title, html:html});
    while(list.length > 30) list.pop();
    await saveHistoryList(list);
    renderHistory(list);
  }
  getHistoryList().then(renderHistory);
  document.getElementById("histClearBtn").addEventListener("click", function(){
    saveHistoryList([]).then(function(){ renderHistory([]); });
  });

/* ---------- 8. PANELLER: giriş → barlag → hasaplama → netije → öz-özüni barlamak ---------- */
const $ = function(id){ return document.getElementById(id); };
function fac(u){ return u ? UNITS[u] : 1; }
function numText(x){ return String(Number(x.toPrecision(8))); }
function stage(title, inner){ return '<div class="stage-title">' + title + '</div>' + inner; }
function chkLine(s){ return '<div class="chk">' + (s.indexOf('mk-') >= 0 ? s : MK_OK + ' ' + s) + '</div>'; }
function renderErrors(R){
  return R.errors.map(function(e){
    return '<div class="explain-box"><h5>❌ ' + e.title + '</h5>'
      + e.lines.map(function(l){ return '<div class="step-line">' + l + '</div>'; }).join('')
      + (e.hint ? '<div class="hint-line">💡 ' + e.hint + '</div>' : '') + '</div>';
  }).join('');
}

function makePanel(o){
  const P = {o:o, shown:false};
  const fig = makeFigure(o.figHost);
  P.fig = fig;
  if(o.snapEl) fig.snapOn = function(){ return o.snapEl.checked; };

  P.cur = function(){
    const base = o.defs[o.selectEl.value];
    if(base.modes){
      let mode = o.modeEl.value;
      if(!base.modes[mode]) mode = Object.keys(base.modes)[0];
      const m = base.modes[mode];
      return Object.assign({}, base, {fields:m.fields, defaults:m.defaults, mode:mode, figMode:mode, key:o.selectEl.value});
    }
    return Object.assign({}, base, {mode:'', figMode:base.figMode || '', key:o.selectEl.value});
  };

  P.updateModes = function(){
    if(!o.modeEl) return;
    const base = o.defs[o.selectEl.value];
    if(base.modes){
      o.modeEl.innerHTML = Object.keys(base.modes).map(function(k){ return '<option value="' + k + '">' + base.modes[k].label + '</option>'; }).join('');
      o.modeRowEl.hidden = false;
    } else {
      o.modeEl.innerHTML = '';
      o.modeRowEl.hidden = true;
    }
  };

  P.clearInvalid = function(){
    o.fieldsHost.querySelectorAll('.invalid').forEach(function(el){ el.classList.remove('invalid'); });
  };

  P.buildFields = function(){
    const cur = P.cur(), host = o.fieldsHost;
    host.innerHTML = '';
    let lastGroup = null, row = null;
    cur.fields.forEach(function(f){
      const id = o.prefix + f.id;
      const inp = document.createElement('input');
      inp.type = 'text'; inp.id = id; inp.setAttribute('inputmode', 'decimal'); inp.autocomplete = 'off';
      inp.value = String(cur.defaults[f.id]);
      inp.setAttribute('aria-label', f.group ? (f.group + ' ' + f.label) : f.label);
      if(f.group){
        if(f.group !== lastGroup){
          const block = document.createElement('div'); block.className = 'point-block';
          block.innerHTML = '<div class="pt-title">' + f.group + '</div>';
          row = document.createElement('div'); row.className = 'point-row';
          block.appendChild(row); host.appendChild(block); lastGroup = f.group;
        }
        const lb = document.createElement('label'); lb.htmlFor = id; lb.textContent = f.label + ':';
        row.appendChild(lb); row.appendChild(inp);
      } else {
        const r = document.createElement('div'); r.className = 'field-row';
        const lb = document.createElement('label'); lb.htmlFor = id; lb.textContent = f.label + ':';
        const box = document.createElement('div'); box.className = 'fr-inputs';
        box.appendChild(inp);
        if(f.kind === 'len'){
          const sel = document.createElement('select'); sel.className = 'unit-sel'; sel.id = id + '_u';
          sel.setAttribute('aria-label', f.label + ' — ölçeg birligi');
          Object.keys(UNITS).forEach(function(u){
            const op = document.createElement('option'); op.value = u; op.textContent = u; if(u === 'cm') op.selected = true; sel.appendChild(op);
          });
          sel.addEventListener('change', P.onEdit);
          box.appendChild(sel);
        } else {
          const sp = document.createElement('span'); sp.className = 'unit-static'; sp.textContent = f.kind === 'angle' ? '°' : ''; box.appendChild(sp);
        }
        r.appendChild(lb); r.appendChild(box); host.appendChild(r);
      }
      inp.addEventListener('input', P.onEdit);
      inp.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); P.calculate(false); } });
    });
    o.noteEl.textContent = cur.note || '';
    (function(){
      const k = cur.key, f = FORMULAS[k] || ((k.indexOf('triangle_') === 0 && k !== 'triangle_pts') ? FORMULAS.triangle : '');
      if(!f) return;
      const d = document.createElement('details'); d.className = 'formulas';
      d.innerHTML = '<summary>Formulalar</summary><div class="formulas-body">' + f.split(' ; ').map(function(x){ return '<div>' + x + '</div>'; }).join('') + '</div>';
      o.noteEl.appendChild(d);
    })();
  };

  P.resolveUnits = function(cur){
    const fu = {};
    cur.fields.forEach(function(f){ if(f.kind === 'len') fu[f.id] = $(o.prefix + f.id + '_u').value; });
    let canon;
    const sel = o.unitEl.value;
    if(o.coordMode) canon = sel;
    else if(sel === 'auto'){
      canon = null;
      Object.keys(fu).forEach(function(k){ if(canon === null || UNITS[fu[k]] < UNITS[canon]) canon = fu[k]; });
      if(canon === null) canon = 'cm';
    } else canon = sel;
    return {fu:fu, canon:canon};
  };

  /* 1-nji gatlak: girişi okamak we esasy barlag (san, položitellik, çäkler, birlikler) */
  P.collect = function(){
    const cur = P.cur();
    const ru = P.resolveUnits(cur), canon = ru.canon;
    const res = {ok:true, vals:{}, errors:[], bad:[], unit:canon, conv:[]};
    cur.fields.forEach(function(f){
      const el = $(o.prefix + f.id);
      const nm = f.group ? (f.group + ', ' + f.label) : f.label;
      const fail = function(msg){ res.ok = false; res.errors.push('«' + nm + '» — ' + msg); res.bad.push(el); };
      const pr = parseNum(el.value);
      if(!pr.ok){ fail(pr.err === 'empty' ? 'meýdança boş' : pr.err === 'inf' ? 'san aşa uly (çäkden çykýar)' : 'san däl (mysal: 5 ýa-da 3.5)'); return; }
      const v = pr.value;
      if(f.kind === 'len'){
        if(v <= 0){ fail('0-dan uly bolmaly'); return; }
        const cv = v * UNITS[ru.fu[f.id]] / fac(canon);
        if(cv > MAX_VAL){ fail('aşa uly san (iň köp 10⁹ ' + canon + ')'); return; }
        if(cv < MIN_VAL){ fail('aşa kiçi san (iň az 10⁻⁹ ' + canon + ')'); return; }
        res.vals[f.id] = cv;
        if(ru.fu[f.id] !== canon) res.conv.push(fmt(v) + ' ' + ru.fu[f.id] + ' = ' + fmt(cv) + ' ' + canon + ' &nbsp;<span class="num">(' + f.label + ')</span>');
      } else if(f.kind === 'angle'){
        if(v <= 0){ fail('0°-dan uly bolmaly'); return; }
        if(v > 1e6){ fail('aşa uly burç'); return; }
        res.vals[f.id] = v;
      } else if(f.kind === 'int'){
        if(!Number.isInteger(v)){ fail('bitin san bolmaly (3, 4, 5, 6 …). «' + el.value.trim() + '» kesir san — tegeleklemek matematiki taýdan nädogry'); return; }
        if(v < f.min || v > f.max){ fail(f.min + ' bilen ' + f.max + ' aralygynda bitin san bolmaly'); return; }
        res.vals[f.id] = v;
      } else {   /* koordinata */
        if(Math.abs(v) > MAX_VAL){ fail('aşa uly san (|x| ≤ 10⁹)'); return; }
        if(v !== 0 && Math.abs(v) < MIN_VAL){ fail('aşa kiçi (0-a ýakyn, ýöne 0 däl) san'); return; }
        res.vals[f.id] = v;
      }
    });
    return res;
  };

  P.syncFig = function(){
    const cur = P.cur(), kind = KINDS[cur.fig];
    const c = P.collect();
    fig.unit = c.unit || '';
    if(fig.kind !== kind || fig.mode !== cur.figMode) fig.setKind(kind, cur.figMode);
    if(!c.ok){ fig.setStale('Meýdançalarda nädogry ýa-da boş baha bar — çyzgy soňky dogry ýagdaýy görkezýär.'); return; }
    const st = kind.fromVals(c.vals, cur.figMode, fig.state);
    if(!st){ fig.setStale('Girizilen ölçeglerden şekil gurlup bilinmeýär — «Hasaplaň» düwmesi sebäbini düşündirer.'); return; }
    fig.setState(st);
  };

  P.writeFields = function(cur, vals){
    const ru = P.resolveUnits(cur);
    cur.fields.forEach(function(f){
      if(vals[f.id] === undefined) return;
      let x = vals[f.id];
      if(f.kind === 'len') x = x * fac(ru.canon) / UNITS[ru.fu[f.id]];
      $(o.prefix + f.id).value = numText(x);
    });
    P.clearInvalid();
  };

  P.onEdit = function(){
    o.errEl.textContent = '';
    P.clearInvalid();
    if(P.shown) o.resultEl.classList.add('stale');
    P.syncFig();
  };

  P.hideResult = function(){
    o.errEl.textContent = '';
    o.resultEl.classList.remove('show', 'stale');
    o.resultEl.innerHTML = '';
    P.shown = false;
  };

  P.showResult = function(html){
    o.resultEl.innerHTML = html;
    o.resultEl.classList.add('show');
    o.resultEl.classList.remove('stale');
    P.shown = true;
  };

  /* Bütin konweýer: giriş → barlag → hasaplama → netije → öz-özüni barlamak */
  P.calculate = function(silent){
    const cur = P.cur();
    o.errEl.textContent = '';
    P.clearInvalid();
    if(!silent) P.syncFig();

    /* 1. giriş + esasy barlag */
    const c = P.collect();
    if(!c.ok){
      P.hideResult();
      c.bad.forEach(function(el){ el.classList.add('invalid'); });
      o.errEl.innerHTML = '❌ ' + c.errors.join('<br>❌ ');
      return false;
    }
    const ctx = mkCtx(c.unit);

    /* 2. geometrik barlag (şekil hakykatdanam bar bolup bilýärmi?) */
    const R = cur.validate(c.vals, ctx, cur.mode);
    const shapeName = o.selectEl.options[o.selectEl.selectedIndex].text;
    if(R.errors.length){
      o.errEl.innerHTML = '❌ ' + R.errors[0].title;
      P.showResult('<h4>' + shapeName + ' — barlag netijesi</h4>' + renderErrors(R));
      return false;
    }

    /* 3. hasaplama */
    const res = cur.calc(c.vals, ctx, cur.mode);
    const badNums = res.values.filter(function(x){ return typeof x !== 'number' || !isFinite(x); });
    if(badNums.length){
      o.errEl.innerHTML = '❌ Hasaplama netijesi manysyz (Infinity / NaN) — ölçegler aşa uly ýa-da biri-birinden aşa tapawutly.';
      P.showResult('<h4>' + shapeName + '</h4><div class="explain-box"><h5>❌ Netije manysyz</h5><div class="step-line">Hasaplamanyň netijesi tükeniksiz ýa-da san däl boldy. Ölçegleriň tapawudy örän uly (ýa-da san aşa uly/kiçi). Ölçegleri ýakynlaşdyryň ýa-da birlikleri üýtgediň.</div></div>');
      return false;
    }

    /* 4. netijäni başga formula bilen barlamak */
    const ver = res.checks.map(function(ck){
      const diff = Math.abs(ck.x - ck.y), sc = Math.max(Math.abs(ck.x), Math.abs(ck.y), ck.sc || 0);
      return {label:ck.label, x:ck.x, y:ck.y, ok:(diff <= ck.tol * sc)};
    });
    const allOk = ver.every(function(v){ return v.ok; });

    /* 5. netijäni görkezmek */
    const head = '<h4>' + res.title + '</h4>';
    let rest = '';
    const hasLen = cur.fields.some(function(f){ return f.kind === 'len'; });
    if(hasLen){
      rest += stage('Ölçeg birlikleri', c.conv.length
        ? c.conv.map(function(t){ return '<div class="chk">' + t + '</div>'; }).join('') + '<div class="chk">Hasaplamalar ' + c.unit + ' birliginde ýerine ýetirilýär.</div>'
        : '<div class="chk">Ähli ölçegler bir birlikde (' + c.unit + ').</div>');
    }
    rest += stage('Maglumatlaryň barlagy', R.passed.map(chkLine).join('') + R.notes.map(function(n){ return '<div class="info-line">ℹ ' + n + '</div>'; }).join(''));
    rest += stage('Hasaplama', res.steps.join(''));
    rest += '<div class="final-answer">' + res.answer + '</div>';
    rest += stage('Netijäni barlamak (başga formula bilen)', ver.map(function(v){
      return '<div class="chk">' + (v.ok ? MK_OK : MK_BAD) + ' ' + v.label + ': <span class="num">' + fmt(v.x) + (v.ok ? ' = ' : ' ≠ ') + fmt(v.y) + '</span></div>';
    }).join(''));
    if(!allOk) rest += '<div class="warn-box">⚠ Öz-özüni barlag gabat gelmedi — bu netijä ynanmaň, ölçegleri barlaň.</div>';

    P.showResult(head + rest);
    if(!silent) addHistory(o.cat, res.title, head + fig.snapshot() + rest);
    return true;
  };

  /* dolandyryjylar */
  fig.onChange = function(){
    const cur = P.cur();
    P.writeFields(cur, KINDS[cur.fig].toVals(fig.state, cur.figMode));
    P.calculate(true);
  };
  o.selectEl.addEventListener('change', function(){ P.updateModes(); P.buildFields(); P.syncFig(); P.hideResult(); });
  if(o.modeEl) o.modeEl.addEventListener('change', function(){ P.buildFields(); P.syncFig(); P.hideResult(); });
  o.unitEl.addEventListener('change', function(){ P.syncFig(); if(P.shown) P.calculate(true); });
  o.calcBtn.addEventListener('click', function(){ P.calculate(false); });
  o.resetBtn.addEventListener('click', function(){ P.updateModes(); P.buildFields(); P.syncFig(); P.hideResult(); });

  P.updateModes(); P.buildFields(); P.syncFig();
  return P;
}

const flatPanel = makePanel({
  prefix:'flat_', selectEl:$('flatShape'), unitEl:$('flatUnit'), fieldsHost:$('flatFields'), figHost:$('flatFigure'), noteEl:$('flatNote'),
  errEl:$('flatError'), resultEl:$('flatResult'), calcBtn:$('flatCalcBtn'), resetBtn:$('flatResetBtn'), defs:FLAT, cat:'Ýasy'
});
const solidPanel = makePanel({
  prefix:'solid_', selectEl:$('solidShape'), modeRowEl:$('solidModeRow'), modeEl:$('solidMode'), unitEl:$('solidUnit'), fieldsHost:$('solidFields'), figHost:$('solidFigure'), noteEl:$('solidNote'),
  errEl:$('solidError'), resultEl:$('solidResult'), calcBtn:$('solidCalcBtn'), resetBtn:$('solidResetBtn'), defs:SOLID, cat:'Göwrümli'
});
const coordPanel = makePanel({
  prefix:'coord_', selectEl:$('coordOp'), unitEl:$('coordUnit'), fieldsHost:$('coordFields'), figHost:$('coordFigure'), noteEl:$('coordNote'), snapEl:$('coordSnap'), coordMode:true,
  errEl:$('coordError'), resultEl:$('coordResult'), calcBtn:$('coordCalcBtn'), resetBtn:$('coordResetBtn'), defs:COORD, cat:'Koordinata'
});
const allPanels = [flatPanel, solidPanel, coordPanel];

/* Tegeleklemek (onluk belgileriň sany) — ähli bölümlere degişli */
$('precSel').addEventListener('change', function(){
  PREC = parseInt($('precSel').value, 10) || 4;
  allPanels.forEach(function(p){ p.fig.rerender(); if(p.shown && !p.o.resultEl.classList.contains('stale')) p.calculate(true); });
});

/* ================= SEKMELER (TABS) ================= */
const tabList = [
  {btn:$('tabFlat'), panel:$('panelFlat')},
  {btn:$('tabSolid'), panel:$('panelSolid')},
  {btn:$('tabCoord'), panel:$('panelCoord')},
  {btn:$('tabHistory'), panel:$('panelHistory')}
];
tabList.forEach(function(entry){
  entry.btn.addEventListener('click', function(){
    tabList.forEach(function(t){
      t.btn.classList.toggle('active', t === entry);
      t.panel.classList.toggle('active', t === entry);
    });
  });
});
})();


;
/* math.js bilen howpsuz hasaplamalar: aňlatma okamak (3/4, sqrt(2), 2*pi) we takyk tegeleklemek */
(function(w){
  "use strict";
  var M = w.math, lim = null, ev = null;
  if (M && M.create) {
    lim = M.create(M.all); ev = lim.evaluate.bind(lim);
    var off = {};
    ['import','createUnit','evaluate','parse','simplify','derivative','resolve','reviver'].forEach(function(k){ off[k] = function(){ throw new Error(k + ' öçürilen'); }; });
    lim.import(off, {override:true});
  }
  w.MathSafe = {
    fixed: function(n, p){
      try { return lim ? lim.format(n, {notation:'fixed', precision:p}) : n.toFixed(p); } catch(e){ return n.toFixed(p); }
    },
    evalNumber: function(str){
      if(!ev || typeof str !== 'string' || str.length > 120) return null;
      var s = str.replace(/π/g,'pi').replace(/√/g,'sqrt').replace(/×/g,'*').replace(/÷/g,'/').replace(/\u2212/g,'-');
      if(!/^[\d\s+\-*\/^().a-z]+$/i.test(s) || !/\d|pi/i.test(s)) return null;
      try { var r = ev(s); return (typeof r === 'number' && isFinite(r)) ? r : null; } catch(e){ return null; }
    }
  };
})(window);

;
/* Elýeterlilik: «Esasy mazmuna geç» salgysy we main bölegi */
(function(){
  "use strict";
  window.initA11y = function(){
    var c = document.querySelectorAll('#siteContent > .container')[1];
    if(c){ c.id = 'main'; c.setAttribute('role','main'); c.setAttribute('tabindex','-1'); }
    var a = document.createElement('a'); a.className = 'skip-link'; a.href = '#main'; a.textContent = 'Esasy mazmuna geçiň';
    document.body.insertBefore(a, document.body.firstChild);
  };
})();

;
/* Esasy giriş nokady: modullar src/scripts/modules/ ýaşaýar */
document.addEventListener('DOMContentLoaded', function(){ if(window.initA11y) window.initA11y(); });
