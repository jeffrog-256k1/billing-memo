import { app, BrowserWindow, dialog, Menu, protocol, session, shell } from 'electron';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { APP_URL, assetKey, contentSecurityPolicy, externalUrl, internalUrl } from './security.mjs';

app.setName('Billing Memo');
// Explicit custom profiles also allow isolated QA without reading a user's actual ledger.
const profile = app.commandLine.getSwitchValue('user-data-dir');
app.setPath(
  'userData',
  profile ? path.resolve(profile) : path.join(app.getPath('appData'), 'Billing Memo'),
);
app.setAppUserModelId('app.leejungjae.billingmemo');
protocol.registerSchemesAsPrivileged([
  { scheme: 'billing-memo', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
let window;
let openingExternal = false;
async function openExternal(value) {
  const url = externalUrl(value);
  if (!url || openingExternal || !window) return;
  openingExternal = true;
  try {
    const language = await window.webContents.executeJavaScript('document.documentElement.lang');
    const copy = {
      en: ['Open in your browser?', 'Cancel', 'Open link'],
      ko: ['기본 브라우저에서 열까요?', '취소', '링크 열기'],
      'zh-CN': ['在浏览器中打开？', '取消', '打开链接'],
      ja: ['ブラウザーで開きますか？', 'キャンセル', 'リンクを開く'],
      es: ['¿Abrir en el navegador?', 'Cancelar', 'Abrir enlace'],
    }[language] ?? ['Open in your browser?', 'Cancel', 'Open link'];
    const result = await dialog.showMessageBox(window, {
      type: 'question',
      title: 'Billing Memo',
      message: copy[0],
      detail: url,
      buttons: copy.slice(1),
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (result.response === 1) await shell.openExternal(url);
  } catch {
    /* No remote content is ever loaded into the app. */
  } finally {
    openingExternal = false;
  }
}
function createWindow() {
  window = new BrowserWindow({
    title: 'Billing Memo',
    width: 1440,
    height: 980,
    minWidth: 760,
    minHeight: 640,
    backgroundColor: '#f4f3ec',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(app.getAppPath(), 'desktop', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
      devTools: !app.isPackaged,
      spellcheck: false,
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    void openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!internalUrl(url) || !['/', '/index.html'].includes(new URL(url).pathname)) {
      event.preventDefault();
      void openExternal(url);
    }
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.webContents.on('will-redirect', (event) => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    window = null;
  });
  void window.loadURL(APP_URL);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    protocol.handle('billing-memo', async (request) => {
      const key = assetKey(request.url);
      if (!key || request.method !== 'GET') return new Response('Not found', { status: 404 });
      try {
        const bytes = await readFile(path.join(app.getAppPath(), 'dist', key));
        const type = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.svg': 'image/svg+xml',
        }[path.extname(key)];
        return new Response(bytes, {
          headers: {
            'Content-Type': type,
            'Content-Security-Policy': contentSecurityPolicy,
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-store',
          },
        });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    });
    const current = session.defaultSession;
    current.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    current.setPermissionCheckHandler(() => false);
    current.setDevicePermissionHandler(() => false);
    current.webRequest.onBeforeRequest((details, callback) =>
      callback({ cancel: !internalUrl(details.url) && !details.url.startsWith('blob:' + APP_URL) }),
    );
    // Native save dialog, restricted to the app's own generated backup/CSV/calendar files.
    current.on('will-download', (_event, item, contents) => {
      if (contents !== window?.webContents || !item.getURL().startsWith('blob:' + APP_URL)) {
        item.cancel();
        return;
      }
      const filename = path.basename(item.getFilename());
      if (!/^billing-memo-[a-zA-Z0-9-]+\.(json|csv|ics)$/.test(filename)) {
        item.cancel();
        return;
      }
      item.setSaveDialogOptions({
        title: 'Billing Memo — Save export',
        defaultPath: path.join(app.getPath('downloads'), filename),
      });
    });
    createWindow();
    app.on('activate', () => {
      if (!BrowserWindow.getAllWindows().length) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
