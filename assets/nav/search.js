/* Amatly.com — saýt gözlegi (nav.js gerek bolanda ýükleýär: gözleg meýdanyna fokus berlende; maglumat: search-index.js) */
(function () {
  "use strict";
  var sc = document.querySelector('script[src*="assets/nav/nav.js"]');
  var base = sc ? sc.src.replace(/assets\/nav\/nav\.js.*$/, "") : "";
  var M = { "ä": "a", "ç": "c", "ö": "o", "ü": "u", "ž": "z", "ň": "n", "ş": "s", "ý": "y" };
  function norm(s) { return String(s).toLowerCase().replace(/[äçöüžňşý]/g, function (c) { return M[c]; }); }
  function words(s) { return norm(s).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function lev(a, b) {
    var p = [], d, i, j;
    for (j = 0; j <= b.length; j++) p[j] = j;
    for (i = 1; i <= a.length; i++) {
      d = [i];
      for (j = 1; j <= b.length; j++) d[j] = Math.min(p[j] + 1, d[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      p = d;
    }
    return p[b.length];
  }
  var D = (window.AMX_INDEX || []).filter(Array.isArray).map(function (e) {
    return { t: e[0], h: e[1], u: e[2], nt: norm(e[0]), tw: words(e[0]), x: e[3] || "", ow: words(e[1] + " " + (e[3] || "")) };
  });
  /* bir sözi bahalandyrmak: dogry 100 · başlanyşy 80 · goşulmaly söz 60 · umumy kök 50 · ýalňyş ýazylyş 35 */
  function cp(a, b) { var i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; }
  function pts(q, w) {
    if (w === q) return 100;
    if (q.length > 1 && w.indexOf(q) === 0) return 80;
    if (q.length >= 3 && w.indexOf(q) > 0) return 40;
    if (q.length >= 4 && w.length >= 4 && q.indexOf(w) === 0) return 60;
    if (q.length >= 5 && w.length >= 5 && cp(q, w) >= Math.max(4, Math.ceil(0.7 * Math.min(q.length, w.length)))) return 50;
    if (q.length >= 5 && w.length >= 4 && q[0] === w[0] && q[1] === w[1] && lev(q, w) <= (q.length >= 10 ? 2 : 1)) return 35;
    return 0;
  }
  function tok(q, e) {
    var b = 0;
    e.tw.forEach(function (w) { b = Math.max(b, pts(q, w)); });
    e.ow.forEach(function (w) { b = Math.max(b, pts(q, w) * 0.6); });
    return b;
  }
  function find(q) {
    var t = words(q), full = norm(q).trim(), out = [];
    if (!t.length) return out;
    D.forEach(function (e) {
      var tot = 0, i, s;
      for (i = 0; i < t.length; i++) { s = tok(t[i], e); if (!s) return; tot += s; }
      if (e.nt.indexOf(full) === 0) tot += 50;
      out.push([tot, e]);
    });
    return out.sort(function (a, b) { return b[0] - a[0]; }).map(function (x) { return x[1]; });
  }
  function hl(e, t) {
    var m = [], s = "", open = false, k, on;
    t.forEach(function (q) { var i = e.nt.indexOf(q); if (i > -1) for (k = i; k < i + q.length; k++) m[k] = 1; });
    for (k = 0; k < e.t.length; k++) {
      on = !!m[k];
      if (on && !open) { s += "<mark>"; open = true; }
      if (!on && open) { s += "</mark>"; open = false; }
      s += esc(e.t[k]);
    }
    return s + (open ? "</mark>" : "");
  }
  /* tekstden gabat gelen bölegi görkezýär (at gabat gelmese) */
  function snip(e, t) {
    var n = norm(e.x), i = -1, q = "", k, a, s;
    if (!e.x) return "";
    for (k = 0; k < t.length; k++) { if (e.nt.indexOf(t[k]) > -1) return ""; if (i < 0 && (i = n.indexOf(t[k])) > -1) q = t[k]; }
    if (i < 0) return "";
    a = Math.max(0, i - 36); s = e.x.slice(a, i + q.length + 64);
    return '<em class="sr-snip">' + (a ? "… " : "") + esc(s.slice(0, i - a)) + "<mark>" + esc(s.slice(i - a, i - a + q.length)) + "</mark>" + esc(s.slice(i - a + q.length)) + " …</em>";
  }
  var START = ["kalkulus/index.html", "geometriya/index.html", "on-algebra/index.html", "amal-barlagy/index.html", "soz-meseleleri/index.html", "oyunlar/index.html"];
  function starters() {
    return START.map(function (u) { return D.filter(function (e) { return e.u === u; })[0]; }).filter(Boolean);
  }

  function Box(form, id, aria) {
    var inp = form.querySelector("input"), ul = document.createElement("ul"), st = document.createElement("div");
    var b = { act: -1, items: [], id: id, inp: inp, ul: ul };
    ul.className = "sr-list"; ul.id = id; ul.setAttribute("role", "listbox"); ul.hidden = true;
    st.className = "sr-only"; st.setAttribute("role", "status"); st.setAttribute("aria-live", "polite");
    form.appendChild(ul); form.appendChild(st);
    b.set = function (i) {
      b.act = i;
      [].forEach.call(ul.querySelectorAll('[role="option"]'), function (li, k) {
        li.setAttribute("aria-selected", k === i ? "true" : "false");
        if (k === i && li.scrollIntoView) li.scrollIntoView({ block: "nearest" });
      });
      if (aria) { if (i > -1) inp.setAttribute("aria-activedescendant", id + "-" + i); else inp.removeAttribute("aria-activedescendant"); }
    };
    b.render = function (head, list, tokens, empty) {
      b.items = list;
      ul.innerHTML = (empty ? '<li class="sr-empty" role="presentation">' + esc(empty) + "</li>" : "") +
        (head ? '<li class="sr-head" role="presentation">' + esc(head) + "</li>" : "") +
        list.map(function (e, i) {
          return '<li role="option" id="' + id + "-" + i + '" aria-selected="false"><a tabindex="-1" href="' + base + e.u + '">' + hl(e, tokens) + "<small>" + esc(e.h) + "</small>" + snip(e, tokens) + "</a></li>";
        }).join("");
      ul.hidden = false; b.set(-1);
      if (aria) inp.setAttribute("aria-expanded", "true");
      st.textContent = empty ? "Hiç zat tapylmady" : list.length + " netije tapyldy";
    };
    b.hide = function () { ul.hidden = true; b.set(-1); if (aria) inp.setAttribute("aria-expanded", "false"); };
    return b;
  }

  /* Esasy gözleg: [data-site-search] */
  function attach(form, k) {
    var inp = form.querySelector("input");
    if (!inp) return;
    var b = Box(form, "srList" + k, true);
    inp.setAttribute("role", "combobox"); inp.setAttribute("aria-autocomplete", "list"); inp.setAttribute("aria-expanded", "false");
    inp.setAttribute("aria-controls", b.id); inp.setAttribute("aria-keyshortcuts", "/"); inp.setAttribute("autocomplete", "off");
    function update() {
      var q = inp.value.trim(), r;
      if (!q) { b.render("Teklipler:", starters(), []); return; }
      r = find(q);
      if (r.length) b.render("", r.slice(0, 8), words(q));
      else b.render("Şulary synap görüň:", starters(), [], "«" + q + "» boýunça hiç zat tapylmady.");
    }
    inp.addEventListener("input", update);
    inp.addEventListener("focus", update);
    inp.addEventListener("keydown", function (e) {
      var n = b.items.length, d;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (b.ul.hidden) { update(); return; }
        d = e.key === "ArrowDown" ? 1 : -1;
        if (n) b.set(b.act < 0 ? (d > 0 ? 0 : n - 1) : (b.act + d + n) % n);
      } else if (e.key === "Escape") {
        if (!b.ul.hidden) b.hide(); else inp.value = "";
      }
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var r = b.act > -1 ? b.items[b.act] : find(inp.value)[0];
      if (r) location.href = base + r.u; else update();
    });
    document.addEventListener("click", function (ev) { if (!form.contains(ev.target)) b.hide(); });
    /* nav.js bu faýly gözleg meýdanyna fokus berlende ýükleýär — şol wagt teklipleri derrew görkezmek */
    if (document.activeElement === inp) update();
  }
  [].forEach.call(document.querySelectorAll("form[data-site-search]"), attach);

  /* "/" düwmesi gözlege geçirýär */
  document.addEventListener("keydown", function (e) {
    var t = e.target, tag = t && t.tagName, f;
    var K = (e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey);
    if (K) { f = document.querySelector("form[data-site-search] input"); if (f) { e.preventDefault(); f.focus(); f.select(); } return; }
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
    f = document.querySelector("form[data-site-search] input");
    if (f) { e.preventDefault(); f.focus(); }
  });

  /* Öz gözlegi bar bölümler (form[data-site-hook]): bölümiň gözlegi öňküsi ýaly işleýär;
     sorag başga bölüme degişli bolsa, Enter-den soň "Başga bölümlerde hem tapyldy" sanawy çykýar. */
  var sec = location.href.split(/[?#]/)[0].slice(base.length).split("/")[0], hb = null;
  document.addEventListener("submit", function (e) {
    var form = e.target, inp, q, all, other;
    if (!form.matches || !form.matches("form[data-site-hook]")) return;
    inp = form.querySelector("input"); q = inp ? inp.value.trim() : "";
    if (!q) return;
    all = find(q);
    other = all.filter(function (x) { return x.u.split("/")[0] !== sec; });
    if (all.length > other.length || !other.length) return;
    if (!hb) {
      hb = Box(form, "srHook", false);
      inp.addEventListener("input", hb.hide);
      document.addEventListener("click", function (ev) { if (!form.contains(ev.target)) hb.hide(); });
      document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") hb.hide(); });
    }
    hb.render("Başga bölümlerde hem tapyldy:", other.slice(0, 6), words(q));
  }, true);

  window.AMX_SEARCH = { find: find, words: words };
})();
