/* ==========================================================================
   Amatly.com — Oýunlar nazaryýeti (matrisa oýunlary): sahypanyň interfeýsi.
   Hasaplama: AmatlyOR.matrixGame (eýer nokady, agdyklyk, 2×2 formula, ÇP — AmatlySimplex).
   ========================================================================== */
(function () {
  'use strict';
  const O = window.AmatlyOR, U = window.AmatlyORUI, S = window.AmatlySimplex;
  if (!O || !U || !document.getElementById('gmGrid')) return;
  const { $, esc, fmtF, vn, lin, minus, svgEl } = U;
  const STORE = 'amatly_or_oyun_v1';
  const SUBD = '₀₁₂₃₄₅₆₇₈₉';
  const defRow = (i) => 'A' + SUBD[i + 1];
  const defCol = (j) => 'B' + SUBD[j + 1];
  const PRESETS = [
    { id: 'saddle', title: 'Eýer nokady', data: [[4, 5, 6], [3, 7, 2], [5, 6, 7]], rows: ['A₁', 'A₂', 'A₃'], cols: ['B₁', 'B₂', 'B₃'],
      story: 'Iki firma bazar üçin bäsleşýär; tablisada A firmanyň bazar paýynyň artmagy (%). Bu oýunda eýer nokady bar — iki tarap hem arassa strategiýany saýlaýar.' },
    { id: 'coin', title: '2×2: teňňe oýny', data: [[2, -1], [-1, 1]], rows: ['Ýüz', 'Arka'], cols: ['Ýüz', 'Arka'],
      story: 'Iki oýunçy teňňäniň bir tarapyny bir wagtda görkezýär. Gabat gelse — A utýar (2 ýa-da 1 bal), gabat gelmese — B 1 bal utýar. Eýer nokady ýok: 2×2 formula.' },
    { id: 'dom', title: 'Agdyklyk', data: [[1, 3, 4], [5, 2, 6], [0, 1, 2]], rows: ['A₁', 'A₂', 'A₃'], cols: ['B₁', 'B₂', 'B₃'],
      story: 'A₃ strategiýasy A₁-den hemişe pes, B₃ bolsa B₂-den hemişe gymmat — agdyklyk boýunça aýrylýar we 2×2 oýun galýar.' },
    { id: 'rps', title: 'Daş–gaýçy–kagyz', data: [[0, -1, 1], [1, 0, -1], [-1, 1, 0]], rows: ['Daş', 'Kagyz', 'Gaýçy'], cols: ['Daş', 'Kagyz', 'Gaýçy'],
      story: 'Daş gaýçyny, gaýçy kagyzy, kagyz daşy utýar. Agdyk strategiýa ýok — oýun simpleks usuly bilen çözülýär: her biri 1/3 ähtimallyk bilen.' },
    { id: '2xn', title: '2×4 (grafiki)', data: [[2, 3, 11, 7], [7, 5, 2, 4]], rows: ['A₁', 'A₂'], cols: ['B₁', 'B₂', 'B₃', 'B₄'],
      story: 'A oýunçynyň iki strategiýasy bar — grafiki usulda B-niň her strategiýasy bir göni çyzyk, aşaky gurşawyň iň ýokary nokady oýnuň çözgüdi.' },
  ];

  function build(m, n, st) {
    U.matrixInput($('gmGrid'), {
      rows: m, cols: n, names: true, data: st && st.data, rowNames: st && st.rows, colNames: st && st.cols,
      caption: 'Töleg matrisasy (A oýunçynyň utuşy)', corner: '<span class="or-muted">A \\ B</span>',
      rowLabel: defRow, colLabel: defCol,
      rowAria: (i) => 'A oýunçynyň ' + (i + 1) + '-nji strategiýasynyň ady', colAria: (j) => 'B oýunçynyň ' + (j + 1) + '-nji strategiýasynyň ady',
      cellLabel: (i, j) => 'A-nyň ' + (i + 1) + '-nji, B-niň ' + (j + 1) + '-nji strategiýasynda A-nyň utuşy',
    });
    $('gmRows').value = m; $('gmCols').value = n;
  }
  function current() {
    const g = U.readMatrixInput($('gmGrid'));
    return { data: g.data, rows: g.rowNames.map((x, i) => x || defRow(i)), cols: g.colNames.map((x, j) => x || defCol(j)) };
  }

  /* ------------------------------------------------------------------ 1) α, β, eýer nokady */
  function renderSaddle(r, st) {
    const A = r.A;
    let h = '<div class="table-scroll"><table class="grid or-mat"><caption class="sr-only">Töleg matrisasy, setirleriň iň kiçisi we sütünleriň iň ulusy</caption><thead><tr><th scope="col"><span class="or-muted">A \\ B</span></th>' +
      st.cols.map((c) => '<th scope="col">' + esc(c) + '</th>').join('') + '<th scope="col" class="or-side">min setir</th></tr></thead><tbody>';
    A.forEach((row, i) => {
      h += '<tr><th scope="row">' + esc(st.rows[i]) + '</th>';
      row.forEach((v, j) => { const sd = r.saddles.some(([a, b]) => a === i && b === j); h += '<td' + (sd ? ' class="is-saddle"' : '') + '>' + fmtF(v) + '</td>'; });
      h += '<td class="or-side' + (r.alphaRows.indexOf(i) >= 0 ? ' is-alpha' : '') + '">' + fmtF(r.rowMin[i]) + '</td></tr>';
    });
    h += '<tr><th scope="row" class="or-side">max sütün</th>' + r.colMax.map((v, j) => '<td class="or-side' + (r.betaCols.indexOf(j) >= 0 ? ' is-beta' : '') + '">' + fmtF(v) + '</td>').join('') + '<td class="or-side"></td></tr>';
    h += '</tbody></table></div>';
    h += '<p class="or-p"><b>Aşaky baha</b> α = max<sub>i</sub> min<sub>j</sub> a<sub>ij</sub> = <b>' + fmtF(r.alpha) + '</b> (' + r.alphaRows.map((i) => esc(st.rows[i])).join(', ') + ') — A oýunçy arassa strategiýa bilen şundan az utmajagyny kepillendirýär. ' +
      '<b>Ýokarky baha</b> β = min<sub>j</sub> max<sub>i</sub> a<sub>ij</sub> = <b>' + fmtF(r.beta) + '</b> (' + r.betaCols.map((j) => esc(st.cols[j])).join(', ') + ') — B oýunçy şundan köp utulmajagyny kepillendirýär.</p>';
    if (r.saddles.length) {
      h += '<div class="optimal-box">α = β = ' + fmtF(r.alpha) + ' — oýnuň <b>eýer nokady</b> bar: ' + r.saddles.map(([i, j]) => '(' + esc(st.rows[i]) + ', ' + esc(st.cols[j]) + ')').join(', ') + '. Iki oýunçy hem arassa strategiýany saýlaýar; strategiýasyny ýeke özi üýtgeden oýunçy diňe ýitirýär.</div>';
    } else {
      h += '<p class="or-p">α = ' + fmtF(r.alpha) + ' &lt; β = ' + fmtF(r.beta) + ' — eýer nokady ýok. Oýnuň bahasy α ≤ v ≤ β aralykda, we oýunçylar strategiýalaryny ähtimallyk bilen garyşdyrmaly (<b>garyşyk strategiýalar</b>).</p>';
    }
    $('saddleView').innerHTML = h;
  }

  /* ------------------------------------------------------------------ 2) agdyklyk */
  function renderDominance(r, st) {
    const sec = $('domSection');
    if (r.method === 'saddle') { sec.hidden = true; return; }
    sec.hidden = false;
    const A = r.A;
    let h = '';
    if (!r.steps.length) h += '<p class="or-p">Agdyk ýa-da gaýtalanýan strategiýa ýok — matrisa kiçeldilmeýär.</p>';
    else {
      h += '<ol class="sx-steps">';
      r.steps.forEach((s) => {
        if (s.type === 'row') {
          h += '<li>' + esc(st.rows[s.by]) + ' setiri ' + esc(st.rows[s.removed]) + ' setirinden ' + (s.same ? 'tapawutlanmaýar (gaýtalanýar)' : 'ähli galan sütünlerde ' + (s.strict ? 'uly' : 'uly ýa-da deň')) +
            ' — A oýunça ' + esc(st.rows[s.removed]) + ' gerek däl, ol aýrylýar.</li>';
        } else {
          h += '<li>' + esc(st.cols[s.by]) + ' sütüni ' + esc(st.cols[s.removed]) + ' sütüninden ' + (s.same ? 'tapawutlanmaýar (gaýtalanýar)' : 'ähli galan setirlerde ' + (s.strict ? 'kiçi' : 'kiçi ýa-da deň')) +
            ' — B oýunça (ol az tölemek isleýär) ' + esc(st.cols[s.removed]) + ' gerek däl, ol aýrylýar.</li>';
        }
      });
      h += '</ol>';
      h += '<div class="table-scroll"><table class="grid or-mat"><caption class="sr-only">Kiçeldilen matrisa</caption><thead><tr><th scope="col"></th>' +
        st.cols.map((c, j) => '<th scope="col"' + (r.cols.indexOf(j) < 0 ? ' class="is-removed"' : '') + '>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>';
      A.forEach((row, i) => {
        const rOut = r.rows.indexOf(i) < 0;
        h += '<tr><th scope="row"' + (rOut ? ' class="is-removed"' : '') + '>' + esc(st.rows[i]) + '</th>' + row.map((v, j) => '<td' + (rOut || r.cols.indexOf(j) < 0 ? ' class="is-removed"' : '') + '>' + fmtF(v) + '</td>').join('') + '</tr>';
      });
      h += '</tbody></table></div><p class="or-p">Galan oýun: ' + r.rows.length + ' × ' + r.cols.length + ' (' + r.rows.map((i) => esc(st.rows[i])).join(', ') + ' / ' + r.cols.map((j) => esc(st.cols[j])).join(', ') + ').</p>';
    }
    $('domView').innerHTML = h;
  }

  /* ------------------------------------------------------------------ 3) garyşyk strategiýalar */
  function lpText(lp) {
    const t = (a, names) => { let s = ''; a.forEach((f, j) => { if (f.compare(0) === 0) return; const neg = f.compare(0) < 0, ab = f.abs(); s += (s ? (neg ? ' - ' : ' + ') : (neg ? '-' : '')) + (ab.equals(1) ? '' : ab.toFraction()) + names[j]; }); return s || '0'; };
    return (lp.sense + ' ' + lp.objName + ' = ' + t(lp.c, lp.vars) + '\n' + lp.cons.map((k) => t(k.a, lp.vars) + ' ' + k.op + ' ' + k.b.toFraction()).join('\n'));
  }
  function renderMixed(r, st) {
    const sec = $('mixedSection');
    if (r.method === 'saddle') { sec.hidden = true; return; }
    sec.hidden = false;
    let h = '';
    if (r.method === 'reduced-pure') {
      h = '<p class="or-p">Agdyklyk boýunça kiçeldilenden soň oýunçylaryň biriniň ýeke strategiýasy galdy — oýun arassa strategiýalarda çözülýär.</p>';
    } else if (r.method === '2x2') {
      const [i1, i2] = r.rows, [j1, j2] = r.cols, A = r.A;
      const a = A[i1][j1], b = A[i1][j2], c = A[i2][j1], d = A[i2][j2];
      const w = (x) => (x.compare(0) < 0 ? '(' + fmtF(x) + ')' : fmtF(x));
      h += '<p class="or-p">2×2 oýunda eýer nokady ýok bolsa, optimal strategiýalar formula bilen tapylýar. Matrisa: a = ' + fmtF(a) + ', b = ' + fmtF(b) + ', c = ' + fmtF(c) + ', d = ' + fmtF(d) + ' (' + esc(st.rows[i1]) + '/' + esc(st.rows[i2]) + ' × ' + esc(st.cols[j1]) + '/' + esc(st.cols[j2]) + ').</p>';
      h += '<ul class="sx-steps"><li>D = a + d − b − c = ' + fmtF(a) + ' + ' + w(d) + ' − ' + w(b) + ' − ' + w(c) + ' = <b>' + fmtF(r.D) + '</b></li>';
      h += '<li>p<sub>1</sub> = (d − c) / D = (' + fmtF(d) + ' − ' + w(c) + ') / ' + w(r.D) + ' = <b>' + fmtF(r.p[i1]) + '</b>, &nbsp; p<sub>2</sub> = 1 − p<sub>1</sub> = ' + fmtF(r.p[i2]) + '</li>';
      h += '<li>q<sub>1</sub> = (d − b) / D = (' + fmtF(d) + ' − ' + w(b) + ') / ' + w(r.D) + ' = <b>' + fmtF(r.q[j1]) + '</b>, &nbsp; q<sub>2</sub> = 1 − q<sub>1</sub> = ' + fmtF(r.q[j2]) + '</li>';
      h += '<li>v = (ad − bc) / D = (' + fmtF(a) + '·' + w(d) + ' − ' + w(b) + '·' + w(c) + ') / ' + w(r.D) + ' = <b>' + fmtF(r.v) + '</b></li></ul>';
    } else if (r.method === 'lp') {
      const k = r.shift, lp = r.lp;
      h += '<p class="or-p">Umumy ýagdaýda oýun çyzykly programmirleme meselesine öwrülýär. ' + (k.compare(0) > 0 ? 'Ähli elementler položitel bolar ýaly, galan matrisa k = <b>' + fmtF(k) + '</b> goşulýar (bu strategiýalary üýtgetmeýär, diňe bahany k-a süýşürýär): v′ = v + k.' : 'Galan matrisanyň ähli elementleri eýýäm položitel (k = 0).') + '</p>';
      const yv = lp.B.vars, xv = lp.A.vars;
      h += '<div class="or-two"><div><h3 class="sx-sub">B oýunçy üçin</h3><div class="sx-model"><p class="sx-eq">W = ' + lin(lp.B.c, yv) + ' → max</p><ol class="sx-cons">' +
        lp.B.cons.map((c) => '<li><span class="sx-eq">' + lin(c.a, yv) + ' ≤ 1</span></li>').join('') + '</ol><p class="sx-eq">' + yv.map(vn).join(', ') + ' ≥ 0</p></div>' +
        '<p class="or-p">Simpleks: W* = ' + fmtF(lp.rB.z) + ', y* = (' + lp.rB.x.map((v) => fmtF(v)).join('; ') + ')</p></div>';
      h += '<div><h3 class="sx-sub">A oýunçy üçin</h3><div class="sx-model"><p class="sx-eq">F = ' + lin(lp.A.c, xv) + ' → min</p><ol class="sx-cons">' +
        lp.A.cons.map((c) => '<li><span class="sx-eq">' + lin(c.a, xv) + ' ≥ 1</span></li>').join('') + '</ol><p class="sx-eq">' + xv.map(vn).join(', ') + ' ≥ 0</p></div>' +
        '<p class="or-p">Simpleks: F* = ' + fmtF(lp.rA.z) + ', x* = (' + lp.rA.x.map((v) => fmtF(v)).join('; ') + ')</p></div></div>';
      h += '<ul class="sx-steps"><li>v′ = 1 / W* = 1 / ' + fmtF(lp.rB.z) + ' = <b>' + fmtF(lp.vPrime) + '</b>' + (lp.agree ? ' (1 / F* hem şeýle — ikilenji meseleler ✓)' : '') + '</li>';
      h += '<li>Oýnuň bahasy v = v′ − k = ' + fmtF(lp.vPrime) + ' − ' + fmtF(k) + ' = <b>' + fmtF(r.v) + '</b></li>';
      h += '<li>q<sub>j</sub> = v′·y<sub>j</sub>, p<sub>i</sub> = v′·x<sub>i</sub> (galan strategiýalar üçin; aýrylanlaryňky 0).</li></ul>';
      const a = document.createElement('a');
      void a;
      h += '<p class="or-ai-row"><a class="classic-btn or-link-btn" href="simpleks.html#mesele=' + encodeURIComponent(lpText(lp.B)) + '">B-niň meselesini simpleks tablisalary bilen gör →</a></p>';
    }
    $('mixedView').innerHTML = h;
  }

  /* ------------------------------------------------------------------ 4) grafiki usul */
  function renderGraph(r, st) {
    const sec = $('graphSection');
    if (!r.graph || r.method === 'saddle') { sec.hidden = true; return; }
    sec.hidden = false;
    const g = r.graph, A2 = g.kind === '2xn';
    const lines = g.lines.map((L) => ({ id: L.id, y0: L.y0.valueOf(), y1: L.y1.valueOf() }));
    const all = lines.flatMap((L) => [L.y0, L.y1]);
    let lo = Math.min(...all, r.v.valueOf()), hi = Math.max(...all, r.v.valueOf());
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const padv = (hi - lo) * 0.08; lo -= padv; hi += padv;
    const W = 560, H = 360, L = 50, R = 70, T = 14, B = 40;
    const sx = (t) => L + t * (W - L - R), sy = (y) => T + (1 - (y - lo) / (hi - lo)) * (H - T - B);
    const svg = svgEl('svg', { class: 'or-svg or-game-plot', viewBox: '0 0 ' + W + ' ' + H, width: W, role: 'img',
      'aria-label': A2 ? 'Grafiki usul: B-niň strategiýalary üçin göni çyzyklar we aşaky gurşaw' : 'Grafiki usul: A-nyň strategiýalary üçin göni çyzyklar we ýokarky gurşaw' });
    /* tor */
    const step = (() => { const raw = (hi - lo) / 6, e = Math.pow(10, Math.floor(Math.log10(raw))); for (const m of [1, 2, 5, 10]) if (m * e >= raw) return m * e; return 10 * e; })();
    for (let y = Math.ceil(lo / step) * step; y <= hi + 1e-9; y += step) {
      svg.appendChild(svgEl('line', { class: 'grid-l', x1: sx(0), y1: sy(y), x2: sx(1), y2: sy(y) }));
      svg.appendChild(svgEl('text', { class: 'tick', x: L - 6, y: sy(y) + 4, 'text-anchor': 'end' }, minus(String(+y.toPrecision(6)))));
    }
    [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
      svg.appendChild(svgEl('line', { class: 'grid-l', x1: sx(t), y1: sy(lo), x2: sx(t), y2: sy(hi) }));
      svg.appendChild(svgEl('text', { class: 'tick', x: sx(t), y: H - B + 16, 'text-anchor': 'middle' }, String(t)));
    });
    svg.appendChild(svgEl('line', { class: 'axis', x1: sx(0), y1: sy(lo), x2: sx(0), y2: sy(hi) }));
    svg.appendChild(svgEl('line', { class: 'axis', x1: sx(1), y1: sy(lo), x2: sx(1), y2: sy(hi) }));
    svg.appendChild(svgEl('text', { class: 'tick', x: (sx(0) + sx(1)) / 2, y: H - 6, 'text-anchor': 'middle' }, A2 ? 'p — A-nyň «' + st.rows[g.rows[0]] + '» strategiýasynyň ähtimallygy' : 'q — B-niň «' + st.cols[g.cols[0]] + '» strategiýasynyň ähtimallygy'));
    const palette = ['--or-blue', '--or-green', '--or-red', '--or-path', '--or-ink'];
    lines.forEach((Ln, k) => {
      const col = 'var(' + palette[k % palette.length] + ')';
      svg.appendChild(svgEl('line', { x1: sx(0), y1: sy(Ln.y0), x2: sx(1), y2: sy(Ln.y1), stroke: col, 'stroke-width': 1.6, 'stroke-dasharray': k >= palette.length ? '6 4' : '' }));
      svg.appendChild(svgEl('text', { class: 'tick', x: sx(1) + 6, y: sy(Ln.y1) + 4, fill: col }, A2 ? st.cols[Ln.id] : st.rows[Ln.id]));
    });
    /* gurşaw: 2×n — aşaky (min), m×2 — ýokarky (max) */
    const env = (t) => { const vals = lines.map((Ln) => Ln.y0 + (Ln.y1 - Ln.y0) * t); return A2 ? Math.min(...vals) : Math.max(...vals); };
    let d = '';
    for (let i = 0; i <= 200; i++) { const t = i / 200; d += (i ? 'L' : 'M') + sx(t).toFixed(2) + ' ' + sy(env(t)).toFixed(2); }
    svg.appendChild(svgEl('path', { d, fill: 'none', stroke: 'var(--text)', 'stroke-width': 3.2, opacity: 0.85 }));
    const t0 = A2 ? r.p[g.rows[0]].valueOf() : r.q[g.cols[0]].valueOf();
    svg.appendChild(svgEl('line', { x1: sx(t0), y1: sy(lo), x2: sx(t0), y2: sy(r.v.valueOf()), stroke: 'var(--or-path)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
    svg.appendChild(svgEl('circle', { cx: sx(t0), cy: sy(r.v.valueOf()), r: 6.5, class: 'opt-int' }));
    svg.appendChild(svgEl('text', { class: 'tick', x: sx(t0) + 9, y: sy(r.v.valueOf()) - 9 }, 'v = ' + minus(fmtF(r.v))));
    const wrap = document.createElement('div');
    wrap.className = 'or-figure';
    wrap.appendChild(svg);
    $('graphView').innerHTML = '<p class="or-p">' + (A2
      ? 'A oýunçy «' + esc(st.rows[g.rows[0]]) + '» strategiýasyny p ähtimallyk bilen saýlasa, B-niň her strategiýasyna garşy garaşylýan utuş p-niň çyzykly funksiýasy (göni çyzyk). B iň amatsyzyny saýlaýar — <b>aşaky gurşaw</b> (galyň çyzyk). A onuň iň ýokary nokadyny saýlaýar.'
      : 'B oýunçy «' + esc(st.cols[g.cols[0]]) + '» strategiýasyny q ähtimallyk bilen saýlasa, A-nyň her strategiýasyna garşy töleg q-nyň çyzykly funksiýasy. A iň peýdalysyny saýlaýar — <b>ýokarky gurşaw</b>. B onuň iň aşaky nokadyny saýlaýar.') + '</p>';
    $('graphView').appendChild(wrap);
  }

  /* ------------------------------------------------------------------ 5) jogap we barlag */
  function renderAnswer(r, st) {
    const out = $('answerView');
    let h = '<div class="optimal-box sx-answer"><div class="sx-answer-z">Oýnuň bahasy v = ' + U.fmtBoth(r.v) + '</div>';
    const strat = (vec, names) => vec.map((x, i) => (x.compare(0) ? esc(names[i]) + ': ' + fmtF(x) : '')).filter(Boolean).join(' · ');
    h += '<div class="sx-answer-vec">A: p* = (' + r.p.map((x) => fmtF(x)).join('; ') + ') &nbsp;|&nbsp; B: q* = (' + r.q.map((x) => fmtF(x)).join('; ') + ')</div></div>';
    const bars = (vec, names, cls) => '<div class="or-bars">' + vec.map((x, i) => '<div class="or-bar ' + cls + '"><span>' + esc(names[i]) + '</span><span class="or-bar-track"><i style="width:' + (x.valueOf() * 100).toFixed(2) + '%"></i></span><b>' + fmtF(x) + '</b></div>').join('') + '</div>';
    h += '<div class="or-two"><div><h3 class="sx-sub">A oýunçynyň optimal strategiýasy</h3>' + bars(r.p, st.rows, 'a') + '</div><div><h3 class="sx-sub">B oýunçynyň optimal strategiýasy</h3>' + bars(r.q, st.cols, 'b') + '</div></div>';
    h += '<p class="or-p">Ýagny A: ' + strat(r.p, st.rows) + '; B: ' + strat(r.q, st.cols) + '.</p>';
    /* barlag */
    h += '<h3 class="sx-sub">Barlag</h3><div class="table-scroll"><table class="grid or-mat"><caption class="sr-only">Optimal strategiýalaryň barlagy</caption><thead><tr><th scope="col">A p* bilen oýnanda, B-niň strategiýasy</th>' + st.cols.map((c) => '<th scope="col">' + esc(c) + '</th>').join('') + '</tr></thead><tbody><tr><th scope="row">A-nyň garaşylýan utuşy</th>' +
      r.check.colPay.map((s) => '<td' + (s.compare(r.v) >= 0 ? '' : ' class="or-bad"') + '>' + fmtF(s) + (s.compare(r.v) >= 0 ? ' ≥ v ✓' : ' &lt; v ✗') + '</td>').join('') + '</tr></tbody></table></div>';
    h += '<div class="table-scroll"><table class="grid or-mat"><caption class="sr-only">B-niň strategiýasynyň barlagy</caption><thead><tr><th scope="col">B q* bilen oýnanda, A-nyň strategiýasy</th>' + st.rows.map((c) => '<th scope="col">' + esc(c) + '</th>').join('') + '</tr></thead><tbody><tr><th scope="row">A-nyň garaşylýan utuşy</th>' +
      r.check.rowPay.map((s) => '<td' + (s.compare(r.v) <= 0 ? '' : ' class="or-bad"') + '>' + fmtF(s) + (s.compare(r.v) <= 0 ? ' ≤ v ✓' : ' &gt; v ✗') + '</td>').join('') + '</tr></tbody></table></div>';
    h += '<p class="or-p">' + (r.check.ok ? '<span class="or-ok">✓ Strategiýalar optimal:</span> A p* bilen B näme etse-de azyndan v utýar, B q* bilen A näme etse-de v-den köp utdurmaýar.' : '<span class="or-bad">⚠ Barlag geçmedi.</span>') + '</p>';
    out.innerHTML = h;
    const q = 'Matrisa oýny (A oýunçynyň utuşy), setirler ' + st.rows.join(', ') + ', sütünler ' + st.cols.join(', ') + ': ' + r.A.map((row) => '[' + row.map((v) => minus(v.toFraction())).join(', ') + ']').join(', ') +
      '. Tapylan çözgüt: v = ' + minus(r.v.toFraction()) + ', p* = (' + r.p.map((x) => x.toFraction()).join('; ') + '), q* = (' + r.q.map((x) => x.toFraction()).join('; ') + '). Bu çözgüdi we usuly (eýer nokady, agdyklyk, garyşyk strategiýalar) gysga düşündir.';
    const row = document.createElement('div');
    row.className = 'or-ai-row';
    row.appendChild(U.aiButton(q));
    out.appendChild(row);
  }

  function solve(scroll) {
    U.showError('');
    try {
      const st = current();
      U.store(STORE, st);
      const A = O.parseMatrix(st.data, 'Töleg matrisasy');
      U.setNumMode($('orNum').value);
      const r = O.matrixGame(A);
      renderSaddle(r, st); renderDominance(r, st); renderMixed(r, st); renderGraph(r, st); renderAnswer(r, st);
      $('resultsSection').hidden = false;
      if (scroll) $('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      const known = e instanceof O.ORError || (S && S.SimplexError && e instanceof S.SimplexError);
      if (!known) console.error(e);
      $('resultsSection').hidden = true;
      U.showError(known ? e.message : 'Garaşylmadyk ýalňyşlyk: ' + e.message);
    }
  }
  function init() {
    const saved = U.restore(STORE);
    const st = saved && saved.data && saved.data.length ? saved : PRESETS[2];
    build(st.data.length, st.data[0].length, { data: st.data.map((r) => r.map(String)), rows: st.rows, cols: st.cols });
    U.gridKeys($('gmGrid'));
    $('gmGen').addEventListener('click', () => {
      const m = Math.max(1, Math.min(8, Math.round(+$('gmRows').value || 2)));
      const n = Math.max(1, Math.min(8, Math.round(+$('gmCols').value || 2)));
      const old = current();
      build(m, n, { data: Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => (old.data[i] && old.data[i][j] !== undefined ? old.data[i][j] : ''))),
        rows: Array.from({ length: m }, (_, i) => old.rows[i] || defRow(i)), cols: Array.from({ length: n }, (_, j) => old.cols[j] || defCol(j)) });
      U.unmarkPresets();
    });
    U.presets(PRESETS, (p) => { build(p.data.length, p.data[0].length, { data: p.data.map((r) => r.map(String)), rows: p.rows, cols: p.cols }); solve(false); });
    $('gmGrid').addEventListener('input', U.unmarkPresets);
    $('solveBtn').addEventListener('click', () => solve(true));
    $('orNum').addEventListener('change', () => { if (!$('resultsSection').hidden) solve(false); });
  }
  init();
})();
