const { app, BrowserWindow, protocol, shell, screen, ipcMain, dialog } = require('electron');
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

// Persisted window bounds live next to the app's other user data. The file is
// absent on the very first launch, which is how we detect "first run".
function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
  try {
    const raw = fsSync.readFileSync(getWindowStatePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      Number.isFinite(parsed.width) &&
      Number.isFinite(parsed.height) &&
      parsed.width > 0 &&
      parsed.height > 0
    ) {
      return parsed;
    }
  } catch {
    // Missing file (first launch) or unreadable content — fall back to default.
  }
  return null;
}

function isWithinAnyDisplay(bounds) {
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return (
      bounds.x < area.x + area.width &&
      bounds.x + bounds.width > area.x &&
      bounds.y < area.y + area.height &&
      bounds.y + bounds.height > area.y
    );
  });
}

function persistWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // getNormalBounds() ignores the fullscreen/maximized state, so we always
  // remember the windowed size the user actually chose.
  const bounds = mainWindow.getNormalBounds();
  const state = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    isMaximized: mainWindow.isMaximized(),
  };
  try {
    fsSync.writeFileSync(getWindowStatePath(), JSON.stringify(state));
  } catch (error) {
    console.error('[window-state] failed to persist:', error);
  }
}

let saveWindowStateTimer = null;

function scheduleWindowStateSave() {
  if (saveWindowStateTimer) clearTimeout(saveWindowStateTimer);
  saveWindowStateTimer = setTimeout(() => {
    saveWindowStateTimer = null;
    persistWindowState();
  }, 400);
}

function createWindow() {
  const savedState = loadWindowState();
  // First launch (no saved state) opens maximized. Maximizing keeps the native
  // frame (title bar + window controls) visible, unlike fullscreen which hides it.
  const startMaximized = savedState ? !!savedState.isMaximized : true;

  const windowOptions = {
    width: savedState ? savedState.width : 1280,
    height: savedState ? savedState.height : 860,
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
      preload: path.join(__dirname, 'preload.cjs'),
    },
  };

  if (savedState && Number.isFinite(savedState.x) && Number.isFinite(savedState.y)) {
    // Restore the previous session's position when it is still visible.
    const restored = {
      x: savedState.x,
      y: savedState.y,
      width: savedState.width,
      height: savedState.height,
    };
    if (isWithinAnyDisplay(restored)) {
      windowOptions.x = savedState.x;
      windowOptions.y = savedState.y;
    }
  }

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow) return;
    mainWindow.show();
    if (startMaximized) mainWindow.maximize();
  });

  mainWindow.on('resize', scheduleWindowStateSave);
  mainWindow.on('move', scheduleWindowStateSave);
  mainWindow.on('close', () => {
    if (saveWindowStateTimer) {
      clearTimeout(saveWindowStateTimer);
      saveWindowStateTimer = null;
    }
    persistWindowState();
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

ipcMain.handle('batch-save-images', async (event, payload) => {
  const files = Array.isArray(payload?.files) ? payload.files : [];
  if (files.length === 0) return { canceled: false, saved: 0 };

  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined, {
    title:
      typeof payload?.title === 'string' && payload.title ? payload.title : 'Save images to folder',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (canceled || !filePaths || filePaths.length === 0) {
    return { canceled: true, saved: 0 };
  }

  const dir = filePaths[0];
  let saved = 0;
  try {
    for (const file of files) {
      if (!file || typeof file.filename !== 'string' || !file.bytes) continue;
      const safeName = path.basename(file.filename);
      await fs.writeFile(path.join(dir, safeName), Buffer.from(file.bytes));
      saved += 1;
    }
    return { canceled: false, saved };
  } catch (error) {
    console.error('[batch-save-images] failed:', error);
    return {
      canceled: false,
      saved,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

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
