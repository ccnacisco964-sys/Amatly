(function () {
"use strict";
const __mods = Object.create(null);

__mods["modules/utils.js"] = (function () {
/* Umumy kömekçi funksiýalar. DOM-a diňe $ we $$ degýär, galanlary arassa funksiýa. */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Tekst ýa-da atributy innerHTML-e howpsuz goýmak üçin. */
function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Gözleg üçin: kiçi harp we diakritiksiz (ä→a, ý→y, ş→s, ç→c, ž→z, ň→n, ö→o, ü→u). */
function normalize(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Boş gözleg hemme zady tapýar; ýogsam diakritiksiz agzaýar. */
function matchesQuery(text, query) {
  const q = normalize(query).trim();
  return q === "" || normalize(text).includes(q);
}

const MONTHS = [
  "ýanwar", "fewral", "mart", "aprel", "maý", "iýun",
  "iýul", "awgust", "sentýabr", "oktýabr", "noýabr", "dekabr",
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "ÝÝÝÝ-AA-GG" hakyky senemi? (2026-02-30 ýaly senelere ýok diýýär) */
function isValidISODate(value) {
  const m = ISO_DATE.exec(String(value));
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** "2026-10-09" → "9 oktýabr 2026" (nädogry sene bolsa boş setir). */
function formatDate(value) {
  if (!isValidISODate(value)) return "";
  const parts = String(value).split("-");
  return Number(parts[2]) + " " + MONTHS[Number(parts[1]) - 1] + " " + parts[0];
}

/** Ýerli wagt boýunça şu günüň senesi ("ÝÝÝÝ-AA-GG"). UTC däl: Aşgabatda gije hem dogry. */
function todayISO(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
}

/** Awatar üçin ilkinji harp (emoji bilen hem döwülmeýär). */
function initial(name) {
  const first = Array.from(String(name).trim())[0];
  return first ? first.toUpperCase() : "?";
}

/** Harplaryň sany (emoji 1 harp hasaplanýar). */
function charCount(value) {
  return Array.from(String(value)).length;
}

/** 4 → "4", 4.5 → "4,5" */
function formatNumber(value) {
  return String(Math.round(Number(value) * 10) / 10).replace(".", ",");
}
return { $, $$, esc, normalize, matchesQuery, isValidISODate, formatDate, todayISO, initial, charCount, formatNumber };
})();

__mods["modules/toast.js"] = (function () {
const { $ } = __mods["modules/utils.js"];
/* Habarlar: toast() — ekranda gysga görkezýär; announce() — diňe ekran okaýjylara aýdýar. */


let hideTimer;
let clearTimer;

function toast(message, duration = 2600) {
  const el = $("#toast");
  if (!el) return;
  clearTimeout(hideTimer);
  clearTimeout(clearTimer);
  el.textContent = message;
  el.classList.add("is-visible");
  hideTimer = setTimeout(() => {
    el.classList.remove("is-visible");
    // ýitenden soň tekst galmasyn (ekran okaýjy köne habary okamasyn)
    clearTimer = setTimeout(() => {
      el.textContent = "";
    }, 400);
  }, duration);
}

function announce(message) {
  const el = $("#live");
  if (!el) return;
  el.textContent = "";
  // gaýtalanýan habar hem ýene aýdylsyn diýip, azajyk wagtdan ýazýarys
  setTimeout(() => {
    el.textContent = message;
  }, 60);
}
return { toast, announce };
})();

__mods["modules/nav.js"] = (function () {
const { $$ } = __mods["modules/utils.js"];
const { toast } = __mods["modules/toast.js"];
/* Menýudaky entek taýýar däl bölümler: basylanda sahypa geçmeýär, "ýakynda" diýip habar berýär. */



function initNav() {
  $$("[data-soon]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      toast(link.textContent.trim() + ": ýakynda goşular.");
    });
  });
}
return { initNav };
})();

__mods["modules/data.js"] = (function () {
/* ==========================================================================
   Mazmun: täzelikler, ýakynda goşulýanlar, mysal pikirler.
   Täzelik goşmak üçin UPDATES-e täze obýekt goş (tertip möhüm däl, sene boýunça tertiplenýär):
     { date: "ÝÝÝÝ-AA-GG", type: "taze" | "gow" | "duz", title, text, link, linkText }
   ========================================================================== */

/** Täzeligiň görnüşleri: açar → görkezilýän at */
const UPDATE_TYPES = { taze: "Täze", gow: "Gowulandyryş", duz: "Düzediş" };

const UPDATES = [
  {
    date: "2026-10-29",
    type: "taze",
    title: "Amatly AI API açarsyz hem işleýär: «Amatly motory»",
    text: "Claude API sazlanmadyk bolsa (açar ýok, internet ýok ýa-da saýt faýldan açylanda) Amatly AI soraglara saýtyň öz hasaplaýyş motorlary bilen jogap berýär: limit, önüm, integral, kwadrat we köpagzaly deňlemeler, trigonometrik deňlemeler, deňsizlikler, deňlemeler ulgamy (Gauss, Kramer), matrisalar, funksiýany derňemek we grafik, simpleks, statistika, droblar, geometriýa we hereket meseleleri. Her çözgüt ädimme-ädim we barlagly; çatda «Amatly motory» diýip bellenýär.",
    link: "../index.html?ai=1",
    linkText: "Amatly AI-ny açyň",
  },
  {
    date: "2026-10-29",
    type: "taze",
    title: "Hasap ähli enjamlaryňyzda",
    text: "Hasap indi serwerde saklanýar: şol bir at we parol bilen islendik brauzerde we telefonda girip bilersiňiz. Tema, harp ölçegi, oýun rekordlary, Kalkulus kursunyň ösüşi we türgenleşik netijeleri enjamlaryň arasynda özi deňleşdirilýär (AI açary we AI söhbetleri däl). Öň diňe brauzerde açylan hasap ilkinji girişde serwere geçirilýär. Hosting PHP-ni işletmese, hasaby faýla göçürip başga brauzerde dikeldip bolýar.",
    link: "../sazlamalar/index.html#hasap",
    linkText: "Hasap we enjamlar",
  },
  {
    date: "2026-10-29",
    type: "taze",
    title: "Programma we offline görnüşi",
    text: "Amatly.com-y telefonda ýa-da kompýuterde programma hökmünde gurup bolýar. Açan sahypalaryňyz internetsiz hem açylýar; Sazlamalarda «Ähli saýty ýükle» basyp, ähli bölümleri we hasaplaýjylary (≈5,6 MB) öňünden ýükläp bilersiňiz. Saýt täzelende diňe üýtgän faýllar ýüklenýär.",
    link: "../sazlamalar/index.html#offline",
    linkText: "Programma we offline",
  },
  {
    date: "2026-10-29",
    type: "taze",
    title: "Trigonometriýa bölümi",
    text: "Birlik töwerek (süýşürip bolýan), gradus we radian, sin/cos/tg/ctg takyk bahalary, getiriş formulalary, grafikler, toždestwolar we toždestwo barlaýjy, ters funksiýalar, trigonometrik deňlemeleri umumy çözgüdi bilen ädimme-ädim çözýän kalkulýator we türgenleşik.",
    link: "../trigonometriya/index.html",
    linkText: "Bölümi açyň",
  },
  {
    date: "2026-10-29",
    type: "taze",
    title: "Çyzykly deňlemeler ulgamy n×n: Gauss we Kramer",
    text: "Algebra bölüminde 2×2-den 6×6-a çenli ulgamlar: Gauss (göni we yza ýöriş), Gauss–Žordan we Kramer usullary, kesgitleýjiler, ranglar (Kroneker–Kapelli), çözgüdi ýok ýa-da tükeniksiz köp ulgamlar we jogaby deňlemelere goýup barlamak. Hasaplamalar takyk droblarda.",
    link: "../algebra/index.html#nxn-ulgam",
    linkText: "Kalkulýatory açyň",
  },
  {
    date: "2026-10-29",
    type: "taze",
    title: "San usullary: interpolýasiýa we Ýakobi / Gauss–Zeýdel",
    text: "Lagranžyň we Nýutonyň interpolýasiýa köpagzalary (bölünen tapawutlar tablisasy, grafik, Runge mysaly) we çyzykly ulgamlary gaýtalap çözýän Ýakobi we Gauss–Zeýdel usullary: diagonal agdyklygy barlamak, setirleri özi tertipleşdirmek, ýygnanyş grafigi we takyk çözgüt bilen deňeşdirmek.",
    link: "../san-usullary/index.html#interpolyasiya",
    linkText: "Usullary açyň",
  },
  {
    date: "2026-10-29",
    type: "taze",
    title: "Amal barlagy: 6 täze usul",
    text: "Bellemek meselesi (Wengr usuly), ikilenji simpleks usuly, bitin sanly programmirleme (şahalar we araçäkler), oýunlar nazaryýeti (eýer nokady, garyşyk strategiýalar), tor meýilnamasy CPM/PERT (kritiki ýol, Gant diagrammasy, ähtimallyk) we grafda iň gysga ýol (Deýkstra, Bellman–Ford, Floýd–Uorşell). Her biri ädimme-ädim we jogaby barlap görkezýär.",
    link: "../amal-barlagy/index.html",
    linkText: "Bölümi açyň",
  },
  {
    date: "2026-10-29",
    type: "gow",
    title: "Amatly AI simpleks motoryny ulanýar",
    text: "Çyzykly we bitin sanly programmirleme meselelerini Amatly AI indi saýtyň simpleks motory bilen çözýär: optimal baha, her çäklendirmäniň barlagy, kölege bahalary we kalkulýatoryň sahypasyna salgy çatda kartada görkezilýär — limit we integraldaky ýaly jogap barlanýar.",
    link: "../amal-barlagy/simpleks.html",
    linkText: "Simpleks kalkulýatory",
  },
  {
    date: "2026-10-29",
    type: "gow",
    title: "Bitewi dizaýn we çalt ýüklenmek",
    text: "Ähli bölümler saýtyň öz harplaryny ulanýar (Google Fonts-suz, internet bolmasa-da), gözleg we AI faýllary diňe gerek bolanda ýüklenýär, Statistika skripti 792 KB-dan 133 KB-a kiçeldi, hosting üçin gysyş we keş sazlamalary goşuldy. Ulag meselesiniň sahypalarynda ekran okaýjylar üçin ýazgylar, ähli sahypalarda paýlaşmak suraty we kanoniki salgy bar.",
    link: "../index.html",
    linkText: "Baş sahypa",
  },
  {
    date: "2026-10-23",
    type: "taze",
    title: "Simpleks usuly: çyzykly programmirleme",
    text: "Amal barlagy bölüminde täze kalkulýator: maksat funksiýasyny we çäklendirmeleri formula görnüşinde ýazyň (max Z = 3x1 + 5x2 …) ýa-da tablisa bilen giriziň. Kanoniki görnüş, her simpleks tablisa, çözüji element we Žordan–Gauss özgertmesi ädimme-ädim görkezilýär; M-usuly we iki tapgyrly usul, iki üýtgeýänli meselede grafiki usul, ikilenji mesele we kölege bahalary. Hasaplamalar math.js bilen takyk droblarda.",
    link: "../amal-barlagy/simpleks.html",
    linkText: "Kalkulýatory açyň",
  },
  {
    date: "2026-10-22",
    type: "taze",
    title: "Amatly AI: türkmen dilinde matematika mugallymy",
    text: "Her sahypada aşakdaky sag burçda. Meseläni ýazyň ýa-da suratyny goşuň: AI ony ädimme-ädim çözýär, depderdäki çözgüdiňizden ýalňyş ädimi tapýar, çatda janly grafik çyzýar we limit, önüm, integral jogaplaryny saýtyň öz hasaplaýyş motory bilen barlaýar. «Mugallym» režiminde jogaby derrew aýtman, maslahat bilen özüňize çözdürýär.",
    link: "../index.html",
    linkText: "Baş sahypada synap görüň",
  },
  {
    date: "2026-10-22",
    type: "gow",
    title: "Täze dizaýn we bir ýerden giriş",
    text: "Baş sahypa, menýu we saýtyň nyşany täzelendi. Hasaba giriş indi diňe Baş sahypada: bölümlerde «Salam / Çykmak» ýazgysy ýok, parollar PBKDF2 bilen ygtybarly saklanýar.",
    link: "../index.html",
    linkText: "Baş sahypa",
  },
  {
    date: "2026-10-21",
    type: "taze",
    title: "Kalkulus bölümi açyldy",
    text: "15 sapak we jemleýji synag: funksiýalardan, limit, önüm we integraldan hatarlara, köp üýtgeýänli funksiýalara we differensial deňlemelere çenli. Her sapakda düşündiriş, ädimme-ädim çözýän kalkulýator, grafik, maşk we test bar.",
    link: "../kalkulus/index.html",
    linkText: "Kalkulusy açyň",
  },
  {
    date: "2026-10-18",
    type: "gow",
    title: "Baş sahypa täzelendi",
    text: "Gözleg işleýär; \"Çalt başlaň\", \"Günüň meselesi\" we soňky açan gurallaryňyz goşuldy.",
    link: "../index.html",
    linkText: "Baş sahypa",
  },
  {
    date: "2026-10-09",
    type: "taze",
    title: "MODI usuly goşuldy",
    text: "U-V usuly bilen islendik başlangyç meýilnamany ädimme-ädim optimala çenli gowulandyrýar. Başlangyç üçin beýleki üç usulyň islendigini saýlap bilersiňiz.",
    link: "../amal-barlagy/modi.html",
    linkText: "Kalkulýatory açyň",
  },
  {
    date: "2026-10-02",
    type: "taze",
    title: "Vogel çemeleşme usuly (VAM)",
    text: "Setir we sütünleriň tapawutlaryna esaslanyp, optimala iň ýakyn başlangyç meýilnamany gurýar.",
    link: "../amal-barlagy/vogel.html",
    linkText: "Kalkulýatory açyň",
  },
  {
    date: "2026-09-24",
    type: "gow",
    title: "Oýunlar aýratyn sahypada",
    text: "Matematika oýunlary indi “Oýunlar” bölüminde. Esasy sahypa has ýeňil we çalt açylýar.",
    link: "../oyunlar/index.html",
    linkText: "Oýunlara geçiň",
  },
  {
    date: "2026-09-15",
    type: "taze",
    title: "Iň az baha usuly",
    text: "Her ädimde tablisadaky iň arzan öýjügi saýlap, başlangyç meýilnamany çalt gurýar.",
    link: "../amal-barlagy/in-az-baha.html",
    linkText: "Kalkulýatory açyň",
  },
  {
    date: "2026-09-06",
    type: "taze",
    title: "Giriş we hasap açmak",
    text: "Ulanyjy ady we parol bilen hasap açyň. “Meni ýatda saklaň” saýlansa, indiki gezek awtomatiki girýärsiňiz.",
    link: "../index.html",
    linkText: "Giriş sahypasy",
  },
  {
    date: "2026-08-28",
    type: "taze",
    title: "Demirgazyk-günbatar burç usuly",
    text: "Ulag meselesiniň iň ýönekeý usuly: tablisanyň ýokarky-çep burçundan başlap öýjükleri ädimme-ädim doldurýar.",
    link: "../amal-barlagy/demirgazyk-gunbatar.html",
    linkText: "Kalkulýatory açyň",
  },
];

/** "Ýakynda" sanawy (Bölümler kartoçkasynyň aşagynda). Boş bolsa görkezilmeýär.
    Öňki sanawdaky bölümleriň hemmesi (Statistika, Matrisa, Kalkulus, Geometriýa, Söz meseleleri,
    San usullary, Öň-algebra) eýýäm saýtda bar, şonuň üçin aýryldy. */
const ROADMAP = [
  "Biz barada sahypasy",
];

/** Pikir ýazanda saýlanýan bölümler (süzgüçde hem şulardan peýdalanylýar) */
const TOPICS = ["Algebra", "Amal barlagy", "Oýunlar", "Başga"];

/** Mysal pikirler ("Mysal" belgisi bilen görkezilýär). helpful — "Peýdaly" sanynyň başlangyjy. */
const SEED_REVIEWS = [
  {
    id: "s1",
    name: "Aýna G.",
    topic: "Amal barlagy",
    rating: 5,
    text: "MODI usulynyň ädimme-ädim düşündirilişi örän düşnükli. Ekzamenden öň ýene bir gezek gözden geçirmäge gaty kömek etdi.",
    date: "2026-10-08",
    helpful: 6,
  },
  {
    id: "s2",
    name: "Merdan A.",
    topic: "Oýunlar",
    rating: 4,
    text: "Oýunlar gyzykly we çalt açylýar. Has köp derejeler goşulsa, has hem gowy bolardy.",
    date: "2026-10-05",
    helpful: 3,
  },
  {
    id: "s3",
    name: "Selbi O.",
    topic: "Algebra",
    rating: 5,
    text: "Çözülişiň her ädimini görmek ýalňyşymy tapmaga kömek etdi. Diňe netije däl, düşündiriş hem bar.",
    date: "2026-10-01",
    helpful: 4,
  },
  {
    id: "s4",
    name: "Berdi K.",
    topic: "Başga",
    rating: 4,
    text: "Telefonda hem oňat işleýär. Statistika bölüminiň goşulmagyna garaşýaryn.",
    date: "2026-09-27",
    helpful: 1,
  },
];

/** localStorage açary. Üýtgetme: köne ulanyjylaryň ýazan pikirleri ýitýär. */
const STORAGE_KEY = "amatly_pikirler_v1";

/** Tema saýlawynyň açary (components/head.html-daky inline skriptde hem şol bir açar bar). */
const THEME_KEY = "amatly_theme";
return { UPDATE_TYPES, UPDATES, ROADMAP, TOPICS, SEED_REVIEWS, STORAGE_KEY, THEME_KEY };
})();

__mods["modules/theme.js"] = (function () {
const { $ } = __mods["modules/utils.js"];
const { THEME_KEY } = __mods["modules/data.js"];
/* Açyk / garaňky tema. Saýlawy brauzerde saklaýar; saýlanmadyk bolsa OS sazlamasyna eýerýär. */



const darkQuery = () => (window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null);

/** Häzir hakykatdan görünýän tema: "dark" ýa-da "light". */
function currentTheme() {
  const chosen = document.documentElement.getAttribute("data-theme");
  if (chosen === "dark" || chosen === "light") return chosen;
  const query = darkQuery();
  return query && query.matches ? "dark" : "light";
}

function initTheme() {
  const button = $("#theme-toggle");
  if (!button) return;

  const sync = () => button.setAttribute("aria-pressed", String(currentTheme() === "dark"));
  sync();

  button.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {
      /* saklap bolmasa-da tema şu sahypada üýtgeýär */
    }
    sync();
  });

  // OS temasy üýtgände (el bilen saýlanmadyk bolsa) düwmäniň ýagdaýyny täzele
  const query = darkQuery();
  if (query && query.addEventListener) query.addEventListener("change", sync);
}
return { currentTheme, initTheme };
})();

__mods["modules/search.js"] = (function () {
const { $ } = __mods["modules/utils.js"];
/* Ýokardaky gözleg meýdany. Sahypadaky sanawlar onChange bilen gözlegi diňleýär. */


function initSearch() {
  const form = $("#sf");
  const input = $("#q");
  const listeners = [];
  const emit = () => listeners.forEach((fn) => fn());

  if (form) form.addEventListener("submit", (e) => e.preventDefault());
  if (input) input.addEventListener("input", emit);

  return {
    /** Häzirki gözleg sözi (boş bolup biler). */
    get query() {
      return input ? input.value.trim() : "";
    },
    onChange(fn) {
      listeners.push(fn);
    },
    /** Gözlegi arassalaýar (özi täzeden çyzmaýar). */
    clear() {
      if (input) input.value = "";
    },
  };
}
return { initSearch };
})();

__mods["modules/updates.js"] = (function () {
const { $, $$, esc, formatDate, matchesQuery } = __mods["modules/utils.js"];
const { ROADMAP, UPDATES, UPDATE_TYPES } = __mods["modules/data.js"];
const { announce } = __mods["modules/toast.js"];
/* "Näme täze" sahypasy: süzgüç düwmeleri, wagt çyzygy, "Ýakynda goşular". */




const EMPTY = '<li class="tl-empty">Täzelik tapylmady. Gözleg sözüni üýtgediň ýa-da süzgüji arassalaň.</li>';
const MONTH_NAMES = ["Ýanwar", "Fewral", "Mart", "Aprel", "Maý", "Iýun", "Iýul", "Awgust", "Sentýabr", "Oktýabr", "Noýabr", "Dekabr"];
const WEEKDAYS = ["ýekşenbe", "duşenbe", "sişenbe", "çarşenbe", "penşenbe", "anna", "şenbe"];

/** Bir täzelik: çepde gün (sene), sagda görnüşi, ady, düşündirişi we baglanyşygy */
function itemHTML(u) {
  const label = UPDATE_TYPES[u.type] || u.type;
  const p = String(u.date).split("-");
  const wd = WEEKDAYS[new Date(+p[0], +p[1] - 1, +p[2]).getDay()] || "";
  const link = u.link ? '<a class="tl-link" href="' + esc(u.link) + '">' + esc(u.linkText || "Açyň") + "</a>" : "";
  return (
    '<li class="tl-item">' +
    '<time class="tl-date" datetime="' + esc(u.date) + '" title="' + esc(formatDate(u.date)) + '"><b>' + Number(p[2]) + "</b><span>" + wd + "</span></time>" +
    '<div class="tl-body"><span class="tag tag--' + esc(u.type) + '">' + esc(label) + "</span>" +
    '<h4 class="tl-title">' + esc(u.title) + "</h4>" +
    '<p class="tl-text">' + esc(u.text) + "</p>" + link + "</div>" +
    "</li>"
  );
}

/** Täzelikleri aý boýunça toparlaýar: "Oktýabr 2026" → şol aýyň täzelikleri */
function monthsHTML(list) {
  const groups = [];
  list.forEach((u) => {
    const key = String(u.date).slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, items: [] };
      groups.push(g);
    }
    g.items.push(u);
  });
  return groups
    .map((g) => {
      const [y, m] = g.key.split("-");
      return '<li class="tl-month"><h3 class="tl-month__h">' + (MONTH_NAMES[+m - 1] || "") + " " + y + "</h3>" +
        '<ol class="tl-list">' + g.items.map(itemHTML).join("") + "</ol></li>";
    })
    .join("");
}

function initUpdates(search) {
  const timeline = $("#timeline");
  const chips = $("#chips");
  const roadmap = $("#roadmap");
  if (!timeline || !chips) return;
  const count = $("#upd-count");
  const jump = $("#jump-upd");

  // iň täze ýokarda (ISO sene setir hökmünde deňeşdirilýär)
  const items = UPDATES.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const types = Object.keys(UPDATE_TYPES).filter((t) => items.some((u) => u.type === t));
  let filter = "all";

  chips.innerHTML = ["all"]
    .concat(types)
    .map(
      (key) =>
        '<button type="button" class="chip" data-filter="' + key + '" aria-pressed="' + (key === "all") + '">' +
        (key === "all" ? "Hemmesi" : esc(UPDATE_TYPES[key])) + "</button>"
    )
    .join("");

  if (jump && items.length) {
    jump.textContent = String(items.length);
    jump.hidden = false;
  }
  if (roadmap) {
    roadmap.innerHTML = ROADMAP.map((name) => "<li>" + esc(name) + "</li>").join("");
    const wrap = $("#roadmap-wrap");
    if (wrap) wrap.hidden = !ROADMAP.length;
  }

  function render(announceResult) {
    const query = search.query;
    const shown = items.filter(
      (u) =>
        (filter === "all" || u.type === filter) &&
        matchesQuery(u.title + " " + u.text + " " + (UPDATE_TYPES[u.type] || ""), query)
    );
    timeline.innerHTML = shown.length ? monthsHTML(shown) : EMPTY;
    if (count) count.textContent = query ? shown.length + " täzelik tapyldy" : shown.length + " täzelik";
    else if (announceResult) announce(shown.length ? shown.length + " täzelik" : "Täzelik tapylmady.");
  }

  chips.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    filter = chip.dataset.filter;
    $$(".chip", chips).forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    render(true);
  });
  search.onChange(() => render(true));

  render(false);
}
return { initUpdates };
})();

__mods["modules/stars.js"] = (function () {
const { formatNumber } = __mods["modules/utils.js"];
/* Ýyldyzlar: bitin (4) ýa-da bölek (4,5) baha üçin bir görnüş. */


function starsHTML(value) {
  const v = Math.min(5, Math.max(0, Number(value) || 0));
  const percent = Math.round((v / 5) * 1000) / 10;
  return (
    '<span class="stars" role="img" aria-label="' + formatNumber(v) + ' / 5" style="--fill:' + percent + '%">' +
    '<span aria-hidden="true">★★★★★</span>' +
    '<span class="stars__fill" aria-hidden="true">★★★★★</span>' +
    "</span>"
  );
}
return { starsHTML };
})();

__mods["modules/storage.js"] = (function () {
/* localStorage bilen howpsuz işlemek: brauzer ýapyk bolsa-da sahypa bozulmaýar. */

/**
 * @param {string} key  saklaýjy açary
 * @param {() => Storage} [getStore]  test üçin: saklaýjyny berýän funksiýa
 */
function createStorage(key, getStore) {
  const store = () => (getStore ? getStore() : window.localStorage);
  return {
    /** Saklanan JSON-y okaýar; ýok ýa-da bozuk bolsa null. */
    read() {
      try {
        const raw = store().getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },
    /** Ýazýar; üstünlikli bolsa true. */
    write(value) {
      try {
        store().setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
  };
}
return { createStorage };
})();

__mods["modules/reviews-store.js"] = (function () {
const { SEED_REVIEWS, STORAGE_KEY } = __mods["modules/data.js"];
const { createStorage } = __mods["modules/storage.js"];
const { charCount, isValidISODate, matchesQuery, todayISO } = __mods["modules/utils.js"];
/* Pikirleriň maglumat gatlagy: saklamak, süzmek, tertiplemek, jemlemek. DOM ýok. */




const LIMITS = { nameMin: 2, nameMax: 40, textMin: 10, textMax: 600 };

/** Bahany 1..5 aralygyndaky bitin sana getirýär. */
function clampRating(value) {
  const n = Math.round(Number(value));
  return Math.min(5, Math.max(1, Number.isFinite(n) ? n : 1));
}

/** Islendik çig pikiri (mysal ýa-da saklanan) bir görnüşe getirýär. */
function normalizeReview(r) {
  const date = isValidISODate(r.date) ? r.date : "";
  return {
    id: String(r.id),
    name: String(r.name || "?"),
    topic: String(r.topic || "Başga"),
    rating: clampRating(r.rating),
    text: String(r.text || ""),
    date,
    ts: Number(r.ts) || (date ? Date.parse(date) : 0),
    helpful: Math.max(0, Math.trunc(Number(r.helpful)) || 0),
    demo: Boolean(r.demo),
  };
}

/* Saklanyş formaty (gysga açarlar) — köne ulanyjylaryň maglumaty bilen deň galmaly. */
const isStored = (o) => Boolean(o) && typeof o === "object" && o.id != null && typeof o.x === "string";
const fromStored = (o) =>
  normalizeReview({ id: o.id, name: o.n, topic: o.t, rating: o.r, text: o.x, date: o.d, ts: o.ts, helpful: o.h });
const toStored = (r) => ({ id: r.id, n: r.name, t: r.topic, r: r.rating, x: r.text, d: r.date, ts: r.ts, h: r.helpful });

/** Ugradylmazdan öň barlag. Nädogry bolsa { field, message }, dogry bolsa null. */
function validateReview(input) {
  if (charCount(String(input.name).trim()) < LIMITS.nameMin) {
    return { field: "name", message: "Adyňyzy ýazyň (iň az 2 harp)." };
  }
  if (!input.rating) {
    return { field: "rating", message: "Bahany saýlaň: 1-den 5-e çenli ýyldyz." };
  }
  if (charCount(String(input.text).trim()) < LIMITS.textMin) {
    return { field: "text", message: "Pikiriňiz iň az 10 harp bolmaly." };
  }
  return null;
}

function filterReviews(list, options) {
  const topic = (options && options.topic) || "";
  const query = (options && options.query) || "";
  return list.filter(
    (r) => (!topic || r.topic === topic) && matchesQuery(r.name + " " + r.topic + " " + r.text, query)
  );
}

/** mode: "new" (iň täze) | "top" (iň ýokary baha) | "help" (iň peýdaly) */
function sortReviews(list, mode, helpfulCount) {
  const compare =
    mode === "top"
      ? (a, b) => b.rating - a.rating || b.ts - a.ts
      : mode === "help"
        ? (a, b) => helpfulCount(b) - helpfulCount(a) || b.ts - a.ts
        : (a, b) => b.ts - a.ts;
  return list.slice().sort(compare);
}

/** Umumy baha: sany, ortaça baha we 1..5 boýunça paýlanyş. */
function summarize(list) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  list.forEach((r) => {
    distribution[r.rating] += 1;
    total += r.rating;
  });
  return { count: list.length, average: list.length ? total / list.length : 0, distribution };
}

/**
 * Pikirleriň ammary: ulanyjynyň ýazan pikirleri + "Peýdaly" sesleri brauzerde saklanýar.
 * @param {{read: Function, write: Function}} [storage] test üçin çalşyp bolýar
 */
function createReviewStore(storage = createStorage(STORAGE_KEY)) {
  let mine = [];
  let voted = [];

  const saved = storage.read();
  if (saved && typeof saved === "object") {
    if (Array.isArray(saved.mine)) mine = saved.mine.filter(isStored);
    if (Array.isArray(saved.voted)) voted = saved.voted.map(String);
  }

  const persist = () => storage.write({ mine, voted });

  return {
    /** Ähli pikirler: öň ulanyjynyňkylar, soň mysallar. */
    all() {
      const examples = SEED_REVIEWS.map((s) => normalizeReview(Object.assign({}, s, { demo: true })));
      return mine.map(fromStored).concat(examples);
    },
    hasVoted(id) {
      return voted.indexOf(String(id)) !== -1;
    },
    helpfulCount(review) {
      return review.helpful + (voted.indexOf(review.id) !== -1 ? 1 : 0);
    },
    /** "Peýdaly" sesini goşýar ýa-da yzyna alýar. Saklanan bolsa true. */
    toggleVote(id) {
      const key = String(id);
      const i = voted.indexOf(key);
      if (i === -1) voted.push(key);
      else voted.splice(i, 1);
      return persist();
    },
    /** Täze pikir goşýar (iň ýokary orna). { review, saved } gaýtarýar. */
    add(input) {
      const record = toStored(
        normalizeReview({
          id: "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: String(input.name).trim(),
          topic: input.topic,
          rating: input.rating,
          text: String(input.text).trim(),
          date: todayISO(),
          ts: Date.now(),
          helpful: 0,
        })
      );
      mine.unshift(record);
      return { review: fromStored(record), saved: persist() };
    },
  };
}
return { LIMITS, clampRating, normalizeReview, validateReview, filterReviews, sortReviews, summarize, createReviewStore };
})();

__mods["modules/reviews.js"] = (function () {
const { $, esc, formatDate, initial } = __mods["modules/utils.js"];
const { TOPICS } = __mods["modules/data.js"];
const { starsHTML } = __mods["modules/stars.js"];
const { announce } = __mods["modules/toast.js"];
const { filterReviews, sortReviews, summarize } = __mods["modules/reviews-store.js"];
/* "Pikirler" sahypasy: umumy baha, pikirleriň sanawy, süzgüç/tertip, "Peýdaly" sesi. */






function initReviews(search, store) {
  const list = $("#reviews-list");
  const count = $("#reviews-count");
  const topicSelect = $("#filter-topic");
  const sortSelect = $("#sort");
  if (!list || !count || !topicSelect || !sortSelect) return null;

  topicSelect.innerHTML =
    '<option value="">Ähli bölümler</option>' + TOPICS.map((t) => "<option>" + esc(t) + "</option>").join("");

  function reviewHTML(r) {
    const meta = esc(r.topic) + (r.date ? ', <time datetime="' + r.date + '">' + formatDate(r.date) + "</time>" : "");
    return (
      '<article class="opinion">' +
      '<div class="opinion__avatar" aria-hidden="true">' + esc(initial(r.name)) + "</div>" +
      '<div class="opinion__body">' +
      '<div class="opinion__head"><strong>' + esc(r.name) + "</strong>" + starsHTML(r.rating) +
      (r.demo ? '<span class="badge-demo">Mysal</span>' : "") + "</div>" +
      '<small class="opinion__meta">' + meta + "</small>" +
      '<p class="opinion__text">' + esc(r.text) + "</p>" +
      '<button type="button" class="btn-helpful" data-id="' + esc(r.id) + '" aria-pressed="' + store.hasVoted(r.id) + '">' +
      "Peýdaly (" + store.helpfulCount(r) + ")</button>" +
      "</div></article>"
    );
  }

  function renderSummary() {
    const s = summarize(store.all());
    $("#avg-value").textContent = s.count ? s.average.toFixed(1).replace(".", ",") : "–";
    $("#avg-stars").innerHTML = starsHTML(s.average);
    $("#avg-count").textContent = s.count + " baha";
    $("#avg-bars").innerHTML = [5, 4, 3, 2, 1]
      .map((k) => {
        const n = s.distribution[k];
        const percent = s.count ? (n / s.count) * 100 : 0;
        return (
          '<div class="rating-bars__row" role="img" aria-label="' + k + " ýyldyz: " + n + '">' +
          '<span aria-hidden="true">' + k + "</span>" +
          '<span class="rating-bars__track" aria-hidden="true"><span class="rating-bars__fill" style="--w:' + percent + '%"></span></span>' +
          '<span aria-hidden="true">' + n + "</span></div>"
        );
      })
      .join("");
  }

  function renderList(announceResult) {
    const shown = sortReviews(
      filterReviews(store.all(), { topic: topicSelect.value, query: search.query }),
      sortSelect.value,
      store.helpfulCount
    );
    count.textContent = shown.length + " pikir";
    list.innerHTML = shown.length
      ? shown.map(reviewHTML).join("")
      : '<p class="empty-note">Pikir tapylmady. Süzgüji üýtgediň ýa-da ilkinji pikiri özüňiz ýazyň.</p>';
    if (announceResult) announce(shown.length ? shown.length + " pikir" : "Pikir tapylmady.");
  }

  topicSelect.addEventListener("change", () => renderList(true));
  sortSelect.addEventListener("change", () => renderList(true));
  search.onChange(() => renderList(true));

  list.addEventListener("click", (e) => {
    const button = e.target.closest(".btn-helpful");
    if (!button) return;
    const id = button.dataset.id;
    store.toggleVote(id);
    const review = store.all().find((r) => r.id === id);
    button.setAttribute("aria-pressed", String(store.hasVoted(id)));
    if (review) button.textContent = "Peýdaly (" + store.helpfulCount(review) + ")";
  });

  renderSummary();
  renderList(false);

  return {
    /** Täze pikir goşulandan soň: süzgüçleri arassalap, umumy bahany täzeläp, täze pikiri görkezýär. */
    showNewest() {
      topicSelect.value = "";
      sortSelect.value = "new";
      search.clear();
      renderSummary();
      renderList(false);
    },
  };
}
return { initReviews };
})();

__mods["modules/review-form.js"] = (function () {
const { $, $$, esc } = __mods["modules/utils.js"];
const { TOPICS } = __mods["modules/data.js"];
const { validateReview } = __mods["modules/reviews-store.js"];
const { toast } = __mods["modules/toast.js"];
/* "Pikiriňizi ýazyň" formasy: ýyldyz saýlaýjy, barlag, ugratmak. */





function initReviewForm(store, onAdded) {
  const form = $("#review-form");
  if (!form) return;

  const fields = { name: $("#f-name"), topic: $("#f-topic"), text: $("#f-text") };
  const radios = $$("input[name='rating']", form);
  const errorBox = $("#form-error");

  fields.topic.innerHTML = TOPICS.map((t) => "<option>" + esc(t) + "</option>").join("");

  const currentRating = () => {
    const checked = radios.find((r) => r.checked);
    return checked ? Number(checked.value) : 0;
  };

  // saýlanan ýyldyzlara çenli hemmesini reňkle
  function paint() {
    const value = currentRating();
    radios.forEach((r) => {
      r.nextElementSibling.classList.toggle("is-on", Number(r.value) <= value);
    });
  }

  function clearError() {
    errorBox.textContent = "";
    [fields.name, fields.text].forEach((el) => el.removeAttribute("aria-invalid"));
  }

  function showError(problem) {
    errorBox.textContent = problem.message;
    if (problem.field === "rating") {
      radios[0].focus();
      return;
    }
    fields[problem.field].setAttribute("aria-invalid", "true");
    fields[problem.field].focus();
  }

  form.addEventListener("change", (e) => {
    if (e.target.name === "rating") paint();
  });
  form.addEventListener("input", clearError);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearError();
    const input = {
      name: fields.name.value,
      topic: fields.topic.value,
      rating: currentRating(),
      text: fields.text.value,
    };
    const problem = validateReview(input);
    if (problem) {
      showError(problem);
      return;
    }
    const result = store.add(input);
    form.reset();
    paint();
    onAdded(result.review);
    toast(result.saved ? "Pikir ugradyldy." : "Pikir ugradyldy, ýöne brauzer ony saklap bilmedi.");
  });

  paint();
}
return { initReviewForm };
})();

__mods["main.js"] = (function () {
const { initNav } = __mods["modules/nav.js"];
const { initTheme } = __mods["modules/theme.js"];
const { initSearch } = __mods["modules/search.js"];
const { initUpdates } = __mods["modules/updates.js"];
const { initReviews } = __mods["modules/reviews.js"];
const { initReviewForm } = __mods["modules/review-form.js"];
const { createReviewStore } = __mods["modules/reviews-store.js"];
/* Giriş nokady: her sahypa üçin gerekli modullary işledýär.
   Sahypany <body data-page="..."> kesgitleýär (build şol atlary faýl atyndan alýar). */








const page = document.body.dataset.page;

initTheme();
initNav();
const search = initSearch();

if (page === "taze") {
  // Köne salgy (taze.html#pikirler) täze sahypa geçirilýär
  if (location.hash === "#pikirler") {
    location.replace("../pikirler/index.html");
  } else {
    initUpdates(search);
  }
}

if (page === "pikirler") {
  const store = createReviewStore();
  const reviews = initReviews(search, store);
  if (reviews) {
    initReviewForm(store, () => reviews.showNewest());
  }
}
return {  };
})();
})();
