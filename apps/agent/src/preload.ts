import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  getStatus: () => ipcRenderer.invoke('get-status'),
  forceCheckin: () => ipcRenderer.invoke('force-checkin'),
  onStatusUpdate: (callback: (status: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('status-update', handler);
    return () => {
      ipcRenderer.removeListener('status-update', handler);
    };
  },
});
