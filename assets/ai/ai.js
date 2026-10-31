/* Amatly AI — saýtyň matematika mugallymy (Claude API).
 *
 * nav.js her sahypada şu faýllary ýükleýär: assets/ai/ai-prompt.js (ulgam görkezmesi we gurallar), assets/ai/ai.css we şu faýl.
 * Iki ýol bilen işleýär:
 *   1) serwer proksisi — api/ai.php (hostingdäki PHP) ýa-da "npm run serve" (Node): API açary serwerde saklanýar, brauzere berilmeýär;
 *   2) öz açaryňyz — Sazlamalar → Amatly AI: açar diňe şu brauzerde saklanýar (file:// bilen açylanda hem işleýär).
 * Claude API sazlanmadyk ýa-da elýeterli bolmadyk wagty «Amatly motory» (assets/ai/ai-local.js) jogap berýär: matematika
 * soraglary saýtyň öz hasaplaýyş motorlary bilen ädimme-ädim çözülýär; şeýle jogaplar çatda «Amatly motory» diýip bellenýär.
 * Gurallar brauzerde saýtyň öz motory bilen ýerine ýetirilýär:
 *   solve_steps — Kalkulus bölüminiň ädimme-ädim çözüjisi (assets/kalkulus/js/engine.js),
 *   solve_lp    — çyzykly (we bitin sanly) programmirleme: Amal barlagynyň simpleks motory
 *                 (assets/simpleks/js/simplex-engine.js, bitin sanly üçin assets/amal-barlagy/js/or-engine.js),
 *   calculate   — math.js bilen takyk hasaplamak, plot_graph — çatyň içinde interaktiw grafik.
 * Daşyna çykarylýan API: window.AmatlyAI.open(), .ask(tekst), .status(), .test().
 */
(function () {
  'use strict';
  if (window.AmatlyAI) return;

  var SCRIPT = document.currentScript || document.querySelector('script[src*="assets/ai/ai.js"]');
  var BASE = SCRIPT ? SCRIPT.src.replace(/assets\/ai\/ai\.js.*$/, '') : '';
  var P = window.AMATLY_AI_PROMPT;
  if (!P || !P.system) return;
  var CONF = window.AMATLY_AI_CONFIG || {};
  var ENDPOINT = CONF.endpoint || BASE + 'api/ai.php';
  var API_URL = CONF.apiUrl || 'https://api.anthropic.com/v1/messages';
  var MAX_HOPS = 8;                          // bir jogapda iň köp gural aýlawy
  var KEEP_MESSAGES = 40;                    // API-a iberilýän taryhyň çägi
  var root = document.documentElement;

  /* ------------------------------------------------------------ kömekçiler */
  var store = {
    get: function (k, st) { try { return (st || localStorage).getItem(k); } catch (e) { return null; } },
    set: function (k, v, st) { try { (st || localStorage).setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k, st) { try { (st || localStorage).removeItem(k); } catch (e) { /* ýok */ } }
  };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function h(tag, attrs, html) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else el.setAttribute(k, v === true ? '' : v);
    });
    if (html !== undefined) el.innerHTML = html;
    return el;
  }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function raf(fn) { var q = false; return function () { if (q) return; q = true; requestAnimationFrame(function () { q = false; fn(); }); }; }
  function round(v, n) { if (!isFinite(v)) return v; var p = Math.pow(10, n || 4); var r = Math.round(v * p) / p; return Object.is(r, -0) ? 0 : r; }
  function reduceMotion() { return root.getAttribute('data-motion') === 'reduce'; }

  var ICON = {
    mark: '<svg class="aai-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16 1.5 20.25 5.75 26.25 5.75 26.25 11.75 30.5 16 26.25 20.25 26.25 26.25 20.25 26.25 16 30.5 11.75 26.25 5.75 26.25 5.75 20.25 1.5 16 5.75 11.75 5.75 5.75 11.75 5.75Z" fill="currentColor" opacity=".16"/><path d="M16 1.5 20.25 5.75 26.25 5.75 26.25 11.75 30.5 16 26.25 20.25 26.25 26.25 20.25 26.25 16 30.5 11.75 26.25 5.75 26.25 5.75 20.25 1.5 16 5.75 11.75 5.75 5.75 11.75 5.75Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 10 22 16 16 22 10 16Z" fill="var(--aai-saffron,#e9a23b)"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg>',
    camera: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4z"/><circle cx="12" cy="13.2" r="3.4"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5H5v11h3"/></svg>',
    retry: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 12a7 7 0 1 1-2.1-5M19 4v4h-4"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4l9 16H3zM12 10v4M12 17.2v.1"/></svg>',
    zin: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 6v12M6 12h12"/></svg>',
    zout: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 12h12"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5"/></svg>',
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.5l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8z"/></svg>',
    engine: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6.5" y="6.5" width="11" height="11" rx="2.2"/><path d="M10 10h4v4h-4zM9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/></svg>'
  };

  /* ------------------------------------------------------------ ulanyjy, sazlamalar */
  function currentUser() {
    var sts = [];
    try { sts.push(localStorage); } catch (e) { /* ýok */ }
    try { sts.push(sessionStorage); } catch (e) { /* ýok */ }
    for (var i = 0; i < sts.length; i++) {
      try { var s = JSON.parse(sts[i].getItem('savedLogin') || 'null'); if (s && typeof s.username === 'string' && s.username.trim()) return s.username.trim(); } catch (e) { /* ýok */ }
    }
    return '';
  }
  function userKey() { return (store.get('amatly_ai_key') || '').trim(); }
  function transport() {
    if (userKey()) return 'direct';
    if (/^https?:$/.test(location.protocol)) return 'proxy';
    return 'none';
  }
  function getMode() { return store.get('amatly_ai_mode') === 'tutor' ? 'tutor' : 'explain'; }

  /* «Amatly motory» — Claude API-syz režim (assets/ai/ai-local.js): API açary sazlanmadyk, serwer ýa-da internet elýeterli
     bolmadyk wagty soraglara saýtyň öz hasaplaýyş motorlary jogap berýär. Her şeýle jogap «Amatly motory» diýip bellenýär. */
  var localMode = null, localWhy = '', modeP = null;
  var LOCAL_TITLE = 'Claude API sazlanmady — soraglara saýtyň öz hasaplaýyş motorlary jogap berýär';
  function needLocal() { return window.AmatlyAILocal ? Promise.resolve(window.AmatlyAILocal) : loadScript('assets/ai/ai-local.js').then(function () { return window.AmatlyAILocal; }); }
  function setLocal(on, why) {
    var was = localMode;
    localMode = !!on; localWhy = on ? (why || 'not_configured') : '';
    if (!ui) return;
    var b = ui.panel.querySelector('.aai-badge'); if (b) b.hidden = !localMode;
    var hint = ui.panel.querySelector('.aai-hint');
    if (hint) hint.textContent = localMode ? 'Amatly motory: jogaplary saýtyň hasaplaýyş motorlary tapýar we barlaýar.' : 'AI ýalňyşyp biler — möhüm jogaplary barlaň.';
    if (was !== localMode && ui.log.querySelector('.aai-empty')) renderAll();
  }
  /* API sazlanandygyny bir gezek barlamak: sazlanmadyk bolsa (ýa-da serwer ýok bolsa) — Amatly motory */
  function checkMode(force) {
    if (modeP && !force) return modeP;
    modeP = status().then(function (s) { setLocal(!s.configured, 'not_configured'); return localMode; }, function () { setLocal(true, 'network'); return true; });
    return modeP;
  }
  /* API ýalňyşlygy hemişelik bolsa (açar ýok, nädogry, töleg ýok, proksi ýok) — sahypa açyk wagty motor bilen dowam edýäris */
  function lasting(e) {
    var k = e && e.kind, s = e && e.status;
    return k === 'not_configured' || k === 'authentication_error' || k === 'permission_error' || k === 'billing_error' || s === 401 || s === 402 || s === 403 || s === 404 || s === 405;
  }
  function abortErr() { return Object.assign(new Error('aborted'), { name: 'AbortError' }); }
  function pagePath() {
    var p = location.href.split('#')[0].split('?')[0];
    p = p.indexOf(BASE) === 0 ? p.slice(BASE.length) : location.pathname.replace(/^\//, '');
    return p || 'index.html';
  }
  function pageContext() {
    var title = document.title || '';
    var h1 = document.querySelector('main h1') || document.querySelector('h1');
    var extra = h1 && title.indexOf(h1.textContent.trim()) === -1 ? ' — ' + h1.textContent.trim() : '';
    return '<sahypa>' + (title + extra).replace(/[<>]/g, '') + ' (' + pagePath() + ')</sahypa>';
  }

  /* ------------------------------------------------------------ ýükleýjiler */
  var loading = {};
  function loadScript(rel) {
    if (!loading[rel]) loading[rel] = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = BASE + rel; s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () { delete loading[rel]; rej(new Error(rel + ' faýly ýüklenmedi')); };
      document.head.appendChild(s);
    });
    return loading[rel];
  }
  function loadCss(rel) {
    if (document.querySelector('link[data-aai="' + rel + '"]')) return;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = BASE + rel; l.setAttribute('data-aai', rel);
    document.head.appendChild(l);
  }
  function needMath() { return window.math ? Promise.resolve(window.math) : loadScript('assets/vendor/math.js').then(function () { return window.math; }); }
  function needEngine() { return needMath().then(function () { return window.AmatlyEngine ? window.AmatlyEngine : loadScript('assets/kalkulus/js/engine.js').then(function () { return window.AmatlyEngine; }); }); }
  function needSimplex() { return needMath().then(function () { return window.AmatlySimplex ? window.AmatlySimplex : loadScript('assets/simpleks/js/simplex-engine.js').then(function () { return window.AmatlySimplex; }); }); }
  function needOR() { return needSimplex().then(function () { return window.AmatlyOR ? window.AmatlyOR : loadScript('assets/amal-barlagy/js/or-engine.js').then(function () { return window.AmatlyOR; }); }); }
  function needKatex() {
    loadCss('assets/vendor/katex/katex.min.css');
    return window.katex ? Promise.resolve(window.katex) : loadScript('assets/vendor/katex.min.js').then(function () { return window.katex; });
  }

  /* ------------------------------------------------------------ Markdown + LaTeX (howpsuz) */
  var texCache = new Map();
  function tex(src, display) {
    var key = (display ? 'D' : 'I') + src;
    if (texCache.has(key)) return texCache.get(key);
    if (!window.katex) return '<code class="aai-tex">' + esc(display ? '$$' + src + '$$' : '$' + src + '$') + '</code>';
    var out;
    try { out = window.katex.renderToString(src, { displayMode: !!display, throwOnError: false, strict: 'ignore', trust: false, maxSize: 20, maxExpand: 200 }); }
    catch (e) { out = '<code class="aai-tex">' + esc(src) + '</code>'; }
    if (texCache.size > 600) texCache.clear();
    texCache.set(key, out);
    return out;
  }
  function safeHref(u) {
    u = String(u).trim();
    if (/^https?:\/\//i.test(u)) return { href: u, ext: true };
    if (/^#[\w-]+$/.test(u)) return { href: u, ext: false };
    if (/^\/?[a-z0-9][a-z0-9\-_./]*(#[\w-]+)?$/i.test(u) && u.indexOf('..') === -1) return { href: BASE + u.replace(/^\//, ''), ext: false };
    return null;
  }
  function inline(s) {
    // s — eýýäm gaçyrylan (escaped) tekst; nokatly saklanýan bölekler (\u0000N\u0000) soňra çalşylýar
    s = s.replace(/\[([^\]\n]{1,200})\]\(([^)\s]{1,400})\)/g, function (m, text, url) {
      var link = safeHref(url.replace(/&amp;/g, '&'));
      if (!link) return text;
      return '<a href="' + esc(link.href) + '"' + (link.ext ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + text + '</a>';
    });
    s = s.replace(/\*\*([^*\n][\s\S]*?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/(^|[^\w])_([^_\s][^_\n]*?)_(?!\w)/g, '$1<em>$2</em>');
    return s;
  }
  function renderMarkdown(src) {
    var keep = [];
    function put(html) { keep.push(html); return '\u0000' + (keep.length - 1) + '\u0000'; }
    var s = String(src || '').replace(/\r\n?/g, '\n');
    // kod bloklary we setir içindäki kod
    s = s.replace(/```[^\n]*\n([\s\S]*?)(```|$)/g, function (m, code) { return put('<pre class="aai-code"><code>' + esc(code.replace(/\n$/, '')) + '</code></pre>'); });
    s = s.replace(/`([^`\n]+)`/g, function (m, code) { return put('<code>' + esc(code) + '</code>'); });
    // formulalar
    s = s.replace(/\$\$([\s\S]+?)\$\$/g, function (m, t) { return put('<span class="aai-dmath">' + tex(t.trim(), true) + '</span>'); });
    s = s.replace(/\\\[([\s\S]+?)\\\]/g, function (m, t) { return put('<span class="aai-dmath">' + tex(t.trim(), true) + '</span>'); });
    s = s.replace(/\\\((.+?)\\\)/g, function (m, t) { return put(tex(t, false)); });
    s = s.replace(/(^|[^\\$\w])\$(?=\S)([^\n$]{1,500}?\S)\$(?![\w$])/g, function (m, pre, t) { return pre + put(tex(t, false)); });
    s = s.replace(/(^|[^\\$\w])\$(\S)\$(?![\w$])/g, function (m, pre, t) { return pre + put(tex(t, false)); });
    s = esc(s);

    var lines = s.split('\n'), out = [], i = 0;
    function para(buf) { if (buf.length) out.push('<p>' + inline(buf.join('<br>')) + '</p>'); }
    var buf = [];
    while (i < lines.length) {
      var ln = lines[i], m;
      if (/^\s*$/.test(ln)) { para(buf); buf = []; i++; continue; }
      if (/^\u0000\d+\u0000$/.test(ln.trim()) && /^<(pre|span class="aai-dmath")/.test(keep[+ln.trim().slice(1, -1)] || '')) { para(buf); buf = []; out.push(ln.trim()); i++; continue; }
      if ((m = ln.match(/^(#{1,6})\s+(.*)$/))) { para(buf); buf = []; var lv = Math.min(6, m[1].length + 2); out.push('<h' + lv + '>' + inline(m[2]) + '</h' + lv + '>'); i++; continue; }
      if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(ln)) { para(buf); buf = []; out.push('<hr>'); i++; continue; }
      if (/^\s*&gt;\s?/.test(ln)) {
        para(buf); buf = [];
        var q = [];
        while (i < lines.length && /^\s*&gt;\s?/.test(lines[i])) { q.push(lines[i].replace(/^\s*&gt;\s?/, '')); i++; }
        out.push('<blockquote>' + inline(q.join('<br>')) + '</blockquote>');
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        para(buf); buf = [];
        var cells = function (r) { return r.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return inline(c.trim()); }); };
        var head = cells(ln); i += 2;
        var rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        out.push('<div class="aai-table"><table><thead><tr>' + head.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' +
          rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>');
        continue;
      }
      if (/^\s*(\d+)[.)]\s+/.test(ln) || /^\s*[-*•]\s+/.test(ln)) {
        para(buf); buf = [];
        var ordered = /^\s*\d+[.)]\s+/.test(ln), start = ordered ? parseInt(ln, 10) : 1, items = [];
        var itemRe = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*•]\s+/;
        while (i < lines.length) {
          var L = lines[i];
          if (itemRe.test(L)) { items.push(L.replace(itemRe, '')); i++; continue; }
          if (/^\s{2,}\S/.test(L) && items.length && !/^\s*(\d+[.)]|[-*•])\s+/.test(L)) { items[items.length - 1] += '<br>' + L.trim(); i++; continue; }
          if (/^\s{2,}(\d+[.)]|[-*•])\s+/.test(L) && items.length) { items[items.length - 1] += '<br>' + L.trim(); i++; continue; }
          break;
        }
        out.push((ordered ? '<ol' + (start > 1 ? ' start="' + start + '"' : '') + '>' : '<ul>') + items.map(function (t) { return '<li>' + inline(t) + '</li>'; }).join('') + (ordered ? '</ol>' : '</ul>'));
        continue;
      }
      buf.push(ln); i++;
    }
    para(buf);
    var html = out.join('');
    for (var k = 0; k < 3 && /\u0000\d+\u0000/.test(html); k++) html = html.replace(/\u0000(\d+)\u0000/g, function (m, n) { return keep[+n] || ''; });
    return html;
  }

  /* motoryň HTML-i: diňe rugsat berlen tegler (b, i, sup, sub, span, ...) galýar */
  var SAFE_TAGS = { B: 1, STRONG: 1, I: 1, EM: 1, SUP: 1, SUB: 1, SPAN: 1, SMALL: 1, BR: 1, OL: 1, UL: 1, LI: 1, CODE: 1, U: 1, P: 1, DIV: 1, TABLE: 1, TBODY: 1, TR: 1, TD: 1, TH: 1 };
  function sanitize(html) {
    var t = document.createElement('template');
    t.innerHTML = String(html || '');
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 1) {
          if (!SAFE_TAGS[c.tagName]) { c.replaceWith(document.createTextNode(c.textContent)); return; }
          Array.prototype.slice.call(c.attributes).forEach(function (a) { if (a.name !== 'class') c.removeAttribute(a.name); });
          walk(c);
        } else if (c.nodeType !== 3) c.remove();
      });
    })(t.content);
    return t.innerHTML;
  }
  /* HTML → AI üçin arassa tekst (x<sup>2</sup> → x^(2)) */
  function toText(html) {
    var t = document.createElement('template');
    t.innerHTML = String(html || '');
    function walk(node) {
      var s = '';
      node.childNodes.forEach(function (c) {
        if (c.nodeType === 3) { s += c.textContent; return; }
        if (c.nodeType !== 1) return;
        var inner = walk(c), tag = c.tagName;
        if (tag === 'SUP') s += /^[\w.]$/.test(inner) ? '^' + inner : '^(' + inner + ')';
        else if (tag === 'SUB') s += '_' + (inner.length > 1 ? '(' + inner + ')' : inner);
        else if (tag === 'BR') s += '\n';
        else if (tag === 'LI') s += '\n- ' + inner;
        else s += inner;
      });
      return s;
    }
    return walk(t.content).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ------------------------------------------------------------ aňlatma taýýarlamak (math.js) */
  function prepExpr(s) {
    return String(s || '')
      .replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi')
      .replace(/√\s*\(/g, 'sqrt(').replace(/√\s*([A-Za-z0-9.]+)/g, 'sqrt($1)')
      .replace(/\bln\s*\(/g, 'log(').replace(/\blg\s*\(/g, 'log10(')
      .replace(/\barctg\s*\(/g, 'atan(').replace(/\barcctg\s*\(/g, 'acot(').replace(/\bctg\s*\(/g, 'cot(').replace(/\btg\s*\(/g, 'tan(')
      .replace(/\barc(sin|cos|tan)\s*\(/g, 'a$1(');
  }
  function realOf(v) {
    if (typeof v === 'number') return v;
    if (v && typeof v.re === 'number') return Math.abs(v.im) < 1e-12 ? v.re : NaN;
    if (v && typeof v.valueOf === 'function') { var n = Number(v.valueOf()); return isFinite(n) ? n : NaN; }
    return NaN;
  }

  /* ------------------------------------------------------------ san usullary (gurallar üçin) */
  function bisect(f, a, b, fa) {
    for (var k = 0; k < 80; k++) {
      var m = (a + b) / 2, fm = f(m);
      if (!isFinite(fm)) return NaN;
      if (fm === 0) return m;
      if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else b = m;
    }
    return (a + b) / 2;
  }
  function findRoots(f, a, b, n) {
    n = n || 2000;
    var out = [], step = (b - a) / n, x0 = a, y0 = f(a);
    var tol = Math.max(1e-9, Math.abs(b - a) * 1e-9);
    for (var i = 1; i <= n; i++) {
      var x1 = a + i * step, y1 = f(x1);
      if (isFinite(y0) && isFinite(y1)) {
        if (y0 === 0) push(x0);
        else if ((y0 < 0) !== (y1 < 0) && y1 !== 0) {
          var r = bisect(f, x0, x1, y0), fr = f(r);
          // üzülmäni kök hasaplamaly däl: kökde |f| kiçi bolmaly
          if (isFinite(fr) && Math.abs(fr) <= 1e-6 * Math.max(1, Math.abs(y0), Math.abs(y1))) push(r);
        }
      }
      x0 = x1; y0 = y1;
      if (out.length > 40) break;
    }
    if (isFinite(y0) && y0 === 0) push(x0);
    function push(r) { if (!out.some(function (q) { return Math.abs(q - r) < tol * 1e3; })) out.push(r); }
    return out.map(function (r) { return round(r, 10); });
  }
  function simpsonAdaptive(f, a, b) {
    var fa = f(a), fb = f(b), m = (a + b) / 2, fm = f(m), calls = 0;
    function S(a, b, fa, fm, fb) { return (b - a) / 6 * (fa + 4 * fm + fb); }
    function rec(a, b, fa, fm, fb, whole, eps, depth) {
      var m = (a + b) / 2, lm = (a + m) / 2, rm = (m + b) / 2, flm = f(lm), frm = f(rm);
      calls += 2;
      var left = S(a, m, fa, flm, fm), right = S(m, b, fm, frm, fb);
      if (depth <= 0 || calls > 200000 || Math.abs(left + right - whole) <= 15 * eps) return left + right + (left + right - whole) / 15;
      return rec(a, m, fa, flm, fm, left, eps / 2, depth - 1) + rec(m, b, fm, frm, fb, right, eps / 2, depth - 1);
    }
    var v = rec(a, b, fa, fm, fb, S(a, b, fa, fm, fb), 1e-10, 40);
    return v;
  }
  function primeFactors(n) {
    n = Math.round(Math.abs(Number(n)));
    if (!isFinite(n) || n < 2 || n > 1e15) throw new Error('primeFactors: 2 ≤ n ≤ 10^15 bitin san bolmaly');
    var out = [];
    for (var d = 2; d * d <= n; d += (d === 2 ? 1 : 2)) while (n % d === 0) { out.push(d); n /= d; }
    if (n > 1) out.push(n);
    return out;
  }

  /* calculate guraly üçin aýratyn math.js nusgasy (goşmaça funksiýalar bilen) */
  var calcMathP = null;
  function calcMath() {
    if (!calcMathP) calcMathP = needMath().then(function (m) {
      var M = m.create(m.all);
      function fx(expr) {
        var c = M.compile(prepExpr(typeof expr === 'string' ? expr : String(expr)));
        return function (x) { try { return realOf(c.evaluate({ x: x })); } catch (e) { return NaN; } };
      }
      M.import({
        nsolve: function (expr, a, b) {
          a = Number(a); b = Number(b);
          if (!(isFinite(a) && isFinite(b) && b > a)) throw new Error('nsolve: a < b san bolmaly');
          return findRoots(fx(expr), a, b, 4000);
        },
        nintegrate: function (expr, a, b) {
          a = Number(a); b = Number(b);
          if (!(isFinite(a) && isFinite(b))) throw new Error('nintegrate: çäkler san bolmaly');
          var v = simpsonAdaptive(fx(expr), a, b);
          if (!isFinite(v)) throw new Error('nintegrate: integral ýygnanmady (funksiýa aralykda kesgitlenmedik bolup biler)');
          return round(v, 12);
        },
        primeFactors: primeFactors
      }, { override: true });
      M.import({
        'import': function () { throw new Error('import rugsat berilmeýär'); },
        createUnit: function () { throw new Error('createUnit rugsat berilmeýär'); }
      }, { override: true });
      return M;
    });
    return calcMathP;
  }
  function fmtValue(M, v) {
    if (v === undefined) return '—';
    if (typeof v === 'function') return '(funksiýa kesgitlendi)';
    if (v && v.isNode) return v.toString();
    if (v && v.isResultSet) return v.entries.map(function (e) { return fmtValue(M, e); }).join('; ');
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    try { return M.format(v, { precision: 14 }); } catch (e) { return String(v); }
  }
  function toTeX(M, expr) {
    if (expr.length > 90 || /["'\[\];=]/.test(expr)) return null;      // setirler, matrisalar we bellemeler kod görnüşinde galýar
    try { return M.parse(prepExpr(expr)).toTex({ parenthesis: 'auto', implicit: 'hide' }); } catch (e) { return null; }
  }

  /* ------------------------------------------------------------ gurallar */
  function toolCalculate(input, card) {
    var list = (input && Array.isArray(input.expressions) ? input.expressions : []).slice(0, 20).map(String);
    if (!list.length) throw new Error('expressions boş');
    return calcMath().then(function (M) {
      var scope = new Map(), rows = [];
      list.forEach(function (expr) {
        if (expr.length > 2000) { rows.push({ expr: expr.slice(0, 80) + '…', error: 'aňlatma örän uzyn' }); return; }
        try {
          var v = M.evaluate(prepExpr(expr), scope);
          rows.push({ expr: expr, result: fmtValue(M, v) });
        } catch (e) { rows.push({ expr: expr, error: String(e.message || e) }); }
      });
      card.done(function (body) {
        var html = '<ul class="aai-calc">' + rows.map(function (r) {
          var t = toTeX(M, r.expr);
          var left = t && window.katex ? tex(t, false) : '<code>' + esc(r.expr) + '</code>';
          return '<li><span class="aai-calc-e">' + left + '</span><span class="aai-calc-eq">' + (r.error ? '⚠' : '=') + '</span><span class="aai-calc-r">' +
            (r.error ? '<span class="aai-err-t">' + esc(r.error) + '</span>' : esc(r.result)) + '</span></li>';
        }).join('') + '</ul>';
        body.innerHTML = html;
      }, rows.some(function (r) { return r.error; }) ? 'warn' : 'ok');
      return JSON.stringify(rows);
    });
  }

  function toolSolve(input, card) {
    return needEngine().then(function (E) {
      if (!E) throw new Error('hasaplaýyş motory ýüklenmedi');
      var r = E.run(String(input.task || ''), { expression: input.expression, point: input.point, lower: input.lower, upper: input.upper });
      card.done(function (body) {
        if (!r.ok && r.error) { body.innerHTML = '<p class="aai-err-t">' + esc(r.error) + '</p>'; return; }
        var check = r.check && r.check.text ? '<p class="aai-check aai-check-' + r.check.status + '">' + (r.check.status === 'ok' ? ICON.check : r.check.status === 'warn' ? ICON.warn : '') + '<span>' + esc(r.check.text) + '</span></p>' : '';
        body.innerHTML = '<div class="aai-eng-q">' + sanitize(r.title) + (r.answer ? ' = <b>' + sanitize(r.answer) + '</b>' : '') + '</div>' +
          (r.steps && r.steps.length ? '<ol class="aai-eng-steps">' + r.steps.map(function (s) { return '<li>' + sanitize(s) + '</li>'; }).join('') + '</ol>' : '') + check;
      }, r.ok ? (r.check && r.check.status === 'warn' ? 'warn' : 'ok') : 'warn');
      return JSON.stringify({
        ok: !!r.ok, task: r.task, problem: toText(r.title), answer: toText(r.answer) || r.answerText || '', answer_exact: r.answerText || '',
        steps: (r.steps || []).map(toText), check: r.check ? r.check.status + ': ' + r.check.text : '', error: r.error || undefined
      });
    });
  }

  /* ------------------------------------------------------------ çyzykly programmirleme (simpleks motory) */
  var LP_OPS = { '<=': '≤', '>=': '≥', '=': '=' };
  function lpVar(name) {
    var m = /^([A-Za-z]+)_?(\d+)$/.exec(name);
    return m ? '<i>' + esc(m[1]) + '</i><sub>' + esc(m[2]) + '</sub>' : '<i>' + esc(name) + '</i>';
  }
  function lpNum(t) { return esc(String(t)).replace(/-/g, '−'); }
  /* "3/2·x1 − x2" — koeffisiýentler tekst görnüşinde (drob) */
  function lpLin(coef, vars) {
    var out = '';
    coef.forEach(function (c, j) {
      if (c === '0') return;
      var neg = c.charAt(0) === '-', ab = neg ? c.slice(1) : c;
      var k = ab === '1' ? '' : lpNum(ab) + (ab.indexOf('/') >= 0 ? '·' : '');
      out += (out ? (neg ? ' − ' : ' + ') : (neg ? '−' : '')) + k + lpVar(vars[j]);
    });
    return out || '0';
  }
  function lpLinPlain(coef, vars) {
    var out = '';
    coef.forEach(function (c, j) {
      if (c === '0') return;
      var neg = c.charAt(0) === '-', ab = neg ? c.slice(1) : c;
      out += (out ? (neg ? ' - ' : ' + ') : (neg ? '-' : '')) + (ab === '1' ? '' : ab + (ab.indexOf('/') >= 0 ? '*' : '')) + vars[j];
    });
    return out || '0';
  }
  /* kartyň mazmuny: toolLP we saklanan taryh (restoreTool) şol bir funksiýany ulanýar */
  function lpCardHTML(r) {
    var h = '<div class="aai-lp-model"><div><b>' + esc(r.objective) + ' = ' + lpLin(r.c, r.variables) + ' → ' + esc(r.sense) + '</b></div>';
    h += '<ol class="aai-lp-cons">' + r.constraints.map(function (k) { return '<li>' + lpLin(k.a, r.variables) + ' ' + (LP_OPS[k.op] || esc(k.op)) + ' ' + lpNum(k.b) + '</li>'; }).join('') + '</ol>';
    h += '<div class="aai-lp-nn">' + r.variables.map(lpVar).join(', ') + ' ≥ 0' + (r.integer ? ', bitin sanlar' : '') + '</div></div>';
    if (r.status === 'optimal') {
      h += '<div class="aai-eng-q">' + esc(r.objective) + '<sub>' + esc(r.sense) + '</sub> = <b>' + lpNum(r.value) + '</b>' + (String(r.value).indexOf('/') >= 0 ? ' ≈ ' + lpNum(r.value_decimal) : '') +
        '<br>' + r.variables.map(function (v) { return lpVar(v) + ' = <b>' + lpNum(r.solution[v]) + '</b>'; }).join(', &nbsp;') + '</div>';
      var tight = r.check.filter(function (c) { return c.tight; }).map(function (c) { return c.index; });
      h += '<p class="aai-check aai-check-' + (r.all_satisfied ? 'ok' : 'warn') + '">' + (r.all_satisfied ? ICON.check : ICON.warn) + '<span>' +
        (r.all_satisfied ? 'Ähli çäklendirmeler ýerine ýetýär' + (tight.length ? ' (işjeň: ' + tight.join(', ') + ')' : '') + '.' : 'Käbir çäklendirmeler ýerine ýetmeýär!') + '</span></p>';
      if (r.shadow_prices) h += '<p class="aai-lp-dual">Kölege bahalary: ' + Object.keys(r.shadow_prices).map(function (k) { return lpVar(k) + ' = ' + lpNum(r.shadow_prices[k]); }).join(', ') + '</p>';
      var notes = [];
      if (r.integer && r.lp_relaxation_value) notes.push('Bitinlik şertsiz optimum: ' + lpNum(r.lp_relaxation_value) + '; şahalar we araçäkler: ' + r.nodes + ' düwün.');
      if (r.alternative_optimum) notes.push('Alternatiw optimal çözgütler hem bar.');
      if (r.degenerate) notes.push('Azgyn çözgüt (käbir bazis üýtgeýäni 0).');
      if (notes.length) h += '<p class="aai-lp-note">' + notes.map(esc).join(' ') + '</p>';
    } else {
      var msg = { infeasible: 'Meseläniň mümkin çözgüdi ýok: çäklendirmeler bir wagtda ýerine ýetmeýär.', unbounded: 'Maksat funksiýasy çäklendirilmedik: optimal çözgüt ýok.', limit: 'Hasaplamanyň çägine ýetildi.' }[r.status] || ('Netije: ' + r.status);
      h += '<p class="aai-check aai-check-warn">' + ICON.warn + '<span>' + esc(msg) + '</span></p>';
    }
    if (r.page) h += '<p class="aai-lp-link"><a href="' + esc(BASE + r.page) + '">' + esc(r.integer ? 'Şahalar we araçäkler agajyny saýtda gör →' : 'Simpleks tablisalaryny ädimme-ädim saýtda gör →') + '</a></p>';
    return h;
  }
  function toolLP(input, card) {
    var text = String(input && input.problem || '').replace(/\r/g, '').trim();
    if (!text) return Promise.reject(new Error('problem boş'));
    if (text.length > 3000) return Promise.reject(new Error('mesele örän uzyn'));
    var integer = !!(input && input.integer === true);
    var method = input && input.method === 'twoPhase' ? 'twoPhase' : 'bigM';
    return (integer ? needOR() : needSimplex()).then(function (eng) {
      var S = window.AmatlySimplex;
      if (!S || (integer && !eng)) throw new Error('simpleks motory ýüklenmedi');
      var p = S.parseText(text);
      var F = function (f) { return f.toFraction(); };
      var r = {
        ok: true, engine: 'Amatly simpleks motory (takyk droblar)', problem: text, sense: p.sense, objective: p.objName, variables: p.vars.slice(),
        c: p.c.map(F), constraints: p.cons.map(function (k) { return { a: k.a.map(F), op: k.op, b: F(k.b) }; }), integer: integer
      };
      var x = null, z = null;
      if (integer) {
        var bb = eng.branchAndBound(p, { maxNodes: 150 });
        r.status = bb.status === 'limit' && bb.best ? 'limit' : bb.status;
        r.nodes = bb.nodes.length;
        if (bb.rootZ) r.lp_relaxation_value = F(bb.rootZ);
        if (bb.best) { x = bb.best.x; z = bb.best.z; if (r.status === 'limit') r.note = 'node limit reached; best integer solution found so far'; }
        r.page = 'amal-barlagy/bitin-sanly.html#mesele=' + encodeURIComponent(text);
      } else {
        var res = S.solve(p, { method: method });
        r.status = res.status;
        r.method = res.method;
        r.tableaux = res.snapshots ? res.snapshots.length : 0;
        if (res.status === 'optimal') {
          x = res.x; z = res.z;
          r.alternative_optimum = !!(res.alt && res.alt.kind !== 'degenerate');
          r.degenerate = !!res.degenerate;
          if (res.dual && res.dual.ok) { r.shadow_prices = {}; res.dual.y.forEach(function (y, i) { r.shadow_prices['y' + (i + 1)] = F(y); }); }
        }
        r.page = 'amal-barlagy/simpleks.html#mesele=' + encodeURIComponent(text);
      }
      if (x) {
        r.value = F(z); r.value_decimal = round(z.valueOf(), 6);
        r.solution = {};
        p.vars.forEach(function (v, j) { r.solution[v] = F(x[j]); });
        r.check = p.cons.map(function (k, i) {
          var lhs = S.fraction(0);
          k.a.forEach(function (a, j) { lhs = lhs.add(a.mul(x[j])); });
          var c = lhs.compare(k.b);
          var ok = k.op === '<=' ? c <= 0 : k.op === '>=' ? c >= 0 : c === 0;
          return { index: i + 1, constraint: lpLinPlain(k.a.map(F), p.vars) + ' ' + k.op + ' ' + F(k.b), lhs: F(lhs), satisfied: ok, tight: c === 0 };
        });
        r.all_satisfied = r.check.every(function (c) { return c.satisfied; });
      }
      card.done(function (body) { body.innerHTML = lpCardHTML(r); }, r.status === 'optimal' && r.all_satisfied ? 'ok' : 'warn');
      return JSON.stringify(r);
    }, function (e) { throw e; }).catch(function (e) {
      throw new Error(e && e.message ? e.message : String(e));
    });
  }

  function toolPlot(input, card) {
    return Promise.all([needMath(), needKatex().catch(function () { return null; })]).then(function (arr) {
      var plot = createPlot(arr[0], input || {});
      card.done(function (body) { body.appendChild(plot.el); plot.draw(); }, 'ok', true);
      return JSON.stringify(plot.facts());
    });
  }

  /* ------------------------------------------------------------ grafik (kanwas) */
  var plots = new Set();
  function niceStep(span) {
    var raw = span / 7, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
  }
  function fmtTick(v, step) {
    var d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    var s = Math.abs(v) < step / 1e6 ? '0' : v.toFixed(Math.min(6, d));
    return s.replace('-', '−');
  }
  function createPlot(M, spec) {
    var fnsSpec = (Array.isArray(spec.functions) ? spec.functions : []).slice(0, 5).filter(function (f) { return f && f.expr; });
    if (!fnsSpec.length) throw new Error('functions boş');
    var par = spec.parameter && spec.parameter.name && /^[a-wyzA-Z]$/.test(spec.parameter.name) && isFinite(spec.parameter.min) && isFinite(spec.parameter.max) && spec.parameter.max > spec.parameter.min ? {
      name: spec.parameter.name, min: +spec.parameter.min, max: +spec.parameter.max,
      step: isFinite(spec.parameter.step) && spec.parameter.step > 0 ? +spec.parameter.step : (spec.parameter.max - spec.parameter.min) / 100,
      value: isFinite(spec.parameter.value) ? Math.min(spec.parameter.max, Math.max(spec.parameter.min, +spec.parameter.value)) : (+spec.parameter.min + +spec.parameter.max) / 2
    } : null;
    var fns = fnsSpec.map(function (f, i) {
      var c = M.compile(prepExpr(f.expr));
      return {
        label: String(f.label || (fnsSpec.length > 1 ? ['f', 'g', 'h', 'p', 'q'][i] + '(x)' : 'f(x)')).slice(0, 40), expr: String(f.expr).slice(0, 200),
        f: function (x) { var sc = { x: x }; if (par) sc[par.name] = par.value; try { return realOf(c.evaluate(sc)); } catch (e) { return NaN; } }
      };
    });
    fns.forEach(function (fn) { var ok = false; for (var t = -3; t <= 3 && !ok; t += 0.37) ok = isFinite(fn.f(t)); if (!ok) { for (var k = -50; k <= 50 && !ok; k += 1.3) ok = isFinite(fn.f(k)); } if (!ok) throw new Error('"' + fn.expr + '" funksiýasy hasaplanmady'); });
    var pts = (Array.isArray(spec.points) ? spec.points : []).slice(0, 12).filter(function (p) { return p && isFinite(p.x) && isFinite(p.y); });
    var shade = spec.shade && isFinite(spec.shade.from) && isFinite(spec.shade.to) ? { a: Math.min(spec.shade.from, spec.shade.to), b: Math.max(spec.shade.from, spec.shade.to) } : null;

    var x0 = isFinite(spec.x_min) ? +spec.x_min : -6, x1 = isFinite(spec.x_max) ? +spec.x_max : 6;
    if (!(x1 > x0)) { x0 = -6; x1 = 6; }
    function autoY() {
      var vals = [];
      fns.forEach(function (fn) { for (var i = 0; i <= 300; i++) { var y = fn.f(x0 + (x1 - x0) * i / 300); if (isFinite(y)) vals.push(y); } });
      pts.forEach(function (p) { vals.push(p.y); });
      if (!vals.length) return [-5, 5];
      vals.sort(function (a, b) { return a - b; });
      var lo = vals[Math.floor(vals.length * 0.04)], hi = vals[Math.ceil(vals.length * 0.96) - 1];
      pts.forEach(function (p) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); });
      if (lo > 0 && lo < (hi - lo) * 0.6) lo = 0;
      if (hi < 0 && -hi < (hi - lo) * 0.6) hi = 0;
      if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
      var pad = (hi - lo) * 0.14;
      return [lo - pad, hi + pad];
    }
    var yr = isFinite(spec.y_min) && isFinite(spec.y_max) && spec.y_max > spec.y_min ? [+spec.y_min, +spec.y_max] : autoY();
    var home = { x0: x0, x1: x1, y0: yr[0], y1: yr[1] }, v = { x0: x0, x1: x1, y0: yr[0], y1: yr[1] };

    var el = h('figure', { class: 'aai-plot' });
    var head = h('figcaption', { class: 'aai-plot-head' });
    if (spec.title) head.appendChild(h('span', { class: 'aai-plot-title', text: String(spec.title).slice(0, 120) }));
    var legend = h('span', { class: 'aai-plot-legend' });
    fns.forEach(function (fn, i) { var item = h('span', { class: 'aai-lg aai-c' + (i + 1) }); item.appendChild(h('i')); item.appendChild(document.createTextNode(fn.label)); legend.appendChild(item); });
    head.appendChild(legend);
    el.appendChild(head);
    var wrap = h('div', { class: 'aai-plot-wrap' });
    var canvas = h('canvas', { role: 'img', 'aria-label': 'Grafik: ' + fns.map(function (f) { return f.label + ' = ' + f.expr; }).join('; ') });
    var read = h('div', { class: 'aai-plot-read', 'aria-hidden': 'true' });
    var ctr = h('div', { class: 'aai-plot-ctr' });
    [['zin', 'Ulalt', 0.7], ['zout', 'Kiçelt', 1 / 0.7], ['home', 'Başlangyç görnüş', 0]].forEach(function (b) {
      var btn = h('button', { type: 'button', title: b[1], 'aria-label': b[1] }, ICON[b[0]]);
      btn.addEventListener('click', function () { if (b[2]) zoom(b[2], (v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2); else { v = { x0: home.x0, x1: home.x1, y0: home.y0, y1: home.y1 }; draw(); } });
      ctr.appendChild(btn);
    });
    wrap.appendChild(canvas); wrap.appendChild(read); wrap.appendChild(ctr);
    el.appendChild(wrap);
    if (par) {
      var row = h('label', { class: 'aai-plot-par' });
      var nm = h('span', { class: 'aai-plot-parname' });
      var rng = h('input', { type: 'range', min: par.min, max: par.max, step: par.step, value: par.value, 'aria-label': 'Parametr ' + par.name });
      function lbl() { nm.textContent = par.name + ' = ' + round(par.value, 3); }
      lbl();
      rng.addEventListener('input', function () { par.value = +rng.value; lbl(); draw(); });
      row.appendChild(nm); row.appendChild(rng);
      el.appendChild(row);
    }
    var hover = null;

    function colors() {
      var cs = getComputedStyle(el);
      var g = function (n, d) { return (cs.getPropertyValue(n) || '').trim() || d; };
      return { bg: g('--aai-plot-bg', '#fff'), grid: g('--aai-plot-grid', '#e6ebf5'), axis: g('--aai-plot-axis', '#4a5878'), text: g('--aai-plot-text', '#4a5878'),
        c: [1, 2, 3, 4, 5].map(function (i) { return g('--aai-c' + i, '#2047c4'); }), shade: g('--aai-plot-shade', 'rgba(32,71,196,.16)'), pt: g('--aai-plot-pt', '#b23a2e') };
    }
    function draw() {
      var W = Math.max(240, Math.round(wrap.clientWidth || 360)), H = Math.round(Math.min(340, Math.max(220, W * 0.62)));
      var dpr = Math.min(2.5, window.devicePixelRatio || 1);
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + 'px'; }
      var g = canvas.getContext('2d'), C = colors();
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
      var X = function (x) { return (x - v.x0) / (v.x1 - v.x0) * W; }, Y = function (y) { return H - (y - v.y0) / (v.y1 - v.y0) * H; };
      var sx = niceStep(v.x1 - v.x0), sy = niceStep(v.y1 - v.y0);
      g.lineWidth = 1; g.strokeStyle = C.grid; g.beginPath();
      for (var gx = Math.ceil(v.x0 / sx) * sx; gx <= v.x1; gx += sx) { var px = Math.round(X(gx)) + 0.5; g.moveTo(px, 0); g.lineTo(px, H); }
      for (var gy = Math.ceil(v.y0 / sy) * sy; gy <= v.y1; gy += sy) { var py = Math.round(Y(gy)) + 0.5; g.moveTo(0, py); g.lineTo(W, py); }
      g.stroke();
      var ax = Math.min(Math.max(Math.round(Y(0)) + 0.5, 0.5), H - 0.5), ay = Math.min(Math.max(Math.round(X(0)) + 0.5, 0.5), W - 0.5);
      g.strokeStyle = C.axis; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, ax); g.lineTo(W, ax); g.moveTo(ay, 0); g.lineTo(ay, H); g.stroke();
      g.fillStyle = C.text; g.font = '11px "Instrument Sans", system-ui, sans-serif'; g.textBaseline = 'top';
      for (gx = Math.ceil(v.x0 / sx) * sx; gx <= v.x1; gx += sx) { if (Math.abs(gx) < sx / 1e6) continue; var tx = X(gx); if (tx < 14 || tx > W - 14) continue; g.textAlign = 'center'; g.fillText(fmtTick(gx, sx), tx, Math.min(H - 14, Math.max(2, ax + 4))); }
      g.textBaseline = 'middle';
      for (gy = Math.ceil(v.y0 / sy) * sy; gy <= v.y1; gy += sy) { if (Math.abs(gy) < sy / 1e6) continue; var ty = Y(gy); if (ty < 10 || ty > H - 10) continue; var right = ay + 5 > W - 34; g.textAlign = right ? 'right' : 'left'; g.fillText(fmtTick(gy, sy), right ? ay - 5 : Math.max(4, ay + 5), ty); }
      if (shade && fns[0]) {
        var a = Math.max(shade.a, v.x0), b = Math.min(shade.b, v.x1);
        if (b > a) {
          g.fillStyle = C.shade; g.beginPath(); g.moveTo(X(a), Y(0));
          for (var k = 0; k <= 200; k++) { var xx = a + (b - a) * k / 200, yy = fns[0].f(xx); if (isFinite(yy)) g.lineTo(X(xx), Y(Math.max(v.y0 - 1e3 * (v.y1 - v.y0), Math.min(v.y1 + 1e3 * (v.y1 - v.y0), yy)))); }
          g.lineTo(X(b), Y(0)); g.closePath(); g.fill();
        }
      }
      var spanY = v.y1 - v.y0;
      fns.forEach(function (fn, i) {
        g.strokeStyle = C.c[i]; g.lineWidth = 2.2; g.lineJoin = 'round'; g.beginPath();
        var n = W * 2, prev = null;
        for (var s = 0; s <= n; s++) {
          var x = v.x0 + (v.x1 - v.x0) * s / n, y = fn.f(x);
          if (!isFinite(y)) { prev = null; continue; }
          var cy = Math.max(v.y0 - 4 * spanY, Math.min(v.y1 + 4 * spanY, y));
          if (prev === null || Math.abs(y - prev) > spanY * 1.5) g.moveTo(X(x), Y(cy)); else g.lineTo(X(x), Y(cy));
          prev = y;
        }
        g.stroke();
      });
      pts.forEach(function (p) {
        var px2 = X(p.x), py2 = Y(p.y);
        if (px2 < -10 || px2 > W + 10 || py2 < -10 || py2 > H + 10) return;
        g.fillStyle = C.pt; g.beginPath(); g.arc(px2, py2, 4.2, 0, Math.PI * 2); g.fill();
        g.strokeStyle = C.bg; g.lineWidth = 1.5; g.stroke();
        if (p.label) { g.fillStyle = C.text; g.font = '600 11.5px "Instrument Sans", system-ui, sans-serif'; g.textAlign = px2 > W - 80 ? 'right' : 'left'; g.textBaseline = 'bottom'; g.fillText(String(p.label).slice(0, 24), px2 + (px2 > W - 80 ? -7 : 7), py2 - 5); }
      });
      if (hover !== null) {
        var hx = X(hover);
        g.strokeStyle = C.axis; g.globalAlpha = 0.35; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(hx + 0.5, 0); g.lineTo(hx + 0.5, H); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
        var parts = ['x = ' + round(hover, 3)];
        fns.forEach(function (fn, i) {
          var y = fn.f(hover);
          if (!isFinite(y)) return;
          parts.push(fn.label + ' = ' + round(y, 3));
          var cy = Y(y);
          if (cy >= 0 && cy <= H) { g.fillStyle = C.c[i]; g.beginPath(); g.arc(hx, cy, 3.6, 0, Math.PI * 2); g.fill(); }
        });
        read.textContent = parts.join('   '); read.hidden = false;
      } else read.hidden = true;
    }
    function zoom(f, cx, cy) {
      v = { x0: cx + (v.x0 - cx) * f, x1: cx + (v.x1 - cx) * f, y0: cy + (v.y0 - cy) * f, y1: cy + (v.y1 - cy) * f };
      draw();
    }
    var drag = null;
    canvas.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY, v: { x0: v.x0, x1: v.x1, y0: v.y0, y1: v.y1 }, touch: e.pointerType === 'touch', id: e.pointerId };
      if (!drag.touch) canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      if (drag && (drag.touch || e.buttons)) {
        var dx = (e.clientX - drag.x) / r.width * (drag.v.x1 - drag.v.x0), dy = drag.touch ? 0 : (e.clientY - drag.y) / r.height * (drag.v.y1 - drag.v.y0);
        v = { x0: drag.v.x0 - dx, x1: drag.v.x1 - dx, y0: drag.v.y0 + dy, y1: drag.v.y1 + dy };
        hover = null; draw(); return;
      }
      hover = v.x0 + (e.clientX - r.left) / r.width * (v.x1 - v.x0); draw();
    });
    canvas.addEventListener('pointerup', function () { drag = null; });
    canvas.addEventListener('pointercancel', function () { drag = null; });
    canvas.addEventListener('pointerleave', function () { if (!drag) { hover = null; draw(); } });
    canvas.addEventListener('dblclick', function () { v = { x0: home.x0, x1: home.x1, y0: home.y0, y1: home.y1 }; draw(); });
    canvas.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      var r = canvas.getBoundingClientRect();
      zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, v.x0 + (e.clientX - r.left) / r.width * (v.x1 - v.x0), v.y1 - (e.clientY - r.top) / r.height * (v.y1 - v.y0));
    }, { passive: false });

    function facts() {
      var a = home.x0, b = home.x1, N = 1600, out = { window: { x: [round(a, 4), round(b, 4)], y: [round(home.y0, 3), round(home.y1, 3)] }, curves: [], intersections: [] };
      if (par) out.parameter = { name: par.name, value: round(par.value, 4), range: [par.min, par.max] };
      fns.forEach(function (fn) {
        var xs = [], ys = [];
        for (var i = 0; i <= N; i++) { var x = a + (b - a) * i / N; xs.push(x); ys.push(fn.f(x)); }
        var zeros = findRoots(fn.f, a, b, N).slice(0, 10).map(function (z) { return round(z, 4); });
        var mx = [], mn = [], br = [];
        var span = Math.max(1e-9, (home.y1 - home.y0));
        for (var j = 1; j < N; j++) {
          var y0 = ys[j - 1], y1 = ys[j], y2 = ys[j + 1];
          if (isFinite(y0) !== isFinite(y1) && br.length < 6) br.push(round(xs[j], 3));
          else if (isFinite(y0) && isFinite(y1) && Math.abs(y1 - y0) > span * 2 && br.length < 6) br.push(round((xs[j] + xs[j - 1]) / 2, 3));
          if (!isFinite(y0) || !isFinite(y1) || !isFinite(y2)) continue;
          if (y1 > y0 && y1 >= y2 && Math.abs(y1 - y0) < span && Math.abs(y2 - y1) < span) mx.push(refine(fn.f, xs[j - 1], xs[j + 1], 1));
          if (y1 < y0 && y1 <= y2 && Math.abs(y1 - y0) < span && Math.abs(y2 - y1) < span) mn.push(refine(fn.f, xs[j - 1], xs[j + 1], -1));
        }
        var c = { label: fn.label, expr: fn.expr, zeros: zeros, local_max: mx.slice(0, 8), local_min: mn.slice(0, 8) };
        if (a <= 0 && b >= 0 && isFinite(fn.f(0))) c.y_intercept = round(fn.f(0), 4);
        if (br.length) c.breaks_near = br;
        out.curves.push(c);
      });
      for (var i = 0; i < fns.length; i++) for (var j = i + 1; j < fns.length; j++) {
        var f1 = fns[i].f, f2 = fns[j].f, d = function (x) { return f1(x) - f2(x); };
        var xsI = findRoots(d, a, b, N).slice(0, 10);
        if (xsI.length) out.intersections.push({ curves: [fns[i].label, fns[j].label], points: xsI.map(function (x) { return { x: round(x, 4), y: round(f1(x), 4) }; }) });
      }
      return out;
    }
    function refine(f, a, b, sign) {
      var g = (Math.sqrt(5) - 1) / 2, c = b - g * (b - a), d = a + g * (b - a);
      for (var k = 0; k < 60; k++) { if (sign * f(c) > sign * f(d)) b = d; else a = c; c = b - g * (b - a); d = a + g * (b - a); }
      var x = (a + b) / 2;
      return { x: round(x, 4), y: round(f(x), 4) };
    }
    var api = { el: el, draw: draw, facts: facts };
    plots.add(api);
    return api;
  }
  var redrawPlots = raf(function () { plots.forEach(function (p) { if (p.el.isConnected) p.draw(); else plots.delete(p); }); });
  window.addEventListener('resize', redrawPlots);
  new MutationObserver(redrawPlots).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  /* ------------------------------------------------------------ suratlar */
  function readImage(file) {
    return new Promise(function (res, rej) {
      if (!file || !/^image\/(png|jpe?g|gif|webp|heic|heif|bmp)$/i.test(file.type || 'image/jpeg')) { rej(new Error('Diňe surat faýly (JPG, PNG, WebP) goşup bolýar.')); return; }
      if (file.size > 25 * 1024 * 1024) { rej(new Error('Surat örän uly (25 MB-dan köp).')); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        try {
          var max = 1600, w = img.naturalWidth, hh = img.naturalHeight, s = Math.min(1, max / Math.max(w, hh));
          var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(hh * s));
          var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          var q = 0.86, data = c.toDataURL('image/jpeg', q);
          while (data.length > 4.5e6 && q > 0.4) { q -= 0.12; data = c.toDataURL('image/jpeg', q); }
          var t = document.createElement('canvas'), ts = Math.min(1, 160 / Math.max(c.width, c.height));
          t.width = Math.round(c.width * ts); t.height = Math.round(c.height * ts); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
          URL.revokeObjectURL(url);
          res({ media_type: 'image/jpeg', data: data.split(',')[1], thumb: t.toDataURL('image/jpeg', 0.7) });
        } catch (e) { URL.revokeObjectURL(url); rej(new Error('Suraty okap bolmady.')); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Suraty açyp bolmady (bu format brauzerde goldanmaýar bolmagy mümkin).')); };
      img.src = url;
    });
  }

  /* ------------------------------------------------------------ söhbetiň taryhy */
  var conv = [];            // API görnüşindäki habarlar
  var thumbs = {};          // ulanyjy habarynyň belgisi → suratlaryň kiçi nusgalary (diňe görkezmek üçin)
  var quotes = {};          // ulanyjy habarynyň belgisi → saýlanan tekst
  function chatKey() { var u = currentUser(); return 'amatly_ai_chat_v1' + (u ? ':' + u.toLowerCase() : ''); }
  function isTextTurn(m) { return m && m.role === 'user' && Array.isArray(m.content) && m.content.some(function (b) { return b.type !== 'tool_result'; }); }
  function stripThinking(content) { return content.filter(function (b) { return b.type !== 'thinking' && b.type !== 'redacted_thinking'; }); }
  function saveChat() {
    var data = conv.map(function (m, i) {
      if (m.role === 'assistant') return m._local ? { role: 'assistant', content: stripThinking(m.content), _local: 1 } : { role: 'assistant', content: stripThinking(m.content) };
      return { role: 'user', content: m.content.map(function (b) { return b.type === 'image' ? { type: 'text', text: '[Ulanyjy surat iberdi — surat indi elýeterli däl]' } : b; }) };
    }).filter(function (m) { return m.content.length; });
    var payload = { v: 1, conv: data, thumbs: thumbs, quotes: quotes };
    var json = JSON.stringify(payload);
    while (json.length > 1.2e6 && payload.conv.length > 4) {
      var cut = 1; while (cut < payload.conv.length && !isTextTurn(payload.conv[cut])) cut++;
      payload.conv = payload.conv.slice(cut); payload.thumbs = {}; payload.quotes = {};
      json = JSON.stringify(payload);
    }
    if (!store.set(chatKey(), json)) store.del(chatKey());
  }
  function loadChat() {
    try {
      var d = JSON.parse(store.get(chatKey()) || 'null');
      if (d && d.v === 1 && Array.isArray(d.conv)) { conv = d.conv; thumbs = d.thumbs || {}; quotes = d.quotes || {}; return; }
    } catch (e) { /* ýok */ }
    conv = []; thumbs = {}; quotes = {};
  }
  /* API-a ibermek üçin taryh: öňki jogaplaryň "thinking" bölekleri aýrylýar (häzirki gural aýlawyndakylar üýtgewsiz galýar) */
  function forSend() {
    var start = 0;
    for (var i = conv.length - 1; i >= 0; i--) if (isTextTurn(conv[i])) { start = i; break; }
    var msgs = conv.map(function (m, i) {
      if (m.role === 'assistant' && i < start) return { role: 'assistant', content: stripThinking(m.content) };
      return { role: m.role, content: m.content };          // _local ýaly içki bellikler API-a iberilmeýär
    }).filter(function (m) { return m.content && m.content.length; });
    if (msgs.length > KEEP_MESSAGES) {
      var cutAt = msgs.length - KEEP_MESSAGES;
      while (cutAt < msgs.length && !isTextTurn(msgs[cutAt])) cutAt++;
      msgs = msgs.slice(cutAt);
    }
    // köne suratlar (soňky 3 soragdan öňküler) tekst bilen çalşylýar — haýyşyň ölçegi kiçi bolsun
    var seen = 0;
    for (var k = msgs.length - 1; k >= 0; k--) {
      if (!isTextTurn(msgs[k])) continue;
      seen++;
      if (seen > 3 && msgs[k].content.some(function (b) { return b.type === 'image'; })) {
        msgs[k] = { role: 'user', content: msgs[k].content.map(function (b) { return b.type === 'image' ? { type: 'text', text: '[öňki surat]' } : b; }) };
      }
    }
    return msgs;
  }

  /* ------------------------------------------------------------ API: haýyş we akym (SSE) */
  function AIError(kind, message, status) { var e = new Error(message || kind); e.kind = kind; e.status = status || 0; return e; }
  function explain(e) {
    var k = e && e.kind, s = e && e.status;
    if (e && e.name === 'AbortError') return 'Jogap togtadyldy.';
    if (k === 'not_configured') return transport() === 'none'
      ? 'Amatly AI entek sazlanmady. Saýty internet salgysy (hosting ýa-da npm run serve) arkaly açyň ýa-da Sazlamalar → Amatly AI bölüminde API açaryny goşuň.'
      : 'Amatly AI serwerde entek sazlanmady (API açary goşulmandyr). Saýtyň eýesi: api/ai-config.php faýlyna açary ýazyň ýa-da Sazlamalar → Amatly AI.';
    if (k === 'network') return 'Serwer bilen baglanyşyk bolmady. Internet baglanyşygyny barlap, täzeden synanyşyň.';
    if (k === 'authentication_error' || s === 401) return 'API açary nädogry ýa-da ýatyrylan. Täze açar alyň (console.anthropic.com) we sazlamada çalşyň.';
    if (k === 'permission_error' || s === 403) return 'Bu açar bilen haýyş etmäge rugsat ýok (ýa-da saýt bu salgydan AI ulanmaga rugsat bermeýär).';
    if (k === 'rate_limit' || k === 'rate_limit_error' || s === 429) return 'Haýyşlar köp boldy. Biraz garaşyp, täzeden synanyşyň.';
    if (k === 'overloaded_error' || s === 529) return 'AI häzir aşa köp ýüklenen. Birnäçe sekuntdan täzeden synanyşyň.';
    if (k === 'request_too_large' || s === 413) return 'Haýyş örän uly (köp ýa-da uly surat). Täze söhbet açyň ýa-da kiçiräk surat goşuň.';
    if (k === 'billing_error' || s === 402) return 'API hasabynda serişde ýok. Anthropic Console-da töleg sazlamalaryny barlaň.';
    if (k === 'invalid_request_error' || s === 400) return 'Haýyş kabul edilmedi: ' + (e.message || '') ;
    if (k === 'bad_stream') return 'Jogap doly gelmedi. Täzeden synanyşyň.';
    return 'Näsazlyk ýüze çykdy' + (e && e.message ? ': ' + e.message : '.');
  }
  function request(msgs, signal, opt) {
    opt = opt || {};
    var mode = getMode(), how = transport();
    if (how === 'none') return Promise.reject(AIError('not_configured'));
    var url, headers = { 'content-type': 'application/json' }, body;
    if (how === 'direct') {
      url = API_URL;
      headers['x-api-key'] = userKey();
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
      body = { model: (store.get('amatly_ai_model') || P.model), max_tokens: opt.max_tokens || P.max_tokens,
        system: [{ type: 'text', text: P.system + '\n\n' + (P.modes[mode] || ''), cache_control: { type: 'ephemeral' } }], tools: P.tools, messages: msgs, stream: true };
      if (P.effort) body.output_config = { effort: P.effort };
    } else {
      url = ENDPOINT;
      body = { mode: mode, messages: msgs };
      if (opt.max_tokens) body.max_tokens = opt.max_tokens;
    }
    return fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: signal, credentials: how === 'proxy' ? 'same-origin' : 'omit', cache: 'no-store' })
      .catch(function (e) { if (e && e.name === 'AbortError') throw e; throw AIError('network', e && e.message); })
      .then(function (res) {
        if (res.ok && /event-stream/.test(res.headers.get('content-type') || '')) return res;
        return res.text().then(function (t) {
          var j = null; try { j = JSON.parse(t); } catch (e) { /* ýok */ }
          var err = j && j.error ? j.error : null;
          if (res.status === 404 && how === 'proxy' && !err) throw AIError('not_configured', '', 404);
          if (res.status === 405 && how === 'proxy' && !err) throw AIError('not_configured', '', 405);
          if (res.ok && !err && how === 'proxy' && !j) throw AIError('not_configured', 'Serwer api/ai.php faýlyny işletmeýär (PHP ýok)', res.status);
          if (res.ok && !err) throw AIError('bad_stream', 'Serwer akym (stream) ugratmady', res.status);
          throw AIError(err ? err.type : 'http', err ? err.message : ('HTTP ' + res.status), res.status);
        });
      });
  }
  function readStream(res, on) {
    var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
    var blocks = [], stop = null, gotStop = false;
    function handle(raw) {
      var data = '', lines = raw.split('\n');
      for (var i = 0; i < lines.length; i++) if (lines[i].indexOf('data:') === 0) data += (data ? '\n' : '') + lines[i].slice(5).replace(/^ /, '');
      if (!data) return;
      var d; try { d = JSON.parse(data); } catch (e) { return; }
      var b;
      switch (d.type) {
        case 'content_block_start':
          b = JSON.parse(JSON.stringify(d.content_block || {}));
          if (b.type === 'text') b.text = b.text || '';
          if (b.type === 'thinking') b.thinking = b.thinking || '';
          if (b.type === 'tool_use') { b._json = ''; b.input = b.input || {}; }
          blocks[d.index] = b; on.start(d.index, b);
          break;
        case 'content_block_delta':
          b = blocks[d.index]; if (!b) break;
          var dl = d.delta || {};
          if (dl.type === 'text_delta') { b.text += dl.text; on.text(d.index, b); }
          else if (dl.type === 'input_json_delta') b._json += dl.partial_json || '';
          else if (dl.type === 'thinking_delta') { b.thinking += dl.thinking || ''; on.thinking(d.index, b); }
          else if (dl.type === 'signature_delta') b.signature = dl.signature;
          else if (dl.type === 'citations_delta') (b.citations = b.citations || []).push(dl.citation);
          break;
        case 'content_block_stop':
          b = blocks[d.index];
          if (b && b.type === 'tool_use') {
            try { b.input = b._json ? JSON.parse(b._json) : (b.input || {}); } catch (e) { b.input = {}; b._bad = true; }
            delete b._json;
          }
          if (b) on.stop(d.index, b);
          break;
        case 'message_delta':
          if (d.delta && d.delta.stop_reason) stop = d.delta.stop_reason;
          break;
        case 'message_stop': gotStop = true; break;
        case 'error': throw AIError(d.error && d.error.type || 'api_error', d.error && d.error.message);
      }
    }
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) {
          if (buf.trim()) handle(buf.replace(/\r/g, ''));
          if (!gotStop && !stop) throw AIError('bad_stream');
          return { content: blocks.filter(Boolean).map(function (b) { var c = Object.assign({}, b); delete c._bad; return c; }), stop: stop, bad: blocks.some(function (b) { return b && b._bad; }) };
        }
        buf += dec.decode(r.value, { stream: true }).replace(/\r\n?/g, '\n');
        var i;
        while ((i = buf.indexOf('\n\n')) >= 0) { var raw = buf.slice(0, i); buf = buf.slice(i + 2); handle(raw); }
        return pump();
      });
    }
    return pump();
  }

  /* ------------------------------------------------------------ interfeýs */
  var ui = null, busy = false, aborter = null, pending = { images: [], quote: '' };
  var SUGGEST = [
    [/^statistika\//, ['Bu toplumyň medanasyny we standart döwükligini tapyň: 4, 8, 6, 5, 3, 8, 9', 't-testi haçan ulanmaly?', 'Normal paýlanyşyň egrisini grafikde görkeziň']],
    [/^kalkulus\//, ['lim (x→0) (1 − cos x)/x² limitini çözüň', 'y = x³ − 3x funksiýany derňäp, grafigini çyzyň', '∫ x·eˣ dx integraly ädimme-ädim çözüň']],
    [/^geometriya\//, ['Taraplary 3, 4 we 5 bolan üçburçlugyň meýdany näçe?', 'Şaryň göwrüminiň formulasy nireden gelýär?', 'Töweregiň uzynlygy bilen meýdanyň tapawudy näme?']],
    [/^(algebra|on-algebra)\//, ['2x² − 5x + 2 = 0 deňlemäni çözüň', '3/4 + 5/6 nähili goşulýar?', '|x − 3| < 2 deňsizligi çözüň we grafikde görkeziň']],
    [/^matrisa\//, ['A = [[2, 1], [1, 3]] matrisanyň kesgitleýjisini we ters matrisasyny tapyň', 'Matrisalary köpeltmek näme üçin orun çalşyrmaýar?']],
    [/^soz-meseleleri\//, ['Iki otly 600 km aralykdan biri-birine garşy ýola çykdy: tizlikleri 70 we 80 km/sag. Näçe sagatdan duşuşarlar?', 'Söz meselesini deňlemä nähili öwürmeli?']],
    [/^san-usullary\//, ['x³ − x − 2 = 0 deňlemäni Nýutonyň usuly bilen çözüň', 'Ýarpylatma usuly näme üçin hemişe ýygnanýar?']],
    [/^amal-barlagy\/simpleks/, ['Simpleks usulynda çözüji sütüni we setiri nädip saýlamaly?', 'M-usuly bilen iki tapgyrly usulyň tapawudy näme?', 'Kölege bahasy (ikilenji baha) näme aňladýar?']],
    [/^amal-barlagy\//, ['Ulag meselesinde MODI usuly näme üçin gerek?', 'Demirgazyk-günbatar burç usuly bilen Vogel usulynyň tapawudy näme?']],
    [/./, ['∫ x·eˣ dx integraly ädimme-ädim çözüň', 'y = x² − 4x + 3 parabolany derňäp, grafigini çyzyň', 'Bu toplumyň medanasy näçe: 4, 8, 6, 5, 3?']]
  ];
  function suggestions() { var p = pagePath(); for (var i = 0; i < SUGGEST.length; i++) if (SUGGEST[i][0].test(p)) return SUGGEST[i][1]; return []; }

  function buildFab() {
    if (document.querySelector('.aai-fab')) return;
    var fab = h('button', { class: 'aai-fab', type: 'button', 'aria-controls': 'aaiPanel', 'aria-expanded': 'false', title: 'Amatly AI — matematika mugallymy' },
      ICON.mark + '<span class="aai-fab-t">Amatly AI</span>');
    fab.addEventListener('click', function () { toggle(); });
    document.body.appendChild(fab);
    var hideFab = document.body.getAttribute('data-ai-fab') === 'off';
    if (hideFab) fab.hidden = true;
  }
  function buildPanel() {
    if (ui) return ui;
    var panel = h('section', { class: 'aai-panel', id: 'aaiPanel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'aaiTitle', hidden: true });
    panel.innerHTML =
      '<header class="aai-head">' +
        '<div class="aai-id">' + ICON.mark + '<div class="aai-idt"><h2 id="aaiTitle">Amatly AI</h2><p class="aai-badge" title="' + LOCAL_TITLE + '" hidden>' + ICON.engine + '<span>Amatly motory</span></p></div></div>' +
        '<div class="aai-modes" role="radiogroup" aria-label="Jogap režimi">' +
          '<button type="button" role="radio" data-mode="explain" title="Doly çözgüdi ädimme-ädim düşündirýär">Düşündir</button>' +
          '<button type="button" role="radio" data-mode="tutor" title="Jogaby derrew aýtmaýar: soraglar we maslahatlar bilen özüňize çözdürýär">Mugallym</button>' +
        '</div>' +
        '<button type="button" class="aai-ib" data-act="new" title="Täze söhbet" aria-label="Täze söhbet">' + ICON.plus + '</button>' +
        '<button type="button" class="aai-ib" data-act="close" title="Ýap (Esc)" aria-label="Ýap">' + ICON.close + '</button>' +
      '</header>' +
      '<div class="aai-log" role="log" aria-live="polite" tabindex="-1"></div>' +
      '<form class="aai-composer" novalidate>' +
        '<div class="aai-pending" hidden></div>' +
        '<label class="aai-sr" for="aaiInput">Soragyňyz</label>' +
        '<textarea id="aaiInput" rows="1" maxlength="6000" placeholder="Meseläňizi ýazyň ýa-da suratyny goşuň…" enterkeyhint="send"></textarea>' +
        '<div class="aai-bar">' +
          '<button type="button" class="aai-ib aai-attach" data-act="attach" title="Surat goşmak: mesele ýa-da öz çözgüdiňiz" aria-label="Surat goş">' + ICON.camera + '</button>' +
          '<input type="file" accept="image/*" class="aai-file" hidden>' +
          '<span class="aai-hint">AI ýalňyşyp biler — möhüm jogaplary barlaň.</span>' +
          '<button type="submit" class="aai-send" aria-label="Ugrat" title="Ugrat (Enter)">' + ICON.send + '</button>' +
        '</div>' +
      '</form>';
    document.body.appendChild(panel);
    var q = function (s) { return panel.querySelector(s); };
    ui = { panel: panel, log: q('.aai-log'), form: q('.aai-composer'), input: q('textarea'), send: q('.aai-send'), file: q('.aai-file'), pending: q('.aai-pending') };
    watchScroll(ui.log);

    panel.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act],[data-mode]');
      if (!b) return;
      if (b.dataset.mode) { store.set('amatly_ai_mode', b.dataset.mode); syncModes(); return; }
      var act = b.dataset.act;
      if (act === 'close') close();
      else if (act === 'new') newChat();
      else if (act === 'attach') ui.file.click();
    });
    ui.file.addEventListener('change', function () { addFiles(ui.file.files); ui.file.value = ''; });
    ui.form.addEventListener('submit', function (e) { e.preventDefault(); if (busy) stopNow(); else submit(); });
    ui.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!busy) submit(); }
    });
    ui.input.addEventListener('input', autosize);
    ui.input.addEventListener('paste', function (e) {
      var files = [].slice.call((e.clipboardData && e.clipboardData.files) || []).filter(function (f) { return /^image\//.test(f.type); });
      if (files.length) { e.preventDefault(); addFiles(files); }
    });
    panel.addEventListener('dragover', function (e) { if (e.dataTransfer && [].slice.call(e.dataTransfer.types || []).indexOf('Files') > -1) { e.preventDefault(); panel.classList.add('is-drop'); } });
    panel.addEventListener('dragleave', function (e) { if (!panel.contains(e.relatedTarget)) panel.classList.remove('is-drop'); });
    panel.addEventListener('drop', function (e) { e.preventDefault(); panel.classList.remove('is-drop'); if (e.dataTransfer) addFiles(e.dataTransfer.files); });
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    syncModes();
    loadChat();
    renderAll();
    if (localMode !== null) setLocal(localMode, localWhy);
    return ui;
  }
  function syncModes() {
    if (!ui) return;
    var m = getMode();
    ui.panel.querySelectorAll('[data-mode]').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.mode === m ? 'true' : 'false'); });
    ui.panel.classList.toggle('is-tutor', m === 'tutor');
  }
  function autosize() { var t = ui.input; t.style.height = 'auto'; t.style.height = Math.min(180, t.scrollHeight) + 'px'; }
  function isOpen() { return ui && !ui.panel.hidden; }
  function open(opts) {
    buildPanel();
    checkMode(localWhy === 'network');
    opts = opts || {};
    if (!isOpen()) {
      ui.panel.hidden = false;
      requestAnimationFrame(function () { ui.panel.classList.add('is-open'); });
      root.classList.add('aai-on');
      var fab = document.querySelector('.aai-fab'); if (fab) fab.setAttribute('aria-expanded', 'true');
      needKatex().then(retex).catch(function () { /* KaTeX ýok — formulalar tekst bolup galýar */ });
    }
    if (opts.quote) setQuote(opts.quote);
    if (typeof opts.text === 'string') { ui.input.value = opts.text; autosize(); }
    setTimeout(function () { ui.input.focus(); if (opts.select) ui.input.select(); }, 60);
    scrollEnd(true);
  }
  function close() {
    if (!isOpen()) return;
    ui.panel.classList.remove('is-open');
    root.classList.remove('aai-on');
    var fab = document.querySelector('.aai-fab'); if (fab) { fab.setAttribute('aria-expanded', 'false'); fab.focus(); }
    setTimeout(function () { if (!ui.panel.classList.contains('is-open')) ui.panel.hidden = true; }, reduceMotion() ? 0 : 220);
  }
  function toggle() { if (isOpen()) close(); else open(); }
  /* KaTeX soňra ýüklense, formulasy tekst bolup galan böleklerini täzeden çyzmak (söhbetiň galan ýerine degilmeýär) */
  function retex() {
    if (!ui) return;
    ui.log.querySelectorAll('.aai-md').forEach(function (el) { if (el._md && el.querySelector('.aai-tex')) el.innerHTML = renderMarkdown(el._md); });
  }
  /* aşaky gyra ýapyşmak: ulanyjy özi ýokaryk süýşürmese, täze mazmun gelende söhbet aşak süýşýär */
  var stick = true, userIntent = 0;
  function scrollEnd(force) {
    if (!ui) return;
    if (force) stick = true;
    if (stick) ui.log.scrollTop = ui.log.scrollHeight;
  }
  function watchScroll(L) {
    var mark = function () { userIntent = Date.now(); };
    L.addEventListener('wheel', mark, { passive: true });
    L.addEventListener('touchmove', mark, { passive: true });
    L.addEventListener('keydown', mark);
    L.addEventListener('scroll', function () {
      var d = L.scrollHeight - L.scrollTop - L.clientHeight;
      if (d < 48) stick = true; else if (Date.now() - userIntent < 800) stick = false;
    }, { passive: true });
  }

  function setQuote(text) {
    pending.quote = String(text || '').trim().slice(0, 1500);
    renderPending();
  }
  function addFiles(list) {
    var files = [].slice.call(list || []).slice(0, 3 - pending.images.length);
    files.forEach(function (f) {
      readImage(f).then(function (img) { if (pending.images.length < 3) { pending.images.push(img); renderPending(); } })
        .catch(function (e) { flash(e.message); });
    });
  }
  function renderPending() {
    var P2 = ui.pending, html = '';
    if (pending.quote) html += '<div class="aai-chip aai-chip-q"><span>«' + esc(pending.quote.length > 140 ? pending.quote.slice(0, 140) + '…' : pending.quote) + '»</span><button type="button" data-rm="q" aria-label="Aýyr">' + ICON.close + '</button></div>';
    pending.images.forEach(function (im, i) { html += '<div class="aai-chip aai-chip-img"><img src="' + im.thumb + '" alt="Goşulan surat ' + (i + 1) + '"><button type="button" data-rm="' + i + '" aria-label="Suraty aýyr">' + ICON.close + '</button></div>'; });
    P2.innerHTML = html; P2.hidden = !html;
    P2.querySelectorAll('[data-rm]').forEach(function (b) {
      b.addEventListener('click', function () { if (b.dataset.rm === 'q') pending.quote = ''; else pending.images.splice(+b.dataset.rm, 1); renderPending(); ui.input.focus(); });
    });
  }
  function flash(msg) {
    buildPanel();
    var n = h('div', { class: 'aai-flash', role: 'status', text: msg });
    ui.form.appendChild(n);
    setTimeout(function () { n.remove(); }, 4200);
  }

  /* --- habarlary görkezmek --- */
  function emptyState() {
    var s = suggestions(), user = currentUser();
    var el = h('div', { class: 'aai-empty' });
    el.innerHTML = '<p class="aai-hello">' + (user ? 'Salam, ' + esc(user) + '!' : 'Salam!') + ' Men Amatly AI.</p>' +
      (localMode
        ? '<p class="aai-lead">Meseläni ýazyň ýa-da sahypadaky islendik formulany saýlap «AI-dan sora» basyň. Her ädimi düşündirip, jogaby saýtyň öz hasaplaýyş motory bilen barlaýaryn.</p>' +
          '<p class="aai-local">' + ICON.engine + '<span><b>Amatly motory</b> işleýär: Claude API sazlanmady, şonuň üçin soraglara saýtyň öz hasaplaýyş motorlary jogap berýär — limit, önüm, integral, deňlemeler we deňsizlikler, ulgamlar, matrisalar, grafikler, simpleks, statistika, geometriýa. Her çözgüt ädimme-ädim we barlagly.</span></p>'
        : '<p class="aai-lead">Meseläni ýazyň, suratyny goşuň ýa-da sahypadaky islendik formulany saýlap «AI-dan sora» basyň. Her ädimi düşündirip, jogaby saýtyň öz hasaplaýyş motory bilen barlaýaryn.</p>' +
          '<div class="aai-tiles">' +
            '<button type="button" class="aai-tile" data-tile="photo"><b>Suratdan çöz</b><span>Depderdäki ýa-da kitapdaky meseläniň suratyny goşuň</span></button>' +
            '<button type="button" class="aai-tile" data-tile="mistake"><b>Ýalňyşymy tap</b><span>Öz çözgüdiňiziň suratyny goşuň — ýalňyş ädimi görkezerin</span></button>' +
          '</div>') +
      (s.length ? '<p class="aai-sub">Mysal soraglar</p><div class="aai-sugg">' + s.map(function (t) { return '<button type="button" class="aai-sg">' + esc(t) + '</button>'; }).join('') + '</div>' : '');
    el.querySelectorAll('.aai-sg').forEach(function (b) { b.addEventListener('click', function () { ask(b.textContent); }); });
    el.querySelectorAll('[data-tile]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.tile === 'mistake') { ui.input.value = 'Bu meni çözgüdim. Ýalňyş ädimi tapyp düşündiriň.'; autosize(); }
        else if (!ui.input.value) { ui.input.value = 'Suratdaky meseläni ädimme-ädim çözüň.'; autosize(); }
        ui.file.click();
      });
    });
    return el;
  }
  function userView(m, idx) {
    var el = h('div', { class: 'aai-msg aai-user' });
    var text = m.content.filter(function (b) { return b.type === 'text' && !/^<sahypa>|^<saylanan>/.test(b.text) && !/^\[(öňki surat|Ulanyjy surat iberdi)/.test(b.text); }).map(function (b) { return b.text; }).join('\n');
    var imgs = thumbs[idx] || [], q = quotes[idx];
    var html = '';
    if (q) html += '<div class="aai-q">«' + esc(q.length > 220 ? q.slice(0, 220) + '…' : q) + '»</div>';
    if (imgs.length) html += '<div class="aai-imgs">' + imgs.map(function (t) { return '<img src="' + t + '" alt="Iberilen surat">'; }).join('') + '</div>';
    else if (m.content.some(function (b) { return b.type === 'image' || (b.type === 'text' && /^\[Ulanyjy surat iberdi/.test(b.text)); })) html += '<div class="aai-imgs aai-imgs-gone">Surat</div>';
    html += '<div class="aai-bubble">' + esc(text).replace(/\n/g, '<br>') + '</div>';
    el.innerHTML = html;
    return el;
  }
  function AssistantView() {
    var el = h('div', { class: 'aai-msg aai-bot' });
    var body = h('div', { class: 'aai-body' });
    var status = h('div', { class: 'aai-status', hidden: true });
    el.appendChild(body); el.appendChild(status);
    var segs = {}, raw = [];
    var pendingRender = new Set();
    var flush = raf(function () { pendingRender.forEach(function (k) { var s = segs[k]; if (s) { s.el._md = s.text; s.el.innerHTML = renderMarkdown(s.text); } }); pendingRender.clear(); scrollEnd(); });
    var v = {
      el: el,
      setStatus: function (t) { if (t) { status.innerHTML = '<span class="aai-dots" aria-hidden="true"><i></i><i></i><i></i></span>' + esc(t); status.hidden = false; } else status.hidden = true; scrollEnd(); },
      text: function (key, t) {
        if (!segs[key]) { segs[key] = { el: h('div', { class: 'aai-md' }), text: '' }; body.appendChild(segs[key].el); }
        segs[key].text = t; pendingRender.add(key); flush();
      },
      finishText: function (key) { var s = segs[key]; if (s) { s.el._md = s.text; s.el.innerHTML = renderMarkdown(s.text); raw.push(s.text); } },
      tool: function (b) { var c = ToolCard(b); body.appendChild(c.el); scrollEnd(); return c; },
      /* bu jogaby Claude däl, saýtyň motory berdi */
      markLocal: function () {
        if (el.querySelector('.aai-by')) return;
        el.insertBefore(h('div', { class: 'aai-by', title: 'Bu jogaby saýtyň öz hasaplaýyş motorlary taýýarlady (Claude API ulanylmady)' }, ICON.engine + '<span>Amatly motory</span>'), body);
      },
      note: function (t, cls) { body.appendChild(h('p', { class: 'aai-note ' + (cls || ''), text: t })); scrollEnd(); },
      error: function (e, retry, query) {
        var box = h('div', { class: 'aai-error', role: 'alert' });
        box.innerHTML = ICON.warn + '<span>' + esc(explain(e)) + '</span>';
        if (query && e && (e.kind === 'not_configured' || e.kind === 'network')) siteHelp(query).then(function (links) {
          if (!links.length) return;
          var alt = h('div', { class: 'aai-alt' }, '<p>Şu wagt saýtyň bu sahypalary kömek edip biler:</p>');
          var ul = h('ul');
          links.forEach(function (l) { var li = h('li'); li.appendChild(h('a', { href: BASE + l.u, text: l.t })); if (l.h) li.appendChild(h('small', { text: l.h })); ul.appendChild(li); });
          alt.appendChild(ul); el.appendChild(alt); scrollEnd();
        });
        if (retry && e.name !== 'AbortError') {
          var rb = h('button', { type: 'button', class: 'aai-mini' }, ICON.retry + 'Täzeden synanyş');
          rb.addEventListener('click', function () { box.remove(); retry(); });
          box.appendChild(rb);
        }
        el.appendChild(box); scrollEnd();
      },
      actions: function () {
        var text = raw.join('\n\n').trim();
        if (!text || el.querySelector('.aai-acts')) return;
        var bar = h('div', { class: 'aai-acts' });
        var cp = h('button', { type: 'button', class: 'aai-mini', title: 'Jogaby göçür' }, ICON.copy + '<span>Göçür</span>');
        cp.addEventListener('click', function () {
          (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { cp.querySelector('span').textContent = 'Göçürildi'; setTimeout(function () { cp.querySelector('span').textContent = 'Göçür'; }, 1600); })
            .catch(function () { flash('Göçürip bolmady.'); });
        });
        bar.appendChild(cp); el.appendChild(bar);
      },
      rawText: function () { return raw.join('\n\n'); }
    };
    return v;
  }
  function ToolCard(b) {
    var names = { calculate: ['Hasaplama', 'Hasaplanýar…'], solve_steps: ['Amatly motory: ädimme-ädim çözgüt', 'Motor bilen çözülýär…'], solve_lp: ['Amatly motory: simpleks usuly', 'Simpleks bilen çözülýär…'], plot_graph: ['Grafik', 'Grafik çyzylýar…'] };
    var nm = names[b.name] || ['Gural', 'Işleýär…'];
    var tutorHide = (b.name === 'solve_steps' || b.name === 'solve_lp') && getMode() === 'tutor';
    var el = h('details', { class: 'aai-card aai-card-' + b.name + ' is-run' });
    if (!tutorHide) el.open = true;
    var sum = h('summary', {}, '<span class="aai-card-ic">' + ICON.spark + '</span><span class="aai-card-t">' + esc(nm[0]) + '</span><span class="aai-card-s">' + esc(nm[1]) + '</span>');
    var body = h('div', { class: 'aai-card-b' });
    el.appendChild(sum); el.appendChild(body);
    return {
      el: el,
      done: function (fill, state, isPlot) {
        el.classList.remove('is-run');
        el.classList.add(state === 'warn' ? 'is-warn' : 'is-ok');
        var s = sum.querySelector('.aai-card-s');
        s.innerHTML = state === 'warn' ? ICON.warn + 'Üns beriň' : (b.name === 'plot_graph' ? '' : ICON.check + (b.name === 'solve_steps' || b.name === 'solve_lp' ? 'Barlandy' : 'Taýýar'));
        if (tutorHide) s.innerHTML += '<em>Jogaby görmek üçin basyň</em>';
        if (isPlot) el.classList.add('is-plot');
        fill(body);
        scrollEnd();
      },
      fail: function (msg) {
        el.classList.remove('is-run'); el.classList.add('is-warn'); el.open = true;
        sum.querySelector('.aai-card-s').innerHTML = ICON.warn + 'Bolmady';
        body.innerHTML = '<p class="aai-err-t">' + esc(msg) + '</p>';
      }
    };
  }
  /* saklanan taryhdan gural kartlaryny täzeden görkezmek */
  function restoreTool(view, b, result) {
    var card = view.tool(b);
    var r = null; try { r = JSON.parse(result && result.content || 'null'); } catch (e) { r = null; }
    if (result && result.is_error) { card.fail(String(result.content || '').replace(/^Error:\s*/, '')); return; }
    if (b.name === 'plot_graph') {
      needMath().then(function (M) { var p = createPlot(M, b.input || {}); card.done(function (body) { body.appendChild(p.el); p.draw(); }, 'ok', true); })
        .catch(function (e) { card.fail(e.message); });
    } else if (b.name === 'calculate' && Array.isArray(r)) {
      card.done(function (body) {
        body.innerHTML = '<ul class="aai-calc">' + r.map(function (x) { return '<li><span class="aai-calc-e"><code>' + esc(x.expr) + '</code></span><span class="aai-calc-eq">' + (x.error ? '⚠' : '=') + '</span><span class="aai-calc-r">' + esc(x.error || x.result) + '</span></li>'; }).join('') + '</ul>';
      }, r.some(function (x) { return x.error; }) ? 'warn' : 'ok');
    } else if (b.name === 'solve_lp' && r && r.variables && r.constraints) {
      card.done(function (body) { body.innerHTML = lpCardHTML(r); }, r.status === 'optimal' && r.all_satisfied ? 'ok' : 'warn');
    } else if (b.name === 'solve_steps' && r) {
      card.done(function (body) {
        body.innerHTML = '<div class="aai-eng-q">' + esc(r.problem || '') + (r.answer ? ' = <b>' + esc(r.answer) + '</b>' : '') + '</div>' +
          (r.steps && r.steps.length ? '<ol class="aai-eng-steps">' + r.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' : '') +
          (r.error ? '<p class="aai-err-t">' + esc(r.error) + '</p>' : '');
      }, r.ok ? 'ok' : 'warn');
    } else card.fail('Netije saklanmandyr.');
  }
  function renderAll() {
    if (!ui) return;
    ui.log.innerHTML = '';
    if (!conv.length) { ui.log.appendChild(emptyState()); return; }
    var view = null, results = {};
    conv.forEach(function (m) { if (m.role === 'user') m.content.forEach(function (b) { if (b.type === 'tool_result') results[b.tool_use_id] = b; }); });
    conv.forEach(function (m, i) {
      if (isTextTurn(m)) { if (view) view.actions(); ui.log.appendChild(userView(m, i)); view = null; return; }
      if (m.role === 'assistant') {
        if (!view) { view = AssistantView(); ui.log.appendChild(view.el); }
        if (m._local) view.markLocal();
        m.content.forEach(function (b, k) {
          if (b.type === 'text' && b.text) { view.text(i + ':' + k, b.text); view.finishText(i + ':' + k); }
          else if (b.type === 'tool_use') restoreTool(view, b, results[b.id]);
        });
      }
    });
    if (view) view.actions();
    scrollEnd(true);
  }

  /* --- ugratmak we jogap almak --- */
  function newChat() {
    if (busy) stopNow();
    conv = []; thumbs = {}; quotes = {};
    store.del(chatKey());
    pending = { images: [], quote: '' };
    renderPending(); renderAll(); ui.input.focus();
  }
  function stopNow() { if (aborter) aborter.abort(); }
  function setBusy(on) {
    busy = on;
    ui.panel.classList.toggle('is-busy', on);
    ui.send.innerHTML = on ? ICON.stop : ICON.send;
    ui.send.setAttribute('aria-label', on ? 'Togtat' : 'Ugrat');
    ui.send.title = on ? 'Togtat' : 'Ugrat (Enter)';
    ui.log.setAttribute('aria-busy', on ? 'true' : 'false');
  }
  function submit(textArg) {
    var text = (typeof textArg === 'string' ? textArg : ui.input.value).trim();
    if (!text && !pending.images.length) { ui.input.focus(); return; }
    if (!text) text = 'Suratdaky meseläni ädimme-ädim çözüň.';
    var content = [];
    pending.images.forEach(function (im) { content.push({ type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } }); });
    content.push({ type: 'text', text: pageContext() });
    if (pending.quote) content.push({ type: 'text', text: '<saylanan>' + pending.quote.replace(/[<>]/g, '') + '</saylanan>' });
    content.push({ type: 'text', text: text });
    var idx = conv.length;
    if (pending.images.length) thumbs[idx] = pending.images.map(function (im) { return im.thumb; });
    if (pending.quote) quotes[idx] = pending.quote;
    conv.push({ role: 'user', content: content });
    if (ui.log.querySelector('.aai-empty')) ui.log.innerHTML = '';
    ui.log.appendChild(userView(conv[idx], idx));
    ui.input.value = ''; autosize();
    pending = { images: [], quote: '' }; renderPending();
    scrollEnd(true);
    run(idx);
  }
  /* Amatly motorynyň jogaby: abzaslar yzygider görkezilýär (formulalar we tablisalar hiç wagt ýarym çyzylmaýar) */
  function typeOut(view, keyBase, content, signal) {
    var p = Promise.resolve();
    content.forEach(function (b, i) {
      if (b.type !== 'text' || !b.text) return;
      p = p.then(function () {
        var key = keyBase + i;
        if (reduceMotion()) { view.text(key, b.text); view.finishText(key); return; }
        var parts = b.text.split(/\n{2,}/), n = 0, per = Math.max(1, Math.ceil(parts.length / 14));
        return new Promise(function (res, rej) {
          (function tick() {
            if (signal.aborted) { rej(abortErr()); return; }
            n = Math.min(parts.length, n + per);
            view.text(key, parts.slice(0, n).join('\n\n'));
            if (n >= parts.length) { view.finishText(key); res(); return; }
            setTimeout(tick, 70);
          })();
        });
      });
    });
    return p;
  }
  function run(turnIdx) {
    var view = AssistantView();
    ui.log.appendChild(view.el);
    setBusy(true);
    aborter = new AbortController();
    var signal = aborter.signal, hops = 0, local = false;
    view.setStatus('Pikirlenýär…');
    function viaApi() {
      return request(forSend(), signal).then(function (res) {
        var keyBase = conv.length + ':';
        return readStream(res, {
          start: function (i, b) {
            if (b.type === 'thinking' || b.type === 'redacted_thinking') view.setStatus('Pikirlenýär…');
            else if (b.type === 'text') view.setStatus('');
            else if (b.type === 'tool_use') view.setStatus({ calculate: 'Hasaplanýar…', plot_graph: 'Grafik taýýarlanýar…', solve_steps: 'Motor bilen çözülýär…', solve_lp: 'Simpleks bilen çözülýär…' }[b.name] || 'Işleýär…');
          },
          text: function (i, b) { view.text(keyBase + i, b.text); },
          thinking: function () { },
          stop: function (i, b) { if (b.type === 'text') view.finishText(keyBase + i); }
        });
      });
    }
    /* Amatly motory: soragy saýtyň hasaplaýyş motorlary bilen çözmek (jogap API-nyň görnüşinde: {content, stop}) */
    function viaLocal() {
      var keyBase = conv.length + ':';
      view.setStatus(hops ? 'Jogap taýýarlanýar…' : 'Amatly motory işleýär…');
      return needLocal().then(function (L) {
        if (!L) throw new Error('assets/ai/ai-local.js ýüklenmedi');
        return L.reply(conv, { base: BASE, mode: getMode(), page: pagePath(), load: loadScript, siteHelp: siteHelp, why: localWhy });
      }).then(function (r) {
        if (signal.aborted) throw abortErr();
        view.setStatus('');
        return typeOut(view, keyBase, r.content, signal).then(function () { return r; });
      });
    }
    function step() {
      if (local) return viaLocal().then(handle);
      return viaApi().then(handle, function (e) {
        /* API jogap bermedi (açar ýok, serwer ýok, internet ýok, çäk …): bu soraga Amatly motory jogap berýär */
        if (hops !== 0 || signal.aborted || !e || e.name === 'AbortError' || e.kind === 'bad_stream') throw e;
        local = true;
        if (lasting(e)) setLocal(true, e.kind || 'not_configured');
        else view.note('Claude API häzir elýeterli däl — bu jogaby Amatly motory berdi.', 'is-muted');
        view.markLocal();
        return viaLocal().then(handle);
      });
    }
    function handle(r) {
        var content = r.content.filter(function (b) { return !(b.type === 'text' && !b.text); });
        if (!content.some(function (b) { return b.type === 'text' || b.type === 'tool_use'; })) content.push({ type: 'text', text: '…' });
        var msg = { role: 'assistant', content: content };
        if (local) msg._local = 1;
        conv.push(msg);
        if (r.stop === 'tool_use' && ++hops <= MAX_HOPS) {
          var uses = content.filter(function (b) { return b.type === 'tool_use'; });
          view.setStatus('');
          return uses.reduce(function (p, b) {
            return p.then(function (acc) {
              var card = view.tool(b);
              var job = r.bad ? Promise.reject(new Error('Guralyň girizmesi okalmady.'))
                : b.name === 'calculate' ? toolCalculate(b.input, card)
                : b.name === 'plot_graph' ? toolPlot(b.input, card)
                : b.name === 'solve_steps' ? toolSolve(b.input, card)
                : b.name === 'solve_lp' ? toolLP(b.input, card)
                : Promise.reject(new Error('Näbelli gural: ' + b.name));
              return job.then(function (out) { acc.push({ type: 'tool_result', tool_use_id: b.id, content: out }); return acc; },
                function (e) { card.fail(e.message || String(e)); acc.push({ type: 'tool_result', tool_use_id: b.id, content: 'Error: ' + (e.message || e), is_error: true }); return acc; });
            });
          }, Promise.resolve([])).then(function (results) {
            if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
            conv.push({ role: 'user', content: results });
            view.setStatus('Jogap taýýarlanýar…');
            return step();
          });
        }
        if (r.stop === 'tool_use') view.note('Gural aýlawy çäge ýetdi — soragy gysgaldyp täzeden beriň.');
        if (r.stop === 'max_tokens') view.note('Jogap çäge ýetdi. Dowamyny almak üçin «dowam et» diýip ýazyň.');
        if (r.stop === 'refusal') view.note('Bu soraga jogap berip bilmeýärin.');
    }
    return checkMode().then(function () {
      if (localMode) { local = true; view.markLocal(); }
      return step();
    }).then(function () {
      view.setStatus(''); view.actions(); saveChat();
    }, function (e) {
      view.setStatus('');
      // ýarym galan aýlawy aýyrýarys: taryh ulanyjynyň soragy bilen gutarýar, "Täzeden synanyş" şondan dowam edýär
      conv.length = turnIdx + 1;
      if (e && e.name === 'AbortError') { view.note('Jogap togtadyldy.', 'is-muted'); saveChat(); return; }
      view.error(e, function () { view.el.remove(); run(turnIdx); }, lastUserText(turnIdx));
      saveChat();
    }).then(function () { setBusy(false); aborter = null; });
  }
  function lastUserText(i) {
    var m = conv[i];
    if (!m || !Array.isArray(m.content)) return '';
    return m.content.filter(function (b) { return b.type === 'text' && !/^<sahypa>|^<saylanan>/.test(b.text); }).map(function (b) { return b.text; }).join(' ');
  }
  /* saýt gözleginiň indeksinden (assets/nav/search-index.js) soraga ýakyn sahypalar: goşulmalar aýrylýar, umumy sözler taşlanýar,
     ýalňyş ýazylyşa (1 harp) çydamly */
  var STOP = ' nahili nadip name nama ucin bilen we hem bu su ol men sen biz siz how yok bar etmek etmeli edip tapmak tapmaly tapyn tapyň cozmek cozmeli cozun mysal mesele meselani maslahat beriň berin bolsa bolyar bolup gerek nadogry dogry harsi haysy nirede nace nache hasapla hasaplamak ';
  function stemTk(w) {
    var suf = ['larynyn', 'lerinin', 'lardan', 'lerden', 'larda', 'lerde', 'lary', 'leri', 'nyn', 'nin', 'yny', 'ini', 'dan', 'den', 'lar', 'ler', 'ny', 'ni', 'yn', 'in', 'da', 'de', 'na', 'ne', 'y', 'i', 'a', 'e'];
    for (var n = 0; n < 2; n++) {
      for (var i = 0; i < suf.length; i++) if (w.length - suf[i].length >= 4 && w.slice(-suf[i].length) === suf[i]) { w = w.slice(0, -suf[i].length); break; }
      if (i === suf.length) break;
    }
    return w;
  }
  function lev1(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, d = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++d > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return d + (a.length - i) + (b.length - j) <= 1;
  }
  function siteHelp(q) {
    var load = window.AMX_INDEX ? Promise.resolve() : loadScript('assets/nav/search-index.js');
    return load.then(function () {
      var M = { 'ä': 'a', 'ç': 'c', 'ö': 'o', 'ü': 'u', 'ž': 'z', 'ň': 'n', 'ş': 's', 'ý': 'y' };
      var norm = function (s) { return String(s).toLowerCase().replace(/[äçöüžňşý]/g, function (c) { return M[c]; }); };
      var toks = function (s) { return norm(s).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(function (w) { return w.length > 2; }); };
      var words = toks(q).filter(function (w) { return STOP.indexOf(' ' + w + ' ') === -1; }).map(stemTk);
      if (!words.length) return [];
      var seen = {};
      return (window.AMX_INDEX || []).map(function (e) {
        var title = toks(e[0]).map(stemTk), rest = toks(e[1] + ' ' + (e[3] || '')).map(stemTk), sc = 0, hits = 0;
        words.forEach(function (w) {
          var best = 0;
          [[title, 3], [rest, 1]].forEach(function (pair) {
            pair[0].forEach(function (t) {
              var v = t === w ? 1 : (w.length >= 4 && (t.indexOf(w) === 0 || w.indexOf(t) === 0) && Math.min(t.length, w.length) >= 4) ? 0.8 : (w.length >= 5 && lev1(w, t)) ? 0.6 : 0;
              best = Math.max(best, v * pair[1]);
            });
          });
          sc += best;
          if (best > 0) hits++;
        });
        return { s: sc + (hits > 1 ? 1.5 * (hits - 1) : 0), t: e[0], h: e[1], u: e[2] };
      }).filter(function (x) { return x.s >= 1; }).sort(function (a, b) { return b.s - a.s; })
        .filter(function (x) { var k = x.u.split('#')[0]; if (seen[k]) return false; seen[k] = 1; return true; }).slice(0, 4);
    }).catch(function () { return []; });
  }
  function ask(text, opts) {
    open(opts);
    if (busy) return;
    if (opts && opts.images) pending.images = opts.images.slice(0, 3);
    submit(String(text || ''));
  }

  /* ------------------------------------------------------------ sahypadaky teksti saýlap soramak */
  var chip = null, chipText = '';
  function selectionInfo() {
    var sel = window.getSelection && window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    var text = sel.toString().replace(/\s+/g, ' ').trim();
    if (text.length < 2 || text.length > 1500) return null;
    var node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
    if (!node || node.closest('.aai-panel, .amx-nav, input, textarea, [contenteditable], .aai-fab, dialog')) return null;
    var rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return null;
    return { text: text, rect: rect };
  }
  function showChip() {
    var info = selectionInfo();
    if (!info) { hideChip(); return; }
    if (!chip) {
      chip = h('button', { type: 'button', class: 'aai-askchip' }, ICON.mark + '<span>AI-dan sora</span>');
      chip.addEventListener('mousedown', function (e) { e.preventDefault(); });
      chip.addEventListener('click', function () {
        var t = chipText; hideChip();
        open({ quote: t, text: 'Şuny düşündiriň.', select: true });
      });
      document.body.appendChild(chip);
    }
    chipText = info.text;
    var top = info.rect.bottom + 8, left = Math.min(window.innerWidth - 150, Math.max(8, info.rect.left + info.rect.width / 2 - 60));
    if (top > window.innerHeight - 50) top = info.rect.top - 44;
    chip.style.top = Math.max(8, top) + 'px'; chip.style.left = left + 'px';
    chip.hidden = false;
  }
  function hideChip() { if (chip) chip.hidden = true; }
  var chipTimer = 0;
  document.addEventListener('selectionchange', function () { clearTimeout(chipTimer); chipTimer = setTimeout(showChip, 260); });
  window.addEventListener('scroll', hideChip, { passive: true });

  /* ------------------------------------------------------------ ýagdaý we barlag (Sazlamalar üçin) */
  function status() {
    var how = transport();
    if (how === 'direct') return Promise.resolve({ transport: 'direct', configured: true, model: store.get('amatly_ai_model') || P.model });
    if (how === 'none') return Promise.resolve({ transport: 'none', configured: false });
    return fetch(ENDPOINT, { method: 'GET', cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (r.ok && j && j.ok) return { transport: 'proxy', configured: !!j.configured, model: j.model || P.model, server: j.server || '' };
        return { transport: 'proxy', configured: false, missing: true };     // 404 ýa-da PHP işlemeýär (faýl tekst bolup gaýdýar)
      });
    }).catch(function () { return { transport: 'proxy', configured: false, missing: true }; });
  }
  function test() {
    var ac = new AbortController();
    var t = setTimeout(function () { ac.abort(); }, 45000);
    return request([{ role: 'user', content: [{ type: 'text', text: 'Diňe "Taýýar" diýip jogap beriň.' }] }], ac.signal, { max_tokens: 400 })
      .then(function (res) { return readStream(res, { start: function () { }, text: function () { }, thinking: function () { }, stop: function () { } }); })
      .then(function (r) { clearTimeout(t); var txt = r.content.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join(' ').trim(); return { ok: true, text: txt || '(jogap boş)' }; },
        function (e) { clearTimeout(t); return { ok: false, error: explain(e) }; });
  }

  /* synaglar üçin: solve_lp guralyny API-syz işletmek (kart ýok) */
  function lpDirect(input) { var c = { done: function () {}, fail: function () {} }; return toolLP(input, c).then(function (j) { return JSON.parse(j); }); }
  /* Sazlamalar üçin: Amatly motory işleýärmi (Claude API sazlanmadyk ýagdaýda) */
  function engineMode() { return checkMode(true).then(function (on) { return { local: !!on, why: localWhy }; }); }
  window.AmatlyAI = { open: open, close: close, ask: ask, status: status, test: test, transport: transport, explain: explain, readImage: readImage, renderMarkdown: renderMarkdown, mode: engineMode, _plot: createPlot, _lp: lpDirect, _lpCard: lpCardHTML };

  function init() {
    buildFab();
    if (/(^|[?&])ai=1(&|$)/.test(location.search)) open();
    try { document.dispatchEvent(new CustomEvent('amatly-ai-ready')); } catch (e) { /* köne brauzer */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
