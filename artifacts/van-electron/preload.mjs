/**
 * VAN CONTROL HUB — Electron Preload Script
 * ===========================================
 * Runs in a privileged context with access to Node.js APIs,
 * but exposes only a safe, typed API to the renderer (React app)
 * via contextBridge. This keeps the renderer sandboxed.
 */

import { contextBridge, ipcRenderer } from 'electron';

/** @type {import('electron').ElectronAPI} */
const vanAPI = {
  /**
   * Subscribe to live telemetry from the connected device (Arduino/ESP-32).
   * Called ~1x per second with battery, solar, lights, etc.
   * @param {(data: object) => void} callback
   * @returns {() => void} unsubscribe function
   */
  onTelemetry(callback) {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('van:telemetry', handler);
    return () => ipcRenderer.removeListener('van:telemetry', handler);
  },

  /**
   * Subscribe to connection status updates.
   * { connected: boolean, port?: string, error?: string }
   * @param {(status: object) => void} callback
   * @returns {() => void} unsubscribe function
   */
  onStatus(callback) {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('van:status', handler);
    return () => ipcRenderer.removeListener('van:status', handler);
  },

  /**
   * Subscribe to one-shot device events (IR learned, IR failed, etc.)
   * { event: string, data?: any, reason?: string }
   * @param {(event: object) => void} callback
   * @returns {() => void} unsubscribe function
   */
  onEvent(callback) {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('van:event', handler);
    return () => ipcRenderer.removeListener('van:event', handler);
  },

  /**
   * Send a control command to the connected device.
   * e.g. { cmd: 'setState', on: true, brightness: 80, r: 255, g: 200, b: 100 }
   * e.g. { cmd: 'learnIR' }
   * e.g. { cmd: 'sendIR', data: [...] }
   * @param {object} cmd
   */
  sendCommand(cmd) {
    ipcRenderer.send('van:command', cmd);
  },

  /**
   * Set the Raspberry Pi display backlight brightness.
   * @param {number} level 0-255
   */
  setBacklight(level) {
    ipcRenderer.send('van:backlight', level);
  },

  /**
   * Read saved IR buttons from ~/van-control-ir.json on the Pi.
   * @returns {Promise<Array>}
   */
  readIRButtons() {
    return ipcRenderer.invoke('van:ir:read');
  },

  /**
   * Write IR buttons to ~/van-control-ir.json on the Pi.
   * @param {Array} buttons
   */
  writeIRButtons(buttons) {
    ipcRenderer.send('van:ir:write', buttons);
  },
};

// Expose to renderer as window.vanAPI
contextBridge.exposeInMainWorld('vanAPI', vanAPI);
