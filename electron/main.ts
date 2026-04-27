import { app, BrowserWindow, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { AddressInfo } from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Dev mode opt-in via env var. Packaged apps always run in prod mode.
const isDev = !app.isPackaged && process.env.JOBDASH_DEV === '1';

// Steer the backend's SQLite + uploads into Electron's per-user data dir
// before anything in the backend (which calls `mkdirSync` at import time) runs.
process.env.DATABASE_PATH = join(app.getPath('userData'), 'jobdash.db');

async function startBackend(): Promise<number> {
  // Resolve the compiled backend relative to this file. In dev (`tsx`) and in
  // production both map to `<repo>/backend/dist/app.js`.
  const backendUrl = pathToFileURL(join(__dirname, '..', '..', 'backend', 'dist', 'app.js'));
  // Loose typing — we don't depend on express types from inside the electron package.
  interface BackendModule {
    createApp: () => {
      listen: (port: number, host: string, cb: () => void) => import('node:http').Server;
    };
    startCron: () => void;
  }
  const { createApp, startCron } = (await import(backendUrl.href)) as BackendModule;

  const expressApp = createApp();
  startCron();

  return await new Promise<number>((resolve, reject) => {
    const server = expressApp.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo | null;
      if (addr) resolve(addr.port);
      else reject(new Error('failed to bind backend port'));
    });
  });
}

async function createWindow(port: number): Promise<void> {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'jobdash',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Open external links in the system browser instead of replacing the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    // Frontend served by `ng serve` on :4200 (`npm run dev:frontend`).
    await win.loadURL(`http://localhost:4200/?apiPort=${port}`);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexFile = join(__dirname, '..', '..', 'frontend', 'dist', 'frontend', 'browser', 'index.html');
    await win.loadFile(indexFile, { query: { apiPort: String(port) } });
  }
}

app.whenReady().then(async () => {
  const port = await startBackend();
  console.log(`[electron] backend bound to 127.0.0.1:${port}`);
  await createWindow(port);

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow(port);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
