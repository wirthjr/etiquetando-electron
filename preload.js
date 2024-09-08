const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('darkMode', {
  toggle: () => ipcRenderer.invoke('dark-mode:toggle'),
  system: () => ipcRenderer.invoke('dark-mode:system')
})

contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  receive: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args).catch(error => console.error(`Error in ${channel} invoke:`, error)),
  onLogData: (callback) => ipcRenderer.on('logData', (event, logData) => callback(logData)),
  onSocket: (callback) => ipcRenderer.on('sck_status', (event, sck_status) => callback(sck_status)),
  onToken: (callback) => ipcRenderer.on('token', (event, token) => callback(token))
});


console.log('preload carregado')