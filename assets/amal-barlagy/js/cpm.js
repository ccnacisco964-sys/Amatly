/* ==========================================================================
   Amatly.com — Tor meýilnamasy (CPM we PERT): sahypanyň interfeýsi.
   Hasaplama: AmatlyOR.parseActivities, AmatlyOR.network. Diagrammalar — SVG.
   ========================================================================== */
(function () {
  'use strict';
  const O = window.AmatlyOR, U = window.AmatlyORUI;
  if (!O || !U || !document.getElementById('actTable')) return;
  const { $, esc, fmtN, svgEl } = U;
  const STORE = 'amatly_or_cpm_v1';
  const PRESETS = [
    { id: 'house', title: 'Öý gurmak (CPM)', mode: 'cpm', rows: [
      { name: 'A', desc: 'Taslama we resminamalar', pred: '', d: '4' },
      { name: 'B', desc: 'Binýat', pred: 'A', d: '6' },
      { name: 'C', desc: 'Diwarlar', pred: 'B', d: '10' },
      { name: 'D', desc: 'Elektrik ulgamy', pred: 'C', d: '5' },
      { name: 'E', desc: 'Suw we lagym', pred: 'C', d: '4' },
      { name: 'F', desc: 'Üçek', pred: 'C', d: '7' },
      { name: 'G', desc: 'Içki bezeg', pred: 'D, E, F', d: '8' },
      { name: 'H', desc: 'Howly abadanlaşdyrmak', pred: 'F', d: '3' },
      { name: 'I', desc: 'Kabul etmek', pred: 'G, H', d: '1' },
    ], story: 'Bir gatly öýüň gurluşygy (wagt hepdelerde). Haýsy işler gijikse, tutuş gurluşyk gijigýär?' },
    { id: 'soft', title: 'Programma taslamasy (CPM)', mode: 'cpm', rows: [
      { name: 'A', desc: 'Talaplary ýygnamak', pred: '', d: '3' },
      { name: 'B', desc: 'Dizaýn', pred: 'A', d: '4' },
      { name: 'C', desc: 'Maglumatlar binýady', pred: 'A', d: '5' },
      { name: 'D', desc: 'Interfeýs', pred: 'B', d: '6' },
      { name: 'E', desc: 'Serwer bölegi', pred: 'B, C', d: '7' },
      { name: 'F', desc: 'Synag', pred: 'D, E', d: '3' },
      { name: 'G', desc: 'Resminamalar', pred: 'D', d: '2' },
      { name: 'H', desc: 'Ýaýratmak', pred: 'F, G', d: '1' },
    ], story: 'Kiçi programma taslamasy (wagt günlerde). Iki toparyň işi parallel barýar.' },
    { id: 'pert', title: 'PERT mysaly', mode: 'pert', target: '20', rows: [
      { name: 'A', desc: 'Taýýarlyk', pred: '', a: '2', m: '3', b: '6' },
      { name: 'B', desc: 'Enjamlary sargamak', pred: 'A', a: '4', m: '6', b: '14' },
      { name: 'C', desc: 'Işgärleri okatmak', pred: 'A', a: '3', m: '4', b: '5' },
      { name: 'D', desc: 'Gurnamak', pred: 'B', a: '2', m: '4', b: '6' },
      { name: 'E', desc: 'Synag işi', pred: 'C, D', a: '1', m: '2', b: '9' },
      { name: 'F', desc: 'Işe girizmek', pred: 'E', a: '1', m: '1', b: '1' },
    ], story: 'Täze önümçilik liniýasyny işe girizmek (hepdeler). Her iş üçin üç baha berlen. Taslama 20 hepdede gutarmagynyň ähtimallygy näçe?' },
  ];
  let mode = 'cpm';
  let rows = [];

  /* ------------------------------------------------------------------ girizme tablisasy */
  function head() {
    $('actTable').querySelector('thead').innerHTML = '<tr><th scope="col">№</th><th scope="col">Iş</th><th scope="col">Düşündiriş <span class="or-muted">(hökman däl)</span></th><th scope="col">Öňki işler</th>' +
      (mode === 'pert' ? '<th scope="col">a <span class="or-muted">(optimistik)</span></th><th scope="col">m <span class="or-muted">(iň ähtimal)</span></th><th scope="col">b <span class="or-muted">(pessimistik)</span></th>' : '<th scope="col">Dowamlylyk</th>') +
      '<th scope="col"><span class="sr-only">Pozmak</span></th></tr>';
  }
  function inp(i, key, cls, label, mode2) {
    const v = rows[i][key] === undefined ? '' : rows[i][key];
    return '<td><input type="text" class="' + cls + '" data-row="' + i + '" data-key="' + key + '" value="' + esc(v) + '" aria-label="' + esc((i + 1) + '-nji iş: ' + label) + '"' + (mode2 ? ' inputmode="' + mode2 + '"' : '') + ' autocomplete="off" spellcheck="false"></td>';
  }
  function body() {
    let h = '';
    rows.forEach((r, i) => {
      h += '<tr><td>' + (i + 1) + '</td>' + inp(i, 'name', 'w-name', 'ady') + inp(i, 'desc', 'w-desc', 'düşündiriş') + inp(i, 'pred', 'w-pred', 'öňki işler');
      if (mode === 'pert') h += inp(i, 'a', 'w-num', 'a', 'decimal') + inp(i, 'm', 'w-num', 'm', 'decimal') + inp(i, 'b', 'w-num', 'b', 'decimal');
      else h += inp(i, 'd', 'w-num', 'dowamlylyk', 'decimal');
      h += '<td><button type="button" class="or-del" data-del="' + i + '" aria-label="' + (i + 1) + '-nji işi poz" title="Poz">×</button></td></tr>';
    });
    $('actTable').querySelector('tbody').innerHTML = h;
  }
  function render() { head(); body(); document.querySelector('.or-pert-only').hidden = mode !== 'pert'; }
  function setMode(next) {
    if (next === mode) return;
    rows.forEach((r) => {
      if (next === 'pert' && !String(r.m || '').trim() && String(r.d || '').trim()) { r.a = r.d; r.m = r.d; r.b = r.d; }
      if (next === 'cpm' && !String(r.d || '').trim() && String(r.m || '').trim()) {
        const a = +String(r.a).replace(',', '.'), m = +String(r.m).replace(',', '.'), b = +String(r.b).replace(',', '.');
        if (isFinite(a) && isFinite(m) && isFinite(b)) r.d = String(Math.round((a + 4 * m + b) / 6 * 100) / 100);
      }
    });
    mode = next;
    document.querySelector('input[name="netMode"][value="' + mode + '"]').checked = true;
    render();
  }

  /* ------------------------------------------------------------------ netijeler */
  const nm = (res, i) => esc(res.acts[i].name);
  function renderAnswer(res) {
    const T = res.T, acts = res.acts;
    let h = '<div class="or-cards"><div class="or-card is-crit"><b>' + fmtN(T) + '</b><span>taslamanyň iň gysga möhleti T</span></div>' +
      '<div class="or-card"><b>' + res.crit.filter(Boolean).length + ' / ' + acts.length + '</b><span>kritiki işler</span></div>';
    if (res.pert) {
      h += '<div class="or-card"><b>' + fmtN(res.pert.sigma, 3) + '</b><span>σ<sub>T</sub> — möhletiň standart gyşarmasy</span></div>';
      if (res.pert.prob !== undefined) h += '<div class="or-card"><b>' + fmtN(res.pert.prob * 100, 1) + '%</b><span>P(T ≤ ' + fmtN(res.pert.target) + ')</span></div>';
    }
    h += '</div>';
    h += '<div class="optimal-box">Kritiki ýol' + (res.paths.length > 1 ? 'lar' : '') + ': ' + res.paths.map((p) => p.map((i) => nm(res, i)).join(' → ')).join(' &nbsp;|&nbsp; ') + ' &nbsp;(uzynlygy ' + fmtN(T) + ')</div>';
    const free = acts.map((_, i) => i).filter((i) => !res.crit[i]).sort((a, b) => res.TF[b] - res.TF[a]);
    if (free.length) h += '<p class="or-p">Ätiýajy iň köp işler: ' + free.slice(0, 4).map((i) => '<b>' + nm(res, i) + '</b> (' + fmtN(res.TF[i]) + ')').join(', ') + ' — bu işleri ätiýajynyň çäginde gijikdirmek ýa-da serişdelerini kritiki işlere bermek bolýar.</p>';
    $('answerView').innerHTML = h;
    const q = 'Tor meýilnamasy (' + (mode === 'pert' ? 'PERT' : 'CPM') + '): ' + acts.map((a) => a.name + (a.desc ? ' (' + a.desc + ')' : '') + ': ' + (a.pred.length ? 'öňki işler ' + a.pred.map((k) => acts[k].name).join(', ') : 'öňki iş ýok') + ', dowamlylyk ' + fmtN(a.d)).join('; ') +
      '. Hasaplama: T = ' + fmtN(T) + ', kritiki ýol ' + res.paths.map((p) => p.map((i) => acts[i].name).join('-')).join(' we ') + (res.pert && res.pert.prob !== undefined ? ', P(T ≤ ' + res.pert.target + ') = ' + fmtN(res.pert.prob * 100, 1) + '%' : '') + '. Kritiki ýoly, ätiýaçlary we näme etmelidigini gysga düşündir.';
    const row = document.createElement('div');
    row.className = 'or-ai-row';
    row.appendChild(U.aiButton(q));
    $('answerView').appendChild(row);
  }
  function renderTimes(res) {
    const pert = !!res.pert;
    let h = '<div class="table-scroll"><table class="grid or-times"><caption class="sr-only">Işleriň möhletleri we ätiýaçlary</caption><thead><tr><th scope="col">Iş</th>' +
      (pert ? '<th scope="col">t<sub>e</sub> = (a + 4m + b)/6</th><th scope="col">σ² = ((b − a)/6)²</th>' : '<th scope="col">t</th>') +
      '<th scope="col">ES</th><th scope="col">EF</th><th scope="col">LS</th><th scope="col">LF</th><th scope="col">TF</th><th scope="col">FF</th><th scope="col">Kritiki</th></tr></thead><tbody>';
    res.order.forEach((i) => {
      const a = res.acts[i], c = res.crit[i];
      h += '<tr' + (c ? ' class="is-crit"' : '') + '><th scope="row">' + esc(a.name) + (a.desc ? ' <span class="or-muted">— ' + esc(a.desc) + '</span>' : '') + '</th>' +
        (pert ? '<td>' + fmtN(a.d, 3) + '</td><td>' + fmtN(a.var, 3) + '</td>' : '<td>' + fmtN(a.d) + '</td>') +
        '<td>' + fmtN(res.ES[i]) + '</td><td>' + fmtN(res.EF[i]) + '</td><td>' + fmtN(res.LS[i]) + '</td><td>' + fmtN(res.LF[i]) + '</td><td>' + fmtN(res.TF[i]) + '</td><td>' + fmtN(res.FF[i]) + '</td><td>' + (c ? '<b class="or-bad">✓ kritiki</b>' : '—') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<p class="step-explain">ES / EF — irki başlanmak / gutarmak, LS / LF — giçki başlanmak / gutarmak, TF = LS − ES — umumy ätiýaç, FF — hususy ätiýaç (soňky işleriň irki başlanmagyna täsir etmezden). Işler topologik tertipde: her iş öňki işlerinden soň gelýär.</p>';
    $('timesView').innerHTML = h;
  }
  /* ------------------------------------------------------------------ tor diagrammasy (AON) */
  function renderNet(res) {
    const acts = res.acts, N = acts.length;
    const maxL = Math.max(0, ...res.level);
    const cols = Array.from({ length: maxL + 1 }, () => []);
    res.order.forEach((i) => cols[res.level[i]].push(i));
    cols.forEach((c) => c.sort((a, b) => res.ES[a] - res.ES[b] || a - b));
    const BW = 128, BH = 66, GX = 58, GY = 22, SE = 40;
    const maxRows = Math.max(...cols.map((c) => c.length));
    const Hh = maxRows * (BH + GY) - GY + 20;
    const pos = new Array(N);
    cols.forEach((c, L) => {
      const colH = c.length * (BH + GY) - GY, top = (Hh - colH) / 2;
      c.forEach((i, k) => { pos[i] = { x: SE + GX + L * (BW + GX), y: top + k * (BH + GY) }; });
    });
    const W = SE + GX + (maxL + 1) * (BW + GX) + SE;
    const svg = svgEl('svg', { class: 'or-svg or-net', viewBox: '0 0 ' + W + ' ' + Hh, width: W, role: 'img', 'aria-label': 'Tor diagrammasy: ' + N + ' iş, kritiki ýol gyzyl',
      style: 'min-width:' + Math.round(Math.min(W, Math.max(520, W * 0.82))) + 'px' });
    const defs = svgEl('defs');
    ['n', 'c'].forEach((k) => {
      const m = svgEl('marker', { id: 'arr-' + k, viewBox: '0 0 10 10', refX: 9, refY: 5, markerUnits: 'userSpaceOnUse', markerWidth: 10, markerHeight: 10, orient: 'auto-start-reverse' });
      m.appendChild(svgEl('path', { d: 'M0 0 L10 5 L0 10 z', fill: k === 'c' ? 'var(--or-crit)' : 'var(--or-edge)' }));
      defs.appendChild(m);
    });
    svg.appendChild(defs);
    const sx = SE / 2 + 4, sy = Hh / 2, fx = W - SE / 2 - 4;
    const arc = (x1, y1, x2, y2, crit) => {
      const dx = Math.max(24, (x2 - x1) / 2);
      svg.appendChild(svgEl('path', { class: 'arc' + (crit ? ' crit' : ''), d: 'M' + x1 + ' ' + y1 + ' C' + (x1 + dx) + ' ' + y1 + ' ' + (x2 - dx) + ' ' + y2 + ' ' + x2 + ' ' + y2, 'marker-end': 'url(#arr-' + (crit ? 'c' : 'n') + ')' }));
    };
    const eps = 1e-9;
    acts.forEach((a, i) => {
      const p = pos[i];
      if (!a.pred.length) arc(sx + 14, sy, p.x - 2, p.y + BH / 2, res.crit[i] && Math.abs(res.ES[i]) < eps);
      a.pred.forEach((k) => arc(pos[k].x + BW, pos[k].y + BH / 2, p.x - 2, p.y + BH / 2, res.crit[i] && res.crit[k] && Math.abs(res.EF[k] - res.ES[i]) < eps));
      if (!res.succ[i].length) arc(p.x + BW, p.y + BH / 2, fx - 16, sy, res.crit[i] && Math.abs(res.EF[i] - res.T) < eps);
    });
    [[sx, 'Başla'], [fx, 'Gutar']].forEach(([x, t]) => {
      svg.appendChild(svgEl('circle', { class: 'se', cx: x, cy: sy, r: 15 }));
      svg.appendChild(svgEl('text', { x, y: sy + 32, 'text-anchor': 'middle', class: 'nnum' }, t));
    });
    acts.forEach((a, i) => {
      const p = pos[i];
      const g = svgEl('g', { class: res.crit[i] ? 'crit' : '', transform: 'translate(' + p.x + ' ' + p.y + ')' });
      g.appendChild(svgEl('rect', { class: 'nbox', width: BW, height: BH, rx: 6 }));
      g.appendChild(svgEl('line', { class: 'nsep', x1: 0, y1: 20, x2: BW, y2: 20 }));
      g.appendChild(svgEl('line', { class: 'nsep', x1: 0, y1: BH - 20, x2: BW, y2: BH - 20 }));
      [BW / 3, 2 * BW / 3].forEach((x) => { g.appendChild(svgEl('line', { class: 'nsep', x1: x, y1: 0, x2: x, y2: 20 })); g.appendChild(svgEl('line', { class: 'nsep', x1: x, y1: BH - 20, x2: x, y2: BH })); });
      const cell = (txt, cx, cy, cls) => g.appendChild(svgEl('text', { x: cx, y: cy, 'text-anchor': 'middle', class: cls || 'nnum' }, txt));
      cell(fmtN(res.ES[i]), BW / 6, 14); cell(fmtN(a.d), BW / 2, 14); cell(fmtN(res.EF[i]), 5 * BW / 6, 14);
      cell(a.name, BW / 2, BH / 2 + 5, 'nname');
      cell(fmtN(res.LS[i]), BW / 6, BH - 6); cell(fmtN(res.TF[i]), BW / 2, BH - 6); cell(fmtN(res.LF[i]), 5 * BW / 6, BH - 6);
      const tt = svgEl('title', {}, a.name + (a.desc ? ' — ' + a.desc : '') + ': ES ' + fmtN(res.ES[i]) + ', EF ' + fmtN(res.EF[i]) + ', LS ' + fmtN(res.LS[i]) + ', LF ' + fmtN(res.LF[i]) + ', TF ' + fmtN(res.TF[i]));
      g.appendChild(tt);
      svg.appendChild(g);
    });
    const wrap = document.createElement('div');
    wrap.className = 'or-figure';
    wrap.appendChild(svg);
    $('netView').innerHTML = '';
    $('netView').appendChild(wrap);
    $('netView').insertAdjacentHTML('beforeend', '<div class="or-legend"><span>Düwün: ýokarda <b>ES · t · EF</b>, ortada iş, aşakda <b>LS · TF · LF</b></span><span><i class="or-sw or-sw-crit"></i> kritiki ýol</span></div>');
  }
  /* ------------------------------------------------------------------ Gant diagrammasy */
  function renderGantt(res) {
    const acts = res.acts, T = Math.max(res.T, 1e-9);
    const rowsI = res.order.slice();
    const LBL = 84, W = 760, RH = 28, TOP = 26, R = 20;
    const H = TOP + rowsI.length * RH + 10;
    const sx = (t) => LBL + t / T * (W - LBL - R);
    const svg = svgEl('svg', { class: 'or-svg or-gantt', viewBox: '0 0 ' + W + ' ' + H, width: W, role: 'img', 'aria-label': 'Gant diagrammasy: işleriň irki möhletleri we ätiýaçlary' });
    const step = (() => { const raw = T / 10, e = Math.pow(10, Math.floor(Math.log10(raw))); for (const m of [1, 2, 5, 10]) if (m * e >= raw) return m * e; return 10 * e; })();
    for (let t = 0; t <= T + 1e-9; t += step) {
      svg.appendChild(svgEl('line', { class: 'grid-l', x1: sx(t), y1: TOP - 6, x2: sx(t), y2: H - 6 }));
      svg.appendChild(svgEl('text', { class: 'tick', x: sx(t), y: TOP - 10, 'text-anchor': 'middle' }, fmtN(t)));
    }
    rowsI.forEach((i, k) => {
      const y = TOP + k * RH;
      svg.appendChild(svgEl('text', { class: 'lbl', x: LBL - 10, y: y + 17, 'text-anchor': 'end' }, acts[i].name));
      if (res.TF[i] > 1e-9) svg.appendChild(svgEl('rect', { class: 'slack', x: sx(res.EF[i]), y: y + 6, width: Math.max(0, sx(res.LF[i]) - sx(res.EF[i])), height: 14, rx: 3 }));
      const bar = svgEl('rect', { class: 'bar' + (res.crit[i] ? ' crit' : ''), x: sx(res.ES[i]), y: y + 4, width: Math.max(2, sx(res.EF[i]) - sx(res.ES[i])), height: 18, rx: 3 });
      bar.appendChild(svgEl('title', {}, acts[i].name + ': ' + fmtN(res.ES[i]) + ' – ' + fmtN(res.EF[i]) + (res.TF[i] > 1e-9 ? ' (ätiýaç ' + fmtN(res.TF[i]) + ')' : ' (kritiki)')));
      svg.appendChild(bar);
    });
    svg.appendChild(svgEl('line', { class: 'end', x1: sx(T), y1: TOP - 6, x2: sx(T), y2: H - 6 }));
    const wrap = document.createElement('div');
    wrap.className = 'or-figure';
    wrap.appendChild(svg);
    $('ganttView').innerHTML = '';
    $('ganttView').appendChild(wrap);
    $('ganttView').insertAdjacentHTML('beforeend', '<div class="or-legend"><span><i class="or-sw or-sw-crit"></i> kritiki iş (ES → EF)</span><span><i class="or-sw" style="background:var(--or-blue)"></i> beýleki iş</span><span><i class="or-sw" style="background:var(--or-blue);opacity:.25;border-style:dashed"></i> umumy ätiýaç (EF → LF)</span><span><i class="or-sw" style="border:1px dashed var(--or-crit)"></i> T = ' + fmtN(res.T) + '</span></div>');
  }
  /* ------------------------------------------------------------------ PERT ähtimallyk */
  function renderPert(res) {
    const sec = $('pertSection');
    if (!res.pert) { sec.hidden = true; return; }
    sec.hidden = false;
    const P = res.pert, acts = res.acts;
    let h = '<p class="or-p">Kritiki ýol (dispersiýasy iň uly bolany): ' + P.path.map((i) => esc(acts[i].name)).join(' → ') + '. Taslamanyň garaşylýan möhleti T = Σ t<sub>e</sub> = ' + P.path.map((i) => fmtN(acts[i].d, 3)).join(' + ') + ' = <b>' + fmtN(res.T, 3) + '</b>; dispersiýasy σ²<sub>T</sub> = ' + P.path.map((i) => fmtN(acts[i].var, 3)).join(' + ') + ' = <b>' + fmtN(P.variance, 3) + '</b>, σ<sub>T</sub> = <b>' + fmtN(P.sigma, 3) + '</b>.</p>';
    if (P.target === undefined) {
      h += '<p class="or-p">Meýilnamalaşdyrylan möhlet D ýazylsa (ýokardaky meýdan), taslamanyň şol möhlete çenli gutarmak ähtimallygy hasaplanar.</p>';
      $('pertView').innerHTML = h;
      return;
    }
    h += '<p class="or-p">Z = (D − T) / σ<sub>T</sub> = (' + fmtN(P.target) + ' − ' + fmtN(res.T, 3) + ') / ' + fmtN(P.sigma, 3) + ' = <b>' + (isFinite(P.z) ? fmtN(P.z, 3) : (P.z > 0 ? '+∞' : '−∞')) + '</b>; P(T ≤ D) = Φ(Z) = <b>' + fmtN(P.prob * 100, 2) + '%</b>.</p>';
    $('pertView').innerHTML = h;
    if (!(P.sigma > 0)) return;
    const W = 560, H = 220, L = 20, R = 20, B = 36, TP = 12;
    const lo = res.T - 4 * P.sigma, hi = res.T + 4 * P.sigma;
    const sx = (t) => L + (t - lo) / (hi - lo) * (W - L - R);
    const pdf = (t) => Math.exp(-0.5 * Math.pow((t - res.T) / P.sigma, 2));
    const sy = (v) => H - B - v * (H - B - TP);
    const svg = svgEl('svg', { class: 'or-svg or-norm', viewBox: '0 0 ' + W + ' ' + H, width: W, role: 'img', 'aria-label': 'Normal paýlanyş: P(T ≤ D) meýdany' });
    let d = '', a = 'M' + sx(lo) + ' ' + sy(0);
    const D = Math.max(lo, Math.min(hi, P.target));
    for (let k = 0; k <= 200; k++) {
      const t = lo + (hi - lo) * k / 200;
      d += (k ? 'L' : 'M') + sx(t).toFixed(1) + ' ' + sy(pdf(t)).toFixed(1);
      if (t <= D) a += 'L' + sx(t).toFixed(1) + ' ' + sy(pdf(t)).toFixed(1);
    }
    a += 'L' + sx(D).toFixed(1) + ' ' + sy(pdf(D)).toFixed(1) + 'L' + sx(D).toFixed(1) + ' ' + sy(0) + 'Z';
    svg.appendChild(svgEl('path', { class: 'area', d: a }));
    svg.appendChild(svgEl('path', { class: 'curve', d }));
    svg.appendChild(svgEl('line', { class: 'axis', x1: sx(lo), y1: sy(0), x2: sx(hi), y2: sy(0) }));
    [-3, -2, -1, 0, 1, 2, 3].forEach((k) => {
      const t = res.T + k * P.sigma;
      svg.appendChild(svgEl('text', { class: 'tick', x: sx(t), y: H - B + 16, 'text-anchor': 'middle' }, k === 0 ? 'T=' + fmtN(t, 2) : fmtN(t, 1)));
    });
    if (P.target >= lo && P.target <= hi) {
      svg.appendChild(svgEl('line', { class: 'mark', x1: sx(P.target), y1: sy(0), x2: sx(P.target), y2: TP }));
      svg.appendChild(svgEl('text', { class: 'tick', x: sx(P.target) + 6, y: TP + 12 }, 'D = ' + fmtN(P.target) + ' → ' + fmtN(P.prob * 100, 1) + '%'));
    }
    const wrap = document.createElement('div');
    wrap.className = 'or-figure';
    wrap.appendChild(svg);
    $('pertView').appendChild(wrap);
  }

  function solve(scroll) {
    U.showError('');
    try {
      const acts = O.parseActivities(rows, mode);
      const target = $('pertTarget').value.trim();
      let tgt;
      if (mode === 'pert' && target) {
        const f = O.parseNum(target, 'Meýilnamalaşdyrylan möhlet D');
        tgt = f.valueOf();
      }
      U.store(STORE, { mode, rows, target });
      const res = O.network(acts, { mode, target: tgt });
      renderAnswer(res); renderTimes(res); renderNet(res); renderGantt(res); renderPert(res);
      $('resultsSection').hidden = false;
      if (scroll) $('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      if (!(e instanceof O.ORError)) console.error(e);
      $('resultsSection').hidden = true;
      U.showError(e instanceof O.ORError ? e.message : 'Garaşylmadyk ýalňyşlyk: ' + e.message);
    }
  }
  function load(p) {
    rows = p.rows.map((r) => Object.assign({}, r));
    mode = p.mode;
    document.querySelector('input[name="netMode"][value="' + mode + '"]').checked = true;
    $('pertTarget').value = p.target || '';
    render();
  }
  function init() {
    const saved = U.restore(STORE);
    if (saved && Array.isArray(saved.rows) && saved.rows.length) load({ rows: saved.rows, mode: saved.mode === 'pert' ? 'pert' : 'cpm', target: saved.target });
    else load(PRESETS[0]);
    $('actTable').addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.row === undefined) return;
      rows[+t.dataset.row][t.dataset.key] = t.value;
      U.unmarkPresets();
    });
    $('actTable').addEventListener('click', (e) => {
      const b = e.target.closest('[data-del]');
      if (!b) return;
      rows.splice(+b.dataset.del, 1);
      if (!rows.length) rows.push({ name: '', desc: '', pred: '', d: '' });
      body();
      U.unmarkPresets();
    });
    $('actTable').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !e.target.dataset.row) return;
      e.preventDefault();
      const i = +e.target.dataset.row;
      if (i === rows.length - 1) { rows.push({ name: '', desc: '', pred: '', d: '' }); body(); }
      const next = $('actTable').querySelector('input[data-row="' + (i + 1) + '"][data-key="name"]');
      if (next) next.focus();
    });
    $('addRow').addEventListener('click', () => {
      if (rows.length >= 30) { U.showError('Iň köp 30 iş.'); return; }
      rows.push({ name: '', desc: '', pred: '', d: '', a: '', m: '', b: '' });
      body();
      const last = $('actTable').querySelector('input[data-row="' + (rows.length - 1) + '"][data-key="name"]');
      if (last) last.focus();
    });
    $('clearRows').addEventListener('click', () => {
      rows = Array.from({ length: 4 }, () => ({ name: '', desc: '', pred: '', d: '', a: '', m: '', b: '' }));
      body(); U.unmarkPresets();
      $('resultsSection').hidden = true;
    });
    document.querySelectorAll('input[name="netMode"]').forEach((r) => r.addEventListener('change', () => setMode(r.value)));
    U.presets(PRESETS, (p) => { load(p); solve(false); });
    $('solveBtn').addEventListener('click', () => solve(true));
    $('pertTarget').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); solve(true); } });
  }
  init();
})();
