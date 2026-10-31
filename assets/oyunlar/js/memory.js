(function(){
  "use strict";
  const $ = (id) => document.getElementById(id);
  const PAIRS = {easy:6, mid:8, hard:8};
  let level = Store.pick("mm.level", Object.keys(PAIRS), "mid");
  let first=null, second=null, moves=0, pairs=0, lock=false, pending=null;
  let started=false, finished=false, elapsed=0, segStart=0, clock=null;   // wagt: başga oýuna geçilende duruzylýar

  const panel = $("gameMemory"), statRow = $("mmMoves").closest(".game-row");
  addStat(statRow, "mmTime", "Wagt", "0:00");
  addStat(statRow, "mmBest", "Rekord", "–");
  const ctl = document.createElement("div"); ctl.className = "game-row";
  ctl.appendChild(makeChips([["easy","Ýeňil"],["mid","Orta"],["hard","Kyn"]], level, (v) => { level = v; Store.set("mm.level", v); render(); }));
  panel.insertBefore(ctl, statRow);
  const showBest = () => { const b = Store.num("mm.best." + level, 0); $("mmBest").textContent = b || "–"; };

  const secsNow = () => Math.floor((elapsed + (segStart ? Date.now() - segStart : 0)) / 1000);
  const paint = () => { $("mmTime").textContent = fmtTime(secsNow()); };
  function startClock(){ if (segStart) return; segStart = Date.now(); clock = setInterval(paint, 500); }
  function pauseClock(){ if (!segStart) return; elapsed += Date.now() - segStart; segStart = 0; clearInterval(clock); clock = null; }

  function buildDeck(){
    const k = PAIRS[level], items = [];
    if (level !== "hard"){
      shuffle(math.range(1, level === "easy" ? 12 : 20, true).toArray()).slice(0, k)
        .forEach(v => items.push({p:v, t:String(v)}, {p:v, t:String(v)}));
    } else {
      const seen = new Set();
      while (seen.size < k){
        const a = math.randomInt(2, 13), b = math.randomInt(2, 13), op = ["+","×","−"][math.randomInt(0, 3)];
        const r = op === "+" ? math.add(a, b) : op === "×" ? math.multiply(a, b) : math.subtract(a, b);
        if (r < 2 || seen.has(r) || (op === "−" && a <= b)) continue;
        seen.add(r);
        items.push({p:r, t:`${a}${op}${b}`}, {p:r, t:String(r)});
      }
    }
    return shuffle(items);
  }

  const refresh = (card) => card.setAttribute("aria-label",
    card.classList.contains("flipped") || card.classList.contains("matched") ? card.dataset.t : "Ýapyk kart");

  function render(){
    clearTimeout(pending); pauseClock();             // täzeden başlananda köne taýmeri ýatyr
    elapsed = 0; started = finished = false;
    first = second = null; moves = pairs = 0; lock = false;
    $("mmMoves").textContent = 0; $("mmPairs").textContent = 0; $("mmTime").textContent = "0:00";
    $("mmPairsTotal").textContent = PAIRS[level]; showBest();
    $("mmFeedback").className = "game-feedback"; $("mmFeedback").textContent = "";
    const grid = $("mmGrid"); grid.innerHTML = "";
    buildDeck().forEach((it) => {
      const card = document.createElement("div");
      card.className = "memory-card"; card.dataset.p = it.p; card.dataset.t = it.t;
      card.setAttribute("role", "button"); card.tabIndex = 0; refresh(card);
      card.innerHTML = `<div class="inner"><div class="face front" aria-hidden="true">?</div><div class="face back${it.t.length > 3 ? " sm" : ""}" aria-hidden="true">${it.t}</div></div>`;
      card.addEventListener("click", () => flip(card));
      card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); flip(card); } });
      grid.appendChild(card);
    });
  }

  function flip(card){
    if (lock || card.classList.contains("flipped") || card.classList.contains("matched")) return;
    if (!started){ started = true; startClock(); }
    card.classList.add("flipped"); refresh(card);
    if (!first){ first = card; return; }
    second = card; moves++; lock = true;
    $("mmMoves").textContent = moves;
    if (first.dataset.p === second.dataset.p){
      [first, second].forEach(c => { c.classList.add("matched"); c.tabIndex = -1; c.setAttribute("aria-disabled", "true"); refresh(c); });
      pairs++; $("mmPairs").textContent = pairs;
      first = second = null; lock = false;
      if (pairs === PAIRS[level]) win();
    } else {
      pending = setTimeout(() => {
        [first, second].forEach(c => { c.classList.remove("flipped"); refresh(c); });
        first = second = null; lock = false;
      }, 800);
    }
  }

  function win(){
    finished = true; pauseClock();
    const secs = Math.floor(elapsed / 1000), key = "mm.best." + level, prev = Store.num(key, 0);
    const isBest = !prev || moves < prev;
    if (isBest) Store.set(key, moves);
    showBest();
    $("mmTime").textContent = fmtTime(secs);
    $("mmFeedback").className = "game-feedback ok";
    $("mmFeedback").textContent = `Gutardy! ${moves} synanyşykda, ${fmtTime(secs)} wagtda.` + (isBest ? " 🏆 Täze rekord!" : "");
  }

  $("mmRestart").addEventListener("click", render);
  document.addEventListener("amatly:tab", (e) => {   // başga oýuna geçilende wagt duruzylýar, gaýdyp gelende dowam edýär
    if (!started || finished) return;
    if (e.detail.id === "gameMemory") startClock(); else pauseClock();
  });
  render();
})();
