const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, nativeImage } = require('electron');
const path = require('path');
const os   = require('os');
const fs   = require('fs');
const http  = require('http');
const https = require('https');
const { spawn } = require('child_process');

let mainWindow      = null;
let quickForgeWindow = null;
let tray            = null;
let questPollInterval = null;
let lastKnownQuestCount = -1;
let appConfig = { server: '', apiKey: '' };

// ─── Tray icon (16×16 orange circle drawn into raw RGBA bitmap) ──────────────
function createTrayIcon() {
  const size = 16;
  const buf  = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i  = (y * size + x) * 4;
      const cx = 7.5, cy = 7.5, r = 6.5;
      if (Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) <= r) {
        buf[i] = 255; buf[i+1] = 100; buf[i+2] = 0; buf[i+3] = 255;
      } else {
        buf[i+3] = 0;
      }
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

// ─── Main window ─────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 720,
    minWidth: 360,
    minHeight: 540,
    resizable: true,
    title: 'Quest Forge',
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.setMenuBarVisibility(false);

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ─── Quick-Forge popup ────────────────────────────────────────────────────────
function createQuickForgeWindow() {
  if (quickForgeWindow && !quickForgeWindow.isDestroyed()) {
    quickForgeWindow.show();
    quickForgeWindow.focus();
    return;
  }

  quickForgeWindow = new BrowserWindow({
    width: 380,
    height: 500,
    resizable: false,
    title: 'Quick Forge',
    backgroundColor: '#1a1a1a',
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  quickForgeWindow.loadFile(path.join(__dirname, 'quick-forge.html'));
  quickForgeWindow.setMenuBarVisibility(false);

  quickForgeWindow.on('closed', () => { quickForgeWindow = null; });
}

// ─── System Tray ─────────────────────────────────────────────────────────────
function setupTray() {
  try {
    const icon = createTrayIcon();
    tray = new Tray(icon);
    tray.setToolTip('Quest Forge — The Guild');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Quest Forge',
        click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } },
      },
      {
        label: '⚒ Quick Forge',
        click: () => createQuickForgeWindow(),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => { app.isQuitting = true; app.quit(); },
      },
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) mainWindow.hide();
        else { mainWindow.show(); mainWindow.focus(); }
      }
    });

    tray.on('double-click', () => {
      if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    });
  } catch (err) {
    console.warn('[tray] Failed to create tray:', err.message);
  }
}

// ─── Quest polling (notifications for new quests) ────────────────────────────
function getQuestCount(serverBase) {
  return new Promise((resolve, reject) => {
    const mod = serverBase.startsWith('https') ? https : http;
    const req = mod.get(`${serverBase}/api/quests`, { headers: {} }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve((json.open || []).length + (json.suggested || []).length);
        } catch (_) { reject(new Error('parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function startQuestPolling() {
  questPollInterval = setInterval(async () => {
    const server = appConfig.server;
    if (!server) return;
    try {
      const count = await getQuestCount(server);
      if (lastKnownQuestCount >= 0 && count > lastKnownQuestCount) {
        const n = count - lastKnownQuestCount;
        if (Notification.isSupported()) {
          new Notification({
            title: 'Quest Forge',
            body: `${n} new quest${n !== 1 ? 's' : ''} available!`,
          }).show();
        }
      }
      lastKnownQuestCount = count;
    } catch (_) { /* server offline, ignore */ }
  }, 60_000);
}

// ─── IPC ─────────────────────────────────────────────────────────────────────
ipcMain.handle('perform-update', async (event, newExePath) => {
  const currentExe = process.execPath;
  const exeName    = path.basename(currentExe);
  const batPath    = path.join(os.tmpdir(), 'quest-forge-update.bat');

  const bat = [
    '@echo off',
    'timeout /t 3 /nobreak >nul',
    `taskkill /F /IM "${exeName}" >nul 2>&1`,
    'timeout /t 1 /nobreak >nul',
    `copy /Y "${newExePath}" "${currentExe}"`,
    `if errorlevel 1 (`,
    `  echo Copy failed, retrying...`,
    `  timeout /t 2 /nobreak >nul`,
    `  copy /Y "${newExePath}" "${currentExe}"`,
    `)`,
    `start "" "${currentExe}"`,
    `del "${newExePath}" >nul 2>&1`,
    'del "%~f0"',
  ].join('\r\n');

  fs.writeFileSync(batPath, bat, 'utf8');
  spawn('cmd.exe', ['/c', batPath], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  app.exit(0);
  return true;
});

// Renderer sends config so we can poll quests
ipcMain.handle('set-config', (event, config) => {
  if (config && config.server) appConfig.server = config.server;
  if (config && config.apiKey) appConfig.apiKey  = config.apiKey;
});

// Renderer notifies of a newly created quest (avoids false notification)
ipcMain.handle('quest-created', () => {
  if (lastKnownQuestCount >= 0) lastKnownQuestCount++;
});

// Open quick-forge from renderer
ipcMain.handle('open-quick-forge', () => {
  createQuickForgeWindow();
});

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  setupTray();
  startQuestPolling();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && app.isQuitting) app.quit();
});

app.on('activate', () => {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (questPollInterval) clearInterval(questPollInterval);
});
