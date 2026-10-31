/* ---------- Usul gözlegi ---------- */
(function(){
  /* Tertip möhüm: ilki interpolýasiýa we ulgamlar barlanýar («Nýutonyň interpolýasiýasy» → interpolýasiýa). */
  const SEARCH_INDEX = [
    { tabIndex: 4, panel: "panel-interp", keywords: ["interpolýasiýa","interpolyasiya","interpol","lagranž","lagranz","lagrange","bölünen tapawut","bolunen tapawut","divided","köpagza","kopagza","düwün","duwun","ekstrapol","runge"] },
    { tabIndex: 5, panel: "panel-iter", keywords: ["ýakobi","yakobi","jacobi","zeýdel","zeydel","seidel","gauss","çyzykly ulgam","cyzykly ulgam","ulgam","diagonal","agdyk","spektral","ax=b","ax b","matrisa"] },
    { tabIndex: 0, panel: "panel-bisection", keywords: ["ýarpylatma","yarpylatma","bisection","bölmek","interwal","aralyk","a b","dichotomy"] },
    { tabIndex: 1, panel: "panel-fixed", keywords: ["gaýtalama","gaytalama","ýönekeý","yonekey","fixed","iterasiýa","iterasiya","x=g(x)","g(x)"] },
    { tabIndex: 2, panel: "panel-newton", keywords: ["newton","tangens","galtaşýan","galtasyan","önüm","onum","derivative","tangent"] },
    { tabIndex: 3, panel: "panel-secant", keywords: ["sekant","secant","kese kesim","chord","önümsiz","onumsiz"] },
  ];
  function normalize(s){
    return s.toLowerCase()
      .replace(/ý/g,"y").replace(/ň/g,"n").replace(/ç/g,"c").replace(/ş/g,"s")
      .replace(/ö/g,"o").replace(/ü/g,"u").replace(/[^a-z0-9 ]/g," ").trim();
  }
  const form = document.getElementById("searchForm");
  const msg = document.getElementById("searchMsg");
  form.addEventListener("submit", function(e){
    e.preventDefault();
    const raw = document.getElementById("searchInput").value.trim();
    msg.hidden = false;
    if (!raw) { msg.className = "search-msg miss"; msg.textContent = "Agtarjak usulyňyzy ýazyň, mysal: Newton."; return; }
    const q = normalize(raw);
    const hit = SEARCH_INDEX.find(function(entry){
      return entry.keywords.some(function(k){ const nk = normalize(k); return q.includes(nk) || nk.includes(q); });
    });
    if (hit) {
      msg.hidden = true;
      const tabs = document.querySelectorAll(".method-tab");
      tabs[hit.tabIndex].click();
      document.getElementById(hit.panel).scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      msg.className = "search-msg miss";
      msg.textContent = "„" + raw + "“ üçin usul tapylmady. „Newton“, „Sekant“, „Ýarpylatma“, „Gaýtalama“, „Lagranž“ ýa-da „Zeýdel“ ýazyp görüň.";
    }
  });
})();

/* ---------- "Ýakynda goşular" düwmeleri üçin ýönekeý habar ---------- */
(function(){
  document.querySelectorAll(".soon-link").forEach(function(el){
    el.addEventListener("click", function(e){
      e.preventDefault();
      alert("Bu bölüm ýakynda goşular ✨");
    });
  });
})();

/* ---------- Usul sekmeleri (tabs) ---------- */
(function(){
  const tabs = document.querySelectorAll(".method-tab");
  tabs.forEach(function(tab){
    tab.addEventListener("click", function(){
      tabs.forEach(function(t){ t.classList.remove("active"); t.setAttribute("aria-selected","false"); });
      document.querySelectorAll(".method-panel").forEach(function(p){ p.classList.remove("active"); });
      tab.classList.add("active");
      tab.setAttribute("aria-selected","true");
      document.getElementById(tab.dataset.panel).classList.add("active");
    });
  });
  /* #salgy (mysal: #interpolyasiya, #yakobi-zeydel ýa-da paneliň içindäki bölüm) — degişli usuly açýar */
  function openFromHash(){
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    const tab = target.closest(".method-tab") || (target.closest(".method-panel") && document.querySelector('.method-tab[data-panel="' + target.closest(".method-panel").id + '"]'));
    if (tab && !tab.classList.contains("active")) tab.click();
    if (tab) { const panel = document.getElementById(tab.dataset.panel); setTimeout(function(){ panel.scrollIntoView({ block: "start" }); }, 30); }
  }
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();

/* ======================================================================
   San usullary — matematiki aňlatma derňeýji (parser) we hasaplaýyş özeni
   ====================================================================== */
(function(){

/* ---- Aňlatma derňeýji (tokenizer + recursive-descent parser) ---- */
const SUP_DIGITS = { "⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9" };
const SUB_DIGITS = { "₀":"0","₁":"1","₂":"2","₃":"3","₄":"4","₅":"5","₆":"6","₇":"7","₈":"8","₉":"9" };
/* Ulanyjy tarapyndan ýazylan amatly ýazuwlary (x², √x, log₂(x)) adaty
   ýazuwa (x^2, sqrt(x), log_2() → logbase(2,)) öwürýär, tokenize etmezden öň. */
function preprocessExpr(src) {
  let s = src;
  // log₂(x)  ->  log_2(x)
  s = s.replace(/log([₀₁₂₃₄₅₆₇₈₉]+)/g, function (m, digits) {
    return "log_" + digits.split("").map((d) => SUB_DIGITS[d]).join("");
  });
  // log_2(...)  ->  logbase(2,...)
  s = s.replace(/log_(\d+(?:\.\d+)?)\s*\(/g, function (m, base) {
    return "logbase(" + base + ",";
  });
  // x²  ->  x^2  (bir ýa-da birnäçe ýokarky-san yzygider gelse)
  s = s.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, function (m) {
    return "^" + m.split("").map((d) => SUP_DIGITS[d]).join("");
  });
  return s;
}
function tokenize(src) {
  const s = preprocessExpr(src).replace(/\s+/g, "");
  const tokens = [];
  let i = 0;
  const isDigit = (c) => c >= "0" && c <= "9";
  const isAlpha = (c) => /[a-zA-Z]/.test(c);
  while (i < s.length) {
    const c = s[i];
    if (c === "√") { tokens.push({ type: "sqrt", value: "√" }); i++; continue; }
    if (isDigit(c) || (c === "." && isDigit(s[i + 1]))) {
      let j = i;
      let seenDot = false;
      while (j < s.length && (isDigit(s[j]) || (s[j] === "." && !seenDot))) {
        if (s[j] === ".") seenDot = true;
        j++;
      }
      if (s[j] === "e" || s[j] === "E") {
        let k = j + 1;
        if (s[k] === "+" || s[k] === "-") k++;
        if (isDigit(s[k])) {
          k++;
          while (isDigit(s[k])) k++;
          j = k;
        }
      }
      tokens.push({ type: "num", value: parseFloat(s.slice(i, j)) });
      i = j;
      continue;
    }
    if (isAlpha(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z0-9]/.test(s[j])) j++;
      tokens.push({ type: "ident", value: s.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/^(),".includes(c)) {
      if (c === "*" && s[i + 1] === "*") {
        tokens.push({ type: "op", value: "^" });
        i += 2;
        continue;
      }
      tokens.push({ type: (c === "(" || c === ")" || c === ",") ? c : "op", value: c });
      i++;
      continue;
    }
    throw new Error("Näbelli alama: '" + c + "'");
  }
  return tokens;
}

const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: Math.sqrt, abs: Math.abs,
  exp: Math.exp, ln: Math.log, log: Math.log10, log2: Math.log2,
  sign: Math.sign,
  logbase: (b, x) => Math.log(x) / Math.log(b),
};
const CONSTS = { pi: Math.PI, e: Math.E };

function parseExpr(exprStr) {
  const tokens = tokenize(exprStr);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function canStartFactor() {
    const t = peek();
    if (!t) return false;
    return t.type === "num" || t.type === "ident" || t.type === "(" || t.type === "sqrt";
  }

  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error("Aňlatma gutardy, garaşylýan baha ýok.");
    if (t.type === "num") { next(); return { type: "num", value: t.value }; }
    if (t.type === "(") {
      next();
      const node = parseAddSub();
      if (!peek() || peek().type !== ")") throw new Error("Ýapyk ýaý ')' garaşylýardy.");
      next();
      return node;
    }
    if (t.type === "ident") {
      next();
      const name = t.value;
      // x(x+1), 3x(x-2), e(x+1) ýaly ýazgylarda x we hemişelikler funksiýa däl, köpeldiji hasaplanýar
      if (peek() && peek().type === "(" && (name in FUNCS || !(name === "x" || name in CONSTS))) {
        next();
        const args = [parseAddSub()];
        while (peek() && peek().type === ",") { next(); args.push(parseAddSub()); }
        if (!peek() || peek().type !== ")") throw new Error("Ýapyk ýaý ')' garaşylýardy.");
        next();
        if (!(name in FUNCS)) throw new Error("Näbelli funksiýa: " + name);
        return { type: "call", name, args };
      }
      if (name === "x") return { type: "var" };
      if (name in CONSTS) return { type: "num", value: CONSTS[name] };
      throw new Error("Näbelli üýtgeýän ýa-da hemişelik: " + name);
    }
    throw new Error("Aňlatmada garaşylmadyk alama bar.");
  }

  function parsePow() {
    const left = parsePrimary();
    if (peek() && peek().type === "op" && peek().value === "^") {
      next();
      const right = parseUnary();
      return { type: "bin", op: "^", left, right };
    }
    return left;
  }

  function parseUnary() {
    const t = peek();
    if (t && t.type === "op" && (t.value === "-" || t.value === "+")) {
      next();
      const node = parseUnary();
      return t.value === "-" ? { type: "neg", value: node } : node;
    }
    if (t && t.type === "sqrt") {
      next();
      // √ diňe özünden soňky ýeke agza (san, üýtgeýän ýa-da ýaýly aňlatma) degişli:
      // √2x = √2 · x, ýöne √(x+1) bolsa ähli aňlatmany öz içine alýar.
      const arg = parsePrimary();
      return { type: "call", name: "sqrt", args: [arg] };
    }
    return parsePow();
  }

  function parseMulDiv() {
    let left = parseUnary();
    while (true) {
      if (peek() && peek().type === "op" && (peek().value === "*" || peek().value === "/")) {
        const op = next().value;
        const right = parseUnary();
        left = { type: "bin", op, left, right };
      } else if (canStartFactor()) {
        const right = parseUnary();
        left = { type: "bin", op: "*", left, right };
      } else break;
    }
    return left;
  }

  function parseAddSub() {
    let left = parseMulDiv();
    while (peek() && peek().type === "op" && (peek().value === "+" || peek().value === "-")) {
      const op = next().value;
      const right = parseMulDiv();
      left = { type: "bin", op, left, right };
    }
    return left;
  }

  const ast = parseAddSub();
  if (pos < tokens.length) throw new Error("Aňlatmanyň soňunda artykmaç alamalar bar.");
  return ast;
}

function evalAst(node, x) {
  switch (node.type) {
    case "num": return node.value;
    case "var": return x;
    case "neg": return -evalAst(node.value, x);
    case "call": return FUNCS[node.name](...node.args.map((a) => evalAst(a, x)));
    case "bin": {
      const l = evalAst(node.left, x), r = evalAst(node.right, x);
      switch (node.op) {
        case "+": return l + r;
        case "-": return l - r;
        case "*": return l * r;
        case "/": return l / r;
        case "^": return Math.pow(l, r);
      }
    }
  }
  throw new Error("Näbelli AST düwün.");
}

function compileFunction(exprStr) {
  if (!exprStr || !exprStr.trim()) throw new Error("Aňlatma boş bolmaly däl.");
  const ast = parseExpr(exprStr);
  const f = (x) => evalAst(ast, x);
  attachExactDerivative(f, exprStr);
  return f;
}

/* math.js bilen takyk önüm: formulany math.js hem biziň ýaly okasa ulanylýar,
   ýogsam sanly (takmynan) önüm ulanylýar. */
function attachExactDerivative(f, exprStr) {
  if (!window.math) return;
  try {
    const node = math.parse(exprStr);
    const fc = node.compile();
    const dc = math.derivative(node, 'x').compile();
    for (const p of [0.37, 1.3, 2.9]) {
      const a = f(p), b = fc.evaluate({ x: p });
      if (typeof b !== 'number' || !(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)))) return;
    }
    f.deriv = (x) => dc.evaluate({ x });
  } catch (e) { /* sanly önüm ulanylar */ }
}

/* ---- San usullary ---- */
function numericDerivative(f, x) {
  if (typeof f.deriv === 'function') {
    const d = f.deriv(x);
    if (Number.isFinite(d)) return d;
  }
  const h = 1e-6 * Math.max(1, Math.abs(x));
  return (f(x + h) - f(x - h)) / (2 * h);
}

function bisection(f, a, b, tol, maxIter) {
  let fa = f(a), fb = f(b);
  const rows = [];
  if (!isFinite(fa) || !isFinite(fb)) return { ok: false, error: "f(a) ýa-da f(b) hasaplanyp bilmedi (domen ýalňyşlygy)." };
  if (fa === 0) return { ok: true, root: a, rows, iterations: 0, note: "f(a)=0 — a takyk kökdür." };
  if (fb === 0) return { ok: true, root: b, rows, iterations: 0, note: "f(b)=0 — b takyk kökdür." };
  if (fa * fb > 0) return { ok: false, error: "f(a)·f(b) ≥ 0 — bu aralykda Ýarpylatma usulyny ulanmak üçin f(a)·f(b) < 0 şerti ýerine ýetmeýär. Muňa garamazdan, aralykda jübüt sanly kök (mysal üçin galtaşýan kök) bolup biler, ýa-da asla kök bolmazlygy hem mümkin — başga aralyk saýlaň." };
  let c, fc, n = 0;
  while (n < maxIter) {
    c = (a + b) / 2;
    fc = f(c);
    n++;
    const err = Math.abs(b - a) / 2;
    rows.push({ n, a, b, c, fc, err });
    if (!isFinite(fc)) return { ok: false, error: "Hasaplama wagtynda domen ýalňyşlygy ýüze çykdy." };
    if (fc === 0 || err < tol) return { ok: true, root: c, rows, iterations: n };
    if (fa * fc < 0) { b = c; fb = fc; } else { a = c; fa = fc; }
  }
  return { ok: true, root: c, rows, iterations: n, warning: "Iň köp gaýtalama sanyna ýetildi — netije takyk bolmazlygy mümkin." };
}

function fixedPointIteration(g, x0, tol, maxIter) {
  const rows = [];
  let x = x0;
  let maxSlope = 0;
  let maxSlopeAt = x0;
  for (let n = 1; n <= maxIter; n++) {
    const dg = numericDerivative(g, x);
    if (isFinite(dg) && Math.abs(dg) > maxSlope) { maxSlope = Math.abs(dg); maxSlopeAt = x; }
    const xNext = g(x);
    if (!isFinite(xNext)) return { ok: false, error: "Hasaplama wagtynda domen ýalňyşlygy ýüze çykdy." };
    const err = Math.abs(xNext - x);
    rows.push({ n, x, dg, xNext, err });
    if (Math.abs(xNext) > 1e12) return { ok: false, error: "Yzygiderlilik çäksizlige tarap gidýär — g(x) bu başlangyç bahada ýygjamlaşmaýar (|g'(x)|<1 şerti barlaň)." };
    x = xNext;
    if (err < tol) return { ok: true, root: x, rows, iterations: n, maxSlope, maxSlopeAt };
  }
  return { ok: true, root: x, rows, iterations: maxIter, warning: "Iň köp gaýtalama sanyna ýetildi — ýygjamlaşma haýal bolup biler.", maxSlope, maxSlopeAt };
}

function newtonRaphson(f, fprime, x0, tol, maxIter) {
  const rows = [];
  let x = x0;
  for (let n = 1; n <= maxIter; n++) {
    const fx = f(x);
    const dfx = fprime ? fprime(x) : numericDerivative(f, x);
    if (!isFinite(fx) || !isFinite(dfx)) return { ok: false, error: "Hasaplama wagtynda domen ýalňyşlygy ýüze çykdy." };
    if (Math.abs(dfx) < 1e-14) return { ok: false, error: "f'(x) nola deň ýa-da nola örän ýakyn — usul bu nokatda işlemeýär, başga x₀ synanyşyň." };
    const xNext = x - fx / dfx;
    const err = Math.abs(xNext - x);
    rows.push({ n, x, fx, dfx, xNext, err });
    x = xNext;
    if (err < tol || Math.abs(fx) < tol) return { ok: true, root: x, rows, iterations: n };
  }
  return { ok: true, root: x, rows, iterations: maxIter, warning: "Iň köp gaýtalama sanyna ýetildi — netije takyk bolmazlygy mümkin." };
}

function secantMethod(f, x0, x1, tol, maxIter) {
  const rows = [];
  let f0 = f(x0), f1 = f(x1);
  for (let n = 1; n <= maxIter; n++) {
    if (!isFinite(f0) || !isFinite(f1)) return { ok: false, error: "Hasaplama wagtynda domen ýalňyşlygy ýüze çykdy." };
    if (Math.abs(f1 - f0) < 1e-14) return { ok: false, error: "Iki soňky nokadyň f bahalary deň diýen ýaly — nola bölünme bolar, başga başlangyç baha synanyşyň." };
    const x2 = x1 - f1 * (x1 - x0) / (f1 - f0);
    const f2 = f(x2);
    const err = Math.abs(x2 - x1);
    rows.push({ n, x0, x1, f0, f1, x2, f2, err });
    x0 = x1; f0 = f1; x1 = x2; f1 = f2;
    if (err < tol || Math.abs(f2) < tol) return { ok: true, root: x1, rows, iterations: n };
  }
  return { ok: true, root: x1, rows, iterations: maxIter, warning: "Iň köp gaýtalama sanyna ýetildi — netije takyk bolmazlygy mümkin." };
}

/* ---- Kömekçi funksiýalar: san formaty, girizilen sanlary okamak ---- */
function fmt(v) {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  const av = Math.abs(v);
  if (av !== 0 && (av < 1e-4 || av >= 1e6)) return v.toExponential(6);
  let s = v.toFixed(8);
  s = s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return s;
}
function readNum(id, label) {
  const raw = document.getElementById(id).value.trim();
  const v = parseFloat(raw);
  if (raw === "" || isNaN(v)) throw new Error("„" + label + "“ meýdanyna dogry san ýazyň.");
  return v;
}
function readInt(id, label, min, max) {
  const v = Math.round(readNum(id, label));
  if (v < min || v > max) throw new Error("„" + label + "“ " + min + " bilen " + max + " aralykda bolmaly.");
  return v;
}
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/* ---- Grafik çyzmak (canvas) ---- */
/* Reňkler temadan (CSS üýtgeýänleri) alynýar; tema çalşylanda grafikler täzeden çyzylýar. */
function COL() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n, fb) => (cs.getPropertyValue(n) || "").trim() || fb;
  return { grid: v("--nu-grid", "#e6e6e6"), axis: v("--nu-axis", "#999"), ink: v("--nu-ink", "#666"), f: v("--nu-c1", "#2f77c9"),
    root: v("--nu-c2", "#e8a33d"), aux: v("--nu-c3", "#6aa84f"), font: v("--amx-font", "sans-serif") };
}
new MutationObserver(function () {
  document.querySelectorAll("canvas.graph-canvas").forEach(function (c) { if (typeof c._redraw === "function") c._redraw(); });
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
function setupCanvas(canvas, h) {
  const dpr = window.devicePixelRatio || 1;
  const rectW = Math.max(280, canvas.parentElement.clientWidth - 22);
  canvas.width = rectW * dpr;
  canvas.height = h * dpr;
  canvas.style.width = rectW + "px";
  canvas.style.height = h + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rectW, h);
  return { ctx, rectW, h };
}

/* extra(ctx, X, Y, pad, plotW, plotH) — usula degişli goşmaça çyzgylary (tangens, sekant çyzygy...) çekmek üçin */
function drawGraph(canvas, f, xMin, xMax, root, extra) {
  canvas._redraw = function () { drawGraph(canvas, f, xMin, xMax, root, extra); };
  const C = COL();
  const h = 240;
  const { ctx, rectW } = setupCanvas(canvas, h);

  const N = 400;
  const xs = [], ys = [];
  for (let i = 0; i <= N; i++) {
    const x = xMin + (xMax - xMin) * i / N;
    let y;
    try { y = f(x); if (!isFinite(y)) y = null; } catch (e) { y = null; }
    xs.push(x); ys.push(y);
  }
  const finiteYs = ys.filter((y) => y !== null);
  const pad = { l: 42, r: 14, t: 12, b: 24 };
  const plotW = rectW - pad.l - pad.r, plotH = h - pad.t - pad.b;

  if (finiteYs.length === 0) {
    ctx.fillStyle = C.ink; ctx.font = "13px " + C.font;
    ctx.fillText("Bu aralykda grafigi çyzyp bolmady.", 12, h / 2);
    return;
  }
  let yMin = Math.min(...finiteYs, 0), yMax = Math.max(...finiteYs, 0);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const padY = (yMax - yMin) * 0.12;
  yMin -= padY; yMax += padY;

  const X = (x) => pad.l + (x - xMin) / (xMax - xMin) * plotW;
  const Y = (y) => pad.t + (1 - (y - yMin) / (yMax - yMin)) * plotH;
  const clampY = (y) => Y(Math.max(yMin, Math.min(yMax, y)));

  ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = 0; gx <= 4; gx++) { const px = pad.l + plotW * gx / 4; ctx.moveTo(px, pad.t); ctx.lineTo(px, pad.t + plotH); }
  for (let gy = 0; gy <= 4; gy++) { const py = pad.t + plotH * gy / 4; ctx.moveTo(pad.l, py); ctx.lineTo(pad.l + plotW, py); }
  ctx.stroke();

  ctx.strokeStyle = C.axis; ctx.lineWidth = 1;
  if (yMin < 0 && yMax > 0) { ctx.beginPath(); ctx.moveTo(pad.l, Y(0)); ctx.lineTo(pad.l + plotW, Y(0)); ctx.stroke(); }
  if (xMin < 0 && xMax > 0) { ctx.beginPath(); ctx.moveTo(X(0), pad.t); ctx.lineTo(X(0), pad.t + plotH); ctx.stroke(); }

  ctx.strokeStyle = C.f; ctx.lineWidth = 2.2; ctx.beginPath();
  let started = false;
  for (let i = 0; i < xs.length; i++) {
    if (ys[i] === null) { started = false; continue; }
    const py = clampY(ys[i]);
    const px = X(xs[i]);
    if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
  }
  ctx.stroke();

  if (typeof extra === "function") {
    ctx.save();
    try { extra(ctx, X, Y, clampY, pad, plotW, plotH); } catch (e) { /* goşmaça çyzgyda ýalňyşlyk bolsa esasy grafigi bozmaly däl */ }
    ctx.restore();
  }

  if (root !== undefined && root !== null && isFinite(root) && root >= xMin && root <= xMax) {
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = C.root; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(root), pad.t); ctx.lineTo(X(root), pad.t + plotH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = C.root;
    const zy = (yMin <= 0 && yMax >= 0) ? Y(0) : Y(yMin);
    ctx.beginPath(); ctx.arc(X(root), zy, 4.5, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = C.ink; ctx.font = "11px " + C.font; ctx.textAlign = "left";
  ctx.fillText(fmt(xMin), pad.l, h - 6);
  ctx.textAlign = "right";
  ctx.fillText(fmt(xMax), pad.l + plotW, h - 6);
  ctx.textAlign = "left";
}

/* Ýönekeý gaýtalama üçin "kobweb" diagrammasy: y=g(x) we y=x çyzyklary bilen
   xₙ → g(xₙ) → xₙ₊₁ basgançaklaryny görkezýär — bu usulyň ýygjamlaşmagyny
   (ýa-da ýaýramagyny) görkezmegiň iň düşnükli usulydyr. */
function drawCobweb(canvas, g, xMin, xMax, root, xsPath) {
  canvas._redraw = function () { drawCobweb(canvas, g, xMin, xMax, root, xsPath); };
  const C = COL();
  const h = 240;
  const { ctx, rectW } = setupCanvas(canvas, h);
  const N = 300;
  const xs = [], ys = [];
  for (let i = 0; i <= N; i++) {
    const x = xMin + (xMax - xMin) * i / N;
    let y;
    try { y = g(x); if (!isFinite(y)) y = null; } catch (e) { y = null; }
    xs.push(x); ys.push(y);
  }
  const finiteYs = ys.filter((y) => y !== null);
  const pad = { l: 42, r: 14, t: 12, b: 24 };
  const plotW = rectW - pad.l - pad.r, plotH = h - pad.t - pad.b;
  if (finiteYs.length === 0) {
    ctx.fillStyle = C.ink; ctx.font = "13px " + C.font;
    ctx.fillText("Bu aralykda grafigi çyzyp bolmady.", 12, h / 2);
    return;
  }
  let lo = Math.min(...finiteYs, ...xs, xMin), hi = Math.max(...finiteYs, ...xs, xMax);
  if (lo === hi) { lo -= 1; hi += 1; }
  const padV = (hi - lo) * 0.1;
  lo -= padV; hi += padV;

  const X = (x) => pad.l + (x - xMin) / (xMax - xMin) * plotW;
  const Y = (y) => pad.t + (1 - (y - lo) / (hi - lo)) * plotH;

  ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = 0; gx <= 4; gx++) { const px = pad.l + plotW * gx / 4; ctx.moveTo(px, pad.t); ctx.lineTo(px, pad.t + plotH); }
  for (let gy = 0; gy <= 4; gy++) { const py = pad.t + plotH * gy / 4; ctx.moveTo(pad.l, py); ctx.lineTo(pad.l + plotW, py); }
  ctx.stroke();

  // y = x çyzygy
  ctx.strokeStyle = C.axis; ctx.lineWidth = 1.3; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(X(xMin), Y(xMin)); ctx.lineTo(X(xMax), Y(xMax)); ctx.stroke();
  ctx.setLineDash([]);

  // y = g(x) çyzygy
  ctx.strokeStyle = C.f; ctx.lineWidth = 2.2; ctx.beginPath();
  let started = false;
  for (let i = 0; i < xs.length; i++) {
    if (ys[i] === null) { started = false; continue; }
    const py = Y(Math.max(lo, Math.min(hi, ys[i])));
    const px = X(xs[i]);
    if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // basgançak (cobweb) ýoly: x0 → (x0,g(x0)) → (g(x0),g(x0)) → (x1,g(x1)) → ...
  if (xsPath && xsPath.length) {
    ctx.strokeStyle = C.aux; ctx.lineWidth = 1.4; ctx.setLineDash([3, 3]);
    ctx.beginPath();
    let x = xsPath[0];
    let py = null;
    for (let i = 0; i < xsPath.length; i++) {
      const gx = xsPath[i + 1] !== undefined ? xsPath[i + 1] : (function () { try { return g(x); } catch (e) { return null; } })();
      if (gx === null || !isFinite(gx)) break;
      if (py === null) { ctx.moveTo(X(x), Y(x)); }
      ctx.lineTo(X(x), Y(gx));
      ctx.lineTo(X(gx), Y(gx));
      x = gx; py = gx;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COL().aux;
    xsPath.forEach((px0) => { ctx.beginPath(); ctx.arc(X(px0), Y(px0), 2.6, 0, Math.PI * 2); ctx.fill(); });
  }

  if (root !== undefined && root !== null && isFinite(root) && root >= xMin && root <= xMax) {
    ctx.fillStyle = C.root;
    ctx.beginPath(); ctx.arc(X(root), Y(root), 4.5, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = C.ink; ctx.font = "11px " + C.font; ctx.textAlign = "left";
  ctx.fillText(fmt(xMin), pad.l, h - 6);
  ctx.textAlign = "right";
  ctx.fillText(fmt(xMax), pad.l + plotW, h - 6);
  ctx.textAlign = "left";
}

function graphRange(points, root) {
  const all = points.concat([root]).filter((v) => isFinite(v));
  let lo = Math.min(...all), hi = Math.max(...all);
  if (!isFinite(lo) || !isFinite(hi)) { lo = -5; hi = 5; }
  let span = hi - lo;
  if (span < 1e-6) span = 1;
  const pad = span * 0.45 + 0.4;
  return [lo - pad, hi + pad];
}

/* ---- Netije çykaryş: umumy elementler ---- */
function showError(out, msg) {
  out.innerHTML = "";
  const box = el("div", "result-box err");
  box.textContent = "⚠ " + msg;
  out.appendChild(box);
}
function resultSummary(res, residualFn) {
  const box = el("div", "result-box " + (res.warning ? "warn" : "ok"));
  const rootLine = el("div", "result-root", "Kök ≈ " + fmt(res.root));
  box.appendChild(rootLine);
  let residual = null;
  if (typeof residualFn === "function") {
    try { residual = residualFn(res.root); } catch (e) { residual = null; }
  }
  const meta = el("div", "result-meta",
    (res.note ? res.note + " · " : "") + "Gaýtalama sany: " + res.iterations + " · f(kök) ≈ " + fmt(residual));
  box.appendChild(meta);
  if (res.warning) {
    const w = el("div", "result-warn-line", res.warning);
    box.appendChild(w);
  }
  return box;
}
function buildTable(headers, rows) {
  const wrap = el("div", "iter-table-wrap");
  const table = el("table", "iter-table");
  const thead = el("thead");
  const trh = el("tr");
  headers.forEach((h) => trh.appendChild(el("th", null, h)));
  thead.appendChild(trh);
  table.appendChild(thead);
  const tbody = el("tbody");
  rows.forEach((r) => {
    const tr = el("tr");
    r.forEach((c) => tr.appendChild(el("td", null, c)));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

/* ---- Ädimme-ädim düşündiriş (mugallym ýaly düşündiriş) ---- */
const STEP_LIMIT = 6;
function buildStepExplanation(method, res) {
  const details = el("details", "step-explain");
  const summary = el("summary", null, "Ädimme-ädim düşündiriş");
  details.appendChild(summary);
  const ol = el("ol");
  const shown = res.rows.slice(0, STEP_LIMIT);
  shown.forEach((r) => {
    let text = "";
    if (method === "bisection") {
      text = "a = " + fmt(r.a) + ", b = " + fmt(r.b) + " → c = (a+b)/2 = " + fmt(r.c) +
        ". f(c) ≈ " + fmt(r.fc) + (r.fc === 0 ? " — kök takyk tapyldy." : "") +
        ", ýalňyşlyk (aralygyň ýarpysy) ≈ " + fmt(r.err) + ".";
    } else if (method === "fixed") {
      text = "xₙ = " + fmt(r.x) + " → xₙ₊₁ = g(xₙ) = " + fmt(r.xNext) +
        ". |g'(xₙ)| ≈ " + fmt(Math.abs(r.dg)) + ", ýalňyşlyk |xₙ₊₁−xₙ| ≈ " + fmt(r.err) + ".";
    } else if (method === "newton") {
      text = "xₙ = " + fmt(r.x) + ", f(xₙ) ≈ " + fmt(r.fx) + ", f'(xₙ) ≈ " + fmt(r.dfx) +
        " → xₙ₊₁ = xₙ − f(xₙ)/f'(xₙ) = " + fmt(r.xNext) + ".";
    } else if (method === "secant") {
      text = "xₙ₋₁ = " + fmt(r.x0) + ", xₙ = " + fmt(r.x1) + " → xₙ₊₁ = xₙ − f(xₙ)(xₙ−xₙ₋₁)/(f(xₙ)−f(xₙ₋₁)) = " + fmt(r.x2) +
        ". f(xₙ₊₁) ≈ " + fmt(r.f2) + ".";
    }
    ol.appendChild(el("li", null, "<strong>" + r.n + "-nji ädim.</strong> " + text));
  });
  details.appendChild(ol);
  if (res.rows.length > STEP_LIMIT) {
    details.appendChild(el("div", "step-more", "… we ýene " + (res.rows.length - STEP_LIMIT) + " ädim (doly maglumat üçin ýokardaky jedwele serediň)."));
  }
  return details;
}
function buildGraphBlock(legendHtml) {
  const wrap = el("div", "graph-wrap");
  const canvas = document.createElement("canvas");
  canvas.className = "graph-canvas";
  wrap.appendChild(canvas);
  const legend = el("div", "graph-legend", legendHtml ||
    '<span><i class="swatch" style="background:var(--nu-c1)"></i> f(x)</span>' +
    '<span><i class="swatch dot"></i> tapylan kök</span>');
  wrap.appendChild(legend);
  return { wrap, canvas };
}

/* ---- BISECTION handler ---- */
document.getElementById("bis-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const out = document.getElementById("bis-output");
  try {
    const fStr = document.getElementById("bis-f").value;
    const f = compileFunction(fStr);
    const a = readNum("bis-a", "a");
    const b = readNum("bis-b", "b");
    if (a === b) throw new Error("a we b deň bolmaly däl.");
    const tol = readNum("bis-tol", "Ýalňyşlyk çägi");
    if (tol <= 0) throw new Error("Ýalňyşlyk çägi položitel bolmaly.");
    const iter = readInt("bis-iter", "Iň köp gaýtalama sany", 1, 500);
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const res = bisection(f, lo, hi, tol, iter);
    out.innerHTML = "";
    if (!res.ok) { showError(out, res.error); return; }
    out.appendChild(resultSummary(res, f));
    const rows = res.rows.map((r) => [r.n, fmt(r.a), fmt(r.b), fmt(r.c), fmt(r.fc), fmt(r.err)]);
    out.appendChild(buildTable(["№", "a", "b", "c=(a+b)/2", "f(c)", "Ýalňyşlyk"], rows));
    out.appendChild(buildStepExplanation("bisection", res));
    const { wrap, canvas } = buildGraphBlock(
      '<span><i class="swatch" style="background:var(--nu-c1)"></i> f(x)</span>' +
      '<span><i class="swatch dashed"></i> başlangyç aralyk [a,b]</span>' +
      '<span><i class="swatch dot" style="background:var(--nu-c3)"></i> orta nokat cₙ</span>' +
      '<span><i class="swatch dot"></i> tapylan kök</span>');
    out.appendChild(wrap);
    const [gx0, gx1] = graphRange([lo, hi], res.root);
    drawGraph(canvas, f, gx0, gx1, res.root, function (ctx, X, Y, clampY, pad, plotW, plotH) {
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = COL().aux; ctx.lineWidth = 1.2;
      [lo, hi].forEach((v) => {
        if (v >= gx0 && v <= gx1) { ctx.beginPath(); ctx.moveTo(X(v), pad.t); ctx.lineTo(X(v), pad.t + plotH); ctx.stroke(); }
      });
      ctx.setLineDash([]);
      const zy = clampY(0);
      ctx.fillStyle = COL().aux;
      res.rows.forEach((r) => {
        if (r.c >= gx0 && r.c <= gx1) { ctx.beginPath(); ctx.arc(X(r.c), zy, 2.4, 0, Math.PI * 2); ctx.fill(); }
      });
    });
  } catch (err) { showError(out, err.message); }
});

/* ---- FIXED POINT handler ---- */
document.getElementById("fp-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const out = document.getElementById("fp-output");
  try {
    const gStr = document.getElementById("fp-g").value;
    const g = compileFunction(gStr);
    const x0 = readNum("fp-x0", "x₀");
    const tol = readNum("fp-tol", "Ýalňyşlyk çägi");
    if (tol <= 0) throw new Error("Ýalňyşlyk çägi položitel bolmaly.");
    const iter = readInt("fp-iter", "Iň köp gaýtalama sany", 1, 500);
    const res = fixedPointIteration(g, x0, tol, iter);
    out.innerHTML = "";
    if (!res.ok) { showError(out, res.error); return; }
    const box = resultSummary(res, (x) => g(x) - x);
    if (res.maxSlope >= 1) {
      const w = el("div", "result-warn-line", "Bellik: iterasiýanyň dowamynda synag edilen nokatlaryň arasynda x ≈ " + fmt(res.maxSlopeAt) + " nokadynda |g'(x)| ≈ " + fmt(res.maxSlope) + " ≥ 1 boldy — ýygjamlaşma kepillenmändi, netije ýalňyş bolup biler.");
      box.appendChild(w);
    } else {
      const info = el("div", "result-info-line", "Barlanan ähli nokatlarda |g'(x)| < 1 (iň ýokary bahasy ≈ " + fmt(res.maxSlope) + ") — bu ýygjamlaşma şertiniň berjaý edilendigini tassyklaýar.");
      box.appendChild(info);
    }
    out.appendChild(box);
    const rows = res.rows.map((r) => [r.n, fmt(r.x), fmt(r.dg), fmt(r.xNext), fmt(r.err)]);
    out.appendChild(buildTable(["№", "xₙ", "g'(xₙ)", "xₙ₊₁ = g(xₙ)", "Ýalňyşlyk"], rows));
    out.appendChild(buildStepExplanation("fixed", res));
    const { wrap, canvas } = buildGraphBlock(
      '<span><i class="swatch" style="background:var(--nu-c1)"></i> y=g(x)</span>' +
      '<span><i class="swatch dashed" style="border-top-color:var(--nu-axis)"></i> y=x</span>' +
      '<span><i class="swatch dashed" style="border-top-color:var(--nu-c3)"></i> gaýtalama ýoly (kobweb)</span>' +
      '<span><i class="swatch dot"></i> tapylan kök</span>');
    out.appendChild(wrap);
    const xsPath = [x0].concat(res.rows.slice(0, 12).map((r) => r.xNext));
    const [gx0r, gx1r] = graphRange(xsPath, res.root);
    drawCobweb(canvas, g, gx0r, gx1r, res.root, xsPath);
  } catch (err) { showError(out, err.message); }
});

/* ---- NEWTON handler ---- */
document.getElementById("nt-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const out = document.getElementById("nt-output");
  try {
    const fStr = document.getElementById("nt-f").value;
    const f = compileFunction(fStr);
    const fpStr = document.getElementById("nt-fprime").value.trim();
    const fprime = fpStr ? compileFunction(fpStr) : null;
    const x0 = readNum("nt-x0", "x₀");
    const tol = readNum("nt-tol", "Ýalňyşlyk çägi");
    if (tol <= 0) throw new Error("Ýalňyşlyk çägi položitel bolmaly.");
    const iter = readInt("nt-iter", "Iň köp gaýtalama sany", 1, 500);
    const res = newtonRaphson(f, fprime, x0, tol, iter);
    out.innerHTML = "";
    if (!res.ok) { showError(out, res.error); return; }
    const box = resultSummary(res, f);
    if (!fprime) {
      const note = el("div", "result-info-line", (typeof f.deriv === "function" ? "f'(x) meýdany boş goýlandygy üçin, önüm math.js bilen takyk (simwoliki) differensirlenip awtomatik hasaplandy." : "f'(x) meýdany boş goýlandygy üçin, önüm merkezleýin sanly differensirleme — f'(x) ≈ (f(x+h) − f(x−h)) / (2h) — bilen awtomatik hasaplandy."));
      box.appendChild(note);
    }
    out.appendChild(box);
    const rows = res.rows.map((r) => [r.n, fmt(r.x), fmt(r.fx), fmt(r.dfx), fmt(r.xNext), fmt(r.err)]);
    out.appendChild(buildTable(["№", "xₙ", "f(xₙ)", "f'(xₙ)", "xₙ₊₁", "Ýalňyşlyk"], rows));
    out.appendChild(buildStepExplanation("newton", res));
    const { wrap, canvas } = buildGraphBlock(
      '<span><i class="swatch" style="background:var(--nu-c1)"></i> f(x)</span>' +
      '<span><i class="swatch dashed"></i> 1-nji tangens çyzygy</span>' +
      '<span><i class="swatch dot"></i> tapylan kök</span>');
    out.appendChild(wrap);
    const [gx0, gx1] = graphRange([x0], res.root);
    drawGraph(canvas, f, gx0, gx1, res.root, function (ctx, X, Y, clampY) {
      if (!res.rows.length) return;
      const r0 = res.rows[0];
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = COL().aux; ctx.lineWidth = 1.4;
      const span = (gx1 - gx0) * 0.6 || 1;
      const xA = r0.x - span, xB = r0.x + span;
      const yA = r0.fx + r0.dfx * (xA - r0.x);
      const yB = r0.fx + r0.dfx * (xB - r0.x);
      ctx.beginPath(); ctx.moveTo(X(xA), clampY(yA)); ctx.lineTo(X(xB), clampY(yB)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COL().aux;
      ctx.beginPath(); ctx.arc(X(r0.x), clampY(r0.fx), 3, 0, Math.PI * 2); ctx.fill();
    });
  } catch (err) { showError(out, err.message); }
});

/* ---- SECANT handler ---- */
document.getElementById("sc-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const out = document.getElementById("sc-output");
  try {
    const fStr = document.getElementById("sc-f").value;
    const f = compileFunction(fStr);
    const x0 = readNum("sc-x0", "x₀");
    const x1 = readNum("sc-x1", "x₁");
    if (x0 === x1) throw new Error("x₀ we x₁ deň bolmaly däl.");
    const tol = readNum("sc-tol", "Ýalňyşlyk çägi");
    if (tol <= 0) throw new Error("Ýalňyşlyk çägi položitel bolmaly.");
    const iter = readInt("sc-iter", "Iň köp gaýtalama sany", 1, 500);
    const res = secantMethod(f, x0, x1, tol, iter);
    out.innerHTML = "";
    if (!res.ok) { showError(out, res.error); return; }
    out.appendChild(resultSummary(res, f));
    const rows = res.rows.map((r) => [r.n, fmt(r.x0), fmt(r.x1), fmt(r.f0), fmt(r.f1), fmt(r.x2), fmt(r.f2), fmt(r.err)]);
    out.appendChild(buildTable(["№", "xₙ₋₁", "xₙ", "f(xₙ₋₁)", "f(xₙ)", "xₙ₊₁", "f(xₙ₊₁)", "Ýalňyşlyk"], rows));
    out.appendChild(buildStepExplanation("secant", res));
    const { wrap, canvas } = buildGraphBlock(
      '<span><i class="swatch" style="background:var(--nu-c1)"></i> f(x)</span>' +
      '<span><i class="swatch dashed"></i> 1-nji sekant çyzygy</span>' +
      '<span><i class="swatch dot"></i> tapylan kök</span>');
    out.appendChild(wrap);
    const [gx0, gx1] = graphRange([x0, x1], res.root);
    drawGraph(canvas, f, gx0, gx1, res.root, function (ctx, X, Y, clampY) {
      if (!res.rows.length) return;
      const r0 = res.rows[0];
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = COL().aux; ctx.lineWidth = 1.4;
      const slope = (r0.f1 - r0.f0) / (r0.x1 - r0.x0);
      const span = (gx1 - gx0) * 0.6 || 1;
      const xA = r0.x0 - span, xB = r0.x1 + span;
      const yA = r0.f0 + slope * (xA - r0.x0);
      const yB = r0.f0 + slope * (xB - r0.x0);
      ctx.beginPath(); ctx.moveTo(X(xA), clampY(yA)); ctx.lineTo(X(xB), clampY(yB)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COL().aux;
      [[r0.x0, r0.f0], [r0.x1, r0.f1]].forEach(function (p) {
        ctx.beginPath(); ctx.arc(X(p[0]), clampY(p[1]), 3, 0, Math.PI * 2); ctx.fill();
      });
    });
  } catch (err) { showError(out, err.message); }
});

/* ---- Mysal ulan düwmeleri ---- */
const EXAMPLE_TARGETS = {
  bisection: { formId: "bis-form", outputId: "bis-output" },
  fixed: { formId: "fp-form", outputId: "fp-output" },
  newton: { formId: "nt-form", outputId: "nt-output" },
  secant: { formId: "sc-form", outputId: "sc-output" },
};
document.querySelectorAll("[data-example]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const kind = btn.dataset.example;
    if (kind === "bisection") {
      document.getElementById("bis-f").value = "x^3 - x - 2";
      document.getElementById("bis-a").value = "1";
      document.getElementById("bis-b").value = "2";
      document.getElementById("bis-tol").value = "0.000001";
      document.getElementById("bis-iter").value = "50";
    } else if (kind === "fixed") {
      document.getElementById("fp-g").value = "cos(x)";
      document.getElementById("fp-x0").value = "0.5";
      document.getElementById("fp-tol").value = "0.000001";
      document.getElementById("fp-iter").value = "100";
    } else if (kind === "newton") {
      document.getElementById("nt-f").value = "x^3 - x - 2";
      document.getElementById("nt-fprime").value = "3x^2 - 1";
      document.getElementById("nt-x0").value = "1.5";
      document.getElementById("nt-tol").value = "0.0000001";
      document.getElementById("nt-iter").value = "50";
    } else if (kind === "secant") {
      document.getElementById("sc-f").value = "cos(x) - x";
      document.getElementById("sc-x0").value = "0";
      document.getElementById("sc-x1").value = "1";
      document.getElementById("sc-tol").value = "0.0000001";
      document.getElementById("sc-iter").value = "50";
    }
    // Mysal doldurylandan soň awtomatik hasapla — ulanyjy ýene "Hasaplaň" basmaly bolmaly däl.
    const target = EXAMPLE_TARGETS[kind];
    if (target) {
      const form = document.getElementById(target.formId);
      if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event("submit", { cancelable: true }));
      const out = document.getElementById(target.outputId);
      if (out) out.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
});

})();
