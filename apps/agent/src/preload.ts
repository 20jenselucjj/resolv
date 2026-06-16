import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  getStatus: () => ipcRenderer.invoke('get-status'),
  forceCheckin: () => ipcRenderer.invoke('force-checkin'),
  onStatusUpdate: (callback: (status: any) => void) => {
    // Remove any existing listener first to prevent listener leaks
    ipcRenderer.removeAllListeners('status-update');
    ipcRenderer.on('status-update', (_event: Electron.IpcRendererEvent, data: any) => callback(data));
  },
});
