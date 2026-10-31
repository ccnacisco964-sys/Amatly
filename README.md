# Amatly.com — matematika öz diliňde

Türkmen dilinde matematika: kalkulýatorlar, sapaklar, oýunlar we Amatly AI.

**Saýt:** https://ccnacisco964-sys.github.io/Amatly/

## GitHub Pages

Saýt GitHub Pages arkaly (Settings → Pages → "Deploy from a branch") hemmeler üçin açyk.

Bellikler:
- GitHub Pages diňe statik faýllary görkezýär, PHP işlemeýär. Şonuň üçin `api/ai.php` we `api/account.php` bu ýerde işlemeýär:
  hasaplar diňe brauzerde saklanýar, AI bolsa diňe ulanyjy Sazlamalarda öz API açaryny goşsa işleýär.
- `404.html` faýlyndaky salgylar `/Amatly/` bilen başlaýar (GitHub Pages taslama salgysy üçin).
  Saýty öz domeniňize (mysal: amatly.com) geçirseňiz, `/Amatly/` böleklerini `/` bilen çalyşyň.
- `.htaccess` we `_headers` faýllary GitHub Pages-de ulanylmaýar (Apache / Netlify / Cloudflare üçin).
