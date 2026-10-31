(function(){
  "use strict";
  const $ = (id) => document.getElementById(id);
  let score=0, total=0, streak=0, bestStreak = Store.num("nm.best", 0), cur=null, last="";
  const statRow = $("nmScore").closest(".game-row");
  addStat(statRow, "nmStreak", "Yzygiderli", 0);
  addStat(statRow, "nmLevel", "Derejesi", 1);
  addStat(statRow, "nmBest", "Rekord", bestStreak);
  const strip = (s) => s.replace(/^0[bxo]/i, "");                 // math.js-iň öz setirlerinden prefiksi aýyrýar
  const PREFIX = {2:/^0b/, 8:/^0o/, 16:/^0x/};                    // ulanyjynyň jogabynda diňe şol ulgamyň prefiksi (0b1 hex-de san!)
  const DIGITS = {2:"0 we 1", 8:"0–7", 10:"0–9", 16:"0–9 we A–F"};
  const VALID = { 2:/^[01]+$/, 8:/^[0-7]+$/, 10:/^\d+$/, 16:/^[0-9a-f]+$/ };
  const level = () => Math.min(4, Math.floor(streak / 3));      // her 3 dogry jogapdan soň kynlaşýar

  function make(){
    const L = level(), top = (n) => (8 << L) * n;               // 8..128, 16..256, ...
    const num = () => math.randomInt(1, top(2)), big = () => math.randomInt(16, top(4) + 16);
    const bit = () => math.randomInt(1, (8 << Math.min(L, 3)) * 2);   // 1..15, 1..31, 1..63, 1..127
    const T = [
      () => { const n = num(); return {q:`${n} = ? (ikilik)`, v:n, b:2}; },
      () => { const n = num(); return {q:`${strip(math.bin(n))}₂ = ? (onluk)`, v:n, b:10}; },
      () => { const n = big(); return {q:`${n} = ? (hex)`, v:n, b:16}; },
      () => { const n = big(); return {q:`${strip(math.hex(n)).toUpperCase()}₁₆ = ? (onluk)`, v:n, b:10}; },
      () => { const a = bit(), b = bit(); return {q:`${a} AND ${b} = ?`, v:math.bitAnd(a, b), b:10}; },
      () => { const a = bit(), b = bit(); return {q:`${a} XOR ${b} = ?`, v:math.bitXor(a, b), b:10}; }
    ];
    if (L >= 1) T.push(() => { const a = bit(), b = bit(); return {q:`${a} OR ${b} = ?`, v:math.bitOr(a, b), b:10}; });
    if (L >= 2) T.push(() => { const n = big(); return {q:`${n} = ? (sekizlik)`, v:n, b:8}; },
                       () => { const a = math.randomInt(1, 16), s = math.randomInt(1, 3); return {q:`${a} << ${s} = ?`, v:a * Math.pow(2, s), b:10}; });
    let it; do { it = T[math.randomInt(0, T.length)](); } while (it.q === last);
    return it;
  }

  function next(){
    cur = make(); last = cur.q;
    $("nmProblem").textContent = cur.q;
    $("nmLevel").textContent = level() + 1;
    $("nmInput").value = ""; $("nmInput").focus();
  }

  function check(){
    const raw = $("nmInput").value.trim().toLowerCase();
    if (!raw) return;
    const v = PREFIX[cur.b] ? raw.replace(PREFIX[cur.b], "") : raw;
    const fb = $("nmFeedback");
    if (!v || !VALID[cur.b].test(v)){                             // nädogry format sanalmaýar
      fb.className = "game-feedback bad"; fb.textContent = `Ýalňyş format: diňe ${DIGITS[cur.b]} sifrlerini ulanyň.`; return;
    }
    total++;
    if (parseInt(v, cur.b) === cur.v){                            // öň nollar ähmiýetsiz: 0101 = 101
      score++; streak++;
      fb.className = "game-feedback ok"; fb.textContent = "Dogry!" + (streak % 3 === 0 && streak <= 12 ? " ⬆ Dereje ýokarlandy" : "");
    } else {
      streak = 0;
      fb.className = "game-feedback bad"; fb.textContent = `Ýalňyş, dogry jogap: ${cur.v.toString(cur.b).toUpperCase()}`;
    }
    if (streak > bestStreak){ bestStreak = streak; Store.set("nm.best", bestStreak); }
    $("nmScore").textContent = score; $("nmTotal").textContent = total;
    $("nmStreak").textContent = streak; $("nmBest").textContent = bestStreak;
    next();
  }

  $("nmCheck").addEventListener("click", check);
  $("nmInput").addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
  next();
})();
