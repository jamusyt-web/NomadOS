/**
 * VAN CONTROL HUB — Electron Main Process
 * =========================================
 * Creates the fullscreen kiosk window, manages Arduino serial
 * communication, and bridges data to the renderer via IPC.
 *
 * On Raspberry Pi, run: electron /path/to/van-electron
 */

import { app, BrowserWindow, ipcMain, powerSaveBlocker } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';

// ── Pi backlight path ────────────────────────────────────────────────────────
const BACKLIGHT_PATH = '/sys/class/backlight/rpi_backlight/brightness';
const BACKLIGHT_FULL = 200;

function setBacklight(level) {
  try {
    if (fs.existsSync(BACKLIGHT_PATH)) {
      fs.writeFileSync(BACKLIGHT_PATH, String(Math.max(0, Math.min(255, level))));
    }
  } catch {
    // Not on a Pi or no permission — silently ignore
  }
}

// ── IR Button Storage ─────────────────────────────────────────────────────────
const IR_FILE = path.join(os.homedir(), 'van-control-ir.json');

function readIRButtons() {
  try {
    if (fs.existsSync(IR_FILE)) {
      const raw = fs.readFileSync(IR_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[ir] Failed to read IR buttons:', err.message);
  }
  return [];
}

function writeIRButtons(buttons) {
  try {
    fs.writeFileSync(IR_FILE, JSON.stringify(buttons, null, 2), 'utf8');
  } catch (err) {
    console.error('[ir] Failed to write IR buttons:', err.message);
  }
}

// ── Serial port ──────────────────────────────────────────────────────────────
let serialPort = null;
let mainWindow = null;
let serialRetryTimeout = null;

async function initSerial() {
  // Dynamic import to handle cases where serialport isn't rebuilt yet
  let SerialPort, ReadlineParser;
  try {
    const sp = await import('serialport');
    SerialPort = sp.SerialPort;
    const parsers = await import('@serialport/parser-readline');
    ReadlineParser = parsers.ReadlineParser;
  } catch (err) {
    console.warn('[serial] serialport module not available:', err.message);
    notifyRenderer('van:status', { connected: false, error: 'serial module unavailable' });
    return;
  }

  // Auto-detect Arduino/ESP-32 port
  const candidates = ['/dev/ttyACM0', '/dev/ttyACM1', '/dev/ttyUSB0', '/dev/ttyUSB1'];
  let portPath = null;

  for (const p of candidates) {
    if (fs.existsSync(p)) { portPath = p; break; }
  }

  if (!portPath) {
    // Try listing all ports
    try {
      const ports = await SerialPort.list();
      const device = ports.find(p =>
        p.manufacturer?.toLowerCase().includes('arduino') ||
        p.manufacturer?.toLowerCase().includes('elegoo') ||
        p.manufacturer?.toLowerCase().includes('espressif') ||
        p.vendorId === '2341' || // Arduino official
        p.vendorId === '1a86' || // CH340 (common on ELEGOO/ESP-32 clones)
        p.vendorId === '10c4'    // CP2102 (ESP-32)
      );
      if (device) portPath = device.path;
    } catch { /* ignore */ }
  }

  if (!portPath) {
    console.warn('[serial] No device found. Retrying in 5s...');
    notifyRenderer('van:status', { connected: false, error: 'no serial port' });
    serialRetryTimeout = setTimeout(initSerial, 5000);
    return;
  }

  console.log(`[serial] Connecting to ${portPath} @ 115200`);

  try {
    serialPort = new SerialPort({ path: portPath, baudRate: 115200 });
    const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

    serialPort.on('open', () => {
      console.log('[serial] Connected to device');
      notifyRenderer('van:status', { connected: true, port: portPath });
    });

    parser.on('data', (line) => {
      line = line.trim();
      if (!line.startsWith('{')) return;
      try {
        const data = JSON.parse(line);

        // Route one-shot events (IR learned, IR failed, etc.) to van:event
        if (data.event) {
          notifyRenderer('van:event', data);
        } else {
          // Regular telemetry
          notifyRenderer('van:telemetry', { ...data, connected: true, ts: Date.now() });
        }
      } catch { /* ignore parse errors */ }
    });

    serialPort.on('error', (err) => {
      console.error('[serial] Error:', err.message);
      notifyRenderer('van:status', { connected: false, error: err.message });
      serialPort = null;
      serialRetryTimeout = setTimeout(initSerial, 5000);
    });

    serialPort.on('close', () => {
      console.warn('[serial] Port closed. Retrying in 5s...');
      notifyRenderer('van:status', { connected: false, error: 'port closed' });
      serialPort = null;
      serialRetryTimeout = setTimeout(initSerial, 5000);
    });

  } catch (err) {
    console.error('[serial] Failed to open port:', err.message);
    notifyRenderer('van:status', { connected: false, error: err.message });
    serialRetryTimeout = setTimeout(initSerial, 5000);
  }
}

function sendToDevice(cmd) {
  if (serialPort?.isOpen) {
    serialPort.write(JSON.stringify(cmd) + '\n', (err) => {
      if (err) console.error('[serial] Write error:', err.message);
    });
  } else {
    console.warn('[serial] Cannot send — port not open:', cmd);
  }
}

function notifyRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ── IPC handlers (renderer → main) ──────────────────────────────────────────
ipcMain.on('van:command', (_event, cmd) => {
  sendToDevice(cmd);
});

ipcMain.on('van:backlight', (_event, level) => {
  setBacklight(level);
});

// IR button persistence
ipcMain.handle('van:ir:read', () => {
  return readIRButtons();
});

ipcMain.on('van:ir:write', (_event, buttons) => {
  writeIRButtons(buttons);
});

// ── Window creation ──────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    // Fullscreen kiosk — no chrome, no title bar, no frame
    fullscreen: true,
    kiosk: true,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#08080F',

    // Touch / display
    autoHideMenuBar: true,
    resizable: false,

    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,   // Security: renderer cannot access Node.js
      nodeIntegration: false,
      sandbox: false,            // Needed for preload to work without sandbox
    },
  });

  // Remove menu bar entirely
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);

  // Load the UI
  if (isDev) {
    // Dev mode: load from Vite dev server
    const devPort = process.env.PORT || '21377';
    mainWindow.loadURL(`http://localhost:${devPort}/`);
    // Uncomment to open DevTools during development:
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production mode: load built static files
    const uiPath = path.join(__dirname, '..', 'van-control', 'dist', 'public', 'index.html');
    mainWindow.loadFile(uiPath);
  }

  // Prevent navigation away from the app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsed = new URL(url);
    // Allow local file:// and localhost, block everything else
    if (parsed.protocol !== 'file:' && parsed.hostname !== 'localhost') {
      event.preventDefault();
    }
  });

  // Prevent new windows from opening
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Prevent system from sleeping (van electrical monitoring should always run)
  powerSaveBlocker.start('prevent-display-sleep');

  setBacklight(BACKLIGHT_FULL);
  createWindow();
  initSerial();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serialRetryTimeout) clearTimeout(serialRetryTimeout);
  serialPort?.close();
  // On non-macOS, quit when all windows are closed
  if (process.platform !== 'darwin') app.quit();
});

// Prevent Electron from quitting on Escape key in kiosk mode
app.on('before-quit', (event) => {
  // In production on Pi, don't allow quitting via keyboard
  if (!isDev && process.platform === 'linux') {
    event.preventDefault();
  }
});
