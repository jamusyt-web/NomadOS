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
   * Subscribe to live telemetry from Arduino.
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
   * Send a control command to the Arduino.
   * e.g. { cmd: 'setLight', idx: 0, on: true, brightness: 80 }
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
};

// Expose to renderer as window.vanAPI
contextBridge.exposeInMainWorld('vanAPI', vanAPI);
