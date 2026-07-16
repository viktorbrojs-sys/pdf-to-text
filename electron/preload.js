const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectPdf: () => ipcRenderer.invoke('select-pdf'),
  processPdf: (filePath) => ipcRenderer.invoke('process-pdf', filePath),
  downloadFile: (options) => ipcRenderer.invoke('download-file', options),
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (event, data) => callback(data));
  }
});
