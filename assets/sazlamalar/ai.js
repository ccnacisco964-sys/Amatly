/* Sazlamalar → Amatly AI: ýagdaý, barlag, jogap režimi, öz API açaryňyz (diňe şu brauzerde), model, söhbetleri arassalamak */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = $('aiState'), out = $('aiOut');
  if (!state) return;
  function get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function set(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* ýok */ } }
  function say(t, cls) { out.textContent = t; out.className = 'ai-out' + (cls ? ' ' + cls : ''); out.hidden = !t; }
  function toast(t) { var e = $('setToast'); if (!e) return; e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { e.hidden = true; }, 2200); }

  // jogap režimi
  var mode = get('amatly_ai_mode') === 'tutor' ? 'tutor' : 'explain';
  document.querySelectorAll('input[name=aimode]').forEach(function (i) {
    i.checked = i.value === mode;
    i.addEventListener('change', function () { set('amatly_ai_mode', i.value); toast(i.value === 'tutor' ? 'Mugallym režimi saýlandy' : 'Düşündiriş režimi saýlandy'); });
  });
  // öz açaryňyz we model
  var key = $('aiKey'), model = $('aiModel');
  if (get('amatly_ai_key')) { key.placeholder = '•••• ýatda saklanan (' + get('amatly_ai_key').slice(-4) + ')'; $('aiKeyBox').open = true; }
  model.value = get('amatly_ai_model');
  model.addEventListener('change', function () { set('amatly_ai_model', model.value); toast('Model saýlandy'); refresh(); });
  $('aiKeySave').addEventListener('click', function () {
    var v = key.value.trim();
    if (!v) { say('Açary ýazyň ýa-da goýuň.', 'is-warn'); key.focus(); return; }
    if (!/^sk-ant-/.test(v)) say('Bellik: Anthropic açarlary adatça «sk-ant-» bilen başlaýar. Açary barlaň.', 'is-warn'); else say('');
    set('amatly_ai_key', v); key.value = ''; key.placeholder = '•••• ýatda saklanan (' + v.slice(-4) + ')';
    toast('API açary ýatda saklandy'); refresh();
  });
  $('aiKeyDel').addEventListener('click', function () { set('amatly_ai_key', ''); key.placeholder = 'sk-ant-…'; toast('API açary aýryldy'); refresh(); });
  $('aiClear').addEventListener('click', function () {
    var n = 0;
    try { Object.keys(localStorage).forEach(function (k) { if (/^amatly_ai_chat/.test(k)) { localStorage.removeItem(k); n++; } }); } catch (e) { /* ýok */ }
    toast(n ? 'AI söhbetleri arassalandy' : 'Arassalamaga söhbet ýok');
  });

  /* Amatly AI gerek bolanda ýüklenýär (nav.js: window.AmatlyAILoad) */
  function withAI(fn) {
    if (window.AmatlyAI) return fn(window.AmatlyAI);
    if (typeof window.AmatlyAILoad === 'function') { window.AmatlyAILoad().then(fn, function () { state.className = 'ai-state is-off'; state.textContent = 'Amatly AI faýllary ýüklenmedi. Sahypany täzeden açyň.'; }); return; }
    /* nav.js (defer) heniz işlemedik bolsa — sahypa doly okalandan soň täzeden synanyşýarys */
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function () { withAI(fn); }, { once: true }); return; }
    document.addEventListener('amatly-ai-ready', function () { fn(window.AmatlyAI); }, { once: true });
  }
  function refresh() {
    state.className = 'ai-state'; state.textContent = 'Ýagdaýy barlanýar…';
    withAI(function (AI) {
      AI.status().then(function (s) {
        var cls = 'is-off', t;
        if (s.transport === 'direct') { cls = 'is-on'; t = 'Öz API açaryňyz bilen işleýär (model: ' + s.model + ').'; }
        else if (s.transport === 'proxy' && s.configured) { cls = 'is-on'; t = 'Saýtyň serweri arkaly işleýär (model: ' + s.model + ').'; }
        else if (s.transport === 'proxy' && s.missing) t = 'Serwerde AI proksisi tapylmady (api/ai.php işlemeýär). Hosting PHP-ni goldaýan bolsa, api/ai-config.php faýlyny dolduryň; ýogsa aşakda öz API açaryňyzy goşuň.';
        else if (s.transport === 'proxy') t = 'Serwer taýýar, ýöne API açary goşulmandyr (api/ai-config.php). Ýa-da aşakda öz açaryňyzy goşuň.';
        else t = 'Saýt faýldan açyldy: AI işlemegi üçin aşakda öz API açaryňyzy goşuň ýa-da saýty serwer arkaly açyň.';
        if (cls === 'is-off') t += ' Häzir Amatly AI «Amatly motory» režiminde işleýär: matematika soraglaryna (limit, önüm, integral, deňlemeler, ulgamlar, grafikler, simpleks, statistika) saýtyň öz hasaplaýyş motorlary ädimme-ädim jogap berýär.';
        state.className = 'ai-state ' + cls; state.textContent = t;
        if (cls === 'is-off') $('aiKeyBox').open = true;
      });
    });
  }
  $('aiTest').addEventListener('click', function () {
    var b = this; b.disabled = true; say('Barlanýar… (birnäçe sekunt)');
    withAI(function (AI) {
      AI.test().then(function (r) {
        b.disabled = false;
        if (r.ok) say('✓ Amatly AI işleýär. Jogap: ' + r.text, 'is-ok'); else say(r.error, 'is-warn');
      });
    });
  });
  $('aiOpen').addEventListener('click', function () { withAI(function (AI) { AI.open(); }); });
  refresh();
})();
