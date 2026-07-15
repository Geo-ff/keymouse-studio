const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  getConnectionInfo: () => ipcRenderer.invoke('connection:get'),
})