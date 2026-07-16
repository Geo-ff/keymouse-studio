const { contextBridge, ipcRenderer } = require('electron')

function subscribe(channel, handler) {
  const listener = (_event, payload) => handler(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('desktop', {
  getConnectionInfo: () => ipcRenderer.invoke('connection:get'),
  setTheme: (theme) => ipcRenderer.invoke('theme:set', theme),
  showNotification: (options) => ipcRenderer.invoke('notify:show', options),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getAboutInfo: () => ipcRenderer.invoke('app:getAboutInfo'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  getUpdateState: () => ipcRenderer.invoke('update:getState'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateState: (handler) => subscribe('update:state', handler),
  onOpenAbout: (handler) => subscribe('ui:open-about', handler),
  onOpenUpdatePrompt: (handler) => subscribe('ui:open-update', handler),
  setGlobalHotkeys: (bindings) => ipcRenderer.invoke('hotkeys:set', bindings),
  onGlobalHotkey: (handler) => subscribe('hotkeys:action', handler),
})
