import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron';
import * as path from 'path';
import { getConfig, saveConfig, Config } from './config';
const { AgentLifecycle } = require('../shared/lifecycle');

// ─── State ───────────────────────────────────────────────────────────────────

let tray: Tray | null = null;
let settingsWindow: BrowserWindow | null = null;

let isOnline = false;
let lastCheckin: Date | null = null;
let lifecycle: any = null;

// ─── Single Instance Lock ───────────────────────────────────────────────────

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (settingsWindow) {
      if (settingsWindow.isMinimized()) settingsWindow.restore();
      settingsWindow.focus();
    }
  });
}

// ─── Icon Creation ──────────────────────────────────────────────────────────

function createTrayIcon(): Electron.NativeImage {
  // Try loading icon from assets folder first
  const iconPaths = [
    path.join(__dirname, '..', 'assets', 'icon.ico'),
    path.join(__dirname, '..', 'assets', 'icon.png'),
    path.join(__dirname, '..', '..', 'assets', 'icon.ico'),
    path.join(__dirname, '..', '..', 'assets', 'icon.png'),
  ];

  for (const iconPath of iconPaths) {
    try {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) {
        return img.resize({ width: 16, height: 16 }) as Electron.NativeImage;
      }
    } catch {
      // Try next path
    }
  }

  // Fallback: create a simple blue square icon programmatically
  const size = 32;
  const canvas = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * size + x) * 4;

      if (dist <= r) {
        // Brand blue color (#1E40AF)
        canvas[idx] = 30;      // R
        canvas[idx + 1] = 64;  // G
        canvas[idx + 2] = 175; // B
        canvas[idx + 3] = 255; // A
      } else {
        canvas[idx] = 0;
        canvas[idx + 1] = 0;
        canvas[idx + 2] = 0;
        canvas[idx + 3] = 0;
      }
    }
  }

  // Create a PNG from raw RGBA data using a minimal PNG encoder
  const pngBuffer = createPNGBuffer(canvas, size, size);
  const img = nativeImage.createFromBuffer(pngBuffer, { width: size, height: size });
  return img.resize({ width: 16, height: 16 }) as Electron.NativeImage;
}

function createPNGBuffer(rgbaData: Buffer, width: number, height: number): Buffer {
  // Minimal PNG encoder (no external dependencies)
  const zlib = require('zlib');

  // Build raw IDAT data (filter byte + RGB for each row)
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const srcOffset = (y * width + x) * 4;
      const dstOffset = rowOffset + 1 + x * 4;
      rawData[dstOffset] = rgbaData[srcOffset];       // R
      rawData[dstOffset + 1] = rgbaData[srcOffset + 1]; // G
      rawData[dstOffset + 2] = rgbaData[srcOffset + 2]; // B
      rawData[dstOffset + 3] = rgbaData[srcOffset + 3]; // A
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // Build PNG structure
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createPNGChunk('IHDR', ihdrData);

  // IDAT chunk
  const idatChunk = createPNGChunk('IDAT', deflated);

  // IEND chunk
  const iendChunk = createPNGChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createPNGChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(data: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── Tray Setup ─────────────────────────────────────────────────────────────

function setupTray(): void {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Resolv Agent - Starting...');

  updateTrayMenu();

  tray.on('double-click', () => {
    openSettingsWindow();
  });
}

function updateTrayMenu(): void {
  if (!tray) return;

  const statusText = isOnline ? 'Online' : 'Offline';
  const lastCheckinText = lastCheckin
    ? `Last check-in: ${lastCheckin.toLocaleTimeString()}`
    : 'Not yet checked in';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Resolv Agent',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: `Status: ${statusText}`,
      enabled: false,
    },
    {
      label: lastCheckinText,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Open Settings',
      click: () => openSettingsWindow(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip(`Resolv Agent - ${statusText}`);
}

// ─── Settings Window ────────────────────────────────────────────────────────

function openSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 500,
    resizable: false,
    frame: true,
    autoHideMenuBar: true,
    title: 'Resolv Agent Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// ─── IPC Handlers ───────────────────────────────────────────────────────────

function setupIPC(): void {
  ipcMain.handle('get-config', () => {
    return getConfig();
  });

  ipcMain.handle('save-config', (_event, partial: Partial<Config>) => {
    const updated = saveConfig(partial);
    // If settings changed, restart agent lifecycles
    if (partial.apiUrl !== undefined || partial.agentSecret !== undefined || partial.checkinIntervalMs !== undefined) {
      restartAgentLifecycle();
    }
    return updated;
  });

  ipcMain.handle('get-status', () => {
    return {
      isOnline,
      lastCheckin: lastCheckin?.toISOString() || null,
      config: getConfig(),
    };
  });

  ipcMain.handle('force-checkin', async () => {
    await lifecycle?.forceCheckin();
    broadcastStatus();
    return { ok: true };
  });

}

function broadcastStatus(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('status-update', {
      isOnline,
      lastCheckin: lastCheckin?.toISOString() || null,
    });
  }
  updateTrayMenu();
}

// ─── Agent Lifecycle (via shared library) ──────────────────────────────────────

function createLifecycle(): any {
  const config = getConfig();
  return new AgentLifecycle({
    serverUrl: config.apiUrl,
    agentSecret: config.agentSecret,
    agentVersion: '1.0.0',
    checkinIntervalMs: config.checkinIntervalMs,
    heartbeatIntervalMs: config.heartbeatIntervalMs,
    getConfig: () => {
      const cfg = getConfig();
      return { assetId: cfg.assetId || null, agentToken: cfg.agentToken || null };
    },
    saveConfig: (partial: any) => {
      saveConfig(partial);
    },
    onStatusChange: (status: any) => {
      isOnline = status.isOnline;
      if (status.lastCheckin) lastCheckin = status.lastCheckin;
      broadcastStatus();
    },
    log: (msg: string) => {
      console.log('[Agent]', msg);
    },
  });
}

function restartAgentLifecycle(): void {
  if (lifecycle) {
    lifecycle.stop().then(() => {
      lifecycle = createLifecycle();
      lifecycle.start().catch((err: Error) => console.error('Lifecycle start failed:', err.message));
    }).catch((err: Error) => console.error('Lifecycle stop failed:', err.message));
  } else {
    lifecycle = createLifecycle();
    lifecycle.start().catch((err: Error) => console.error('Lifecycle start failed:', err.message));
  }
}

// ─── App Event Handlers ─────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Enable auto-start on Windows
  if (process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: true,
    });
  }

  setupIPC();
  setupTray();
  restartAgentLifecycle();
});

app.on('before-quit', async (event) => {
  event.preventDefault();
  if (lifecycle) {
    await lifecycle.stop();
    lifecycle = null;
  }
  app.exit(0);
});

app.on('window-all-closed', () => {
  // On Windows, we keep the app running in the tray
  // Only quit if explicitly told to
});

app.on('activate', () => {
  openSettingsWindow();
});
