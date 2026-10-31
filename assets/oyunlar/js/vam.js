(function(){
  "use strict";
  const $ = (id) => document.getElementById(id);
  let n = Store.pick("vam.n", [3, 4], 3), hard = Store.pick("vam.hard", [false, true], false);
  const modeKey = () => "vam.best." + n + (hard ? "h" : "e");          // her režim üçin aýratyn rekord
  let score=0, total=0, streak=0, bestStreak = Store.num(modeKey(), 0), q = null;
  const names = (p, k) => Array.from({length:k}, (_, i) => p + (i+1));
  const penalty = (line) => { const s = math.sort(line.slice()); return math.subtract(s[1], s[0]); };

  const panel = $("gamePenalty"), statRow = $("pnScore").closest(".game-row");
  addStat(statRow, "pnStreak", "Yzygiderli", 0);
  addStat(statRow, "pnBest", "Rekord", bestStreak);
  const ctl = document.createElement("div"); ctl.className = "game-row";
  const modeChanged = () => { score = total = streak = 0; bestStreak = Store.num(modeKey(), 0); stats(); newQuestion(); };
  ctl.append(
    makeChips([[3,"3×3"],[4,"4×4"]], n, (v) => { n = v; Store.set("vam.n", v); modeChanged(); }),
    makeChips([[false,"Açyk"],[true,"Gizlin (kyn)"]], hard, (v) => { hard = v; Store.set("vam.hard", v); modeChanged(); }, "Tapawutlar:")
  );
  panel.insertBefore(ctl, statRow);

  function stats(){
    $("pnScore").textContent = score; $("pnTotal").textContent = total; $("pnStreak").textContent = streak;
    if (streak > bestStreak){ bestStreak = streak; Store.set(modeKey(), bestStreak); }
    $("pnBest").textContent = bestStreak;
  }
  const say = (cls, msg) => { $("pnFeedback").className = "game-feedback" + (cls ? " " + cls : ""); $("pnFeedback").textContent = msg; };
  const cellEl = (r, c) => $("pnTableWrap").querySelector(`td[data-r="${r}"][data-c="${c}"]`);

  function lineCells(key){                         // saýlanan setir/sütündäki öýjükler
    const i = q.R.indexOf(key);
    if (i >= 0) return q.costs[i].map((_, j) => [i, j]);
    const j = q.C.indexOf(key);
    return q.costs.map((_, r) => [r, j]);
  }

  function newQuestion(){
    const R = names("S", n), C = names("D", n), keys = [...R, ...C];
    let costs, rowPen, colPen, win, guard = 0;
    do {
      costs = math.matrix(math.randomInt([n, n], 1, 50));
      rowPen = costs.toArray().map(penalty);
      colPen = math.transpose(costs).toArray().map(penalty);
      const all = [...rowPen, ...colPen], mx = math.max(all);
      win = keys.filter((_, i) => all[i] === mx);
    } while (win.length !== 1 && ++guard < 500);   // tutuş ýagdaýynda hemmesi dogry sanalýar
    q = {costs: costs.toArray(), rowPen, colPen, R, C, win, phase: 1};

    const sh = !hard;
    let h = "<table class='grid'><thead><tr><th></th>" + C.map(c => `<th>${c}</th>`).join("") + "<th>Setir tapawudy</th></tr></thead><tbody>";
    q.costs.forEach((row, i) => {
      h += `<tr><td class="rowhead">${R[i]}</td>` + row.map((v, j) => `<td class="cell" data-r="${i}" data-c="${j}">${v}</td>`).join("")
        + `<td class="pen" data-v="${rowPen[i]}">${sh ? rowPen[i] : "?"}</td></tr>`;
    });
    h += `<tr><td class="rowhead">Sütün tapawudy</td>` + colPen.map(v => `<td class="pen" data-v="${v}">${sh ? v : "?"}</td>`).join("") + "<td></td></tr></tbody></table>";
    $("pnTableWrap").innerHTML = h;

    const wrap = $("pnOptions"); wrap.innerHTML = "";
    shuffle(keys).forEach(key => {
      const b = document.createElement("button");
      b.className = "penalty-opt"; b.type = "button"; b.textContent = key;
      b.addEventListener("click", () => pickLine(key, b));
      wrap.appendChild(b);
    });
    say("", hard ? "1-nji ädim: tapawutlary özüňiz hasaplaň we iň ýokarysyny saýlaň." : "");
  }

  function pickLine(key, btn){                     // 1-nji ädim: iň ýokary tapawut
    if (!q || q.phase !== 1) return;
    total++;
    const btns = $("pnOptions").querySelectorAll(".penalty-opt");
    btns.forEach(b => { b.disabled = true; });
    document.querySelectorAll("#pnTableWrap td.pen").forEach(td => { td.textContent = td.dataset.v; });
    if (q.win.includes(key)){
      score++; btn.classList.add("correct"); q.phase = 2; q.line = key;
      lineCells(key).forEach(([r, c]) => {
        const el = cellEl(r, c); el.classList.add("pick"); el.tabIndex = 0; el.setAttribute("role", "button");
      });
      say("ok", `Dogry! Indi ${key} boýunça iň arzan öýjügi saýlaň.`);
    } else {
      q.phase = 0; streak = 0;
      btn.classList.add("wrong");
      btns.forEach(b => { if (q.win.includes(b.textContent)) b.classList.add("correct"); });
      say("bad", `Ýalňyş. Dogry jogap: ${q.win.join(" / ")}.`);
    }
    stats();
  }

  function pickCell(td){                           // 2-nji ädim: iň arzan öýjük
    if (!td || !q || q.phase !== 2) return;
    q.phase = 0; total++;
    const cells = lineCells(q.line), minV = math.min(cells.map(([r, c]) => q.costs[r][c]));
    const ok = q.costs[+td.dataset.r][+td.dataset.c] === minV;
    cells.forEach(([r, c]) => {
      const el = cellEl(r, c);
      el.classList.remove("pick"); el.removeAttribute("tabindex"); el.removeAttribute("role");
      if (q.costs[r][c] === minV) el.classList.add("cell-ok");
    });
    if (ok){ score++; streak++; say("ok", `Dogry! ${q.line} boýunça iň arzan baha ${minV}.`); }
    else { streak = 0; td.classList.add("cell-bad"); say("bad", `Ýalňyş. Iň arzan baha: ${minV}.`); }
    stats();
  }
  $("pnTableWrap").addEventListener("click", (e) => pickCell(e.target.closest("td.pick")));
  $("pnTableWrap").addEventListener("keydown", (e) => {          // klawiatura bilen hem saýlap bolýar
    if (e.key !== "Enter" && e.key !== " ") return;
    const td = e.target.closest("td.pick");
    if (td){ e.preventDefault(); pickCell(td); }
  });

  $("pnNext").addEventListener("click", () => {
    if (q && q.phase !== 0){ streak = 0; stats(); }                // jogapsyz geçmek yzygiderlini üzýär
    newQuestion();
  });
  newQuestion();
})();
