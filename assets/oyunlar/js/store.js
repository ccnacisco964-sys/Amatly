// Shared helpers: safe localStorage + small UI builders
window.Store = {
  get(k, d){ try { const v = localStorage.getItem("amatly:" + k); return v === null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem("amatly:" + k, JSON.stringify(v)); } catch(e){} },
  // bozulan / elde üýtgedilen maglumata garşy: diňe rugsat berlen bahalary kabul edýär
  pick(k, allowed, d){ const v = this.get(k, d); return allowed.includes(v) ? v : d; },
  num(k, d){ const v = this.get(k, d); return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d; }
};
window.makeChips = function(options, initial, onChange, label){
  const wrap = document.createElement("div"); wrap.className = "chips"; wrap.setAttribute("role", "group");
  options.forEach(([val, label]) => {
    const b = document.createElement("button"); b.type = "button";
    const on = val === initial;
    b.className = "chip" + (on ? " on" : ""); b.setAttribute("aria-pressed", on ? "true" : "false"); b.textContent = label;
    b.addEventListener("click", () => {
      if (wrap.classList.contains("locked")) return;
      wrap.querySelectorAll(".chip").forEach(c => { c.classList.remove("on"); c.setAttribute("aria-pressed", "false"); });
      b.classList.add("on"); b.setAttribute("aria-pressed", "true"); onChange(val);
    });
    wrap.appendChild(b);
  });
  if (!label) return wrap;
  const group = document.createElement("div"); group.className = "chip-group";
  const l = document.createElement("span"); l.className = "chip-label"; l.textContent = label;
  group.append(l, wrap); return group;
};
window.addStat = function(row, id, label, init){
  const s = document.createElement("span"); s.className = "game-score";
  s.innerHTML = `${label}: <span id="${id}">${init}</span>`; row.appendChild(s);
};
window.fmtTime = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
// Fisher–Yates shuffle (math.pickRandom picks WITH replacement, so it can't be used for this)
window.shuffle = function(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){ const j = math.randomInt(0, i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
