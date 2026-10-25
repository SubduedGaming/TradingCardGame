import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('host', {
  state: () => ipcRenderer.invoke('state'),
  start: () => ipcRenderer.invoke('start'),
  stop: () => ipcRenderer.invoke('stop'),
  restart: () => ipcRenderer.invoke('restart'),
  saveSettings: (patch: unknown) => ipcRenderer.invoke('save-settings', patch),
  openGame: () => ipcRenderer.invoke('open-game'),
  openFolder: (which: string) => ipcRenderer.invoke('open-folder', which),
  copy: (text: string) => ipcRenderer.invoke('copy', text),
  logs: () => ipcRenderer.invoke('logs'),
  firewall: () => ipcRenderer.invoke('firewall'),
  onChange: (fn: () => void) => ipcRenderer.on('state-changed', fn),
});
