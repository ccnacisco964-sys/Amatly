(function () {
'use strict';

/* src/scripts/modules/search.js */
function initSearch() {
  document.getElementById("searchForm").addEventListener("submit", function(e){ e.preventDefault(); });
}

/* src/scripts/modules/math-utils.js */
function gcdSteps(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  const steps = [];
  let x = a, y = b;
  if (y === 0) { steps.push(`Ikinji san 0, şonuň üçin netije = ${a}.`); return { gcd: a, steps }; }
  while (y !== 0) {
    const q = Math.floor(x / y);
    const r = x - q * y;
    steps.push(`${x} = ${y} × ${q} + ${r}`);
    x = y; y = r;
  }
  steps.push(`Galyndy 0 boldy. Iň soňky nol däl galyndy ${x} — iň uly umumy bölüji.`);
  return { gcd: x, steps };
}
function gcdPlain(a,b){
  a=Math.abs(a); b=Math.abs(b);
  if(window.math && Number.isInteger(a) && Number.isInteger(b)) return Number(math.gcd(a,b));
  while(b){const t=a%b;a=b;b=t;}
  return a;
}
function lcmPlain(a,b){
  a=Math.abs(a); b=Math.abs(b);
  if(window.math && Number.isInteger(a) && Number.isInteger(b)) return Number(math.lcm(a,b));
  return a*b/gcdPlain(a,b);
}

function simplifyFraction(num, den){
  if(den===0) throw new Error('Maýdalawjy 0 bolup bilmez.');
  const sign = ((num<0) !== (den<0)) ? -1 : 1;
  num = Math.abs(num); den = Math.abs(den);
  const {gcd:g, steps} = gcdSteps(num,den);
  const sn = sign*(num/g), sd = den/g;
  return {g, steps, sn, sd};
}

function fracStr(n,d){ return d===1 ? `${n}` : `${n}/${d}`; }

/* src/scripts/modules/output.js */
function showError(box, message){
  box.hidden = false;
  box.innerHTML = `<p class="error-line">${message}</p>`;
}
function showSteps(box, lines, resultHTML){
  box.hidden = false;
  let html = '<ol>' + lines.map(l => `<li>${l}</li>`).join('') + '</ol>';
  if(resultHTML) html += `<div class="result-line">${resultHTML}</div>`;
  box.innerHTML = html;
}

/* src/scripts/modules/calc-gcd-lcm.js */
/* ---------- 1. GCD / LCM ---------- */
function initGcdLcm() {
  document.getElementById('form-be').addEventListener('submit', function(e){
    e.preventDefault();
    const out = document.getElementById('be-out');
    const a = Number(document.getElementById('be-a').value);
    const b = Number(document.getElementById('be-b').value);
    if(!Number.isInteger(a) || !Number.isInteger(b)){ showError(out, 'Iki sany hem bitin san hökmünde giriziň.'); return; }
    if(a===0 && b===0){ showError(out, 'Iki san birbada 0 bolup bilmez.'); return; }
    const {gcd:g, steps} = gcdSteps(a,b);
    const l = lcmPlain(a,b);
    const lines = steps.slice();
    showSteps(out, lines, `IUUB(${a}, ${b}) = ${g}  •  IUKS(${a}, ${b}) = (${Math.abs(a)} × ${Math.abs(b)}) ÷ ${g} = ${l}`);
  });
}

/* src/scripts/modules/calc-simplify-fraction.js */
/* ---------- 2. Simplify fraction ---------- */
function initSimplifyFraction() {
  document.getElementById('form-ks').addEventListener('submit', function(e){
    e.preventDefault();
    const out = document.getElementById('ks-out');
    const num = Number(document.getElementById('ks-num').value);
    const den = Number(document.getElementById('ks-den').value);
    if(!Number.isInteger(num) || !Number.isInteger(den)){ showError(out, 'Sanawjyny we maýdalawjyny bitin san hökmünde giriziň.'); return; }
    if(den===0){ showError(out, 'Maýdalawjy 0 bolup bilmez.'); return; }
    try{
      const {g, steps, sn, sd} = simplifyFraction(num, den);
      const lines = [];
      if(g===1){
        lines.push(`IUUB(${Math.abs(num)}, ${Math.abs(den)}) = 1, şonuň üçin ${fracStr(num,den)} eýýäm iň ýönekeý görnüşde.`);
      } else {
        lines.push(...steps.map((s,i)=> i===0 ? `Ilki IUUB tapylýar: ${s}` : s));
        lines.push(`IUUB(${Math.abs(num)}, ${Math.abs(den)}) = ${g}`);
        lines.push(`${fracStr(num,den)} = (${num} ÷ ${g}) / (${den} ÷ ${g}) = ${fracStr(sn,sd)}`);
      }
      showSteps(out, lines, `Netije: ${fracStr(sn,sd)}`);
    } catch(err){ showError(out, err.message); }
  });
}

/* src/scripts/modules/calc-fraction-add-sub.js */
/* ---------- 3. Add/subtract fractions ---------- */
function initFractionAddSub() {
  document.getElementById('form-kg').addEventListener('submit', function(e){
    e.preventDefault();
    const out = document.getElementById('kg-out');
    let n1 = Number(document.getElementById('kg-n1').value);
    let d1 = Number(document.getElementById('kg-d1').value);
    const op = document.getElementById('kg-op').value;
    let n2 = Number(document.getElementById('kg-n2').value);
    let d2 = Number(document.getElementById('kg-d2').value);
    if(![n1,d1,n2,d2].every(Number.isInteger)){ showError(out, 'Ähli sanawjy/maýdalawjylary bitin san hökmünde giriziň.'); return; }
    if(d1===0 || d2===0){ showError(out, 'Maýdalawjylar 0 bolup bilmez.'); return; }
    if(d1<0){ n1=-n1; d1=-d1; }
    if(d2<0){ n2=-n2; d2=-d2; }
    const common = lcmPlain(d1,d2);
    const k1 = common/d1, k2 = common/d2;
    const cn1 = n1*k1, cn2 = n2*k2;
    const combined = op==='+' ? cn1+cn2 : cn1-cn2;
    const lines = [];
    lines.push(`Umumy maýdalawjy — iki maýdalawjynyň IUKS-si: IUKS(${d1}, ${d2}) = ${common}`);
    lines.push(`${fracStr(n1,d1)} = (${n1} × ${k1}) / (${d1} × ${k1}) = ${fracStr(cn1,common)}`);
    lines.push(`${fracStr(n2,d2)} = (${n2} × ${k2}) / (${d2} × ${k2}) = ${fracStr(cn2,common)}`);
    lines.push(`${fracStr(cn1,common)} ${op==='+'?'+':'−'} ${fracStr(cn2,common)} = ${fracStr(combined,common)}`);
    let resultLabel = fracStr(combined, common);
    try{
      const {g, sn, sd} = simplifyFraction(combined, common);
      if(g>1){
        lines.push(`Ýönekeýleşdiriň (IUUB(${Math.abs(combined)}, ${common}) = ${g}): ${fracStr(combined,common)} = ${fracStr(sn,sd)}`);
        resultLabel = fracStr(sn,sd);
      }
    } catch(err){ /* division-by-zero can't happen here since common>0 */ }
    showSteps(out, lines, `Netije: ${resultLabel}`);
  });
}

/* src/scripts/modules/calc-percentage.js */
/* ---------- 4. Percentage ---------- */
function initPercentage() {
  document.getElementById('form-gp1').addEventListener('submit', function(e){
    e.preventDefault();
    const out = document.getElementById('gp1-out');
    const x = parseFloat(document.getElementById('gp1-x').value);
    const y = parseFloat(document.getElementById('gp1-y').value);
    if(!Number.isFinite(x) || !Number.isFinite(y)){ showError(out, 'Iki meýdança hem san giriziň.'); return; }
    const result = x*y/100;
    const lines = [
      `${x}-iň ${y}%-ini tapmak üçin: ${x} × (${y} ÷ 100)`,
      `= ${x} × ${(y/100)} = ${result}`
    ];
    showSteps(out, lines, `Netije: ${x}-iň ${y}%-i = ${result}`);
  });

  document.getElementById('form-gp2').addEventListener('submit', function(e){
    e.preventDefault();
    const out = document.getElementById('gp2-out');
    const a = parseFloat(document.getElementById('gp2-a').value);
    const b = parseFloat(document.getElementById('gp2-b').value);
    if(!Number.isFinite(a) || !Number.isFinite(b)){ showError(out, 'Iki meýdança hem san giriziň.'); return; }
    if(b===0){ showError(out, 'Ikinji san (B) 0 bolup bilmez.'); return; }
    const result = (a/b)*100;
    const lines = [
      `${a}-iň ${b}-den göterimini tapmak üçin: (${a} ÷ ${b}) × 100`,
      `= ${(a/b)} × 100 = ${result}%`
    ];
    showSteps(out, lines, `Netije: ${a}, ${b}-den ${result}%.`);
  });
}

/* src/scripts/modules/expression-tokenizer.js */
function tokenizeExpr(expr){
  expr = expr.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/,/g,'.');
  // Sanyň/ýaýyň arasyndaky görünmeýän köpeltmegi aç-açan '*' bilen çalyşmak: 2(3+4) → 2*(3+4), (2+3)(4+5) → (2+3)*(4+5)
  expr = expr.replace(/(\d)\s*\(/g, '$1*(');
  expr = expr.replace(/\)\s*(\d)/g, ')*$1');
  expr = expr.replace(/\)\s*\(/g, ')*(');
  const tokens=[];
  let i=0;
  while(i<expr.length){
    const c=expr[i];
    if(c===' '){i++;continue;}
    if(c==='+' && (tokens.length===0 || ['+','-','*','/','^','('].includes(tokens[tokens.length-1]))){
      // Ýeke amal hökmünde ulanylan '+' (mysal: "+3") netijä täsir etmeýär, sessiz geçirilýär
      i++;
      continue;
    }
    if('+-*/^()'.includes(c)){
      if(c==='-' && (tokens.length===0 || ['+','-','*','/','^','('].includes(tokens[tokens.length-1]))){
        let j=i+1;
        if(j<expr.length && /[0-9.]/.test(expr[j])){
          let numStr='-';
          while(j<expr.length && /[0-9.]/.test(expr[j])){ numStr+=expr[j]; j++; }
          tokens.push(numStr);
          i=j;
          continue;
        }
        // Ýaýyň (ýa-da başga minusyň) öňündäki ýeke amal minusy: −(3+2) → 0 − (3+2) görnüşine öwrülýär
        tokens.push('0');
        tokens.push('-');
        i++;
        continue;
      }
      tokens.push(c);
      i++;
      continue;
    }
    if(/[0-9.]/.test(c)){
      let j=i, numStr='';
      while(j<expr.length && /[0-9.]/.test(expr[j])){ numStr+=expr[j]; j++; }
      tokens.push(numStr);
      i=j;
      continue;
    }
    throw new Error(`Näbelli alamat: "${c}"`);
  }
  let depth=0;
  for(const t of tokens){ if(t==='(') depth++; if(t===')') depth--; if(depth<0) throw new Error('Ýaýlar deň däl.'); }
  if(depth!==0) throw new Error('Ýaýlar deň däl.');
  if(tokens.length===0) throw new Error('Aňlatma boş.');
  validateTokens(tokens);
  return tokens;
}
function validateTokens(tokens){
  const ops = ['+','-','*','/','^'];
  if(ops.includes(tokens[0])) throw new Error('Aňlatma san ýa-da ýaý bilen başlamaly.');
  if(ops.includes(tokens[tokens.length-1])) throw new Error('Aňlatma san ýa-da ýaý bilen gutarmaly.');
  for(let i=0;i<tokens.length-1;i++){
    if(ops.includes(tokens[i]) && ops.includes(tokens[i+1])) throw new Error('Iki amal alamaty yzygider gelip bilmez.');
    if(tokens[i]==='(' && ['*','/','^'].includes(tokens[i+1])) throw new Error('Ýaýdan soň şu amal alamaty bolup bilmez.');
  }
}

/* src/scripts/modules/expression-reducer.js */
function formatTokens(tokens){
  const symMap = {'*':'×','/':'÷','-':'−','+':'+','^':'^'};
  let out='';
  for(const raw of tokens){
    const p = symMap[raw] !== undefined ? symMap[raw] : raw;
    if(p==='('){ out += (out && !out.endsWith('(') ? ' ' : '') + '('; }
    else if(p===')'){ out += ')'; }
    else {
      if(out==='' || out.endsWith('(')) out += p;
      else out += ' ' + p;
    }
  }
  return out;
}
function findInnermostParen(tokens){
  let openIdx=-1;
  for(let i=0;i<tokens.length;i++){
    if(tokens[i]==='(') openIdx=i;
    if(tokens[i]===')' && openIdx!==-1) return {openIdx, closeIdx:i};
  }
  return null;
}
function highestPrecIndex(tokens, start, end){
  // '^' sagdan-çepe assosiatiw: şu derejedäki iň soňky (iň sagdaky) '^' saýlanýar
  for(let i=end-1;i>=start;i--){
    if(tokens[i]==='^') return i;
  }
  // '*' we '/' çepden-saga assosiatiw: iň birinji (iň çepdäki) saýlanýar
  for(let i=start;i<end;i++){
    if(tokens[i]==='*' || tokens[i]==='/') return i;
  }
  // '+' we '−' çepden-saga assosiatiw: iň birinji (iň çepdäki) saýlanýar
  for(let i=start;i<end;i++){
    if(tokens[i]==='+' || tokens[i]==='-') return i;
  }
  return -1;
}
function computeOp(a, op, b){
  a=parseFloat(a); b=parseFloat(b);
  switch(op){
    case '+': return a+b;
    case '-': return a-b;
    case '*': return a*b;
    case '/':
      if(b===0) throw new Error('Nola bölmek mümkin däl.');
      return a/b;
    case '^': return Math.pow(a,b);
  }
}
function numToStrOT(n){
  if(Number.isInteger(n)) return String(n);
  const r = parseFloat(n.toFixed(6));
  return r.toString();
}
function reduceExpression(exprStr){
  let tokens = tokenizeExpr(exprStr);
  const steps = [];
  steps.push(formatTokens(tokens));
  let guard=0;
  while(tokens.length>1){
    guard++;
    if(guard>300) throw new Error('Aňlatma gaty çylşyrymly.');
    const paren = findInnermostParen(tokens);
    let start=0, end=tokens.length, openIdx=-1, closeIdx=-1;
    if(paren){ start=paren.openIdx+1; end=paren.closeIdx; openIdx=paren.openIdx; closeIdx=paren.closeIdx; }
    if(paren && end-start===1){
      tokens.splice(closeIdx,1);
      tokens.splice(openIdx,1);
      steps.push(formatTokens(tokens) + '  (artykmaç ýaý aýryldy)');
      continue;
    }
    const opIdx = highestPrecIndex(tokens, start, end);
    if(opIdx===-1){
      if(paren) throw new Error('Aňlatmany okap bolmady.');
      break;
    }
    if(opIdx-1<start || opIdx+1>=end) throw new Error('Aňlatmany barlaň — bir amalyň iki tarapynda-da san bolmaly.');
    const a=tokens[opIdx-1], op=tokens[opIdx], b=tokens[opIdx+1];
    const result = computeOp(a, op, b);
    if(!isFinite(result)) throw new Error('Netije kesgitlenmedi (nola bölmek ýa-da gaty uly san).');
    const resultStr = numToStrOT(result);
    const opSym = {'+':'+','-':'−','*':'×','/':'÷','^':'^'}[op];
    tokens.splice(opIdx-1, 3, resultStr);
    steps.push(formatTokens(tokens) + `  (${a} ${opSym} ${b} = ${resultStr})`);
  }
  return {result: tokens[0], steps};
}

/* src/scripts/modules/calc-order-of-operations.js */
/* ---------- 5. Order of operations ---------- */
function initOrderOfOperations() {
  document.getElementById('form-ot').addEventListener('submit', function(e){
    e.preventDefault();
    const out = document.getElementById('ot-out');
    const expr = document.getElementById('ot-expr').value;
    try{
      const {result, steps} = reduceExpression(expr);
      showSteps(out, steps, `Netije: ${result}`);
    } catch(err){ showError(out, err.message); }
  });
}

/* src/scripts/modules/calc-integers.js */
/* ---------- 6. Integers ---------- */
function integerAdd(a,b){
  const steps=[];
  const sameSign = (a>=0 && b>=0) || (a<=0 && b<=0);
  if(sameSign){
    const sum=a+b;
    steps.push(`Ikisi hem birmeňzeş alamatly: absolýut bahalary goşulýar: |${a}| + |${b}| = ${Math.abs(a)} + ${Math.abs(b)} = ${Math.abs(sum)}`);
    steps.push(`Netije ${sum<0?'otrisatel (−)':'oňyn (+)'} alamat alýar: ${sum}`);
    return {result:sum, steps};
  } else {
    const absA=Math.abs(a), absB=Math.abs(b);
    const biggerIsA = absA>=absB;
    const diff = Math.abs(absA-absB);
    steps.push(`Alamatlary dürli-dürli: uly absolýut baha bilen kiçi absolýut bahanyň arasyndaky tapawut tapylýar: ${Math.max(absA,absB)} − ${Math.min(absA,absB)} = ${diff}`);
    const sum=a+b;
    steps.push(`Netije absolýut bahasy uly bolan sanyň alamatyny alýar (${(biggerIsA?a:b)<0?'otrisatel (−)':'oňyn (+)'}): ${sum}`);
    return {result:sum, steps};
  }
}
function integerMulDiv(a,b,op){
  if(op==='/' && b===0) throw new Error('Nola bölmek mümkin däl.');
  const sameSign = (a>=0 && b>=0) || (a<0 && b<0);
  const absResult = op==='*' ? Math.abs(a)*Math.abs(b) : Math.abs(a)/Math.abs(b);
  const steps=[];
  steps.push(`Absolýut bahalary ${op==='*'?'köpeldiň':'bölüň'}: |${a}| ${op==='*'?'×':'÷'} |${b}| = ${Math.abs(a)} ${op==='*'?'×':'÷'} ${Math.abs(b)} = ${absResult}`);
  steps.push(`Alamatlary ${sameSign?'birmeňzeş, şonuň üçin netije oňyn (+)':'dürli-dürli, şonuň üçin netije otrisatel (−)'} bolýar.`);
  const result = sameSign ? absResult : -absResult;
  return {result, steps};
}
function initIntegers() {
  document.getElementById('form-bs').addEventListener('submit', function(e){
    e.preventDefault();
    const out = document.getElementById('bs-out');
    const a = Number(document.getElementById('bs-a').value);
    const b = Number(document.getElementById('bs-b').value);
    const op = document.getElementById('bs-op').value;
    if(!Number.isInteger(a) || !Number.isInteger(b)){ showError(out, 'Iki sanyny hem bitin san hökmünde giriziň.'); return; }
    try{
      let steps, result;
      if(op==='+'){
        ({result, steps} = integerAdd(a,b));
      } else if(op==='-'){
        steps = [`${a} − ${b} aýyrmagy garşylykly san goşmaga öwrüň: ${a} + (${-b})`];
        const r = integerAdd(a,-b);
        steps = steps.concat(r.steps);
        result = r.result;
      } else {
        ({result, steps} = integerMulDiv(a,b,op));
      }
      const opSym = {'+':'+','-':'−','*':'×','/':'÷'}[op];
      showSteps(out, steps, `Netije: ${a} ${opSym} ${b} = ${result}`);
    } catch(err){ showError(out, err.message); }
  });
}

/* src/scripts/modules/calc-proportion.js */
/* ---------- 7. Proportion ---------- */
function initProportion() {
  document.getElementById('form-pp').addEventListener('submit', function(e){
    e.preventDefault();
    const out = document.getElementById('pp-out');
    const unknown = document.getElementById('pp-unknown').value;
    const raw = {
      a: document.getElementById('pp-a').value,
      b: document.getElementById('pp-b').value,
      c: document.getElementById('pp-c').value,
      d: document.getElementById('pp-d').value
    };
    const vals = {};
    for(const k of ['a','b','c','d']){
      if(k===unknown) continue;
      const n = parseFloat(raw[k]);
      if(!Number.isFinite(n)){ showError(out, `"${k}" meýdançasyna san giriziň.`); return; }
      vals[k]=n;
    }
    let result, crossEq;
    try{
      switch(unknown){
        case 'a':
          if(vals.d===0) throw new Error('d 0 bolup bilmez.');
          crossEq = `a × ${vals.d} = ${vals.b} × ${vals.c}`;
          result = (vals.b*vals.c)/vals.d;
          break;
        case 'b':
          if(vals.c===0) throw new Error('c 0 bolup bilmez.');
          crossEq = `${vals.a} × ${vals.d} = b × ${vals.c}`;
          result = (vals.a*vals.d)/vals.c;
          break;
        case 'c':
          if(vals.b===0) throw new Error('b 0 bolup bilmez.');
          crossEq = `${vals.a} × ${vals.d} = ${vals.b} × c`;
          result = (vals.a*vals.d)/vals.b;
          break;
        case 'd':
          if(vals.a===0) throw new Error('a 0 bolup bilmez.');
          crossEq = `${vals.a} × d = ${vals.b} × ${vals.c}`;
          result = (vals.b*vals.c)/vals.a;
          break;
      }
      const lines = [
        `Proporsiýa: ${unknown==='a'?'x':vals.a} / ${unknown==='b'?'x':vals.b} = ${unknown==='c'?'x':vals.c} / ${unknown==='d'?'x':vals.d}`,
        `Çaknyşdyryp köpeltmek: ${crossEq}`,
        `${unknown} = ${result}`
      ];
      showSteps(out, lines, `Netije: ${unknown} = ${result}`);
    } catch(err){ showError(out, err.message); }
  });
}

/* src/scripts/main.js */
function start() {
  initSearch();
  initGcdLcm();
  initSimplifyFraction();
  initFractionAddSub();
  initPercentage();
  initOrderOfOperations();
  initIntegers();
  initProportion();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

})();
