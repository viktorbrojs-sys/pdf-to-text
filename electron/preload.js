const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectPdf: () => ipcRenderer.invoke('select-pdf'),
  getPdfInfo: (filePath) => ipcRenderer.invoke('get-pdf-info', filePath),
  
  // OCR methods
  ocrTextPdf: (filePath) => ipcRenderer.invoke('ocr-textpdf', filePath),
  ocrTesseract: (imageDir) => ipcRenderer.invoke('ocr-tesseract', imageDir),
  ocrAi: (imagePath, options) => ipcRenderer.invoke('ocr-ai', imagePath, JSON.parse(JSON.stringify(options))),
  
  // Translation
  translate: (text, options) => ipcRenderer.invoke('translate', text, JSON.parse(JSON.stringify(options))),
  
  // Export
  exportFile: (text, baseName, outputDir, formats) => 
    ipcRenderer.invoke('export-file', text, baseName, outputDir, JSON.parse(JSON.stringify(formats))),
  
  // Process PDF (full pipeline)
  processPdf: (filePath, options) => ipcRenderer.invoke('process-pdf', filePath, JSON.parse(JSON.stringify(options))),
  
  // Download
  downloadFile: (options) => ipcRenderer.invoke('download-file', JSON.parse(JSON.stringify(options))),
  
  // Open file
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  
  // Open log file
  openLogFile: () => ipcRenderer.invoke('open-log-file'),
  
  // Ollama Setup
  ollamaSetup: () => ipcRenderer.invoke('ollama-setup'),
  ollamaModels: () => ipcRenderer.invoke('ollama-models'),
  ollamaPull: (modelName) => ipcRenderer.invoke('ollama-pull', modelName),
  ollamaStatus: () => ipcRenderer.invoke('ollama-status'),
  
  // Logs
  getLogs: () => ipcRenderer.invoke('get-logs'),
  
  // Status updates
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (event, data) => callback(data));
  },
  
  // Ollama progress
  onOllamaProgress: (callback) => {
    ipcRenderer.on('ollama-progress', (event, data) => callback(data));
  },
  
  // Translation progress
  onTranslationProgress: (callback) => {
    ipcRenderer.on('translation-progress', (event, data) => callback(data));
  }
});
