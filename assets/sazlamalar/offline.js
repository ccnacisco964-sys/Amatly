/* Sazlamalar: «Programma we offline» kartasy — programma hökmünde gurmak, internetsiz açylýan sahypalar,
   «Ähli saýty ýükle» (sw.js habar bilen ýükleýär: assets/pwa/files.json) we offline faýllary pozmak. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = $('pwaState'), all = $('pwaAll'), clear = $('pwaClear'), inst = $('pwaInstall'), bar = $('pwaBar'), fill = $('pwaFill');
  if (!state || !all) return;
  var sc = document.querySelector('script[src*="assets/nav/nav.js"]');
  var base = sc ? sc.src.replace(/assets\/nav\/nav\.js.*$/, '') : new URL('../', location.href).href;
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var tm = 0, info = null, busy = false;
  function toast(t) { var e = $('setToast'); if (!e) return; e.textContent = t; e.hidden = false; clearTimeout(tm); tm = setTimeout(function () { e.hidden = true; }, 2800); }
  function mb(n) { return (n / 1048576).toFixed(1).replace('.', ',') + ' MB'; }
  function show(html, cls) { state.innerHTML = html; state.className = 'ai-state' + (cls ? ' ' + cls : ''); }

  /* programma hökmünde gurmak */
  function instUpd() { inst.hidden = !window.AmatlyInstall || standalone; }
  inst.addEventListener('click', function () {
    var e = window.AmatlyInstall;
    if (!e) return;
    e.prompt();
    e.userChoice.then(function (c) { window.AmatlyInstall = null; instUpd(); if (c && c.outcome === 'accepted') toast('Programma gurnalýar'); }, function () {});
  });
  document.addEventListener('amatly-installable', instUpd);
  document.addEventListener('amatly-installed', function () { instUpd(); toast('Amatly programma hökmünde gurnaldy'); });
  $('pwaIos').hidden = !(ios && !standalone);
  instUpd();

  if (!('serviceWorker' in navigator) || !('caches' in window)) { show('Bu brauzer offline görnüşini goldamaýar.', 'is-off'); all.hidden = true; return; }
  if (!/^https?:$/.test(location.protocol)) { show('Saýt faýldan açylanda offline görnüş işlemeýär: saýty hostingde ýa-da <code>npm run serve</code> bilen açyň.', 'is-off'); all.hidden = true; return; }
  if (window.isSecureContext === false) { show('Offline görnüşi üçin saýt howpsuz baglanyşyk (<code>https://</code>) bilen açylmaly.', 'is-off'); all.hidden = true; return; }
  var waited = Date.now();

  function count() {
    return caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return /^amatly-/.test(n); }).map(function (n) { return caches.open(n).then(function (c) { return c.keys(); }); }));
    }).then(function (groups) {
      var pages = {}, files = {};
      groups.forEach(function (g) {
        g.forEach(function (r) {
          var u = r.url.split('?')[0];
          if (/__amatly-offline-meta__$/.test(u)) return;
          files[u] = 1;
          if (/\.html$/.test(u) && !/\/(offline|404)\.html$/.test(u)) pages[u] = 1;
        });
      });
      return { pages: Object.keys(pages).length, files: Object.keys(files).length };
    });
  }
  function render() {
    if (busy) return;
    Promise.all([count(), caches.has('amatly-offline'), navigator.serviceWorker.getRegistration(base)]).then(function (r) {
      var c = r[0], full = r[1], reg = r[2];
      if (!reg) {
        all.disabled = true;
        if (Date.now() - waited < 8000) { show('Offline görnüşi taýýarlanýar…'); setTimeout(render, 2000); }
        else show('Offline görnüşi bu brauzerde işlemeýär (gizlin penjire ýa-da brauzeriň sazlamasy hyzmat işçilerini ýapýar).', 'is-off');
        return;
      }
      show((standalone ? '<b>Programma hökmünde açyk.</b> ' : '') +
        (full ? 'Ähli saýt ýüklendi: ' : '') + '<b>' + c.pages + '</b> sahypa internetsiz açylýar.' +
        (full ? ' Saýt täzelende üýtgän faýllar özi ýüklenýär.' : ' Beýleki sahypalar açanyňyzda ýatda saklanýar.'), 'is-on');
      all.disabled = false;
      all.textContent = full ? 'Täzelikleri ýükle' : 'Ähli saýty ýükle' + (info ? ' (' + mb(info.bytes) + ')' : '');
      clear.hidden = !c.files;
    }, function () { show('Offline ýagdaýyny okap bolmady.', 'is-off'); });
  }
  navigator.serviceWorker.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type === 'offline-progress') {
      busy = true; bar.hidden = false; all.disabled = true;
      var p = d.total ? Math.round(d.done / d.total * 100) : 0;
      fill.style.width = p + '%'; bar.setAttribute('aria-valuenow', String(p));
      show('Ýüklenýär: ' + d.done + ' / ' + d.total + ' faýl…');
    } else if (d.type === 'offline-done') {
      busy = false; bar.hidden = true; all.disabled = false;
      toast(d.failed < 0 ? 'Ýükläp bolmady — internet baglanyşygyny barlaň' : d.failed > 0 ? d.failed + ' faýl ýüklenmedi — soňrak täzeden synanyşyň' : 'Ähli saýt offline üçin ýüklendi');
      render();
    } else if (d.type === 'offline-cleared') { toast('Offline faýllar pozuldy'); render(); }
  });
  if (navigator.serviceWorker.startMessages) navigator.serviceWorker.startMessages();
  all.addEventListener('click', function () {
    all.disabled = true;
    navigator.serviceWorker.ready.then(function (reg) {
      if (!reg.active) { all.disabled = false; return; }
      busy = true; bar.hidden = false; fill.style.width = '0%';
      show('Ýüklenýär…');
      reg.active.postMessage({ type: 'offline-all' });
    });
  });
  clear.addEventListener('click', function () {
    navigator.serviceWorker.ready.then(function (reg) { if (reg.active) reg.active.postMessage({ type: 'offline-clear' }); });
  });
  fetch(base + 'assets/pwa/files.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { info = j; render(); }, render);
  navigator.serviceWorker.ready.then(render);
})();
