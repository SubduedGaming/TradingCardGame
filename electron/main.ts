import { app, BrowserWindow, clipboard, ipcMain, Menu, nativeImage, Notification, shell, Tray, utilityProcess, type UtilityProcess } from 'electron';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

/**
 * Desktop host for the Front Line server. It runs the game server as a child process, keeps it alive,
 * shows a control window (start/stop, settings, the admin console) and lives in the system tray.
 */

interface Settings {
  port: number;
  /** Listen on the network so other devices can connect (otherwise only this computer). */
  lan: boolean;
  startWithWindows: boolean;
  autoStartServer: boolean;
  adminToken: string;
  dataDir: string;
}

type Status = 'stopped' | 'starting' | 'running' | 'stopping' | 'failed';

const userData = app.getPath('userData');
const settingsFile = join(userData, 'settings.json');
const logsDir = join(userData, 'logs');
const logFile = join(logsDir, 'server.log');
const packaged = app.isPackaged;
const serverFile = packaged ? join(process.resourcesPath, 'server', 'main.cjs') : join(app.getAppPath(), 'dist-server', 'main.cjs');
const clientDir = packaged ? join(process.resourcesPath, 'client') : join(app.getAppPath(), 'dist');
const iconFile = packaged ? join(process.resourcesPath, 'icon.png') : join(app.getAppPath(), 'build', 'icon.png');

function loadSettings(): Settings {
  const defaults: Settings = {
    port: 3000,
    lan: true,
    startWithWindows: false,
    autoStartServer: true,
    adminToken: randomBytes(18).toString('hex'),
    dataDir: join(userData, 'data'),
  };
  let saved: Partial<Settings> = {};
  try {
    saved = JSON.parse(readFileSync(settingsFile, 'utf8')) as Partial<Settings>;
  } catch {
    /* first run */
  }
  const s = { ...defaults, ...saved };
  if (!saved.adminToken) writeSettings(s);
  return s;
}

function writeSettings(s: Settings): void {
  mkdirSync(userData, { recursive: true });
  writeFileSync(settingsFile, JSON.stringify(s, null, 2));
}

let settings: Settings;
let status: Status = 'stopped';
let child: UtilityProcess | null = null;
let lastProblem = '';
let wantRunning = false;
let restarts = 0;
let upSince = 0;
let healthTimer: NodeJS.Timeout | undefined;
let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
const recent: string[] = [];

// ------------------------------------------------------------------ logging

function log(line: string): void {
  const text = line.replace(/\r?\n$/, '');
  if (!text) return;
  recent.push(text);
  if (recent.length > 400) recent.shift();
  try {
    mkdirSync(logsDir, { recursive: true });
    if (existsSync(logFile) && statSync(logFile).size > 5_000_000) renameSync(logFile, join(logsDir, 'server.old.log'));
    appendFileSync(logFile, text + '\n');
  } catch {
    /* logging must never break the app */
  }
}

// ------------------------------------------------------------------ server process

function setStatus(next: Status): void {
  status = next;
  refreshTray();
  win?.webContents.send('state-changed');
}

function addresses(): string[] {
  const out = [`http://localhost:${settings.port}`];
  if (settings.lan) {
    for (const list of Object.values(networkInterfaces())) {
      for (const i of list ?? []) if (i.family === 'IPv4' && !i.internal) out.push(`http://${i.address}:${settings.port}`);
    }
  }
  return out;
}

async function healthy(): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${settings.port}/api/health`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

function startServer(): void {
  if (child || status === 'stopping') return;
  wantRunning = true;
  lastProblem = '';
  if (!existsSync(serverFile)) {
    lastProblem = `Server files are missing (${serverFile}). Reinstall the app.`;
    setStatus('failed');
    return;
  }
  mkdirSync(settings.dataDir, { recursive: true });
  setStatus('starting');
  log(`--- starting server on port ${settings.port} (${new Date().toISOString()})`);
  const proc = utilityProcess.fork(serverFile, [], {
    serviceName: 'Front Line server',
    stdio: 'pipe',
    env: {
      ...process.env,
      PORT: String(settings.port),
      HOST: settings.lan ? '0.0.0.0' : '127.0.0.1',
      DB_PATH: join(settings.dataDir, 'frontline.db'),
      STATIC_DIR: clientDir,
      ADMIN_TOKEN: settings.adminToken,
      LOG_LEVEL: 'info',
    },
  });
  child = proc;
  const onData = (d: Buffer) => {
    for (const line of d.toString('utf8').split('\n')) {
      log(line);
      try {
        const o = JSON.parse(line) as { level?: string; msg?: string; error?: string };
        if (o.level === 'error') lastProblem = [o.msg, o.error].filter(Boolean).join(': ');
      } catch {
        if (line.trim()) lastProblem = line.trim();
      }
    }
  };
  proc.stdout?.on('data', onData);
  proc.stderr?.on('data', onData);
  proc.on('exit', (code) => {
    if (child !== proc) return;
    child = null;
    clearInterval(healthTimer);
    const expected = !wantRunning || quitting;
    log(`--- server exited with code ${code}`);
    if (expected) {
      setStatus('stopped');
      return;
    }
    if (Date.now() - upSince > 60_000) restarts = 0;
    restarts += 1;
    if (/EADDRINUSE/.test(lastProblem)) lastProblem = `Port ${settings.port} is already used by another program. Pick another port in Settings.`;
    if (restarts > 3) {
      wantRunning = false;
      lastProblem = lastProblem || `The server stopped repeatedly (exit code ${code}).`;
      setStatus('failed');
      notify('Server stopped', lastProblem);
      return;
    }
    setStatus('starting');
    setTimeout(() => {
      if (wantRunning && !child) startServer();
    }, 2000 * restarts);
  });
  clearInterval(healthTimer);
  healthTimer = setInterval(() => {
    void healthy().then((ok) => {
      if (!child) return;
      if (ok && status === 'starting') {
        upSince = Date.now();
        setStatus('running');
      } else if (!ok && status === 'running') setStatus('starting');
    });
  }, 1500);
}

function stopServer(): Promise<void> {
  wantRunning = false;
  const proc = child;
  if (!proc) {
    setStatus('stopped');
    return Promise.resolve();
  }
  setStatus('stopping');
  return new Promise((resolve) => {
    const kill = setTimeout(() => proc.kill(), 6000);
    proc.once('exit', () => {
      clearTimeout(kill);
      resolve();
    });
    proc.postMessage('stop');
  });
}

async function restartServer(): Promise<void> {
  await stopServer();
  restarts = 0;
  startServer();
}

// ------------------------------------------------------------------ windows and tray

function notify(title: string, body: string): void {
  if (Notification.isSupported()) new Notification({ title, body }).show();
}

function showWindow(): void {
  if (!win) createWindow();
  if (win?.isMinimized()) win.restore();
  win?.show();
  win?.focus();
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 760,
    minHeight: 560,
    title: 'Front Line Server',
    icon: nativeImage.createFromPath(iconFile),
    backgroundColor: '#14170f',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setMenuBarVisibility(false);
  void win.loadFile(join(__dirname, 'control.html'));
  win.once('ready-to-show', () => {
    if (!process.argv.includes('--hidden')) win?.show();
  });
  // Closing the window keeps the server running in the tray.
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win?.hide();
    notify('Front Line Server is still running', 'It is in the system tray. Right-click the icon to open or quit.');
  });
  win.on('closed', () => {
    win = null;
  });
}

const STATUS_TEXT: Record<Status, string> = {
  stopped: 'Server is stopped',
  starting: 'Server is starting…',
  running: 'Server is running',
  stopping: 'Server is stopping…',
  failed: 'Server has a problem',
};

function refreshTray(): void {
  if (!tray) return;
  tray.setToolTip(`Front Line Server — ${STATUS_TEXT[status]}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: STATUS_TEXT[status], enabled: false },
      { type: 'separator' },
      { label: 'Open control window', click: showWindow },
      { label: 'Play in browser', enabled: status === 'running', click: () => void shell.openExternal(`http://localhost:${settings.port}`) },
      { type: 'separator' },
      { label: 'Start server', enabled: status === 'stopped' || status === 'failed', click: () => startServer() },
      { label: 'Stop server', enabled: status === 'running' || status === 'starting', click: () => void stopServer() },
      { label: 'Restart server', enabled: status === 'running' || status === 'failed', click: () => void restartServer() },
      { type: 'separator' },
      { label: 'Quit (stops the server)', click: () => app.quit() },
    ]),
  );
}

// ------------------------------------------------------------------ messages from the control window

function snapshot() {
  return {
    status,
    statusText: STATUS_TEXT[status],
    problem: status === 'failed' || status === 'starting' ? lastProblem : '',
    settings,
    addresses: addresses(),
    adminUrl: `http://127.0.0.1:${settings.port}/admin#token=${settings.adminToken}`,
    platform: process.platform,
    version: app.getVersion(),
    logFile,
    firstRun: !existsSync(join(settings.dataDir, 'frontline.db')),
  };
}

function validate(p: Partial<Settings>): string | null {
  if (p.port !== undefined && (!Number.isInteger(p.port) || p.port < 1 || p.port > 65535)) return 'The port must be a number from 1 to 65535.';
  if (p.adminToken !== undefined && p.adminToken.length < 8) return 'The admin token needs at least 8 characters.';
  return null;
}

function registerIpc(): void {
  ipcMain.handle('state', () => snapshot());
  ipcMain.handle('start', () => startServer());
  ipcMain.handle('stop', () => stopServer());
  ipcMain.handle('restart', () => restartServer());
  ipcMain.handle('save-settings', async (_e, patch: Partial<Settings>) => {
    const problem = validate(patch);
    if (problem) return { ok: false, error: problem };
    const before = settings;
    settings = { ...settings, ...patch, port: patch.port ?? settings.port };
    writeSettings(settings);
    if (patch.startWithWindows !== undefined && process.platform !== 'linux') {
      app.setLoginItemSettings({ openAtLogin: settings.startWithWindows, args: ['--hidden'] });
    }
    const needsRestart = before.port !== settings.port || before.lan !== settings.lan || before.dataDir !== settings.dataDir || before.adminToken !== settings.adminToken;
    if (needsRestart && (status === 'running' || status === 'starting')) await restartServer();
    win?.webContents.send('state-changed');
    return { ok: true, restarted: needsRestart };
  });
  ipcMain.handle('open-game', () => shell.openExternal(`http://localhost:${settings.port}`));
  ipcMain.handle('open-folder', (_e, which: 'data' | 'logs' | 'backups') => {
    const dir = which === 'data' ? settings.dataDir : which === 'logs' ? logsDir : join(settings.dataDir, 'backups');
    mkdirSync(dir, { recursive: true });
    return shell.openPath(dir);
  });
  ipcMain.handle('copy', (_e, text: string) => clipboard.writeText(String(text)));
  ipcMain.handle('logs', () => recent.slice(-200));
  ipcMain.handle('firewall', () => {
    if (process.platform !== 'win32') return { ok: false, error: 'This only applies to Windows.' };
    const rule = `netsh advfirewall firewall add rule name="Front Line Server" dir=in action=allow protocol=TCP localport=${settings.port}`;
    const ps = `Start-Process -FilePath cmd.exe -ArgumentList '/c ${rule}' -Verb RunAs -Wait`;
    return new Promise((resolve) => {
      execFile('powershell.exe', ['-NoProfile', '-Command', ps], (err) => {
        resolve(err ? { ok: false, error: 'Windows did not allow the change (the permission prompt was declined).' } : { ok: true });
      });
    });
  });
}

// ------------------------------------------------------------------ app lifecycle

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('before-quit', (e) => {
    if (quitting) return;
    quitting = true;
    if (child) {
      e.preventDefault();
      void stopServer().finally(() => app.quit());
    }
  });
  app.on('window-all-closed', () => {
    /* stay alive in the tray */
  });

  void app.whenReady().then(() => {
    settings = loadSettings();
    registerIpc();
    const img = nativeImage.createFromPath(iconFile);
    tray = new Tray(img.isEmpty() ? img : img.resize({ width: 16, height: 16 }));
    tray.on('click', showWindow);
    tray.on('double-click', showWindow);
    refreshTray();
    createWindow();
    if (settings.autoStartServer) startServer();
  });
}
