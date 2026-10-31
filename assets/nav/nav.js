/* Amatly.com — umumy nawigasiýa menýusynyň skripti */
(function () {
  "use strict";
  var nav = document.getElementById("amxNav");
  if (!nav) return;
  var root = document.documentElement;
  var burger = nav.querySelector(".amx-burger");
  var panel = nav.querySelector(".amx-panel");
  var scrim = nav.querySelector(".amx-scrim");
  var closeBtn = nav.querySelector(".amx-close");
  var mega = nav.querySelector(".amx-has-mega");
  var trigger = mega ? mega.querySelector(".amx-trigger") : null;
  var mobile = window.matchMedia("(max-width: 899px)");
  var hoverOk = window.matchMedia("(hover: hover) and (pointer: fine)");
  var timer = 0, byHover = false;

  function setMega(open) {
    if (!mega) return;
    mega.classList.toggle("is-open", open);
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function setDrawer(open, back) {
    nav.classList.toggle("is-open", open);
    root.classList.toggle("amx-lock", open);
    burger.setAttribute("aria-expanded", open ? "true" : "false");
    burger.setAttribute("aria-label", open ? "Menýuny ýap" : "Menýuny aç");
    if (open && closeBtn) closeBtn.focus();
    if (!open && back) burger.focus();
  }

  if (mega) {
    trigger.addEventListener("click", function () {
      if (byHover) { byHover = false; return; }
      setMega(!mega.classList.contains("is-open"));
    });
    trigger.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowDown") return;
      e.preventDefault();
      setMega(true);
      var first = mega.querySelector(".amx-item");
      if (first) first.focus();
    });
    mega.addEventListener("mouseenter", function () {
      if (!hoverOk.matches || mobile.matches) return;
      clearTimeout(timer); byHover = true; setMega(true);
    });
    mega.addEventListener("mouseleave", function () {
      if (!hoverOk.matches) return;
      clearTimeout(timer); byHover = false;
      timer = setTimeout(function () { setMega(false); }, 180);
    });
    mega.addEventListener("focusout", function (e) {
      if (e.relatedTarget && !mega.contains(e.relatedTarget)) setMega(false);
    });
  }

  burger.addEventListener("click", function () { setDrawer(!nav.classList.contains("is-open")); });
  if (closeBtn) closeBtn.addEventListener("click", function () { setDrawer(false, true); });
  if (scrim) scrim.addEventListener("click", function () { setDrawer(false, true); });
  panel.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a[href]") : null;
    if (a && !a.classList.contains("amx-soon")) setDrawer(false);
  });
  nav.querySelectorAll(".amx-soon").forEach(function (a) {
    a.addEventListener("click", function (e) { e.preventDefault(); });
  });

  document.addEventListener("click", function (e) {
    if (mega && !mega.contains(e.target)) setMega(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (nav.classList.contains("is-open")) setDrawer(false, true);
    else if (mega && mega.classList.contains("is-open")) { setMega(false); trigger.focus(); }
  });

  function onChange() { if (!mobile.matches) setDrawer(false); setMega(false); }
  if (mobile.addEventListener) mobile.addEventListener("change", onChange); else mobile.addListener(onChange);

  function stuck() { nav.classList.toggle("is-stuck", nav.getBoundingClientRect().top <= 0.5); }
  window.addEventListener("scroll", stuck, { passive: true });
  stuck();
})();

/* Soňky açylan sahypalar (Baş sahypadaky "Soňky açanlaryňyz" üçin) */
(function () {
  try {
    var sc = document.querySelector('script[src*="assets/nav/nav.js"]');
    if (!sc) return;
    var base = sc.src.replace(/assets\/nav\/nav\.js.*$/, "");
    var path = location.href.split("#")[0].split("?")[0].slice(base.length);
    if (!path || path === "index.html" || /^(taze|pikirler|sazlamalar)\//.test(path) || /^404/.test(path)) return;
    if (document.body && document.body.getAttribute("data-page") === "notfound") return;   /* 404 sahypasy islendik ýok salgyda görkezilýär */
    var title = document.title.split(/\s[|—–]\s/)[0].trim();
    var list = JSON.parse(localStorage.getItem("amatly_recent") || "[]");
    list = list.filter(function (x) { return x && x.u !== path; });
    list.unshift({ u: path, t: title });
    localStorage.setItem("amatly_recent", JSON.stringify(list.slice(0, 4)));
  } catch (e) {}
})();

/* Gözleg: assets/nav/search.js we search-index.js (≈130 KB) diňe gerek bolanda ýüklenýär —
   gözleg meýdanyna basylanda / fokus bolanda, «/» ýa-da Ctrl+K düwmesinde. window.AmatlySearchLoad() — beýleki skriptler üçin. */
(function () {
  var sc = document.querySelector('script[src*="assets/nav/nav.js"]');
  if (!sc) return;
  var b = sc.src.replace(/assets\/nav\/nav\.js.*$/, ""), p = null;
  function load() {
    if (window.AMX_SEARCH) return Promise.resolve(window.AMX_SEARCH);
    if (p) return p;
    p = new Promise(function (res, rej) {
      var n = 0;
      ["search-index.js", "search.js"].forEach(function (f) {
        var s = document.createElement("script"); s.src = b + "assets/nav/" + f; s.async = false;
        s.onload = function () { if (++n === 2) res(window.AMX_SEARCH); };
        s.onerror = function () { p = null; rej(new Error(f + " ýüklenmedi")); };
        document.head.appendChild(s);
      });
    });
    return p;
  }
  window.AmatlySearchLoad = load;
  var forms = document.querySelectorAll("form[data-site-search],form[data-site-hook]");
  [].forEach.call(forms, function (form) {
    var inp = form.querySelector("input");
    if (!inp) return;
    ["focus", "pointerdown", "input"].forEach(function (ev) { inp.addEventListener(ev, function () { load(); }, { once: true }); });
    if (form.matches("[data-site-search]")) form.addEventListener("submit", function (e) {
      if (window.AMX_SEARCH) return;
      e.preventDefault();
      load().then(function () { if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event("submit", { cancelable: true })); });
    });
  });
  /* «/» we Ctrl+K: search.js ýüklenýänçä gözleg meýdanyna geçirýär (soň search.js özi işleýär) */
  document.addEventListener("keydown", function (e) {
    if (window.AMX_SEARCH) return;
    var t = e.target, tag = t && t.tagName, f = document.querySelector("form[data-site-search] input");
    if (!f) return;
    var K = (e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey);
    if (!K && (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable))) return;
    e.preventDefault(); f.focus(); if (K) f.select();
  });
})();

/* Amatly AI: assets/ai/ (ai.css, ai-prompt.js, ai.js ≈ 130 KB) diňe gerek bolanda ýüklenýär: AI düwmesi basylanda (kursor
   onuň üstüne gelende öňünden), saýlanan tekstiň «AI-dan sora» düwmesinde, sahypa window.AmatlyAsk(...) çagyranda ýa-da ?ai=1.
   Ýüklenýänçä düwmäniň ýeňil nusgasy görkezilýär (stilleri nav.css-de). <body data-ai="off"> bolan sahypada AI ýok. */
(function () {
  var sc = document.querySelector('script[src*="assets/nav/nav.js"]');
  if (!sc || (document.body && document.body.getAttribute("data-ai") === "off")) return;
  var b = sc.src.replace(/assets\/nav\/nav\.js.*$/, ""), root = document.documentElement, p = null;
  var MARK = '<svg class="aai-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16 1.5 20.25 5.75 26.25 5.75 26.25 11.75 30.5 16 26.25 20.25 26.25 26.25 20.25 26.25 16 30.5 11.75 26.25 5.75 26.25 5.75 20.25 1.5 16 5.75 11.75 5.75 5.75 11.75 5.75Z" fill="currentColor" opacity=".16"/><path d="M16 1.5 20.25 5.75 26.25 5.75 26.25 11.75 30.5 16 26.25 20.25 26.25 26.25 20.25 26.25 16 30.5 11.75 26.25 5.75 26.25 5.75 20.25 1.5 16 5.75 11.75 5.75 5.75 11.75 5.75Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 10 22 16 16 22 10 16Z" fill="var(--aai-saffron,#e9a23b)"/></svg>';
  function load() {
    if (window.AmatlyAI) return Promise.resolve(window.AmatlyAI);
    if (p) return p;
    p = new Promise(function (res, rej) {
      if (!document.querySelector('link[href$="assets/ai/ai.css"]')) {
        var l = document.createElement("link"); l.rel = "stylesheet"; l.href = b + "assets/ai/ai.css"; document.head.appendChild(l);
      }
      var n = 0;
      ["ai-prompt.js", "ai.js"].forEach(function (f) {
        var s = document.createElement("script"); s.src = b + "assets/ai/" + f; s.async = false;
        s.onload = function () {
          if (++n < 2) return;
          if (window.AmatlyAI) res(window.AmatlyAI);
          else { p = null; rej(new Error("Amatly AI başlamady")); }
        };
        s.onerror = function () { p = null; rej(new Error(f + " ýüklenmedi")); };
        document.head.appendChild(s);
      });
    });
    return p;
  }
  window.AmatlyAILoad = load;
  window.AmatlyAsk = function (q, opts) { return load().then(function (A) { A.ask(q, opts); return A; }); };

  /* düwme (ai.js ýüklenende şol düwmäni ulanýar, täzesini döretmeýär) */
  function busy(btn, on) { if (on) { btn.setAttribute("aria-busy", "true"); btn.classList.add("is-loading"); } else { btn.removeAttribute("aria-busy"); btn.classList.remove("is-loading"); } }
  function fab() {
    if (document.querySelector(".aai-fab")) return;
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "aai-fab"; btn.title = "Amatly AI — matematika mugallymy";
    btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-haspopup", "dialog");
    btn.innerHTML = MARK + '<span class="aai-fab-t">Amatly AI</span>';
    if (document.body.getAttribute("data-ai-fab") === "off") btn.hidden = true;
    btn.addEventListener("pointerenter", function () { load().catch(function () {}); }, { once: true });
    btn.addEventListener("focus", function () { load().catch(function () {}); }, { once: true });
    btn.addEventListener("click", function () {
      if (window.AmatlyAI) { if (root.classList.contains("aai-on")) window.AmatlyAI.close(); else window.AmatlyAI.open(); return; }
      busy(btn, true);
      load().then(function (A) { busy(btn, false); btn.setAttribute("aria-controls", "aaiPanel"); A.open(); },
        function () { busy(btn, false); btn.title = "Amatly AI ýüklenmedi — internet baglanyşygyny barlap, täzeden synanyşyň."; });
    });
    document.body.appendChild(btn);
  }
  /* saýlanan tekst: «AI-dan sora» (ai.js ýüklenenden soň onuň öz düwmesi işleýär) */
  var chip = null, chipText = "", timer = 0;
  function hideChip() { if (chip) chip.hidden = true; }
  function onSel() {
    if (window.AmatlyAI) { hideChip(); return; }
    var sel = window.getSelection && window.getSelection();
    var text = sel && !sel.isCollapsed && sel.rangeCount ? sel.toString().replace(/\s+/g, " ").trim() : "";
    var node = sel && sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    if (text.length < 2 || text.length > 1500 || !node || node.closest(".aai-panel, .amx-nav, input, textarea, [contenteditable], .aai-fab, dialog")) { hideChip(); return; }
    var r = sel.getRangeAt(0).getBoundingClientRect();
    if (!r || (!r.width && !r.height)) { hideChip(); return; }
    if (!chip) {
      chip = document.createElement("button");
      chip.type = "button"; chip.className = "aai-askchip"; chip.innerHTML = MARK + "<span>AI-dan sora</span>";
      chip.addEventListener("mousedown", function (e) { e.preventDefault(); });
      chip.addEventListener("click", function () {
        var t = chipText; hideChip();
        load().then(function (A) { A.open({ quote: t, text: "Şuny düşündiriň.", select: true }); }, function () {});
      });
      document.body.appendChild(chip);
    }
    chipText = text;
    var top = r.bottom + 8, left = Math.min(window.innerWidth - 150, Math.max(8, r.left + r.width / 2 - 60));
    if (top > window.innerHeight - 50) top = r.top - 44;
    chip.style.top = Math.max(8, top) + "px"; chip.style.left = left + "px";
    chip.hidden = false;
  }
  document.addEventListener("selectionchange", function () { clearTimeout(timer); timer = setTimeout(onSel, 260); });
  window.addEventListener("scroll", hideChip, { passive: true });
  fab();
  if (/(^|[?&])ai=1(&|$)/.test(location.search)) load().catch(function () {});
})();

/* Hasap: serwerdäki hasap bilen girilen bolsa (savedLogin-da token bar), sazlamalar enjamlaryň arasynda deňleşdirilýär —
   assets/nav/account.js (≈6 KB gysylan) diňe şonda ýa-da <body data-account> sahypada ýüklenýär. */
(function () {
  if (window.AmatlyAccount || document.querySelector('script[src*="assets/nav/account.js"]')) return;
  var sc = document.querySelector('script[src*="assets/nav/nav.js"]');
  if (!sc) return;
  var need = document.body && document.body.hasAttribute("data-account");
  if (!need) {
    try {
      [window.localStorage, window.sessionStorage].forEach(function (st) {
        var s = JSON.parse(st.getItem("savedLogin") || "null");
        if (s && typeof s.token === "string") need = true;
      });
    } catch (e) { /* ammar ýapyk */ }
  }
  if (!need) return;
  var s = document.createElement("script");
  s.src = sc.src.replace(/nav\.js(\?.*)?$/, "account.js"); s.defer = true;
  s.onload = function () { if (window.AmatlyAccount) document.dispatchEvent(new CustomEvent("amatly-account-ready")); };
  document.head.appendChild(s);
})();

/* Offline (PWA): hyzmat işçisi sw.js — açylan sahypalar internetsiz hem açylýar; Sazlamalarda «Ähli saýty ýükle».
   Programma hökmünde gurmak teklibi (beforeinstallprompt) window.AmatlyInstall-da saklanýar (Sazlamalar ulanýar).
   <body data-sw="off"> — şu sahypada hasaba alynmaýar. */
(function () {
  var sc = document.querySelector('script[src*="assets/nav/nav.js"]');
  if (!sc) return;
  window.addEventListener("beforeinstallprompt", function (e) {
    window.AmatlyInstall = e;                     /* brauzeriň öz teklibi hem galýar (preventDefault ýok) */
    document.dispatchEvent(new CustomEvent("amatly-installable"));
  });
  window.addEventListener("appinstalled", function () { window.AmatlyInstall = null; document.dispatchEvent(new CustomEvent("amatly-installed")); });
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol) || (document.body && document.body.getAttribute("data-sw") === "off")) return;
  var base = sc.src.replace(/assets\/nav\/nav\.js.*$/, "");
  function reg() { navigator.serviceWorker.register(base + "sw.js", { scope: base }).catch(function () { /* goldanmaýar ýa-da HTTPS däl */ }); }
  if (document.readyState === "complete") reg(); else window.addEventListener("load", reg);
})();
