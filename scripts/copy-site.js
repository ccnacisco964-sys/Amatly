// Saýtyň faýllaryny programma bukjasyna göçürýär (Android we Windows gurluşygy üçin).
// Ulanylyşy: node scripts/copy-site.js <bukja>
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dest = path.resolve(process.argv[2]);
const skip = new Set([
  '.git', '.github', 'android', 'desktop', 'scripts', 'node_modules',
  'api', 'tools', 'README.md', '.htaccess', '_headers', '.nojekyll',
]);

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
for (const name of fs.readdirSync(root)) {
  if (skip.has(name)) continue;
  fs.cpSync(path.join(root, name), path.join(dest, name), { recursive: true });
}
console.log('Saýt göçürildi:', dest);
