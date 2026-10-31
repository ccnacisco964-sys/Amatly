/* ==========================================================================
   Amatly.com — Ikilenji simpleks usuly: sahypanyň interfeýsi.
   Okamak: AmatlySimplex.parseText; hasaplama: AmatlyOR.dualSimplex; barlag: AmatlySimplex.solve.
   ========================================================================== */
(function () {
  'use strict';
  const O = window.AmatlyOR, U = window.AmatlyORUI, S = window.AmatlySimplex;
  if (!O || !U || !S || !document.getElementById('lpText')) return;
  const { $, esc, fmtF, vn, lin, OP, minus } = U;
  const STORE = 'amatly_or_ikilenji_v1';
  const PRESETS = [
    { id: 'taha', title: 'Iň arzan garyndy', text: 'min Z = 2x1 + 3x2 + 4x3\nx1 + 2x2 + x3 >= 3\n2x1 - x2 + 3x3 >= 4',
      story: 'Üç çig maldan garyndy düzülýär (bahalary 2, 3 we 4 manat). Garyndyda birinji maddadan azyndan 3, ikinjiden azyndan 4 birlik bolmaly. Iň arzan garyndy nähili?' },
    { id: 'diet', title: 'Iýmit rasiony', text: 'min Z = 3x1 + 2x2\n4x1 + x2 >= 8\nx1 + 3x2 >= 9\nx1 + x2 >= 4',
      story: 'Iki önüm (1 kg bahasy 3 we 2 manat) bilen belok, witamin we energiýa boýunça iň az talaplary ödemeli. Iň arzan rasion.' },
    { id: 'eq', title: 'Deňlikli mesele', text: 'min Z = x1 + 2x2 + 3x3\nx1 + x2 + x3 = 6\nx1 - x2 >= 1\nx2 + 2x3 >= 4',
      story: '= çäklendirme iki deňsizlige bölünýär: ≤ we ≥ (−1-e köpeldilýär).' },
    { id: 'none', title: 'Mümkin däl mesele', text: 'min Z = x1 + x2\nx1 + x2 <= 2\nx1 + 2x2 >= 6',
      story: 'Çäklendirmeler bir-birine garşy: ikilenji simpleks çykýan setirde otrisatel element tapmaýar.' },
  ];

  function tableauHTML(d, s, idx) {
    const cols = d.cols, last = idx === d.snapshots.length - 1;
    let h = '<div class="table-scroll"><table class="grid sx-tab"><caption class="sr-only">Ikilenji simpleks tablisa ' + (idx + 1) + '</caption><thead>';
    h += '<tr class="sx-cj"><th colspan="3" scope="row" class="sx-cj-label">c<sub>j</sub></th>';
    cols.forEach((c, j) => { h += '<td' + (j === s.entering ? ' class="sx-pcol"' : '') + '>' + fmtF(d.cost[j]) + '</td>'; });
    h += '</tr><tr><th scope="col">Bazis</th><th scope="col">C<sub>B</sub></th><th scope="col">B</th>';
    cols.forEach((c, j) => { h += '<th scope="col"' + (j === s.entering ? ' class="sx-pcol"' : '') + '>' + vn(c.name) + (j === s.entering ? '<span class="sx-arrow" aria-label="bazise girýär">↓</span>' : '') + '</th>'; });
    h += '</tr></thead><tbody>';
    s.basis.forEach((bj, i) => {
      const pr = i === s.leaving;
      h += '<tr' + (pr ? ' class="sx-prow"' : '') + '><th scope="row" class="rowhead">' + vn(cols[bj].name) + (pr ? '<span class="sx-arrow" aria-label="bazisden çykýar">←</span>' : '') + '</th>';
      h += '<td>' + fmtF(s.cb[i]) + '</td><td class="sx-bcol' + (s.b[i].compare(0) < 0 ? ' or-negb' : '') + '">' + fmtF(s.b[i]) + '</td>';
      cols.forEach((c, j) => {
        const pv = pr && j === s.entering;
        h += '<td' + (pv ? ' class="sx-pivot"' : j === s.entering ? ' class="sx-pcol"' : '') + '>' + fmtF(s.A[i][j]) + '</td>';
      });
      h += '</tr>';
    });
    h += '<tr class="sx-delta' + (s.status === 'optimal' ? ' sx-opt' : '') + '"><th scope="row" colspan="2">Δ<sub>j</sub> = z<sub>j</sub> − c<sub>j</sub></th><td class="sx-bcol"><span class="sx-zlabel">' + esc(d.problem.objName) + ' =</span> ' + fmtF(s.Z) + '</td>';
    cols.forEach((c, j) => { h += '<td' + (j === s.entering ? ' class="sx-pcol sx-dsel"' : '') + '>' + fmtF(s.delta[j]) + '</td>'; });
    h += '</tr>';
    if (s.ratios) {
      h += '<tr class="or-ratio"><th scope="row" colspan="3">|Δ<sub>j</sub> / a<sub>rj</sub>| (a<sub>rj</sub> &lt; 0)</th>';
      cols.forEach((c, j) => { const q = s.ratios[j]; h += '<td class="sx-theta' + (j === s.entering ? ' sx-thmin' : '') + '">' + (q === null || s.basis.indexOf(j) >= 0 ? '—' : fmtF(q)) + '</td>'; });
      h += '</tr>';
    }
    void last;
    return h + '</tbody></table></div>';
  }
  function explain(d, s, idx) {
    const cols = d.cols;
    if (s.status === 'optimal') {
      return '<p class="step-explain"><span class="sx-ok">✓</span> B sütüninde otrisatel baha ýok, Δ<sub>j</sub> setiri bolsa optimallyk şertini saklaýar (' + (d.sense === 'max' ? 'ähli Δ<sub>j</sub> ≥ 0' : 'ähli Δ<sub>j</sub> ≤ 0') + ') — <b>meýilnama optimal</b>.</p>';
    }
    const r = s.leaving, out = cols[s.basis[r]].name;
    const negs = s.b.map((b, i) => ({ b, i })).filter((o) => o.b.compare(0) < 0);
    let t = '<p class="step-explain">B sütüninde otrisatel baha' + (negs.length > 1 ? 'lar' : '') + ': ' + negs.map((o) => vn(cols[s.basis[o.i]].name) + ' = ' + fmtF(o.b)).join(', ') + '. Iň kiçisi <b>' + fmtF(s.b[r]) + '</b> — ' + vn(out) + ' bazisden <b>çykýar</b>.</p>';
    if (s.status === 'infeasible') {
      return t + '<p class="step-explain"><span class="sx-bad">✗</span> Şu setirde otrisatel element ýok: setiriň hemme koeffisiýentleri ≥ 0, sag tarapy bolsa &lt; 0 — bu deňleme x ≥ 0 bolanda ýerine ýetip bilmez. <b>Meseläniň mümkin çözgüdi ýok.</b></p>';
    }
    const cand = s.ratios.map((q, j) => ({ q, j })).filter((o) => o.q !== null && s.basis.indexOf(o.j) < 0);
    t += '<p class="step-explain">Şol setirde otrisatel elementli sütünler üçin |Δ<sub>j</sub> / a<sub>rj</sub>|: ' + cand.map((o) => vn(cols[o.j].name) + ': |' + fmtF(s.delta[o.j]) + ' / ' + fmtF(s.A[r][o.j]) + '| = ' + fmtF(o.q)).join('; ') +
      '. Iň kiçisi <b>' + fmtF(s.ratios[s.entering]) + '</b> — ' + vn(cols[s.entering].name) + ' bazise <b>girýär</b>. Çözüji element: <b>' + fmtF(s.A[r][s.entering]) + '</b>. Iň kiçi gatnaşygy saýlamak Δ setiriniň alamatyny (optimallygy) saklaýar.</p>';
    return t;
  }

  function renderModel(p) {
    let h = '<div class="sx-model"><p class="sx-eq">' + esc(p.objName) + ' = ' + lin(p.c, p.vars) + (p.c0.compare(0) ? ' ' + (p.c0.compare(0) < 0 ? '− ' : '+ ') + fmtF(p.c0.abs()) : '') + ' → ' + p.sense + '</p><ol class="sx-cons">';
    p.cons.forEach((k) => { h += '<li><span class="sx-eq">' + lin(k.a, p.vars) + ' ' + OP[k.op] + ' ' + fmtF(k.b) + '</span></li>'; });
    h += '</ol><p class="sx-eq">' + p.vars.map(vn).join(', ') + ' ≥ 0</p></div>';
    $('modelView').innerHTML = h;
  }
  function renderCanon(d) {
    const p = d.problem;
    if (d.status === 'not-dual-feasible') {
      const bad = d.bad.map((j) => vn(p.vars[j]) + ' (c = ' + fmtF(p.c[j]) + ')').join(', ');
      $('canonView').innerHTML = '<div class="error-box sx-verdict"><b>Bu meseläni ikilenji simpleks usuly bilen göni çözüp bolmaýar.</b> Başlangyç tablisa ikilenji mümkin däl: ' +
        (p.sense === 'min' ? 'min meselede ähli c<sub>j</sub> ≥ 0 bolmaly, ýöne ' : 'max meselede ähli c<sub>j</sub> ≤ 0 bolmaly, ýöne ') + bad + '. Şeýle meseläni adaty simpleks usuly (M-usuly ýa-da iki tapgyrly) bilen çözüň.</div>' +
        '<p class="or-ai-row"><a class="classic-btn or-link-btn" href="simpleks.html#mesele=' + encodeURIComponent($('lpText').value) + '">Simpleks usuly bilen çöz →</a></p>';
      return;
    }
    let h = '<ol class="sx-steps">';
    const n = p.vars.length;
    const names = d.cols.map((c) => c.name);
    p.cons.forEach((k, i) => {
      const rows = d.rows.map((r, t) => ({ r, t })).filter((o) => o.r.from === i);
      const orig = lin(k.a, p.vars) + ' ' + OP[k.op] + ' ' + fmtF(k.b);
      const eqs = rows.map((o) => lin(o.r.a.concat(d.rows.map((_, q) => S.fraction(q === o.t ? 1 : 0))), names) + ' = ' + fmtF(o.r.b)).join(';&nbsp;&nbsp; ');
      let why;
      if (k.op === '<=') why = 'goşmaça üýtgeýän goşulýar';
      else if (k.op === '>=') why = '−1-e köpeldip ≤ görnüşe getirýäris, soň goşmaça üýtgeýän goşýarys';
      else why = 'deňligi iki deňsizlige bölýäris (≤ we ≥), ≥ bölegini −1-e köpeldýäris';
      h += '<li><span class="sx-eq">' + orig + '</span> — ' + why + ': <span class="sx-eq">' + eqs + '</span></li>';
    });
    h += '</ol>';
    const s0 = d.snapshots[0];
    const negB = s0.b.some((b) => b.compare(0) < 0);
    h += '<p class="step-explain">Başlangyç bazis: ' + s0.basis.map((j) => vn(d.cols[j].name)).join(', ') + ' (emeli üýtgeýän gerek däl). Δ<sub>j</sub> = −c<sub>j</sub>, we ' + (p.sense === 'min' ? 'ähli Δ<sub>j</sub> ≤ 0' : 'ähli Δ<sub>j</sub> ≥ 0') + ' — tablisa <b>ikilenji mümkin</b> (optimallyk şerti ýerine ýetýär). ' +
      (negB ? 'Ýöne B sütüninde otrisatel bahalar bar, ýagny meýilnama entek mümkin däl — ikilenji simpleks usuly mümkinlige ýetýär.' : 'B sütüninde otrisatel baha ýok — başlangyç tablisa eýýäm optimal.') + '</p>';
    void n;
    $('canonView').innerHTML = h;
  }
  function renderTableaux(d) {
    if (d.status === 'not-dual-feasible') { $('tableauxView').innerHTML = '<p class="step-explain">—</p>'; return; }
    let h = '';
    d.snapshots.forEach((s, idx) => {
      h += '<div class="sx-step"><h3 class="sx-step-title">' + (idx + 1) + '-nji tablisa' + (s.status === 'optimal' ? ' — optimal' : s.status === 'infeasible' ? ' — mümkin çözgüt ýok' : '') + '</h3>' + tableauHTML(d, s, idx) + explain(d, s, idx) + '</div>';
    });
    if (d.status === 'limit') h += '<div class="error-box">Gaýtalamalaryň çägine ýetildi.</div>';
    $('tableauxView').innerHTML = h;
  }
  function renderAnswer(d, ref) {
    const p = d.problem, out = $('answerView');
    if (d.status === 'not-dual-feasible') { out.innerHTML = '<p class="step-explain">Ýokarda düşündirilişi ýaly, bu mesele üçin ikilenji simpleks usuly ulanylmaýar.</p>'; return; }
    if (d.status === 'infeasible') {
      out.innerHTML = '<div class="error-box sx-verdict"><b>Jogap: meseläniň mümkin çözgüdi ýok.</b> Çäklendirmeleri bir wagtda kanagatlandyrýan nokat ýok.' +
        (ref && ref.status === 'infeasible' ? ' Adaty simpleks usuly hem şeýle netije berdi ✓' : '') + '</div>';
      return;
    }
    if (d.status !== 'optimal') { out.innerHTML = '<div class="error-box">Çözgüt tapylmady.</div>'; return; }
    let h = '<div class="optimal-box sx-answer"><div class="sx-answer-z"><i>' + esc(p.objName) + '</i><sub>' + p.sense + '</sub> = ' + U.fmtBoth(d.z) + '</div>';
    h += '<div class="sx-answer-x">' + p.vars.map((v, j) => vn(v) + ' = ' + U.fmtBoth(d.x[j])).join(',&nbsp;&nbsp; ') + '</div></div>';
    h += '<div class="table-scroll"><table class="grid sx-check"><caption class="sr-only">Çäklendirmeleri barlamak</caption><thead><tr><th scope="col">№</th><th scope="col">Çäklendirme</th><th scope="col">X* goýlanda</th><th scope="col">Ýagdaýy</th></tr></thead><tbody>';
    p.cons.forEach((k, i) => {
      let lhs = S.fraction(0);
      k.a.forEach((a, j) => { lhs = lhs.add(a.mul(d.x[j])); });
      const diff = k.b.sub(lhs), tight = diff.compare(0) === 0;
      h += '<tr><td>' + (i + 1) + '</td><td class="sx-left"><span class="sx-eq">' + lin(k.a, p.vars) + ' ' + OP[k.op] + ' ' + fmtF(k.b) + '</span></td><td>' + fmtF(lhs) + ' ' + OP[k.op] + ' ' + fmtF(k.b) + ' ✓</td><td class="sx-left">' + (k.op === '=' ? 'deňlik' : tight ? '<b>işjeň</b> (deňlik bilen ýerine ýetýär)' : 'galyndy ' + fmtF(diff.abs())) + '</td></tr>';
    });
    h += '</tbody></table></div>';
    const notes = [];
    if (ref) {
      if (ref.status === 'optimal') notes.push((ref.z.equals(d.z) ? '<span class="or-ok">✓ Barlag:</span> adaty simpleks usuly (iki tapgyrly) hem ' : '<span class="or-bad">⚠ Barlag:</span> adaty simpleks usulynyň netijesi ') + '<i>' + esc(p.objName) + '</i>* = ' + fmtF(ref.z) + ' berdi.');
      else notes.push('<span class="or-bad">⚠</span> Adaty simpleks usulynyň netijesi: ' + esc(ref.status) + '.');
    }
    notes.push('Ikilenji simpleks usuly ' + (d.snapshots.length - 1) + ' özgertmede optimal meýilnama ýetdi.');
    h += '<ul class="sx-notes">' + notes.map((t) => '<li>' + t + '</li>').join('') + '</ul>';
    out.innerHTML = h;
    const q = 'Şu çyzykly programmirleme meselesi ikilenji simpleks usuly bilen çözüldi:\n' + $('lpText').value + '\nJogap: ' + p.objName + '* = ' + minus(d.z.toFraction()) + ', ' + p.vars.map((v, j) => v + ' = ' + minus(d.x[j].toFraction())).join(', ') +
      '. Ikilenji simpleks usulynyň ädimlerini (çykýan setir, giriji sütün) we bu jogaby gysga düşündir.';
    const row = document.createElement('div');
    row.className = 'or-ai-row';
    row.appendChild(U.aiButton(q));
    const link = document.createElement('a');
    link.className = 'classic-btn or-link-btn';
    link.href = 'simpleks.html#mesele=' + encodeURIComponent($('lpText').value);
    link.textContent = 'Adaty simpleks usuly bilen deňeşdir →';
    row.appendChild(link);
    out.appendChild(row);
  }
  function renderDual(d) {
    const p = d.problem, D = d.dual;
    const yn = D.vars;
    let h = '<p class="step-explain">Her çäklendirmä bir ikilenji üýtgeýän <i>y<sub>i</sub></i> degişli. ' + (p.sense === 'min' ? 'Min meseläniň ikilenjisi — max mesele' : 'Max meseläniň ikilenjisi — min mesele') + '; sag taraplar maksat funksiýasyna, maksat funksiýasynyň koeffisiýentleri bolsa sag taraplara geçýär.</p>';
    h += '<div class="sx-model"><p class="sx-eq">W = ' + lin(D.c, yn) + ' → ' + D.sense + '</p><ol class="sx-cons">';
    D.cons.forEach((k) => { h += '<li><span class="sx-eq">' + lin(k.a, yn) + ' ' + OP[k.op] + ' ' + fmtF(k.b) + '</span></li>'; });
    const sg = { '>=0': ' ≥ 0', '<=0': ' ≤ 0', free: ' — alamaty erkin' };
    h += '</ol><p class="sx-eq">' + D.signs.map((s, i) => vn(yn[i]) + sg[s]).join(', ') + '</p></div>';
    if (d.status === 'optimal') {
      h += '<p class="step-explain">Optimal tablisanyň goşmaça sütünlerindäki Δ bahalary ikilenji meseläniň çözgüdini berýär (−1-e köpeldilen setirleriň alamaty yzyna öwrülýär): ' +
        D.vars.map((v, i) => vn(v) + ' = ' + fmtF(d.y[i])).join(', ') + '.</p>';
      h += '<p class="step-explain">W* = ' + p.cons.map((k, i) => fmtF(k.b) + '·' + (d.y[i].compare(0) < 0 ? '(' + fmtF(d.y[i]) + ')' : fmtF(d.y[i]))).join(' + ') + ' = <b>' + fmtF(d.W) + '</b> ' + (d.W.equals(d.z) ? '= ' + esc(p.objName) + '* <span class="or-ok">✓</span> (berk ikilenjilik teoremasy)' : '≠ ' + esc(p.objName) + '* ⚠') + '.</p>';
      h += '<p class="step-explain">Kölege bahasy y<sub>i</sub>: i-nji çäklendirmäniň sag tarapy 1 birlik artanda ' + esc(p.objName) + '* näçe üýtgeýär (bazis üýtgemeýän çäkde).</p>';
    }
    $('dualView').innerHTML = h;
  }

  function solve(scroll) {
    U.showError('');
    try {
      const text = $('lpText').value;
      const p = S.parseText(text);
      U.setNumMode($('orNum').value);
      U.store(STORE, { text, num: $('orNum').value });
      const d = O.dualSimplex(p);
      let ref = null;
      try { ref = S.solve(p, { method: 'twoPhase' }); } catch (e) { ref = null; }
      renderModel(p); renderCanon(d); renderTableaux(d); renderAnswer(d, ref); renderDual(d);
      $('resultsSection').hidden = false;
      if (scroll) $('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      const known = e instanceof O.ORError || (S.SimplexError && e instanceof S.SimplexError);
      if (!known) console.error(e);
      $('resultsSection').hidden = true;
      U.showError(known ? e.message : 'Garaşylmadyk ýalňyşlyk: ' + e.message);
    }
  }
  function init() {
    const saved = U.restore(STORE);
    if (saved && typeof saved.text === 'string' && saved.text.trim()) {
      $('lpText').value = saved.text;
      if (saved.num === 'dec') $('orNum').value = 'dec';
    }
    U.presets(PRESETS, (p) => { $('lpText').value = p.text; solve(false); });
    $('lpText').addEventListener('input', U.unmarkPresets);
    $('lpText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); solve(true); } });
    $('solveBtn').addEventListener('click', () => solve(true));
    $('orNum').addEventListener('change', () => { if (!$('resultsSection').hidden) solve(false); });
  }
  init();
})();
