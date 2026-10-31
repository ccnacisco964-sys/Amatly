(function(){
  "use strict";
  const $ = (id) => document.getElementById(id);
  const LV = {
    easy:{n:20, m:10, ops:["+","-"], k:1},
    mid: {n:50, m:12, ops:["+","-","×"], k:2},
    hard:{n:100, m:15, ops:["+","-","×","÷"], k:3}
  };
  const DURATION = 60000, WARN = 10000;
  let level = Store.pick("qm.level", Object.keys(LV), "mid");
  let score=0, total=0, streak=0, points=0, answer=0, running=false, deadline=0, timer=null, last="";

  const panel = $("gameQuickmath"), statRow = $("qmTime").closest(".game-row"), fb = $("qmFeedback"), input = $("qmInput");
  addStat(statRow, "qmStreak", "Yzygiderli", 0);
  addStat(statRow, "qmPoints", "Bal", 0);
  addStat(statRow, "qmBest", "Rekord", 0);
  const ctl = document.createElement("div"); ctl.className = "game-row";
  const chips = makeChips([["easy","Ýeňil"],["mid","Orta"],["hard","Kyn"]], level, (v) => { level = v; Store.set("qm.level", v); showBest(); });
  ctl.appendChild(chips); panel.insertBefore(ctl, statRow);
  const bar = document.createElement("div"); bar.className = "timebar"; bar.innerHTML = "<i></i>";
  panel.insertBefore(bar, statRow.nextSibling);
  const best = () => Store.num("qm.best." + level, 0);
  const showBest = () => { $("qmBest").textContent = best(); };
  const say = (cls, msg) => { fb.className = "game-feedback" + (cls ? " " + cls : ""); fb.textContent = msg; };
  showBest();

  function newProblem(){
    const L = LV[level]; let a, b, op, ans, txt;
    do {
      op = L.ops[math.randomInt(0, L.ops.length)];
      if (op === "×"){ a = math.randomInt(2, L.m+1); b = math.randomInt(2, L.m+1); ans = math.multiply(a, b); }
      else if (op === "÷"){ b = math.randomInt(2, L.m+1); ans = math.randomInt(2, L.m+1); a = math.multiply(b, ans); }
      else {
        a = math.randomInt(1, L.n+1); b = math.randomInt(1, L.n+1);
        if (op === "-" && b > a) [a, b] = [b, a];
        ans = op === "+" ? math.add(a, b) : math.subtract(a, b);
      }
      txt = `${a} ${op} ${b} =`;
    } while (txt === last);
    last = txt; answer = ans;
    $("qmProblem").textContent = txt;
    input.value = ""; input.focus();
  }

  function tick(){
    const ms = Math.max(0, deadline - Date.now());
    $("qmTime").textContent = Math.ceil(ms / 1000);
    bar.firstChild.style.width = (ms / DURATION * 100) + "%";
    bar.firstChild.classList.toggle("low", ms <= WARN);
    if (ms <= 0) finish(false);
  }

  function finish(cancelled){
    running = false; clearInterval(timer); timer = null; chips.classList.remove("locked");
    $("qmPlayArea").hidden = true; $("qmStart").hidden = false;
    if (cancelled){                                   // başga oýuna geçilende netije ýazylmaýar
      say("", "Oýun togtadyldy.");
      $("qmStart").textContent = "Başlaň";
      $("qmTime").textContent = Math.round(DURATION / 1000);
      bar.firstChild.style.width = "100%"; bar.firstChild.classList.remove("low");
      return;
    }
    const prev = best(), isBest = points > prev;
    if (isBest){ Store.set("qm.best." + level, points); showBest(); }
    const acc = total ? Math.round(score / total * 100) : 0;
    say("ok", `Wagt gutardy! ${score}/${total} dogry (${acc}%), ${points} bal.` + (isBest ? " 🏆 Täze rekord!" : ""));
    $("qmStart").textContent = "Täzeden başlaň";
  }

  function check(){
    if (!running) return;
    const raw = input.value.trim();
    if (raw === "") return;                           // boş jogap sanalmaýar
    if (!/^\d+$/.test(raw)){ say("bad", "Diňe sanlary ýazyň."); input.select(); return; }   // nädogry format sanalmaýar
    total++;
    if (Number(raw) === answer){
      score++;
      const gain = (10 + 2 * Math.min(streak, 10)) * LV[level].k;   // yzygiderli + kynlyk bonusy
      streak++; points += gain;
      say("ok", `Dogry! +${gain}` + (streak >= 3 ? ` 🔥 ${streak}` : ""));
    } else {
      streak = 0;
      say("bad", `Ýalňyş, dogry jogap: ${answer}`);
    }
    $("qmScore").textContent = score; $("qmTotal").textContent = total;
    $("qmStreak").textContent = streak; $("qmPoints").textContent = points;
    newProblem();
  }

  $("qmStart").addEventListener("click", () => {
    score = total = streak = points = 0; last = "";
    ["qmScore","qmTotal","qmStreak","qmPoints"].forEach(id => $(id).textContent = 0);
    say("", "");
    $("qmStart").hidden = true; $("qmPlayArea").hidden = false;
    chips.classList.add("locked"); running = true;
    deadline = Date.now() + DURATION;
    newProblem(); tick(); clearInterval(timer); timer = setInterval(tick, 200);
  });
  $("qmCheck").addEventListener("click", check);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
  document.addEventListener("amatly:tab", (e) => { if (running && e.detail.id !== "gameQuickmath") finish(true); });
})();
