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
  // Capture window APIs
  onCaptureStart: (callback: (data: { sessionId: string; assetId: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; assetId: string }) => callback(data);
    ipcRenderer.on('capture:start', handler);
    return () => { ipcRenderer.removeListener('capture:start', handler); };
  },
  onCaptureStop: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('capture:stop', handler);
    return () => { ipcRenderer.removeListener('capture:stop', handler); };
  },
  onWebRTCSignal: (callback: (data: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('capture:webrtc-signal', handler);
    return () => { ipcRenderer.removeListener('capture:webrtc-signal', handler); };
  },
  sendWebRTCSignal: (data: any) => {
    ipcRenderer.send('capture:webrtc-signal', data);
  },
});
