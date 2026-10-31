(function () {
"use strict";
// ---- scripts/modules/dom.js ----
// Kiçijik DOM kömekçisi
const $ = (id) => document.getElementById(id);

// ---- scripts/modules/format.js ----
// Sanlary görkezmek: bitewi bolsa — bitewi, bolmasa 2 onluk belgi.
// Awtomatik rejimde türkmen ýazuwy: onluk — otur (1,5), müňler — boşluk (12 500).
let turkmenStyle = false;
function setTurkmenNumbers(on) { turkmenStyle = Boolean(on); }

function styled(s, force) {
  if (!turkmenStyle && !force) return s;
  const [int, frac] = s.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return frac ? grouped + ',' + frac : grouped;
}

function fmt(n) {
  if (Math.abs(n - Math.round(n)) < 1e-9) return styled(String(Math.round(n)));
  return styled(n.toFixed(2));
}

// Gysga görkezme: 1,5 · 15 · 0,25 (artykmaç nol ýok); awtomatik forma üçin hemişe türkmen ýazuwy
function fmtShort(n) {
  return styled(String(Math.round(n * 100) / 100), true);
}

// ---- scripts/modules/labels.js ----
// Setir/sütün atlary we ölçeg birligi.
// El bilen girizilende: S1, S2… we D1, D2…  Awtomatik rejimde: ulag we şäher atlary.
const labelState = { rows: null, cols: null, dummyRow: null, dummyCol: null, unit: 'birlik', currency: '' };

function setLabels(rows, cols, extra = {}) {
  labelState.rows = rows;
  labelState.cols = cols;
  labelState.dummyRow = extra.dummyRow || null;
  labelState.dummyCol = extra.dummyCol || null;
  labelState.unit = extra.unit || 'birlik';
  labelState.currency = extra.currency || '';
}

function resetLabels() {
  setLabels(null, null);
}

function rowLabel(i) {
  const rows = labelState.rows;
  if (rows && i < rows.length) return rows[i];
  if (rows && labelState.dummyRow) return labelState.dummyRow;
  return 'S' + (i + 1);
}

function colLabel(j) {
  const cols = labelState.cols;
  if (cols && j < cols.length) return cols[j];
  if (cols && labelState.dummyCol) return labelState.dummyCol;
  return 'D' + (j + 1);
}

function unitName() {
  return labelState.unit;
}

// Jemi baha sanynyň yzyna goşulýan ölçeg (awtomatik rejimde " ş.b.")
function currencySuffix() {
  return labelState.currency ? ' ' + labelState.currency : '';
}

// ---- scripts/modules/balance.js ----
// Üpjünçilik bilen islegi deňlemek: tapawut üçin 0 bahaly goşmaça (fiktiw) setir ýa-da sütün goşulýar



function balance(costs, supply, demand) {
  const sumS = supply.reduce((a, b) => a + b, 0);
  const sumD = demand.reduce((a, b) => a + b, 0);
  let c = costs.map(r => r.slice()), s = supply.slice(), d = demand.slice();
  let note = null, dummyRow = -1, dummyCol = -1;
  if (sumS > sumD + 1e-9) {
    d.push(sumS - sumD);
    c.forEach(r => r.push(0));
    dummyCol = d.length - 1;
    note = `Üpjünçilik (${fmt(sumS)}) islege (${fmt(sumD)}) deň däl. Tapawut — ${fmt(sumS - sumD)} ${unitName()} — üçin «${colLabel(dummyCol)}» goşmaça sütüni 0 baha bilen goşuldy.`;
  } else if (sumD > sumS + 1e-9) {
    s.push(sumD - sumS);
    c.push(Array(demand.length).fill(0));
    dummyRow = s.length - 1;
    note = `Isleg (${fmt(sumD)}) üpjünçilige (${fmt(sumS)}) deň däl. Tapawut — ${fmt(sumD - sumS)} ${unitName()} — üçin «${rowLabel(dummyRow)}» goşmaça setiri 0 baha bilen goşuldy.`;
  }
  return { costs: c, supply: s, demand: d, note, dummyRow, dummyCol };
}

// ---- scripts/modules/parse-input.js ----
// Tekst görnüşinde girizilen maglumaty okamak (soňky setir — isleg, soňky sütün — üpjünçilik)
function parseRaw(text) {
  const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return { error: "Iň azyndan üpjünçilik setirleri we bir isleg setiri gerek." };
  const rows = [];
  for (const line of lines) {
    const parts = line.split(/[\s,]+/).filter(x => x.length > 0).map(Number);
    if (parts.some(v => Number.isNaN(v))) return { error: "Maglumatda san däl bahalar bar. Sanlary boşluk ýa-da tab bilen aýyryň." };
    rows.push(parts);
  }
  const demand = rows[rows.length - 1];
  const bodyRows = rows.slice(0, -1);
  const D = demand.length;
  for (const r of bodyRows) {
    if (r.length !== D + 1) return { error: `Setirleriň ölçegi gabat gelenok: her üpjünçilik setirinde ${D + 1} san (${D} baha + üpjünçilik) bolmaly, soňky setirde bolsa ${D} san (isleg) bolmaly.` };
  }
  const S = bodyRows.length;
  if (S < 2 || D < 2) return { error: "Iň azyndan 2 çeşme (setir) we 2 barmaly ýer (sütün) gerek." };
  const costs = bodyRows.map(r => r.slice(0, D));
  const supply = bodyRows.map(r => r[D]);
  // Baha (çykdajy) öýjükleri otrisatel we ondalyk san bolup biler (mysal: -12.5).
  // Üpjünçilik we isleg fiziki mukdary aňladýandygy üçin olar 0-dan kiçi bolup bilmez.
  if (supply.some(v => v < 0)) return { error: "Üpjünçilik bahalary otrisatel (minus) bolup bilmez. Diňe baha (çykdajy) öýjükleri otrisatel we onluk san bolup biler." };
  if (demand.some(v => v < 0)) return { error: "Isleg bahalary otrisatel (minus) bolup bilmez. Diňe baha (çykdajy) öýjükleri otrisatel we onluk san bolup biler." };
  if (supply.reduce((a, b) => a + b, 0) <= 0 || demand.reduce((a, b) => a + b, 0) <= 0) return { error: "Üpjünçilik we isleg jemi noldan uly bolmaly." };
  return { S, D, costs, supply, demand };
}

// ---- scripts/modules/table-input.js ----
// El bilen girizmek: tekst meýdany ýa-da tablisa



const tableState = { S: 0, D: 0, active: false, labels: null };

const rl = (i) => (tableState.labels && tableState.labels.rows[i]) || 'S' + (i + 1);
const cl = (j) => (tableState.labels && tableState.labels.cols[j]) || 'D' + (j + 1);

// Tablisany gurmak. prefill = {costs, supply, demand} bolsa — öýjükler öňünden doldurylýar.
function buildTable(S, D, prefill, labels) {
  tableState.S = S;
  tableState.D = D;
  tableState.labels = labels || null;
  let html = "<table class='grid' id='dataTable'><thead><tr><th></th>";
  for (let j = 0; j < D; j++) html += `<th>${cl(j)}</th>`;
  html += "<th>Üpjünçilik</th></tr></thead><tbody>";
  for (let i = 0; i < S; i++) {
    html += `<tr><td class="rowhead">${rl(i)}</td>`;
    for (let j = 0; j < D; j++) {
      const v = prefill ? prefill.costs[i][j] : "";
      html += `<td><input type="number" step="any" id="cost_${i}_${j}" value="${v}"></td>`;
    }
    const sv = prefill ? prefill.supply[i] : "";
    html += `<td><input type="number" min="0" step="any" id="supply_${i}" value="${sv}"></td></tr>`;
  }
  html += `<tr><td class="rowhead">Isleg</td>`;
  for (let j = 0; j < D; j++) {
    const dv = prefill ? prefill.demand[j] : "";
    html += `<td><input type="number" min="0" step="any" id="demand_${j}" value="${dv}"></td>`;
  }
  html += "<td></td></tr></tbody></table>";
  $("tableWrap").innerHTML = html;
}

function readTable() {
  const { S, D } = tableState;
  const costs = [], supply = [], demand = [];
  for (let i = 0; i < S; i++) {
    const row = [];
    for (let j = 0; j < D; j++) {
      const v = parseFloat($(`cost_${i}_${j}`).value);
      if (isNaN(v)) return { error: `${rl(i)}-${cl(j)} öýjüginde dogry baha ýok.` };
      row.push(v);
    }
    costs.push(row);
    const sv = parseFloat($(`supply_${i}`).value);
    if (isNaN(sv) || sv < 0) return { error: `${rl(i)} üpjünçiligi nädogry.` };
    supply.push(sv);
  }
  for (let j = 0; j < D; j++) {
    const dv = parseFloat($(`demand_${j}`).value);
    if (isNaN(dv) || dv < 0) return { error: `${cl(j)} islegi nädogry.` };
    demand.push(dv);
  }
  if (supply.reduce((a, b) => a + b, 0) <= 0 || demand.reduce((a, b) => a + b, 0) <= 0) return { error: "Üpjünçilik we isleg jemi noldan uly bolmaly." };
  return { S, D, costs, supply, demand, labels: tableState.labels };
}

function readManualInput() {
  return tableState.active ? readTable() : parseRaw($("rawData").value);
}

// Tablisa görnüşini görkezmek (täze boş tablisa ýa-da awtomatik bahalardan doldurylan tablisa)
function showTable(S, D, prefill, labels) {
  buildTable(S, D, prefill, labels);
  tableState.active = true;
  $("textInputSection").hidden = true;
  $("tableInputSection").hidden = false;
  $("errorBox").hidden = true;
  $("resultsSection").hidden = true;
}

function initTableInput() {
  $("genBtn").addEventListener("click", () => {
    const S = Math.min(9, Math.max(2, parseInt($("sCount").value) || 2));
    const D = Math.min(9, Math.max(2, parseInt($("dCount").value) || 2));
    $("sCount").value = S;
    $("dCount").value = D;
    showTable(S, D, null, null);
  });

  $("backToText").addEventListener("click", (e) => {
    e.preventDefault();
    tableState.active = false;
    tableState.labels = null;
    $("tableInputSection").hidden = true;
    $("textInputSection").hidden = false;
  });
}

// ---- scripts/modules/mode-switch.js ----
// Girizme usulyny çalyşmak: awtomatik baha ←→ bahalary el bilen girizmek


let currentMode = 'auto';

function getMode() {
  return currentMode;
}

function setMode(mode) {
  currentMode = mode;
  const auto = mode === 'auto';
  $("autoPanel").hidden = !auto;
  $("manualPanel").hidden = auto;
  $("tabAuto").setAttribute('aria-selected', String(auto));
  $("tabManual").setAttribute('aria-selected', String(!auto));
  $("tabAuto").tabIndex = auto ? 0 : -1;
  $("tabManual").tabIndex = auto ? -1 : 0;
  $("errorBox").hidden = true;
  $("resultsSection").hidden = true;
  $("balanceNote").innerHTML = "";
}

function initModeSwitch() {
  $("tabAuto").addEventListener('click', () => setMode('auto'));
  $("tabManual").addEventListener('click', () => setMode('manual'));
  document.querySelector('.mode-switch').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const next = e.key === 'ArrowLeft' || e.key === 'Home' ? 'auto' : 'manual';
    setMode(next);
    $(next === 'auto' ? 'tabAuto' : 'tabManual').focus();
  });
  setMode('auto');
}

// ---- scripts/modules/cities.js ----
// Şäherleriň takmynan koordinatalary (graduslarda). Aralyk şulardan math.js bilen hasaplanýar.
// Täze şäher goşmak üçin diňe bir setir goşuň.
const CITIES = [
  { id: 'ashgabat', name: 'Aşgabat', region: 'Aşgabat şäheri', lat: 37.9601, lon: 58.3261 },
  { id: 'gokdepe', name: 'Gökdepe', region: 'Ahal welaýaty', lat: 38.1667, lon: 57.9167 },
  { id: 'baherden', name: 'Bäherden', region: 'Ahal welaýaty', lat: 38.4333, lon: 57.4333 },
  { id: 'serdar', name: 'Serdar', region: 'Balkan welaýaty', lat: 38.9833, lon: 56.2833 },
  { id: 'balkanabat', name: 'Balkanabat', region: 'Balkan welaýaty', lat: 39.5108, lon: 54.3671 },
  { id: 'turkmenbashy', name: 'Türkmenbaşy', region: 'Balkan welaýaty', lat: 40.0233, lon: 52.9692 },
  { id: 'tejen', name: 'Tejen', region: 'Ahal welaýaty', lat: 37.38, lon: 60.5 },
  { id: 'mary', name: 'Mary', region: 'Mary welaýaty', lat: 37.5938, lon: 61.83 },
  { id: 'bayramaly', name: 'Baýramaly', region: 'Mary welaýaty', lat: 37.6167, lon: 62.1667 },
  { id: 'yoloten', name: 'Ýolöten', region: 'Mary welaýaty', lat: 37.3, lon: 62.3 },
  { id: 'turkmenabat', name: 'Türkmenabat', region: 'Lebap welaýaty', lat: 39.0733, lon: 63.5786 },
  { id: 'atamyrat', name: 'Atamyrat', region: 'Lebap welaýaty', lat: 37.8333, lon: 65.2 },
  { id: 'dashoguz', name: 'Daşoguz', region: 'Daşoguz welaýaty', lat: 41.8363, lon: 59.9666 },
  { id: 'koneurgench', name: 'Köneürgenç', region: 'Daşoguz welaýaty', lat: 42.3167, lon: 59.15 },
];

const DEFAULT_ORIGIN = 'ashgabat';

// Tablisa 9 sütüne çenli (başdaky sahypalaryň çägi bilen deň)
const MAX_DESTINATIONS = 9;

function cityById(id) {
  return CITIES.find((c) => c.id === id);
}

// ---- scripts/modules/vehicles.js ----
// ULAG, ÝANGYÇ WE ÝÜK TARIFLERI — baha hasaplamak üçin ähli sanlar şu ýerde.
// Bu sanlar ÇAKLAMA (başlangyç) bahalar; hakyky tarifleriňize görä bir gezek üýtgediň,
// soňra saýtyň ulanyjylary bahalary ýazmaly bolmaz.
// Baha birligi: ş.b. (şertli baha birligi).

// Ýangyjyň 1 litriniň bahasy (ş.b.)
const FUEL_PRICES = { petrol: 1.0, diesel: 1.2, jet: 1.6 };
const FUEL_LABELS = { petrol: 'Benzin', diesel: 'Dizel', jet: 'Awiasiýa ýangyjy' };

// Ýol egrilik koeffisiýenti: göni aralygy hakyky ýol/demir ýol/howa ýoluna öwürýär
const ROUTE_FACTORS = { road: 1.25, rail: 1.2, air: 1.04 };

// capacity — bir ulagyň göterijiligi (t); fuelPer100 — 100 km üçin ýangyç (litr);
// wearPerKm — könelme we abatlama (ş.b./km); speed — ortaça tizlik (km/sag);
// crewPerHour — ekipažyň zähmet haky (ş.b./sag); fixedPerTrip — bir gezekde sabit çykdajy
// (ýükleme, resminama, terminal) (ş.b.); loadFactor — ortaça doldurma derejesi.
const VEHICLES = [
  { id: 'gazel', name: 'Gazel (kiçi ýük maşyny)', short: 'Gazel', kind: 'road', fuel: 'petrol',
    capacity: 1.5, fuelPer100: 13, wearPerKm: 0.12, speed: 60, crewPerHour: 4, fixedPerTrip: 12, loadFactor: 0.9,
    defaultOn: true, defaultCount: 10 },
  { id: 'medium', name: 'Orta ýük maşyny (5 t)', short: 'Orta maşyn', kind: 'road', fuel: 'diesel',
    capacity: 5, fuelPer100: 22, wearPerKm: 0.22, speed: 58, crewPerHour: 5, fixedPerTrip: 18, loadFactor: 0.9,
    defaultOn: false, defaultCount: 6 },
  { id: 'kamaz', name: 'Kamaz (uly ýük maşyny)', short: 'Kamaz', kind: 'road', fuel: 'diesel',
    capacity: 10, fuelPer100: 32, wearPerKm: 0.35, speed: 55, crewPerHour: 6, fixedPerTrip: 25, loadFactor: 0.9,
    defaultOn: true, defaultCount: 4 },
  { id: 'fura', name: 'Fura (tirkegli uly ýük maşyny)', short: 'Fura', kind: 'road', fuel: 'diesel',
    capacity: 20, fuelPer100: 36, wearPerKm: 0.5, speed: 55, crewPerHour: 7, fixedPerTrip: 40, loadFactor: 0.9,
    defaultOn: true, defaultCount: 2 },
  { id: 'wagon', name: 'Ýük wagony (demir ýol)', short: 'Wagon', kind: 'rail', fuel: 'diesel',
    capacity: 60, fuelPer100: 20, wearPerKm: 0.25, speed: 45, crewPerHour: 2, fixedPerTrip: 900, loadFactor: 0.85,
    defaultOn: false, defaultCount: 1 },
  { id: 'plane', name: 'Ýük uçary (howa)', short: 'Uçar', kind: 'air', fuel: 'jet',
    capacity: 20, fuelPer100: 600, wearPerKm: 8, speed: 700, crewPerHour: 60, fixedPerTrip: 3000, loadFactor: 0.8,
    defaultOn: false, defaultCount: 1 },
];

// Ýük görnüşi baha koeffisiýentini üýtgedýär (1.0 = adaty ýük)
const CARGO_TYPES = [
  { id: 'general', name: 'Adaty ýük (haryt, gutular)', factor: 1.0, hint: 'Adaty tarif.' },
  { id: 'bulk', name: 'Sypylýan ýük (bugdaý, un, sement)', factor: 0.9, hint: 'Ýüklemek aňsat, tarif birneme arzan.' },
  { id: 'fragile', name: 'Döwülýän ýük (aýna, tehnika)', factor: 1.25, hint: 'Seresaplylyk we ýörite gaplama gerek.' },
  { id: 'perishable', name: 'Çalt zaýalanýan ýük (miwe, et, süýt)', factor: 1.4, hint: 'Sowadyjy enjam we çalt eltmek talap edilýär.' },
  { id: 'heavy', name: 'Agyr ýa-da uly ölçegli ýük (enjam, metal)', factor: 1.35, hint: 'Ýörite ýükleme we goşmaça rugsat gerek.' },
  { id: 'hazard', name: 'Howply ýük (ýangyç, himiki maddalar)', factor: 1.7, hint: 'Ýörite rugsat we howpsuzlyk talaplary.' },
];

function vehicleById(id) {
  return VEHICLES.find((v) => v.id === id);
}

function cargoById(id) {
  return CARGO_TYPES.find((c) => c.id === id);
}

// ---- scripts/modules/cost-model.js ----
// BAHA MODELI: aralygy we 1 tonna ýüküň bahasyny math.js bilen hasaplaýar.
// Formulalar — math.js aňlatmalary (setir görnüşinde); math.compile() olary bir gezek taýýarlaýar.



// Iki nokadyň arasyndaky göni aralyk (km) — Haversine formulasy. Burçlar graduslarda berilýär.
const DISTANCE_FORMULA =
  "2 * R * asin(sqrt(sin((lat2 - lat1) * pi / 360) ^ 2 + cos(lat1 * pi / 180) * cos(lat2 * pi / 180) * sin((lon2 - lon1) * pi / 360) ^ 2))";

// Bir gezeklik ýol çykdajysynyň bölekleri (ş.b.)
const COST_PART_FORMULAS = {
  fuel: "km * fuelPer100 / 100 * fuelPrice",
  wear: "km * wearPerKm",
  crew: "km / speed * crewPerHour",
  fixed: "fixedPerTrip",
};

// 1 tonna ýüküň bahasy
const COST_FORMULA = "(fuel + wear + crew + fixed) * cargoFactor / (capacity * loadFactor)";

function getMath() {
  const m = globalThis.math;
  if (!m) throw new Error("math.js ýüklenmedi. assets/vendor/math.js faýlynyň ýerindedigini barlaň.");
  return m;
}

let formulaCache = null;
function formulas() {
  if (!formulaCache) {
    const m = getMath();
    formulaCache = {
      distance: m.compile(DISTANCE_FORMULA),
      parts: Object.fromEntries(Object.entries(COST_PART_FORMULAS).map(([k, f]) => [k, m.compile(f)])),
      cost: m.compile(COST_FORMULA),
    };
  }
  return formulaCache;
}

// Ýol görnüşine (road/rail/air) görä hakyky aralyk (km)
function distanceKm(from, to, kind) {
  const straight = formulas().distance.evaluate({
    R: 6371, lat1: from.lat, lon1: from.lon, lat2: to.lat, lon2: to.lon,
  });
  return straight * ROUTE_FACTORS[kind];
}

// Bir ulag + bir aralyk üçin bahanyň bölekleri we 1 tonna üçin baha
function costBreakdown(vehicle, km, cargoFactor, fuelPrice, legs = 1) {
  const f = formulas();
  const scope = {
    km: km * legs, fuelPer100: vehicle.fuelPer100, fuelPrice, wearPerKm: vehicle.wearPerKm,
    speed: vehicle.speed, crewPerHour: vehicle.crewPerHour, fixedPerTrip: vehicle.fixedPerTrip,
  };
  const parts = {};
  for (const key of Object.keys(f.parts)) parts[key] = f.parts[key].evaluate(scope);
  const perTonne = f.cost.evaluate({
    ...parts, cargoFactor, capacity: vehicle.capacity, loadFactor: vehicle.loadFactor,
  });
  const trip = getMath().sum([parts.fuel, parts.wear, parts.crew, parts.fixed]);
  return { km, legs, ...parts, trip, cargoFactor, perTonne: getMath().round(perTonne, 2) };
}

// Esasy funksiýa: saýlananlardan baha matrisasyny, üpjünçiligi we islegi gurýar.
//   vehicles     — [{id, name, short, kind, fuel, capacity, ..., count}]
//   destinations — [{id, tons}]
function buildCostMatrix({ vehicles, originId, destinations, cargoId, fuelPrices = FUEL_PRICES, roundTrip = false }) {
  const m = getMath();
  const origin = cityById(originId);
  const cargo = cargoById(cargoId);
  const dests = destinations.map((d) => ({ ...d, city: cityById(d.id) }));

  const details = vehicles.map((v) =>
    dests.map((d) => costBreakdown(v, distanceKm(origin, d.city, v.kind), cargo.factor, fuelPrices[v.fuel], roundTrip ? 2 : 1)));

  const kinds = [...new Set(vehicles.map((v) => v.kind))];
  const distances = {};
  for (const kind of kinds) distances[kind] = dests.map((d) => m.round(distanceKm(origin, d.city, kind), 0));

  return {
    origin,
    cargo,
    roundTrip,
    vehicles,
    destinations: dests,
    rowNames: vehicles.map((v) => v.short),
    colNames: dests.map((d) => d.city.name),
    costs: details.map((row) => row.map((c) => c.perTonne)),
    supply: vehicles.map((v) => m.round(v.count * (v.trips || 1) * v.capacity, 2)),
    demand: dests.map((d) => d.tons),
    details,
    distances,
  };
}

// ---- scripts/modules/tariff-editor.js ----
// "Tarifler (hökmany däl)" bölümi: ulaglaryň we ýangyjyň çaklama sanlaryny üýtgetmek üçin.
// Ulanyjy hiç zat üýtgetmese, vehicles.js-daky başlangyç sanlar ulanylýar.



const TARIFF_FIELDS = [
  { key: 'capacity', label: 'Göterijilik, t', positive: true },
  { key: 'fuelPer100', label: 'Ýangyç, l/100 km', positive: false },
  { key: 'wearPerKm', label: 'Könelme we abatlama, ş.b./km', positive: false },
  { key: 'speed', label: 'Tizlik, km/sag', positive: true },
  { key: 'crewPerHour', label: 'Ekipažyň haky, ş.b./sag', positive: false },
  { key: 'fixedPerTrip', label: 'Sabit çykdajy, ş.b./gezek', positive: false },
];

function renderTariffEditor(onChange) {
  let html = '<label class="tariff-return"><input type="checkbox" id="returnLeg"> Yzyna boş gaýdyşy hasaba alyň (ýangyç, könelme we ekipaž çykdajylary 2 esse)</label><div class="tariff-fuel">';
  for (const key of Object.keys(FUEL_LABELS)) {
    html += `<label>${FUEL_LABELS[key]}, ş.b./litr <input type="number" min="0" step="any" data-fuel="${key}" value="${FUEL_PRICES[key]}"></label>`;
  }
  html += '</div><div class="table-scroll"><table class="grid"><thead><tr><th>Ulag</th>';
  html += TARIFF_FIELDS.map((f) => `<th>${f.label}</th>`).join('');
  html += '</tr></thead><tbody>';
  for (const v of VEHICLES) {
    html += `<tr><td class="rowhead">${v.short}</td>`;
    html += TARIFF_FIELDS.map((f) =>
      `<td><input type="number" min="0" step="any" data-vehicle="${v.id}" data-field="${f.key}" aria-label="${v.short}: ${f.label}" value="${v[f.key]}"></td>`).join('');
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  html += '<div class="tariff-actions"><button type="button" class="classic-btn" id="tariffReset">Başlangyç sanlara gaýtaryň</button></div>';

  const box = $("tariffEditor");
  box.innerHTML = html;
  box.addEventListener('input', onChange);
  $("tariffReset").addEventListener('click', () => { resetTariffs(); onChange(); });
}

function resetTariffs() {
  const rt = $("returnLeg");
  if (rt) rt.checked = false;
  for (const el of $("tariffEditor").querySelectorAll('input[data-fuel]')) el.value = FUEL_PRICES[el.dataset.fuel];
  for (const el of $("tariffEditor").querySelectorAll('input[data-vehicle]')) {
    el.value = VEHICLES.find((v) => v.id === el.dataset.vehicle)[el.dataset.field];
  }
}

// strict=true: nädogry san bolsa {error} gaýtarýar; strict=false: başlangyç sana gaýdýar (diňe görkezmek üçin)
function readTariffs(strict) {
  const fuelPrices = { ...FUEL_PRICES };
  const vehicles = {};
  for (const v of VEHICLES) vehicles[v.id] = {};

  for (const el of $("tariffEditor").querySelectorAll('input[data-fuel]')) {
    const n = parseFloat(el.value);
    if (!(n >= 0)) {
      if (strict) return { error: `Tarifler: «${FUEL_LABELS[el.dataset.fuel]}» bahasy nädogry (otrisatel bolup bilmez).` };
      continue;
    }
    fuelPrices[el.dataset.fuel] = n;
  }
  for (const el of $("tariffEditor").querySelectorAll('input[data-vehicle]')) {
    const field = TARIFF_FIELDS.find((f) => f.key === el.dataset.field);
    const v = VEHICLES.find((x) => x.id === el.dataset.vehicle);
    const n = parseFloat(el.value);
    const ok = field.positive ? n > 0 : n >= 0;
    if (!ok) {
      if (strict) return { error: `Tarifler: ${v.short} — «${field.label}» ${field.positive ? 'noldan uly' : 'otrisatel däl'} san bolmaly.` };
      continue;
    }
    vehicles[v.id][field.key] = n;
  }
  const rt = $("returnLeg");
  return { fuelPrices, vehicles, roundTrip: Boolean(rt && rt.checked), error: null };
}

// ---- scripts/modules/auto-form.js ----
// AWTOMATIK BAHA formasy: ulaglary, ýerleri we ýük görnüşini saýlamak.
// Ulanyjy baha ýazmaly däl — cost-model.js bahalary math.js bilen hasaplaýar.







const DEFAULT_DESTINATIONS = [['mary', 20], ['dashoguz', 25], ['turkmenabat', 30], ['balkanabat', 20]];
const NEW_DESTINATION_TONS = 10;
const TONS_STEP = 5;

const autoState = {
  vehicles: new Map(VEHICLES.map((v) => [v.id, { on: v.defaultOn, count: v.defaultCount, trips: 1 }])),
  origin: DEFAULT_ORIGIN,
  dests: new Map(DEFAULT_DESTINATIONS), // saýlanyş tertibi saklanýar
  cargo: 'general',
};

// Tarifleriň üýtgedilen sanlary bilen birleşdirilen ulag (diňe görkezmek we deňagramlylyk üçin)
function liveVehicle(v) {
  const t = readTariffs(false);
  return { ...v, ...t.vehicles[v.id] };
}

function vehicleCapacityText(v) {
  const st = autoState.vehicles.get(v.id);
  const cap = liveVehicle(v).capacity;
  const total = Math.round(cap * st.count * st.trips * 100) / 100;
  return `1 ulag: ${fmtShort(cap)} t · gatnaw: ${st.trips} · jemi: ${fmtShort(total)} t`;
}

/* ---------- ulaglar ---------- */
function renderVehicles() {
  $("vehicleList").innerHTML = VEHICLES.map((v) => {
    const st = autoState.vehicles.get(v.id);
    return `<div class="vehicle-row${st.on ? ' is-on' : ''}" data-id="${v.id}">
      <label class="vehicle-pick">
        <input type="checkbox" class="v-check"${st.on ? ' checked' : ''}>
        <span class="v-text"><span class="v-name">${v.name}</span><span class="v-cap">${vehicleCapacityText(v)}</span></span>
      </label>
      <div class="v-controls"><div class="stepper">
        <button type="button" class="step-btn" data-act="dec" aria-label="${v.short}: azalt">−</button>
        <input type="number" class="v-count" min="1" step="1" value="${st.count}" aria-label="${v.short}: ulag sany">
        <button type="button" class="step-btn" data-act="inc" aria-label="${v.short}: köpeldiň">+</button>
      </div>
      <label class="v-trips" title="Her ulagyň näçe gezek gatnajakdygy">Gatnaw <input type="number" class="v-trip" min="1" step="1" value="${st.trips}" aria-label="${v.short}: gatnaw sany"></label></div>
    </div>`;
  }).join('');
}

function refreshVehicleRow(id) {
  const row = $("vehicleList").querySelector(`.vehicle-row[data-id="${id}"]`);
  const v = VEHICLES.find((x) => x.id === id);
  const st = autoState.vehicles.get(id);
  row.classList.toggle('is-on', st.on);
  row.querySelector('.v-cap').textContent = vehicleCapacityText(v);
}

function refreshAllVehicleTexts() {
  for (const v of VEHICLES) refreshVehicleRow(v.id);
}

function onVehicleEvent(e) {
  const row = e.target.closest('.vehicle-row');
  if (!row) return;
  const id = row.dataset.id;
  const st = autoState.vehicles.get(id);
  const input = row.querySelector('.v-count');

  if (e.type === 'change' && e.target.classList.contains('v-check')) {
    st.on = e.target.checked;
  } else if (e.type === 'click' && e.target.classList.contains('step-btn')) {
    const next = st.count + (e.target.dataset.act === 'inc' ? 1 : -1);
    st.count = Math.max(1, next);
    input.value = st.count;
  } else if (e.type === 'input' && e.target.classList.contains('v-count')) {
    const n = parseInt(e.target.value, 10);
    st.count = Number.isFinite(n) ? n : 0;
  } else if (e.type === 'change' && e.target.classList.contains('v-count')) {
    st.count = Math.max(1, parseInt(e.target.value, 10) || 1);
    input.value = st.count;
  } else if (e.target.classList.contains('v-trip') && (e.type === 'input' || e.type === 'change')) {
    const n = parseInt(e.target.value, 10);
    st.trips = e.type === 'change' ? Math.max(1, n || 1) : (Number.isFinite(n) ? n : 0);
    if (e.type === 'change') e.target.value = st.trips;
  } else {
    return;
  }
  refreshVehicleRow(id);
  updateBalance();
}

/* ---------- ýükleniş ýeri ---------- */
function renderOrigin() {
  $("originSelect").innerHTML = CITIES.map((c) =>
    `<option value="${c.id}"${c.id === autoState.origin ? ' selected' : ''}>${c.name}</option>`).join('');
}

/* ---------- barmaly ýerler ---------- */
function chipHtml(c) {
  const on = autoState.dests.has(c.id);
  const isOrigin = c.id === autoState.origin;
  return `<button type="button" class="chip" data-id="${c.id}" aria-pressed="${on}"${isOrigin ? ' disabled' : ''}>${c.name}</button>`;
}

function renderChips() {
  const groups = new Map();
  for (const c of CITIES) {
    if (!groups.has(c.region)) groups.set(c.region, []);
    groups.get(c.region).push(c);
  }
  $("destChips").innerHTML = [...groups].map(([region, list]) =>
    `<div class="chip-group" role="group" aria-label="${region}"><span class="chip-group-title">${region}</span><div class="chip-row">${list.map(chipHtml).join('')}</div></div>`).join('');
}

function roadKmText(cityId) {
  try {
    const km = Math.round(distanceKm(cityById(autoState.origin), cityById(cityId), 'road'));
    return `≈ ${km} km (ýol)`;
  } catch (e) {
    return '';
  }
}

function renderDestList() {
  if (autoState.dests.size === 0) {
    $("destList").innerHTML = '<p class="dest-empty">Ýokardaky sanawdan barmaly ýerleri saýlaň.</p>';
    return;
  }
  $("destList").innerHTML = [...autoState.dests].map(([id, tons]) => {
    const name = cityById(id).name;
    return `<div class="dest-row" data-id="${id}">
      <span class="d-text"><span class="d-name">${name}</span><span class="d-km">${roadKmText(id)}</span></span>
      <div class="stepper">
        <button type="button" class="step-btn" data-act="dec" aria-label="${name}: azalt">−</button>
        <input type="number" class="d-tons" min="1" step="any" value="${tons}" aria-label="${name}: ýük mukdary (t)">
        <button type="button" class="step-btn" data-act="inc" aria-label="${name}: köpeldiň">+</button>
      </div>
      <span class="d-unit">t</span>
    </div>`;
  }).join('');
}

function refreshDestKm() {
  for (const row of $("destList").querySelectorAll('.dest-row')) {
    row.querySelector('.d-km').textContent = roadKmText(row.dataset.id);
  }
}

function onChipClick(e) {
  const chip = e.target.closest('.chip');
  if (!chip || chip.disabled) return;
  const id = chip.dataset.id;
  if (autoState.dests.has(id)) {
    autoState.dests.delete(id);
  } else {
    if (autoState.dests.size >= MAX_DESTINATIONS) {
      $("destHint").textContent = `Iň köp ${MAX_DESTINATIONS} ýer saýlap bolýar.`;
      return;
    }
    autoState.dests.set(id, NEW_DESTINATION_TONS);
  }
  $("destHint").textContent = 'Barmaly ýerleri saýlaň we her ýere näçe tonna ýük gerekdigini görkeziň.';
  renderChips();
  renderDestList();
  updateBalance();
}

function onDestEvent(e) {
  const row = e.target.closest('.dest-row');
  if (!row) return;
  const id = row.dataset.id;
  const input = row.querySelector('.d-tons');
  if (e.type === 'click' && e.target.classList.contains('step-btn')) {
    const cur = parseFloat(input.value) || 0;
    const next = e.target.dataset.act === 'inc' ? cur + TONS_STEP : Math.max(1, cur - TONS_STEP);
    input.value = next;
    autoState.dests.set(id, next);
  } else if (e.type === 'input' && e.target.classList.contains('d-tons')) {
    const n = parseFloat(e.target.value);
    autoState.dests.set(id, Number.isFinite(n) ? n : 0);
  } else {
    return;
  }
  updateBalance();
}

/* ---------- ýük görnüşi ---------- */
function renderCargo() {
  $("cargoSelect").innerHTML = CARGO_TYPES.map((c) =>
    `<option value="${c.id}"${c.id === autoState.cargo ? ' selected' : ''}>${c.name}</option>`).join('');
  refreshCargoHint();
}

function refreshCargoHint() {
  const c = cargoById(autoState.cargo);
  $("cargoHint").textContent = `${c.hint} Baha koeffisiýenti: × ${fmtShort(c.factor)}.`;
}

/* ---------- deňagramlylyk habary ---------- */
function updateBalance() {
  let supply = 0;
  for (const v of VEHICLES) {
    const st = autoState.vehicles.get(v.id);
    if (st.on) supply += liveVehicle(v).capacity * st.count * st.trips;
  }
  let demand = 0;
  for (const tons of autoState.dests.values()) demand += tons;
  supply = Math.round(supply * 100) / 100;
  demand = Math.round(demand * 100) / 100;

  const box = $("autoBalance");
  box.classList.remove('is-ok', 'is-short', 'is-extra');
  const pct = demand > 0 ? Math.min(100, Math.round(supply / demand * 100)) : 0;
  $("autoMeter").style.width = pct + '%';
  const head = `Göterijilik ${fmtShort(supply)} t, ýük ${fmtShort(demand)} t (üpjünçilik derejesi: ${fmtShort(pct)}\u00a0%). `;
  if (Math.abs(supply - demand) < 1e-9) {
    box.textContent = `Deňagramly: ulaglaryň göterijiligi ýüke deň (${fmtShort(supply)} t).`;
    box.classList.add('is-ok');
  } else if (supply > demand) {
    box.textContent = head + `Ulag artykmaç: ${fmtShort(supply - demand)} t «Ulanylmaýan göterijilik» hökmünde hasaba alynýar.`;
    box.classList.add('is-extra');
  } else {
    box.textContent = head + `Ulag ýeterlik däl: ${fmtShort(demand - supply)} t ýük üçin ulag ýetmeýär («Ulag ýetmezçiligi» hökmünde hasaba alynýar).`;
    box.classList.add('is-short');
  }
}

// Başlangyç mysala dolanmak
function resetAutoForm() {
  autoState.vehicles = new Map(VEHICLES.map((v) => [v.id, { on: v.defaultOn, count: v.defaultCount, trips: 1 }]));
  autoState.origin = DEFAULT_ORIGIN;
  autoState.dests = new Map(DEFAULT_DESTINATIONS);
  autoState.cargo = 'general';
  resetTariffs();
  renderVehicles();
  renderOrigin();
  renderChips();
  renderDestList();
  renderCargo();
  updateBalance();
}

/* ---------- esasy ---------- */
function initAutoForm() {
  renderVehicles();
  renderOrigin();
  renderChips();
  renderDestList();
  renderCargo();
  renderTariffEditor(() => { refreshAllVehicleTexts(); refreshDestKm(); updateBalance(); });
  updateBalance();

  const vl = $("vehicleList");
  vl.addEventListener('change', onVehicleEvent);
  vl.addEventListener('click', onVehicleEvent);
  vl.addEventListener('input', onVehicleEvent);

  $("originSelect").addEventListener('change', (e) => {
    autoState.origin = e.target.value;
    autoState.dests.delete(autoState.origin);
    renderChips();
    renderDestList();
    updateBalance();
  });

  $("destChips").addEventListener('click', onChipClick);
  $("destList").addEventListener('click', onDestEvent);
  $("destList").addEventListener('input', onDestEvent);

  $("autoReset").addEventListener('click', resetAutoForm);

  $("cargoSelect").addEventListener('change', (e) => {
    autoState.cargo = e.target.value;
    refreshCargoHint();
  });
}

// "Çözüň" basylanda: saýlananlary barlap, baha matrisasyny gurýar
function readAutoInput() {
  const tariffs = readTariffs(true);
  if (tariffs.error) return { error: tariffs.error };

  const vehicles = VEHICLES
    .filter((v) => autoState.vehicles.get(v.id).on)
    .map((v) => ({ ...v, ...tariffs.vehicles[v.id], count: autoState.vehicles.get(v.id).count, trips: autoState.vehicles.get(v.id).trips }));
  if (vehicles.length < 1) return { error: "Iň azyndan 1 ulag görnüşini saýlaň." };
  for (const v of vehicles) {
    if (!(v.count >= 1)) return { error: `${v.short}: ulag sany 1-den az bolup bilmez.` };
    if (!(v.trips >= 1)) return { error: `${v.short}: gatnaw sany 1-den az bolup bilmez.` };
  }

  const destinations = [...autoState.dests].map(([id, tons]) => ({ id, tons }));
  if (destinations.length < 2) return { error: "Iň azyndan 2 barmaly ýer saýlaň." };
  for (const d of destinations) {
    if (!(d.tons > 0)) return { error: `${cityById(d.id).name}: ýük mukdary (t) noldan uly bolmaly.` };
  }

  const model = buildCostMatrix({
    vehicles, originId: autoState.origin, destinations, cargoId: autoState.cargo, fuelPrices: tariffs.fuelPrices, roundTrip: tariffs.roundTrip,
  });
  return {
    S: vehicles.length, D: destinations.length,
    costs: model.costs, supply: model.supply, demand: model.demand,
    labels: { rows: model.rowNames, cols: model.colNames },
    model,
  };
}

// ---- scripts/modules/auto-summary.js ----
// Awtomatik hasaplanan bahalary netijäniň başynda görkezmek + "bu bahalar nädip hasaplandy?"






const KIND_LABELS = { road: 'Ýol', rail: 'Demir ýol', air: 'Howa' };
let lastModel = null;

function hideAutoSummary() {
  $("autoSummary").hidden = true;
  lastModel = null;
}

function costTableHtml(model) {
  // Diňe 1 ulag saýlanan bolsa, "iň arzan ulag" diýip bellemegiň manysy ýok
  const compare = model.costs.length > 1;
  const mins = model.colNames.map((_, j) => Math.min(...model.costs.map((row) => row[j])));
  let html = "<table class='grid'><thead><tr><th>ş.b. / t</th>";
  html += model.colNames.map((n) => `<th>${n}</th>`).join('');
  html += "</tr></thead><tbody>";
  model.costs.forEach((row, i) => {
    html += `<tr><td class="rowhead">${model.rowNames[i]}</td>`;
    html += row.map((c, j) => `<td${compare && c === mins[j] ? ' class="cell-alloc"' : ''}>${fmt(c)}</td>`).join('');
    html += '</tr>';
  });
  return html + "</tbody></table>";
}

function distanceTableHtml(model) {
  let html = "<table class='grid'><thead><tr><th>Aralyk, km</th>";
  html += model.colNames.map((n) => `<th>${n}</th>`).join('');
  html += "</tr></thead><tbody>";
  for (const kind of Object.keys(model.distances)) {
    html += `<tr><td class="rowhead">${KIND_LABELS[kind]}</td>`;
    html += model.distances[kind].map((km) => `<td>${fmt(km)}</td>`).join('');
    html += '</tr>';
  }
  return html + "</tbody></table>";
}

function exampleHtml(model) {
  const v = model.vehicles[0];
  const c = model.details[0][0];
  const city = model.colNames[0];
  return `<b>Mysal: ${v.short} → ${city}</b><br>` +
    `aralyk ${fmt(c.km)} km${c.legs > 1 ? ' × 2 (yzyna boş gaýdyş bilen)' : ''}; ýangyç ${fmt(c.fuel)} + könelme we abatlama ${fmt(c.wear)} + ekipaž ${fmt(c.crew)} + sabit ${fmt(c.fixed)} = ${fmt(c.trip)} (bir gezek)<br>` +
    `${fmt(c.trip)} × ${fmtShort(c.cargoFactor)} ÷ (${fmt(v.capacity)} × ${fmtShort(v.loadFactor)}) = <b>${fmt(c.perTonne)}</b> ş.b. / t`;
}

function renderAutoSummary(model) {
  lastModel = model;
  $("autoSummaryText").textContent =
    `1 tonna ýüküň bahasy, ş.b. (şertli birlik) bilen. Ýüklenýän ýer: ${model.origin.name}. Ýük görnüşi: ${model.cargo.name}.${model.roundTrip ? ' Yzyna boş gaýdyş hasaba alyndy.' : ''}`;
  $("autoCostTable").innerHTML = costTableHtml(model) +
    (model.costs.length > 1 ? '<p class="calc-note">Ýaşyl öýjük — şol ýer üçin iň arzan ulagy görkezýär.</p>' : '');

  const factors = Object.keys(model.distances).map((k) => `${KIND_LABELS[k].toLowerCase()} × ${fmtShort(ROUTE_FACTORS[k])}`).join(', ');
  $("autoCalcDetails").innerHTML =
    `<div class="calc-formula"><b>Formula.</b> 1 tonna ýüküň bahasy = (ýangyç + könelme we abatlama + ekipaž + sabit çykdajy) × ýük koeffisiýenti ÷ (göterijilik × doldurma derejesi).</div>` +
    `<p>Üpjünçilik = ulag sany × gatnaw sany × göterijilik.</p>` +
    (model.roundTrip ? '<p>Yzyna boş gaýdyş hasaba alyndy: ýangyç, könelme we ekipaž çykdajylary iki ýol üçin (aralyk × 2) hasaplanýar; sabit çykdajy bir gezek alynýar.</p>' : '') +
    `<p>Aralyk iki şäheriň koordinatalaryndan hasaplanýar (Haversine formulasy, math.js) we ýol egrilik koeffisiýentine köpeldilýär: ${factors}.</p>` +
    `<div class="table-scroll">${distanceTableHtml(model)}</div>` +
    `<p class="calc-example">${exampleHtml(model)}</p>` +
    `<p class="calc-note">Bu sanlar takmynan tariflere esaslanýar. Hakyky tarifleriňiz tapawutlanýan bolsa, ýokardaky «Tarifler» bölüminde olary üýtgediň.</p>`;
  $("autoSummary").hidden = false;
}

function initAutoSummary() {
  $("csvBtn").addEventListener('click', () => {
    if (!lastModel) return;
    const m = lastModel;
    const cell = (x) => `"${String(x).replace(/"/g, '""')}"`;
    const num = (x) => fmtShort(x).replace(/\u00a0/g, '');
    const rows = [['ş.b. / t', ...m.colNames]];
    m.costs.forEach((r, i) => rows.push([m.rowNames[i], ...r.map(num)]));
    rows.push([], ['Aralyk, km', ...m.colNames]);
    for (const k of Object.keys(m.distances)) rows.push([KIND_LABELS[k], ...m.distances[k].map(num)]);
    const csv = '\ufeff' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ulag-bahalary.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $("toManualBtn").addEventListener('click', () => {
    if (!lastModel) return;
    const m = lastModel;
    setMode('manual');
    showTable(m.rowNames.length, m.colNames.length,
      { costs: m.costs, supply: m.supply, demand: m.demand },
      { rows: m.rowNames, cols: m.colNames });
    $("manualPanel").scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// ---- scripts/modules/nwc.js ----
// Demirgazyk-günbatar burç usuly: iň ýokarky-çep işjeň öýjükden başlaýar, bahalara seretmeýär
function solveNWC(costs, supply, demand) {
  const S = supply.length, D = demand.length;
  let supplyLeft = supply.slice(), demandLeft = demand.slice();
  let rowActive = Array(S).fill(true), colActive = Array(D).fill(true);
  let allocation = Array.from({ length: S }, () => Array(D).fill(0));
  let activeRows = S, activeCols = D;
  let steps = [];
  let guard = 0;

  while (activeRows > 0 && activeCols > 0) {
    guard++;
    if (guard > 3000) break;

    const selI = rowActive.findIndex(v => v);
    const selJ = colActive.findIndex(v => v);

    const snapshot = {
      rowActive: rowActive.slice(), colActive: colActive.slice(),
      supplyLeft: supplyLeft.slice(), demandLeft: demandLeft.slice(),
      selI, selJ, cost: costs[selI][selJ],
    };

    const alloc = Math.min(supplyLeft[selI], demandLeft[selJ]);
    allocation[selI][selJ] += alloc;
    supplyLeft[selI] -= alloc;
    demandLeft[selJ] -= alloc;
    snapshot.alloc = alloc;
    steps.push(snapshot);

    const rowDone = supplyLeft[selI] <= 1e-9;
    const colDone = demandLeft[selJ] <= 1e-9;
    if (rowDone && colDone) {
      if (activeRows + activeCols > 2) { rowActive[selI] = false; activeRows--; }
      else { rowActive[selI] = false; activeRows--; colActive[selJ] = false; activeCols--; }
    } else if (rowDone) { rowActive[selI] = false; activeRows--; }
    else if (colDone) { colActive[selJ] = false; activeCols--; }
  }

  let total = 0;
  for (let i = 0; i < S; i++) for (let j = 0; j < D; j++) total += allocation[i][j] * costs[i][j];
  return { allocation, steps, total };
}

// ---- scripts/modules/least-cost.js ----
// Iň az baha usuly: işjeň tablisadaky iň arzan (girdejide — iň girdejili) öýjükden başlaýar
function solveLeastCost(costs, supply, demand, mode) {
  const S = supply.length, D = demand.length;
  let supplyLeft = supply.slice(), demandLeft = demand.slice();
  let rowActive = Array(S).fill(true), colActive = Array(D).fill(true);
  let allocation = Array.from({ length: S }, () => Array(D).fill(0));
  let activeRows = S, activeCols = D;
  let steps = [];
  let guard = 0;

  while (activeRows > 0 && activeCols > 0) {
    guard++;
    if (guard > 3000) break;

    let selI = -1, selJ = -1, bestVal = mode === 'max' ? -Infinity : Infinity;
    for (let i = 0; i < S; i++) {
      if (!rowActive[i]) continue;
      for (let j = 0; j < D; j++) {
        if (!colActive[j]) continue;
        const v = costs[i][j];
        if (mode === 'max' ? v > bestVal : v < bestVal) { bestVal = v; selI = i; selJ = j; }
      }
    }
    if (selI === -1) break;

    const snapshot = {
      rowActive: rowActive.slice(), colActive: colActive.slice(),
      supplyLeft: supplyLeft.slice(), demandLeft: demandLeft.slice(),
      selI, selJ, cost: bestVal,
    };

    const alloc = Math.min(supplyLeft[selI], demandLeft[selJ]);
    allocation[selI][selJ] += alloc;
    supplyLeft[selI] -= alloc;
    demandLeft[selJ] -= alloc;
    snapshot.alloc = alloc;
    steps.push(snapshot);

    const rowDone = supplyLeft[selI] <= 1e-9;
    const colDone = demandLeft[selJ] <= 1e-9;
    if (rowDone && colDone) {
      if (activeRows + activeCols > 2) { rowActive[selI] = false; activeRows--; }
      else { rowActive[selI] = false; activeRows--; colActive[selJ] = false; activeCols--; }
    } else if (rowDone) { rowActive[selI] = false; activeRows--; }
    else if (colDone) { colActive[selJ] = false; activeCols--; }
  }

  let total = 0;
  for (let i = 0; i < S; i++) for (let j = 0; j < D; j++) total += allocation[i][j] * costs[i][j];
  return { allocation, steps, total };
}

// ---- scripts/modules/vogel.js ----
// Vogel çemeleşme usuly (VAM): iň uly "tapawut" bolan setir/sütünde iň amatly öýjüge ýükleýär
function solveVAM(costs, supply, demand, mode) {
  const S = supply.length, D = demand.length;
  let supplyLeft = supply.slice(), demandLeft = demand.slice();
  let rowActive = Array(S).fill(true), colActive = Array(D).fill(true);
  let allocation = Array.from({ length: S }, () => Array(D).fill(0));
  let activeRows = S, activeCols = D;
  let steps = [];
  let guard = 0;

  while (activeRows > 0 && activeCols > 0) {
    guard++;
    if (guard > 3000) break;

    let rowPenalty = Array(S).fill(null), colPenalty = Array(D).fill(null);
    for (let i = 0; i < S; i++) {
      if (!rowActive[i]) continue;
      let vals = [];
      for (let j = 0; j < D; j++) if (colActive[j]) vals.push(costs[i][j]);
      vals.sort((a, b) => mode === 'max' ? b - a : a - b);
      rowPenalty[i] = vals.length >= 2 ? Math.abs(vals[1] - vals[0]) : 0;
    }
    for (let j = 0; j < D; j++) {
      if (!colActive[j]) continue;
      let vals = [];
      for (let i = 0; i < S; i++) if (rowActive[i]) vals.push(costs[i][j]);
      vals.sort((a, b) => mode === 'max' ? b - a : a - b);
      colPenalty[j] = vals.length >= 2 ? Math.abs(vals[1] - vals[0]) : 0;
    }

    let maxPenalty = -Infinity, isRow = true, idx = -1;
    for (let i = 0; i < S; i++) if (rowPenalty[i] !== null && rowPenalty[i] > maxPenalty) { maxPenalty = rowPenalty[i]; isRow = true; idx = i; }
    for (let j = 0; j < D; j++) if (colPenalty[j] !== null && colPenalty[j] > maxPenalty) { maxPenalty = colPenalty[j]; isRow = false; idx = j; }

    let selI = -1, selJ = -1, bestVal = mode === 'max' ? -Infinity : Infinity;
    if (isRow) {
      for (let j = 0; j < D; j++) if (colActive[j]) {
        const v = costs[idx][j];
        if (mode === 'max' ? v > bestVal : v < bestVal) { bestVal = v; selI = idx; selJ = j; }
      }
    } else {
      for (let i = 0; i < S; i++) if (rowActive[i]) {
        const v = costs[i][idx];
        if (mode === 'max' ? v > bestVal : v < bestVal) { bestVal = v; selI = i; selJ = idx; }
      }
    }
    if (selI === -1) break;

    const snapshot = {
      rowActive: rowActive.slice(), colActive: colActive.slice(),
      supplyLeft: supplyLeft.slice(), demandLeft: demandLeft.slice(),
      rowPenalty: rowPenalty.slice(), colPenalty: colPenalty.slice(),
      selI, selJ, isRow, idx, maxPenalty, cost: bestVal,
    };

    const alloc = Math.min(supplyLeft[selI], demandLeft[selJ]);
    allocation[selI][selJ] += alloc;
    supplyLeft[selI] -= alloc;
    demandLeft[selJ] -= alloc;
    snapshot.alloc = alloc;
    steps.push(snapshot);

    const rowDone = supplyLeft[selI] <= 1e-9;
    const colDone = demandLeft[selJ] <= 1e-9;
    if (rowDone && colDone) {
      if (activeRows + activeCols > 2) { rowActive[selI] = false; activeRows--; }
      else { rowActive[selI] = false; activeRows--; colActive[selJ] = false; activeCols--; }
    } else if (rowDone) { rowActive[selI] = false; activeRows--; }
    else if (colDone) { colActive[selJ] = false; activeCols--; }
  }

  let total = 0;
  for (let i = 0; i < S; i++) for (let j = 0; j < D; j++) total += allocation[i][j] * costs[i][j];
  return { allocation, steps, total };
}

// ---- scripts/modules/modi-basis.js ----
// MODI: esasy (basis) öýjükler we u/v potensiallary
function buildBasisFromAllocation(allocation, costs, S, D) {
  let basic = [];
  for (let i = 0; i < S; i++) for (let j = 0; j < D; j++) if (allocation[i][j] > 1e-9) basic.push({ i, j });
  const parent = Array(S + D).fill(0).map((_, k) => k);
  function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) { parent[ra] = rb; return true; } return false; }
  basic.forEach(c => union(c.i, S + c.j));
  const need = S + D - 1;
  if (basic.length < need) {
    // Üýtgez-derejeli (degenerate) ýagdaý: aýlaw döretmeýän iň arzan öýjükleri 0 mukdar bilen goşýarys
    let candidates = [];
    for (let i = 0; i < S; i++) for (let j = 0; j < D; j++) if (allocation[i][j] <= 1e-9) candidates.push({ i, j, cost: costs[i][j] });
    candidates.sort((a, b) => a.cost - b.cost);
    for (const c of candidates) {
      if (basic.length >= need) break;
      if (union(c.i, S + c.j)) basic.push({ i: c.i, j: c.j });
    }
  }
  return basic;
}

// u[i] + v[j] = baha[i][j] (esasy öýjükler üçin), u[0] = 0
function computeUV(basic, costs, S, D) {
  let u = Array(S).fill(null), v = Array(D).fill(null);
  u[0] = 0;
  let changed = true, guard = 0;
  while (changed && guard < 3000) {
    changed = false; guard++;
    for (const { i, j } of basic) {
      if (u[i] !== null && v[j] === null) { v[j] = costs[i][j] - u[i]; changed = true; }
      else if (u[i] === null && v[j] !== null) { u[i] = costs[i][j] - v[j]; changed = true; }
    }
  }
  return { u, v };
}

// ---- scripts/modules/modi-loop.js ----
// MODI: giriş öýjüginden başlap ýapyk aýlawy (loop) tapmak
function findLoop(entering, basic) {
  let candidates = basic.map(c => ({ i: c.i, j: c.j }));
  candidates.push({ i: entering.i, j: entering.j });
  let changed = true;
  while (changed) {
    changed = false;
    for (let idx = 0; idx < candidates.length; idx++) {
      const c = candidates[idx];
      const rowCount = candidates.filter(x => x.i === c.i).length;
      const colCount = candidates.filter(x => x.j === c.j).length;
      if (rowCount < 2 || colCount < 2) { candidates.splice(idx, 1); changed = true; break; }
    }
  }
  let remaining = candidates.filter(c => !(c.i === entering.i && c.j === entering.j));
  let path = [{ i: entering.i, j: entering.j }];
  let current = path[0];
  let direction = 'row';
  let guard = 0;
  while (remaining.length > 0 && guard < 200) {
    guard++;
    let nextIdx = direction === 'row' ? remaining.findIndex(c => c.i === current.i) : remaining.findIndex(c => c.j === current.j);
    if (nextIdx === -1) return null;
    const next = remaining[nextIdx];
    path.push(next);
    remaining.splice(nextIdx, 1);
    current = next;
    direction = direction === 'row' ? 'col' : 'row';
  }
  return path;
}

// ---- scripts/modules/modi.js ----
// MODI (u-v) usuly: başlangyç meýilnamany optimal derejä çenli gowulandyrýar



function modiIterate(costs, supply, demand, mode, initialAllocation) {
  const S = supply.length, D = demand.length;
  let allocation = initialAllocation.map(r => r.slice());
  let basic = buildBasisFromAllocation(allocation, costs, S, D);
  let iterations = [];
  let guard = 0;
  while (guard < 200) {
    guard++;
    const { u, v } = computeUV(basic, costs, S, D);
    const basicSet = new Set(basic.map(c => c.i + ',' + c.j));
    let deltas = [];
    for (let i = 0; i < S; i++) for (let j = 0; j < D; j++) {
      if (basicSet.has(i + ',' + j)) continue;
      deltas.push({ i, j, delta: costs[i][j] - (u[i] + v[j]) });
    }
    let entering = null;
    if (mode === 'max') {
      let best = 1e-7;
      for (const d of deltas) if (d.delta > best) { best = d.delta; entering = d; }
    } else {
      let best = -1e-7;
      for (const d of deltas) if (d.delta < best) { best = d.delta; entering = d; }
    }
    const snapshot = {
      u, v, deltas, basic: basic.map(c => ({ i: c.i, j: c.j })), entering,
      allocationBefore: allocation.map(r => r.slice()),
    };
    if (!entering) { iterations.push(snapshot); break; }

    const loop = findLoop(entering, basic);
    if (!loop) { snapshot.loopFailed = true; iterations.push(snapshot); break; }

    const minus = loop.filter((_, idx) => idx % 2 === 1);
    const theta = Math.min(...minus.map(c => allocation[c.i][c.j]));
    loop.forEach((c, idx) => {
      if (idx % 2 === 0) allocation[c.i][c.j] += theta;
      else allocation[c.i][c.j] -= theta;
    });
    let leavingIdx = -1;
    for (let k = 0; k < minus.length; k++) { if (Math.abs(allocation[minus[k].i][minus[k].j]) < 1e-7) { leavingIdx = k; break; } }
    const leaving = minus[leavingIdx];
    basic = basic.filter(c => !(c.i === leaving.i && c.j === leaving.j));
    basic.push({ i: entering.i, j: entering.j });

    snapshot.loop = loop;
    snapshot.theta = theta;
    snapshot.leaving = leaving;
    snapshot.allocationAfter = allocation.map(r => r.slice());
    iterations.push(snapshot);
  }
  let total = 0;
  for (let i = 0; i < S; i++) for (let j = 0; j < D; j++) total += allocation[i][j] * costs[i][j];
  return { finalAllocation: allocation, total, iterations };
}

// ---- scripts/modules/render-steps.js ----
// Ädimme-ädim çözgüdi çykarmak (Demirgazyk-günbatar, Iň az baha, Vogel)




// Demirgazyk-günbatar we Iň az baha üçin ädim tablisasy
function renderStepTable(snapshot, costs, S, D) {
  let html = "<table class='grid'><thead><tr><th></th>";
  for (let j = 0; j < D; j++) if (snapshot.colActive[j] || j === snapshot.selJ) html += `<th>${colLabel(j)}</th>`;
  html += "<th>Üpjünçilik</th></tr></thead><tbody>";
  for (let i = 0; i < S; i++) {
    if (!(snapshot.rowActive[i] || i === snapshot.selI)) continue;
    html += `<tr><td class="rowhead">${rowLabel(i)}</td>`;
    for (let j = 0; j < D; j++) {
      if (!(snapshot.colActive[j] || j === snapshot.selJ)) continue;
      const isHit = (i === snapshot.selI && j === snapshot.selJ);
      html += isHit
        ? `<td class="cell-hit">${fmt(costs[i][j])}<span class="alloc-tag">${fmt(snapshot.alloc)} ${unitName()}</span></td>`
        : `<td>${fmt(costs[i][j])}</td>`;
    }
    const supTxt = (snapshot.rowActive[i] || i === snapshot.selI) ? fmt(snapshot.supplyLeft[i]) : "–";
    html += `<td>${supTxt}</td></tr>`;
  }
  html += `<tr><td class="rowhead">Isleg</td>`;
  for (let j = 0; j < D; j++) {
    if (!(snapshot.colActive[j] || j === snapshot.selJ)) continue;
    const demTxt = (snapshot.colActive[j] || j === snapshot.selJ) ? fmt(snapshot.demandLeft[j]) : "–";
    html += `<td>${demTxt}</td>`;
  }
  html += "<td></td></tr></tbody></table>";
  return html;
}

// Vogel üçin ädim tablisasy (tapawut setiri we sütüni bilen)
function renderVamStepTable(snapshot, costs, S, D) {
  let html = "<table class='grid'><thead><tr><th></th>";
  for (let j = 0; j < D; j++) if (snapshot.colActive[j] || j === snapshot.selJ) html += `<th>${colLabel(j)}</th>`;
  html += "<th>Üpjünçilik</th><th>Setir tapawudy</th></tr></thead><tbody>";
  for (let i = 0; i < S; i++) {
    if (!(snapshot.rowActive[i] || i === snapshot.selI)) continue;
    html += `<tr><td class="rowhead">${rowLabel(i)}</td>`;
    for (let j = 0; j < D; j++) {
      if (!(snapshot.colActive[j] || j === snapshot.selJ)) continue;
      const isHit = (i === snapshot.selI && j === snapshot.selJ);
      html += isHit
        ? `<td class="cell-hit">${fmt(costs[i][j])}<span class="alloc-tag">${fmt(snapshot.alloc)} ${unitName()}</span></td>`
        : `<td>${fmt(costs[i][j])}</td>`;
    }
    const supTxt = (snapshot.rowActive[i] || i === snapshot.selI) ? fmt(snapshot.supplyLeft[i]) : "–";
    const penTxt = (snapshot.rowActive[i] && snapshot.rowPenalty[i] !== null) ? fmt(snapshot.rowPenalty[i]) : "–";
    html += `<td>${supTxt}</td><td class="${snapshot.isRow && snapshot.idx === i ? 'cell-hit' : ''}">${penTxt}</td></tr>`;
  }
  html += `<tr><td class="rowhead">Isleg</td>`;
  for (let j = 0; j < D; j++) {
    if (!(snapshot.colActive[j] || j === snapshot.selJ)) continue;
    const demTxt = (snapshot.colActive[j] || j === snapshot.selJ) ? fmt(snapshot.demandLeft[j]) : "–";
    html += `<td>${demTxt}</td>`;
  }
  html += `<td></td><td></td></tr><tr><td class="rowhead">Sütün tapawudy</td>`;
  for (let j = 0; j < D; j++) {
    if (!(snapshot.colActive[j] || j === snapshot.selJ)) continue;
    const penTxt = (snapshot.colActive[j] && snapshot.colPenalty[j] !== null) ? fmt(snapshot.colPenalty[j]) : "–";
    const hit = (!snapshot.isRow && snapshot.idx === j) ? "cell-hit" : "";
    html += `<td class="${hit}">${penTxt}</td>`;
  }
  html += "<td></td><td></td></tr></tbody></table>";
  return html;
}

function explainNWC(snapshot) {
  const cellName = `${rowLabel(snapshot.selI)}-${colLabel(snapshot.selJ)}`;
  return `Işjeň tablisanyň iň ýokarky-çep (demirgazyk-günbatar) burçy — <b>${cellName}</b> öýjügi (baha ${fmt(snapshot.cost)}). Üpjünçilik we isleg bilen çäklenip, bu öýjüge <b>${fmt(snapshot.alloc)} ${unitName()}</b> bölünýär.`;
}

function explainLeastCost(snapshot, mode) {
  const cellName = `${rowLabel(snapshot.selI)}-${colLabel(snapshot.selJ)}`;
  const bestWord = mode === 'max' ? "iň girdejili" : "iň arzan";
  return `Işjeň tablisadaky ${bestWord} öýjük — <b>${cellName}</b> (baha ${fmt(snapshot.cost)}). Üpjünçilik we isleg bilen çäklenip, bu öýjüge <b>${fmt(snapshot.alloc)} ${unitName()}</b> bölünýär.`;
}

function explainVAM(snapshot, mode) {
  const axisWord = snapshot.isRow ? "setir" : "sütün";
  const axisName = snapshot.isRow ? rowLabel(snapshot.idx) : colLabel(snapshot.idx);
  const cellName = `${rowLabel(snapshot.selI)}-${colLabel(snapshot.selJ)}`;
  const bestWord = mode === 'max' ? "iň girdejili" : "iň arzan";
  return `Iň ýokary tapawut <b>${fmt(snapshot.maxPenalty)}</b> — ${axisWord} ${axisName} boýunça ýüze çykýar. Şol ${axisWord}da ${bestWord} <b>${cellName}</b> öýjüginde (${fmt(snapshot.cost)}), şoňa görä bu öýjüge <b>${fmt(snapshot.alloc)} ${unitName()}</b> bölünýär.`;
}

function renderSteps(steps, costs, S, D, mode, explain, tableFn) {
  let out = "";
  steps.forEach((snap) => {
    out += `<div class="step-block">`;
    out += `<p class="step-explain">${explain(snap, mode)}</p>`;
    out += `<div class="table-scroll">${tableFn(snap, costs, S, D)}</div>`;
    out += `</div>`;
  });
  $("stepsWrap").innerHTML = out;
}

// ---- scripts/modules/render-final.js ----
// Iň soňky paýlanyş: tablisa, her ýol boýunça hasap we jemi baha




// "Haýsy ýol — näçe — jemi" sanawy we jemi baha (ähli sahypalar üçin umumy)
function renderBreakdown(allocation, costs, S, D, dummyRow, dummyCol, mode) {
  let list = "";
  let realTotal = 0;
  for (let i = 0; i < S; i++) {
    for (let j = 0; j < D; j++) {
      const q = allocation[i][j];
      if (q > 1e-9 && i !== dummyRow && j !== dummyCol) {
        const sub = q * costs[i][j];
        realTotal += sub;
        list += `<li><span class="route">${rowLabel(i)} → ${colLabel(j)}</span><span>${fmt(q)} × ${fmt(costs[i][j])} = ${fmt(sub)}</span></li>`;
      }
    }
  }
  $("breakdownList").innerHTML = list;
  $("totalLabel").textContent = mode === 'max' ? "Jemi girdeji:" : "Jemi çykdajy:";
  $("totalCostNum").textContent = fmt(realTotal) + currencySuffix();
  $("finalCard").hidden = false;
  return realTotal;
}

function renderFinal(allocation, costs, supply, demand, dummyRow, dummyCol, mode) {
  const S = supply.length, D = demand.length;
  let html = "<table class='grid'><thead><tr><th></th>";
  for (let j = 0; j < D; j++) html += `<th>${colLabel(j)}${j === dummyCol ? ' (goşmaça)' : ''}</th>`;
  html += "<th>Üpjünçilik</th></tr></thead><tbody>";
  for (let i = 0; i < S; i++) {
    html += `<tr><td class="rowhead">${rowLabel(i)}${i === dummyRow ? ' (goşmaça)' : ''}</td>`;
    for (let j = 0; j < D; j++) {
      const q = allocation[i][j];
      html += q > 1e-9
        ? `<td class="cell-alloc">${fmt(costs[i][j])}<span class="alloc-tag">${fmt(q)} ${unitName()}</span></td>`
        : `<td class="cell-dim">${fmt(costs[i][j])}</td>`;
    }
    html += `<td>${fmt(supply[i])}</td></tr>`;
  }
  html += `<tr><td class="rowhead">Isleg</td>`;
  for (let j = 0; j < D; j++) html += `<td>${fmt(demand[j])}</td>`;
  html += "<td></td></tr></tbody></table>";
  $("finalTableWrap").innerHTML = html;

  renderBreakdown(allocation, costs, S, D, dummyRow, dummyCol, mode);
}

// ---- scripts/modules/render-modi.js ----
// MODI sahypasynyň çykarylyşy: paýlanyş tablisasy, u/v tablisasy, ädim düşündirişleri




function renderAllocTable(allocation, costs, supply, demand, dummyRow, dummyCol) {
  const S = supply.length, D = demand.length;
  let html = "<table class='grid'><thead><tr><th></th>";
  for (let j = 0; j < D; j++) html += `<th>${colLabel(j)}${j === dummyCol ? ' (goşmaça)' : ''}</th>`;
  html += "<th>Üpjünçilik</th></tr></thead><tbody>";
  for (let i = 0; i < S; i++) {
    html += `<tr><td class="rowhead">${rowLabel(i)}${i === dummyRow ? ' (goşmaça)' : ''}</td>`;
    for (let j = 0; j < D; j++) {
      const q = allocation[i][j];
      html += q > 1e-9
        ? `<td class="cell-alloc">${fmt(costs[i][j])}<span class="alloc-tag">${fmt(q)} ${unitName()}</span></td>`
        : `<td class="cell-dim">${fmt(costs[i][j])}</td>`;
    }
    html += `<td>${fmt(supply[i])}</td></tr>`;
  }
  html += `<tr><td class="rowhead">Isleg</td>`;
  for (let j = 0; j < D; j++) html += `<td>${fmt(demand[j])}</td>`;
  html += "<td></td></tr></tbody></table>";
  return html;
}

// Ýalan setir/sütün hasaba alynmaýar
function computeTotal(allocation, costs, S, D, dummyRow, dummyCol) {
  let total = 0;
  for (let i = 0; i < S; i++) for (let j = 0; j < D; j++) if (i !== dummyRow && j !== dummyCol) total += allocation[i][j] * costs[i][j];
  return total;
}

function renderUVTable(snapshot, costs, S, D) {
  const basicSet = new Set(snapshot.basic.map(c => c.i + ',' + c.j));
  const enteringKey = snapshot.entering ? snapshot.entering.i + ',' + snapshot.entering.j : null;
  const deltaMap = {};
  snapshot.deltas.forEach(d => { deltaMap[d.i + ',' + d.j] = d.delta; });
  const alloc = snapshot.allocationBefore;

  let html = "<table class='grid'><thead><tr><th></th>";
  for (let j = 0; j < D; j++) html += `<th>${colLabel(j)} (v=${snapshot.v[j] === null ? '?' : fmt(snapshot.v[j])})</th>`;
  html += "</tr></thead><tbody>";
  for (let i = 0; i < S; i++) {
    html += `<tr><td class="rowhead">${rowLabel(i)} (u=${snapshot.u[i] === null ? '?' : fmt(snapshot.u[i])})</td>`;
    for (let j = 0; j < D; j++) {
      const key = i + ',' + j;
      if (basicSet.has(key)) {
        html += `<td class="cell-alloc">${fmt(costs[i][j])}<span class="alloc-tag">esasy, ${fmt(alloc[i][j])} ${unitName()}</span></td>`;
      } else {
        const d = deltaMap[key];
        const isEnter = key === enteringKey;
        const cls = isEnter ? 'cell-hit' : '';
        html += `<td class="${cls}">${fmt(costs[i][j])}<span class="delta-tag">Δ=${fmt(d)}${isEnter ? ' ← giriş' : ''}</span></td>`;
      }
    }
    html += `</tr>`;
  }
  html += "</tbody></table>";
  return html;
}

function renderIterationExplain(snapshot, mode, idx) {
  if (!snapshot.entering) {
    const cond = mode === 'max' ? "ähli Δ ≤ 0" : "ähli Δ ≥ 0";
    return `<p class="step-explain"><b>Optimallyk barlagy:</b> ${cond} bolany üçin bu meýilnamada gowulaşdyryp boljak öýjük ýok. Netije optimal!</p>`;
  }
  if (snapshot.loopFailed) {
    return `<p class="step-explain">Aýlaw (loop) tapylmady — bu meýilnama üýtgez-derejeli (degenerate) bolup biler. Hasaplama şu ýerde saklanýar.</p>`;
  }
  const cellName = `${rowLabel(snapshot.entering.i)}-${colLabel(snapshot.entering.j)}`;
  let loopTxt = snapshot.loop.map((c, i) => `${rowLabel(c.i)}-${colLabel(c.j)} (${i % 2 === 0 ? '+' : '−'})`).join(' → ');
  const leavingName = `${rowLabel(snapshot.leaving.i)}-${colLabel(snapshot.leaving.j)}`;
  return `<p class="step-explain"><b>Ädim ${idx + 1}:</b> Iň amatly mümkinçilik bahasy Δ=${fmt(snapshot.entering.delta)} bilen <b>${cellName}</b> öýjügi girýär. Aýlaw: ${loopTxt}. (−) öýjükleriň iň kiçisi θ=${fmt(snapshot.theta)}, şoňa görä <b>${leavingName}</b> öýjügi esasdan çykýar.</p>`;
}

function renderModiSteps(iterations, costs, S, D, mode, supplyRef, demandRef, dummyRowRef, dummyColRef) {
  let out = "";
  iterations.forEach((snap, idx) => {
    out += `<div class="step-block">`;
    out += renderIterationExplain(snap, mode, idx);
    out += `<div class="table-scroll">${renderUVTable(snap, costs, S, D)}</div>`;
    if (snap.allocationAfter) {
      out += `<div class="muted" style="font-size:.85rem; margin:12px 0 4px;">Bu ädimden soňky täze paýlanyş:</div>`;
      out += `<div class="table-scroll">${renderAllocTable(snap.allocationAfter, costs, supplyRef, demandRef, dummyRowRef, dummyColRef)}</div>`;
    }
    out += `</div>`;
  });
  $("modiStepsWrap").innerHTML = out;
}

// ---- scripts/modules/solver-page.js ----
// Dört çözüjiniň (nwc, least-cost, vogel, modi) umumy sahypa dolandyryjysy
















// Awtomatik rejimde goşmaça (fiktiw) setir/sütün atlary we ölçeg birlikleri
const AUTO_LABELS = { dummyRow: 'Ulag ýetmezçiligi', dummyCol: 'Ulanylmaýan göterijilik', unit: 't', currency: 'ş.b.' };

const CLASSIC = {
  'nwc': { solve: (b) => solveNWC(b.costs, b.supply, b.demand), explain: explainNWC, table: renderStepTable },
  'least-cost': { solve: (b, mode) => solveLeastCost(b.costs, b.supply, b.demand, mode), explain: explainLeastCost, table: renderStepTable },
  'vogel': { solve: (b, mode) => solveVAM(b.costs, b.supply, b.demand, mode), explain: explainVAM, table: renderVamStepTable },
};

function runClassic(kind, bal, mode) {
  const spec = CLASSIC[kind];
  const S = bal.supply.length, D = bal.demand.length;
  const result = spec.solve(bal, mode);
  renderSteps(result.steps, bal.costs, S, D, mode, spec.explain, spec.table);
  renderFinal(result.allocation, bal.costs, bal.supply, bal.demand, bal.dummyRow, bal.dummyCol, mode);
}

function runModi(bal, mode) {
  const S = bal.supply.length, D = bal.demand.length;
  const initMethod = $("initMethod").value;

  let initialAllocation, initMethodName;
  if (initMethod === 'nwc') { initialAllocation = solveNWC(bal.costs, bal.supply, bal.demand).allocation; initMethodName = "Demirgazyk-günbatar burç usuly"; }
  else if (initMethod === 'lc') { initialAllocation = solveLeastCost(bal.costs, bal.supply, bal.demand, mode).allocation; initMethodName = "Iň az baha usuly"; }
  else { initialAllocation = solveVAM(bal.costs, bal.supply, bal.demand, mode).allocation; initMethodName = "Vogel çemeleşme usuly"; }

  const initTotal = computeTotal(initialAllocation, bal.costs, S, D, bal.dummyRow, bal.dummyCol);
  const totalWord = mode === 'max' ? "jemi girdeji" : "jemi çykdajy";
  $("initExplain").innerHTML = `<b>${initMethodName}</b> bilen tapylan başlangyç meýilnama, ${totalWord}: <b>${fmt(initTotal)}${currencySuffix()}</b>. Indi muny MODI usuly bilen optimallaşdyrarys.`;
  $("initTableWrap").innerHTML = renderAllocTable(initialAllocation, bal.costs, bal.supply, bal.demand, bal.dummyRow, bal.dummyCol);

  const modiResult = modiIterate(bal.costs, bal.supply, bal.demand, mode, initialAllocation);
  renderModiSteps(modiResult.iterations, bal.costs, S, D, mode, bal.supply, bal.demand, bal.dummyRow, bal.dummyCol);
  $("finalTableWrap").innerHTML = renderAllocTable(modiResult.finalAllocation, bal.costs, bal.supply, bal.demand, bal.dummyRow, bal.dummyCol);
  renderBreakdown(modiResult.finalAllocation, bal.costs, S, D, bal.dummyRow, bal.dummyCol, mode);
}

function showError(message) {
  $("errorBox").textContent = message;
  $("errorBox").hidden = false;
  $("errorBox").scrollIntoView({ behavior: "smooth", block: "center" });
  $("resultsSection").hidden = true;
  hideAutoSummary();
}

function solve(kind) {
  const auto = getMode() === 'auto';
  let input;
  try {
    input = auto ? readAutoInput() : readManualInput();
  } catch (err) {
    input = { error: err.message };
  }
  if (input.error) { showError(input.error); return; }
  $("errorBox").hidden = true;

  // Awtomatik rejimde maksat hemişe çykdajyny azaltmak
  const mode = auto ? 'min' : document.querySelector('input[name="objMode"]:checked').value;

  setTurkmenNumbers(auto);
  if (auto) setLabels(input.labels.rows, input.labels.cols, AUTO_LABELS);
  else if (input.labels) setLabels(input.labels.rows, input.labels.cols);
  else resetLabels();

  const bal = balance(input.costs, input.supply, input.demand);
  $("balanceNote").innerHTML = bal.note ? `<div class="note-box">${bal.note}</div>` : "";

  if (kind === 'modi') runModi(bal, mode);
  else runClassic(kind, bal, mode);

  if (auto) renderAutoSummary(input.model);
  else hideAutoSummary();

  $("resultsSection").hidden = false;
  $("resultsSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

function initSolverPage(kind) {
  // Gözleg meýdany bezeg üçin (hiç zat etmeýär)
  $("searchForm").addEventListener("submit", (e) => e.preventDefault());

  $("algoToggle").addEventListener("click", (e) => {
    e.preventDefault();
    const box = $("algoInfo");
    box.hidden = !box.hidden;
    if (!box.hidden) box.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  initModeSwitch();
  initAutoForm();
  initAutoSummary();
  initTableInput();
  $("solveBtn").addEventListener("click", () => solve(kind));
}

// ---- scripts/main.js ----
// Giriş nokady: <body data-page="..."> boýunça degişli sahypany işe goýýar


const SOLVER_PAGES = ['nwc', 'least-cost', 'vogel', 'modi'];
const currentPage = document.body.dataset.page;

if (SOLVER_PAGES.includes(currentPage)) initSolverPage(currentPage);
})();
