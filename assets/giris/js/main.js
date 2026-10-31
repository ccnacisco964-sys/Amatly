/* Amatly.com — Baş sahypa.
 *  1) Hasap: girmek / hasaba durmak (saýtda diňe şu ýerde).
 *     • Hostingde api/account.php işleýän bolsa — hasap serwerde (assets/nav/account.js): islendik brauzerde we telefonda
 *       girip bolýar, sazlamalar enjamlaryň arasynda deňleşdirilýär. Öň diňe şu brauzerde açylan hasap bilen girilende
 *       ol serwere geçirilýär (şol at we parol bilen).
 *     • Serwer ýok bolsa (statik hosting, faýldan açylan saýt) — öňküsi ýaly şu brauzeriň localStorage-ynda ("users"),
 *       parol PBKDF2-SHA256 bilen (assets/giris/js/hash.js); öňki wersiýanyň SHA-256 hasaplary ilkinji girişde täzelenýär.
 *       Hasaby faýla göçürip, başga brauzerde «Hasap faýlyndan dikeltmek» bilen açyp bolýar.
 *     Oturym: "savedLogin" {username, token?} — "Meni ýatda sakla" bolsa localStorage, ýogsa sessionStorage
 *     (Söz meseleleri we Amatly AI şu ady okaýar).
 *     <body data-auth="required"> — giriş hökmany (penjire ýapylmaýar); "optional" — islege görä (deslapky).
 *     «Hasap» penjiresi: deňleşdirmek, serwere geçirmek, faýla göçürmek, paroly üýtgetmek, hasaby pozmak, çykmak.
 *  2) Gahryman bölümdäki sorag meýdany we mysallar → Amatly AI (assets/ai/ai.js).
 *  3) Soňky açylan sahypalar, Amatly AI-yň janly grafik mysaly.
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var USERS = 'users', SESSION = 'savedLogin';
  var H = window.AmatlyHash, A = window.AmatlyAccount || null;
  var required = document.body.getAttribute('data-auth') === 'required';

  function ls(st) { try { var s = st === 'session' ? window.sessionStorage : window.localStorage; var k = '__amatly_t__'; s.setItem(k, '1'); s.removeItem(k); return s; } catch (e) { return null; } }
  var LOCAL = ls('local'), SESS = ls('session');
  var memUsers = [], memSession = null;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function initial(name) { return name ? name.charAt(0).toLocaleUpperCase('tk') : ''; }
  function problem(code, message) { var e = new Error(message); e.code = code; return e; }

  /* ------------------------------------------------ ammar (ýerli hasaplar) */
  function getUsers() {
    if (!LOCAL) return memUsers;
    try { var a = JSON.parse(LOCAL.getItem(USERS) || '[]'); return Array.isArray(a) ? a.filter(function (u) { return u && typeof u.username === 'string'; }) : []; } catch (e) { return []; }
  }
  function saveUsers(list) { if (!LOCAL) { memUsers = list; return true; } try { LOCAL.setItem(USERS, JSON.stringify(list)); return true; } catch (e) { return false; } }
  /* oturym: assets/nav/account.js bar bolsa şol (serwer tokeni bilen), ýogsa şu ýerde */
  function getSession() {
    if (A) { var s = A.session(); return s ? s.username : null; }
    var stores = [LOCAL, SESS];
    for (var i = 0; i < stores.length; i++) {
      if (!stores[i]) continue;
      try { var s2 = JSON.parse(stores[i].getItem(SESSION) || 'null'); if (s2 && typeof s2.username === 'string' && s2.username.trim()) return s2.username.trim(); } catch (e) { /* ýok */ }
    }
    return memSession;
  }
  function onServer() { var s = A && A.session(); return !!(s && s.token); }
  function setSession(name, remember) {
    if (A) { A.setSession(name, null, remember); return; }
    clearSession();
    var st = remember ? LOCAL : SESS;
    if (st) { try { st.setItem(SESSION, JSON.stringify({ username: name })); return; } catch (e) { /* ýok */ } }
    memSession = name;
  }
  function clearSession() {
    if (A) { A.clearSession(); return; }
    [LOCAL, SESS].forEach(function (s) { if (s) try { s.removeItem(SESSION); } catch (e) { /* ýok */ } });
    memSession = null;
  }
  function findUser(list, name) {
    var n = name.toLowerCase();
    for (var i = 0; i < list.length; i++) if (list[i].username.toLowerCase() === n) return i;
    return -1;
  }
  function makeRecord(name, password) {
    var salt = H.randomHex(16), iter = H.ITER;
    return H.pbkdf2(password, salt, iter).then(function (hash) {
      return { username: name, algo: 'pbkdf2-sha256', iter: iter, salt: salt, hash: hash, created: new Date().toISOString() };
    });
  }
  /* paroly barlamak: täze (PBKDF2) we köne (SHA-256 / ätiýaçlyk) ýazgylar; köne ýazgy dogry bolsa täzelenýär */
  function verify(rec, password) {
    if (rec.algo === 'pbkdf2-sha256' && rec.salt && rec.hash) return H.pbkdf2(password, rec.salt, rec.iter || 210000).then(function (h) { return { ok: h === rec.hash }; });
    if (!rec.passHash) return Promise.resolve({ ok: false });
    return H.sha256hex(password).then(function (h) {
      var ok = h === rec.passHash || H.legacyWeak(password) === rec.passHash;
      return { ok: ok, upgrade: ok };
    });
  }
  /* şu brauzerdäki hasap: dogry bolsa {rec}, ýogsa null (at ýok bolsa-da şol wagt sarp edilýär) */
  function localCheck(name, pass) {
    var list = getUsers(), i = findUser(list, name);
    if (i < 0) return H.pbkdf2(pass, H.randomHex(16), H.ITER).then(function () { return null; });
    return verify(list[i], pass).then(function (r) {
      if (!r.ok) return null;
      var rec = list[i];
      if (!r.upgrade) return { rec: rec };
      return makeRecord(rec.username, pass).then(function (n) { n.created = rec.created || n.created; list[i] = n; saveUsers(list); return { rec: n }; });
    });
  }
  function dropLocal(name) { var list = getUsers(), i = findUser(list, name); if (i > -1) { list.splice(i, 1); saveUsers(list); } }
  function hasLocal(name) { return !!name && findUser(getUsers(), name) > -1; }
  /* serwerde hasaplar barmy (api/account.php) */
  var server = null;
  function serverReady() {
    if (!A) return Promise.resolve(false);
    return A.available().then(function (ok) { server = ok; renderNote(); return ok; });
  }

  /* ------------------------------------------------ interfeýs: hasap */
  var dlg = $('authDialog'), signIn = $('signInBtn'), userMenu = $('userMenu'), userBtn = $('userBtn'), pop = $('userPop');
  var loginForm = $('loginForm'), regForm = $('registerForm'), tabLogin = $('tabLogin'), tabReg = $('tabRegister');
  var toastEl = null, toastTimer = 0;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); }
    var host = document.querySelector('dialog[open]') || document.body;   /* açyk penjiräniň üstünde görünsin */
    if (toastEl.parentNode !== host) host.appendChild(toastEl);
    toastEl.textContent = msg;
    requestAnimationFrame(function () { toastEl.classList.add('show'); });
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, Math.max(2600, Math.min(9000, msg.length * 55)));
  }
  function renderUser() {
    var name = getSession();
    if (signIn) signIn.hidden = !!name;
    if (userMenu) userMenu.hidden = !name;
    if (name) {
      $('userName').textContent = name;
      $('userHello').textContent = name;
      $('userInitial').textContent = initial(name);
    }
    var hi = $('heroHi');
    if (hi) {
      if (name) { hi.innerHTML = 'Salam, <b>' + esc(name) + '</b>! Bu gün näme öwrenýäris?'; hi.hidden = false; } else hi.hidden = true;
    }
    setPop(false);
  }
  /* giriş penjiresiniň aşagyndaky bellik: hasap nirede saklanýar */
  function renderNote() {
    var n = $('authNote');
    if (!n) return;
    n.textContent = server
      ? 'Hasap Amatly.com serwerinde saklanýar: islendik brauzerde we telefonda girip bilersiňiz, sazlamalaryňyz we netijeleriňiz deňleşdirilýär. Parol diňe howpsuz baglanyşyk arkaly iberilýär we serwerde PBKDF2 bilen şifrlenip saklanýar.'
      : 'Hasap şu brauzerde saklanýar (serwer elýeterli däl). Parol açyk ýazylmaýar: PBKDF2 bilen şifrlenip saklanýar we hiç ýere iberilmeýär. Başga brauzerde ulanmak üçin «Hasap» penjiresinden faýla göçürip bilersiňiz.';
  }
  function setPop(open) {
    if (!pop || !userBtn) return;
    pop.hidden = !open; userBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { var f = pop.querySelector('a,button'); if (f) f.focus(); }
  }
  if (userBtn) userBtn.addEventListener('click', function (e) { e.stopPropagation(); setPop(pop.hidden); });
  document.addEventListener('click', function (e) { if (pop && !pop.hidden && !pop.contains(e.target)) setPop(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop && !pop.hidden) { setPop(false); userBtn.focus(); } });

  function showTab(which) {
    var login = which !== 'register';
    tabLogin.setAttribute('aria-selected', String(login)); tabReg.setAttribute('aria-selected', String(!login));
    tabLogin.tabIndex = login ? 0 : -1; tabReg.tabIndex = login ? -1 : 0;
    loginForm.hidden = !login; regForm.hidden = login;
    $('loginError').textContent = ''; $('registerError').textContent = '';
    setTimeout(function () { var f = $(login ? 'loginUser' : 'regUser'); if (f && !f.value) f.focus(); else if (login) $('loginPass').focus(); }, 30);
  }
  tabLogin.addEventListener('click', function () { showTab('login'); });
  tabReg.addEventListener('click', function () { showTab('register'); });
  [tabLogin, tabReg].forEach(function (t) {
    t.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); var to = t === tabLogin ? tabReg : tabLogin; showTab(to === tabLogin ? 'login' : 'register'); to.focus();
    });
  });
  function openAuth(which) {
    showTab(which || 'login');
    serverReady();
    if (dlg.open) return;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    dlg.classList.toggle('is-required', required && !getSession());
  }
  function closeAuth() { if (!dlg.open) return; if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }
  if (signIn) signIn.addEventListener('click', function () { openAuth('login'); });
  $('authClose').addEventListener('click', closeAuth);
  dlg.addEventListener('cancel', function (e) { if (required && !getSession()) e.preventDefault(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg && !(required && !getSession())) closeAuth(); });
  document.querySelectorAll('[data-auth-open]').forEach(function (b) { b.addEventListener('click', function () { openAuth(b.getAttribute('data-auth-open')); }); });

  document.querySelectorAll('.pass-eye').forEach(function (b) {
    b.addEventListener('click', function () {
      var inp = $(b.getAttribute('data-target')), show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      b.setAttribute('aria-pressed', String(show));
      b.setAttribute('aria-label', show ? 'Paroly gizle' : 'Paroly görkez');
    });
  });
  function strength(p) {
    var s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[a-zäçňöşüýž]/i.test(p) && /\d/.test(p)) s++;
    if (/[^\w\säçňöşüýž]/i.test(p) || (/[a-z]/.test(p) && /[A-Z]/.test(p))) s++;
    return p ? Math.max(1, s) : 0;
  }
  $('regPass').addEventListener('input', function () {
    var l = strength(this.value), m = $('passMeter');
    m.style.width = (l * 25) + '%'; m.setAttribute('data-l', String(l));
  });
  function fail(form, errEl, msg, field) {
    errEl.textContent = msg;
    form.querySelectorAll('[aria-invalid]').forEach(function (x) { x.removeAttribute('aria-invalid'); });
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
    form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
  }
  function busy(form, on) { var b = form.querySelector('.btn-solid'); b.disabled = on; b.setAttribute('aria-busy', String(on)); }
  function done(name, msg) {
    closeAuth(); renderUser(); toast(msg);
    document.dispatchEvent(new CustomEvent('amatly-login', { detail: { username: name, server: onServer() } }));
  }
  var NET = function (e) { return e && (e.code === 'network' || e.code === 'no_server'); };

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('loginError'), uEl = $('loginUser'), pEl = $('loginPass');
    var name = uEl.value.trim(), pass = pEl.value, remember = $('loginRemember').checked;
    if (!name) return fail(loginForm, err, 'Ulanyjy adyňyzy ýazyň.', uEl);
    if (!pass) return fail(loginForm, err, 'Paroly ýazyň.', pEl);
    busy(loginForm, true);
    function ok(user, msg) { busy(loginForm, false); loginForm.reset(); $('loginRemember').checked = true; done(user, msg); }
    function bad(msg) { busy(loginForm, false); fail(loginForm, err, msg, pEl); }
    /* şu brauzerdäki hasap bilen (serwer ýok ýa-da baglanyşyk ýok) */
    function local(srvErr) {
      return localCheck(name, pass).then(function (L) {
        if (!L) { bad(srvErr ? srvErr.message : 'Ulanyjy ady ýa-da parol nädogry.'); return; }
        setSession(L.rec.username, remember);
        ok(L.rec.username, 'Hoş geldiňiz, ' + L.rec.username + '!' + (srvErr ? ' Serwer bilen baglanyşyk ýok: hasap häzirlikçe diňe şu brauzerde.' : ''));
      });
    }
    serverReady().then(function (srv) {
      if (!srv) return local(null);
      return A.login(name, pass, remember).then(function (r) { ok(r.username, 'Hoş geldiňiz, ' + r.username + '!'); }, function (er) {
        if (NET(er)) return local(er);
        if (er.code !== 'bad_credentials') { bad(er.message); return; }
        /* serwerde ýok: şu brauzerdäki hasap bolsa — serwere geçirýäris */
        return localCheck(name, pass).then(function (L) {
          if (!L) { bad('Ulanyjy ady ýa-da parol nädogry.'); return; }
          return A.register(L.rec.username, pass, remember).then(function (r) {
            dropLocal(L.rec.username);
            ok(r.username, 'Hoş geldiňiz, ' + r.username + '! Hasabyňyz serwere geçirildi: indi islendik enjamda girip bilersiňiz.');
          }, function (er2) {
            setSession(L.rec.username, remember);
            ok(L.rec.username, er2.code === 'taken'
              ? 'Hoş geldiňiz! Bu at serwerde başga hasapda ulanylýar, şonuň üçin hasabyňyz diňe şu brauzerde işleýär.'
              : 'Hoş geldiňiz, ' + L.rec.username + '! Hasaby serwere geçirip bolmady: ' + er2.message);
          });
        });
      });
    }).catch(function () { bad('Näsazlyk ýüze çykdy. Sahypany täzeläp, täzeden synanyşyň.'); });
  });

  regForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('registerError'), uEl = $('regUser'), pEl = $('regPass'), p2El = $('regPass2');
    var name = uEl.value.trim().replace(/\s+/g, ' '), pass = pEl.value, remember = $('regRemember').checked;
    if (name.length < 3) return fail(regForm, err, 'Ulanyjy ady iň az 3 belgi bolmaly.', uEl);
    if (name.length > 24) return fail(regForm, err, 'Ulanyjy ady iň köp 24 belgi bolmaly.', uEl);
    if (!/^[\p{L}\p{N}_. -]+$/u.test(name)) return fail(regForm, err, 'Ulanyjy adynda diňe harplar, sanlar, aralyk we _ . - bolup biler.', uEl);
    if (pass.length < 6) return fail(regForm, err, 'Parol iň az 6 belgi bolmaly.', pEl);
    if (pass !== p2El.value) return fail(regForm, err, 'Parollar gabat gelmeýär.', p2El);
    busy(regForm, true);
    function ok(user, msg) { busy(regForm, false); regForm.reset(); $('regRemember').checked = true; $('passMeter').style.width = '0'; done(user, msg); }
    function local(note) {
      return makeRecord(name, pass).then(function (rec) {
        var list = getUsers();
        list.push(rec);
        if (!saveUsers(list)) throw new Error('save');
        setSession(name, remember);
        ok(name, 'Hasabyňyz döredildi. Hoş geldiňiz, ' + name + '!' + note);
      });
    }
    serverReady().then(function (srv) {
      if (hasLocal(name)) {
        busy(regForm, false);
        fail(regForm, err, srv ? 'Bu at şu brauzerde eýýäm bar. «Girmek» bölüminden giriň — hasabyňyz serwere geçiriler.' : 'Bu at eýýäm bar. Başga at saýlaň ýa-da «Girmek» bölümine geçiň.', uEl);
        return;
      }
      if (!srv) return local('');
      return A.register(name, pass, remember).then(function (r) { ok(r.username, 'Hasabyňyz döredildi. Hoş geldiňiz, ' + r.username + '!'); }, function (er) {
        if (NET(er)) return local(' Serwer bilen baglanyşyk ýok: hasap häzirlikçe diňe şu brauzerde (soňra girseňiz, serwere geçiriler).');
        busy(regForm, false);
        fail(regForm, err, er.message, er.code === 'taken' || /ady/i.test(er.message) ? uEl : pEl);
      });
    }).catch(function () { busy(regForm, false); fail(regForm, err, 'Hasaby saklap bolmady (brauzeriň ammary ýapyk bolmagy mümkin).'); });
  });

  /* çykmak: {all} — ähli enjamlardan (serwer), {clear} — şu enjamdaky sazlamalary arassalamak (umumy kompýuter) */
  function logout(o) {
    o = o || {};
    var name = getSession();
    var p = A ? A.logout(!!o.all) : Promise.resolve();
    clearSession();
    if (o.clear) p.then(function () { if (A) A.forgetDevice(name); });
    renderUser(); toast(o.clear ? 'Hasapdan çykdyňyz, şu enjamdaky sazlamalar arassalandy.' : 'Hasapdan çykdyňyz.');
    document.dispatchEvent(new CustomEvent('amatly-logout'));
    if (required) openAuth('login'); else if (signIn) signIn.focus();
    return p;
  }
  $('logoutBtn').addEventListener('click', function () { logout({}); });
  /* başga enjamda parol üýtgedilen ýa-da hasap pozulan bolsa (assets/nav/account.js) */
  document.addEventListener('amatly-logout', function (e) {
    if (!e.detail || e.detail.reason !== 'expired') return;
    renderUser(); closeAcct();
    toast('Giriş möhleti geçdi — hasabyňyza täzeden giriň.');
  });

  /* ------------------------------------------------ «Hasap» penjiresi */
  var acct = $('acctDialog');
  function closeAcct() { if (acct && acct.open) { if (typeof acct.close === 'function') acct.close(); else acct.removeAttribute('open'); } }
  function ago(t) {
    if (!t) return 'entek deňleşdirilmedi';
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 45) return 'hut şu wagt';
    if (s < 3600) return Math.round(s / 60) + ' minut öň';
    if (s < 86400) return Math.round(s / 3600) + ' sagat öň';
    var d = new Date(t), z = function (n) { return (n < 10 ? '0' : '') + n; };
    return z(d.getDate()) + '.' + z(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }
  function fillAcct() {
    var name = getSession(), srv = onServer();
    $('acctName').textContent = name || '';
    acct.querySelectorAll('.acct-user').forEach(function (x) { x.value = name || ''; });   /* parol dolandyryjylary üçin */
    $('acctInitial').textContent = initial(name);
    var badge = $('acctBadge');
    badge.textContent = srv ? 'serwerde — ähli enjamlarda' : 'diňe şu brauzerde';
    badge.classList.toggle('is-server', srv);
    $('acctSyncNow').hidden = !srv;
    $('acctExport').hidden = srv;
    $('outAllRow').hidden = !srv;
    $('acctMigrate').hidden = true;
    var t = $('acctSyncText');
    if (srv) {
      var st = A.state();
      t.textContent = 'Tema, harp ölçegi, oýun rekordlary, sapaklaryň ösüşi we türgenleşik netijeleri ähli enjamlaryňyzda deňleşdirilýär (AI açary we AI söhbetleri däl). Soňky deňleşdirme: ' + ago(st.last) + '.' +
        (st.state === 'offline' ? ' Häzir serwer bilen baglanyşyk ýok — baglanyşyk dikelende deňleşdiriler.' : st.state === 'error' && st.message ? ' ' + st.message : '') +
        (st.pending ? ' Iberilmedik üýtgeşiklik: ' + st.pending + '.' : '');
    } else {
      t.textContent = 'Hasap diňe şu brauzerde saklanýar. Başga brauzerde ýa-da telefonda ulanmak üçin «Hasaby faýla göçür» düwmesine basyň we şol faýly ol ýerde: Baş sahypa → Girmek → «Hasap faýlyndan dikeltmek».';
      if (hasLocal(name)) serverReady().then(function (ok) { $('acctMigrate').hidden = !ok; });
    }
  }
  function openAcct() {
    if (!acct || !getSession()) return;
    fillAcct();
    acct.querySelectorAll('.form-err').forEach(function (x) { x.textContent = ''; });
    if (typeof acct.showModal === 'function') acct.showModal(); else acct.setAttribute('open', '');
  }
  if (acct) {
    $('acctBtn').addEventListener('click', function () { setPop(false); openAcct(); });
    $('acctClose').addEventListener('click', closeAcct);
    acct.addEventListener('click', function (e) { if (e.target === acct) closeAcct(); });
    document.addEventListener('amatly-sync-status', function () { if (acct.open) fillAcct(); });
    $('acctSyncNow').addEventListener('click', function () {
      var b = this; b.disabled = true;
      A.sync({ force: true }).then(function (r) { b.disabled = false; fillAcct(); toast(r.changed && r.changed.length ? 'Deňleşdirildi: başga enjamdan ' + r.changed.length + ' sazlama geldi.' : 'Deňleşdirildi.'); },
        function (er) { b.disabled = false; fillAcct(); toast(er.message); });
    });
    /* ýerli hasaby faýla göçürmek (parolyň PBKDF2 hasaplamasy + sazlamalar) */
    $('acctExport').addEventListener('click', function () {
      var name = getSession(), list = getUsers(), i = findUser(list, name || '');
      if (i < 0) { toast('Bu brauzerde hasap ýazgysy tapylmady.'); return; }
      var data = {};
      try { Object.keys(localStorage).forEach(function (k) { if (A ? A.syncable(k, name) : /^(amatly|kalkulus_)/.test(k) && !/^amatly_ai_(key|chat)/.test(k)) data[k] = localStorage.getItem(k); }); } catch (e) { /* ýok */ }
      var u = list[i], file = { type: 'amatly-account', v: 1, exported: new Date().toISOString(), site: 'amatly.com',
        user: { username: u.username, algo: u.algo, iter: u.iter, salt: u.salt, hash: u.hash, passHash: u.passHash, created: u.created }, data: data };
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
      a.download = 'amatly-hasap-' + u.username.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-') + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      toast('Hasap faýla göçürildi. Faýly diňe özüňizde saklaň.');
    });
    /* ýerli hasaby serwere geçirmek */
    var mig = $('migrateForm');
    mig.addEventListener('submit', function (e) {
      e.preventDefault();
      var p = $('migPass'), err = $('migError'), name = getSession();
      if (!p.value) return fail(mig, err, 'Paroly ýazyň.', p);
      busy(mig, true);
      var remember = !!(A.session() || {}).remember;
      localCheck(name, p.value).then(function (L) {
        if (!L) throw problem('bad_password', 'Parol nädogry.');
        return A.register(L.rec.username, p.value, remember).then(function (r) { dropLocal(L.rec.username); return r; });
      }).then(function () {
        busy(mig, false); mig.reset(); fillAcct(); renderUser();
        toast('Hasabyňyz serwere geçirildi: indi islendik enjamda girip bilersiňiz.');
      }, function (er) {
        busy(mig, false);
        fail(mig, err, er.code === 'taken' ? 'Bu at serwerde başga hasapda ulanylýar. Çykyp, täze at bilen hasaba duruň.' : (er.message || 'Geçirip bolmady.'), p);
      });
    });
    /* paroly üýtgetmek */
    var pf = $('passForm');
    pf.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('passError'), o = $('pwOld'), n = $('pwNew'), n2 = $('pwNew2'), name = getSession(), srv = onServer();
      if (!o.value) return fail(pf, err, 'Häzirki paroly ýazyň.', o);
      if (n.value.length < 6) return fail(pf, err, 'Täze parol iň az 6 belgi bolmaly.', n);
      if (n.value !== n2.value) return fail(pf, err, 'Täze parollar gabat gelmeýär.', n2);
      busy(pf, true);
      (srv ? A.changePassword(o.value, n.value) : localCheck(name, o.value).then(function (L) {
        if (!L) throw problem('bad_password', 'Häzirki parol nädogry.');
        return makeRecord(L.rec.username, n.value).then(function (rec) {
          rec.created = L.rec.created || rec.created;
          var list = getUsers(), i = findUser(list, name);
          if (i > -1) list[i] = rec; else list.push(rec);
          if (!saveUsers(list)) throw problem('save', 'Paroly saklap bolmady.');
        });
      })).then(function () {
        busy(pf, false); pf.reset(); pf.closest('details').open = false;
        toast(srv ? 'Parol üýtgedildi. Beýleki enjamlarda täzeden girmeli bolar.' : 'Parol üýtgedildi.');
      }, function (er) { busy(pf, false); fail(pf, err, er.message || 'Paroly üýtgedip bolmady.', er.code === 'bad_password' ? o : n); });
    });
    /* hasaby pozmak */
    var df = $('delForm');
    df.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('delError'), p = $('delPass'), clear = $('delLocal').checked, name = getSession(), srv = onServer();
      if (!p.value) return fail(df, err, 'Paroly ýazyň.', p);
      busy(df, true);
      (srv ? A.deleteAccount(p.value) : localCheck(name, p.value).then(function (L) { if (!L) throw problem('bad_password', 'Parol nädogry.'); })).then(function () {
        dropLocal(name);
        if (clear && A) A.forgetDevice(name);
        clearSession();
        busy(df, false); df.reset(); closeAcct(); renderUser();
        toast('Hasabyňyz pozuldy.');
        document.dispatchEvent(new CustomEvent('amatly-logout'));
      }, function (er) { busy(df, false); fail(df, err, er.message || 'Hasaby pozup bolmady.', p); });
    });
    $('acctLogout').addEventListener('click', function () {
      var all = !$('outAllRow').hidden && $('outAll').checked, clear = $('outClear').checked;
      closeAcct();
      logout({ all: all, clear: clear });
      $('outAll').checked = false; $('outClear').checked = false;
    });
  }

  /* ------------------------------------------------ hasap faýlyndan dikeltmek (başga brauzerden göçürilen) */
  var impBtn = $('importAccBtn'), impFile = $('importAccFile');
  function importAccount(text) {
    var err = $('loginError'), o = null;
    try { o = JSON.parse(text); } catch (e) { o = null; }
    var u = o && o.type === 'amatly-account' && o.user;
    var good = u && typeof u.username === 'string' && /^[\p{L}\p{N}_. -]{3,24}$/u.test(u.username) &&
      ((u.algo === 'pbkdf2-sha256' && /^[0-9a-f]{32}$/.test(u.salt) && /^[0-9a-f]{64}$/.test(u.hash) && u.iter >= 1000 && u.iter <= 5000000) || (!u.algo && /^[0-9a-f]{64}$/.test(u.passHash || '')));
    if (!good) { fail(loginForm, err, 'Bu Amatly hasap faýly däl ýa-da faýl zaýalanypdyr.'); return; }
    var rec = u.algo ? { username: u.username, algo: u.algo, iter: u.iter, salt: u.salt, hash: u.hash } : { username: u.username, passHash: u.passHash };
    rec.created = typeof u.created === 'string' ? u.created : new Date().toISOString();
    var list = getUsers(), i = findUser(list, u.username);
    if (i > -1) list[i] = rec; else list.push(rec);
    if (!saveUsers(list)) { fail(loginForm, err, 'Hasaby saklap bolmady (brauzeriň ammary ýapyk bolmagy mümkin).'); return; }
    var n = 0;
    if (o.data && typeof o.data === 'object') Object.keys(o.data).forEach(function (k) {
      var v = o.data[k];
      if (typeof v !== 'string' || !(A ? A.syncable(k, u.username) : /^(amatly|kalkulus_)/.test(k) && !/^amatly_ai_(key|chat)/.test(k))) return;
      try { localStorage.setItem(k, v); n++; } catch (e) { /* ýer ýok */ }
    });
    if (window.AmatlyPrefs) window.AmatlyPrefs.apply();
    showTab('login');
    $('loginUser').value = u.username; $('loginPass').value = '';
    err.textContent = '';
    setTimeout(function () { $('loginPass').focus(); }, 60);
    toast('Hasap dikeldildi (' + n + ' sazlama). Indi parolyňyz bilen giriň.');
  }
  if (impBtn && impFile) {
    impBtn.addEventListener('click', function () { impFile.click(); });
    impFile.addEventListener('change', function () {
      var f = impFile.files && impFile.files[0]; impFile.value = '';
      if (!f) return;
      if (f.size > 4 * 1024 * 1024) { fail(loginForm, $('loginError'), 'Faýl örän uly — bu hasap faýly däl.'); return; }
      var r = new FileReader();
      r.onload = function () { importAccount(String(r.result)); };
      r.onerror = function () { fail(loginForm, $('loginError'), 'Faýly okap bolmady.'); };
      r.readAsText(f);
    });
  }

  renderUser();
  renderNote();
  if (required && !getSession()) openAuth('login');
  if (/(^|[?&])giris=(1|login|register)(&|$)/.test(location.search)) openAuth(/giris=register/.test(location.search) ? 'register' : 'login');
  else if (/(^|[?&])hasap=1(&|$)/.test(location.search) && getSession()) openAcct();
  /* giriş möhleti başga sahypada geçen bolsa */
  try {
    var rl = SESS && JSON.parse(SESS.getItem('amx_relogin') || 'null');
    if (rl && !getSession()) {
      SESS.removeItem('amx_relogin');
      openAuth('login');
      $('loginUser').value = rl.username || '';
      $('loginError').textContent = 'Giriş möhleti geçdi (parol başga enjamda üýtgedilen bolmagy mümkin). Täzeden giriň.';
    }
  } catch (e) { /* ýok */ }
  serverReady();

  /* ------------------------------------------------ gahryman: sorag meýdany → Amatly AI */
  var askForm = $('askForm'), askInput = $('askInput'), askFile = $('askFile'), askThumb = $('askThumb');
  var askImages = [];
  /* Amatly AI gerek bolanda ýüklenýär (nav.js: window.AmatlyAILoad) */
  function whenAI(fn) {
    if (window.AmatlyAI) { fn(window.AmatlyAI); return; }
    if (typeof window.AmatlyAILoad === 'function') { window.AmatlyAILoad().then(fn, function (e) { toast('Amatly AI ýüklenmedi: ' + e.message); }); return; }
    var done2 = false;
    document.addEventListener('amatly-ai-ready', function () { if (!done2 && window.AmatlyAI) { done2 = true; fn(window.AmatlyAI); } }, { once: true });
  }
  function grow() { askInput.style.height = 'auto'; askInput.style.height = Math.min(200, askInput.scrollHeight) + 'px'; }
  askInput.addEventListener('input', grow);
  askInput.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); askForm.requestSubmit ? askForm.requestSubmit() : askForm.dispatchEvent(new Event('submit', { cancelable: true })); } });
  $('askPhoto').addEventListener('click', function () { askFile.click(); });
  askFile.addEventListener('change', function () {
    var f = askFile.files && askFile.files[0]; askFile.value = '';
    if (!f) return;
    whenAI(function (AI) {
      AI.readImage(f).then(function (img) {
        askImages = [img];
        askThumb.innerHTML = '<img src="' + img.thumb + '" alt="Goşulan surat"><button type="button" aria-label="Suraty aýyr">×</button>';
        askThumb.hidden = false;
        askThumb.querySelector('button').addEventListener('click', function () { askImages = []; askThumb.hidden = true; askThumb.innerHTML = ''; askInput.focus(); });
        if (!askInput.value.trim()) { askInput.value = 'Suratdaky meseläni ädimme-ädim çözüň.'; grow(); }
        askInput.focus();
      }, function (err) { toast(err.message); });
    });
  });
  askForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = askInput.value.trim();
    if (!q && !askImages.length) { askInput.focus(); return; }
    var imgs = askImages.slice();
    whenAI(function (AI) {
      AI.ask(q || 'Suratdaky meseläni ädimme-ädim çözüň.', { images: imgs });
      askInput.value = ''; grow(); askImages = []; askThumb.hidden = true; askThumb.innerHTML = '';
    });
  });
  document.querySelectorAll('.ask-ex [data-q]').forEach(function (b) {
    b.addEventListener('click', function () { var q = b.getAttribute('data-q'); whenAI(function (AI) { AI.ask(q); }); });
  });

  /* ------------------------------------------------ Amatly AI: janly grafik mysaly (math.js gerek däl)
     AI faýllary diňe bu bölüm görünmäge ýakynlaşanda ýüklenýär (sahypanyň açylyşyny agyrlaşdyrmaz ýaly). */
  function nearView(el, fn) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); } }, { rootMargin: '300px 0px' });
    io.observe(el);
  }
  nearView($('demoPlot'), function () { whenAI(function (AI) {
    var box = $('demoPlot');
    if (!box || !AI._plot) return;
    var M = { compile: function (expr) { return { evaluate: function (sc) { return expr === 'a*sin(x)' ? sc.a * Math.sin(sc.x) : sc.x / 2; } }; } };
    try {
      var p = AI._plot(M, { functions: [{ expr: 'a*sin(x)', label: 'y = a·sin x' }, { expr: 'x/2', label: 'y = x/2' }], x_min: -10, x_max: 10, y_min: -4.6, y_max: 4.6, parameter: { name: 'a', min: 0.5, max: 4, value: 2.4, step: 0.1 } });
      box.appendChild(p.el); p.draw();
    } catch (err) { box.hidden = true; }
    var go = $('demoAsk');
    if (go) go.addEventListener('click', function () { AI.ask('y = 2·sin(x) we y = x/2 grafiklerini bir ýerde çyzyň we kesişme nokatlaryny tapyň.'); });
  }); });

  /* ------------------------------------------------ soňky açylan sahypalar (assets/nav/nav.js ýazýar; başga enjamdan hem gelip biler) */
  function renderRecent() {
    try {
      var r = JSON.parse(localStorage.getItem('amatly_recent') || '[]'), list = $('recentList'), sec = $('recentSec');
      r = (Array.isArray(r) ? r : []).filter(function (x) { return x && /^[a-z0-9_\-\/]+(\.html)?$/i.test(x.u) && typeof x.t === 'string'; }).slice(0, 4);
      if (!list || !sec) return;
      list.innerHTML = r.map(function (x) { return '<a href="' + esc(x.u) + '">' + esc(x.t) + '</a>'; }).join('');
      sec.hidden = !r.length;
    } catch (e) { /* ýok */ }
  }
  renderRecent();
  document.addEventListener('amatly-sync', function (e) { if (e.detail && e.detail.keys && e.detail.keys.indexOf('amatly_recent') > -1) renderRecent(); });
})();
