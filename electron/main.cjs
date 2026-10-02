const { app, BrowserWindow, protocol, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const APP_HOST = 'bundle';
const DEV_URL = 'http://localhost:4321';

// Window/taskbar icon: prefer the built asset (packaged app), fall back to
// public/ when running from source (astro dev serves dist/ only after build).
const WINDOW_ICON = [
  path.join(DIST_DIR, 'favicon.png'),
  path.join(__dirname, '..', 'public', 'favicon.png'),
].find((candidate) => fsSync.existsSync(candidate));

const isDev = !!process.env.ELECTRON_DEV;

// MUST be registered before app.ready so app:// behaves as a standard,
// secure, fetch-capable origin (module workers + IndexedDB + absolute paths).
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

// Required for crossOriginIsolated / SharedArrayBuffer (ONNX threaded WASM).
const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

function mimeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveAppFile(requestUrl) {
  const url = new URL(requestUrl);
  if (url.hostname !== APP_HOST) return null;

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (pathname === '/' || pathname === '') pathname = '/index.html';

  const root = path.normalize(DIST_DIR);
  const candidate = path.normalize(path.join(root, pathname));
  // Path traversal guard: resolved file must stay inside dist/.
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null;
  return candidate;
}

async function handleAppProtocol(request) {
  try {
    let filePath = resolveAppFile(request.url);
    if (!filePath) return new Response('Not Found', { status: 404 });

    let content;
    try {
      content = await fs.readFile(filePath);
    } catch (error) {
      if (error && (error.code === 'ENOENT' || error.code === 'EISDIR')) {
        // Extensionless misses fall back to the SPA entry point.
        if (path.extname(filePath) === '') {
          filePath = path.join(DIST_DIR, 'index.html');
          content = await fs.readFile(filePath);
        } else {
          return new Response('Not Found', { status: 404 });
        }
      } else {
        throw error;
      }
    }

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': mimeFor(filePath),
        'Cache-Control': 'no-cache',
        ...ISOLATION_HEADERS,
      },
    });
  } catch (error) {
    console.error('[app-protocol] failed to serve request:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#ffffff',
    icon: WINDOW_ICON,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isDev) {
      if (url.startsWith(DEV_URL)) return;
    } else if (url.startsWith('app://')) {
      return;
    }
    event.preventDefault();
  });

  if (isDev) {
    void mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadURL('app://bundle/index.html');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    protocol.handle('app', handleAppProtocol);
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
