const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  getConnectionInfo: () => ipcRenderer.invoke('connection:get'),
  setTheme: (theme) => ipcRenderer.invoke('theme:set', theme),
  showNotification: (options) => ipcRenderer.invoke('notify:show', options),
})
