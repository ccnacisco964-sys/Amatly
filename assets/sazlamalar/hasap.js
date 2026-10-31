/* Sazlamalar: «Hasap we enjamlar» kartasy — hasap nirede saklanýar (serwerde ýa-da diňe şu brauzerde), soňky
   deňleşdirme we «Indi deňleşdir». Giriş, çykyş we paroly üýtgetmek diňe Baş sahypada (Hasap penjiresi).
   assets/nav/account.js-i nav.js ýükleýär (<body data-account>). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var box = $('acctState'), syncBtn = $('acctSync'), manage = $('acctManage');
  if (!box || !syncBtn || !manage) return;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function A() { return window.AmatlyAccount || null; }
  function stored() {
    var out = null;
    [function () { return localStorage; }, function () { return sessionStorage; }].some(function (g) {
      try { var s = JSON.parse(g().getItem('savedLogin') || 'null'); if (s && typeof s.username === 'string' && s.username.trim()) { out = { username: s.username.trim(), token: s.token || null }; return true; } } catch (e) { /* ýok */ }
      return false;
    });
    return out;
  }
  function ago(t) {
    if (!t) return 'entek deňleşdirilmedi';
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 45) return 'hut şu wagt';
    if (s < 3600) return Math.round(s / 60) + ' minut öň';
    if (s < 86400) return Math.round(s / 3600) + ' sagat öň';
    var d = new Date(t), z = function (n) { return (n < 10 ? '0' : '') + n; };
    return z(d.getDate()) + '.' + z(d.getMonth() + 1) + '.' + d.getFullYear();
  }
  var tm = 0;
  function toast(t) { var e = $('setToast'); if (!e) return; e.textContent = t; e.hidden = false; clearTimeout(tm); tm = setTimeout(function () { e.hidden = true; }, 2600); }
  function render() {
    var s = (A() && A().session()) || stored();
    box.className = 'ai-state';
    if (!s) {
      box.innerHTML = 'Hasaba girmediňiz. Girseňiz, tema, harp ölçegi, oýun rekordlary, sapaklaryň ösüşi we türgenleşik netijeleri ähli enjamlaryňyzda (kompýuter, telefon) deňleşdirilýär.';
      manage.textContent = 'Baş sahypada girmek'; manage.href = '../index.html?giris=1';
      syncBtn.hidden = true;
      return;
    }
    manage.textContent = 'Hasaby dolandyrmak'; manage.href = '../index.html?hasap=1';
    if (!s.token) {
      box.innerHTML = '<b>' + esc(s.username) + '</b> — hasap diňe şu brauzerde saklanýar. Başga enjamda ulanmak üçin ony serwere geçiriň ýa-da faýla göçüriň: Baş sahypa → adyňyz → «Hasap we deňleşdirmek».';
      box.classList.add('is-off');
      syncBtn.hidden = true;
      return;
    }
    var st = A() ? A().state() : { last: 0, state: '', pending: 0 };
    box.innerHTML = '<b>' + esc(s.username) + '</b> — hasap serwerde: sazlamalaryňyz ähli enjamlaryňyzda deňleşdirilýär (AI açary we AI söhbetleri däl). Soňky deňleşdirme: ' + ago(st.last) + '.' +
      (st.state === 'offline' ? ' Häzir serwer bilen baglanyşyk ýok — baglanyşyk dikelende deňleşdiriler.' : st.state === 'error' && st.message ? ' ' + esc(st.message) : '') +
      (st.pending ? ' Iberilmedik üýtgeşiklik: ' + st.pending + '.' : '');
    box.classList.add(st.state === 'offline' || st.state === 'error' ? 'is-off' : 'is-on');
    syncBtn.hidden = !A();
  }
  syncBtn.addEventListener('click', function () {
    if (!A()) return;
    syncBtn.disabled = true;
    A().sync({ force: true }).then(function (r) {
      syncBtn.disabled = false; render();
      toast(r.changed && r.changed.length ? 'Deňleşdirildi: başga enjamdan ' + r.changed.length + ' sazlama geldi' : 'Deňleşdirildi');
    }, function (e) { syncBtn.disabled = false; render(); toast(e.message); });
  });
  ['amatly-account-ready', 'amatly-sync-status', 'amatly-sync', 'amatly-logout'].forEach(function (ev) { document.addEventListener(ev, render); });
  setInterval(render, 30000);
  render();
})();
