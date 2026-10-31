/* ==========================================================================
   Amatly.com — Iň gysga ýol (Deýkstra, Bellman–Ford, Floýd–Uorşell): sahypanyň interfeýsi.
   Hasaplama: AmatlyOR.parseGraph, AmatlyOR.shortestPaths. Graf — SVG (gatlaklaýyn ýerleşdirmek).
   ========================================================================== */
(function () {
  'use strict';
  const O = window.AmatlyOR, U = window.AmatlyORUI;
  if (!O || !U || !document.getElementById('edgeText')) return;
  const { $, esc, fmtN, svgEl } = U;
  const STORE = 'amatly_or_yol_v1';
  const PRESETS = [
    { id: 'dij', title: 'Deýkstra (ugrukdyrylan)', directed: true, from: 'A', to: 'F',
      text: 'A B 4\nA C 2\nC B 1\nB D 5\nC D 8\nC E 10\nD E 2\nD F 6\nE F 2',
      story: 'Ýükler A ammardan F dükana eltilýär; gyralarda ýoluň wagty (minut). Iň çalt ýol haýsy?' },
    { id: 'road', title: 'Çatryklar (ugrukdyrylmadyk)', directed: false, from: '1', to: '7',
      text: '1 2 7\n1 3 9\n1 6 14\n2 3 10\n2 4 15\n3 4 11\n3 6 2\n4 5 6\n5 6 9\n5 7 4\n4 7 12',
      story: 'Kurýer 1-nji çatrykdan 7-nji çatryga barmaly; köçeleriň uzynlygy ýüz metrde. Köçelerde iki tarapa hem ýöräp bolýar.' },
    { id: 'neg', title: 'Otrisatel agramlar', directed: true, from: 'S', to: 'T',
      text: 'S A 4\nS B 2\nB A 1\nA C -3\nB D 5\nC D 2\nD T 1\nC T 6',
      story: 'Käbir ýollarda sürüji pul gazanýar (otrisatel çykdajy). Deýkstranyň usuly bu ýerde ýalňyşyp biler — Bellman–Ford ulanylýar.' },
    { id: 'cycle', title: 'Otrisatel aýlaw', directed: true, from: 'A', to: 'D',
      text: 'A B 1\nB C -2\nC A -1\nA D 4\nC D 1',
      story: 'A → B → C → A aýlawynyň jemi −2: her aýlanyşda ýol gysgalýar, şonuň üçin iň gysga ýol kesgitlenmedik.' },
  ];
  const directed = () => document.querySelector('input[name="gDir"]:checked').value === '1';

  /* ------------------------------------------------------------------ graf (SVG) */
  function renderGraph(res, target) {
    const G = res.G, N = G.nodes.length, src = res.src;
    /* gatlaklar: başlangyçdan BFS (gyralaryň sany boýunça) */
    const lvl = new Array(N).fill(-1);
    lvl[src] = 0;
    const q = [src];
    while (q.length) { const u = q.shift(); G.adj[u].forEach((e) => { if (lvl[e.to] < 0) { lvl[e.to] = lvl[u] + 1; q.push(e.to); } }); }
    const maxL = Math.max(0, ...lvl);
    lvl.forEach((l, i) => { if (l < 0) lvl[i] = maxL + 1; });
    const L = Math.max(...lvl);
    const cols = Array.from({ length: L + 1 }, () => []);
    lvl.forEach((l, i) => cols[l].push(i));
    const CW = 150, RH = 92, R = 25;
    const maxRows = Math.max(...cols.map((c) => c.length));
    const W = Math.max(320, (L + 1) * CW + 40), H = Math.max(140, maxRows * RH + 40);
    const pos = [];
    cols.forEach((c, l) => {
      const top = (H - (c.length - 1) * RH) / 2;
      c.forEach((i, k) => { pos[i] = { x: 20 + CW / 2 + l * CW, y: top + k * RH + (l % 2 ? 14 : 0) * (c.length > 1 ? 1 : 0) }; });
    });
    const pathEdges = new Set(), treeEdges = new Set();
    const key = (u, v) => u + '>' + v;
    if (res.status === 'ok') {
      res.prev.forEach((p, v) => { if (p >= 0) { treeEdges.add(key(p, v)); if (!G.directed) treeEdges.add(key(v, p)); } });
      if (target !== null && res.paths[target]) {
        const pth = res.paths[target];
        for (let k = 1; k < pth.length; k++) { pathEdges.add(key(pth[k - 1], pth[k])); if (!G.directed) pathEdges.add(key(pth[k], pth[k - 1])); }
      }
    }
    const svg = svgEl('svg', { class: 'or-svg or-graph', viewBox: '0 0 ' + W + ' ' + H, width: W, role: 'img', 'aria-label': 'Graf: ' + N + ' depe, ' + G.edges.length + ' gyra' + (target !== null && res.paths && res.paths[target] ? '; iň gysga ýol: ' + res.paths[target].map((i) => G.nodes[i]).join(' → ') : ''),
      style: 'min-width:' + Math.round(Math.min(W, 520)) + 'px' });
    const defs = svgEl('defs');
    [['n', 'var(--or-edge)'], ['t', 'var(--or-blue)'], ['p', 'var(--or-path)']].forEach(([k, c]) => {
      const m = svgEl('marker', { id: 'ga-' + k, viewBox: '0 0 10 10', refX: 9, refY: 5, markerUnits: 'userSpaceOnUse', markerWidth: k === 'p' ? 13 : 10, markerHeight: k === 'p' ? 13 : 10, orient: 'auto-start-reverse' });
      m.appendChild(svgEl('path', { d: 'M0 0 L10 5 L0 10 z', fill: c }));
      defs.appendChild(m);
    });
    svg.appendChild(defs);
    const has = new Set(G.edges.map((e) => key(e.u, e.v)));
    const labels = [];
    G.edges.forEach((e) => {
      const a = pos[e.u], b = pos[e.v];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      /* garşylykly gyra bar bolsa ýa-da gyra uzyn bolsa — egri çyzyk */
      const twin = G.directed && has.has(key(e.v, e.u));
      const sx = a.x + dx / len * R, sy = a.y + dy / len * R, tx = b.x - dx / len * (R + (G.directed ? 3 : 0)), ty = b.y - dy / len * (R + (G.directed ? 3 : 0));
      /* egriligi saýlamak: beýleki depelerden iň uzakdan geçýän görnüşi (garşylykly gyralar bölünýär) */
      const clearance = (bend) => {
        const cx0 = (sx + tx) / 2 + nx * bend, cy0 = (sy + ty) / 2 + ny * bend;
        let m = Infinity;
        for (let t = 0.08; t < 0.95; t += 0.06) {
          const px = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx0 + t * t * tx, py = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy0 + t * t * ty;
          pos.forEach((q, k) => { if (k !== e.u && k !== e.v) m = Math.min(m, Math.hypot(px - q.x, py - q.y)); });
        }
        return m;
      };
      const options = twin ? [16, 34] : [0, 24, -24, 46, -46, 70, -70, 96, -96];
      let bend = options[0], best = -1;
      options.forEach((bd) => { const c = Math.min(clearance(bd), R + 14) - Math.abs(bd) * 0.01; if (c > best + 1e-9) { best = c; bend = bd; } });
      const cx = (sx + tx) / 2 + nx * bend, cy = (sy + ty) / 2 + ny * bend;
      const onPath = pathEdges.has(key(e.u, e.v)), onTree = treeEdges.has(key(e.u, e.v));
      const cls = 'edge' + (onPath ? ' path' : onTree ? ' tree' : '') + (e.w < 0 ? ' neg' : '');
      const attrs = { class: cls, d: 'M' + sx.toFixed(1) + ' ' + sy.toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + tx.toFixed(1) + ' ' + ty.toFixed(1) };
      if (G.directed) attrs['marker-end'] = 'url(#ga-' + (onPath ? 'p' : onTree ? 't' : 'n') + ')';
      svg.appendChild(svgEl('path', attrs));
      const lx = 0.25 * sx + 0.5 * cx + 0.25 * tx, ly = 0.25 * sy + 0.5 * cy + 0.25 * ty;
      labels.push(svgEl('text', { class: 'w', x: lx.toFixed(1), y: (ly + 4).toFixed(1), 'text-anchor': 'middle' }, U.minus(fmtN(e.w))));
    });
    labels.forEach((t) => svg.appendChild(t));
    G.nodes.forEach((name, i) => {
      const p = pos[i];
      const onP = target !== null && res.paths && res.paths[target] && res.paths[target].indexOf(i) >= 0;
      const g = svgEl('g', { class: 'node' + (i === src ? ' src' : '') + (i === target ? ' dst' : '') + (onP ? ' on' : ''), transform: 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')' });
      g.appendChild(svgEl('circle', { r: R }));
      const ok = res.status === 'ok';
      g.appendChild(svgEl('text', { y: ok ? -1 : 5, 'text-anchor': 'middle' }, name.length > 5 ? name.slice(0, 4) + '…' : name));
      if (ok) g.appendChild(svgEl('text', { class: 'd', y: 13, 'text-anchor': 'middle' }, res.dist[i] === Infinity ? '∞' : U.minus(fmtN(res.dist[i]))));
      g.appendChild(svgEl('title', {}, name + (res.status === 'ok' ? ': ' + (res.dist[i] === Infinity ? 'baryp bolmaýar' : 'aralyk ' + fmtN(res.dist[i])) : '')));
      svg.appendChild(g);
    });
    const wrap = document.createElement('div');
    wrap.className = 'or-figure';
    wrap.appendChild(svg);
    $('graphView').innerHTML = '';
    $('graphView').appendChild(wrap);
    $('graphView').insertAdjacentHTML('beforeend', '<div class="or-legend"><span><i class="or-sw or-sw-path"></i> iň gysga ýol</span><span><i class="or-sw" style="background:var(--or-blue)"></i> iň gysga ýollar agajy</span><span><i class="or-sw" style="border:3px solid var(--or-green);border-radius:50%"></i> başlangyç depe</span>' + (G.edges.some((e) => e.w < 0) ? '<span><i class="or-sw" style="background:var(--or-red)"></i> otrisatel agram</span>' : '') + '</div>');
  }

  /* ------------------------------------------------------------------ jogap */
  const pathText = (G, p) => p.map((i) => esc(G.nodes[i])).join(' → ');
  function renderAnswer(res, target) {
    const G = res.G, out = $('answerView');
    if (res.status === 'neg-cycle') {
      out.innerHTML = '<div class="error-box sx-verdict"><b>Grafda otrisatel aýlaw bar:</b> ' + res.cycle.concat([res.cycle[0]]).map((i) => esc(G.nodes[i])).join(' → ') +
        ' (jemi ' + U.minus(fmtN(cycleWeight(G, res.cycle))) + '). Bu aýlawdan her geçende ýol gysgalýar, şonuň üçin oňa ýetip bolýan depelere iň gysga ýol kesgitlenmedik.</div>';
      return;
    }
    let h = '';
    if (target !== null) {
      const p = res.paths[target];
      if (!p) h += '<div class="error-box sx-verdict"><b>' + esc(G.nodes[res.src]) + ' depeden ' + esc(G.nodes[target]) + ' depä ýol ýok.</b>' + (G.directed ? ' Gyralaryň ugruny barlaň.' : '') + '</div>';
      else {
        h += '<div class="optimal-box sx-answer"><div class="sx-answer-z">' + esc(G.nodes[res.src]) + ' → ' + esc(G.nodes[target]) + ': ' + U.minus(fmtN(res.dist[target])) + '</div><div class="sx-answer-x">' + pathText(G, p) + '</div></div>';
        const parts = [];
        for (let k = 1; k < p.length; k++) parts.push(U.minus(fmtN(edgeW(G, p[k - 1], p[k]))));
        if (parts.length > 1) h += '<p class="or-p">Uzynlygy: ' + parts.join(' + ') + ' = <b>' + U.minus(fmtN(res.dist[target])) + '</b>.</p>';
      }
    }
    h += '<div class="table-scroll"><table class="grid or-mat"><caption class="sr-only">Başlangyç depeden ähli depelere iň gysga aralyklar</caption><thead><tr><th scope="col">Depe</th><th scope="col">Iň gysga aralyk</th><th scope="col">Ýol</th></tr></thead><tbody>';
    G.nodes.forEach((name, i) => {
      const p = res.paths[i];
      h += '<tr' + (i === target ? ' class="is-pickrow"' : '') + '><th scope="row">' + esc(name) + '</th><td>' + (res.dist[i] === Infinity ? '∞' : U.minus(fmtN(res.dist[i]))) + '</td><td class="sx-left">' + (p ? pathText(G, p) : '<span class="or-muted">ýol ýok</span>') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<p class="step-explain">Usul: <b>' + (res.method === 'dijkstra' ? 'Deýkstra' : 'Bellman–Ford') + '</b>' + (res.method === 'bellman-ford' ? ' (grafda otrisatel agramly gyra bar, şonuň üçin Deýkstranyň usuly ulanylmaýar)' : '') + '. <span class="or-ok">✓</span> Floýd–Uorşell usuly (aşakdaky matrisa) hem şol aralyklary berdi.</p>';
    out.innerHTML = h;
    const q = 'Graf (' + (G.directed ? 'ugrukdyrylan' : 'ugrukdyrylmadyk') + '), gyralar: ' + G.edges.map((e) => G.nodes[e.u] + '-' + G.nodes[e.v] + ' ' + e.w).join(', ') + '. Başlangyç depe ' + G.nodes[res.src] +
      (target !== null && res.paths[target] ? ', iň gysga ýol ' + res.paths[target].map((i) => G.nodes[i]).join(' → ') + ', uzynlygy ' + fmtN(res.dist[target]) : '') + '. ' + (res.method === 'dijkstra' ? 'Deýkstranyň' : 'Bellman–Fordyň') + ' usulynyň ädimlerini gysga düşündir.';
    const row = document.createElement('div');
    row.className = 'or-ai-row';
    row.appendChild(U.aiButton(q));
    out.appendChild(row);
  }
  function edgeW(G, u, v) {
    let w = Infinity;
    G.edges.forEach((e) => { if ((e.u === u && e.v === v) || (!G.directed && e.u === v && e.v === u)) w = Math.min(w, e.w); });
    return w;
  }
  function cycleWeight(G, cyc) { let s = 0; for (let k = 0; k < cyc.length; k++) s += edgeW(G, cyc[k], cyc[(k + 1) % cyc.length]); return s; }

  /* ------------------------------------------------------------------ ädimler */
  function renderSteps(res) {
    const G = res.G, N = G.nodes.length;
    let h = '';
    const dv = (d) => (d === Infinity ? '∞' : U.minus(fmtN(d)));
    if (res.method === 'dijkstra') {
      h += '<p class="or-p">Her setirde wagtlaýyn belgileriň iň kiçisi bolan depe <b>hemişelik</b> bolýar (ýaşyl), soň onuň goňşulary gowşadylýar: d(v) = min(d(v), d(u) + w(u, v)); täzelenen belgiler gök. Ýaýyň içinde — öňki depe.</p>';
      h += '<div class="table-scroll"><table class="grid or-dij"><caption class="sr-only">Deýkstranyň usulynyň belgiler tablisasy</caption><thead><tr><th scope="col">Ädim</th><th scope="col">Saýlanan depe</th>' + G.nodes.map((n) => '<th scope="col">' + esc(n) + '</th>').join('') + '</tr></thead><tbody>';
      h += '<tr><td>0</td><td>—</td>' + G.nodes.map((_, i) => '<td>' + (i === res.src ? '0' : '∞') + '</td>').join('') + '</tr>';
      const permanent = new Array(N).fill(false);
      res.steps.forEach((s, k) => {
        h += '<tr><td>' + (k + 1) + '</td><th scope="row">' + esc(G.nodes[s.u]) + ' (' + dv(s.dist[s.u]) + ')</th>';
        G.nodes.forEach((_, i) => {
          let cls = '', txt = dv(s.dist[i]) + (s.prev[i] >= 0 && s.dist[i] !== Infinity ? ' <span class="or-muted">(' + esc(G.nodes[s.prev[i]]) + ')</span>' : '');
          if (i === s.u) cls = 'is-perm', txt = '✓ ' + dv(s.dist[i]);
          else if (permanent[i]) cls = 'is-done', txt = '—';
          else if (s.updated.indexOf(i) >= 0) cls = 'is-upd';
          h += '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + txt + '</td>';
        });
        permanent[s.u] = true;
        h += '</tr>';
      });
      h += '</tbody></table></div>';
      const unreach = G.nodes.filter((_, i) => res.dist[i] === Infinity);
      if (unreach.length) h += '<p class="step-explain">Wagtlaýyn belgisi ∞ bolup galan depelere (' + unreach.map(esc).join(', ') + ') başlangyçdan ýol ýok.</p>';
    } else {
      h += '<p class="or-p">Bellman–Ford: her tapgyrda ähli gyralar gowşadylýar. n − 1 = ' + (N - 1) + ' tapgyrdan köp gerek däl; tapgyrda hiç bir belgi üýtgemese, usul ir gutarýar. Soňra ýene bir barlag: belgi kiçelip bilse — otrisatel aýlaw bar.</p>';
      h += '<div class="table-scroll"><table class="grid or-dij"><caption class="sr-only">Bellman–Ford usulynyň tapgyrlary</caption><thead><tr><th scope="col">Tapgyr</th>' + G.nodes.map((n) => '<th scope="col">' + esc(n) + '</th>').join('') + '</tr></thead><tbody>';
      h += '<tr><td>0</td>' + G.nodes.map((_, i) => '<td>' + (i === res.src ? '0' : '∞') + '</td>').join('') + '</tr>';
      res.rounds.forEach((r) => {
        h += '<tr><td>' + r.r + '</td>' + G.nodes.map((_, i) => '<td' + (r.updated.indexOf(i) >= 0 ? ' class="is-upd"' : '') + '>' + dv(r.dist[i]) + '</td>').join('') + '</tr>';
      });
      h += '</tbody></table></div>';
      if (res.status === 'neg-cycle') h += '<p class="step-explain"><span class="or-bad">✗</span> ' + (N - 1) + ' tapgyrdan soň hem gyrany gowşadyp bolýar — otrisatel aýlaw tapyldy.</p>';
      else if (res.rounds.length && !res.rounds[res.rounds.length - 1].updated.length) h += '<p class="step-explain"><span class="or-ok">✓</span> ' + res.rounds.length + '-nji tapgyrda belgiler üýtgemedi — aralyklar tapyldy.</p>';
    }
    $('stepsView').innerHTML = h;
  }
  function renderAll(res) {
    const G = res.G, A = res.all;
    if (res.status === 'neg-cycle' || !A || A.negCycle) { $('allView').innerHTML = '<p class="step-explain">Otrisatel aýlaw bolany üçin ähli jübütleriň aralyklary kesgitlenmedik.</p>'; return; }
    let h = '<div class="table-scroll"><table class="grid or-all"><caption class="sr-only">Floýd–Uorşell: ähli depe jübütleriniň arasyndaky iň gysga aralyklar (setir — nireden, sütün — nirä)</caption><thead><tr><th scope="col">nireden \\ nirä</th>' + G.nodes.map((n) => '<th scope="col">' + esc(n) + '</th>').join('') + '</tr></thead><tbody>';
    A.D.forEach((row, i) => {
      h += '<tr><th scope="row">' + esc(G.nodes[i]) + '</th>' + row.map((d, j) => '<td' + (i === j ? ' class="is-diag"' : '') + '>' + (d === Infinity ? '∞' : U.minus(fmtN(d))) + '</td>').join('') + '</tr>';
    });
    h += '</tbody></table></div><p class="step-explain">Floýd–Uorşell usuly her depäni yzygiderli «aralyk depe» hökmünde synap görýär: d(i, j) = min(d(i, j), d(i, k) + d(k, j)). ∞ — ýol ýok.</p>';
    $('allView').innerHTML = h;
  }

  function solve(scroll) {
    U.showError('');
    try {
      const text = $('edgeText').value, dir = directed();
      U.store(STORE, { text, directed: dir, from: $('spFrom').value, to: $('spTo').value });
      const G = O.parseGraph(text, { directed: dir });
      const s = G.findNode($('spFrom').value);
      if (s === undefined) throw new O.ORError('Başlangyç depe «' + $('spFrom').value.trim() + '» grafda ýok. Depeler: ' + G.nodes.join(', ') + '.');
      let t = null;
      if ($('spTo').value.trim()) {
        t = G.findNode($('spTo').value);
        if (t === undefined) throw new O.ORError('Soňky depe «' + $('spTo').value.trim() + '» grafda ýok. Depeler: ' + G.nodes.join(', ') + '.');
      }
      const res = O.shortestPaths(G, s);
      renderGraph(res, t); renderAnswer(res, t); renderSteps(res); renderAll(res);
      $('resultsSection').hidden = false;
      if (scroll) $('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      if (!(e instanceof O.ORError)) console.error(e);
      $('resultsSection').hidden = true;
      U.showError(e instanceof O.ORError ? e.message : 'Garaşylmadyk ýalňyşlyk: ' + e.message);
    }
  }
  function load(p) {
    $('edgeText').value = p.text;
    document.querySelector('input[name="gDir"][value="' + (p.directed ? '1' : '0') + '"]').checked = true;
    $('spFrom').value = p.from || '';
    $('spTo').value = p.to || '';
  }
  function init() {
    const saved = U.restore(STORE);
    if (saved && typeof saved.text === 'string' && saved.text.trim()) load({ text: saved.text, directed: saved.directed !== false, from: saved.from, to: saved.to });
    U.presets(PRESETS, (p) => { load(p); solve(false); });
    ['edgeText', 'spFrom', 'spTo'].forEach((id) => $(id).addEventListener('input', U.unmarkPresets));
    document.querySelectorAll('input[name="gDir"]').forEach((r) => r.addEventListener('change', () => { U.unmarkPresets(); if (!$('resultsSection').hidden) solve(false); }));
    $('edgeText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); solve(true); } });
    ['spFrom', 'spTo'].forEach((id) => $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); solve(true); } }));
    $('solveBtn').addEventListener('click', () => solve(true));
  }
  init();
})();
