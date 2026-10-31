/* Amatly.com — hyzmat işçisi (service worker): saýt internetsiz hem açylýar.
 *
 *  • Esasy faýllar (Baş sahypa, menýu, harplar, offline sahypasy) gurlanda öňünden ýüklenýär (SHELL).
 *  • Açan sahypalaryňyz we olaryň faýllary ýatda saklanýar: internet ýok bolsa şolar açylýar.
 *  • Sazlamalar → «Programma we offline» → «Ähli saýty ýükle»: assets/pwa/files.json-daky ähli faýllar ýüklenýär;
 *    saýt täzelende diňe üýtgän faýllar täzeden ýüklenýär.
 *  • Sahypalar, CSS we JS — ilki internetden (täze wersiýa), 4 sekuntda jogap bolmasa ýa-da internet ýok bolsa ýatdan.
 *    Harplar, suratlar, assets/vendor/ we ?v=… salgyly faýllar — ilki ýatdan (olar üýtgemeýär).
 *  • api/ (Amatly AI, hasaplar) — diňe internet bilen; ýatda saklanmaýar.
 * VERSION we SHELL setirlerini tools/pwa.mjs ýazýar (node tools/pwa.mjs) — el bilen üýtgetmäň.
 */
'use strict';
const VERSION = '82286db1ff49';
const SHELL = ["index.html","offline.html","manifest.webmanifest","favicon.svg","icons/icon-192.png","assets/nav/nav.css","assets/nav/nav.js","assets/nav/theme.js","assets/nav/account.js","assets/fonts/instrument-sans-400.woff2","assets/fonts/instrument-sans-700.woff2","assets/fonts/lm-roman-demi.woff2","assets/giris/css/home.css","assets/giris/js/main.js","assets/giris/js/hash.js"];
const CORE = 'amatly-core-' + VERSION;      /* her wersiýanyň öz esasy faýllary */
const PAGES = 'amatly-pages';               /* açylan sahypalar we faýllar */
const FULL = 'amatly-offline';              /* «Ähli saýty ýükle» */
const BASE = new URL('./', self.location.href).pathname;
const META = BASE + '__amatly-offline-meta__';
const TIMEOUT = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CORE)
    .then((c) => c.addAll(SHELL.map((p) => new Request(BASE + p, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('amatly-core-') && k !== CORE) await caches.delete(k);
    await self.clients.claim();
    if (await caches.has(FULL)) refreshFull().catch(() => {});   /* saýt täzelendi — üýtgän faýllar */
  })());
});

/* salgy → ýatdaky açar: ?… we #… aýrylýar, papka → index.html */
function pageKey(url) {
  const u = new URL(url);
  let p = u.pathname;
  if (p.endsWith('/')) p += 'index.html';
  return u.origin + p;
}
function timeout(promise, ms) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
  });
}
async function put(cacheName, key, res) {
  try { const c = await caches.open(cacheName); await c.put(key, res); } catch (e) { /* ýer ýok — bolýar */ }
}
async function offlinePage() {
  const r = await caches.match(BASE + 'offline.html');
  if (!r) return new Response('<!doctype html><meta charset="utf-8"><title>Internet ýok</title><p>Internet ýok. Baglanyşyk dikelende sahypany täzeläň.</p>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  const html = (await r.text()).replace('data-base=""', 'data-base="' + BASE + '"');
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

/* sahypa: internetden (täze), bolmasa ýatdan, ol hem bolmasa — offline sahypasy */
async function page(req) {
  const key = pageKey(req.url);
  const net = fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') put(PAGES, key, res.clone());
    return res;
  });
  const cached = await caches.match(key);
  if (!cached) {
    try { return await net; } catch (e) { return offlinePage(); }
  }
  try { return await timeout(net, TIMEOUT); } catch (e) { net.catch(() => {}); return cached; }
}
/* internet ýok bolsa: ?v=… başga bolsa-da şol faýl («Ähli saýty ýükle» faýllary soragsyz salgy bilen saklaýar) */
async function anyVersion(key, err) {
  const r = await caches.match(key, { ignoreSearch: true });
  if (r) return r;
  throw err;
}
async function networkFirst(req) {
  const key = req.url.split('#')[0];
  const net = fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') put(PAGES, key, res.clone());
    return res;
  });
  const cached = await caches.match(key);
  if (!cached) return net.catch((e) => anyVersion(key, e));
  try { return await timeout(net, TIMEOUT); } catch (e) { net.catch(() => {}); return cached; }
}
async function cacheFirst(req) {
  const key = req.url.split('#')[0];
  const cached = await caches.match(key);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') put(PAGES, key, res.clone());
    return res;
  } catch (e) { return anyVersion(key, e); }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  const rel = url.pathname.slice(BASE.length);
  if (rel.startsWith('api/') || rel === 'sw.js') return;
  if (req.mode === 'navigate') { e.respondWith(page(req)); return; }
  if (req.headers.has('range')) return;
  if (/\.(woff2?|ttf|otf|png|jpe?g|gif|webp|avif|svg|ico)$/i.test(url.pathname) || /(^|&)v=/.test(url.search.slice(1)) || rel.startsWith('assets/vendor/')) {
    e.respondWith(cacheFirst(req));
    return;
  }
  e.respondWith(networkFirst(req));
});

/* ------------------------------------------------ «Ähli saýty ýükle» (Sazlamalar sahypasy habar iberýär) */
async function tell(msg) {
  for (const c of await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })) c.postMessage(msg);
}
let fullRun = null;
function refreshFull() {
  if (!fullRun) fullRun = doRefreshFull().finally(() => { fullRun = null; });
  return fullRun;
}
async function doRefreshFull() {
  const res = await fetch(BASE + 'assets/pwa/files.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('files.json ' + res.status);
  const list = await res.json();
  const cache = await caches.open(FULL);
  const meta = await cache.match(META).then((r) => (r ? r.json() : {})).catch(() => ({}));
  const want = new Map(list.files.map((f) => [f[0], f[2]]));
  for (const p of Object.keys(meta)) if (!want.has(p)) { await cache.delete(BASE + p); delete meta[p]; }
  const todo = list.files.filter((f) => meta[f[0]] !== f[2]);
  const total = list.files.length;
  let done = total - todo.length, failed = 0, i = 0, last = 0;
  await tell({ type: 'offline-progress', done, total });
  async function worker() {
    while (i < todo.length) {
      const f = todo[i++];
      try {
        const r = await fetch(BASE + f[0], { cache: 'no-cache' });
        if (!r.ok) throw new Error(String(r.status));
        await cache.put(BASE + f[0], r);
        meta[f[0]] = f[2];
      } catch (e) { failed++; }
      done++;
      if (Date.now() - last > 250 || done === total) { last = Date.now(); tell({ type: 'offline-progress', done, total }); }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  await cache.put(META, new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
  await tell({ type: 'offline-done', total, failed, version: list.version });
  return { total, failed };
}
self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'offline-all') e.waitUntil(refreshFull().catch((err) => tell({ type: 'offline-done', total: 0, failed: -1, error: String(err && err.message || err) })));
  else if (d.type === 'offline-clear') e.waitUntil(Promise.all([caches.delete(FULL), caches.delete(PAGES)]).then(() => tell({ type: 'offline-cleared' })));
  else if (d.type === 'version' && e.source) e.source.postMessage({ type: 'version', version: VERSION });
});
