/* Amatly.com — hasap we enjamlaryň arasynda deňleşdirmek (window.AmatlyAccount).
 *
 * Hosting PHP-ni işledýän bolsa (api/account.php), hasap serwerde saklanýar: islendik brauzerde we telefonda girip
 * bolýar. Girilenden soň brauzeriň amatly* we kalkulus_* sazlamalary (tema, harp ölçegi, oýun rekordlary, Kalkulus
 * kursunyň ösüşi, Söz meseleleriniň netijeleri …) serwer bilen deňleşdirilýär. AI açary we AI söhbetleri hiç haçan
 * iberilmeýär. Serwer ýok bolsa (statik hosting, faýldan açylan saýt), Baş sahypa hasaby öňküsi ýaly brauzerde saklaýar.
 *
 * Her açar üçin «soňky üýtgeşiklik ýeňýär»: brauzer üýtgeşikligi tapan wagtyny (t) iberýär, serwer has täze wagtly
 * bahany saklaýar. Haçan deňleşdirilýär: sahypa açylanda (30 sekuntdan bir), 3 minutdan bir, tab-a gaýdyp gelnende we
 * sahypadan çykylanda (diňe üýtgeşiklik bar bolsa). Ýagdaý: localStorage "amx_sync" (açarlaryň hasaplamalary), oturym:
 * "savedLogin" = {username, token} — "Meni ýatda sakla" bolsa localStorage-da, ýogsa sessionStorage-da.
 * Wakalar: "amatly-sync" {keys} — başga enjamdan täze sazlama geldi; "amatly-sync-status" {state, message};
 * "amatly-logout" {reason:"expired"} — giriş möhleti geçdi (parol başga enjamda üýtgedildi ýa-da hasap pozuldy).
 */
(function () {
  'use strict';
  if (window.AmatlyAccount) return;
  var sc = document.querySelector('script[src*="assets/nav/account.js"]') || document.querySelector('script[src*="assets/nav/nav.js"]');
  var base = sc ? sc.src.replace(/assets\/nav\/(account|nav)\.js.*$/, '') : '';
  var API = base + 'api/account.php';
  var SESSION = 'savedLogin', META = 'amx_sync', OKC = 'amx_acc_ok', STATE = 'amx_sync_state';
  var VALUE_MAX = 100000, BATCH = 300;

  function storage(kind) { try { var s = kind === 'session' ? window.sessionStorage : window.localStorage; var k = '__amatly_t__'; s.setItem(k, '1'); s.removeItem(k); return s; } catch (e) { return null; } }
  var LOCAL = storage('local'), SESS = storage('session'), memSession = null;
  function readJSON(st, k) { if (!st) return null; try { return JSON.parse(st.getItem(k) || 'null'); } catch (e) { return null; } }
  function writeJSON(st, k, v) { if (!st) return false; try { st.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function noop() {}
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function err(code, message, status) { var e = new Error(message); e.code = code; e.status = status || 0; return e; }
  var enc = typeof TextEncoder === 'function' ? new TextEncoder() : null;
  function bytes(s) { return enc ? enc.encode(s).length : unescape(encodeURIComponent(s)).length; }
  /* FNV-1a: diňe üýtgeşikligi tapmak üçin (gizlinlik üçin däl) */
  function fnv(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); }
  function emit(name, detail) { try { document.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) { /* köne brauzer */ } }

  /* ------------------------------------------------ oturym */
  function session() {
    var pairs = [[LOCAL, true], [SESS, false]];
    for (var i = 0; i < pairs.length; i++) {
      var s = readJSON(pairs[i][0], SESSION);
      if (s && typeof s.username === 'string' && s.username.trim()) return { username: s.username.trim(), token: typeof s.token === 'string' ? s.token : null, remember: pairs[i][1] };
    }
    return memSession;
  }
  function clearSession() {
    [LOCAL, SESS].forEach(function (s) { if (s) try { s.removeItem(SESSION); } catch (e) { /* ýok */ } });
    memSession = null;
  }
  function setSession(username, token, remember) {
    clearSession();
    var v = { username: username };
    if (token) v.token = token;
    if (!writeJSON(remember ? LOCAL : SESS, SESSION, v) && !writeJSON(SESS || LOCAL, SESSION, v)) memSession = { username: username, token: token || null, remember: !!remember };
  }

  /* ------------------------------------------------ serwer */
  function fetchT(url, init, ms) {
    var ctl = typeof AbortController === 'function' && !init.keepalive ? new AbortController() : null;
    if (ctl) init.signal = ctl.signal;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, ms) : 0;
    return fetch(url, init).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  }
  var avail = null;
  /* serwerde hasaplar barmy? (jogap 5 minut ýatda saklanýar; baglanyşyk ýok bolsa ýatda saklanmaýar) */
  function available(force) {
    if (avail && !force) return avail;
    if (!/^https?:$/.test(location.protocol) || typeof fetch !== 'function') return (avail = Promise.resolve(false));
    var c = force ? null : readJSON(SESS, OKC);
    if (c && Date.now() - c.at < 300000) return (avail = Promise.resolve(!!c.ok));
    avail = fetchT(API, { method: 'GET', cache: 'no-store', credentials: 'same-origin' }, 6000).then(function (r) {
      var ct = r.headers.get('content-type') || '';
      var p = r.ok && ct.indexOf('json') > -1 ? r.json().then(function (j) { return !!(j && j.ok && j.accounts && j.protocol === 1); }, function () { return false; }) : Promise.resolve(false);
      return p.then(function (ok) { writeJSON(SESS, OKC, { ok: ok, at: Date.now() }); return ok; });
    }, function () { avail = null; return false; });
    return avail;
  }
  function call(action, body, opts) {
    opts = opts || {};
    body = body || {};
    body.action = action;
    return fetchT(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', credentials: 'same-origin' }, opts.timeout || 20000)
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try { j = JSON.parse(t); } catch (e) { /* JSON däl */ }
          if (!j || typeof j !== 'object') throw err('no_server', 'Hasap serweri jogap bermedi.', r.status);
          if (!r.ok || j.ok === false) throw err(j.error || 'http_' + r.status, j.message || 'Ýalňyşlyk (' + r.status + ').', r.status);
          return j;
        });
      }, function () { throw err('network', 'Serwer bilen baglanyşyk ýok. Internet baglanyşygyny barlap, täzeden synanyşyň.'); });
  }

  /* ------------------------------------------------ deňleşdirilýän açarlar */
  function syncable(k, user) {
    if (typeof k !== 'string' || !/^(amatly|kalkulus_)/.test(k) || /^amatly_ai_(key|chat)/.test(k) || /[\u0000-\u001f\u007f]/.test(k) || bytes(k) > 200) return false;
    var m = /^amatly\.soz\.score:(.+)$/.exec(k);           /* başga ulanyjynyň türgenleşik netijesi bu hasaba degişli däl */
    return !(m && (!user || m[1].toLowerCase() !== String(user).toLowerCase()));
  }
  function localKeys(user) {
    var out = [];
    if (!LOCAL) return out;
    try { for (var i = 0; i < LOCAL.length; i++) { var k = LOCAL.key(i); if (k && syncable(k, user)) out.push(k); } } catch (e) { /* ýok */ }
    return out;
  }
  function get(k) { try { return LOCAL.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { if (v === null) LOCAL.removeItem(k); else LOCAL.setItem(k, v); return true; } catch (e) { return false; } }
  function getMeta() { var m = readJSON(LOCAL, META); return m && typeof m === 'object' && m.h && m.d ? m : null; }
  function saveMeta(m) { writeJSON(LOCAL, META, m); }
  function sameUser(m, s) { return !!(m && m.user && s && m.user.toLowerCase() === s.username.toLowerCase() && m.epoch); }

  /* ýerli üýtgeşiklikleri tapmak: m.h — soňky deňleşdirilen baha, m.d — iberilmeli {h, t} ("-" — pozuldy) */
  function detect(m, user) {
    var now = Date.now(), seen = {};
    localKeys(user).forEach(function (k) {
      var v = get(k);
      if (v === null) return;
      seen[k] = 1;
      if (bytes(v) > VALUE_MAX) return;                      /* örän uly — deňleşdirilmeýär */
      var h = fnv(v);
      if (m.h[k] === h) { delete m.d[k]; return; }
      if (!m.d[k] || m.d[k].h !== h) m.d[k] = { h: h, t: now };
    });
    Object.keys(m.h).forEach(function (k) {
      if (seen[k] || !syncable(k, user)) return;
      if (!m.d[k] || m.d[k].h !== '-') m.d[k] = { h: '-', t: now };
    });
    Object.keys(m.d).forEach(function (k) { if (m.d[k].h === '-' && !own(m.h, k)) delete m.d[k]; });
  }
  function pending(m) {
    var ch = {}, n = 0;
    Object.keys(m.d).some(function (k) {
      var d = m.d[k], v = d.h === '-' ? null : get(k);
      if (d.h !== '-' && (v === null || fnv(v) !== d.h)) return false;     /* aralykda ýene üýtgedildi — indiki gezek */
      ch[k] = { v: v, t: d.t };
      return ++n >= BATCH;
    });
    return ch;
  }
  /* serweriň jogabyny ýerleşdirmek; üýtgän açarlaryň sanawy */
  function apply(m, sent, res, user) {
    var changed = [], rc = res.changes || {};
    Object.keys(sent).forEach(function (k) {
      if (own(rc, k) || !m.d[k]) return;
      var cur = get(k), d = m.d[k];
      if (sent[k].v === null) { if (cur === null) { delete m.h[k]; delete m.d[k]; } }
      else if (cur === sent[k].v) { m.h[k] = d.h; delete m.d[k]; }
    });
    Object.keys(rc).forEach(function (k) {
      if (!syncable(k, user)) return;
      var v = rc[k], cur = get(k);
      if (v !== null && typeof v !== 'string') return;
      var base = own(sent, k) ? (sent[k].v === null ? '-' : fnv(sent[k].v)) : (own(m.h, k) ? m.h[k] : '-');
      if ((cur === null ? '-' : fnv(cur)) !== base) return;    /* şu enjamda täze üýtgedildi — öz bahasy galýar */
      if (cur !== v && !put(k, v)) return;
      if (v === null) delete m.h[k]; else m.h[k] = fnv(v);
      delete m.d[k];
      if (cur !== v) changed.push(k);
    });
    return changed;
  }

  /* ilkinji gezek (ýa-da başga hasap): serweriň maglumaty ýeňýär; öň hiç bir hasaba degişli bolmadyk ýerli
     sazlamalar hasaba goşulýar, başga hasabyňky bolsa goşulmaýar */
  function firstSync(s, old) {
    var adopt = !old || !old.user;
    return call('sync', { token: s.token, since: 0, epoch: '', changes: {} }).then(function (res) {
      var m = { v: 1, user: s.username, epoch: res.epoch, rev: res.rev, h: {}, d: {}, at: 0 };
      var changed = [], rc = res.changes || {};
      Object.keys(rc).forEach(function (k) {
        var v = rc[k];
        if (!syncable(k, s.username) || (v !== null && typeof v !== 'string')) return;
        var cur = get(k);
        if (cur !== v && !put(k, v)) return;
        if (v !== null) m.h[k] = fnv(v);
        if (cur !== v) changed.push(k);
      });
      var now = Date.now();
      localKeys(s.username).forEach(function (k) {
        if (own(rc, k)) return;
        var v = get(k);
        if (v === null || bytes(v) > VALUE_MAX) return;
        if (adopt) m.d[k] = { h: fnv(v), t: now }; else m.h[k] = fnv(v);
      });
      saveMeta(m);
      return { m: m, changed: changed };
    });
  }
  function round(s, m, changed, n) {
    detect(m, s.username);
    var sent = pending(m);
    saveMeta(m);
    return call('sync', { token: s.token, since: m.rev, epoch: m.epoch, changes: sent }).then(function (res) {
      if (res.epoch !== m.epoch) return firstSync(s, null).then(function (st) { return round(s, st.m, changed.concat(st.changed), n + 1); });
      var c = apply(m, sent, res, s.username);
      m.rev = res.rev; m.at = Date.now();
      saveMeta(m);
      changed = changed.concat(c);
      if (n < 5 && Object.keys(sent).length && Object.keys(m.d).length) return round(s, m, changed, n + 1);
      return { changed: changed, pending: Object.keys(m.d).length };
    });
  }

  var running = null, retryAt = 0;
  function setState(state, message) {
    var st = { state: state, message: message || '', at: Date.now() };
    writeJSON(SESS, STATE, st);
    emit('amatly-sync-status', st);
  }
  function state() {
    var m = getMeta(), st = readJSON(SESS, STATE) || {};
    return { session: session(), last: m && m.at ? m.at : 0, pending: m ? Object.keys(m.d).length : 0, state: st.state || '', message: st.message || '' };
  }
  function expired(s) {
    var cur = session();
    if (cur && cur.token === s.token) {
      clearSession();
      writeJSON(SESS, 'amx_relogin', { username: s.username, at: Date.now() });
      emit('amatly-logout', { reason: 'expired', username: s.username });
    }
  }
  /* deňleşdirmek: {session} — çykylanda öňki oturym bilen */
  function sync(opts) {
    opts = opts || {};
    var s = opts.session || session();
    if (!s || !s.token || !LOCAL) return Promise.resolve({ skipped: true, changed: [] });
    if (running) return running;
    if (!opts.force && Date.now() < retryAt) return Promise.resolve({ skipped: true, changed: [] });
    setState('busy');
    var m = getMeta();
    running = (sameUser(m, s) ? Promise.resolve({ m: m, changed: [] }) : firstSync(s, m))
      .then(function (st) { return round(s, st.m, st.changed, 0); })
      .then(function (r) {
        running = null; retryAt = 0;
        setState(r.pending ? 'pending' : 'ok');
        if (r.changed.length) {
          if (window.AmatlyPrefs && r.changed.some(function (k) { return /^amatly_(theme|fs|motion)$/.test(k); })) window.AmatlyPrefs.apply();
          emit('amatly-sync', { keys: r.changed });
        }
        return r;
      }, function (e) {
        running = null;
        if (e.code === 'bad_token') { expired(s); setState('expired', e.message); }
        else if (e.code === 'network' || e.code === 'no_server') { retryAt = Date.now() + 60000; setState('offline', e.message); }
        else if (e.code === 'rate_limit') { retryAt = Date.now() + 300000; setState('error', e.message); }
        else { retryAt = Date.now() + 120000; setState('error', e.message); }
        throw e;
      });
    return running;
  }
  /* sahypadan çykylanda: üýtgeşiklik bar bolsa keepalive bilen iberilýär (jogaby garaşylmaýar — indiki deňleşdirme barlaýar) */
  function flush() {
    var s = session(), m = getMeta();
    if (!s || !s.token || !sameUser(m, s) || running) return;
    detect(m, s.username);
    var sent = pending(m);
    saveMeta(m);
    if (!Object.keys(sent).length) return;
    var body = JSON.stringify({ action: 'sync', token: s.token, since: m.rev, epoch: m.epoch, changes: sent });
    if (body.length > 60000) return;                          /* keepalive çägi — indiki sahypada iberiler */
    try { fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true, credentials: 'same-origin' }).catch(noop); } catch (e) { /* ýok */ }
  }
  var started = false;
  function auto() {
    if (started) return;
    started = true;
    var fresh = function () { var m = getMeta(); return m && m.at && Date.now() - m.at < 30000; };
    var s = session();
    if (s && s.token && !fresh()) sync().catch(noop);
    setInterval(function () { if (document.visibilityState === 'visible') sync().catch(noop); }, 180000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush(); else if (!fresh()) sync().catch(noop);
    });
    window.addEventListener('pagehide', flush);
    window.addEventListener('online', function () { retryAt = 0; sync().catch(noop); });
  }

  /* ------------------------------------------------ hasap amallary (Baş sahypa) */
  function enter(r, remember) {
    setSession(r.username, r.token, remember);
    auto();
    return sync({ force: true }).then(function () { return r; }, function () { return r; });
  }
  function login(username, password, remember) { return call('login', { username: username, password: password }).then(function (r) { return enter(r, remember); }); }
  function register(username, password, remember) { return call('register', { username: username, password: password }).then(function (r) { return enter(r, remember); }); }
  /* çykmak: soňky üýtgeşiklikler iberilýär, soň şu enjamyň tokeni ýatyrylýar (all — ähli enjamlaryňky) */
  function logout(all) {
    var s = session();
    clearSession();
    if (!s || !s.token) return Promise.resolve();
    return sync({ session: s, force: true }).catch(noop).then(function () { return call('logout', { token: s.token, all: !!all }, { timeout: 8000 }).catch(noop); });
  }
  function me() { var s = session(); return s && s.token ? call('me', { token: s.token }) : Promise.reject(err('no_session', 'Hasaba girilmedi.')); }
  function changePassword(password, next) {
    var s = session();
    if (!s || !s.token) return Promise.reject(err('no_session', 'Hasaba girilmedi.'));
    return call('password', { token: s.token, password: password, new_password: next }).then(function (r) { setSession(s.username, r.token, s.remember); return r; });
  }
  function deleteAccount(password) {
    var s = session();
    if (!s || !s.token) return Promise.reject(err('no_session', 'Hasaba girilmedi.'));
    return call('delete', { token: s.token, password: password }).then(function (r) {
      clearSession();
      try { LOCAL.removeItem(META); } catch (e) { /* ýok */ }
      return r;
    });
  }
  /* şu enjamdaky deňleşdirilen sazlamalary arassalamak (umumy kompýuterde çykanyňyzda) */
  function forgetDevice(user) {
    var m = getMeta();
    localKeys(user || (m && m.user) || '').forEach(function (k) { put(k, null); });
    try { LOCAL.removeItem(META); } catch (e) { /* ýok */ }
    if (window.AmatlyPrefs) window.AmatlyPrefs.apply();
  }

  window.AmatlyAccount = {
    api: API, available: available, session: session, setSession: setSession, clearSession: clearSession,
    login: login, register: register, logout: logout, me: me, changePassword: changePassword, deleteAccount: deleteAccount,
    sync: sync, flush: flush, auto: auto, state: state, forgetDevice: forgetDevice, syncable: syncable,
    _fnv: fnv, _detect: detect, _apply: apply
  };
  var s0 = session();
  if (s0 && s0.token) auto();
})();
