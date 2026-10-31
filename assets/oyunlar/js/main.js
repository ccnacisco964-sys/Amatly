(function(){
  "use strict";
  const $ = (id) => document.getElementById(id);
  const tabs = Array.from(document.querySelectorAll(".game-tab"));
  const panels = Array.from(document.querySelectorAll(".game-panel"));
  const SHORT = {gameQuickmath:"tizlik", gamePenalty:"vam", gameMemory:"sanlary", gameNumbers:"sanaw"};
  const ALIAS = {tizlik:"gameQuickmath", tiz:"gameQuickmath", quickmath:"gameQuickmath", vam:"gamePenalty", tapawut:"gamePenalty", penalty:"gamePenalty",
                 sanlary:"gameMemory", memory:"gameMemory", sanaw:"gameNumbers", numbers:"gameNumbers"};

  // ---- kiçi habar (toast) ----
  const toastEl = $("toast"); let toastTimer = 0;
  function toast(msg){
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3200);
  }

  // ---- oýun saýlaýjy (tabs) ----
  function show(id, silent){
    const tab = tabs.find(t => t.dataset.target === id);
    if (!tab) return false;
    tabs.forEach(t => { const on = t === tab; t.classList.toggle("active", on); t.setAttribute("aria-selected", on ? "true" : "false"); });
    panels.forEach(p => { p.hidden = p.id !== id; });
    if (!silent){ try { history.replaceState(null, "", "#" + SHORT[id]); } catch(e){} }
    document.dispatchEvent(new CustomEvent("amatly:tab", {detail:{id}}));   // oýunlar şuňa görä togtaýar / dowam edýär
    return true;
  }
  tabs.forEach(tab => tab.addEventListener("click", () => show(tab.dataset.target)));

  // oyunlar.html#vam ýaly göni salgylar
  function fromHash(){
    let h = ""; try { h = decodeURIComponent(location.hash.slice(1)).toLowerCase(); } catch(e){}
    const p = panels.find(x => x.id.toLowerCase() === h);
    return ALIAS[h] || (p ? p.id : null);
  }
  const startId = fromHash();
  if (startId){ show(startId, true); requestAnimationFrame(() => $("games").scrollIntoView()); }
  window.addEventListener("hashchange", () => { const id = fromHash(); if (id){ show(id, true); $("games").scrollIntoView({behavior:"smooth"}); } });

  // ---- gözleg: oýunlary tapýar ----
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");   // ý→y, ň→n, ş→s ...
  tabs.forEach(t => { t._hay = norm(t.textContent + " " + (t.dataset.keywords || "")); });
  $("searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("searchInput"), raw = input.value.trim();
    const words = norm(raw).split(/\s+/).filter(w => w.length > 1);
    if (!words.length){ toast("Gözlemek üçin söz ýazyň (iň az 2 harp)."); input.focus(); return; }
    let best = null, top = 0;
    tabs.forEach(t => { const n = words.filter(w => t._hay.includes(w)).length; if (n > top){ top = n; best = t; } });
    if (!best){ toast("«" + raw + "» boýunça oýun tapylmady."); return; }
    show(best.dataset.target);
    $("games").scrollIntoView({behavior:"smooth", block:"start"});
    input.blur();
    toast("«" + best.querySelector("b").textContent + "» açyldy.");
  });

  // entek taýýar däl bölümler
  document.querySelectorAll("a[data-soon]").forEach(a => a.addEventListener("click", (e) => {
    e.preventDefault(); toast("«" + a.textContent.trim() + "» bölümi ýakynda goşular.");
  }));

  // ---- 3D effect triggers (restart CSS animations on content change) ----
  const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const watch = (el, cls) => el && new MutationObserver(() => replay(el, cls)).observe(el, {childList:true, characterData:true, subtree:true});
  document.querySelectorAll(".game-feedback").forEach(el => watch(el, "fx"));
  ["qmProblem","nmProblem"].forEach(id => watch($(id), "flip-in"));

  // staggered row index for memory cards
  const grid = $("mmGrid");
  new MutationObserver(() => {
    grid.querySelectorAll(".memory-card").forEach((c,i) => c.style.setProperty("--r", Math.floor(i/4)));
  }).observe(grid, {childList:true});
})();
