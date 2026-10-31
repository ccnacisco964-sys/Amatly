/* ==========================================================================
   Amatly.com — Bellemek meselesi (Wengr usuly): sahypanyň interfeýsi.
   Hasaplama: or-engine.js (AmatlyOR.hungarian). Bu faýl tablisany okaýar we ädimleri görkezýär.
   ========================================================================== */
(function () {
  'use strict';
  const O = window.AmatlyOR, U = window.AmatlyORUI;
  if (!O || !U || !document.getElementById('asGrid')) return;
  const { $, esc, fmtF, minus } = U;
  const STORE = 'amatly_or_bellemek_v1';
  const PRESETS = [
    { id: 'p4', title: '4 işgär — 4 iş', sense: 'min', rows: ['Aman', 'Begli', 'Jeren', 'Merdan'], cols: ['Iş 1', 'Iş 2', 'Iş 3', 'Iş 4'],
      data: [[9, 2, 7, 8], [6, 4, 3, 7], [5, 8, 1, 8], [7, 6, 9, 4]],
      story: 'Dört işgäriň her biri dört işiň islendigini ýerine ýetirip bilýär, ýöne her biriniň harçlaýan wagty (sagat) dürli. Her işe bir işgär bellemeli we umumy wagt iň az bolmaly.' },
    { id: 'adj', title: 'δ bilen düzetmek', sense: 'min', rows: ['Brigada 1', 'Brigada 2', 'Brigada 3', 'Brigada 4'], cols: ['Obýekt A', 'Obýekt B', 'Obýekt C', 'Obýekt D'],
      data: [[10, 19, 8, 15], [10, 18, 7, 17], [13, 16, 9, 14], [12, 19, 8, 18]],
      story: 'Dört brigada dört obýekti gurýar (çykdajy, müň manat). Bu mysalda azaltmadan soň nollar 4 çyzykdan az bilen örtülýär — δ bilen düzetmek ädimi görkezilýär.' },
    { id: 'max', title: 'Girdeji (max)', sense: 'max', rows: ['Satyjy A', 'Satyjy B', 'Satyjy C'], cols: ['Aşgabat', 'Mary', 'Daşoguz'],
      data: [[5, 8, 4], [7, 6, 9], [6, 7, 5]],
      story: 'Üç satyjy üç şähere iberilýär; tablisada her satyjynyň şol şäherde garaşylýan girdejisi (müň manat). Umumy girdejini iň köp etmeli.' },
    { id: 'rect', title: 'Gönüburçly, gadagan öýjük', sense: 'min', rows: ['Ulag 1', 'Ulag 2', 'Ulag 3', 'Ulag 4'], cols: ['Ugur A', 'Ugur B', 'Ugur C'],
      data: [[10, 5, 13], [3, 9, 18], [10, 7, 2], ['M', 4, 8]],
      story: 'Dört ulag we üç ugur: bir ulag boş galýar (goşmaça sütün goşulýar). 4-nji ulag A ugruna gidip bilmeýär — öýjükde M (gadagan).' },
  ];
  const defRow = (i) => 'Işgär ' + (i + 1);
  const defCol = (j) => 'Iş ' + (j + 1);

  function build(m, n, st) {
    U.matrixInput($('asGrid'), {
      rows: m, cols: n, names: true, data: st && st.data, rowNames: st && st.rows, colNames: st && st.cols,
      caption: 'Bellemek meselesiniň tablisasy', corner: '',
      rowLabel: defRow, colLabel: defCol,
      rowAria: (i) => (i + 1) + '-nji setiriň ady', colAria: (j) => (j + 1) + '-nji sütüniň ady',
      cellLabel: (i, j) => (i + 1) + '-nji setir, ' + (j + 1) + '-nji sütün',
    });
    $('asRows').value = m; $('asCols').value = n;
  }
  function sense() { return document.querySelector('input[name="asSense"]:checked').value; }
  function setSense(s) { document.querySelector('input[name="asSense"][value="' + s + '"]').checked = true; }
  function current() {
    const g = U.readMatrixInput($('asGrid'));
    return { sense: sense(), data: g.data, rows: g.rowNames.map((x, i) => x || defRow(i)), cols: g.colNames.map((x, j) => x || defCol(j)) };
  }

  /* ------------------------------------------------------------------ matrisa */
  function names(res, st) {
    const rn = st.rows.slice(), cn = st.cols.slice();
    for (let i = res.m; i < res.N; i++) rn.push('Goşmaça ' + (i - res.m + 1));
    for (let j = res.n; j < res.N; j++) cn.push('Goşmaça ' + (j - res.n + 1));
    return { rn, cn };
  }
  function matHTML(res, st, M, o) {
    const opt = o || {};
    const { rn, cn } = names(res, st);
    const N = M.length;
    const covR = new Set(opt.cover ? opt.cover.rows : []), covC = new Set(opt.cover ? opt.cover.cols : []);
    let h = '<div class="table-scroll"><table class="grid or-mat"><caption class="sr-only">' + esc(opt.caption || 'Matrisa') + '</caption><thead><tr><th scope="col"></th>';
    cn.forEach((c, j) => { h += '<th scope="col"' + (covC.has(j) ? ' class="is-line" title="Örtülen sütün"' : '') + '>' + esc(c) + (covC.has(j) ? ' <span aria-label="örtülen">│</span>' : '') + '</th>'; });
    if (opt.rowMins) h += '<th scope="col" class="or-side">min</th>';
    h += '</tr></thead><tbody>';
    for (let i = 0; i < N; i++) {
      h += '<tr><th scope="row"' + (covR.has(i) ? ' class="is-line" title="Örtülen setir"' : '') + '>' + esc(rn[i]) + (covR.has(i) ? ' <span aria-label="örtülen">—</span>' : '') + '</th>';
      for (let j = 0; j < N; j++) {
        const v = M[i][j];
        const cls = [];
        if (v === null) cls.push('is-forbid');
        else if (v.compare(0) === 0) cls.push('is-zero');
        if (opt.stars && opt.stars[i] === j) cls.push('is-star');
        const r = covR.has(i), c = covC.has(j);
        if (r && c) cls.push('is-cross'); else if (r || c) cls.push('is-cov');
        if (opt.mark && opt.mark(i, j)) cls.push('is-pick');
        h += '<td' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') + '>' + (v === null ? 'M' : fmtF(v)) + (opt.stars && opt.stars[i] === j ? '<span class="or-star" aria-label="bellenen nol">★</span>' : '') + '</td>';
      }
      if (opt.rowMins) h += '<td class="or-side">' + fmtF(opt.rowMins[i]) + '</td>';
      h += '</tr>';
    }
    if (opt.colMins) {
      h += '<tr class="or-side-row"><th scope="row" class="or-side">min</th>';
      opt.colMins.forEach((x) => { h += '<td class="or-side">' + fmtF(x) + '</td>'; });
      h += '</tr>';
    }
    return h + '</tbody></table></div>';
  }
  const listNames = (idx, arr) => idx.map((k) => '«' + esc(arr[k]) + '»').join(', ');

  function renderSteps(res, st) {
    const { rn, cn } = names(res, st);
    let h = '', no = 0;
    const step = (title, body) => { no++; h += '<div class="or-step"><h3>' + no + '. ' + title + '</h3>' + body + '</div>'; };
    const sMax = res.steps.find((s) => s.type === 'max');
    const sPad = res.steps.find((s) => s.type === 'pad');
    if (sMax) step('Girdejini «ýitgä» öwürmek (max → min)', '<p>Max meseläni min meselä getirmek üçin her öýjügi iň uly bahadan aýyrýarys: c′<sub>ij</sub> = ' + fmtF(sMax.mx) + ' − c<sub>ij</sub>. Indi iň az «ýitgi» gözlenýär — ol iň köp girdejä deňdir.</p>' + (sPad ? '' : matHTML(res, st, sMax.M, { caption: 'Özgerdilen matrisa' })));
    if (sPad) {
      const t = [];
      if (sPad.rows) t.push(sPad.rows + ' goşmaça setir');
      if (sPad.cols) t.push(sPad.cols + ' goşmaça sütün');
      step('Tablisany kwadrat etmek', '<p>Setirleriň sany (' + res.m + ') bilen sütünleriň sany (' + res.n + ') deň däl, şonuň üçin nol bahaly ' + t.join(' we ') + ' goşulýar. Goşmaça öýjüge bellenen ' + (sPad.rows ? 'iş ýerine ýetirilmeýär' : 'ýerine ýetiriji boş galýar') + '.</p>' + matHTML(res, st, sPad.M, { caption: 'Kwadrat matrisa' }));
    }
    const sRows = res.steps.find((s) => s.type === 'rows'), sCols = res.steps.find((s) => s.type === 'cols');
    step('Setirler boýunça azaltmak', '<p>Her setiriň iň kiçi elementini (sag sütün) şol setiriň ähli elementlerinden aýyrýarys.</p>' + matHTML(res, st, res.work, { rowMins: sRows.mins, caption: 'Setirleriň iň kiçi elementleri' }));
    const colsZero = sCols.mins.every((x) => x.compare(0) === 0);
    step('Sütünler boýunça azaltmak', '<p>' + (colsZero ? 'Setirler azaldylandan soň her sütünde eýýäm nol bar, şonuň üçin sütünleriň iň kiçi elementleri 0 — matrisa üýtgemeýär.' : 'Indi her sütüniň iň kiçi elementini (aşaky setir) şol sütüniň elementlerinden aýyrýarys.') + '</p>' + matHTML(res, st, sRows.M, { colMins: sCols.mins, caption: 'Sütünleriň iň kiçi elementleri' }));
    res.steps.forEach((s) => {
      if (s.type === 'cover') {
        const lines = [];
        if (s.rows.length) lines.push('setirler: ' + listNames(s.rows, rn));
        if (s.cols.length) lines.push('sütünler: ' + listNames(s.cols, cn));
        const enough = s.lines >= res.N;
        step('Nollary iň az çyzyk bilen örtmek' + (enough ? ' — optimal' : ''),
          '<p>Ähli nollary iň az <b>' + s.lines + '</b> çyzyk bilen örtüp bolýar (' + lines.join('; ') + '). ' +
          (enough ? s.lines + ' = n — her setirde we her sütünde bir garaşsyz nol saýlap bolýar: ★ bilen bellenen nollar optimal bellemekdir.'
            : s.lines + ' &lt; ' + res.N + ' — entek ' + res.N + ' garaşsyz nol ýok (★ — häzir saýlap bolýan iň köp ' + s.lines + ' nol). Matrisany düzetmeli.') + '</p>' +
          matHTML(res, st, s.M, { cover: s, stars: s.match, caption: 'Örtülen nollar' }) +
          '<div class="or-legend"><span><i class="or-sw or-sw-cov"></i> bir çyzyk bilen örtülen</span><span><i class="or-sw or-sw-cross"></i> iki çyzygyň kesişmesi</span><span><i class="or-sw or-sw-star"></i> ★ garaşsyz (saýlanan) nol</span></div>');
      } else if (s.type === 'adjust') {
        step('Matrisany düzetmek (δ = ' + fmtF(s.delta) + ')', '<p>Örtülmedik öýjükleriň iň kiçisi <b>δ = ' + fmtF(s.delta) + '</b>. Ony ähli örtülmedik öýjüklerden aýyrýarys we iki çyzygyň kesişýän öýjüklerine goşýarys; bir çyzyk bilen örtülen öýjükler üýtgemeýär. Netijede täze nol(lar) döreýär — täzeden örtýäris.</p>');
      }
    });
    $('stepsView').innerHTML = h;
  }

  function renderAnswer(res, st, C) {
    const out = $('answerView');
    if (res.status !== 'optimal') {
      out.innerHTML = '<div class="error-box sx-verdict"><b>Jogap: mümkin bolan bellemek ýok.</b> Gadagan (M) öýjükler sebäpli her setire we her sütüne bir öýjük saýlap bolmaýar. Gadagan öýjükleri azaldyp synanyşyň.</div>';
      return;
    }
    const usedForbidden = res.pairs.some(([i, j]) => C[i][j] === null);
    const word = res.sense === 'max' ? 'girdeji' : 'çykdajy';
    let h = '<div class="optimal-box sx-answer"><div class="sx-answer-z">' + (res.sense === 'max' ? 'Iň köp ' : 'Iň az ') + word + ': ' + U.fmtBoth(res.total) + '</div>';
    h += '<div class="sx-answer-vec">' + res.pairs.map(([i, j]) => esc(st.rows[i]) + ' → ' + esc(st.cols[j])).join(' · ') + '</div></div>';
    if (usedForbidden) h += '<div class="error-box">Bellik: optimal bellemekde gadagan öýjük ulanyldy — mümkin bolan bellemek ýok.</div>';
    h += '<div class="table-scroll"><table class="grid or-mat or-final"><caption class="sr-only">Optimal bellemek (asyl tablisada)</caption><thead><tr><th scope="col"></th>' + st.cols.map((c) => '<th scope="col">' + esc(c) + '</th>').join('') + '</tr></thead><tbody>';
    C.forEach((r, i) => {
      h += '<tr><th scope="row">' + esc(st.rows[i]) + '</th>';
      r.forEach((v, j) => {
        const pick = res.assign[i] === j;
        h += '<td class="' + (pick ? 'is-star' : '') + (v === null ? ' is-forbid' : '') + '">' + (v === null ? 'M' : fmtF(v)) + (pick ? '<span class="or-star" aria-label="bellenen">★</span>' : '') + '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    h += '<ul class="or-pairs">' + res.pairs.map(([i, j]) => '<li><span>' + esc(st.rows[i]) + ' → ' + esc(st.cols[j]) + '</span><b>' + fmtF(C[i][j]) + '</b></li>').join('') +
      '<li class="or-pairs-total"><span>Jemi ' + word + '</span><b>' + res.pairs.map(([i, j]) => fmtF(C[i][j])).join(' + ') + ' = ' + fmtF(res.total) + '</b></li></ul>';
    const notes = [];
    if (res.unassignedRows.length) notes.push(listNames(res.unassignedRows, st.rows) + ' — işsiz galýar (goşmaça sütüne bellenen).');
    if (res.unassignedCols.length) notes.push(listNames(res.unassignedCols, st.cols) + ' — ýerine ýetirilmeýär (goşmaça setire bellenen).');
    /* barlag */
    const cert = res.certificate;
    const fmtVec = (v) => '(' + v.map((x) => fmtF(x)).join('; ') + ')';
    notes.push((cert.ok ? '<span class="or-ok">✓ Optimallyk subut edildi.</span>' : '<span class="or-bad">⚠ Subutnama barlagy geçmedi.</span>') +
      ' Ikilenji potensiallar u = ' + fmtVec(res.u) + ', v = ' + fmtVec(res.v) + ': ähli öýjüklerde u<sub>i</sub> + v<sub>j</sub> ≤ c′<sub>ij</sub>, we Σu + Σv = ' + fmtF(cert.dualSum) + ' = bellenen öýjükleriň jemi. Şonuň üçin hiç bir bellemek has gowy bolup bilmez.');
    if (res.N <= 8) {
      const best = O.assignBrute(C, res.sense);
      const fact = [1, 1, 2, 6, 24, 120, 720, 5040, 40320][res.N];
      if (best) notes.push((best.equals(res.total) ? '<span class="or-ok">✓</span> Ähli ' + fact + ' ýerleşdirmäni gözden geçirmek hem şol jogaby berdi: ' : '<span class="or-bad">⚠</span> Doly gözlegiň netijesi: ') + fmtF(best) + '.');
    }
    h += '<ul class="sx-notes">' + notes.map((t) => '<li>' + t + '</li>').join('') + '</ul>';
    out.innerHTML = h;
    const q = 'Bellemek meselesi (' + (res.sense === 'max' ? 'iň köp girdeji' : 'iň az çykdajy') + '). Tablisa (setirler: ' + st.rows.join(', ') + '; sütünler: ' + st.cols.join(', ') + '): ' +
      C.map((r) => '[' + r.map((v) => (v === null ? 'M' : minus(v.toFraction()))).join(', ') + ']').join(', ') + '. Wengr usuly bilen tapylan optimal bellemek: ' +
      res.pairs.map(([i, j]) => st.rows[i] + ' → ' + st.cols[j]).join(', ') + '; jemi ' + minus(res.total.toFraction()) + '. Wengr usulynyň ädimlerini we bu çözgüdiň näme üçin optimaldygyny gysga düşündir.';
    const row = document.createElement('div');
    row.className = 'or-ai-row';
    row.appendChild(U.aiButton(q));
    out.appendChild(row);
  }

  function solve(scroll) {
    U.showError('');
    let st;
    try {
      st = current();
      U.store(STORE, st);
      const C = O.parseMatrix(st.data, 'Tablisa', { forbid: true });
      const res = O.hungarian(C, { sense: st.sense });
      U.setNumMode($('orNum').value);
      renderSteps(res, st);
      renderAnswer(res, st, C);
      $('resultsSection').hidden = false;
      if (scroll) $('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      if (!(e instanceof O.ORError)) console.error(e);
      $('resultsSection').hidden = true;
      U.showError(e instanceof O.ORError ? e.message : 'Garaşylmadyk ýalňyşlyk: ' + e.message);
    }
  }

  function init() {
    const saved = U.restore(STORE);
    const st = saved && saved.data && saved.data.length ? saved : PRESETS[0];
    setSense(st.sense || 'min');
    build(st.data.length, st.data[0].length, st);
    U.gridKeys($('asGrid'));
    $('asGen').addEventListener('click', () => {
      const m = Math.max(2, Math.min(10, Math.round(+$('asRows').value || 2)));
      const n = Math.max(2, Math.min(10, Math.round(+$('asCols').value || 2)));
      const old = current();
      const data = Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => (old.data[i] && old.data[i][j] !== undefined ? old.data[i][j] : '')));
      build(m, n, { data, rows: Array.from({ length: m }, (_, i) => old.rows[i] || defRow(i)), cols: Array.from({ length: n }, (_, j) => old.cols[j] || defCol(j)) });
      U.unmarkPresets();
    });
    U.presets(PRESETS, (p) => {
      setSense(p.sense);
      build(p.data.length, p.data[0].length, { data: p.data.map((r) => r.map(String)), rows: p.rows, cols: p.cols });
      solve(false);
    });
    $('asGrid').addEventListener('input', U.unmarkPresets);
    $('solveBtn').addEventListener('click', () => solve(true));
    $('orNum').addEventListener('change', () => { if (!$('resultsSection').hidden) solve(false); });
    document.querySelectorAll('input[name="asSense"]').forEach((r) => r.addEventListener('change', U.unmarkPresets));
  }
  init();
})();
