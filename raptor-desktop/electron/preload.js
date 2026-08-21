const { contextBridge, ipcRenderer } = require('electron')

// Expose a minimal, safe API to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // OS theme
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', (_event, value) => callback(value)),
  // App version from package.json
  getVersion: () => process.env.npm_package_version,
  // Platform
  platform: process.platform,
})
