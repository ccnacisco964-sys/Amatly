/* Amatly.com — parollary howpsuz saklamak üçin PBKDF2-SHA256 (Baş sahypadaky hasap üçin).
   Brauzeriň Web Crypto API-si bar bolsa şony ulanýar; ýok bolsa (mysal, howpsuz däl http:// salgyda) şu faýldaky
   arassa JavaScript SHA-256 / HMAC / PBKDF2 bilen hasaplaýar — netije birmeňzeş. window.AmatlyHash çykarylýar. */
(function (g) {
  'use strict';
  var K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  var W = new Uint32Array(64);
  /* bir 64 baýtlyk blok (16 söz) bilen ýagdaýy (H, 8 söz) täzelemek */
  function compress(H, M) {
    var t, x, y;
    for (t = 0; t < 16; t++) W[t] = M[t];
    for (t = 16; t < 64; t++) {
      x = W[t - 15]; y = W[t - 2];
      W[t] = (W[t - 16] + (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) + W[t - 7] + (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10))) | 0;
    }
    var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g2 = H[6], h = H[7];
    for (t = 0; t < 64; t++) {
      var t1 = (h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g2)) + K[t] + W[t]) | 0;
      var t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g2; g2 = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g2) | 0; H[7] = (H[7] + h) | 0;
  }
  var IV = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  function sha256(msg) {
    var l = msg.length, n = (l + 9 + 63) >> 6, buf = new Uint8Array(n * 64), H = new Int32Array(IV), M = new Int32Array(16);
    buf.set(msg); buf[l] = 0x80;
    var dv = new DataView(buf.buffer), bits = l * 8;
    dv.setUint32(buf.length - 4, bits >>> 0); dv.setUint32(buf.length - 8, Math.floor(bits / 0x100000000));
    for (var bl = 0; bl < n; bl++) { for (var t = 0; t < 16; t++) M[t] = dv.getUint32(bl * 64 + t * 4); compress(H, M); }
    var out = new Uint8Array(32), odv = new DataView(out.buffer);
    for (var i = 0; i < 8; i++) odv.setUint32(i * 4, H[i] >>> 0);
    return out;
  }
  function concat(a, b) { var r = new Uint8Array(a.length + b.length); r.set(a); r.set(b, a.length); return r; }
  function words(bytes) { var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), w = new Int32Array(bytes.length >> 2); for (var i = 0; i < w.length; i++) w[i] = dv.getUint32(i * 4); return w; }
  function hmac(key, msg) {
    if (key.length > 64) key = sha256(key);
    var k = new Uint8Array(64); k.set(key);
    var ip = new Uint8Array(64), op = new Uint8Array(64);
    for (var i = 0; i < 64; i++) { ip[i] = k[i] ^ 0x36; op[i] = k[i] ^ 0x5c; }
    return sha256(concat(op, sha256(concat(ip, msg))));
  }
  /* PBKDF2-HMAC-SHA256, 32 baýt: ipad/opad ýagdaýlary bir gezek hasaplanýar, her gaýtalamada 2 blok */
  function pbkdf2js(pass, salt, iter) {
    if (pass.length > 64) pass = sha256(pass);
    var k = new Uint8Array(64); k.set(pass);
    var ip = new Uint8Array(64), op = new Uint8Array(64);
    for (var i = 0; i < 64; i++) { ip[i] = k[i] ^ 0x36; op[i] = k[i] ^ 0x5c; }
    var Hi = new Int32Array(IV), Ho = new Int32Array(IV);
    compress(Hi, words(ip)); compress(Ho, words(op));
    var u = words(hmac(pass, concat(salt, new Uint8Array([0, 0, 0, 1])))), out = new Int32Array(u);
    var M = new Int32Array(16), H = new Int32Array(8);
    for (var j = 1; j < iter; j++) {
      M.set(u); M[8] = 0x80000000 | 0; M[9] = M[10] = M[11] = M[12] = M[13] = M[14] = 0; M[15] = 768;
      H.set(Hi); compress(H, M);
      M.set(H); M[8] = 0x80000000 | 0; M[9] = M[10] = M[11] = M[12] = M[13] = M[14] = 0; M[15] = 768;
      H.set(Ho); compress(H, M);
      for (i = 0; i < 8; i++) { u[i] = H[i]; out[i] ^= H[i]; }
    }
    var res = new Uint8Array(32), dv = new DataView(res.buffer);
    for (i = 0; i < 8; i++) dv.setUint32(i * 4, out[i] >>> 0);
    return res;
  }
  function utf8(s) {
    if (g.TextEncoder) return new g.TextEncoder().encode(String(s));
    var b = unescape(encodeURIComponent(String(s))), a = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return a;
  }
  function hex(bytes) { var s = ''; bytes = new Uint8Array(bytes); for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16); return s; }
  function unhex(h) { var a = new Uint8Array(h.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
  var subtle = g.crypto && g.crypto.subtle && g.isSecureContext !== false ? g.crypto.subtle : null;
  function randomHex(n) {
    var a = new Uint8Array(n);
    if (g.crypto && g.crypto.getRandomValues) g.crypto.getRandomValues(a); else for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
    return hex(a);
  }
  function pbkdf2(password, saltHex, iter) {
    var pass = utf8(password), salt = unhex(saltHex);
    if (subtle) {
      return subtle.importKey('raw', pass, 'PBKDF2', false, ['deriveBits'])
        .then(function (key) { return subtle.deriveBits({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, key, 256); })
        .then(hex, function () { return hex(pbkdf2js(pass, salt, iter)); });
    }
    return new Promise(function (res) { setTimeout(function () { res(hex(pbkdf2js(pass, salt, iter))); }, 0); });
  }
  function sha256hex(s) {
    if (subtle) return subtle.digest('SHA-256', utf8(s)).then(hex, function () { return hex(sha256(utf8(s))); });
    return Promise.resolve(hex(sha256(utf8(s))));
  }
  /* öňki wersiýanyň ätiýaçlyk hashy (Web Crypto ýok wagty) — köne hasaplary tanamak üçin */
  function legacyWeak(pw) { var h = 0; for (var i = 0; i < pw.length; i++) h = (h * 31 + pw.charCodeAt(i)) | 0; return 'fallback_' + h; }

  g.AmatlyHash = {
    ITER: subtle ? 210000 : 100000,           // Web Crypto bolmasa, arassa JS üçin azrak gaýtalama (her ulanyjyda öz sany saklanýar)
    native: !!subtle,
    randomHex: randomHex, pbkdf2: pbkdf2, sha256hex: sha256hex, legacyWeak: legacyWeak,
    _js: { sha256: function (s) { return hex(sha256(utf8(s))); }, pbkdf2: function (p, saltHex, iter) { return hex(pbkdf2js(utf8(p), unhex(saltHex), iter)); } }
  };
})(typeof window !== 'undefined' ? window : globalThis);
