/* ==========================================================================
   Amatly.com — Simpleks usuly sahypasynyň interfeýsi (amal-barlagy/simpleks.html).
   Hasaplamalary simplex-engine.js (window.AmatlySimplex, math.js bilen) edýär; bu faýl diňe
   girizmäni okaýar we netijäni görkezýär: kanoniki görnüş, simpleks tablisalar, jogap,
   grafiki usul (iki üýtgeýän) we ikilenji mesele.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STORE = 'amatly_simpleks_v1';
  const S = window.AmatlySimplex;

  /* ------------------------------------------------------------------ mysallar */
  const PRESETS = [
    {
      id: 'onumcilik', title: 'Önümçilik meýilnamasy (max)',
      story: 'Fabrik iki önüm öndürýär: A (x₁ sany) we B (x₂ sany). Bir A-dan 3, bir B-den 5 müň manat girdeji gelýär. 1-nji seh hepdede 4 sagat, 2-nji seh 12 sagat, 3-nji seh 18 sagat işläp bilýär. A önüm 1-nji sehde 1 sagat we 3-nji sehde 3 sagat, B önüm 2-nji sehde 2 sagat we 3-nji sehde 2 sagat talap edýär. Iň köp girdeji üçin näçe A we näçe B öndürmeli?',
      text: 'max Z = 3x1 + 5x2\nx1 <= 4\n2x2 <= 12\n3x1 + 2x2 <= 18',
    },
    {
      id: 'iymit', title: 'Iň arzan iýmit (min, ≥)',
      story: 'Mal iými iki görnüş ýemden düzülýär: x₁ we x₂ kilogram. 1 kg 1-nji ýem 2 manat, 2-nji ýem 3 manat durýar. Iýmde azyndan 4 birlik belok we 6 birlik witamin bolmaly: 1 kg 1-nji ýemde 1 birlik belok we 1 birlik witamin, 2-nji ýemde 1 birlik belok we 3 birlik witamin bar. Iň arzan iými tapyň.',
      text: 'min Z = 2x1 + 3x2\nx1 + x2 >= 4\nx1 + 3x2 >= 6',
    },
    {
      id: 'uc', title: 'Üç üýtgeýän',
      story: 'Üç üýtgeýänli mesele: grafiki usul bilen çözüp bolmaýar, simpleks usuly bolsa islendik sanly üýtgeýän üçin işleýär.',
      text: 'max Z = 5x1 + 4x2 + 3x3\n2x1 + 3x2 + x3 <= 5\n4x1 + x2 + 2x3 <= 11\n3x1 + 4x2 + 2x3 <= 8',
    },
    {
      id: 'garysyk', title: 'Garyşyk çäklendirmeler (=, ≥, ≤)',
      story: 'Deňlik we «≥» çäklendirmeler üçin emeli üýtgeýänler gerek. Ikinji çäklendirmäniň sag tarapy otrisatel — ony −1-e köpeldip başlaýarys. M-usulyny we iki tapgyrly usuly deňeşdirip görüň.',
      text: 'min Z = 2x1 + x2\nx1 + x2 = 4\nx1 - x2 >= -2\nx1 <= 3',
    },
    {
      id: 'alternatiw', title: 'Alternatiw optimum',
      story: 'Maksat funksiýasynyň derejeli çyzygy bir çäklendirmä parallel: optimal çözgüt ýeke-täk däl.',
      text: 'max Z = 2x1 + 4x2\nx1 + 2x2 <= 5\nx1 + x2 <= 4',
    },
    {
      id: 'caksiz', title: 'Çäksiz çözgüt',
      story: 'Mümkin çözgütleriň ýaýlasy çäksiz we Z şol ugurda çäksiz ösýär: optimal çözgüt ýok.',
      text: 'max Z = x1 + x2\nx1 - x2 <= 1\n-x1 + x2 <= 2',
    },
    {
      id: 'yok', title: 'Mümkin çözgüt ýok',
      story: 'x₁ + x₂ bir wagtda 2-den kiçi we 5-den uly bolup bilmez: çäklendirmeler ylalaşyksyz.',
      text: 'max Z = x1 + x2\nx1 + x2 <= 2\nx1 + x2 >= 5',
    },
  ];

  /* ------------------------------------------------------------------ format */
  let numMode = 'frac';
  const ord = (n) => S.ordinal(n);
  const minus = (s) => s.replace(/-/g, '−');

  function fmtF(f) {
    if (numMode === 'dec') {
      const v = Math.round(f.valueOf() * 10000) / 10000;
      return minus(String(Object.is(v, -0) ? 0 : v));
    }
    return minus(f.toFraction());
  }
  /* takyk drob + onluk takmyny (jogaplarda) */
  function fmtBoth(f) {
    const exact = minus(f.toFraction());
    if (exact.indexOf('/') < 0) return exact;
    const v = Math.round(f.valueOf() * 10000) / 10000;
    const dec = minus(String(v));
    return numMode === 'dec' ? dec + ' <span class="sx-muted">(' + exact + ')</span>' : exact + ' <span class="sx-muted">≈ ' + dec + '</span>';
  }
  function fmtM(v) {
    if (S.isZero(v.m)) return fmtF(v.r);
    let t = v.m.equals(1) ? 'M' : v.m.equals(-1) ? '−M' : fmtF(v.m) + 'M';
    if (!S.isZero(v.r)) t += (S.sign(v.r) < 0 ? ' − ' : ' + ') + fmtF(v.r.abs());
    return t;
  }
  function vn(name) {
    const m = /^([A-Za-z]+)_?(\d+)$/.exec(name);
    return m ? '<i>' + esc(m[1]) + '</i><sub>' + m[2] + '</sub>' : '<i>' + esc(name) + '</i>';
  }
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  function vt(name) {
    const m = /^([A-Za-z]+)_?(\d+)$/.exec(name);
    return m ? m[1] + m[2].split('').map((d) => SUB[+d]).join('') : name;
  }
  const OP = { '<=': '≤', '>=': '≥', '=': '=' };

  function coefTerm(f, name, first) {
    const neg = S.sign(f) < 0, ab = f.abs();
    let k = ab.equals(1) ? '' : fmtF(ab);
    if (/[/.]/.test(k)) k += '·';
    return (first ? (neg ? '−' : '') : (neg ? ' − ' : ' + ')) + k + vn(name);
  }
  function linHTML(a, names, keepZero) {
    let s = '';
    a.forEach((f, j) => {
      if (S.isZero(f) && !keepZero) return;
      if (S.isZero(f)) { s += (s ? ' + ' : '') + '0·' + vn(names[j]); return; }
      s += coefTerm(f, names[j], !s);
    });
    return s || '0';
  }
  function mTerm(v, name) {
    /* −M·a ýa-da +M·a */
    const neg = S.sign(v.m) < 0;
    return (neg ? ' − ' : ' + ') + 'M·' + vn(name);
  }
  function pointHTML(vals) { return '(' + vals.map(fmtF).join('; ') + ')'; }

  /* ------------------------------------------------------------------ ýagdaý */
  let mode = 'text';
  let last = null;           // { problem, result }
  let presetId = null;

  function store(obj) { try { localStorage.setItem(STORE, JSON.stringify(obj)); } catch (e) { /* hökman däl */ } }
  function restore() { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; } }

  function showError(msg) {
    const box = $('errorBox');
    if (!msg) { box.hidden = true; box.textContent = ''; return; }
    box.textContent = msg;
    box.hidden = false;
  }

  /* ------------------------------------------------------------------ tablisa girizmesi */
  function readGrid() {
    const wrap = $('lpTableWrap');
    const n = +wrap.dataset.n || 0, m = +wrap.dataset.m || 0;
    const val = (sel) => { const el = wrap.querySelector(sel); return el ? el.value : ''; };
    const c = [], rows = [];
    for (let j = 0; j < n; j++) c.push(val('[data-c="' + j + '"]'));
    for (let i = 0; i < m; i++) {
      const a = [];
      for (let j = 0; j < n; j++) a.push(val('[data-a="' + i + ',' + j + '"]'));
      rows.push({ a, op: val('[data-op="' + i + '"]') || '<=', b: val('[data-b="' + i + '"]') });
    }
    const sense = (document.querySelector('input[name="lpSense"]:checked') || {}).value || 'max';
    return { sense, c, rows };
  }

  function buildGrid(n, m, data) {
    n = Math.max(1, Math.min(S.LIMITS.vars, n | 0));
    m = Math.max(1, Math.min(S.LIMITS.cons, m | 0));
    $('nVars').value = n; $('nCons').value = m;
    const old = data || ($('lpTableWrap').dataset.n ? readGrid() : null);
    const get = (arr, k, d) => (arr && arr[k] !== undefined ? arr[k] : d);
    const sense = (document.querySelector('input[name="lpSense"]:checked') || {}).value || 'max';
    let h = '<table class="grid sx-input"><caption class="sr-only">Meseläniň koeffisiýentleri</caption><thead><tr><th scope="col"></th>';
    for (let j = 0; j < n; j++) h += '<th scope="col">' + vn('x' + (j + 1)) + '</th>';
    h += '<th scope="col">Belgi</th><th scope="col">B</th></tr></thead><tbody>';
    h += '<tr class="sx-objrow"><th scope="row" class="rowhead"><i>Z</i> =</th>';
    for (let j = 0; j < n; j++) {
      h += '<td><input type="text" inputmode="decimal" data-c="' + j + '" aria-label="Maksat funksiýasy: x' + (j + 1) + ' koeffisiýenti" value="' + esc(get(old && old.c, j, '')) + '"></td>';
    }
    h += '<td colspan="2" class="sx-objsense" id="objSenseCell">→ ' + sense + '</td></tr>';
    for (let i = 0; i < m; i++) {
      const row = old && old.rows ? old.rows[i] : null;
      h += '<tr><th scope="row" class="rowhead">' + (i + 1) + '</th>';
      for (let j = 0; j < n; j++) {
        h += '<td><input type="text" inputmode="decimal" data-a="' + i + ',' + j + '" aria-label="' + ord(i + 1) + ' çäklendirme: x' + (j + 1) + ' koeffisiýenti" value="' + esc(get(row && row.a, j, '')) + '"></td>';
      }
      const op = row ? row.op : '<=';
      h += '<td><select data-op="' + i + '" aria-label="' + ord(i + 1) + ' çäklendirmäniň belgisi">' +
        ['<=', '>=', '='].map((o) => '<option value="' + esc(o) + '"' + (o === op ? ' selected' : '') + '>' + OP[o] + '</option>').join('') + '</select></td>';
      h += '<td><input type="text" inputmode="decimal" data-b="' + i + '" aria-label="' + ord(i + 1) + ' çäklendirmäniň sag tarapy" value="' + esc(row ? row.b : '') + '"></td></tr>';
    }
    h += '</tbody></table>';
    const wrap = $('lpTableWrap');
    wrap.innerHTML = h;
    wrap.dataset.n = n; wrap.dataset.m = m;
  }

  function gridFromProblem(p) {
    document.querySelectorAll('input[name="lpSense"]').forEach((r) => { r.checked = r.value === p.sense; });
    const s = (f) => f.toFraction();
    buildGrid(p.vars.length, p.cons.length, {
      c: p.c.map(s),
      rows: p.cons.map((k) => ({ a: k.a.map(s), op: k.op, b: s(k.b) })),
    });
  }

  /* ------------------------------------------------------------------ režimler */
  function setMode(next, focus) {
    if (next === mode) return;
    showError('');
    if (next === 'table') {
      try {
        const p = S.parseText($('lpText').value);
        gridFromProblem(p);
        if (p.vars.some((v, j) => v !== 'x' + (j + 1))) {
          showError('Bellik: tablisada üýtgeýänler ' + p.vars.map((v, j) => v + ' → x' + (j + 1)).join(', ') + ' diýlip atlandyryldy.');
        }
      } catch (e) {
        if (!$('lpTableWrap').dataset.n) buildGrid(2, 3);
        showError('Formulada ýalňyşlyk bar, şonuň üçin tablisa täzelenmedi: ' + e.message);
      }
    } else {
      try { $('lpText').value = S.toText(S.fromTable(readGrid())); } catch (e) {
        showError('Tablisada ýalňyşlyk bar, şonuň üçin formula täzelenmedi: ' + e.message);
      }
    }
    mode = next;
    const isText = mode === 'text';
    $('tabText').setAttribute('aria-selected', String(isText));
    $('tabTable').setAttribute('aria-selected', String(!isText));
    $('tabText').tabIndex = isText ? 0 : -1;
    $('tabTable').tabIndex = isText ? -1 : 0;
    $('textPanel').hidden = !isText;
    $('tablePanel').hidden = isText;
    if (focus) $(isText ? 'tabText' : 'tabTable').focus();
  }

  /* ------------------------------------------------------------------ çözmek */
  function readProblem() {
    return mode === 'table' ? S.fromTable(readGrid()) : S.parseText($('lpText').value);
  }

  function run(scroll) {
    showError('');
    let p;
    try { p = readProblem(); } catch (e) {
      showError(e.message || String(e));
      /* köne netije täze girizmä degişli däl — gizleýäris */
      last = null;
      $('resultsSection').hidden = true;
      return;
    }
    let res;
    try { res = S.solve(p, { method: $('lpMethod').value }); } catch (e) {
      showError('Hasaplamada garaşylmadyk ýalňyşlyk: ' + (e.message || e));
      if (window.console) console.error(e);
      return;
    }
    last = { problem: p, result: res };
    renderAll();
    $('resultsSection').hidden = false;
    store({ text: mode === 'text' ? $('lpText').value : S.toText(p), method: $('lpMethod').value, num: numMode, preset: presetId });
    if (scroll) $('resultsSection').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  function renderAll() {
    if (!last) return;
    const { problem: p, result: r } = last;
    $('modelView').innerHTML = renderModel(p);
    $('canonView').innerHTML = renderCanon(p, r);
    $('tableauxView').innerHTML = renderTableaux(p, r);
    $('answerView').innerHTML = renderAnswer(p, r);
    const g = p.vars.length === 2 ? S.graphData(p, r) : null;
    $('graphSection').hidden = !g;
    $('graphView').innerHTML = g ? renderGraph(p, r, g) : '';
    const showDual = r.status === 'optimal' && r.dual && r.dual.ok && r.dual.feasible;
    $('dualSection').hidden = !showDual;
    $('dualView').innerHTML = showDual ? renderDual(p, r) : '';
  }

  /* ------------------------------------------------------------------ 1) mesele */
  function renderModel(p) {
    const obj = '<i>' + esc(p.objName) + '</i> = ' + linHTML(p.c, p.vars) + (S.isZero(p.c0) ? '' : (S.sign(p.c0) < 0 ? ' − ' : ' + ') + fmtF(p.c0.abs()));
    let h = '<div class="sx-model">';
    h += '<p class="sx-eq">' + obj + ' → <b>' + p.sense + '</b></p>';
    h += '<ol class="sx-cons">';
    p.cons.forEach((k) => { h += '<li><span class="sx-eq">' + linHTML(k.a, p.vars) + ' ' + OP[k.op] + ' ' + fmtF(k.b) + '</span></li>'; });
    h += '</ol>';
    h += '<p class="sx-eq">' + p.vars.map(vn).join(', ') + ' ≥ 0</p>';
    h += '</div>';
    const notes = [];
    if (p.notes.some((n) => n.type === 'strict')) notes.push('Berk deňsizlik (&lt;, &gt;) ≤ ýa-da ≥ hökmünde alyndy: çyzykly programmirlemede çäklendirmeler berk däl bolýar.');
    if (p.notes.some((n) => n.type === 'nonneg-line')) notes.push('«x ≥ 0» görnüşli setirler aýratyn çäklendirme hökmünde goşulmady: ähli üýtgeýänleriň otrisatel däldigi eýýäm göz öňünde tutulýar.');
    if (p.notes.some((n) => n.type === 'trivial')) notes.push('Üýtgeýänsiz (hemişe dogry) çäklendirme taşlandy.');
    if (notes.length) h += '<ul class="sx-notes">' + notes.map((t) => '<li>' + t + '</li>').join('') + '</ul>';
    h += '<p class="step-explain">' + p.vars.length + ' üýtgeýän, ' + p.cons.length + ' çäklendirme. Maksat: <b>' + esc(p.objName) + '</b> funksiýasyny iň ' + (p.sense === 'max' ? 'ulaltmak' : 'kiçeltmek') + '.</p>';
    return h;
  }

  /* ------------------------------------------------------------------ 2) kanoniki görnüş */
  function renderCanon(p, r) {
    const std = r.std, cols = std.cols;
    const items = [];
    const rank = { flip: 0, slack: 1, surplus: 1, artificial: 2 };
    std.steps.slice().sort((a, b) => a.row - b.row || rank[a.type] - rank[b.type]).forEach((st) => {
      const i = st.row, name = (kind) => vn(cols.find((c) => c.row === i && c.kind === kind).name);
      const no = ord(i + 1);
      if (st.type === 'flip' && st.reason === 'negative') items.push(no + ' çäklendirmäniň sag tarapy otrisatel (' + fmtF(p.cons[i].b) + '), şonuň üçin iki tarapyny −1-e köpeldýäris: deňsizligiň belgisi tersine öwrülýär.');
      if (st.type === 'flip' && st.reason === 'zero') items.push(no + ' çäklendirmäniň sag tarapy 0: ony −1-e köpeldip «≤» görnüşe getirýäris — şeýdip emeli üýtgeýän gerek bolmaýar.');
      if (st.type === 'slack') items.push(no + ' çäklendirme «≤»: çep tarapa goşmaça ' + name('s') + ' ≥ 0 üýtgeýäni goşýarys (ulanylmadyk galyndy). Ol başlangyç bazise girýär.');
      if (st.type === 'surplus') items.push(no + ' çäklendirme «≥»: artykmaçlygy aňladýan ' + name('s') + ' ≥ 0 üýtgeýäni aýyrýarys. Onuň koeffisiýenti −1 bolany üçin bazise girip bilmeýär, şonuň üçin emeli ' + name('a') + ' ≥ 0 üýtgeýäni goşýarys.');
      if (st.type === 'artificial' && std.rows[i].op === '=') items.push(no + ' çäklendirme deňlik: başlangyç bazis üçin emeli ' + name('a') + ' ≥ 0 üýtgeýäni goşýarys.');
    });
    let h = '<ul class="sx-steps">' + items.map((t) => '<li>' + t + '</li>').join('') + '</ul>';

    const names = cols.map((c) => c.name);
    const xs = cols.filter((c) => c.kind === 'x'), ss = cols.filter((c) => c.kind === 's'), as = cols.filter((c) => c.kind === 'a');
    let obj = '<i>' + esc(p.objName) + '</i> = ' + linHTML(p.c, p.vars) + ss.map((c) => ' + 0·' + vn(c.name)).join('');
    if (std.method === 'bigM') obj += as.map((c) => mTerm({ m: p.sense === 'max' ? S.fraction(-1) : S.fraction(1) }, c.name)).join('');
    if (!S.isZero(p.c0)) obj += (S.sign(p.c0) < 0 ? ' − ' : ' + ') + fmtF(p.c0.abs());
    h += '<div class="sx-model"><p class="sx-eq">' + obj + ' → <b>' + p.sense + '</b></p><ol class="sx-cons">';
    std.rows.forEach((row, i) => {
      let lhs = linHTML(row.a, p.vars);
      cols.forEach((c) => { if (c.kind !== 'x' && c.row === i) lhs += (c.coef < 0 ? ' − ' : ' + ') + vn(c.name); });
      h += '<li><span class="sx-eq">' + lhs + ' = ' + fmtF(row.b) + '</span></li>';
    });
    h += '</ol><p class="sx-eq">' + names.map(vn).join(', ') + ' ≥ 0</p></div>';

    if (std.method === 'bigM') {
      h += '<p class="step-explain"><b>M-usuly.</b> Emeli üýtgeýänler (' + as.map((c) => vn(c.name)).join(', ') + ') maksat funksiýasyna örän uly <i>M</i> sany bilen «jeza» hökmünde girýär (' + (p.sense === 'max' ? '−M' : '+M') + '). Şonuň üçin optimal çözgütde olar nola deň bolmaga mejbur. Tablisada Δ bahalary «a·M + b» görnüşinde ýazylýar we ilki <i>M</i>-iň koeffisiýenti deňeşdirilýär.</p>';
    } else if (std.method === 'twoPhase') {
      h += '<p class="step-explain"><b>Iki tapgyrly usul.</b> I tapgyrda kömekçi meseläni çözýäris: <span class="sx-eq"><i>W</i> = ' + as.map((c) => vn(c.name)).join(' + ') + ' → min</span>. Eger <i>W</i>* = 0 bolsa, emeli üýtgeýänler aýrylýar we II tapgyrda asyl maksat funksiýasy bilen dowam edýäris; <i>W</i>* &gt; 0 bolsa, mümkin çözgüt ýok.</p>';
    } else {
      h += '<p class="step-explain">Ähli çäklendirmeler «≤» we sag taraplary otrisatel däl: goşmaça üýtgeýänler başlangyç bazisi düzýär, emeli üýtgeýän gerek däl.</p>';
    }
    const basis = std.basis.map((j) => vn(cols[j].name)).join(', ');
    h += '<p class="step-explain">Başlangyç bazis: <b>' + basis + '</b> — olaryň sütünleri birlik sütünler. Bazis däl üýtgeýänler 0-a deň.</p>';
    return h;
  }

  /* ------------------------------------------------------------------ 3) simpleks tablisalar */
  function renderTableaux(p, r) {
    const std = r.std, cols = std.cols;
    let h = '';
    let count = 0, phase = null;
    const as = cols.filter((c) => c.kind === 'a');
    r.snapshots.forEach((s, idx) => {
      if (s.phase !== phase) {
        phase = s.phase; count = 0;
        if (phase === 1) h += '<h3 class="sx-phase" id="tapgyr-1">I tapgyr: <span class="sx-eq"><i>W</i> = ' + as.map((c) => vn(c.name)).join(' + ') + ' → min</span></h3>';
        if (phase === 2) {
          h += renderPhaseBridge(p, r);
          h += '<h3 class="sx-phase" id="tapgyr-2">II tapgyr: asyl maksat funksiýasy (' + esc(p.objName) + ' → ' + p.sense + ')</h3>';
        }
      }
      count++;
      h += '<div class="sx-step">';
      h += '<h4 class="sx-step-title">' + ord(count) + ' simpleks tablisa' + (count === 1 ? ' (başlangyç)' : '') + '</h4>';
      h += tableauHTML(p, r, s);
      h += '<div class="step-explain">' + explainSnap(p, r, s, idx) + '</div>';
      h += '</div>';
    });
    if (r.method === 'twoPhase' && r.status === 'infeasible' && r.phase1) {
      h += '<div class="error-box sx-verdict">I tapgyryň netijesi <i>W</i>* = ' + fmtF(r.phase1.W) + ' &gt; 0: emeli üýtgeýänleri nola getirip bolmaýar — asyl meseläniň mümkin çözgüdi ýok.</div>';
    }
    return h;
  }

  function renderPhaseBridge(p, r) {
    const cols = r.std.cols;
    const ph = r.phase1;
    let h = '<div class="sx-bridge"><p><b>I tapgyr tamamlandy:</b> <i>W</i>* = 0 — ähli emeli üýtgeýänler nola deň, diýmek asyl meseläniň mümkin çözgüdi bar.</p><ul>';
    ph.driveOut.forEach((d) => {
      h += '<li>Emeli ' + vn(cols[d.out].name) + ' bazisde 0 derejede galdy: ony ' + vn(cols[d.col].name) + ' bilen çalyşýarys (çözüji element ' + fmtF(d.pivot) + ', sag tarapy 0 bolany üçin bahalar üýtgemeýär).</li>';
    });
    ph.redundant.forEach((d) => {
      h += '<li>' + ord(d.row + 1) + ' çäklendirme beýlekileriň netijesi (artykmaç): onuň setirinde emeli däl üýtgeýänleriň koeffisiýentleri 0. Bu setiri aýyrýarys.</li>';
    });
    h += '<li>Emeli üýtgeýänleriň sütünlerini aýyrýarys we C<sub>B</sub>, c<sub>j</sub> bahalaryny asyl maksat funksiýasynyň koeffisiýentleri bilen çalyşýarys.</li></ul></div>';
    return h;
  }

  function tableauHTML(p, r, s) {
    const cols = r.std.cols;
    const vis = s.visible;
    const isW = s.phase === 1;
    let h = '<div class="table-scroll"><table class="grid sx-tab">';
    h += '<caption class="sr-only">Simpleks tablisa</caption><thead>';
    h += '<tr class="sx-cj"><th colspan="3" scope="row" class="sx-cj-label">c<sub>j</sub></th>';
    vis.forEach((j) => { h += '<td' + (j === s.entering ? ' class="sx-pcol"' : '') + '>' + fmtM(s.cost[j]) + '</td>'; });
    h += '<td></td></tr><tr><th scope="col">Bazis</th><th scope="col">C<sub>B</sub></th><th scope="col">B</th>';
    vis.forEach((j) => {
      h += '<th scope="col"' + (j === s.entering ? ' class="sx-pcol"' : '') + '>' + vn(cols[j].name) + (j === s.entering ? '<span class="sx-arrow" aria-label="bazise girýär">↓</span>' : '') + '</th>';
    });
    h += '<th scope="col">θ</th></tr></thead><tbody>';
    const minTheta = s.leaving >= 0 ? s.theta[s.leaving] : null;
    s.basis.forEach((bj, i) => {
      const pr = i === s.leaving;
      h += '<tr' + (pr ? ' class="sx-prow"' : '') + '>';
      h += '<th scope="row" class="rowhead">' + vn(cols[bj].name) + (pr ? '<span class="sx-arrow" aria-label="bazisden çykýar">←</span>' : '') + '</th>';
      h += '<td>' + fmtM(s.cb[i]) + '</td>';
      h += '<td class="sx-bcol">' + fmtF(s.b[i]) + '</td>';
      vis.forEach((j) => {
        const pivot = pr && j === s.entering;
        const cls = pivot ? 'sx-pivot' : j === s.entering ? 'sx-pcol' : '';
        h += '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + fmtF(s.A[i][j]) + '</td>';
      });
      const th = s.theta[i];
      h += '<td class="sx-theta' + (th && minTheta && pr ? ' sx-thmin' : '') + '">' + (th ? fmtF(th) : '—') + '</td>';
      h += '</tr>';
    });
    const opt = s.status === 'optimal';
    h += '<tr class="sx-delta' + (opt ? ' sx-opt' : '') + '"><th scope="row" colspan="2">Δ<sub>j</sub> = z<sub>j</sub> − c<sub>j</sub></th>';
    h += '<td class="sx-bcol"><span class="sx-zlabel">' + (isW ? 'W' : esc(p.objName)) + ' =</span> ' + fmtZ(p, s) + '</td>';
    vis.forEach((j) => {
      h += '<td' + (j === s.entering ? ' class="sx-pcol sx-dsel"' : '') + '>' + fmtM(s.delta[j]) + '</td>';
    });
    h += '<td></td></tr></tbody></table></div>';
    return h;
  }

  /* Z bahasy (maksat funksiýasynyň hemişelik agzasy bilen) */
  function fmtZ(p, s) {
    if (s.phase === 1 || S.isZero(p.c0)) return fmtM(s.Z);
    return fmtM({ r: s.Z.r.add(p.c0), m: s.Z.m });
  }

  function explainSnap(p, r, s, idx) {
    const cols = r.std.cols;
    const isW = s.phase === 1;
    const fname = isW ? '<i>W</i>' : '<i>' + esc(p.objName) + '</i>';
    const sense = s.sense;
    const parts = [];
    /* bazis çözgüt */
    const vis = s.visible;
    const val = {};
    s.basis.forEach((j, i) => { val[j] = s.b[i]; });
    const vec = vis.map((j) => (val[j] ? fmtF(val[j]) : '0'));
    parts.push('<p>Bazis çözgüt: <span class="sx-eq">X = (' + vis.map((j) => vn(cols[j].name)).join('; ') + ') = (' + vec.join('; ') + ')</span>, ' + fname + ' = ' + fmtZ(p, s) + '.</p>');

    if (s.status === 'optimal') {
      if (isW) {
        parts.push('<p class="sx-ok">Δ setirindäki ähli bahalar ≤ 0 — I tapgyryň kömekçi meselesi optimal: <i>W</i>* = ' + fmtM(s.Z) + '.</p>');
      } else {
        const art = s.basis.map((j, i) => ({ j, i })).filter((o) => cols[o.j].kind === 'a' && S.sign(s.b[o.i]) > 0);
        if (art.length) {
          parts.push('<p>Δ setirindäki ähli bahalar ' + (sense === 'max' ? '≥' : '≤') + ' 0, ýöne bazisde emeli ' + art.map((o) => vn(cols[o.j].name) + ' = ' + fmtF(s.b[o.i])).join(', ') + ' &gt; 0 galdy.</p>');
          parts.push('<p class="sx-bad">Emeli üýtgeýäni nola getirip bolmady: çäklendirmeleriň hemmesini bir wagtda kanagatlandyrýan nokat ýok — <b>meseläniň mümkin çözgüdi ýok</b>.</p>');
        } else {
          parts.push('<p class="sx-ok">Δ setirindäki ähli bahalar ' + (sense === 'max' ? '≥' : '≤') + ' 0 — meýilnama <b>optimal</b>.</p>');
        }
      }
      return parts.join('');
    }
    if (s.status === 'limit') {
      parts.push('<p class="sx-bad">Gaýtalamalaryň çägine ýetildi. Meseläni barlaň.</p>');
      return parts.join('');
    }
    /* optimal däl: çözüji sütün */
    const bad = vis.filter((j) => s.basis.indexOf(j) < 0 && (sense === 'max' ? S.mvSign(s.delta[j]) < 0 : S.mvSign(s.delta[j]) > 0));
    parts.push('<p>Δ setirinde ' + (sense === 'max' ? 'otrisatel' : 'položitel') + ' baha bar (' + bad.map((j) => 'Δ<sub>' + esc(cols[j].name) + '</sub> = ' + fmtM(s.delta[j])).join(', ') + ') — meýilnama heniz optimal däl.</p>');
    const k = s.entering;
    if (s.rule === 'bland') {
      parts.push('<p><b>Çözüji sütün:</b> aýlanmagyň (cycling) öňüni almak üçin <b>Blendiň düzgüni</b> ulanylýar — gowulandyrýan sütünleriň iň çepdäkisi: ' + vn(cols[k].name) + ' bazise girýär.</p>');
    } else {
      parts.push('<p><b>Çözüji sütün:</b> iň ' + (sense === 'max' ? 'kiçi' : 'uly') + ' Δ<sub>' + esc(cols[k].name) + '</sub> = ' + fmtM(s.delta[k]) + ' → <b>' + vn(cols[k].name) + '</b> bazise girýär' + (s.enterTie ? ' (deň bahalaryň iň çepdäkisini aldyk)' : '') + '.</p>');
    }
    if (s.status === 'unbounded') {
      if (r.status === 'infeasible') {
        parts.push('<p>' + vn(cols[k].name) + ' sütüninde položitel element ýok — M-meselesi çäksiz. Ýöne bazisde emeli üýtgeýän noldan uly, şonuň üçin bu netije asyl meseläniň jogaby bolup bilmeýär.</p>');
        parts.push('<p class="sx-bad">Iki tapgyrly usulyň I tapgyry bilen barladyk: <i>W</i>* = ' + fmtF(r.infeasibleViaCheck || S.fraction(0)) + ' &gt; 0 — <b>meseläniň mümkin çözgüdi ýok</b>.</p>');
        return parts.join('');
      }
      parts.push('<p class="sx-bad">' + vn(cols[k].name) + ' sütüninde položitel element ýok: ' + vn(cols[k].name) + ' çäksiz ulalsa-da hiç bir bazis üýtgeýäni otrisatel bolmaýar, ' + fname + ' bolsa çäksiz ' + (sense === 'max' ? 'ösýär (→ +∞)' : 'kemelýär (→ −∞)') + '. <b>Maksat funksiýasy çäklendirilmedik</b> — optimal çözgüt ýok.</p>');
      return parts.join('');
    }
    /* θ */
    const ths = [];
    s.basis.forEach((bj, i) => { if (s.theta[i]) ths.push('θ<sub>' + esc(cols[bj].name) + '</sub> = ' + fmtF(s.b[i]) + ' / ' + fmtF(s.A[i][k]) + ' = ' + fmtF(s.theta[i])); });
    const rr = s.leaving, out = s.basis[rr];
    parts.push('<p><b>Çözüji setir:</b> θ<sub>i</sub> = B<sub>i</sub> / a<sub>i,' + esc(cols[k].name) + '</sub> (diňe položitel elementler üçin): ' + ths.join('; ') + '. Iň kiçisi θ = ' + fmtF(s.theta[rr]) + ' → <b>' + vn(cols[out].name) + '</b> bazisden çykýar.' +
      (s.thetaTie ? ' <span class="sx-note-inline">θ bahalary deň — azgyn (degenerate) ýagdaý; ' + (cols[out].kind === 'a' ? 'emeli üýtgeýäni ilki çykarýarys.' : 'indeksi iň kiçi bazis üýtgeýänini saýladyk.') + '</span>' : '') + '</p>');
    if (S.isZero(s.theta[rr])) parts.push('<p class="sx-note-inline">θ = 0: bu ädimde ' + fname + ' üýtgemeýär (azgyn ädim), ýöne bazis çalşylýar.</p>');
    const pe = s.A[rr][k];
    parts.push('<p><b>Çözüji element:</b> <span class="sx-pivot-badge">' + fmtF(pe) + '</span> (' + vn(cols[out].name) + ' setiri we ' + vn(cols[k].name) + ' sütüni).</p>');
    /* Žordan–Gauss */
    const ops = [];
    const newName = vn(cols[k].name);
    if (pe.equals(1)) ops.push(vn(cols[out].name) + ' setiri çözüji elemente (1) bölünende üýtgemeýär: ol täze ' + newName + ' setiri bolýar.');
    else ops.push('täze ' + newName + ' setiri = ' + vn(cols[out].name) + ' setiri ÷ ' + fmtF(pe));
    s.basis.forEach((bj, i) => {
      if (i === rr) return;
      const f = s.A[i][k];
      if (S.isZero(f)) { ops.push(vn(cols[bj].name) + ' setiri üýtgemeýär (' + newName + ' sütünindäki elementi 0)'); return; }
      const neg = S.sign(f) < 0;
      ops.push(vn(cols[bj].name) + ' ← ' + vn(cols[bj].name) + (neg ? ' + ' : ' − ') + (f.abs().equals(1) ? '' : fmtF(f.abs()) + '·') + '(täze ' + newName + ' setiri)');
    });
    parts.push('<p><b>Žordan–Gauss özgertmesi:</b></p><ul class="sx-ops">' + ops.map((o) => '<li>' + o + '</li>').join('') + '</ul>');
    parts.push('<p class="sx-muted">Δ setiri täze tablisada Δ<sub>j</sub> = z<sub>j</sub> − c<sub>j</sub> formula bilen gaýtadan hasaplanýar (şol özgertme bilen hem şeýle netije çykýar).</p>');
    if (s.dropped !== undefined) parts.push('<p class="sx-muted">Emeli ' + vn(cols[s.dropped].name) + ' bazisden çykdy: ol gaýdyp bazise girmeýär, şonuň üçin onuň sütünini indiki tablisalarda ýazmaýarys.</p>');
    void idx;
    return parts.join('');
  }

  /* ------------------------------------------------------------------ 4) jogap */
  function renderAnswer(p, r) {
    const fname = '<i>' + esc(p.objName) + '</i>';
    if (r.status === 'limit') return '<div class="error-box">Gaýtalamalaryň çägine ýetildi — meseläni ýönekeýleşdirip synanyşyň.</div>';
    if (r.status === 'infeasible') {
      let t = '<div class="error-box sx-verdict"><b>Jogap: meseläniň mümkin çözgüdi ýok.</b> Çäklendirmeleriň hemmesini (we x ≥ 0 şertlerini) bir wagtda kanagatlandyrýan nokat ýok — çäklendirmeler ylalaşyksyz.';
      if (r.infeasibleViaCheck) t += ' (M-meselesi çäksiz çykdy, emma iki tapgyrly usulyň I tapgyry bilen barlanda <i>W</i>* = ' + fmtF(r.infeasibleViaCheck) + ' &gt; 0.)';
      t += '</div>';
      if (p.vars.length === 2) t += '<p class="step-explain">Aşakdaky grafikde çäklendirmeleriň umumy bölegi ýok.</p>';
      return t;
    }
    if (r.status === 'unbounded') {
      const k = r.unboundedCol, col = r.std.cols[k];
      let t = '<div class="error-box sx-verdict"><b>Jogap: maksat funksiýasy çäklendirilmedik</b> (' + fname + ' → ' + (p.sense === 'max' ? '+∞' : '−∞') + '). ' + vn(col.name) + ' üýtgeýäni çäksiz ulaldyp bolýar we ' + fname + ' şonda ' + (p.sense === 'max' ? 'çäksiz ösýär' : 'çäksiz kemelýär') + ', şonuň üçin optimal çözgüt ýok.</div>';
      if (r.unboundedArt) t += '<p class="step-explain">Bellik: M-usulynda çäksizlik tapylanda bazisde emeli üýtgeýän bardy, şonuň üçin iki tapgyrly usulyň I tapgyry bilen barlandy — asyl meseläniň mümkin çözgüdi bar.</p>';
      t += '<p class="step-explain">Adatça bu meselede haýsydyr bir çäklendirmäniň ýazylmandygyny aňladýar (mysal üçin, çig malyň ýa-da wagtyň çägi).</p>';
      return t;
    }
    const x = r.x;
    let h = '<div class="optimal-box sx-answer">';
    h += '<div class="sx-answer-z">' + fname + '<sub>' + p.sense + '</sub> = ' + fmtBoth(r.z) + '</div>';
    h += '<div class="sx-answer-x">' + p.vars.map((v, j) => vn(v) + ' = ' + fmtBoth(x[j])).join(',&nbsp;&nbsp; ') + '</div>';
    h += '<div class="sx-answer-vec">Optimal meýilnama: <span class="sx-eq">X* = ' + pointHTML(x) + '</span></div>';
    h += '</div>';

    /* çäklendirmeleri barlamak */
    h += '<h3 class="sx-sub" id="caklendirmeleri-barlamak">Çäklendirmeleri barlamak</h3>';
    h += '<div class="table-scroll"><table class="grid sx-check"><caption class="sr-only">Optimal çözgüdi çäklendirmelere goýmak</caption><thead><tr><th scope="col">№</th><th scope="col">Çäklendirme</th><th scope="col">X* goýlanda</th><th scope="col">Ýagdaýy</th></tr></thead><tbody>';
    p.cons.forEach((k, i) => {
      let lhs = S.fraction(0);
      k.a.forEach((a, j) => { lhs = lhs.add(a.mul(x[j])); });
      const diff = k.b.sub(lhs);
      const tight = S.isZero(diff);
      let state;
      if (k.op === '=') state = 'deňlik ✓';
      else if (tight) state = '<b>işjeň</b> — doly ulanylýar';
      else state = 'galyndy: ' + fmtF(diff.abs());
      h += '<tr><td>' + (i + 1) + '</td><td class="sx-left"><span class="sx-eq">' + linHTML(k.a, p.vars) + ' ' + OP[k.op] + ' ' + fmtF(k.b) + '</span></td><td>' + fmtF(lhs) + ' ' + OP[k.op] + ' ' + fmtF(k.b) + ' ✓</td><td class="sx-left">' + state + '</td></tr>';
    });
    h += '</tbody></table></div>';
    const zParts = p.c.map((c, j) => (S.isZero(c) ? null : fmtF(c) + '·' + fmtF(x[j]))).filter(Boolean);
    h += '<p class="step-explain">' + fname + '* = ' + zParts.join(' + ').replace(/\+ −/g, '− ') + (S.isZero(p.c0) ? '' : ' + ' + fmtF(p.c0)) + ' = <b>' + fmtF(r.z) + '</b>.</p>';

    const notes = [];
    if (r.alt) {
      if (r.alt.kind === 'vertex') {
        notes.push('<b>Alternatiw optimum.</b> Optimal tablisada bazis däl ' + vn(r.std.cols[r.alt.col].name) + ' üýtgeýäniniň Δ bahasy 0: ony bazise girizsek, ' + fname + ' üýtgemeýär. Başga optimal burç nokady: <span class="sx-eq">X** = ' + pointHTML(r.alt.x) + '</span>. Bu iki nokadyň arasyndaky kesimiň islendik nokady hem optimal: <span class="sx-eq">X = λ·X* + (1 − λ)·X**, 0 ≤ λ ≤ 1</span>.');
      } else if (r.alt.kind === 'ray') {
        notes.push('<b>Alternatiw optimum.</b> Bazis däl ' + vn(r.std.cols[r.alt.col].name) + ' üýtgeýäniniň Δ bahasy 0 we onuň sütüninde položitel element ýok: optimal çözgütler çäksiz şöhle boýunça ýerleşýär (' + fname + '* şol bir baha).');
      } else {
        notes.push('Bazis däl ' + vn(r.std.cols[r.alt.col].name) + ' üýtgeýäniniň Δ bahasy 0, ýöne azgynlyk sebäpli ol başga burç nokadyna getirmeýär.');
      }
    }
    if (r.degenerate) notes.push('<b>Azgyn çözgüt:</b> optimal tablisada käbir bazis üýtgeýäni 0-a deň.');
    if (r.info.bland) notes.push('Hasaplamada aýlanma howpy ýüze çykdy, şonuň üçin Blendiň düzgüni ulanyldy.');
    if (notes.length) h += '<ul class="sx-notes">' + notes.map((t) => '<li>' + t + '</li>').join('') + '</ul>';
    return h;
  }

  /* ------------------------------------------------------------------ 5) grafik */
  function niceStep(span) {
    const raw = span / 6, e = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * e >= raw) return m * e;
    return 10 * e;
  }
  function clipLine(a, b, c, X, Y) {
    const pts = [];
    const add = (x, y) => { if (x >= -1e-9 && x <= X + 1e-9 && y >= -1e-9 && y <= Y + 1e-9 && !pts.some((q) => Math.abs(q[0] - x) < 1e-9 && Math.abs(q[1] - y) < 1e-9)) pts.push([x, y]); };
    if (Math.abs(b) > 1e-15) { add(0, c / b); add(X, (c - a * X) / b); }
    if (Math.abs(a) > 1e-15) { add(c / a, 0); add((c - b * Y) / a, Y); }
    if (pts.length < 2) return null;
    let best = [pts[0], pts[1]], d = -1;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const dd = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
      if (dd > d) { d = dd; best = [pts[i], pts[j]]; }
    }
    return best;
  }
  const n4 = (v) => (Math.round(v * 100) / 100).toString();

  function renderGraph(p, r, g) {
    const W = 600, H = 440, L = 52, R = 22, T = 20, B = 42;
    const sx = (x) => L + (x / g.X) * (W - L - R);
    const sy = (y) => H - B - (y / g.Y) * (H - T - B);
    const x1 = vt(p.vars[0]), x2 = vt(p.vars[1]);
    let s = '<svg class="sx-graph" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="sxGraphTitle sxGraphDesc"><title id="sxGraphTitle">Mümkin çözgütleriň ýaýlasy we optimal nokat</title>';
    s += '<desc id="sxGraphDesc">' + esc(x1) + ' we ' + esc(x2) + ' okları, ' + g.lines.length + ' çäklendirme göni çyzygy, reňklenen mümkin ýaýla' + (r.status === 'optimal' ? ', optimal nokat (' + n4(r.x[0].valueOf()) + '; ' + n4(r.x[1].valueOf()) + ')' : '') + '.</desc>';
    s += '<defs><marker id="sxArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="sx-g-arrowhead"/></marker>' +
      '<marker id="sxArrowPath" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="sx-g-pathhead"/></marker></defs>';
    /* gözenek */
    const stx = niceStep(g.X), sty = niceStep(g.Y);
    for (let v = 0; v <= g.X + 1e-9; v += stx) {
      s += '<line class="sx-g-grid" x1="' + sx(v) + '" y1="' + sy(0) + '" x2="' + sx(v) + '" y2="' + sy(g.Y) + '"/>';
      s += '<text class="sx-g-tick" x="' + sx(v) + '" y="' + (sy(0) + 16) + '" text-anchor="middle">' + n4(v) + '</text>';
    }
    for (let v = sty; v <= g.Y + 1e-9; v += sty) {
      s += '<line class="sx-g-grid" x1="' + sx(0) + '" y1="' + sy(v) + '" x2="' + sx(g.X) + '" y2="' + sy(v) + '"/>';
      s += '<text class="sx-g-tick" x="' + (sx(0) - 7) + '" y="' + (sy(v) + 4) + '" text-anchor="end">' + n4(v) + '</text>';
    }
    /* mümkin ýaýla */
    if (g.polygon.length >= 3) s += '<polygon class="sx-g-region" points="' + g.polygon.map((q) => sx(q[0]).toFixed(1) + ',' + sy(q[1]).toFixed(1)).join(' ') + '"/>';
    else if (g.polygon.length === 2) s += '<line class="sx-g-region-line" x1="' + sx(g.polygon[0][0]) + '" y1="' + sy(g.polygon[0][1]) + '" x2="' + sx(g.polygon[1][0]) + '" y2="' + sy(g.polygon[1][1]) + '"/>';
    /* oklar */
    s += '<line class="sx-g-axis" x1="' + sx(0) + '" y1="' + sy(0) + '" x2="' + (sx(g.X) + 12) + '" y2="' + sy(0) + '" marker-end="url(#sxArrow)"/>';
    s += '<line class="sx-g-axis" x1="' + sx(0) + '" y1="' + sy(0) + '" x2="' + sx(0) + '" y2="' + (sy(g.Y) - 12) + '" marker-end="url(#sxArrow)"/>';
    s += '<text class="sx-g-axlabel" x="' + (sx(g.X) + 4) + '" y="' + (sy(0) - 8) + '" text-anchor="end">' + esc(x1) + '</text>';
    s += '<text class="sx-g-axlabel" x="' + (sx(0) + 8) + '" y="' + (sy(g.Y) - 2) + '">' + esc(x2) + '</text>';
    /* çäklendirmeler */
    /* belgileri (1), (2) … burç nokatlaryndan we biri-birinden daşda goýmak */
    const placed = [];
    const vxy = g.vertices.map((v) => [sx(v.x.valueOf()), sy(v.y.valueOf())]);
    const badges = [];
    g.lines.forEach((Ln, i) => {
      const seg = clipLine(Ln.a.valueOf(), Ln.b2.valueOf(), Ln.c.valueOf(), g.X, g.Y);
      if (!seg) return;
      const cls = 'sx-g-c' + (i % 8);
      s += '<line class="sx-g-con ' + cls + '" x1="' + sx(seg[0][0]) + '" y1="' + sy(seg[0][1]) + '" x2="' + sx(seg[1][0]) + '" y2="' + sy(seg[1][1]) + '"/>';
      const far = (q) => Math.abs(q[0] - g.X) < 1e-9 * g.X || Math.abs(q[1] - g.Y) < 1e-9 * g.Y;
      const [P0, P1] = far(seg[0]) && !far(seg[1]) ? [seg[1], seg[0]] : seg;
      let best = null, bestScore = -1;
      for (const t of [0.9, 0.78, 0.64, 0.5, 0.36, 0.22, 0.1]) {
        const X = sx(P0[0] + t * (P1[0] - P0[0])), Y = sy(P0[1] + t * (P1[1] - P0[1]));
        const dv = Math.min(1e9, ...vxy.map((q) => Math.hypot(q[0] - X, q[1] - Y)));
        const db = Math.min(1e9, ...placed.map((q) => Math.hypot(q[0] - X, q[1] - Y)));
        const score = Math.min(dv / 18, db / 24, 1);
        if (score > bestScore + 1e-9) { bestScore = score; best = [X, Y]; }
        if (score >= 1) break;
      }
      placed.push(best);
      badges.push('<g class="sx-g-badge ' + cls + '"><circle cx="' + best[0].toFixed(1) + '" cy="' + best[1].toFixed(1) + '" r="9"/><text x="' + best[0].toFixed(1) + '" y="' + (best[1] + 4).toFixed(1) + '" text-anchor="middle">' + (i + 1) + '</text></g>');
    });
    /* gradient */
    const c1 = p.c[0].valueOf(), c2 = p.c[1].valueOf(), cn = Math.hypot(c1 / g.X, c2 / g.Y);
    if (cn > 0) {
      const len = 0.16;
      const gx = (c1 / g.X) / cn * len * g.X, gy = (c2 / g.Y) / cn * len * g.Y;
      /* peýkam grafigiň içinde galar ýaly başlangyç nokat */
      const ox = Math.max(0, -gx) + 0.03 * g.X, oy = Math.max(0, -gy) + 0.03 * g.Y;
      s += '<line class="sx-g-grad" x1="' + sx(ox) + '" y1="' + sy(oy) + '" x2="' + sx(ox + gx) + '" y2="' + sy(oy + gy) + '" marker-end="url(#sxArrow)"/>';
      s += '<text class="sx-g-gradlabel" x="' + (sx(ox + gx) + 6) + '" y="' + (sy(oy + gy) - 4) + '">c</text>';
    }
    /* derejeli çyzyk (optimumdan) */
    if (r.status === 'optimal') {
      const seg = clipLine(c1, c2, r.z.sub(p.c0).valueOf(), g.X, g.Y);
      if (seg) s += '<line class="sx-g-level" x1="' + sx(seg[0][0]) + '" y1="' + sy(seg[0][1]) + '" x2="' + sx(seg[1][0]) + '" y2="' + sy(seg[1][1]) + '"/>';
    }
    /* simpleks ýoly */
    for (let i = 1; i < g.path.length; i++) {
      const a = g.path[i - 1], b = g.path[i];
      s += '<line class="sx-g-path" x1="' + sx(a[0]) + '" y1="' + sy(a[1]) + '" x2="' + sx(b[0]) + '" y2="' + sy(b[1]) + '" marker-end="url(#sxArrowPath)"/>';
    }
    /* burç nokatlary */
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const optSet = new Set();
    if (r.status === 'optimal') g.vertices.forEach((v, i) => { if (v.z.equals(r.z)) optSet.add(i); });
    g.vertices.forEach((v, i) => {
      const X = sx(v.x.valueOf()), Y = sy(v.y.valueOf());
      const opt = optSet.has(i);
      s += '<circle class="sx-g-vertex' + (opt ? ' is-opt' : '') + '" cx="' + X.toFixed(1) + '" cy="' + Y.toFixed(1) + '" r="' + (opt ? 7 : 4.5) + '"/>';
      const dx = X > W - 70 ? -10 : 9, anchor = X > W - 70 ? 'end' : 'start';
      s += '<text class="sx-g-vlabel' + (opt ? ' is-opt' : '') + '" x="' + (X + dx).toFixed(1) + '" y="' + (Y - 9).toFixed(1) + '" text-anchor="' + anchor + '">' + (letters[i] || '') + '</text>';
    });
    s += badges.join('');
    s += '</svg>';

    /* legenda */
    let h = '<figure class="sx-figure">' + s + '<figcaption><ul class="sx-legend">';
    g.lines.forEach((Ln, i) => {
      h += '<li><span class="sx-sw sx-g-c' + (i % 8) + '" aria-hidden="true"></span>(' + (i + 1) + ') <span class="sx-eq">' + linHTML([Ln.a, Ln.b2], p.vars) + ' ' + OP[Ln.op] + ' ' + fmtF(Ln.c) + '</span></li>';
    });
    h += '<li><span class="sx-sw sx-sw-region" aria-hidden="true"></span>mümkin çözgütleriň ýaýlasy</li>';
    if (r.status === 'optimal') h += '<li><span class="sx-sw sx-sw-level" aria-hidden="true"></span>derejeli çyzyk <span class="sx-eq">' + esc(p.objName) + ' = ' + fmtF(r.z) + '</span></li>';
    h += '<li><span class="sx-sw sx-sw-grad" aria-hidden="true"></span><i>c</i> = (' + fmtF(p.c[0]) + '; ' + fmtF(p.c[1]) + ') — ' + esc(p.objName) + ' ösýän ugur</li>';
    if (g.path.length > 1) h += '<li><span class="sx-sw sx-sw-path" aria-hidden="true"></span>simpleks usulynyň ýoly (tablisadan tablisa)</li>';
    h += '</ul></figcaption></figure>';

    let note = '<p class="step-explain">';
    if (!g.vertices.length) note += 'Çäklendirmeleriň umumy bölegi (x ≥ 0 çärýeginde) ýok — mümkin ýaýla boş.';
    else {
      note += 'Mümkin çözgütleriň ýaýlasy — ähli çäklendirmeleriň we x ≥ 0 şertleriniň umumy bölegi. Çyzykly maksat funksiýasynyň optimumy (bar bolsa) hökman onuň <b>burç nokatlarynyň</b> birinde ýerleşýär. ';
      note += p.sense === 'max' ? 'Derejeli çyzygy <i>c</i> ugruna süýşürip, ýaýladan iň soňky çykýan nokady tapýarys.' : 'Derejeli çyzygy <i>c</i>-ä ters ugra süýşürip, ýaýladan iň soňky çykýan nokady tapýarys.';
      if (g.unboundedRegion) note += ' Ýaýla çäksiz: surat onuň diňe bir bölegini görkezýär.';
      if (g.path.length > 1) note += ' Sary peýkamlar simpleks usulynyň bir burç nokadyndan goňşy burç nokadyna geçişini görkezýär.';
    }
    note += '</p>';
    h += note;

    if (g.vertices.length) {
      h += '<div class="table-scroll"><table class="grid sx-vtab"><caption class="sr-only">Burç nokatlary we maksat funksiýasynyň bahalary</caption><thead><tr><th scope="col">Burç nokady</th><th scope="col">' + vn(p.vars[0]) + '</th><th scope="col">' + vn(p.vars[1]) + '</th><th scope="col">' + esc(p.objName) + '</th></tr></thead><tbody>';
      g.vertices.forEach((v, i) => {
        const opt = optSet.has(i);
        h += '<tr' + (opt ? ' class="sx-opt"' : '') + '><td>' + (letters[i] || i + 1) + (opt ? ' ✓' : '') + '</td><td>' + fmtF(v.x) + '</td><td>' + fmtF(v.y) + '</td><td>' + fmtF(v.z) + '</td></tr>';
      });
      h += '</tbody></table></div>';
    }
    return h;
  }

  /* ------------------------------------------------------------------ 6) ikilenji mesele */
  function renderDual(p, r) {
    const d = r.dual;
    const ys = p.cons.map((_, i) => 'y' + (i + 1));
    const max = p.sense === 'max';
    const dsense = max ? 'min' : 'max';
    const bVec = p.cons.map((k) => k.b);
    let h = '<p class="step-explain">Her çäklendirmä bir ikilenji üýtgeýän <i>y<sub>i</sub></i> degişli. Asyl mesele ' + p.sense + ' bolany üçin ikilenji mesele ' + dsense + ' bolýar:</p>';
    h += '<div class="sx-model"><p class="sx-eq"><i>W</i> = ' + linHTML(bVec, ys) + (S.isZero(p.c0) ? '' : ' + ' + fmtF(p.c0)) + ' → <b>' + dsense + '</b></p><ol class="sx-cons">';
    p.vars.forEach((v, j) => {
      const col = p.cons.map((k) => k.a[j]);
      h += '<li><span class="sx-eq">' + linHTML(col, ys) + ' ' + (max ? '≥' : '≤') + ' ' + fmtF(p.c[j]) + '</span> <span class="sx-muted">(' + vn(v) + ' üçin)</span></li>';
    });
    h += '</ol>';
    const signs = p.cons.map((k, i) => {
      if (k.op === '=') return vn(ys[i]) + ' — islendik alamatly';
      const pos = (k.op === '<=') === max;
      return vn(ys[i]) + (pos ? ' ≥ 0' : ' ≤ 0');
    });
    h += '<p class="sx-eq">' + signs.join(', &nbsp;') + '</p></div>';

    const cols = r.std.cols;
    h += '<p class="step-explain">Ikilenji meseläniň çözgüdi optimal simpleks tablisadan alynýar: <span class="sx-eq">y = C<sub>B</sub>·B<sup>−1</sup></span>, bu ýerde <i>B</i> — optimal bazis üýtgeýänleriniň (' + d.basis.map((j) => vn(cols[j].name)).join(', ') + ') kanoniki görnüşdäki sütünleri. B<sup>−1</sup> math.js bilen (<code>math.inv</code>) takyk droblarda hasaplandy:</p>';
    h += '<div class="table-scroll"><table class="grid sx-binv"><caption class="sr-only">Optimal bazisiň ters matrisasy</caption><tbody>';
    d.Binv.forEach((row) => { h += '<tr>' + row.map((v) => '<td>' + fmtF(v) + '</td>').join('') + '</tr>'; });
    h += '</tbody></table></div>';
    h += '<div class="optimal-box sx-answer"><div class="sx-answer-x">y* = (' + d.y.map(fmtF).join('; ') + ')</div><div class="sx-answer-vec"><i>W</i>* = ' + p.cons.map((k, i) => fmtF(k.b) + '·' + fmtF(d.y[i])).join(' + ').replace(/\+ −/g, '− ') + (S.isZero(p.c0) ? '' : ' + ' + fmtF(p.c0)) + ' = ' + fmtF(d.W) + ' = <i>' + esc(p.objName) + '</i>* ✓</div></div>';
    h += '<p class="step-explain"><b>Güýçli ikilik teoremasy:</b> iki meseläniň optimal bahalary deň (<i>W</i>* = <i>' + esc(p.objName) + '</i>*).</p>';
    h += '<h3 class="sx-sub" id="kolege-bahalary">Kölege bahalary näme aňladýar?</h3><ul class="sx-notes">';
    p.cons.forEach((k, i) => {
      const y = d.y[i];
      if (S.isZero(y)) h += '<li>' + ord(i + 1) + ' çäklendirme: <i>y</i><sub>' + (i + 1) + '</sub> = 0 — bu çäklendirme optimal nokatda doly ulanylmaýar (ýa-da onuň çägi täsir etmeýär): sag tarapyny azajyk üýtgetmek ' + esc(p.objName) + '* bahasyny üýtgetmeýär.</li>';
      else h += '<li>' + ord(i + 1) + ' çäklendirme: <i>y</i><sub>' + (i + 1) + '</sub> = ' + fmtF(y) + ' — sag tarapy ' + fmtF(k.b) + '-den 1 birlik ulalsa, ' + esc(p.objName) + '* takmynan ' + fmtF(y.abs()) + ' ' + (S.sign(y) > 0 ? 'ulalýar' : 'kiçelýär') + ' (optimal bazis üýtgemese).</li>';
    });
    h += '</ul>';
    if (d.redundant) h += '<p class="sx-muted">Artykmaç çäklendirme aýrylandygy sebäpli ikilenji bahalar ýeke-täk bolmazlygy mümkin.</p>';
    if (r.degenerate) h += '<p class="sx-muted">Optimal çözgüt azgyn: ikilenji bahalar ýeke-täk bolmazlygy mümkin.</p>';
    return h;
  }

  /* ------------------------------------------------------------------ başlangyç */
  function renderPresets() {
    $('presetList').innerHTML = PRESETS.map((pr) => '<button type="button" class="chip sx-chip" data-preset="' + pr.id + '" aria-pressed="false">' + esc(pr.title) + '</button>').join('');
    $('presetList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-preset]');
      if (!btn) return;
      loadPreset(btn.dataset.preset, true);
    });
  }
  function markPreset(id) {
    presetId = id;
    document.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === id)));
    const pr = PRESETS.find((x) => x.id === id);
    $('presetStory').hidden = !pr;
    $('presetStory').textContent = pr ? pr.story : '';
  }
  function loadPreset(id, solveNow) {
    const pr = PRESETS.find((x) => x.id === id);
    if (!pr) return;
    $('lpText').value = pr.text;
    if (mode !== 'text') setMode('text');
    markPreset(id);
    if (solveNow) run(true);
  }

  function init() {
    if (!S || !window.math) {
      showError('Kalkulýatory işletmek üçin gerekli faýllar ýüklenmedi (math.js ýa-da simplex-engine.js). Sahypany täzeden açyň.');
      return;
    }
    $('algoToggle').addEventListener('click', (e) => {
      e.preventDefault();
      const box = $('algoInfo');
      box.hidden = !box.hidden;
      $('algoToggle').setAttribute('aria-expanded', String(!box.hidden));
      if (!box.hidden) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('tabText').addEventListener('click', () => setMode('text'));
    $('tabTable').addEventListener('click', () => setMode('table'));
    document.querySelector('.mode-switch').addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) < 0) return;
      e.preventDefault();
      const next = e.key === 'Home' ? 'text' : e.key === 'End' ? 'table' : (mode === 'text' ? 'table' : 'text');
      setMode(next, true);
    });
    $('genBtn').addEventListener('click', () => buildGrid(+$('nVars').value, +$('nCons').value));
    document.querySelectorAll('input[name="lpSense"]').forEach((rb) => rb.addEventListener('change', () => {
      const cell = $('objSenseCell'); if (cell) cell.textContent = '→ ' + rb.value;
    }));
    $('lpTableWrap').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); run(true); } });
    $('lpText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(true); } });
    $('lpText').addEventListener('input', () => { if (presetId) markPreset(null); });
    $('solveBtn').addEventListener('click', () => run(true));
    $('lpMethod').addEventListener('change', () => { if (last) run(false); });
    $('lpNum').addEventListener('change', () => { numMode = $('lpNum').value; renderAll(); });
    renderPresets();
    buildGrid(2, 3);

    /* simpleks.html#mesele=<tekst> — başga sahypadan (ikilenji simpleks, bitin sanly, Amatly AI) mesele bilen açmak */
    let fromHash = null;
    const mh = /^#mesele=([\s\S]+)$/.exec(location.hash);
    if (mh) { try { fromHash = decodeURIComponent(mh[1]); } catch (e) { fromHash = null; } }
    const saved = restore();
    if (fromHash && fromHash.trim() && fromHash.length < 4000) {
      $('lpText').value = fromHash;
      markPreset(null);
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* hökman däl */ }
    } else if (saved && typeof saved.text === 'string' && saved.text.trim()) {
      $('lpText').value = saved.text;
      if (saved.method === 'twoPhase' || saved.method === 'bigM') $('lpMethod').value = saved.method;
      if (saved.num === 'dec' || saved.num === 'frac') { $('lpNum').value = saved.num; numMode = saved.num; }
      markPreset(PRESETS.some((x) => x.id === saved.preset && x.text === saved.text) ? saved.preset : null);
    } else {
      markPreset('onumcilik');
    }
    run(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
