const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('perfMonitor', {
  onMetrics: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('metrics:update', listener);
    return () => ipcRenderer.removeListener('metrics:update', listener);
  },
  onRecommendations: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('recommendations:update', listener);
    return () => ipcRenderer.removeListener('recommendations:update', listener);
  },
  getHistory: () => ipcRenderer.invoke('history:get'),
  getStaticInfo: () => ipcRenderer.invoke('system:static-info'),
  minimizeToTray: () => ipcRenderer.send('window:minimize-to-tray'),
  quitApp: () => ipcRenderer.send('app:quit'),
});
