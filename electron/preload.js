const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectPdf: () => ipcRenderer.invoke('select-pdf'),
  getPdfInfo: (filePath) => ipcRenderer.invoke('get-pdf-info', filePath),
  
  // OCR methods
  ocrTextPdf: (filePath) => ipcRenderer.invoke('ocr-textpdf', filePath),
  ocrTesseract: (imageDir) => ipcRenderer.invoke('ocr-tesseract', imageDir),
  ocrAi: (imagePath, options) => ipcRenderer.invoke('ocr-ai', imagePath, options),
  
  // Translation
  translate: (text, options) => ipcRenderer.invoke('translate', text, options),
  
  // Export
  exportFile: (text, baseName, outputDir, formats) => 
    ipcRenderer.invoke('export-file', text, baseName, outputDir, formats),
  
  // Process PDF (full pipeline)
  processPdf: (filePath, options) => ipcRenderer.invoke('process-pdf', filePath, options),
  
  // Download
  downloadFile: (options) => ipcRenderer.invoke('download-file', options),
  
  // Status updates
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (event, data) => callback(data));
  }
});
