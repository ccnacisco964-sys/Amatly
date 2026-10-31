function $(id){ return document.getElementById(id); }
function prefersReducedMotion(){ return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

/* ==================================================================
   ROADMAP + PROGRESS (#8, #9) — session-based (resets on page reload)
   Defined early so nothing that runs during setup can reference it
   before it exists.
   ================================================================== */
const ROADMAP = [
  { key:'numbers',      label:'Sanlar',              level:'lvlBaslangyc',  anchor:'topic-unknown-number' },
  { key:'variables',    label:'Üýtgeýänler',         level:'lvlOrta',       anchor:'topic-variables' },
  { key:'expressions',  label:'Aňlatmalar',          level:'lvlOrta',       anchor:'topic-variables' },
  { key:'equations',    label:'Deňlemeler',          level:'lvlOrta',       anchor:'topic-linear-eq' },
  { key:'inequalities', label:'Deňsizlikler',        level:'lvlOrta',       anchor:'topic-inequalities' },
  { key:'functions',    label:'Funksiýalar',         level:'lvlOrta',       anchor:'topic-function-concept' },
  { key:'polynomials',  label:'Polinomlar',          level:'lvlOrta',       anchor:'topic-polynomials' },
  { key:'quadratics',   label:'Kwadrat deňlemeler',  level:'lvlYokary',     anchor:'topic-quadratic' },
  { key:'logarithms',   label:'Logarifmler',         level:'lvlYokary',     anchor:'topic-logarithms' },
  { key:'higher',       label:'Ýokary algebra',      level:'lvlUniwersitet',anchor:'topic-complex' },
];
const progress = {};
ROADMAP.forEach(t=> progress[t.key]=0);

/* ==================================================================
   NUMBER FORMATTING: exact form (fraction / surd) + decimal fallback
   ================================================================== */
function round(x){
  if (!isFinite(x)) return String(x);
  let r = Math.round(x*1e6)/1e6;
  let s = r.toFixed(6).replace(/0+$/,'').replace(/\.$/,'');
  if (s === '-0' || s === '0') s = '0';
  return s;
}
function gcd(x,y){
  x=Math.abs(Math.round(x)); y=Math.abs(Math.round(y));
  if(x===0&&y===0) return 1;
  if(window.math) return Number(math.gcd(x,y)) || 1;
  while(y){ const t=x%y; x=y; y=t; }
  return x || 1;
}

/* Exact fraction "num/den" reduced, plus decimal. Falls back to a plain
   decimal when the inputs aren't whole numbers (can't be exact then). */
function fmtFraction(num, den){
  if (den === 0) return { text:'—', decimal:NaN };
  if (!Number.isInteger(num) || !Number.isInteger(den)){
    const d = num/den;
    return { text: round(d), decimal: d, exactOnly:true };
  }
  if (num === 0) return { text:'0', decimal:0 };
  let sign = (num<0) !== (den<0) ? -1 : 1;
  let n = Math.abs(num), d = Math.abs(den);
  const g = gcd(n,d);
  n/=g; d/=g;
  const decimal = sign*n/d;
  if (d === 1) return { text: String(sign*n), decimal };
  const text = (sign<0?'−':'') + n + '/' + d + ' = ' + round(decimal);
  return { text, decimal, isFraction:true };
}

/* Simplify sqrt(n) into coeff*sqrt(radicand), radicand square-free. n>=0 integer. */
function simplifySqrt(n){
  n = Math.round(Math.abs(n));
  if (n === 0) return { coeff:0, rad:0 };
  let coeff = 1, rad = n;
  for (let i=2; i*i<=rad; i++){
    while (rad % (i*i) === 0){ rad/=(i*i); coeff*=i; }
  }
  return { coeff, rad };
}

/* Full description of ax^2+bx+c=0 roots: exact form (rational / simplified
   surd / complex) plus a decimal approximation, used by both the quadratic
   calculator and the factoring fallback. */
function quadraticRootsDisplay(a,b,c){
  const D = b*b - 4*a*c;
  const allInt = Number.isInteger(a) && Number.isInteger(b) && Number.isInteger(c);
  if (D < 0){
    const re = -b/(2*a), im = Math.sqrt(-D)/(2*a);
    return { D, type:'complex', re: round(re), im: round(Math.abs(im)) };
  }
  if (D === 0){
    const f = fmtFraction(-b, 2*a);
    return { D, type:'double', exact: 'x = ' + f.text, decimal: round(-b/(2*a)) };
  }
  const sq = Math.sqrt(D);
  if (allInt){
    const { coeff, rad } = simplifySqrt(D);
    if (rad === 1){
      const f1 = fmtFraction(-b+coeff, 2*a);
      const f2 = fmtFraction(-b-coeff, 2*a);
      return { D, type:'rational2',
        x1: { exact:f1.text, decimal: round((-b+sq)/(2*a)) },
        x2: { exact:f2.text, decimal: round((-b-sq)/(2*a)) } };
    } else {
      const g = gcd(gcd(Math.abs(b)||coeff, coeff), Math.abs(2*a));
      let bR = -b/g, coeffR = coeff/g, denR = (2*a)/g;
      if (denR < 0){ denR=-denR; bR=-bR; coeffR=-coeffR; }
      if (Object.is(bR,-0)) bR = 0;
      const radStr = (coeffR===1 ? '' : coeffR) + '√' + rad;
      let exact;
      if (bR === 0){
        exact = 'x = ±' + radStr + (denR===1 ? '' : (' / ' + denR));
      } else {
        exact = 'x = (' + bR + ' ± ' + radStr + ')' + (denR===1 ? '' : (' / ' + denR));
      }
      return { D, type:'irrational2', exact,
        x1:{ decimal: round((-b+sq)/(2*a)) }, x2:{ decimal: round((-b-sq)/(2*a)) } };
    }
  }
  return { D, type:'decimal2', x1:{ decimal: round((-b+sq)/(2*a)) }, x2:{ decimal: round((-b-sq)/(2*a)) } };
}

/* ==================================================================
   VALIDATION: read a number from an input, flag it if invalid
   ================================================================== */
function clearFieldErrors(panelEl){
  panelEl.querySelectorAll('[aria-invalid="true"]').forEach(el=>{
    el.removeAttribute('aria-invalid');
  });
  const err = panelEl.querySelector('.field-error');
  if (err) err.remove();
}
function readNum(id){
  const el = $(id);
  const v = parseFloat(el.value);
  return { el, value: v, valid: !isNaN(v) };
}
/* Reads several numeric inputs at once; if any is invalid, marks the
   offending fields, shows "⚠️ Dogry san giriziň." and returns null so the
   caller can bail out of solving. */
function readNums(ids, panelEl){
  clearFieldErrors(panelEl);
  const vals = {};
  let bad = [];
  ids.forEach(id=>{
    const r = readNum(id);
    vals[id] = r.value;
    if (!r.valid) bad.push(r.el);
  });
  if (bad.length){
    bad.forEach(el=> el.setAttribute('aria-invalid','true'));
    const msg = document.createElement('div');
    msg.className = 'field-error';
    msg.textContent = 'Dogry san giriziň.';
    bad[0].closest('.field-row').insertAdjacentElement('afterend', msg);
    return null;
  }
  return vals;
}
const flipSign = (s)=>({">":"<","<":">",">=":"<=","<=":">="}[s]);
const signDisplay = {">":">","<":"<",">=":"≥","<=":"≤"};

/* ==================================================================
   FACTORING: full "ac-method" with grouping steps, used by fac-solve
   ================================================================== */
function findFactorPair(ac, b){
  if (ac === 0) return null;
  const absAc = Math.abs(ac);
  for (let d=1; d*d<=absAc; d++){
    if (absAc % d === 0){
      const e = absAc/d;
      let c1,c2;
      if (ac > 0){ c1=[d,e]; c2=[-d,-e]; } else { c1=[d,-e]; c2=[-d,e]; }
      if (c1[0]+c1[1]===b) return c1;
      if (c2[0]+c2[1]===b) return c2;
    }
  }
  return null;
}
function fmtBinomial(coefX, coefC, varName){
  varName = varName || 'x';
  const xPart = (coefX===1?'':(coefX===-1?'−':coefX)) + varName;
  const cPart = coefC===0 ? '' : (coefC>0 ? ' + '+coefC : ' − '+Math.abs(coefC));
  return xPart + cPart;
}
/* Full AC-method breakdown. Returns {ok:false} only if a=0 (not quadratic).
   Otherwise returns a rich object the caller renders into steps. */
function factorTrinomialAC(a,b,c){
  if (a === 0) return { ok:false };
  const allInt = Number.isInteger(a) && Number.isInteger(b) && Number.isInteger(c);
  if (!allInt){
    return { ok:true, allInt:false, fallback: quadraticRootsDisplay(a,b,c) };
  }
  const g = gcd(gcd(a,b), c) || 1;
  const M = a<0 ? -g : g;
  const A = a/M, B = b/M, C = c/M;

  if (C === 0){
    return { ok:true, allInt:true, commonFactorX:true, M, A, B, C, g };
  }
  const ac = A*C;
  const pair = findFactorPair(ac, B);
  if (!pair){
    return { ok:true, allInt:true, factorable:false, M, A, B, C, g, ac,
      fallback: quadraticRootsDisplay(a,b,c) };
  }
  const [p,q] = pair;
  const g1 = gcd(A, Math.abs(p)) || 1;
  const bin1 = { a: A/g1, b: p/g1 };
  const sgnQ = q<0 ? -1 : 1;
  const g2 = sgnQ * (gcd(Math.abs(q), Math.abs(C)) || 1);
  const bin2 = { a: q/g2, b: C/g2 };
  return { ok:true, allInt:true, factorable:true, M, A, B, C, g, ac, p, q,
    g1, g2, bin1, bin2 };
}

/* ==================================================================
   LEVEL TABS: accessible tablist (roving tabindex + arrow keys)
   ================================================================== */
const tabOrder = ["tabBaslangyc","tabOrta","tabYokary","tabUniwersitet"];
function activateTab(targetPanelId, opts){
  opts = opts || {};
  const tabs = document.querySelectorAll(".level-tab");
  tabs.forEach(t=>{
    const isActive = t.dataset.target === targetPanelId;
    t.classList.toggle("active", isActive);
    t.setAttribute("aria-selected", isActive ? "true" : "false");
    t.tabIndex = isActive ? 0 : -1;
  });
  document.querySelectorAll(".level-panel").forEach(p=> p.hidden = (p.id !== targetPanelId));
  if (opts.focusTab){
    const t = Array.from(tabs).find(t=>t.dataset.target===targetPanelId);
    if (t) t.focus();
  }
}
document.querySelectorAll(".level-tab").forEach(tab=>{
  tab.addEventListener("click", ()=> activateTab(tab.dataset.target));
  tab.addEventListener("keydown", (e)=>{
    const idx = tabOrder.indexOf(tab.id);
    let nextIdx = null;
    if (e.key === "ArrowRight") nextIdx = (idx+1) % tabOrder.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx-1+tabOrder.length) % tabOrder.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = tabOrder.length-1;
    if (nextIdx !== null){
      e.preventDefault();
      const nextTab = $(tabOrder[nextIdx]);
      activateTab(nextTab.dataset.target, { focusTab:true });
    }
  });
});

/* Switch tab + smooth-scroll to (and briefly highlight) a topic anchor.
   Shared by search results, the roadmap panel, and the university jump-links. */
function jumpToTopic(levelId, anchorId){
  activateTab(levelId);
  requestAnimationFrame(()=>{
    const el = $(anchorId);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block:"center" });
    el.classList.add("search-highlight");
    setTimeout(()=> el.classList.remove("search-highlight"), 1700);
  });
}
document.querySelectorAll(".jump-link").forEach(a=>{
  a.addEventListener("click", (e)=>{
    e.preventDefault();
    jumpToTopic(a.dataset.jumpLevel, a.dataset.jumpAnchor);
  });
});
/* ==================================================================
   "Ýakynda goşular" links
   ================================================================== */
let toastTimer = null;
function showSoonToast(label){
  const t = $("soon-toast");
  t.textContent = "\"" + label + "\" bölümi ýakynda goşular. Häzirlikçe Algebra bölümini synap görüň!";
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.remove("show"), 2600);
}
document.querySelectorAll("a.disabled-link").forEach(a=>{
  a.addEventListener("click", (e)=>{
    e.preventDefault();
    const label = a.childNodes[0] ? a.childNodes[0].textContent.trim() : a.textContent.trim();
    showSoonToast(label);
  });
});

/* ==================================================================
   GRAPHS (unchanged drawing logic from the original tool)
   ================================================================== */
function drawNumberLine(v, sign){
  const svg = $("ineq-line");
  const W = 440, H = 90, pad = 30, y = 45;
  const xmin = v - 6, xmax = v + 6;
  const sx = x => pad + (x-xmin)/(xmax-xmin)*(W-2*pad);
  let parts = [];
  parts.push('<line x1="'+pad+'" y1="'+y+'" x2="'+(W-pad)+'" y2="'+y+'" stroke="#8a8a8a" stroke-width="2"/>');
  for (let t = Math.ceil(xmin); t <= Math.floor(xmax); t++){
    const xt = sx(t);
    parts.push('<line x1="'+xt+'" y1="'+(y-5)+'" x2="'+xt+'" y2="'+(y+5)+'" stroke="#8a8a8a" stroke-width="1"/>');
    parts.push('<text x="'+xt+'" y="'+(y+20)+'" font-size="11" text-anchor="middle" fill="#666">'+t+'</text>');
  }
  const closed = (sign === ">=" || sign === "<=");
  const dir = (sign === ">" || sign === ">=") ? 1 : -1;
  const vx = sx(v);
  const rayEnd = dir===1 ? (W-pad) : pad;
  parts.push('<line x1="'+vx+'" y1="'+y+'" x2="'+rayEnd+'" y2="'+y+'" stroke="#2f77c9" stroke-width="4"/>');
  if (dir===1){
    parts.push('<polygon points="'+(W-pad)+','+(y-6)+' '+(W-pad+10)+','+y+' '+(W-pad)+','+(y+6)+'" fill="#2f77c9"/>');
  } else {
    parts.push('<polygon points="'+pad+','+(y-6)+' '+(pad-10)+','+y+' '+pad+','+(y+6)+'" fill="#2f77c9"/>');
  }
  parts.push('<circle cx="'+vx+'" cy="'+y+'" r="6" fill="'+(closed? "#2f77c9":"#fff")+'" stroke="#2f77c9" stroke-width="2.5"/>');
  svg.innerHTML = parts.join('');
}
function drawSlopeLine(m, b){
  const svg = $("slope-graph");
  const W = 320, H = 220, pad = 26;
  const xmin = -8, xmax = 8;
  const y1 = m*xmin + b, y2 = m*xmax + b;
  let ymin = Math.min(y1,y2,b,0), ymax = Math.max(y1,y2,b,0);
  if (ymax - ymin < 4){ ymax += 2; ymin -= 2; }
  const sx = x => pad + (x-xmin)/(xmax-xmin) * (W-2*pad);
  const sy = y => H-pad - (y-ymin)/(ymax-ymin) * (H-2*pad);
  let parts = [];
  parts.push('<line x1="'+pad+'" y1="'+sy(0)+'" x2="'+(W-pad)+'" y2="'+sy(0)+'" stroke="#c7c7c7" stroke-width="1"/>');
  parts.push('<line x1="'+sx(0)+'" y1="'+pad+'" x2="'+sx(0)+'" y2="'+(H-pad)+'" stroke="#c7c7c7" stroke-width="1"/>');
  parts.push('<line x1="'+sx(xmin)+'" y1="'+sy(y1)+'" x2="'+sx(xmax)+'" y2="'+sy(y2)+'" stroke="#2f77c9" stroke-width="2.5"/>');
  if (Math.abs(m) > 1e-9){
    const x0 = 1, x1p = 2;
    const yA = m*x0 + b, yB = m*x1p + b;
    parts.push('<line x1="'+sx(x0)+'" y1="'+sy(yA)+'" x2="'+sx(x1p)+'" y2="'+sy(yA)+'" stroke="#e8a33d" stroke-width="1.5" stroke-dasharray="3,2"/>');
    parts.push('<line x1="'+sx(x1p)+'" y1="'+sy(yA)+'" x2="'+sx(x1p)+'" y2="'+sy(yB)+'" stroke="#e8a33d" stroke-width="1.5" stroke-dasharray="3,2"/>');
    parts.push('<text x="'+((sx(x0)+sx(x1p))/2)+'" y="'+(sy(yA)-5)+'" font-size="10" text-anchor="middle" fill="#b5730c">1</text>');
    parts.push('<text x="'+(sx(x1p)+7)+'" y="'+((sy(yA)+sy(yB))/2)+'" font-size="10" fill="#b5730c">m</text>');
  }
  parts.push('<circle cx="'+sx(0)+'" cy="'+sy(b)+'" r="5" fill="#2f5b1f"/>');
  parts.push('<text x="'+(sx(0)+8)+'" y="'+(sy(b)-8)+'" font-size="11" fill="#2f5b1f">(0, '+b+')</text>');
  svg.innerHTML = parts.join('');
}
function updateSlopeGraph(){
  const m = parseFloat($("slope-m").value);
  const b = parseFloat($("slope-b").value);
  $("slope-m-val").textContent = m;
  $("slope-b-val").textContent = b;
  const mTerm = m===1 ? "x" : (m===-1 ? "−x" : m + "x");
  const bTerm = b===0 ? "" : (b>0 ? " + "+b : " − "+Math.abs(b));
  $("slope-eq").textContent = "y = " + mTerm + bTerm;
  drawSlopeLine(m,b);
  bumpProgress("variables", 5);
}
$("slope-m").addEventListener("input", updateSlopeGraph);
$("slope-b").addEventListener("input", updateSlopeGraph);
updateSlopeGraph();
function drawParabola(a,b,c,roots){
  const svg = $("quad-graph");
  const W = 440, H = 260, pad = 30;
  const vx = -b/(2*a), vy = a*vx*vx + b*vx + c;
  let xs = roots.length ? roots.concat([vx]) : [vx-4, vx+4, vx];
  let xmin = Math.min.apply(null, xs) - 2;
  let xmax = Math.max.apply(null, xs) + 2;
  if (xmax - xmin < 4){ xmin -= 2; xmax += 2; }
  const N = 60;
  let pts = [];
  let ymin = Infinity, ymax = -Infinity;
  for(let i=0;i<=N;i++){
    const x = xmin + (xmax-xmin)*i/N;
    const y = a*x*x + b*x + c;
    pts.push([x,y]);
    if(y<ymin) ymin=y;
    if(y>ymax) ymax=y;
  }
  if (ymin > 0) ymin = 0;
  if (ymax < 0) ymax = 0;
  if (ymax - ymin < 1) { ymax += 1; ymin -= 1; }
  const sx = x => pad + (x-xmin)/(xmax-xmin) * (W-2*pad);
  const sy = y => H-pad - (y-ymin)/(ymax-ymin) * (H-2*pad);
  let svgParts = [];
  if (xmin < 0 && xmax > 0){
    svgParts.push('<line x1="'+sx(0)+'" y1="'+pad+'" x2="'+sx(0)+'" y2="'+(H-pad)+'" stroke="#c7c7c7" stroke-width="1"/>');
  }
  if (ymin < 0 && ymax > 0){
    svgParts.push('<line x1="'+pad+'" y1="'+sy(0)+'" x2="'+(W-pad)+'" y2="'+sy(0)+'" stroke="#c7c7c7" stroke-width="1"/>');
  }
  let path = pts.map(p => sx(p[0])+','+sy(p[1])).join(' ');
  svgParts.push('<polyline points="'+path+'" fill="none" stroke="#2f77c9" stroke-width="2.5"/>');
  svgParts.push('<circle cx="'+sx(vx)+'" cy="'+sy(vy)+'" r="4" fill="#e8a33d"/>');
  roots.forEach(r=>{
    svgParts.push('<circle cx="'+sx(r)+'" cy="'+sy(0)+'" r="4" fill="#2f5b1f"/>');
  });
  svg.innerHTML = svgParts.join('');
}
function renderRoadmap(){
  const stepsEl = $("roadmapSteps");
  stepsEl.innerHTML = "";
  ROADMAP.forEach((t,i)=>{
    const btn = document.createElement("button");
    btn.type = "button";
    const done = progress[t.key] >= 100;
    btn.className = "roadmap-step" + (done ? " done" : "");
    btn.innerHTML = '<span class="rstep-num" aria-hidden="true">' + (done ? '✓' : (i+1)) + '</span> ' + t.label;
    btn.setAttribute("aria-label", t.label + (done ? " — tamamlandy" : ""));
    btn.addEventListener("click", ()=> jumpToTopic(t.level, t.anchor));
    stepsEl.appendChild(btn);
    if (i < ROADMAP.length-1){
      const arrow = document.createElement("span");
      arrow.className = "roadmap-arrow"; arrow.textContent = "→"; arrow.setAttribute("aria-hidden","true");
      stepsEl.appendChild(arrow);
    }
  });
  const barsEl = $("progressBars");
  barsEl.innerHTML = "";
  const overall = Math.round(ROADMAP.reduce((s,t)=>s+progress[t.key],0) / ROADMAP.length);
  const mkRow = (label, pct)=>{
    const row = document.createElement("div"); row.className = "progress-row";
    const lab = document.createElement("span"); lab.className = "p-label"; lab.textContent = label;
    const track = document.createElement("div"); track.className = "progress-track";
    track.setAttribute("role","progressbar");
    track.setAttribute("aria-valuemin","0"); track.setAttribute("aria-valuemax","100");
    track.setAttribute("aria-valuenow", String(pct)); track.setAttribute("aria-label", label + " ösüş");
    const fill = document.createElement("div");
    fill.className = "progress-fill" + (pct>=100 ? " complete" : "");
    fill.style.width = pct + "%";
    track.appendChild(fill);
    const pctEl = document.createElement("span"); pctEl.className = "progress-pct";
    pctEl.textContent = pct + "%" + (pct>=100 ? " ✓" : "");
    row.appendChild(lab); row.appendChild(track); row.appendChild(pctEl);
    return row;
  };
  barsEl.appendChild(mkRow("Algebra", overall));
  ROADMAP.forEach(t=> barsEl.appendChild(mkRow(t.label, progress[t.key])));
}
function bumpProgress(topicKey, amount){
  if (!(topicKey in progress)) return;
  progress[topicKey] = Math.min(100, progress[topicKey] + amount);
  renderRoadmap();
}
const TOPIC_BY_CALC = {
  el:'numbers', lin:'equations', ineq:'inequalities', sys:'equations',
  fac:'polynomials', abs:'equations', quad:'quadratics', seq:'functions',
  exp:'logarithms', dom:'functions', cx:'higher'
};

/* ==================================================================
   XP / STREAK (shared header badge, fed by exercises + elementary game)
   ================================================================== */
let totalXP = 0, bestStreakGlobal = 0;
function addXP(amount){ totalXP += amount; $("xp-total").textContent = totalXP; }
function noteGlobalStreak(streakVal){
  if (streakVal > bestStreakGlobal){ bestStreakGlobal = streakVal; $("xp-best-streak").textContent = bestStreakGlobal; }
}

/* ==================================================================
   SEARCH (#1): keyword index, autocomplete, quadratic/linear parsing,
   routing + prefill, "Tapylmady" fallback
   ================================================================== */
const LEVEL_NAMES = { lvlBaslangyc:"Kiçi synplar", lvlOrta:"Orta synplar", lvlYokary:"Ýokary synplar", lvlUniwersitet:"Uniwersitet" };
const SEARCH_INDEX = [
  { kw:["näbelli san","x näme"], level:"lvlBaslangyc", anchor:"topic-unknown-number", label:"Näbelli san näme?" },
  { kw:["deňlik","terezi kanuny","terezi"], level:"lvlBaslangyc", anchor:"topic-equality", label:"Deňlik — terezi kanuny" },
  { kw:["goşmak deňleme","goşmak"], level:"lvlBaslangyc", anchor:"topic-add-eq", label:"Sada goşmak deňlemeleri" },
  { kw:["aýyrmak deňleme","aýyrmak"], level:"lvlBaslangyc", anchor:"topic-sub-eq", label:"Sada aýyrmak deňlemeleri" },
  { kw:["köpeltmek deňleme","köpeltmek"], level:"lvlBaslangyc", anchor:"topic-mul-eq", label:"Köpeltmek deňlemeleri" },
  { kw:["bölmek deňleme","bölmek"], level:"lvlBaslangyc", anchor:"topic-div-eq", label:"Bölmek deňlemeleri" },
  { kw:["tapmak oýny","oýun","maşk kiçi"], level:"lvlBaslangyc", anchor:"el-input", label:"Näbelli sany tapmak oýny" },
  { kw:["üýtgeýän","aňlatma","algebraik aňlatma"], level:"lvlOrta", anchor:"topic-variables", label:"Üýtgeýänler we aňlatmalar" },
  { kw:["çyzykly deňleme","xyzykly deňleme"], level:"lvlOrta", anchor:"topic-linear-eq", label:"Çyzykly deňlemeler" },
  { kw:["deňsizlik"], level:"lvlOrta", anchor:"topic-inequalities", label:"Deňsizlikler" },
  { kw:["köpagza","polinom orta"], level:"lvlOrta", anchor:"topic-polynomials", label:"Köpagzalar" },
  { kw:["faktorýallaşdyrmak","köpeldijilere aýyrmak","factor"], level:"lvlOrta", anchor:"topic-factoring", label:"Faktorýallaşdyrmak" },
  { kw:["deňlemeler ulgamy","ulgam"], level:"lvlOrta", anchor:"topic-systems", label:"Deňlemeler ulgamy" },
  { kw:["funksiýa düşünjesi","funksiýa näme"], level:"lvlOrta", anchor:"topic-function-concept", label:"Funksiýa düşünjesi" },
  { kw:["grafik","eňňit","kesişme nokady"], level:"lvlOrta", anchor:"topic-slope-graph", label:"Grafikde çyzykly deňlemeler" },
  { kw:["absolýut baha","modul"], level:"lvlOrta", anchor:"topic-abs-value", label:"Absolýut baha" },
  { kw:["maşk merkezi","xp","synag maşky","streak"], level:"lvlOrta", anchor:"ex-orta", label:"Maşk merkezi" },
  { kw:["kwadrat deňleme","kwadrat"], level:"lvlYokary", anchor:"topic-quadratic", label:"Kwadrat deňlemeler" },
  { kw:["kwadrat funksiýa","parabola"], level:"lvlYokary", anchor:"topic-quadratic-func", label:"Kwadrat funksiýalar" },
  { kw:["rasional aňlatma","kesir aňlatma"], level:"lvlYokary", anchor:"topic-rational", label:"Rasional aňlatmalar" },
  { kw:["dereje","kök","kwadrat kök"], level:"lvlYokary", anchor:"topic-powers", label:"Derejeler we kökler" },
  { kw:["logarifm"], level:"lvlYokary", anchor:"topic-logarithms", label:"Logarifmler" },
  { kw:["yzygiderlik","progressiýa","arifmetik","geometrik"], level:"lvlYokary", anchor:"topic-sequences", label:"Yzygiderlikler" },
  { kw:["kesgitleniş oblasty","domain"], level:"lvlYokary", anchor:"topic-domain", label:"Kesgitleniş oblasty" },
  { kw:["eksponensial","görkezýän funksiýa"], level:"lvlYokary", anchor:"topic-exponential", label:"Eksponensial funksiýalar" },
  { kw:["ters funksiýa"], level:"lvlYokary", anchor:"topic-inverse-func", label:"Ters funksiýalar" },
  { kw:["kompleks san","hyýaly san"], level:"lvlUniwersitet", anchor:"topic-complex", label:"Kompleks sanlar" },
  { kw:["algebranyň esasy teoremasy","esasy teorema"], level:"lvlUniwersitet", anchor:"topic-fta", label:"Algebranyň esasy teoremasy" },
  { kw:["induksiýa"], level:"lvlUniwersitet", anchor:"topic-induction", label:"Matematiki induksiýa" },
  { kw:["subutnama","kontrpozisiýa","garşylyk arkaly"], level:"lvlUniwersitet", anchor:"topic-proof-methods", label:"Subutnama usullary" },
  { kw:["topar","halka","meýdan"], level:"lvlUniwersitet", anchor:"topic-groups", label:"Toparlar, halkalar, meýdanlar" },
  { kw:["homomorfizm","izomorfizm"], level:"lvlUniwersitet", anchor:"topic-homomorphism", label:"Homomorfizm we izomorfizm" },
  { kw:["wiýet","polinom nazaryýet"], level:"lvlUniwersitet", anchor:"topic-polynomial-theory", label:"Polinomlar nazaryýeti" },
  { kw:["wektor"], level:"lvlUniwersitet", anchor:"topic-vector-spaces", label:"Wektor giňişlikleri" },
];
function searchMatches(query){
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const scored = [];
  SEARCH_INDEX.forEach(entry=>{
    let score = 0;
    entry.kw.forEach(k=>{
      const kk = k.toLowerCase();
      if (kk === q) score += 10;
      else if (kk.includes(q)) score += 5;
      else if (q.includes(kk)) score += 3;
    });
    if (score>0) scored.push({ entry, score });
  });
  scored.sort((a,b)=> b.score - a.score);
  return scored.map(s=>s.entry);
}
function parseQuadraticExpr(q){
  let s = q.replace(/\s+/g,'').replace(/²/g,'^2').toLowerCase();
  s = s.split('=')[0];
  if (!/x\^?2/.test(s)) return null;
  const terms = s.match(/[+-]?[^+-]+/g);
  if (!terms) return null;
  let a=0,b=0,c=0, sawX2=false, ok=true;
  terms.forEach(t=>{
    if (/^[+-]?\d*\.?\d*x\^?2$/.test(t)){
      let cs = t.replace(/x\^?2$/,'');
      let coef = (cs===''||cs==='+') ? 1 : (cs==='-' ? -1 : parseFloat(cs));
      if (isNaN(coef)) { ok=false; return; }
      a += coef; sawX2 = true;
    } else if (/^[+-]?\d*\.?\d*x$/.test(t)){
      let cs = t.replace(/x$/,'');
      let coef = (cs===''||cs==='+') ? 1 : (cs==='-' ? -1 : parseFloat(cs));
      if (isNaN(coef)) { ok=false; return; }
      b += coef;
    } else if (/^[+-]?\d+\.?\d*$/.test(t)){
      c += parseFloat(t);
    } else { ok=false; }
  });
  if (!ok || !sawX2) return null;
  return { a,b,c };
}
function parseLinearExpr(q){
  let s = q.replace(/\s+/g,'').toLowerCase();
  if (!s.includes('=')) return null;
  const parts = s.split('=');
  if (parts.length !== 2) return null;
  const [lhs, rhs] = parts;
  if (!/x/.test(lhs) || /x/.test(rhs)) return null;
  const rhsVal = parseFloat(rhs);
  if (isNaN(rhsVal)) return null;
  const terms = lhs.match(/[+-]?[^+-]+/g);
  if (!terms) return null;
  let a=0,b=0, sawX=false, ok=true;
  terms.forEach(t=>{
    if (/^[+-]?\d*\.?\d*x$/.test(t)){
      let cs = t.replace(/x$/,'');
      let coef = (cs===''||cs==='+') ? 1 : (cs==='-' ? -1 : parseFloat(cs));
      if (isNaN(coef)) { ok=false; return; }
      a += coef; sawX = true;
    } else if (/^[+-]?\d+\.?\d*$/.test(t)){
      b += parseFloat(t);
    } else { ok=false; }
  });
  if (!ok || !sawX || a===0) return null;
  return { a,b,c:rhsVal };
}
function hideSuggestions(){
  const s = $("searchSuggestions");
  s.hidden = true; s.innerHTML = "";
  $("searchInput").setAttribute("aria-expanded","false");
}
function showSuggestions(query){
  const matches = searchMatches(query).slice(0,8);
  const box = $("searchSuggestions");
  box.innerHTML = "";
  if (!matches.length){ hideSuggestions(); return; }
  matches.forEach(m=>{
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("role","option");
    b.innerHTML = m.label + '<span class="sugg-level">' + LEVEL_NAMES[m.level] + '</span>';
    b.addEventListener("click", ()=>{ $("searchInput").value = m.label; runSearch(m.label); });
    b.addEventListener("keydown", (e)=>{
      if (e.key === "ArrowDown"){ e.preventDefault(); const n=b.nextElementSibling; if(n) n.focus(); }
      else if (e.key === "ArrowUp"){ e.preventDefault(); const p=b.previousElementSibling; if(p) p.focus(); else $("searchInput").focus(); }
      else if (e.key === "Escape"){ hideSuggestions(); $("searchInput").focus(); }
    });
    box.appendChild(b);
  });
  box.hidden = false;
  $("searchInput").setAttribute("aria-expanded","true");
}
function runSearch(query){
  const feedback = $("searchFeedback");
  hideSuggestions();
  if (!query || !query.trim()){ feedback.hidden = true; return; }

  const quad = parseQuadraticExpr(query);
  if (quad){
    activateTab("lvlOrta");
    $("fac-a").value = quad.a; $("fac-b").value = quad.b; $("fac-c").value = quad.c;
    solveFac();
    requestAnimationFrame(()=>{
      const panel = $("fac-a").closest(".game-panel");
      panel.scrollIntoView({ behavior: prefersReducedMotion() ? "auto":"smooth", block:"center" });
      panel.classList.add("search-highlight");
      setTimeout(()=>panel.classList.remove("search-highlight"), 1700);
    });
    feedback.hidden = false; feedback.className = "search-feedback found";
    feedback.textContent = "Tapyldy: Faktorýallaşdyrma kalkulýatorynda " + quad.a + "x² + " + quad.b + "x + (" + quad.c + ") taýýarlandy we çözüldi.";
    return;
  }
  const lin = parseLinearExpr(query);
  if (lin){
    activateTab("lvlOrta");
    $("lin-a").value = lin.a; $("lin-b").value = lin.b; $("lin-c").value = lin.c;
    solveLin();
    requestAnimationFrame(()=>{
      const panel = $("lin-a").closest(".game-panel");
      panel.scrollIntoView({ behavior: prefersReducedMotion() ? "auto":"smooth", block:"center" });
      panel.classList.add("search-highlight");
      setTimeout(()=>panel.classList.remove("search-highlight"), 1700);
    });
    feedback.hidden = false; feedback.className = "search-feedback found";
    feedback.textContent = "Tapyldy: Çyzykly deňleme kalkulýatorynda taýýarlandy we çözüldi.";
    return;
  }
  const matches = searchMatches(query);
  if (matches.length){
    const top = matches[0];
    jumpToTopic(top.level, top.anchor);
    feedback.hidden = false; feedback.className = "search-feedback found";
    feedback.textContent = "Tapyldy: " + top.label + " (" + LEVEL_NAMES[top.level] + ")";
    return;
  }
  feedback.hidden = false; feedback.className = "search-feedback notfound";
  feedback.textContent = "Tapylmady. Başga söz bilen synanyşyň (meselem: \"deňsizlik\", \"logarifm\", ýa-da \"x²+5x+6\").";
}
$("searchInput").addEventListener("input", (e)=>{
  const v = e.target.value;
  if (!v.trim()){ hideSuggestions(); $("searchFeedback").hidden = true; return; }
  showSuggestions(v);
});
$("searchInput").addEventListener("keydown", (e)=>{
  if (e.key === "ArrowDown"){
    const first = $("searchSuggestions").querySelector("button");
    if (first){ e.preventDefault(); first.focus(); }
  } else if (e.key === "Escape"){
    hideSuggestions();
  }
});
$("searchForm").addEventListener("submit", (e)=>{
  e.preventDefault();
  runSearch($("searchInput").value);
});
document.addEventListener("click", (e)=>{
  if (!$("searchForm").contains(e.target)) hideSuggestions();
});
/* ==================================================================
   Shared small helpers used by every calculator below
   ================================================================== */
function makeStepAdder(containerId){
  const el = $(containerId); el.innerHTML = "";
  return (text, cls)=>{ const d=document.createElement("div"); if(cls) d.className=cls; d.textContent=text; el.appendChild(d); return d; };
}
function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function randNonZero(min,max){ let v=0; while(v===0) v=randInt(min,max); return v; }

/* ---------- Kiçi synplar: näbelli sany tap (with difficulty + streak) ---------- */
let elAnswer = 7, elStreak = 0;
function newElementaryProblem(){
  const diff = $("el-diff") ? $("el-diff").value : "medium";
  const ranges = {
    easy:   { addA:[1,8],  addX:[1,10], subA:[1,8],  subB:[1,8],  mulA:[2,5],  mulX:[1,6],  divA:[2,5],  divQ:[1,6] },
    medium: { addA:[1,15], addX:[1,20], subA:[1,15], subB:[1,15], mulA:[2,8],  mulX:[1,10], divA:[2,8],  divQ:[1,10] },
    hard:   { addA:[1,30], addX:[1,40], subA:[1,25], subB:[1,25], mulA:[2,12], mulX:[1,14], divA:[2,12], divQ:[1,14] },
  };
  const r = ranges[diff] || ranges.medium;
  const ops = ["add","sub","mul","div"];
  const op = ops[Math.floor(Math.random()*ops.length)];
  if (op === "add"){
    const a = randInt(r.addA[0], r.addA[1]);
    const x = randInt(r.addX[0], r.addX[1]);
    const b = a + x;
    $("el-equation").textContent = "x + " + a + " = " + b;
    elAnswer = x;
  } else if (op === "sub"){
    const a = randInt(r.subA[0], r.subA[1]);
    const b = randInt(r.subB[0], r.subB[1]);
    const x = a + b;
    $("el-equation").textContent = "x − " + a + " = " + b;
    elAnswer = x;
  } else if (op === "mul"){
    const a = randInt(r.mulA[0], r.mulA[1]);
    const x = randInt(r.mulX[0], r.mulX[1]);
    const b = a * x;
    $("el-equation").textContent = a + " × x = " + b;
    elAnswer = x;
  } else {
    const a = randInt(r.divA[0], r.divA[1]);
    const q = randInt(r.divQ[0], r.divQ[1]);
    const x = a * q;
    $("el-equation").textContent = "x ÷ " + a + " = " + q;
    elAnswer = x;
  }
  $("el-input").value = "";
  $("el-result").hidden = true;
}
$("el-reveal").addEventListener("click", ()=>{
  $("el-answer").textContent = "x = " + elAnswer;
  $("el-answer").className = "answer";
  $("el-result").hidden = false;
  elStreak = 0; $("el-streak").textContent = elStreak;
});
$("el-check").addEventListener("click", ()=>{
  const guess = parseFloat($("el-input").value);
  const ansEl = $("el-answer");
  ansEl.className = "answer";
  if (isNaN(guess)){
    ansEl.textContent = "Ilki bir san ýazyň.";
    ansEl.classList.add("warn");
  } else if (Math.abs(guess-elAnswer) < 1e-9){
    ansEl.textContent = "Dogry! x = " + elAnswer;
    elStreak++; $("el-streak").textContent = elStreak;
    noteGlobalStreak(elStreak);
    addXP(5);
    bumpProgress("numbers", 15);
  } else {
    ansEl.textContent = "Ýalňyş, ýene synanyşyň (kömek gerek bolsa \"Jogaby görkeziň\" basyň).";
    ansEl.classList.add("warn");
    elStreak = 0; $("el-streak").textContent = elStreak;
  }
  $("el-result").hidden = false;
});
$("el-new").addEventListener("click", newElementaryProblem);
$("el-diff").addEventListener("change", newElementaryProblem);
$("el-input").addEventListener("keydown", (e)=>{ if (e.key === "Enter") $("el-check").click(); });

/* ---------- Orta synplar: çyzykly deňleme ---------- */
function solveLin(){
  const panel = $("lin-a").closest(".game-panel");
  const v = readNums(["lin-a","lin-b","lin-c"], panel);
  if (!v) return;
  const a=v["lin-a"], b=v["lin-b"], c=v["lin-c"];
  const add = makeStepAdder("lin-steps");
  const ansEl = $("lin-answer"); ansEl.className = "answer";
  add(a+"x + ("+b+") = "+c);
  add("Maksat: deňlemäniň bir tarapynda diňe \"x\" galar ýaly, beýleki ähli agzalary garşy tarapa geçirmeli.");
  if (a === 0){
    if (b === c){
      add("a = 0 bolansoň, x-iň islendik bahasynda deňlik dogry.");
      ansEl.textContent = "Çözgüt: x — islendik san";
    } else {
      add("a = 0, emma taraplar deň däl.");
      ansEl.textContent = "Çözgüt ýok";
      ansEl.classList.add("warn");
    }
  } else {
    add(a+"x = "+c+" − ("+b+") = "+round(c-b));
    add("Indi deňligiň iki tarapyny-da "+a+" sanyna bölýäris:");
    const f = fmtFraction(c-b, a);
    add("x = ("+round(c-b)+") ÷ "+a);
    ansEl.textContent = "x = " + f.text;
    add("Barlag: "+a+"·("+round(f.decimal)+") + ("+b+") = "+round(a*f.decimal+b)+" (bolmaly "+c+") ✓", "check-step");
    bumpProgress("equations", 25);
  }
  $("lin-result").hidden = false;
  $("lin-similar").hidden = false;
}
$("lin-solve").addEventListener("click", solveLin);
$("lin-similar").addEventListener("click", ()=>{
  const a=randNonZero(-9,9), x=randInt(-12,12), b=randInt(-12,12);
  $("lin-a").value=a; $("lin-b").value=b; $("lin-c").value=a*x+b;
  solveLin();
});

/* ---------- Orta synplar: deňsizlik ---------- */
function solveIneq(){
  const panel = $("ineq-a").closest(".game-panel");
  const v = readNums(["ineq-a","ineq-b","ineq-c"], panel);
  if (!v) return;
  const a=v["ineq-a"], b=v["ineq-b"], c=v["ineq-c"];
  const sign = $("ineq-sign").value;
  const add = makeStepAdder("ineq-steps");
  const ansEl = $("ineq-answer"); ansEl.className = "answer";
  add(a+"x + ("+b+") " + signDisplay[sign] + " " + c);
  add("Ilki hemişelik agzany (b) garşy tarapa geçirýäris:");
  add(a+"x " + signDisplay[sign] + " " + round(c-b));
  if (a === 0){
    let holds;
    switch(sign){ case ">": holds=b>c; break; case "<": holds=b<c; break; case ">=": holds=b>=c; break; default: holds=b<=c; }
    add("a = 0 bolansoň, x ýitýär, diňe sanlary deňeşdirýäris: " + b + " " + signDisplay[sign] + " " + c + " — bu " + (holds?"dogry":"ýalňyş") + ".");
    ansEl.textContent = holds ? "Çözgüt: x — islendik san" : "Çözgüt ýok";
    if (!holds) ansEl.classList.add("warn");
    $("ineq-result").hidden = false; $("ineq-line").innerHTML = ""; $("ineq-similar").hidden=false;
    return;
  }
  let finalSign = sign;
  const f = fmtFraction(c-b, a);
  const threshold = f.decimal;
  if (a < 0){
    finalSign = flipSign(sign);
    add("Iki tarapy-da otrisatel san ("+a+") bolan a-a bölýäris, şonuň üçin alamat öwrülýär:");
  } else {
    add("Iki tarapy-da " + a + " sanyna bölýäris:");
  }
  add("x " + signDisplay[finalSign] + " " + f.text);
  const testX = threshold + (finalSign===">"||finalSign===">=" ? 1 : -1);
  let checkHolds;
  switch(sign){ case ">": checkHolds=a*testX+b>c; break; case "<": checkHolds=a*testX+b<c; break; case ">=": checkHolds=a*testX+b>=c; break; default: checkHolds=a*testX+b<=c; }
  add("Barlag: x = "+round(testX)+" synag hökmünde goýsak → "+a+"·("+round(testX)+") + ("+b+") = "+round(a*testX+b)+" — bu "+(checkHolds?"dogry ✓":"ýalňyş bolsa täzeden barlaň")+".", "check-step");
  ansEl.textContent = "Çözgüt: x " + signDisplay[finalSign] + " " + f.text;
  $("ineq-result").hidden = false;
  drawNumberLine(threshold, finalSign);
  $("ineq-similar").hidden = false;
  bumpProgress("inequalities", 25);
}
$("ineq-solve").addEventListener("click", solveIneq);
$("ineq-similar").addEventListener("click", ()=>{
  const a=randNonZero(-9,9), b=randInt(-12,12), c=randInt(-12,12);
  const signs=[">","<",">=","<="];
  $("ineq-a").value=a; $("ineq-b").value=b; $("ineq-c").value=c; $("ineq-sign").value=signs[randInt(0,3)];
  solveIneq();
});

/* ---------- Orta synplar: deňlemeler ulgamy ---------- */
function solveSys(){
  const panel = $("sys-a1").closest(".game-panel");
  const v = readNums(["sys-a1","sys-b1","sys-c1","sys-a2","sys-b2","sys-c2"], panel);
  if (!v) return;
  const a1=v["sys-a1"], b1=v["sys-b1"], c1=v["sys-c1"], a2=v["sys-a2"], b2=v["sys-b2"], c2=v["sys-c2"];
  const add = makeStepAdder("sys-steps");
  const ansEl = $("sys-answer"); ansEl.className = "answer";
  add(a1+"x + ("+b1+")y = "+c1);
  add(a2+"x + ("+b2+")y = "+c2);
  const D = a1*b2-a2*b1, Dx=c1*b2-c2*b1, Dy=a1*c2-a2*c1;
  add("Esasy determinant: D = a₁b₂ − a₂b₁ = " + round(D));
  if (D !== 0){
    const fx = fmtFraction(Dx, D), fy = fmtFraction(Dy, D);
    add("Dx = c₁b₂ − c₂b₁ = "+round(Dx)+",  Dy = a₁c₂ − a₂c₁ = "+round(Dy));
    add("x = Dx ÷ D = "+fx.text+",  y = Dy ÷ D = "+fy.text);
    add("Barlag (1-nji deňlemä goýup): "+a1+"·("+round(fx.decimal)+") + ("+b1+")·("+round(fy.decimal)+") = "+round(a1*fx.decimal+b1*fy.decimal)+" (bolmaly "+c1+") ✓", "check-step");
    ansEl.textContent = "x = " + fx.text + ",  y = " + fy.text;
    bumpProgress("equations", 25);
  } else if (Dx === 0 && Dy === 0){
    add("D = 0 we Dx = Dy = 0 — iki deňleme aslynda bir dogry çyzygy aňladýar.");
    ansEl.textContent = "Çäksiz çözgüt bar (deňlemeler bir-birine proporsional)";
  } else {
    add("D = 0, emma Dx ýa-da Dy nola deň däl — dogry çyzyklar parallel, kesişmeýär.");
    ansEl.textContent = "Çözgüt ýok (parallel çyzyklar)";
    ansEl.classList.add("warn");
  }
  $("sys-result").hidden = false;
  $("sys-similar").hidden = false;
}
$("sys-solve").addEventListener("click", solveSys);
$("sys-similar").addEventListener("click", ()=>{
  let a1,b1,a2,b2,D;
  do { a1=randNonZero(-6,6); b1=randInt(-6,6); a2=randInt(-6,6); b2=randNonZero(-6,6); D=a1*b2-a2*b1; } while (D===0);
  const x=randInt(-8,8), y=randInt(-8,8);
  $("sys-a1").value=a1; $("sys-b1").value=b1; $("sys-c1").value=a1*x+b1*y;
  $("sys-a2").value=a2; $("sys-b2").value=b2; $("sys-c2").value=a2*x+b2*y;
  solveSys();
});
/* ---------- Orta synplar: kwadrat üçagzany faktorýallaşdyrmak (ac-usuly) ---------- */
function renderFallback(fb, aOrig, add, ansEl){
  if (fb.type === 'complex'){
    add("D = " + fb.D + " < 0 → hakyky sanlaryň üstünde faktorýallaşyp bilinmeýär (iki kompleks kök bar: x = " + fb.re + " ± " + fb.im + "i).");
    ansEl.textContent = "Hakyky sanlarda faktorýallaşyp bilinmeýär (D < 0)";
    ansEl.classList.add("warn");
  } else if (fb.type === 'irrational2'){
    add("D = " + fb.D + " — bu doly kwadrat däl, şonuň üçin kökler irrasional: " + fb.exact + ".");
    add("Takmynan (onluk) görnüş: x₁ ≈ " + fb.x1.decimal + ",  x₂ ≈ " + fb.x2.decimal);
    ansEl.textContent = fb.exact + "  (x₁ ≈ " + fb.x1.decimal + ", x₂ ≈ " + fb.x2.decimal + ")";
  } else if (fb.type === 'rational2'){
    add("Kökler: x₁ = " + fb.x1.exact + ",  x₂ = " + fb.x2.exact);
    ansEl.textContent = "x₁ = " + fb.x1.exact + ",  x₂ = " + fb.x2.exact;
  } else if (fb.type === 'double'){
    add("D = 0 → goşa kök: " + fb.exact);
    ansEl.textContent = fb.exact;
  } else {
    add("Kökler: x₁ ≈ " + fb.x1.decimal + ",  x₂ ≈ " + fb.x2.decimal);
    ansEl.textContent = "x₁ ≈ " + fb.x1.decimal + ",  x₂ ≈ " + fb.x2.decimal;
  }
}
function solveFac(){
  const panel = $("fac-a").closest(".game-panel");
  const v = readNums(["fac-a","fac-b","fac-c"], panel);
  if (!v) return;
  const a=v["fac-a"], b=v["fac-b"], c=v["fac-c"];
  const add = makeStepAdder("fac-steps");
  const ansEl = $("fac-answer"); ansEl.className = "answer";
  $("fac-similar").hidden = true;

  if (a === 0){
    add("a = 0 bolsa bu kwadrat üçagza däl.");
    ansEl.textContent = "a-ny 0-dan başga san saýlaň";
    ansEl.classList.add("warn");
    $("fac-result").hidden = false;
    return;
  }
  add(a+"x² + ("+b+")x + ("+c+")");
  const r = factorTrinomialAC(a,b,c);

  if (!r.allInt){
    add("Koeffisiýentler bitin san bolmansoň, göni köpeldijilere aýyrmak usulyny ulanyp bolmaýar — kök formulasyny ulanýarys.");
    renderFallback(r.fallback, a, add, ansEl);
    $("fac-result").hidden = false; $("fac-similar").hidden = false;
    return;
  }

  if (r.g > 1){
    add("1) Umumy köpeldiji barlaň: ähli agzalaryň umumy köpeldijisi bar → " + r.g + (r.M<0 ? " (we a otrisatel bolany üçin −1 hem çykarýarys)" : "") + ". Ony gapyrgadan çykarýarys:");
    add(r.M + "(" + r.A + "x² + (" + r.B + ")x + (" + r.C + "))");
  } else if (r.M === -1){
    add("1) Umumy köpeldiji barlaň: san taýdan umumy köpeldiji ýok, ýöne a otrisatel bolany üçin −1 çykarýarys:");
    add("−(" + r.A + "x² + (" + r.B + ")x + (" + r.C + "))");
  } else {
    add("1) Umumy köpeldiji barlaň: umumy köpeldiji ýok (diňe 1), göni dowam edýäris.");
  }

  if (r.commonFactorX){
    add("2) c = 0 bolany üçin, x umumy köpeldiji hökmünde gapyrgadan çykýar:");
    const inner = fmtBinomial(r.A, r.B);
    const factored = (r.M===1 ? "" : (r.M===-1 ? "−" : r.M+"·")) + "x(" + inner + ")";
    add("3) Faktorýallaşdyryň: " + factored);
    ansEl.textContent = "Faktorýallaşdyrylan görnüş: " + factored;
    add("Barlag: " + factored + " aňlatmasyny açsak, ýene-de " + a+"x² + ("+b+")x + ("+c+")" + " alynýar ✓", "check-step");
    $("fac-result").hidden = false; $("fac-similar").hidden = false;
    bumpProgress("polynomials", 30);
    return;
  }

  add("2) ac = " + r.A + " · (" + r.C + ") = " + r.ac);

  if (!r.factorable){
    add("Bitin sanlaryň arasynda ac = " + r.ac + " köpeldijilerine aýrylyp, jemi " + r.B + " bolýan jübüt tapylmady — bu üçagza bitin (rasional) köpeldijilere aýrylmaýar. Kök formulasyny ulanýarys:");
    renderFallback(r.fallback, a, add, ansEl);
    $("fac-result").hidden = false; $("fac-similar").hidden = false;
    return;
  }

  add("3) Jemleri " + r.B + " we köpelmesi " + r.ac + " bolan iki san tapyň: " + r.p + " we " + r.q + "  (" + r.p + " + " + r.q + " = " + r.B + ",  " + r.p + " × " + r.q + " = " + r.ac + ")");
  add("4) Orta agzany bölüň: " + r.A + "x² + (" + r.p + ")x + (" + r.q + ")x + (" + r.C + ")");
  const bin1Str = fmtBinomial(r.bin1.a, r.bin1.b);
  const outerStr = fmtBinomial(r.g1, r.g2);
  add("5) Toparlaň: (" + r.A + "x² + (" + r.p + ")x) + ((" + r.q + ")x + (" + r.C + "))");
  add("6) Faktorýallaşdyryň: her toparyň öz umumy köpeldijisini çykaryň → " + r.g1 + "x(" + bin1Str + ") + (" + r.g2 + ")(" + bin1Str + ") = (" + bin1Str + ")(" + outerStr + ")");

  const Mstr = r.M===1 ? "" : (r.M===-1 ? "−" : r.M+"·");
  const factored = Mstr + "(" + bin1Str + ")(" + outerStr + ")";
  ansEl.textContent = "Faktorýallaşdyrylan görnüş: " + factored;

  const A2 = r.bin1.a*r.g1, B2 = r.bin1.a*r.g2 + r.bin1.b*r.g1, C2 = r.bin1.b*r.g2;
  const fa = r.M*A2, fb = r.M*B2, fc = r.M*C2;
  const matches = (fa===a && fb===b && fc===c);
  add("Barlag: (" + bin1Str + ")(" + outerStr + ") açylsa → " + A2 + "x² + (" + r.q + ")x + (" + r.p + ")x + (" + C2 + ") = " + A2 + "x² + (" + B2 + ")x + (" + C2 + ")" + (r.M!==1 ? (", " + r.M + " bilen köpeldilende: " + fa + "x² + (" + fb + ")x + (" + fc + ")") : "") + " — asyl " + a + "x² + (" + b + ")x + (" + c + ") bilen " + (matches ? "gabat gelýär ✓" : "deňeşdir") + ".", "check-step");

  $("fac-result").hidden = false; $("fac-similar").hidden = false;
  bumpProgress("polynomials", 30);
}
$("fac-solve").addEventListener("click", solveFac);
$("fac-similar").addEventListener("click", ()=>{
  const m1=randInt(1,3), m2=randInt(1,3);
  const n1=randNonZero(-9,9), n2=randNonZero(-9,9);
  const M = Math.random()<0.15 ? -1 : 1;
  $("fac-a").value = M*m1*m2;
  $("fac-b").value = M*(m1*n2+m2*n1);
  $("fac-c").value = M*(n1*n2);
  solveFac();
});

/* ---------- Orta synplar: absolýut baha deňlemesi ---------- */
function solveAbs(){
  const panel = $("abs-a").closest(".game-panel");
  const v = readNums(["abs-a","abs-b","abs-c"], panel);
  if (!v) return;
  const a=v["abs-a"], b=v["abs-b"], c=v["abs-c"];
  const add = makeStepAdder("abs-steps");
  const ansEl = $("abs-answer"); ansEl.className = "answer";
  add("|"+a+"x + ("+b+")| = "+c);
  if (a === 0){
    add("a = 0 bolsa, deňlemäniň çep tarapy hemişe |"+b+"| bolýar we x görünmeýär.");
    if (Math.abs(b) === c){ ansEl.textContent = "Çözgüt: x — islendik san"; }
    else { ansEl.textContent = "Çözgüt ýok"; ansEl.classList.add("warn"); }
    $("abs-result").hidden = false; $("abs-similar").hidden = false;
    return;
  }
  if (c < 0){
    add("Absolýut baha hemişe otrisatel bolmadyk san bolýar, ýöne deňlemäniň sag tarapy otrisatel ("+c+"). Şonuň üçin çözgüt ýok.");
    ansEl.textContent = "Çözgüt ýok (absolýut baha otrisatel bolup bilmez)";
    ansEl.classList.add("warn");
    $("abs-result").hidden = false; $("abs-similar").hidden = false;
    return;
  }
  add("Absolýut baha kadasy boýunça iki ýagdaý bar: ýa aňlatma c-a deň, ýa-da −c-a deň.");
  const f1 = fmtFraction(c-b, a), f2 = fmtFraction(-c-b, a);
  add("1) "+a+"x + ("+b+") = "+c+" → x = "+f1.text);
  add("2) "+a+"x + ("+b+") = "+(-c)+" → x = "+f2.text);
  add("Barlag: |"+a+"·("+round(f1.decimal)+") + ("+b+")| = "+round(Math.abs(a*f1.decimal+b))+" (bolmaly "+c+") ✓", "check-step");
  ansEl.textContent = (c === 0) ? ("x = "+f1.text+" (ýeke-täk çözgüt, sebäbi c = 0)") : ("x₁ = "+f1.text+",  x₂ = "+f2.text);
  $("abs-result").hidden = false; $("abs-similar").hidden = false;
  bumpProgress("equations", 20);
}
$("abs-solve").addEventListener("click", solveAbs);
$("abs-similar").addEventListener("click", ()=>{
  const a=randNonZero(-8,8), b=randInt(-10,10), c=randInt(0,12);
  $("abs-a").value=a; $("abs-b").value=b; $("abs-c").value=c;
  solveAbs();
});
/* ---------- Ýokary synplar: kwadrat deňleme + grafik ---------- */
function solveQuad(){
  const panel = $("quad-a").closest(".game-panel");
  const v = readNums(["quad-a","quad-b","quad-c"], panel);
  if (!v) return;
  const a=v["quad-a"], b=v["quad-b"], c=v["quad-c"];
  const add = makeStepAdder("quad-steps");
  const ansEl = $("quad-answer"); ansEl.className = "answer";
  if (a === 0){
    add("a = 0 bolsa, bu kwadrat deňleme däl-de çyzykly deňleme bolýar.");
    ansEl.textContent = "a-ny 0-dan başga san saýlaň";
    ansEl.classList.add("warn");
    $("quad-result").hidden = false; $("quad-graph").innerHTML = ""; $("quad-similar").hidden = false;
    return;
  }
  const rd = quadraticRootsDisplay(a,b,c);
  add("D = b² − 4ac = ("+b+")² − 4·"+a+"·"+c+" = "+round(rd.D));
  add("Diskriminantyň alamaty kökleriň sanyny kesgitleýär: D>0 — 2 hakyky kök, D=0 — 1 kök, D<0 — hakyky kök ýok.");
  let roots = [];
  if (rd.type === 'irrational2'){
    add("D > 0 → iki hakyky kök bar, ýöne D doly kwadrat däl, şonuň üçin takyk görnüşi köküň aşagynda galýar:");
    add(rd.exact);
    add("Takmynan (onluk) görnüş: x₁ ≈ "+rd.x1.decimal+",  x₂ ≈ "+rd.x2.decimal);
    ansEl.textContent = rd.exact + "  (x₁ ≈ "+rd.x1.decimal+", x₂ ≈ "+rd.x2.decimal+")";
    roots = [parseFloat(rd.x1.decimal), parseFloat(rd.x2.decimal)];
  } else if (rd.type === 'rational2'){
    add("D > 0 → iki hakyky kök bar");
    add("x = (−b ± √D) ÷ 2a");
    add("Barlag (Wiýetiň formulalary): x₁+x₂ = "+round(parseFloat(rd.x1.decimal)+parseFloat(rd.x2.decimal))+" (bolmaly −b/a = "+round(-b/a)+"),  x₁·x₂ = "+round(parseFloat(rd.x1.decimal)*parseFloat(rd.x2.decimal))+" (bolmaly c/a = "+round(c/a)+")", "check-step");
    ansEl.textContent = "x₁ = "+rd.x1.exact+",  x₂ = "+rd.x2.exact;
    roots = [parseFloat(rd.x1.decimal), parseFloat(rd.x2.decimal)];
  } else if (rd.type === 'decimal2'){
    add("D > 0 → iki hakyky kök bar (koeffisiýentler bitin san bolmansoň, diňe onluk görnüşde görkezilýär)");
    add("x = (−b ± √D) ÷ 2a");
    ansEl.textContent = "x₁ ≈ "+rd.x1.decimal+",  x₂ ≈ "+rd.x2.decimal;
    roots = [parseFloat(rd.x1.decimal), parseFloat(rd.x2.decimal)];
  } else if (rd.type === 'double'){
    add("D = 0 → bir hakyky kök bar (goşa kök)");
    add("Bu ýagdaýda parabola x okuna diňe depe nokadynda galtaşýar.");
    ansEl.textContent = rd.exact;
    roots = [-b/(2*a)];
  } else {
    add("D < 0 → hakyky kök ýok, iki kompleks kök bar");
    add("Bu ýagdaýda parabola x okuny asla kesip geçmeýär (doly ýokarda ýa-da doly aşakda ýerleşýär).");
    ansEl.textContent = "x = "+rd.re+" ± "+rd.im+"i";
    roots = [];
  }
  $("quad-result").hidden = false;
  drawParabola(a,b,c,roots);
  $("quad-similar").hidden = false;
  bumpProgress("quadratics", 25);
}
$("quad-solve").addEventListener("click", solveQuad);
$("quad-similar").addEventListener("click", ()=>{
  const a=randNonZero(-5,5), b=randInt(-10,10), c=randInt(-10,10);
  $("quad-a").value=a; $("quad-b").value=b; $("quad-c").value=c;
  solveQuad();
});

/* ---------- Ýokary synplar: yzygiderlik ---------- */
$("seq-type").addEventListener("change", (e)=>{
  $("seq-diff-label").textContent = e.target.value === "arithmetic" ? "d (tapawut)" : "r (gatnaşyk)";
});
function solveSeq(){
  const panel = $("seq-a1").closest(".game-panel");
  const v = readNums(["seq-a1","seq-diff","seq-n"], panel);
  if (!v) return;
  const type = $("seq-type").value;
  const a1 = v["seq-a1"], diff = v["seq-diff"];
  const n = Math.round(v["seq-n"]);
  const add = makeStepAdder("seq-steps");
  const ansEl = $("seq-answer"); ansEl.className = "answer";
  if (n < 1){
    add("n položitel bitin san bolmaly (n ≥ 1).");
    ansEl.textContent = "n-i 1-den uly san saýlaň";
    ansEl.classList.add("warn");
    $("seq-result").hidden = false; $("seq-similar").hidden = false;
    return;
  }
  if (type === "arithmetic"){
    add("aₙ = a₁ + (n−1)·d");
    const an = a1 + (n-1)*diff;
    const sum = n*(2*a1+(n-1)*diff)/2;
    add("a"+n+" = "+a1+" + ("+n+"−1)·"+diff+" = "+round(an));
    add("Barlag (alternatiw jem formulasy): S = n·(a₁+aₙ)/2 = "+n+"·("+a1+"+"+round(an)+")/2 = "+round(n*(a1+an)/2)+" ✓", "check-step");
    ansEl.textContent = "a"+n+" = " + round(an) + ",  ilkinji " + n + " agzanyň jemi = " + round(sum);
  } else {
    add("aₙ = a₁ · rⁿ⁻¹");
    const an = a1*Math.pow(diff, n-1);
    const sum = diff === 1 ? a1*n : a1*(1-Math.pow(diff,n))/(1-diff);
    add("a"+n+" = "+a1+" · "+diff+"^("+n+"−1) = "+round(an));
    if (Math.abs(diff) < 1 && diff !== 0){
      add("Bellik: |r| = "+round(Math.abs(diff))+" < 1 bolany üçin, agzalaryň sany çäksiz artanda jem S = a₁/(1−r) = "+round(a1/(1-diff))+" bahasyna golaýlaýar (çäksiz geometrik yzygiderligiň jemi).");
    }
    add("Barlag: aₙ ÷ aₙ₋₁ gatnaşygy ýene-de r = "+diff+" bermeli.", "check-step");
    ansEl.textContent = "a"+n+" = " + round(an) + ",  ilkinji " + n + " agzanyň jemi = " + round(sum);
  }
  $("seq-result").hidden = false;
  $("seq-similar").hidden = false;
  bumpProgress("functions", 20);
}
$("seq-solve").addEventListener("click", solveSeq);
$("seq-similar").addEventListener("click", ()=>{
  const type = Math.random()<0.5 ? "arithmetic" : "geometric";
  $("seq-type").value = type;
  $("seq-diff-label").textContent = type==="arithmetic" ? "d (tapawut)" : "r (gatnaşyk)";
  $("seq-a1").value = randNonZero(-10,10);
  $("seq-diff").value = type==="arithmetic" ? randNonZero(-6,6) : randNonZero(-3,3);
  $("seq-n").value = randInt(3,10);
  solveSeq();
});

/* ---------- Ýokary synplar: eksponensial deňleme ---------- */
function solveExp(){
  const panel = $("exp-a").closest(".game-panel");
  const v = readNums(["exp-a","exp-b"], panel);
  if (!v) return;
  const a=v["exp-a"], b=v["exp-b"];
  const add = makeStepAdder("exp-steps");
  const ansEl = $("exp-answer"); ansEl.className = "answer";
  add(a+"ˣ = "+b);
  if (a <= 0 || a === 1){
    add("Esas (a) položitel we 1-den başga bolmaly (a > 0, a ≠ 1).");
    ansEl.textContent = "Nädogry esas";
    ansEl.classList.add("warn");
    $("exp-result").hidden = false; $("exp-similar").hidden = false;
    return;
  }
  if (b <= 0){
    add(a+"ˣ hemişe položitel san bolýar (islendik x üçin), şonuň üçin ol otrisatel ýa-da nol san bolan "+b+"-a deň bolup bilmez.");
    ansEl.textContent = "Çözgüt ýok";
    ansEl.classList.add("warn");
    $("exp-result").hidden = false; $("exp-similar").hidden = false;
    return;
  }
  add("Iki tarapdan-da logarifm alýarys: x = logₐ(b) = ln(b) ÷ ln(a)");
  const x = Math.log(b)/Math.log(a);
  const kRound = Math.round(x);
  let exactNote = "";
  if (Number.isInteger(a) && Math.abs(Math.pow(a,kRound)-b) < 1e-6){
    exactNote = "  (takyk: " + a + "^" + kRound + " = " + b + ")";
    add("Bellik: " + a + "^" + kRound + " = " + b + " bolany üçin, x takyk " + kRound + " bahasyna deň.");
  }
  add("x = ln("+b+") ÷ ln("+a+") = "+round(Math.log(b))+" ÷ "+round(Math.log(a)));
  add("Barlag: "+a+"^("+round(x)+") = "+round(Math.pow(a,x))+" (bolmaly "+b+") ✓", "check-step");
  ansEl.textContent = "x = " + round(x) + exactNote;
  $("exp-result").hidden = false;
  $("exp-similar").hidden = false;
  bumpProgress("logarithms", 25);
}
$("exp-solve").addEventListener("click", solveExp);
$("exp-similar").addEventListener("click", ()=>{
  const a = randInt(2,6);
  const b = Math.random()<0.5 ? Math.pow(a, randInt(1,4)) : randInt(2,200);
  $("exp-a").value=a; $("exp-b").value=b;
  solveExp();
});

/* ---------- Ýokary synplar: kesgitleniş oblasty ---------- */
function solveDom(){
  const panel = $("dom-a").closest(".game-panel");
  const v = readNums(["dom-a","dom-b"], panel);
  if (!v) return;
  const a=v["dom-a"], b=v["dom-b"];
  const add = makeStepAdder("dom-steps");
  const ansEl = $("dom-answer"); ansEl.className = "answer";
  add("y = 1 ÷ ("+a+"x + ("+b+"))");
  if (a === 0){
    if (b === 0){
      add("Paýda hemişe 0 bolýar, bu funksiýa hiç bir x üçin kesgitlenmeýär.");
      ansEl.textContent = "Kesgitleniş oblasty: boş (funksiýa ýok)";
      ansEl.classList.add("warn");
    } else {
      add("Paýda x ýok we ol hiç haçan 0-a deň bolmaýar ("+b+" ≠ 0).");
      ansEl.textContent = "Kesgitleniş oblasty: ähli hakyky sanlar";
    }
    $("dom-result").hidden = false; $("dom-similar").hidden = false;
    return;
  }
  const f = fmtFraction(-b, a);
  add("Paýyň (aşaky köpagzanyň) nola deň bolýan ýerini tapýarys: "+a+"x + ("+b+") = 0 → x = "+f.text);
  add("Bu bahada bölmek mümkin däl, şonuň üçin ony kesgitleniş oblastyndan aýyrýarys.");
  add("Barlag: "+a+"·("+round(f.decimal)+") + ("+b+") = "+round(a*f.decimal+b)+" (0 bolmaly) ✓", "check-step");
  ansEl.textContent = "Kesgitleniş oblasty: x ≠ " + f.text.split(' = ')[0] + " bolan ähli hakyky sanlar";
  $("dom-result").hidden = false; $("dom-similar").hidden = false;
  bumpProgress("functions", 20);
}
$("dom-solve").addEventListener("click", solveDom);
$("dom-similar").addEventListener("click", ()=>{
  $("dom-a").value = randNonZero(-8,8); $("dom-b").value = randInt(-10,10);
  solveDom();
});

/* ---------- Uniwersitet: kompleks san ---------- */
function solveCx(){
  const panel = $("cx-a").closest(".game-panel");
  const v = readNums(["cx-a","cx-b","cx-c","cx-d"], panel);
  if (!v) return;
  const a=v["cx-a"], b=v["cx-b"], c=v["cx-c"], d=v["cx-d"];
  const op = $("cx-op").value;
  const add = makeStepAdder("cx-steps");
  const ansEl = $("cx-answer"); ansEl.className = "answer";
  const z1 = round(a) + (b>=0? " + " : " − ") + round(Math.abs(b)) + "i";
  const z2 = round(c) + (d>=0? " + " : " − ") + round(Math.abs(d)) + "i";
  let re, im;
  if (op === "add"){ add("("+z1+") + ("+z2+")"); add("Hakyky böleklerini we hyýaly böleklerini aýratynlykda goşýarys."); re=a+c; im=b+d; }
  else if (op === "sub"){ add("("+z1+") − ("+z2+")"); add("Hakyky böleklerini we hyýaly böleklerini aýratynlykda aýyrýarys."); re=a-c; im=b-d; }
  else if (op === "mul"){ add("("+z1+") · ("+z2+")"); add("Köpagzalary köpeldişi ýaly açýarys we i² = −1 diýip çalyşýarys."); re=a*c-b*d; im=a*d+b*c; }
  else {
    const denom = c*c+d*d;
    if (denom === 0){
      add("Bölmek mümkin däl, sebäbi ikinji san 0-a deň.");
      ansEl.textContent = "Bölmek mümkin däl (ikinji san 0)";
      ansEl.classList.add("warn");
      $("cx-result").hidden = false; $("cx-similar").hidden = false;
      return;
    }
    const negD = -d;
    const conj2 = round(c) + (negD>=0? " + " : " − ") + round(Math.abs(negD)) + "i";
    add("("+z1+") ÷ ("+z2+")");
    add("Ýokarky we aşaky sanlary ikinji sanyň jübüdine ("+conj2+") köpeldip, aşaky sany hakyky san edýäris.");
    re = (a*c+b*d)/denom; im = (b*c-a*d)/denom;
  }
  const sign = im >= 0 ? "+" : "−";
  const modulus = Math.sqrt(re*re+im*im);
  add("Netijäniň moduly: |z| = √(("+round(re)+")² + ("+round(im)+")²) ≈ " + round(modulus));
  if (op === "mul" || op === "div"){
    const m1 = Math.sqrt(a*a+b*b), m2 = Math.sqrt(c*c+d*d);
    if (op === "mul"){
      add("Barlag: |z₁·z₂| = |z₁|·|z₂| bolmaly → "+round(m1)+" · "+round(m2)+" = "+round(m1*m2)+" (ýokardaky modul: "+round(modulus)+") ✓", "check-step");
    } else {
      add("Barlag: |z₁÷z₂| = |z₁|÷|z₂| bolmaly → "+round(m1)+" ÷ "+round(m2)+" = "+round(m1/m2)+" (ýokardaky modul: "+round(modulus)+") ✓", "check-step");
    }
  }
  ansEl.textContent = "Netije = " + round(re) + " " + sign + " " + round(Math.abs(im)) + "i";
  $("cx-result").hidden = false; $("cx-similar").hidden = false;
  bumpProgress("higher", 20);
}
$("cx-solve").addEventListener("click", solveCx);
$("cx-similar").addEventListener("click", ()=>{
  const ops=["add","sub","mul","div"];
  $("cx-a").value=randInt(-9,9); $("cx-b").value=randInt(-9,9);
  $("cx-c").value=randNonZero(-9,9); $("cx-d").value=randInt(-9,9);
  $("cx-op").value = ops[randInt(0,3)];
  solveCx();
});
/* ==================================================================
   MAŞK MERKEZI (#7): topic + difficulty + count → generated drill
   with streak / XP, for Orta synplar
   ================================================================== */
const exOrta = { topic:"lin", diff:"medium", total:10, idx:0, correct:0, streak:0, bestStreak:0, xp:0, current:null };

function genLinQ(diff){
  const R = { easy:{amax:6,xmax:10,bmax:10}, medium:{amax:9,xmax:14,bmax:14}, hard:{amax:12,bmax:20}, olympiad:{amax:14,bmax:25} }[diff];
  let a,b,c,x;
  if (diff === "easy" || diff === "medium"){
    a = randNonZero(-R.amax,R.amax); x = randInt(-R.xmax,R.xmax); b = randInt(-R.bmax,R.bmax); c = a*x+b;
  } else {
    a = randNonZero(-R.amax,R.amax); b = randInt(-R.bmax,R.bmax); c = randInt(-R.bmax,R.bmax); x = (c-b)/a;
  }
  return { text: a+"x " + (b>=0?"+ "+b:"− "+Math.abs(b)) + " = " + c + "  — x-i tapyň", expected:[x], orderMatters:true };
}
function genIneqQ(diff){
  const R = { easy:{amax:6,bmax:8,cmax:10}, medium:{amax:8,bmax:10,cmax:12}, hard:{amax:10,bmax:14,cmax:16}, olympiad:{amax:12,bmax:18,cmax:20} }[diff];
  const a = randNonZero(-R.amax,R.amax), b = randInt(-R.bmax,R.bmax), c = randInt(-R.cmax,R.cmax);
  const signs = [">","<",">=","<="]; const sign = signs[randInt(0,3)];
  const threshold = (c-b)/a;
  return { text: a+"x " + (b>=0?"+ "+b:"− "+Math.abs(b)) + " " + signDisplay[sign] + " " + c + "  — x-iň serhet bahasyny tapyň", expected:[threshold], orderMatters:true };
}
function genFacQ(diff){
  const R = { easy:{m:1,n:6}, medium:{m:2,n:8}, hard:{m:3,n:10}, olympiad:{m:4,n:12} }[diff];
  const m1 = randInt(1,R.m), m2 = randInt(1,R.m);
  const n1 = randNonZero(-R.n,R.n), n2 = randNonZero(-R.n,R.n);
  const a = m1*m2, b = m1*n2+m2*n1, c = n1*n2;
  const x1 = -n1/m1, x2 = -n2/m2;
  return { text: a+"x² " + (b>=0?"+ "+b:"− "+Math.abs(b)) + "x " + (c>=0?"+ "+c:"− "+Math.abs(c)) + " = 0  — köklerini tapyň (meselem: 2, -5)", expected:[x1,x2], orderMatters:false };
}
function genSysQ(diff){
  const R = { easy:{rng:5,xy:6}, medium:{rng:6,xy:8}, hard:{rng:8,xy:10}, olympiad:{rng:9,xy:12} }[diff];
  let a1,b1,a2,b2,D;
  do { a1=randNonZero(-R.rng,R.rng); b1=randInt(-R.rng,R.rng); a2=randInt(-R.rng,R.rng); b2=randNonZero(-R.rng,R.rng); D=a1*b2-a2*b1; } while (D===0);
  const x = randInt(-R.xy,R.xy), y = randInt(-R.xy,R.xy);
  const c1 = a1*x+b1*y, c2 = a2*x+b2*y;
  return { text: a1+"x + ("+b1+")y = "+c1+"  we  "+a2+"x + ("+b2+")y = "+c2+"  — x, y tapyň", expected:[x,y], orderMatters:true };
}
function genAbsQ(diff){
  const R = { easy:{amax:6,bmax:8,cmax:8}, medium:{amax:8,bmax:10,cmax:12}, hard:{amax:10,bmax:12,cmax:14}, olympiad:{amax:12,bmax:16,cmax:18} }[diff];
  const a = randNonZero(-R.amax,R.amax), b = randInt(-R.bmax,R.bmax), c = randInt(0,R.cmax);
  const x1 = (c-b)/a, x2 = (-c-b)/a;
  return { text: "|"+a+"x " + (b>=0?"+ "+b:"− "+Math.abs(b)) + "| = "+c+"  — köklerini tapyň", expected: c===0 ? [x1] : [x1,x2], orderMatters:false };
}
const EX_GENERATORS = { lin:genLinQ, ineq:genIneqQ, fac:genFacQ, sys:genSysQ, abs:genAbsQ };

function checkExAnswer(inputStr, expected, orderMatters){
  const parts = inputStr.split(/[\s,;]+/).filter(Boolean).map(Number);
  if (parts.length !== expected.length || parts.some(isNaN)) return false;
  const close = (x,y)=> Math.abs(x-y) < 0.06;
  if (orderMatters) return parts.every((p,i)=> close(p, expected[i]));
  if (expected.length === 1) return close(parts[0], expected[0]);
  return (close(parts[0],expected[0]) && close(parts[1],expected[1])) || (close(parts[0],expected[1]) && close(parts[1],expected[0]));
}

function exOrtaRenderQuestion(){
  $("ex-orta-idx").textContent = exOrta.idx+1;
  $("ex-orta-total").textContent = exOrta.total;
  $("ex-orta-correct").textContent = exOrta.correct;
  $("ex-orta-streak").textContent = exOrta.streak;
  $("ex-orta-xp").textContent = exOrta.xp;
  exOrta.current = EX_GENERATORS[exOrta.topic](exOrta.diff);
  $("ex-orta-question").textContent = exOrta.current.text;
  $("ex-orta-input").value = "";
  $("ex-orta-feedback").textContent = "";
  $("ex-orta-feedback").className = "ex-feedback";
  $("ex-orta-input").focus();
}
function exOrtaNext(){
  exOrta.idx++;
  if (exOrta.idx >= exOrta.total){ exOrtaFinish(); } else { exOrtaRenderQuestion(); }
}
function exOrtaFinish(){
  $("ex-orta-live").hidden = true;
  const box = $("ex-orta-summary");
  box.hidden = false;
  box.innerHTML = "<svg class='ic' aria-hidden='true'><use href='#ic-flag'/></svg> <strong>Netije:</strong> " + exOrta.correct + "/" + exOrta.total + " dogry &nbsp;·&nbsp; <svg class='ic' aria-hidden='true'><use href='#ic-star'/></svg> XP: +" + exOrta.xp + " &nbsp;·&nbsp; <svg class='ic' aria-hidden='true'><use href='#ic-flame'/></svg> Iň uzyn yzygiderlik: " + exOrta.bestStreak;
  const topicKey = { lin:"equations", ineq:"inequalities", fac:"polynomials", sys:"equations", abs:"equations" }[exOrta.topic];
  bumpProgress(topicKey, Math.round(30*exOrta.correct/exOrta.total));
}
$("ex-orta-start").addEventListener("click", ()=>{
  exOrta.topic = $("ex-orta-topic").value;
  exOrta.diff = $("ex-orta-diff").value;
  exOrta.total = parseInt($("ex-orta-count").value, 10);
  exOrta.idx = 0; exOrta.correct = 0; exOrta.streak = 0; exOrta.bestStreak = 0; exOrta.xp = 0;
  $("ex-orta-summary").hidden = true;
  $("ex-orta-live").hidden = false;
  exOrtaRenderQuestion();
});
$("ex-orta-check").addEventListener("click", ()=>{
  const val = $("ex-orta-input").value.trim();
  const fb = $("ex-orta-feedback");
  if (!val){ fb.textContent = "Ilki jogap ýazyň."; fb.className = "ex-feedback bad"; return; }
  const ok = checkExAnswer(val, exOrta.current.expected, exOrta.current.orderMatters);
  if (ok){
    exOrta.correct++; exOrta.streak++; exOrta.bestStreak = Math.max(exOrta.bestStreak, exOrta.streak);
    const gained = 10 + (exOrta.streak>=3 ? 5 : 0);
    exOrta.xp += gained; addXP(gained); noteGlobalStreak(exOrta.streak);
    fb.textContent = "Dogry! +" + gained + " XP" + (exOrta.streak>=3 ? "  · streak bonusy!" : "");
    fb.className = "ex-feedback ok";
  } else {
    exOrta.streak = 0;
    fb.textContent = "Ýalňyş. Dogry jogap: " + exOrta.current.expected.map(n=>round(n)).join(", ");
    fb.className = "ex-feedback bad";
  }
  $("ex-orta-correct").textContent = exOrta.correct;
  $("ex-orta-streak").textContent = exOrta.streak;
  $("ex-orta-xp").textContent = exOrta.xp;
  setTimeout(exOrtaNext, 1300);
});
$("ex-orta-input").addEventListener("keydown", (e)=>{ if (e.key === "Enter") $("ex-orta-check").click(); });
$("ex-orta-skip").addEventListener("click", ()=>{
  exOrta.streak = 0;
  const fb = $("ex-orta-feedback");
  fb.textContent = "Geçildi. Jogap: " + exOrta.current.expected.map(n=>round(n)).join(", ");
  fb.className = "ex-feedback bad";
  setTimeout(exOrtaNext, 900);
});

/* ==================================================================
   INIT
   ================================================================== */
renderRoadmap();
newElementaryProblem();
