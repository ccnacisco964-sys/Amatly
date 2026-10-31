/* Amatly.com — Näme täze: ylym-bilim habarlary (kartoçkalar, süzgüç, giňişleýin sahypa, baş sahypadaky soňky habarlar) */
(function () {
  "use strict";
  /* Baş sahypa (index.html) taze/ bukjasyndan bir dereje ýokarda: "../assets/..." ýollary "assets/..." bolmaly */
  var HOME = document.getElementById("homeNews");
  var ONROOT = !!HOME && !document.getElementById("news") && !document.getElementById("habar");
  function px(u) { return ONROOT && /^\.\.\//.test(u) ? u.slice(3) : u; }
  var MAN = window.AMATLY_NEWS || [], seen = {};
  MAN.forEach(function (n) { if (n.source && n.source.url) seen[n.source.url] = 1; });
  var DATA = MAN.concat((window.AMATLY_NEWS_AUTO || []).filter(function (n) { return !(n.source && seen[n.source.url]); }))
    .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  var MONTHS = ["ýanwar", "fewral", "mart", "aprel", "maý", "iýun", "iýul", "awgust", "sentýabr", "oktýabr", "noýabr", "dekabr"];
  var CATS = { matematika: "Matematika", olimpiada: "Olimpiada", bilim: "Bilim" };
  var GLYPH = { matematika: "π", olimpiada: "∑", bilim: "✎" };
  /* Habaryň mowzugyna görä surat (öz suratlarymyz: images/habarlar/*.svg). Ilkinji gabat gelen düzgün alynýar. */
  var COVDIR = "../assets/taze-pikirler/images/habarlar/";
  var COVERS = [
    [/medal|altyn|kümüş|kumus|bürünç|burunc|ýeňij|yenij|mynasyp|gazand|üstünlik|ustunlik|baýrakl/, ["medal", "podium"]],
    [/internet-? ?olimpiad|onlaýn|onlayn|online/, "kompyuter"],
    [/geometr|trigonometr|şekil|sekil|figura/, "geometriya"],
    [/matemat|algebra|analiz|funksi|deňleme|denleme|san usul/, "funksiya"],
    [/olimpiad|bäsleş|baslesik|ýaryş|yarys|kubok|turnir|çempion|cempion|final/, "kubok"],
    [/kitap|kitaphana|neşir|nesir|gollanma|žurnal|zurnal|çap edil|cap edil/, "kitap"],
    [/hyzmatdaş|hyzmatdas|memorandum|ilçi|ilci|forum|sapar|daşary ýurt|dasary yurt/, "globus"],
    [/sanly|informatik|emeli aň|emeli an|robot|programm|kompýuter|kompyuter/, "kompyuter"],
    [/ylym|ylmy|alym|konferensi|maslahat|akadem|barlag|laborator|arheolog|etnograf/, "ylym"],
    [/mekdep|okuwçy|okuwcy|talyp|mugallym|uniwersitet|institut|bilim|synp|çagalar bag|cagalar bag|okuw ýyl/, "mekdep"],
    [/wekiliýet|wekiliyet|wekilçilik|wekilcilik|halkara/, "globus"]
  ];
  var CATCOV = { matematika: "funksiya", olimpiada: "kubok", bilim: "mekdep" };
  function hash(s) { var h = 0, i; s = String(s || ""); for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function cover(n) {
    var t = ((n.title || "") + " " + (n.summary || "")).toLowerCase(), v;
    for (var i = 0; i < COVERS.length; i++) {
      if (!COVERS[i][0].test(t)) continue;
      v = COVERS[i][1];
      /* birnäçe surat bolsa, id boýunça hemişelik birini saýlaýarys (meňzeş habarlar deň görünmesin) */
      return COVDIR + (typeof v === "string" ? v : v[hash(n.id) % v.length]) + ".svg";
    }
    return COVDIR + (CATCOV[n.cat] || "mekdep") + ".svg";
  }
  var LANGS = { tk: "türkmen", ru: "rus", en: "iňlis" };
  var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function safe(u) { u = String(u || "").trim(); return /^(https?:\/\/|[^:]*$)/i.test(u) ? u : ""; }
  function fmt(d) { var p = String(d).split("-"); return +p[2] + " " + (MONTHS[+p[1] - 1] || "") + " " + p[0]; }
  function cls(n) { return CATS[n.cat] ? n.cat : "bilim"; }
  function isNew(n) { var t = Date.parse(n.date + "T00:00:00"); return !isNaN(t) && (Date.now() - t) / 864e5 < 4; }
  function ph(n, c) { return '<div class="' + c + ' nph nph--' + cls(n) + '" aria-hidden="true"><span>' + (GLYPH[n.cat] || "∑") + "</span></div>"; }
  function pic(n, c, alt) {
    var s = px(safe(n.image)), cv = px(cover(n));
    if (!s) { s = cv; alt = ""; } /* öz suratymyz bezeg hökmünde: sözbaşy ýanynda dur */
    return '<img class="' + c + '" src="' + esc(s) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async" data-ph="' + cls(n) + '"' +
      (s === cv ? "" : ' data-cov="' + esc(cv) + '"') + ">";
  }
  function fallback(root) {
    [].forEach.call(root.querySelectorAll("img[data-ph]"), function (im) {
      im.addEventListener("error", function () {
        var cv = im.getAttribute("data-cov"); /* çeşmäniň suraty açylmasa — öz suratymyz */
        if (cv) { im.removeAttribute("data-cov"); im.alt = ""; im.src = cv; return; }
        var t = document.createElement("div");
        t.innerHTML = ph({ cat: im.getAttribute("data-ph") }, im.className);
        if (im.parentNode) im.parentNode.replaceChild(t.firstChild, im);
      });
    });
  }
  function meta(n) {
    return '<span class="ncard__meta"><span class="ntag ntag--' + cls(n) + '">' + esc(CATS[n.cat] || "Habar") + "</span>" +
      (isNew(n) ? '<span class="ntag ntag--taze">Täze</span>' : "") +
      '<time datetime="' + esc(n.date) + '">' + fmt(n.date) + "</time>" +
      (n.source && n.source.name ? '<span class="ncard__src">' + esc(n.source.name) + "</span>" : "") + "</span>";
  }
  function video(u) {
    u = safe(u); if (!u) return "";
    var m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
    if (m) return '<div class="habar__video"><iframe src="https://www.youtube-nocookie.com/embed/' + m[1] + '" title="Wideo" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
    if (/\.(mp4|webm)(\?|$)/i.test(u)) return '<div class="habar__video"><video controls preload="metadata" src="' + esc(u) + '"></video></div>';
    return '<p><a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">▶ Wideony görmek ↗</a></p>';
  }
  function ext(u, t) { return '<a href="' + esc(safe(u)) + '" target="_blank" rel="noopener noreferrer">' + esc(t) + " ↗</a>"; }
  function href(n) { return "habar.html?id=" + encodeURIComponent(n.id); }
  function setMeta(attr, key, val) {
    var m = document.head.querySelector("meta[" + attr + '="' + key + '"]');
    if (!m) { m = document.createElement("meta"); m.setAttribute(attr, key); document.head.appendChild(m); }
    m.setAttribute("content", val);
  }
  function card(n) {
    return '<article class="ncard" data-cat="' + esc(n.cat) + '"><div class="ncard__pic">' + pic(n, "ncard__img", n.imageAlt || "") + '</div><div class="ncard__body">' + meta(n) +
      '<h3 class="ncard__title"><a class="ncard__link" href="' + href(n) + '">' + esc(n.title) + '</a></h3><p class="ncard__text">' + esc(n.summary) + "</p></div></article>";
  }

  /* Esasy sahypa: kartoçkalar, kategoriýa süzgüçleri, sanagçy, "Has köp görkez", gözleg.
     Sahypa taýýar ýerleri berýär: #news-chips, #news-count, #news-upd, #news-more, #jump-news, #tz-found */
  var grid = document.getElementById("news");
  if (grid) {
    var byId = function (x) { return document.getElementById(x); };
    var sec = byId("habarlar"), q = byId("q"), bar = byId("news-chips"), cnt = byId("news-count");
    var upd = byId("news-upd"), wrap = byId("news-more"), jump = byId("jump-news");
    var more = wrap ? wrap.querySelector("button") : null;
    var noAuto = !((window.AMATLY_NEWS_AUTO || []).length);

    grid.innerHTML = DATA.length ? DATA.map(card).join("") : '<p class="empty-note">Häzirlikçe habar ýok.</p>';
    fallback(grid);
    if (noAuto && location.protocol === "file:") {
      var note = document.createElement("p");
      note.className = "tz-note";
      note.innerHTML = "Habarlar entek alynmandyr. Internete birigip, <b>tools\\habarlary-tazele.bat</b> faýlyny işlediň, soň sahypany täzeläň.";
      grid.parentNode.insertBefore(note, grid);
    }
    var um = String(window.AMATLY_NEWS_UPDATED || "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if (upd && um) { upd.textContent = "Soňky täzelenme: " + fmt(um[1]) + ", " + um[2]; upd.hidden = false; }
    if (jump && DATA.length) { jump.textContent = String(DATA.length); jump.hidden = false; }

    if (DATA.length && bar && cnt && wrap && more) {
      var cat = "all", step = 6, limit = step + 1, qv = ""; /* esasy habar + 2 hatar (3 sütün) */

      var keys = ["all"].concat(Object.keys(CATS).filter(function (k) { return DATA.some(function (n) { return n.cat === k; }); }));
      bar.hidden = keys.length < 3;
      bar.innerHTML = keys.map(function (k) {
        return '<button type="button" class="chip" data-cat="' + k + '" aria-pressed="' + (k === "all") + '">' + (k === "all" ? "Hemmesi" : CATS[k]) + "</button>";
      }).join("");

      /* Gözleg netijesi: iki bölümdäki tapylanlaryň sany we arassalamak düwmesi */
      var found = byId("tz-found"), foundText = byId("tz-found-text"), clear = byId("tz-clear");
      var summary = function () {
        if (!found || !foundText) return;
        var raw = q ? q.value.trim() : "";
        if (!raw) { found.hidden = true; return; }
        setTimeout(function () { /* main.js täzelikleri çyzandan soň sanaýarys */
          var nNews = [].filter.call(grid.children, function (c) { return c.classList.contains("ncard") && !c.hidden; }).length;
          var tl = byId("timeline"), nUpd = tl ? tl.querySelectorAll(".tl-item").length : 0;
          foundText.textContent = "«" + raw + "» boýunça: " + nNews + " habar, " + nUpd + " täzelik.";
          found.hidden = false;
        }, 0);
      };
      if (clear && q) clear.addEventListener("click", function () {
        q.value = "";
        q.dispatchEvent(new Event("input", { bubbles: true }));
        q.focus();
      });

      var apply = function () {
        var shown = 0, total = 0, lead = null;
        [].forEach.call(grid.children, function (c) {
          var ok = (cat === "all" || c.getAttribute("data-cat") === cat) && (!qv || c.textContent.toLowerCase().indexOf(qv) > -1);
          if (ok) { total++; if (qv || shown < limit) { shown++; if (!lead) lead = c; } else ok = false; }
          c.hidden = !ok;
          c.classList.remove("ncard--lead");
        });
        if (lead && cat === "all" && !qv) lead.classList.add("ncard--lead");
        cnt.textContent = !total ? "Habar tapylmady" : qv ? total + " habar tapyldy" : shown + " / " + total + " habar görkezilýär";
        wrap.hidden = !!qv || shown >= total;
        if (sec) sec.hidden = !!qv && total === 0;
      };
      bar.addEventListener("click", function (e) {
        var b = e.target.closest ? e.target.closest(".chip") : null;
        if (!b) return;
        cat = b.getAttribute("data-cat");
        limit = cat === "all" ? step + 1 : step;
        [].forEach.call(bar.children, function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        apply();
      });
      more.addEventListener("click", function () { limit += step; apply(); });
      if (q) q.addEventListener("input", function () { qv = q.value.trim().toLowerCase(); apply(); summary(); });
      apply();
    }
  }

  /* Baş sahypa: iň soňky habarlar (data-count: näçesi görkezilýär, deslapky 3) */
  if (HOME) {
    var hk = Math.max(1, parseInt(HOME.getAttribute("data-count"), 10) || 3), top = DATA.slice(0, hk);
    if (top.length) {
      HOME.innerHTML = top.map(function (n) {
        return '<article class="hn-card"><div class="hn-card__pic">' + pic(n, "hn-card__img", n.imageAlt || "") + '</div><div class="hn-card__body">' +
          '<span class="hn-card__meta"><span class="hn-tag hn-tag--' + cls(n) + '">' + esc(CATS[n.cat] || "Habar") + '</span><time datetime="' + esc(n.date) + '">' + fmt(n.date) + "</time></span>" +
          '<h3 class="hn-card__title"><a href="taze/' + href(n) + '">' + esc(n.title) + "</a></h3></div></article>";
      }).join("");
      fallback(HOME);
      var hs = document.getElementById("homeNewsSec");
      if (hs) hs.hidden = false;
    }
  }

  /* Giňişleýin habar sahypasy (habar.html?id=...) */
  var d = document.getElementById("habar");
  if (d) {
    var id = new URLSearchParams(location.search).get("id"), i = -1;
    DATA.forEach(function (x, k) { if (x.id === id) i = k; });
    var n = DATA[i];
    var crumbs = '<nav class="crumbs" aria-label="Ýol"><a href="../index.html">Baş sahypa</a><span aria-hidden="true">›</span><a href="index.html">Näme täze</a><span aria-hidden="true">›</span><span aria-current="page">Habar</span></nav>';
    if (!n) { d.innerHTML = crumbs + '<h1>Habar tapylmady</h1><p>Bu habar aýrylan ýa-da salgy nädogry. <a href="index.html">Ähli habarlara dolanyň</a>.</p>'; return; }

    var desc = n.summary || n.title, full = !!(n.body && n.body.length);
    document.title = n.title + " | Amatly.com";
    setMeta("name", "description", desc);
    setMeta("property", "og:title", n.title);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:type", "article");
    if (!full) setMeta("name", "robots", "noindex,follow");
    var ld = { "@context": "https://schema.org", "@type": "NewsArticle", headline: n.title, datePublished: n.date, inLanguage: n.lang || "tk", description: desc, publisher: { "@type": "Organization", name: "Amatly.com" } };
    if (/^https?:\/\//i.test(location.href)) ld.mainEntityOfPage = location.href.split("#")[0];
    if (/^https?:\/\//i.test(n.image || "")) ld.image = [n.image];
    if (n.source && /^https?:\/\//i.test(n.source.url || "")) ld.isBasedOn = n.source.url;
    var sc = document.createElement("script");
    sc.type = "application/ld+json";
    sc.textContent = JSON.stringify(ld).replace(/</g, "\\u003c");
    document.head.appendChild(sc);

    var h = crumbs + meta(n) + "<h1>" + esc(n.title) + "</h1>" + pic(n, "habar__img", n.imageAlt || n.title);
    h += (full ? n.body : [n.summary]).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
    if (n.lang && n.lang !== "tk" && LANGS[n.lang]) h += '<p class="habar__note">Asyl makala ' + LANGS[n.lang] + " dilinde.</p>";
    h += video(n.video);
    if (n.source && n.source.url && safe(n.source.url)) {
      h += '<aside class="habar__source"><p>Çeşme: <b>' + esc(n.source.name || "Asyl habar") + '</b>. Doly makalany asyl sahypada okaň.</p><a class="btn" href="' + esc(safe(n.source.url)) + '" target="_blank" rel="noopener noreferrer">Doly habary asyl çeşmede okaň ↗</a></aside>';
    } else if (n.source && n.source.name) {
      h += '<p class="habar__src">Çeşme: ' + esc(n.source.name) + "</p>";
    }
    var ls = (n.links || []).filter(function (l) { return safe(l.url); });
    if (ls.length) h += '<h2>Peýdaly salgylar</h2><ul class="habar__links">' + ls.map(function (l) { return "<li>" + ext(l.url, l.text || l.url) + "</li>"; }).join("") + "</ul>";
    h += '<div class="habar__share"><button type="button" class="chip" data-act="copy">Salgyny göçür</button>' +
      (navigator.share ? '<button type="button" class="chip" data-act="share">Paýlaş</button>' : "") + '<span class="habar__shared" role="status"></span></div>';

    var nw = DATA[i - 1], od = DATA[i + 1];
    if (nw || od) {
      h += '<nav class="habar__nav" aria-label="Habarlar">' +
        (od ? '<a rel="prev" href="' + href(od) + '"><small>← Öňki habar</small><span>' + esc(od.title) + "</span></a>" : "<span></span>") +
        (nw ? '<a rel="next" class="is-next" href="' + href(nw) + '"><small>Indiki habar →</small><span>' + esc(nw.title) + "</span></a>" : "<span></span>") + "</nav>";
    }
    var rel = DATA.filter(function (x) { return x !== n && x.cat === n.cat; }).slice(0, 3);
    if (rel.length) {
      h += '<section class="habar__rel" aria-labelledby="relh"><h2 id="relh">Meňzeş habarlar</h2><ul>' + rel.map(function (x) {
        return '<li><a href="' + href(x) + '">' + esc(x.title) + '</a><time datetime="' + esc(x.date) + '">' + fmt(x.date) + "</time></li>";
      }).join("") + "</ul></section>";
    }
    d.innerHTML = h;
    fallback(d);

    d.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-act]") : null;
      if (!b) return;
      var st = d.querySelector(".habar__shared"), url = location.href;
      if (b.getAttribute("data-act") === "share") { navigator.share({ title: n.title, url: url }).catch(function () {}); return; }
      var done = function (ok) { st.textContent = ok ? "Salgy göçürildi" : "Salgyny el bilen göçüriň: " + url; };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
      else done(false);
    });
  }
})();
