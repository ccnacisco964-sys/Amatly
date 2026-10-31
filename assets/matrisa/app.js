(()=>{
const sub = n => String(n).replace(/\d/g, d => '₀₁₂₃₄₅₆₇₈₉'[d]);
const sup = n => String(n).replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
function fmt(x){
  if (typeof x === 'string') return x;
  if (math.typeOf(x) === 'Fraction') return x.toFraction().replace('-', '−');
  if (typeof x === 'number') return String(+x.toFixed(4)).replace('-', '−');
  return math.format(x, { precision: 4 });
}
// sep — aýyryjy çyzykdan öňki sütünleriň sany (giňeldilen matrisa [A | E] üçin)
const table = (M, sep) => '<table class="mat" role="presentation">' + M.map(r => '<tr>' + r.map((v, j) => '<td' + (j === sep - 1 ? ' class="s"' : '') + '>' + fmt(v) + '</td>').join('') + '</tr>').join('') + '</table>';
const esc = s => String(s).replace(/[&<>"]/g, c => '&#' + c.charCodeAt(0) + ';');


class Note extends Error {
  constructor(title, text){ super(text); this.title = title; }
}
const OPS = [
  { id: 'add', name: 'Goşmak (A + B)', two: 1 },
  { id: 'sub', name: 'Aýyrmak (A − B)', two: 1 },
  { id: 'mul', name: 'Köpeltmek (A × B)', two: 1 },
  { id: 'scalar', name: 'Sana köpeltmek (k · A)' },
  { id: 'transpose', name: 'Transpoze (Aᵀ)' },
  { id: 'det', name: 'Determinant |A|' },
  { id: 'inv', name: 'Ters matrisa (A⁻¹)' },
  { id: 'trace', name: 'Trace tr(A) — diagonal jemi', uni: 1 },
  { id: 'rank', name: 'Rang (rank A)', uni: 1 },
  { id: 'eig', name: 'Häsiýetli sanlar (λ)', uni: 1 }
];
// Sanlar math.js Fraction görnüşinde saklanýar: 1/3 ýaly jogaplar takyk çykýar.
// Boş öýjük 0 hasaplanýar; nädogry ýazgy düşündiriş bilen Note görnüşinde gaýtarylýar.
function parse(s){
  const t = String(s).trim().replace(/[−–]/g, '-').replace(',', '.').replace(/^\+/, '').replace(/^(-?)\./, (_, m) => m + '0.');
  if (t === '') return math.fraction(0);
  if (/\/0+$/.test(t)) throw new Note('Bölüji 0 bolup bilmez', `"${s}" ýazgysynda bölüji 0. Kesiriň aşagynda 0 ýazyp bolmaz; mysal üçin 1/2 ýa-da 3/4 ýazyň.`);
  try { if (/^-?(\d+\/\d+|\d*\.?\d+)$/.test(t)) return math.fraction(t); } catch (e) {}
  throw new Note('Diňe san ýazyň', `"${s}" san däl. Öýjüge bitin (5, −3), onluk (2.5) ýa-da kesir (1/2) ýazyň; harp we başga belgiler ulanylmaýar.`);
}
function rref(M){
  const R = M.map(r => r.slice()), m = R.length, n = R[0].length; let r = 0;
  for (let c = 0; c < n && r < m; c++){
    const p = R.findIndex((row, i) => i >= r && !math.isZero(row[c]));
    if (p < 0) continue;
    [R[r], R[p]] = [R[p], R[r]];
    const d = R[r][c]; R[r] = R[r].map(v => math.divide(v, d));
    for (let i = 0; i < m; i++) if (i !== r && !math.isZero(R[i][c])){ const f = R[i][c]; R[i] = R[i].map((v, j) => math.subtract(v, math.multiply(f, R[r][j]))); }
    r++;
  }
  return { R, rank: r };
}
function calc0(op, A, B, k){
  const dim = M => M.length + '×' + M[0].length;
  const sq = () => { if (A.length !== A[0].length) throw new Note('Kwadrat matrisa gerek', `Bu amal diňe kwadrat matrisa üçin (setir sany = sütün sany). A matrisasy ${dim(A)}. Setir we sütün sanyny deňleşdiriň.`); };
  const same = () => { if (dim(A) !== dim(B)) throw new Note('Ölçegler deň däl', `Goşmak we aýyrmak diňe birmeňzeş ölçegli matrisalar üçin. A matrisasy ${dim(A)}, B matrisasy ${dim(B)}.`); };
  switch (op){
    case 'add': same(); return math.add(A, B);
    case 'sub': same(); return math.subtract(A, B);
    case 'mul': if (A[0].length !== B.length) throw new Note('Köpeltmek mümkin däl', `A matrisasy ${dim(A)}, B matrisasy ${dim(B)}. Köpeltmek üçin A-nyň sütün sany (${A[0].length}) B-niň setir sanyna (${B.length}) deň bolmaly.`); return math.multiply(A, B);
    case 'scalar': return math.multiply(k, A);
    case 'transpose': return math.transpose(A);
    case 'det': sq(); return math.det(A);
    case 'trace': sq(); return math.trace(A);
    case 'inv': { sq(); if (math.isZero(math.det(A))) { const e = new Note('Ters matrisa ýok', 'Bu matrisanyň determinanty 0, şonuň üçin ters matrisasy ýok.'); e.singular = true; throw e; } return math.inv(A); }
    case 'rank': return rref(A).rank;
    case 'eig': sq(); return eigen(A);
  }
}

const idn = n => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => math.fraction(i === j ? 1 : 0)));
// Häsiýetli köpagzanyň koeffisiýentleri [1, c1, …, cn] (Faddeýew–Lewerýe usuly, takyk drobly)
function charPoly(A){
  const n = A.length, I = idn(n), c = [math.fraction(1)]; let M = A.map(r => r.map(() => math.fraction(0)));
  for (let k = 1; k <= n; k++){
    M = math.add(math.multiply(A, M), math.multiply(c[k - 1], I));
    c.push(math.multiply(math.fraction(-1, k), math.trace(math.multiply(A, M))));
  }
  return c;
}
const big = v => (Array.isArray(v) ? v.some(big) : math.typeOf(v) === 'Fraction' && (v.n > Number.MAX_SAFE_INTEGER || v.d > Number.MAX_SAFE_INTEGER));
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const divs = n => { const d = []; for (let i = 1; i * i <= n; i++) if (n % i === 0) { d.push(i); if (i * i !== n) d.push(n / i); } return d; };
const horner = (c, x) => c.reduce((s, v) => math.add(math.multiply(s, x), v));
const nf = x => String(+x.toFixed(4)).replace('-', '−');
const ai = im => { const s = nf(Math.abs(im)); return (s === '1' ? '' : s) + 'i'; };
const cx = (re, im) => (Math.abs(im) < 5e-5 ? nf(re) : (nf(re) === '0' ? (im < 0 ? '−' : '') : nf(re) + (im < 0 ? ' − ' : ' + ')) + ai(im));
// 4 onluk belgä tegelenen bolsa "≈" goýulýar: takyk däl bahany takyk diýip görkezmeýäris.
const ap = (...v) => (v.some(x => Math.abs(+x.toFixed(4) - x) > 1e-9) ? '≈ ' : '');
// Drob D üçin √ astyny ýaýlaýarys: √(5/4) — √5/4 bilen garyşmaz ýaly.
const rt = D => (fmt(D).includes('/') ? '(' + fmt(D) + ')' : fmt(D));
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
// Häsiýetli sanlar: köpagzanyň rasional kökleri takyk (rasional kök teoremasy + Horner bölünmesi),
// galan kökler kwadrat formula bilen ýa-da Durand–Kerner sanly usuly bilen tapylýar.
function eigen(A){
  const c0 = charPoly(A);
  if (big(c0)) throw new Note('San gaty uly', 'Sanlar takyk saklanyp bilinmeýän derejede uly boldy. Kiçiräk sanlar ulanyp görüň.');
  let c = c0; const found = [], roots = [];
  for (;;){
    const d = c.length - 1; if (d < 1) break;
    const L = c.reduce((l, v) => { const q = Number(v.d); return l / gcd(l, q) * q; }, 1);
    const ci = c.map(v => math.number(math.multiply(v, math.fraction(L)))), a0 = Math.abs(ci[d]), an = Math.abs(ci[0]);
    let r = null;
    if (a0 === 0) r = math.fraction(0);
    else if (a0 <= 1e12 && an <= 1e12){
      const cand = []; divs(a0).forEach(p => divs(an).forEach(q => { cand.push(math.fraction(p, q), math.fraction(-p, q)); }));
      cand.sort((x, y) => Math.abs(math.number(x)) - Math.abs(math.number(y)));
      r = cand.find(x => math.isZero(horner(c, x))) || null;
    }
    if (!r) break;
    const q = [c[0]]; for (let i = 1; i < d; i++) q.push(math.add(c[i], math.multiply(r, q[i - 1])));
    found.push({ r, from: c, q }); c = q;
  }
  found.forEach(f => roots.push({ re: math.number(f.r), im: 0, txt: fmt(f.r), r: f.r }));
  const m = c.length - 1, rest = { c, m, kind: m === 2 ? 'quad' : m ? 'num' : null };
  if (m === 2){
    const b = c[1], D = math.subtract(math.multiply(b, b), math.multiply(math.fraction(4), c[2])), sq = Math.sqrt(Math.abs(math.number(D))), re = -math.number(b) / 2; rest.D = D;
    if (math.isNegative(D)) roots.push({ re, im: sq / 2, txt: ap(re, sq / 2) + cx(re, sq / 2) }, { re, im: -sq / 2, txt: ap(re, sq / 2) + cx(re, -sq / 2) });
    else [-1, 1].forEach(s => roots.push({ re: re + s * sq / 2, im: 0, txt: `(${fmt(math.unaryMinus(b))} ${s < 0 ? '−' : '+'} √${rt(D)})/2 ≈ ${nf(re + s * sq / 2)}` }));
  } else if (m >= 3){
    const cn = c.map(v => math.number(v)), R0 = 1 + Math.max(...cn.slice(1).map(v => Math.abs(v)));
    const z = cn.slice(1).map((_, k) => [R0 * Math.cos(2 * Math.PI * k / m + 0.4), R0 * Math.sin(2 * Math.PI * k / m + 0.4)]);
    for (let it = 0; it < 5000; it++){
      let dm = 0;
      for (let k = 0; k < m; k++){
        const pz = cn.reduce((s, v) => { const t = cmul(s, z[k]); return [t[0] + v, t[1]]; }, [0, 0]);
        let dn = [1, 0]; z.forEach((w, j) => { if (j !== k) dn = cmul(dn, [z[k][0] - w[0], z[k][1] - w[1]]); });
        const t = dn[0] * dn[0] + dn[1] * dn[1], dz = [(pz[0] * dn[0] + pz[1] * dn[1]) / t, (pz[1] * dn[0] - pz[0] * dn[1]) / t];
        z[k] = [z[k][0] - dz[0], z[k][1] - dz[1]]; dm = Math.max(dm, Math.hypot(dz[0], dz[1]));
      }
      if (dm < 1e-13) break;
    }
    if (z.some(w => !isFinite(w[0]) || !isFinite(w[1]))) throw new Note('Häsiýetli sanlary tapyp bolmady', 'Köpagzanyň kökleri sanly usul bilen hasaplanmady. Sanlary üýtgedip täzeden synanyşyň.');
    z.forEach(w => { const im = Math.abs(w[1]) < 1e-9 * (1 + Math.abs(w[0])) ? 0 : w[1]; roots.push({ re: w[0], im, txt: '≈ ' + cx(w[0], im) }); });
  }
  roots.sort((x, y) => x.re - y.re || x.im - y.im);
  return { c: c0, found, rest, roots };
}
function calc(op, A, B, k){
  const r = calc0(op, A, B, k);
  if (op !== 'eig' && big(r)) throw new Note('San gaty uly', 'Hasaplamada sanlar takyk saklanyp bilinmeýän derejede uly boldy. Kiçiräk sanlar ulanyp görüň.');
  return r;
}



const p = x => (math.isNegative(x) ? '(' + fmt(x) + ')' : fmt(x));
const J = (a, s) => a.join(s);
const rn = i => 'R' + sub(i);
const sy = s => '<span class="op">' + s + '</span>';
const row = (...a) => '<div class="row">' + a.join('') + '</div>';
const eq = s => '<div class="eq">' + s + '</div>';
const S = (t, x = '', m = '') => '<b>' + t + '</b>' + (x ? '<p>' + x + '</p>' : '') + m;
const li = s => '<li>' + s + '</li>';
const mx = (A, f) => A.map((r, i) => r.map((v, j) => f(v, i, j)));

// Gauss usuly: her setir amaly aýratyn ädim hökmünde ýazylýar.
// cols — baş element gözlenýän sütünleriň sany; norm — baş elementi 1 edýär; up — baş elementiň ýokarsyny hem nollaýar.
function reduce(M, cols, norm, up){
  const R = M.map(r => r.slice()), m = R.length, st = [], snap = (t, x) => st.push({ t, x, M: R.map(r => r.slice()) });
  let r = 0, sign = 1;
  for (let c = 0; c < cols && r < m; c++){
    const q = R.findIndex((w, i) => i >= r && !math.isZero(w[c]));
    if (q < 0){ st.push({ t: `${c + 1}-nji sütün`, x: `${r + 1}-nji setirden aşakda nolsyz san ýok, şonuň üçin bu sütüni geçýäris.` }); continue; }
    if (q !== r){ [R[r], R[q]] = [R[q], R[r]]; sign = -sign; snap(`${rn(r + 1)} ↔ ${rn(q + 1)}`, `${c + 1}-nji sütünde baş element 0 bolany üçin setirleri çalyşýarys.`); }
    if (norm && !R[r][c].equals(1)){ const d = R[r][c]; R[r] = R[r].map(v => math.divide(v, d)); snap(`${rn(r + 1)} → ${rn(r + 1)} ÷ ${p(d)}`, `Baş elementi 1 edýäris: setiriň ähli sanlaryny ${fmt(d)}-a bölýäris.`); }
    for (let i = up ? 0 : r + 1; i < m; i++){
      if (i === r || math.isZero(R[i][c])) continue;
      const f = math.divide(R[i][c], R[r][c]);
      R[i] = R[i].map((v, j) => math.subtract(v, math.multiply(f, R[r][j])));
      snap(`${rn(i + 1)} → ${rn(i + 1)} − ${p(f)}·${rn(r + 1)}`, `${c + 1}-nji sütünde ${i < r ? 'ýokarda' : 'aşakda'} nol alýarys.`);
    }
    r++;
  }
  return { R, rank: r, sign, st };
}
const gsteps = (g, sep) => g.st.map(s => S(s.t, s.x, s.M ? table(s.M, sep) : ''));

function detSteps(A){
  const n = A.length, d = math.det(A);
  if (n === 1) return [S('1×1 matrisa', '1×1 matrisanyň determinanty şol sanyň özi.', eq(`|A| = <b>${fmt(d)}</b>`))];
  if (n === 2){
    const [[a, b], [c, e]] = A;
    return [
      S('Düzgün', 'Baş diagonaldaky sanlaryň köpeltmek hasylyndan ikinji diagonaldakylaryň köpeltmek hasylyny aýyrýarys.', eq('|A| = a·d − b·c')),
      S('Ýerine goýýarys', '', eq(`|A| = ${p(a)}·${p(e)} − ${p(b)}·${p(c)}`)),
      S('Hasaplaýarys', '', eq(`|A| = ${fmt(math.multiply(a, e))} − ${p(math.multiply(b, c))} = <b>${fmt(d)}</b>`))
    ];
  }
  if (n === 3){
    const T = t => t.map(([r, c]) => A[r][c]), pr = t => T(t).reduce((x, y) => math.multiply(x, y));
    const P = [[[0,0],[1,1],[2,2]], [[0,1],[1,2],[2,0]], [[0,2],[1,0],[2,1]]], N = [[[0,2],[1,1],[2,0]], [[0,0],[1,2],[2,1]], [[0,1],[1,0],[2,2]]];
    const sum = G => G.map(pr).reduce((x, y) => math.add(x, y)), sp = sum(P), sn = sum(N);
    const lines = G => J(G.map(t => eq(J(T(t).map(p), '·') + ' = ' + fmt(pr(t)))), '');
    return [
      S('Sarrus düzgüni', 'Matrisanyň sag tarapyna 1-nji we 2-nji sütüni gaýtadan ýazýarys. Baş diagonal ugrundaky üç köpeltmek hasylyny goşýarys, ikinji diagonal ugrundakylary aýyrýarys.', table(A.map(r => [...r, r[0], r[1]]), 3)),
      S('"+" hasyllar (↘ ugur)', 'Her diagonaldaky üç sanyň köpeltmek hasyly:', lines(P) + eq(`Jemi: ${J(P.map(t => fmt(pr(t))), ' + ')} = <b>${fmt(sp)}</b>`)),
      S('"−" hasyllar (↙ ugur)', 'Beýleki ugurdaky köpeltmek hasyllary:', lines(N) + eq(`Jemi: ${J(N.map(t => fmt(pr(t))), ' + ')} = <b>${fmt(sn)}</b>`)),
      S('Netije', '"+" hasyllaryň jeminden "−" hasyllaryň jemini aýyrýarys:', eq(`|A| = ${fmt(sp)} − ${p(sn)} = <b>${fmt(d)}</b>`))
    ];
  }
  const g = reduce(A, n, false, false), dg = g.R.map((r, i) => r[i]);
  return [
    S('Usul', 'Determinanty üçburç görnüşe getirip hasaplaýarys. Bir setirden beýlekisini aýyrmak determinanty üýtgetmeýär, setirleri çalyşmak onuň alamatyny tersine üýtgedýär.', table(A)),
    ...gsteps(g),
    S('Netije', g.rank < n ? 'Baş diagonalda 0 bar, şonuň üçin determinant 0.' : 'Üçburç matrisanyň determinanty diagonaldaky sanlaryň köpeltmek hasylyna deň' + (g.sign < 0 ? '; setirleri täk gezek çalyşanymyz üçin alamat tersine üýtgeýär' : '') + '.', eq(`|A| = ${g.rank < n ? '0' : (g.sign < 0 ? '(−1)·' : '') + J(dg.map(p), '·')} = <b>${fmt(d)}</b>`))
  ];
}

const poly = c => c.map((v, k) => {
  if (math.isZero(v)) return '';
  const e = c.length - 1 - k, a = math.abs(v), neg = math.isNegative(v);
  return (k ? (neg ? ' − ' : ' + ') : (neg ? '−' : '')) + (e && a.equals(1) ? '' : fmt(a)) + (e ? 'λ' + (e > 1 ? sup(e) : '') : '');
}).join('');

const lin = r => (math.isZero(r) ? 'λ' : '(λ ' + (math.isNegative(r) ? '+ ' + fmt(math.abs(r)) : '− ' + fmt(r)) + ')');
// (A − λE)·v = 0 ulgamyny Gauss–Jordan usuly bilen çözýär we häsiýetli wektorlary görkezýär
function vecSteps(A, lam){
  const n = A.length, M = A.map((r, i) => r.map((v, j) => (i === j ? math.subtract(v, lam) : v))), g = reduce(M, n, true, true);
  const piv = g.R.map(r => r.findIndex(v => !math.isZero(v))).filter(c => c >= 0), free = [...Array(n).keys()].filter(c => !piv.includes(c));
  const bas = free.map(f => { const x = Array.from({ length: n }, () => math.fraction(0)); x[f] = math.fraction(1); piv.forEach((c, k) => { x[c] = math.unaryMinus(g.R[k][f]); }); return x; });
  const col = x => x.map(v => [v]);
  return '<details><summary>λ = ' + fmt(lam) + ' üçin häsiýetli wektorlar</summary>'
    + S('Ulgam', `(A − ${p(lam)}·E)·v = 0 deňlemeler ulgamyny çözýäris. Ilki A − λE matrisany ýazýarys:`, table(M))
    + '<ol class="steps">' + gsteps(g).map(li).join('') + '</ol>'
    + S('Çözgüt', `Erkin näbelli(ler): ${J(free.map(f => 'x' + sub(f + 1)), ', ')}. Beýleki näbellileri olaryň üsti bilen ýazýarys (her erkin näbellä ýekeme-ýeke 1 baha berýäris):`,
      J(bas.map((x, i) => row(sy('v' + sub(i + 1) + ' ='), table(col(x)))), '')
      + J(bas.map((x, i) => { const Av = math.multiply(A, x), ok = Av.every((v, t) => math.equal(v, math.multiply(lam, x[t]))); return eq(`Barlag: A·v${sub(i + 1)} = (${J(Av.map(v => fmt(v)), ', ')})ᵀ = ${fmt(lam)}·v${sub(i + 1)} ${ok ? '✓' : '✗'}`); }), ''))
    + '</details>';
}
function eigSteps(A, E){
  const n = A.length, c = E.c, tr = math.trace(A), R = E.rest, items = [], zs = E.roots.map(r => math.complex(r.re, r.im)), nm = i => 'λ' + sub(i + 1);
  items.push(
    S('Häsiýetli san näme?', 'Nolsyz v wektor üçin A·v = λ·v deňlik ýerine ýetse, λ — A matrisanyň häsiýetli sany, v — onuň häsiýetli wektory. Deňligi (A − λE)·v = 0 görnüşinde ýazýarys. Nolsyz v bolmagy üçin A − λE matrisa singulýar bolmaly, ýagny det(A − λE) = 0. Şonuň üçin ilki şu deňlemäni düzýäris, soňra onuň kökleri tapýarys.'),
    S('A − λE matrisany ýazýarys', 'λ-ny baş diagonaldaky sanlardan aýyrýarys:', table(mx(A, (v, i, j) => (i === j ? fmt(v) + ' − λ' : fmt(v))))),
    S('Häsiýetli köpagza', n === 2 ? 'Determinanty açyp p(λ) = λ² − tr(A)·λ + |A| alarys.' : n === 3 ? 'p(λ) = λ³ − tr(A)·λ² + S₂·λ − |A|, bu ýerde S₂ — baş 2×2 minorlaryň jemi.' : 'Koeffisiýentler Faddeýew–Lewerýe usuly bilen takyk (kesir görnüşinde) hasaplandy.',
      (n === 2 ? eq(`tr(A) = ${fmt(tr)}, |A| = ${fmt(c[2])}`) : n === 3 ? eq(`tr(A) = ${fmt(tr)}, S₂ = ${fmt(c[2])}, |A| = ${fmt(math.unaryMinus(c[3]))}`) : '') + eq(`p(λ) = ${poly(c)} = 0`)));
  const rule = 'Bitin koeffisiýentli köpagzanyň rasional kökleri p/q görnüşinde bolýar: p — erkin agzanyň, q — baş koeffisiýentiň bölüjisi.';
  items.push(E.found.length
    ? S('Rasional kökleri gözleýäris', rule + ' Kandidatlary p(λ) = 0 deňlige goýup barlaýarys. Kök tapylsa, köpagzany (λ − kök)-e bölüp (Horner usuly) derejesini kiçeldýäris.', J(E.found.map(s => eq(`p(${fmt(s.r)}) = 0 ✓ ⇒ λ = ${fmt(s.r)} kök`) + eq(`${poly(s.from)} = ${lin(s.r)}·(${poly(s.q)})`)), ''))
    : S('Rasional kökleri gözleýäris', rule + ' Kandidatlaryň hiç biri p(λ) = 0 deňligi kanagatlandyrmady, diýmek rasional kök ýok.'));
  if (R.kind === 'quad') items.push(S('Galan kwadrat deňleme', `${poly(R.c)} = 0 kwadrat deňleme. Diskriminant D = b² − 4c, kökleri λ = (−b ± √D)/2.`, eq(`D = ${p(R.c[1])}² − 4·${p(R.c[2])} = <b>${fmt(R.D)}</b>`) + eq(math.isNegative(R.D) ? 'D < 0 ⇒ hakyky kök ýok; kompleks jübüt kök (a ± bi görnüşinde) bar.' : 'D > 0 ⇒ iki sany hakyky kök bar (rasional däl).')));
  else if (R.kind === 'num') items.push(S('Galan köpagza', `${poly(R.c)} = 0 deňlemäniň (${R.m}-nji derejeli) rasional kökleri ýok. Şeýle deňlemäniň kökleri sanly usul bilen — Durand–Kerner iterasiýasy bilen — 4 onluk belgä çenli takyklykda tapylýar.`));
  items.push(
    S('Häsiýetli sanlar', 'Ähli kökler (gaýtalanýan kökler köplügi boýunça ýazylýar):', J(E.roots.map((r, i) => eq(nm(i) + ' = <b>' + r.txt + '</b>')), '')),
    S('Barlag', 'Häsiýetli sanlaryň jemi tr(A)-a, köpeltmek hasyly |A|-a deň bolmaly:', eq(`${J(E.roots.map((_, i) => nm(i)), ' + ')} = ${fmt(math.sum(zs).re)} ≈ tr(A) = ${fmt(tr)}`) + eq(`${J(E.roots.map((_, i) => nm(i)), ' · ')} = ${fmt(math.prod(zs).re)} ≈ |A| = ${fmt(math.det(A))}`)));
  const rats = []; E.roots.forEach(r => { if (r.r && !rats.some(x => x.equals(r.r))) rats.push(r.r); });
  if (rats.length) items.push(S('Häsiýetli wektorlar', 'Her rasional λ üçin (A − λE)·v = 0 ulgamy Gauss–Jordan usuly bilen çözýäris (açmak üçin basyň):', rats.map(l => vecSteps(A, l)).join('') + (E.roots.some(r => !r.r) ? '<p>Rasional bolmadyk λ-lar üçin wektorlar bu ýerde görkezilmeýär: usul şol bir, emma sanlar takmynan bolýar.</p>' : '')));
  return items;
}
function steps(op, A, B, k, res){
  const n = A.length, m = A[0].length;
  switch (op){
    case 'add': case 'sub': {
      const pl = op === 'add', s = pl ? '+' : '−';
      return [
        S('Düzgün', `Iki matrisany ${pl ? 'goşmak' : 'aýyrmak'} üçin birmeňzeş ýerdäki (birmeňzeş setir we sütündäki) sanlary ${pl ? 'goşýarys' : 'aýyrýarys'}: cᵢⱼ = aᵢⱼ ${s} bᵢⱼ.`, row(table(A), sy(s), table(B))),
        S('Ýerine goýýarys', 'Her öýjük üçin degişli sanlary ýazýarys:', table(mx(A, (v, i, j) => `${fmt(v)} ${s} ${p(B[i][j])}`))),
        S('Hasaplaýarys', 'Her öýjügiň bahasyny hasaplaýarys:', row(sy('C ='), table(res)))
      ];
    }
    case 'scalar': return [
      S('Düzgün', 'Matrisany k sana köpeltmek üçin matrisanyň her sanyny k-a köpeldýäris: cᵢⱼ = k·aᵢⱼ.', row(sy('k = ' + fmt(k) + ','), table(A))),
      S('Ýerine goýýarys', 'Her sany k-a köpeldýäris:', table(mx(A, v => `${p(k)}·${p(v)}`))),
      S('Hasaplaýarys', '', row(sy('C ='), table(res)))
    ];
    case 'transpose': return [
      S('Düzgün', 'Setirleri sütün edip ýazýarys: (Aᵀ)ᵢⱼ = aⱼᵢ. A-nyň 1-nji setiri Aᵀ-iň 1-nji sütüni, 2-nji setiri 2-nji sütüni bolýar we ş.m.', row(table(A))),
      S('Netije', `${n}×${m} matrisadan ${m}×${n} matrisa alýarys:`, row(sy('Aᵀ ='), table(res)))
    ];
    case 'mul': {
      const L = [];
      res.forEach((r, i) => r.forEach((v, j) => L.push(eq(`c${sub(i + 1)}${sub(j + 1)} = ${J(A[i].map((a, q) => p(a) + '·' + p(B[q][j])), ' + ')} = ${J(A[i].map((a, q) => p(math.multiply(a, B[q][j]))), ' + ')} = <b>${fmt(v)}</b>`))));
      return [
        S('Ölçegleri barlaýarys', `A matrisa ${n}×${m}, B matrisa ${B.length}×${B[0].length}. A-nyň sütün sany (${m}) B-niň setir sanyna (${B.length}) deň, diýmek köpeltmek mümkin; netije ${n}×${B[0].length} matrisa bolar.`),
        S('Düzgün', 'cᵢⱼ — A-nyň i-nji setiriniň her sanyny B-niň j-nji sütüniniň degişli sanyna köpeldip, hasyllary goşmak: cᵢⱼ = aᵢ₁·b₁ⱼ + aᵢ₂·b₂ⱼ + …'),
        S('Her öýjügi hasaplaýarys', 'Köpeltmek hasyllaryny ýazyp, soňra jemleýäris:', L.join('')),
        S('Netije', '', row(table(A), sy('×'), table(B), sy('='), table(res)))
      ];
    }
    case 'det': return detSteps(A);
    case 'inv': {
      const d = math.det(A), E = idn(n), items = [S('Determinant', 'Ters matrisa diňe determinant 0-dan tapawutly bolanda bar. Şonuň üçin ilki |A| hasaplaýarys.', '<details><summary>|A| nähili hasaplandy? (açmak üçin basyň)</summary><ol class="steps">' + detSteps(A).map(li).join('') + '</ol></details>' + eq(`|A| = <b>${fmt(d)}</b> ≠ 0, diýmek ters matrisa bar.`))];
      if (n === 1) items.push(S('Hasaplaýarys', '1×1 matrisanyň ters matrisasy 1/a.', eq(`A⁻¹ = 1/${p(A[0][0])} = <b>${fmt(res[0][0])}</b>`)));
      else if (n === 2){
        const [[a, b], [c, e]] = A, ng = math.unaryMinus;
        items.push(
          S('Düzgün', '2×2 matrisa üçin: a we d sanlaryň ýerini çalyşýarys, b we c sanlaryň alamatyny üýtgedýäris, soňra hemmesini |A|-a bölýäris.', row(sy('A⁻¹ = (1/|A|) ·'), table([['d', '−b'], ['−c', 'a']]))),
          S('Ýerine goýýarys', '', row(sy('A⁻¹ = (1/' + p(d) + ') ·'), table([[e, ng(b)], [ng(c), a]]))),
          S('Hasaplaýarys', `Her sany ${fmt(d)}-a bölýäris:`, row(sy('A⁻¹ ='), table(res))));
      } else {
        const aug = A.map((r, i) => [...r, ...E[i]]), g = reduce(aug, n, true, true);
        items.push(S('Gauss–Jordan usuly', 'A matrisanyň sagyna birlik matrisany (E) ýazýarys: [A | E]. Setir amallary bilen çep tarapy E-ä getirsek, sag tarapda A⁻¹ emele gelýär.', table(aug, n)), ...gsteps(g, n),
          S('Netije', 'Çep tarap birlik matrisa boldy, sag tarap — ters matrisa:', row(sy('A⁻¹ ='), table(res))));
      }
      items.push(S('Barlag', 'A · A⁻¹ birlik matrisa (E) bolmaly:', row(table(A), sy('·'), table(res), sy('='), table(math.multiply(A, res)))));
      return items;
    }
    case 'trace': return [
      S('Düzgün', 'Baş diagonaldaky sanlary goşýarys: tr(A) = a₁₁ + a₂₂ + … + aₙₙ.', row(table(A))),
      S('Hasaplaýarys', '', eq(`tr(A) = ${J(A.map((r, i) => p(r[i])), ' + ')} = <b>${fmt(res)}</b>`))
    ];
    case 'rank': {
      const g = reduce(A, m, false, false);
      return [
        S('Usul', 'Matrisany basgançakly (üçburç) görnüşe getirýäris: baş elementiň aşagyndaky sanlary setir amallary bilen nollaýarys. Rang — şeýle matrisadaky nolsyz setirleriň sanydyr.', table(A)),
        ...gsteps(g),
        S('Netije', 'Nolsyz setirleri sanaýarys:', table(g.R) + eq(`rank(A) = <b>${g.rank}</b>`))
      ];
    }
    case 'eig': return eigSteps(A, res);
  }
}
function show(op, A, B, k, res){
  const ans = op === 'eig' ? J(res.roots.map((r, i) => 'λ' + sub(i + 1) + ' = ' + r.txt), '<br>') : Array.isArray(res) ? table(res) : fmt(res);
  const given = row(...(op === 'scalar' ? [sy('k = ' + fmt(k) + ',')] : []), sy('A ='), table(A), ...(B ? [sy('B ='), table(B)] : []));
  return `<h2>Jogap</h2><div class="ans">${ans}</div><h3>Berlen</h3>${given}<h3>Çözülişi (ähli ädimler)</h3><ol class="steps">${steps(op, A, B, k, res).map(li).join('')}</ol>`;
}
const note = n => '<div class="note"><h2>' + esc(n.title) + '</h2><p>' + esc(n.message) + '</p></div>';
function singular(A){
  return '<h2>Ters matrisa ýok</h2><p class="ans">|A| = 0</p>'
    + '<p>Determinant 0 bolsa, matrisa <b>singulýar</b> diýilýär: onuň setirleri (ýa-da sütünleri) biri-birine çyzykly baglydyr, şonuň üçin A · X = E deňlemäniň çözgüdi ýok. Ters matrisa diňe |A| ≠ 0 bolanda bar.</p>'
    + '<h3>Determinant nähili hasaplandy</h3><ol class="steps">' + detSteps(A).map(li).join('') + '</ol>'
    + '<p>Maslahat: matrisanyň bir-iki sanyny üýtgedip, determinanty täzeden barlap görüň.</p>';
}


// [orta mekdep, uniwersitet] düşündirişleri
const INFO = {
  add: ['Iki matrisanyň birmeňzeş ýerdäki sanlaryny goşýarys. Ölçegleri deň bolmaly.', 'C = A + B, cᵢⱼ = aᵢⱼ + bᵢⱼ; diňe m×n ölçegli matrisalar üçin kesgitlenen.'],
  sub: ['Birmeňzeş ýerdäki sanlary aýyrýarys. Ölçegleri deň bolmaly.', 'C = A − B, cᵢⱼ = aᵢⱼ − bᵢⱼ.'],
  mul: ['A-nyň setirini B-niň sütüni bilen köpeldip jemleýäris. A-nyň sütün sany B-niň setir sanyna deň bolmaly.', 'C = AB, cᵢⱼ = Σₖ aᵢₖ·bₖⱼ. Umuman AB ≠ BA (kommutatiw däl).'],
  scalar: ['Matrisanyň her sanyny k sana köpeldýäris.', 'C = kA, cᵢⱼ = k·aᵢⱼ; matrisalar giňişliginiň çyzykly amaly.'],
  transpose: ['Setirleri sütün edip ýazýarys: birinji setir birinji sütün bolýar.', '(Aᵀ)ᵢⱼ = aⱼᵢ; (AB)ᵀ = BᵀAᵀ.'],
  det: ['Kwadrat matrisa degişli bir san. 2×2: ad − bc; 3×3: Sarrus düzgüni.', 'det A; det(AB) = det A · det B; det A ≠ 0 ⇔ A ters öwrülýär.'],
  inv: ['A · A⁻¹ = E bolýan matrisa. Diňe determinant 0-dan tapawutly bolsa bar.', 'A⁻¹ = adj(A)/det A ýa-da Gauss–Jordan: [A | E] → [E | A⁻¹].'],
  trace: ['', 'tr A = Σ aᵢᵢ = Σ λᵢ; tr(AB) = tr(BA).'],
  rank: ['', 'rank A = basgançakly görnüşdäki nolsyz setirleriň sany = çyzykly garaşsyz setirleriň sany.'],
  eig: ['', 'Av = λv; det(A − λE) = 0. Köpagzanyň rasional kökleri takyk, galanlary sanly usul bilen tapylýar; rasional λ üçin häsiýetli wektorlar hem görkezilýär.']
};
function editor(root, name, onChange){
  root.innerHTML = `<div class="card-head"><h2>${name} matrisasy</h2><div class="mini"><button type="button" data-f="e">Birlik (E)</button><button type="button" data-f="z">Nol</button></div></div><div class="dims"><label>Setir <select></select></label><label>Sütün <select></select></label></div><p class="hint" hidden></p><div class="grid"></div><p class="hint">Boş öýjük 0 hasaplanýar. Kesir üçin 1/2 ýaly ýazyp bilersiňiz.</p>`;
  const [r, c] = root.querySelectorAll('select'), g = root.querySelector('.grid'), hint = root.querySelector('.hint'), mem = {};
  let sq = false;
  const fill = (s, m) => { const v = +s.value || 2; s.innerHTML = ''; for (let i = 1; i <= m; i++) s.add(new Option(i, i)); s.value = Math.min(v, m); };
  function draw(){
    const oc = +g.dataset.c || 0;
    [...g.children].forEach((el, n) => { mem[Math.floor(n / oc) + ',' + (n % oc)] = el.value; });
    const R = +r.value, C = +c.value; g.dataset.c = C; g.style.setProperty('--c', C); g.innerHTML = '';
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++){
      const t = document.createElement('input');
      t.value = mem[i + ',' + j] ?? String((i * 3 + j) % 5 + (name === 'A' ? 1 : 2));
      t.setAttribute('aria-label', `${name}: ${i + 1}-nji setir, ${j + 1}-nji sütün`); t.autocomplete = 'off'; t.spellcheck = false; t.setAttribute('autocapitalize', 'off'); t.setAttribute('enterkeyhint', 'go'); g.append(t);
    }
  }
  root.querySelectorAll('.mini button').forEach(b => b.onclick = () => { const C = +c.value; [...g.children].forEach((el, n) => { el.value = b.dataset.f === 'e' && Math.floor(n / C) === n % C ? '1' : '0'; el.removeAttribute('aria-invalid'); }); });
  g.addEventListener('input', e => e.target.removeAttribute('aria-invalid'));
  r.onchange = () => { if (sq) c.value = r.value; draw(); onChange(); };
  c.onchange = () => { draw(); onChange(); };
  return {
    rows: () => +r.value, cols: () => +c.value,
    setMax(m){ fill(r, m); fill(c, m); draw(); },
    // Amal talap edýän ölçegi awtomatiki sazlaýar: ulanyjy ýalňyşlyk almaz ýaly.
    lock(o){
      const n = Math.max(+r.value, +c.value); let msg = o.note || '';
      if (o.square){ msg = r.value === c.value ? 'Bu amal diňe kwadrat (n×n) matrisa üçin, şonuň üçin setir we sütün sany deň.' : `Bu amal kwadrat matrisa talap edýär, şonuň üçin ölçeg ${n}×${n} edildi.`; r.value = c.value = n; }
      if (o.rows) r.value = o.rows;
      if (o.cols) c.value = o.cols;
      sq = !!o.square; r.disabled = !!o.rows; c.disabled = sq || !!o.cols;
      c.closest('label').hidden = sq; r.closest('label').firstChild.textContent = sq ? 'Ölçeg (n×n) ' : 'Setir ';
      hint.hidden = !msg; hint.textContent = msg; draw();
    },
    get(){
      const R = +r.value, C = +c.value, ins = [...g.children];
      return Array.from({ length: R }, (_, i) => Array.from({ length: C }, (_, j) => {
        const el = ins[i * C + j];
        try { return parse(el.value); }
        catch (e) { el.setAttribute('aria-invalid', 'true'); el.focus(); throw new Note(e.title || 'Sanlary barlaň', `${name} matrisasy, ${i + 1}-nji setir, ${j + 1}-nji sütün: ${e.message}`); }
      }));
    }
  };
}




const $ = id => document.getElementById(id);
const SQ = ['det', 'inv', 'trace', 'eig'];
const A = editor($('matA'), 'A', link), B = editor($('matB'), 'B', link), op = $('op'), out = $('out');
let level = 'school';
try { level = localStorage.getItem('amatly-level') === 'uni' ? 'uni' : 'school'; } catch (e) {}
const cur = () => OPS.find(o => o.id === op.value);
// Ölçegleri amala görä awtomatiki sazlaýar: ýalňyşlyk döremezden öň öňüni alýar.
function link(){
  const id = op.value;
  A.lock({ square: SQ.includes(id) });
  if (id === 'add' || id === 'sub') B.lock({ rows: A.rows(), cols: A.cols(), note: 'B-niň ölçegi A bilen deň bolmaly, şonuň üçin awtomatiki sazlanýar.' });
  else if (id === 'mul') B.lock({ rows: A.cols(), note: 'B-niň setir sany A-nyň sütün sanyna deň bolmaly (köpeltmek düzgüni).' });
  else B.lock({});
}
function sync(){
  link(); $('matB').hidden = !cur().two; $('kRow').hidden = op.value !== 'scalar';
  $('info').textContent = INFO[op.value][level === 'uni' ? 1 : 0] || INFO[op.value][1];
  out.hidden = true;
}
function setLevel(l){
  level = l; document.body.dataset.level = l;
  document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.level === l));
  try { localStorage.setItem('amatly-level', l); } catch (e) {}
  const keep = op.value; op.innerHTML = '';
  OPS.filter(o => l === 'uni' || !o.uni).forEach(o => op.add(new Option(o.name, o.id)));
  if ([...op.options].some(o => o.value === keep)) op.value = keep;
  const m = l === 'uni' ? 6 : 3; A.setMax(m); B.setMax(m); sync();
}
document.querySelectorAll('.seg button').forEach(b => b.onclick = () => setLevel(b.dataset.level));
op.onchange = sync;
$('k').oninput = e => e.target.removeAttribute('aria-invalid');
$('go').onclick = () => {
  let a, html;
  try {
    const o = cur(); a = A.get(); const b = o.two ? B.get() : null;
    let k = null;
    if (o.id === 'scalar') { try { k = parse($('k').value); } catch (e) { $('k').setAttribute('aria-invalid', 'true'); $('k').focus(); throw new Note(e.title || 'Sanlary barlaň', 'k sany: ' + e.message); } }
    html = show(o.id, a, b, k, calc(o.id, a, b, k));
  } catch (e) {
    if (!(e instanceof Note)) console.error(e);
    html = e.singular ? '<div class="note">' + singular(a) + '</div>'
      : note(e instanceof Note ? e : new Note('Garaşylmadyk ýagdaý', 'Hasaplamany ýerine ýetirip bolmady. Sanlary barlap, täzeden synanyşyň.'));
  }
  out.innerHTML = html; out.hidden = false; out.focus({ preventScroll: true }); out.scrollIntoView({ block: 'start' });
};
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest('.grid, #kRow')) $('go').click(); });
setLevel(level);

})();
