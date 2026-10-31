// Amatly — kompýuter (Windows) programmasy. Saýty internetsiz, programmanyň içinden açýar.
const { app, BrowserWindow, protocol, net, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, 'www');
const ORIGIN = 'app://amatly';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, allowServiceWorkers: true, corsEnabled: true } },
]);

function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath);
  if (p.startsWith('/Amatly/')) p = p.slice('/Amatly'.length); // 404.html-däki GitHub Pages salgylary
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep)) return null;
  try {
    if (fs.statSync(file).isFile()) return file;
  } catch (e) { /* faýl ýok */ }
  return null;
}

function openExternal(url) {
  if (/^(https?|mailto|tel):/i.test(url)) shell.openExternal(url);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 360,
    minHeight: 500,
    backgroundColor: '#0b1324',
    title: 'Amatly',
    icon: path.join(ROOT, 'icons', 'icon-512.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(ORIGIN)) return { action: 'allow' };
    openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(ORIGIN)) {
      event.preventDefault();
      openExternal(url);
    }
  });
  win.loadURL(ORIGIN + '/index.html');
}

app.whenReady().then(() => {
  protocol.handle('app', async (request) => {
    const file = resolveFile(new URL(request.url).pathname);
    if (file) return net.fetch(pathToFileURL(file).toString());
    const notFound = await net.fetch(pathToFileURL(path.join(ROOT, '404.html')).toString());
    return new Response(await notFound.text(), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
  });
  Menu.setApplicationMenu(null);
  createWindow();
});

app.on('window-all-closed', () => app.quit());
