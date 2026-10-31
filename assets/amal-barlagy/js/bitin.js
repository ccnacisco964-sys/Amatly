/* ==========================================================================
   Amatly.com — Bitin sanly programmirleme (şahalar we araçäkler usuly): sahypanyň interfeýsi.
   Okamak: AmatlySimplex.parseText; hasaplama: AmatlyOR.branchAndBound (her düwün — AmatlySimplex.solve).
   ========================================================================== */
(function () {
  'use strict';
  const O = window.AmatlyOR, U = window.AmatlyORUI, S = window.AmatlySimplex;
  if (!O || !U || !S || !document.getElementById('treeView')) return;
  const { $, esc, fmtF, vn, lin, OP, minus, svgEl } = U;
  const STORE = 'amatly_or_bitin_v1';
  const PRESETS = [
    { id: 'taha', title: 'Mebel sehi', text: 'max Z = 5x1 + 4x2\nx1 + x2 <= 5\n10x1 + 6x2 <= 45',
      story: 'Sehde stol (girdejisi 5 müň manat) we şkaf (4 müň manat) ýasalýar. Iş wagty we agaç serişdesi çäkli; önümleriň sany diňe bitin bolup biler.' },
    { id: 'knap', title: 'Ýük gaplamak', text: 'max Z = 8x1 + 11x2 + 6x3\n5x1 + 7x2 + 4x3 <= 14\nx1 <= 1\nx2 <= 1\nx3 <= 1',
      story: 'Üç zatdan saýlap, agramy 14 kg-dan geçmeýän iň gymmat ýüki ýygnamaly (her zat ýa alynýar — 1, ýa alynmaýar — 0).' },
    { id: 'min', title: 'Iň arzan (min)', text: 'min Z = 3x1 + 5x2\n2x1 + 4x2 >= 9\n3x1 + x2 >= 7',
      story: 'Iki görnüşli ulag bilen talaby ödemeli; ulaglaryň sany bitin. Umumy çykdajy iň az bolmaly.' },
    { id: 'gap', title: 'Tegeleklemek ýalňyş', text: 'max Z = x1 + 5x2\nx1 + 10x2 <= 20\nx1 <= 2',
      story: 'Gowşadylan çözgüdi (x₁ = 2, x₂ = 1.8) diňe tegeleklemek optimal bitin çözgüdi bermeýär — şahalar we araçäkler usuly gerek.' },
  ];

  function readIntVars(p) {
    if ($('allInt').checked) return null;
    const raw = $('intList').value.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
    if (!raw.length) throw new O.ORError('Bitin bolmaly üýtgeýänleri ýazyň (mysal: x1, x2) ýa-da «Ähli üýtgeýänler bitin» belgisini goýuň.');
    const idx = raw.map((nm) => {
      const j = p.vars.findIndex((v) => v.toLowerCase() === nm.toLowerCase());
      if (j < 0) throw new O.ORError('«' + nm + '» üýtgeýäni meselede ýok. Üýtgeýänler: ' + p.vars.join(', ') + '.');
      return j;
    });
    return Array.from(new Set(idx)).sort((a, b) => a - b);
  }
  const vec = (x) => '(' + x.map((v) => fmtF(v)).join('; ') + ')';
  const branchText = (p, b) => vn(p.vars[b.j]) + ' ' + OP[b.op] + ' ' + fmtF(b.v);
  const branchPlain = (p, b) => {
    const m = /^([A-Za-z]+)_?(\d+)$/.exec(p.vars[b.j]);
    return (m ? m[1] + U.sub(m[2]) : p.vars[b.j]) + ' ' + OP[b.op] + ' ' + minus(b.v.toFraction());
  };
  const STATE = {
    best: 'iň gowy bitin çözgüt', integer: 'bitin', branched: 'şahalandyryldy', pruned: 'kesildi (araçäk)',
    infeasible: 'mümkin däl', open: 'barlanmady (çäk)', active: 'işjeň', unbounded: 'çäksiz',
  };

  function renderModel(p, intVars) {
    const iv = (intVars || p.vars.map((_, j) => j)).map((j) => vn(p.vars[j]));
    let h = '<div class="sx-model"><p class="sx-eq">' + esc(p.objName) + ' = ' + lin(p.c, p.vars) + ' → ' + p.sense + '</p><ol class="sx-cons">';
    p.cons.forEach((k) => { h += '<li><span class="sx-eq">' + lin(k.a, p.vars) + ' ' + OP[k.op] + ' ' + fmtF(k.b) + '</span></li>'; });
    h += '</ol><p class="sx-eq">' + p.vars.map(vn).join(', ') + ' ≥ 0; &nbsp;' + iv.join(', ') + ' — bitin sanlar</p></div>';
    $('modelView').innerHTML = h;
  }

  /* ------------------------------------------------------------------ agaç (SVG) */
  function renderTree(res) {
    const p = res.problem, nodes = res.nodes;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const W = 168, H = 66, GX = 22, GY = 46;
    let slot = 0;
    const pos = new Map();
    (function place(id) {
      const n = byId.get(id);
      const kids = n.children.map((c) => byId.get(c));
      if (!kids.length) { pos.set(id, { x: slot++ * (W + GX), y: n.depth * (H + GY) }); return; }
      kids.forEach((k) => place(k.id));
      const xs = kids.map((k) => pos.get(k.id).x);
      pos.set(id, { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: n.depth * (H + GY) });
    })(1);
    const maxX = Math.max(...[...pos.values()].map((q) => q.x)) + W, maxY = Math.max(...[...pos.values()].map((q) => q.y)) + H;
    const pad = 8;
    const svg = svgEl('svg', { class: 'or-svg or-tree', viewBox: (-pad) + ' ' + (-pad) + ' ' + (maxX + 2 * pad) + ' ' + (maxY + 2 * pad), width: maxX + 2 * pad, role: 'img',
      'aria-label': 'Şahalar we araçäkler agajy: ' + nodes.length + ' düwün' });
    nodes.forEach((n) => {
      if (!n.parent) return;
      const a = pos.get(n.parent), b = pos.get(n.id);
      const x1 = a.x + W / 2, y1 = a.y + H, x2 = b.x + W / 2, y2 = b.y;
      svg.appendChild(svgEl('path', { class: 'ed', d: 'M' + x1 + ' ' + y1 + ' C' + x1 + ' ' + (y1 + GY / 2) + ' ' + x2 + ' ' + (y2 - GY / 2) + ' ' + x2 + ' ' + y2 }));
      svg.appendChild(svgEl('text', { class: 'ed-l', x: (x1 + x2) / 2 + (x2 < x1 ? -6 : 6), y: (y1 + y2) / 2 + 4, 'text-anchor': x2 < x1 ? 'end' : 'start' }, branchPlain(p, n.branch)));
    });
    nodes.forEach((n) => {
      const q = pos.get(n.id);
      const g = svgEl('g', { class: 'nd ' + (n.state || ''), transform: 'translate(' + q.x + ' ' + q.y + ')' });
      g.appendChild(svgEl('rect', { width: W, height: H, rx: 8 }));
      g.appendChild(svgEl('text', { x: 10, y: 19, class: 't-id' }, '№' + n.id + (n.z ? '   ' + p.objName + ' = ' + minus(fmtF(n.z)) : '')));
      if (n.x) {
        const t = n.x.map((v) => minus(fmtF(v))).join('; ');
        g.appendChild(svgEl('text', { x: 10, y: 38, class: 't-x' }, 'x = (' + (t.length > 22 ? t.slice(0, 21) + '…' : t) + ')'));
      }
      g.appendChild(svgEl('text', { x: 10, y: n.x ? 56 : 40, class: 't-st' + (n.state === 'best' ? ' t-best' : n.state === 'infeasible' ? ' t-bad' : '') }, (n.state === 'best' ? '★ ' : '') + (n.state === 'integer' ? 'bitin, rekorddan gowy däl' : STATE[n.state] || n.state)));
      svg.appendChild(g);
    });
    const wrap = document.createElement('div');
    wrap.className = 'or-figure';
    wrap.appendChild(svg);
    $('treeView').innerHTML = '';
    $('treeView').appendChild(wrap);
    $('treeView').insertAdjacentHTML('beforeend', '<div class="or-legend"><span><i class="or-sw" style="border:2px solid var(--or-blue)"></i> şahalandyrylan</span><span><i class="or-sw" style="border:3px solid var(--or-green)"></i> iň gowy bitin çözgüt (rekord)</span><span><i class="or-sw" style="border:1px dashed var(--or-node-line)"></i> kesilen ýa-da mümkin däl</span></div>');
  }

  function renderNodes(res) {
    const p = res.problem, max = p.sense === 'max';
    let h = '<div class="table-scroll"><table class="grid or-nodes"><caption class="sr-only">Düwünler</caption><thead><tr><th scope="col">№</th><th scope="col">Goşmaça şert</th><th scope="col">Gowşadylan meseläniň çözgüdi</th><th scope="col">' + esc(p.objName) + '</th><th scope="col">Netije</th></tr></thead><tbody>';
    let record = null;
    res.nodes.forEach((n) => {
      const cond = n.parent ? '№' + n.parent + ' + ' + branchText(p, n.branch) : 'başlangyç (bitinlik şertsiz)';
      let why;
      if (n.state === 'infeasible') why = 'goşmaça şert bilen mümkin çözgüt ýok';
      else if (n.state === 'best') why = 'ähli bitin bolmaly üýtgeýänler bitin — täze rekord';
      else if (n.state === 'integer') why = 'bitin çözgüt, ýöne ' + esc(p.objName) + ' = ' + fmtF(n.z) + ' rekorddan (' + fmtF(res.best.z) + ') gowy däl';
      else if (n.state === 'pruned') why = esc(p.objName) + ' = ' + fmtF(n.z) + (max ? ' ≤ ' : ' ≥ ') + 'rekord — bu şahadan has gowy bitin çözgüt çykyp bilmez';
      else if (n.state === 'branched') why = vn(p.vars[n.branchVar]) + ' = ' + fmtF(n.branchVal) + ' drob → ' + vn(p.vars[n.branchVar]) + ' ≤ ' + fmtF(n.branchVal.floor()) + ' we ' + vn(p.vars[n.branchVar]) + ' ≥ ' + fmtF(n.branchVal.ceil());
      else if (n.state === 'unbounded') why = 'gowşadylan mesele çäksiz';
      else why = STATE[n.state] || '';
      if (n.state === 'best') record = n;
      h += '<tr' + (n.state === 'best' ? ' class="is-best"' : '') + '><td>' + n.id + '</td><td class="sx-left">' + cond + '</td><td>' + (n.x ? vec(n.x) : '—') + '</td><td>' + (n.z ? fmtF(n.z) : '—') + '</td><td class="sx-left"><span class="or-state ' + esc(n.state) + '">' + esc(STATE[n.state] || n.state) + '</span> ' + why + '</td></tr>';
    });
    void record;
    h += '</tbody></table></div>';
    h += '<p class="step-explain">Düwünler hasaplanyş tertibinde: her gezek araçägi iň gowy işjeň düwün şahalandyrylýar (iki çagasynyň meselesi şol bada çözülýär). Rekord tapylandan soň, araçägi rekorddan gowy bolmadyk düwünler kesilýär.</p>';
    $('nodesView').innerHTML = h;
  }

  /* ------------------------------------------------------------------ iki üýtgeýänli grafik */
  function renderGraph(res) {
    const p = res.problem;
    const sec = $('graphSection');
    if (p.vars.length !== 2) { sec.hidden = true; return; }
    const rootNode = res.nodes[0];
    const g = S.graphData(p, rootNode.lp === 'optimal' ? { status: 'optimal', x: rootNode.x } : null);
    if (!g || g.unboundedRegion && !res.best) { sec.hidden = true; return; }
    sec.hidden = false;
    let X = g.X, Y = g.Y;
    const pts = g.polygon;
    if (!g.unboundedRegion && pts.length) {
      /* mümkin ýaýla çäkli — görkeziş meýdanyny oňa laýyklaşdyrýarys (bitin çäkler) */
      const mx = Math.max(...pts.map((q) => q[0]), rootNode.x ? rootNode.x[0].valueOf() : 0);
      const my = Math.max(...pts.map((q) => q[1]), rootNode.x ? rootNode.x[1].valueOf() : 0);
      X = Math.max(2, Math.ceil(mx * 1.12 + 0.4));
      Y = Math.max(2, Math.ceil(my * 1.12 + 0.4));
    }
    const Wd = 520, Ht = 400, L = 46, B = 34, R = 14, T = 12;
    const sx = (x) => L + x / X * (Wd - L - R), sy = (y) => Ht - B - y / Y * (Ht - B - T);
    const svg = svgEl('svg', { class: 'or-svg or-lat-plot', viewBox: '0 0 ' + Wd + ' ' + Ht, width: Wd, role: 'img', 'aria-label': 'Mümkin ýaýla, bitin nokatlar we optimal nokatlar' });
    const step = (span) => { const raw = span / 8, e = Math.pow(10, Math.floor(Math.log10(raw))); for (const m of [1, 2, 5, 10]) if (m * e >= raw) return m * e; return 10 * e; };
    const xs = Math.max(1, step(X)), ys = Math.max(1, step(Y));
    for (let x = 0; x <= X + 1e-9; x += xs) { svg.appendChild(svgEl('line', { class: 'grid-l', x1: sx(x), y1: sy(0), x2: sx(x), y2: sy(Y) })); svg.appendChild(svgEl('text', { class: 'tick', x: sx(x), y: Ht - B + 16, 'text-anchor': 'middle' }, String(+x.toPrecision(6)))); }
    for (let y = 0; y <= Y + 1e-9; y += ys) { svg.appendChild(svgEl('line', { class: 'grid-l', x1: sx(0), y1: sy(y), x2: sx(X), y2: sy(y) })); svg.appendChild(svgEl('text', { class: 'tick', x: L - 6, y: sy(y) + 4, 'text-anchor': 'end' }, String(+y.toPrecision(6)))); }
    if (pts.length >= 3) svg.appendChild(svgEl('polygon', { class: 'region', points: pts.map((q) => sx(q[0]) + ',' + sy(q[1])).join(' ') }));
    svg.appendChild(svgEl('line', { class: 'axis', x1: sx(0), y1: sy(0), x2: sx(X), y2: sy(0) }));
    svg.appendChild(svgEl('line', { class: 'axis', x1: sx(0), y1: sy(0), x2: sx(0), y2: sy(Y) }));
    svg.appendChild(svgEl('text', { class: 'tick', x: sx(X) - 2, y: sy(0) - 6, 'text-anchor': 'end' }, p.vars[0]));
    svg.appendChild(svgEl('text', { class: 'tick', x: sx(0) + 6, y: sy(Y) + 12 }, p.vars[1]));
    /* birinji şahalandyryş: aýrylan zolak */
    if (rootNode.state === 'branched') {
      const j = rootNode.branchVar, lo = rootNode.branchVal.floor().valueOf(), hi = rootNode.branchVal.ceil().valueOf();
      if (j === 0) { [lo, hi].forEach((v) => svg.appendChild(svgEl('line', { class: 'cut', x1: sx(v), y1: sy(0), x2: sx(v), y2: sy(Y) }))); }
      else { [lo, hi].forEach((v) => svg.appendChild(svgEl('line', { class: 'cut', x1: sx(0), y1: sy(v), x2: sx(X), y2: sy(v) }))); }
    }
    /* bitin nokatlar */
    const inside = (x, y) => p.cons.every((k) => { const l = k.a[0].valueOf() * x + k.a[1].valueOf() * y, b = k.b.valueOf(); return k.op === '<=' ? l <= b + 1e-9 : k.op === '>=' ? l >= b - 1e-9 : Math.abs(l - b) < 1e-9; });
    if ((Math.floor(X) + 1) * (Math.floor(Y) + 1) <= 900) {
      for (let x = 0; x <= X + 1e-9; x++) for (let y = 0; y <= Y + 1e-9; y++) {
        const ok = inside(x, y);
        svg.appendChild(svgEl('circle', { class: 'lat' + (ok ? ' in' : ''), cx: sx(x), cy: sy(y), r: ok ? 3.4 : 1.8 }));
      }
    }
    if (rootNode.x) svg.appendChild(svgEl('circle', { class: 'opt-lp', cx: sx(rootNode.x[0].valueOf()), cy: sy(rootNode.x[1].valueOf()), r: 7 }));
    if (res.best) svg.appendChild(svgEl('circle', { class: 'opt-int', cx: sx(res.best.x[0].valueOf()), cy: sy(res.best.x[1].valueOf()), r: 7 }));
    const wrap = document.createElement('div');
    wrap.className = 'or-figure';
    wrap.appendChild(svg);
    $('graphView').innerHTML = '';
    $('graphView').appendChild(wrap);
    $('graphView').insertAdjacentHTML('beforeend', '<div class="or-legend"><span><i class="or-sw" style="background:var(--or-blue);opacity:.35"></i> gowşadylan meseläniň mümkin ýaýlasy</span><span><i class="or-sw" style="background:var(--or-blue);border-radius:50%"></i> mümkin bitin nokatlar</span><span><i class="or-sw" style="background:var(--or-path);border-radius:50%"></i> gowşadylan optimum</span><span><i class="or-sw" style="background:var(--or-green);border-radius:50%"></i> bitin optimum</span>' + (rootNode.state === 'branched' ? '<span><i class="or-sw" style="border:1px dashed var(--or-red)"></i> birinji şahalandyryş: aradaky zolak aýrylýar</span>' : '') + '</div>');
  }

  function renderAnswer(res, text) {
    const p = res.problem, out = $('answerView');
    if (res.status === 'infeasible') { out.innerHTML = '<div class="error-box sx-verdict"><b>Jogap: bitin mümkin çözgüt ýok.</b> ' + (res.nodes[0].lp === 'optimal' ? 'Gowşadylan meseläniň çözgüdi bar, ýöne şahalaryň hemmesinde bitin çözgüt tapylmady.' : 'Gowşadylan meseläniň hem mümkin çözgüdi ýok.') + '</div>'; return; }
    if (res.status === 'unbounded') { out.innerHTML = '<div class="error-box sx-verdict"><b>Gowşadylan mesele çäksiz.</b> Maksat funksiýasy çäklendirilmedik — bitin mesele hem çäksiz ýa-da mümkin däl bolup biler. Ýetmeýän çäklendirmäni goşuň.</div>'; return; }
    let h = '';
    if (res.status === 'limit') h += '<div class="error-box">Düwünleriň çägine (' + res.nodes.length + ') ýetildi; aşakdaky iň gowy tapylan bitin çözgüt optimal bolmazlygy mümkin.</div>';
    if (!res.best) { out.innerHTML = h + '<div class="error-box">Bitin çözgüt tapylmady.</div>'; return; }
    const b = res.best;
    h += '<div class="optimal-box sx-answer"><div class="sx-answer-z"><i>' + esc(p.objName) + '</i><sub>' + p.sense + '</sub> = ' + U.fmtBoth(b.z) + '</div>';
    h += '<div class="sx-answer-x">' + p.vars.map((v, j) => vn(v) + ' = ' + U.fmtBoth(b.x[j])).join(',&nbsp;&nbsp; ') + '</div></div>';
    const gap = res.rootZ.sub(b.z).abs();
    const notes = ['Gowşadylan (bitinlik şertsiz) meseläniň optimumy: ' + esc(p.objName) + ' = ' + fmtF(res.rootZ) + ' — bitin çözgüt üçin ' + (p.sense === 'max' ? 'ýokarky' : 'aşaky') + ' araçäk. Tapawut: ' + fmtF(gap) + '.',
      'Jemi ' + res.nodes.length + ' düwün (çyzykly mesele) çözüldi.'];
    if (!res.intVars || res.intVars.length === p.vars.length) {
      const bf = O.bruteIP(p);
      if (bf && bf.status === 'optimal') notes.push((Math.abs(bf.z - b.z.valueOf()) < 1e-9 ? '<span class="or-ok">✓ Barlag:</span> ' : '<span class="or-bad">⚠ Barlag:</span> ') + 'mümkin bolan ähli ' + bf.count + ' bitin nokat (0 ≤ ' + p.vars.map((v, j) => vn(v) + ' ≤ ' + bf.ub[j]).join(', ') + ') gözden geçirildi — iň gowusy ' + esc(p.objName) + ' = ' + U.fmtN(bf.z, 4) + '.');
    }
    const lpx = res.nodes[0].x;
    if (lpx && lpx.some((v) => String(v.d) !== '1')) {
      const rounded = lpx.map((v) => v.round());
      const ok = p.cons.every((k) => { let l = S.fraction(0); k.a.forEach((a, j) => { l = l.add(a.mul(rounded[j])); }); const c = l.compare(k.b); return k.op === '<=' ? c <= 0 : k.op === '>=' ? c >= 0 : c === 0; });
      notes.push('Gowşadylan çözgüdi diňe tegeleklesek, ' + vec(rounded) + ' alynýar: ' + (ok ? 'ol mümkin, ýöne ' + esc(p.objName) + ' = ' + fmtF(p.c.reduce((s, c, j) => s.add(c.mul(rounded[j])), p.c0)) + (rounded.every((v, j) => v.equals(b.x[j])) ? ' — bu gezek optimal bilen gabat geldi.' : ' — optimal däl.') : 'ol çäklendirmeleri bozýar — tegeleklemek ynamly däl.'));
    }
    h += '<ul class="sx-notes">' + notes.map((t) => '<li>' + t + '</li>').join('') + '</ul>';
    out.innerHTML = h;
    const q = 'Bitin sanly programmirleme meselesi:\n' + text + '\n(' + (res.intVars && res.intVars.length < p.vars.length ? 'bitin üýtgeýänler: ' + res.intVars.map((j) => p.vars[j]).join(', ') : 'ähli üýtgeýänler bitin') + '). Şahalar we araçäkler usuly bilen tapylan jogap: ' + p.objName + '* = ' + minus(b.z.toFraction()) + ', ' + p.vars.map((v, j) => v + ' = ' + minus(b.x[j].toFraction())).join(', ') +
      '; gowşadylan meseläniň optimumy ' + minus(res.rootZ.toFraction()) + '. Usulyň ädimlerini we kesmek düzgünlerini gysga düşündir.';
    const row = document.createElement('div');
    row.className = 'or-ai-row';
    row.appendChild(U.aiButton(q));
    const link = document.createElement('a');
    link.className = 'classic-btn or-link-btn';
    link.href = 'simpleks.html#mesele=' + encodeURIComponent(text);
    link.textContent = 'Gowşadylan meseläni simpleks bilen gör →';
    row.appendChild(link);
    out.appendChild(row);
  }

  function solve(scroll) {
    U.showError('');
    try {
      const text = $('lpText').value;
      const p = S.parseText(text);
      if (p.vars.length > 6) throw new O.ORError('Şahalar we araçäkler usuly üçin iň köp 6 üýtgeýän (agaç örän ulalýar).');
      const intVars = readIntVars(p);
      U.setNumMode($('orNum').value);
      U.store(STORE, { text, num: $('orNum').value, all: $('allInt').checked, list: $('intList').value });
      const res = O.branchAndBound(p, { intVars, maxNodes: 80 });
      renderModel(p, intVars);
      if (res.nodes.length) { renderTree(res); renderNodes(res); } else { $('treeView').innerHTML = ''; $('nodesView').innerHTML = ''; }
      renderGraph(res);
      renderAnswer(res, text);
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
    /* bitin-sanly.html#mesele=<tekst> — Amatly AI ýa-da başga sahypadan mesele bilen açmak */
    const mh = /^#mesele=([\s\S]+)$/.exec(location.hash);
    let fromHash = null;
    if (mh) { try { fromHash = decodeURIComponent(mh[1]); } catch (e) { fromHash = null; } }
    if (fromHash && fromHash.trim() && fromHash.length < 4000) {
      $('lpText').value = fromHash;
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* hökman däl */ }
    } else if (saved && typeof saved.text === 'string' && saved.text.trim()) {
      $('lpText').value = saved.text;
      if (saved.num === 'dec') $('orNum').value = 'dec';
      if (saved.all === false) { $('allInt').checked = false; $('intList').value = saved.list || ''; }
    }
    const sync = () => { $('intListWrap').hidden = $('allInt').checked; };
    $('allInt').addEventListener('change', sync);
    sync();
    U.presets(PRESETS, (p) => { $('lpText').value = p.text; $('allInt').checked = true; sync(); solve(false); });
    $('lpText').addEventListener('input', U.unmarkPresets);
    $('lpText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); solve(true); } });
    $('solveBtn').addEventListener('click', () => solve(true));
    $('orNum').addEventListener('change', () => { if (!$('resultsSection').hidden) solve(false); });
    if (fromHash) solve(false);
  }
  init();
})();
