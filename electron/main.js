const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const http = require('http');

// Import modules
const { getPdfInfo } = require('../scripts/pdfinfo');
const { extractTextFromPdf } = require('../scripts/ocr-textpdf');
const { processDirectory } = require('../scripts/ocr');
const { ocrWithAI } = require('../scripts/ocr-ai');
const { translate } = require('../scripts/translate');
const { exportToMultiple } = require('../scripts/export');

let mainWindow;

// Disable sandbox if permissions are not set correctly
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-web-security');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
    resizable: true,
    autoHideMenuBar: true,
    title: 'PDF to Text'
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // Wait for dev server to be ready
    waitForServer('http://localhost:3000', 30000)
      .then(() => {
        console.log('Dev server ready, loading URL...');
        mainWindow.loadURL('http://localhost:3000');
      })
      .catch((err) => {
        console.error('Dev server not ready:', err);
        mainWindow.loadURL('data:text/html,<h1>Error: Dev server not ready. Run npm run build first.</h1>');
      });
  } else {
    // Production mode - try multiple paths
    const possiblePaths = [
      path.join(__dirname, '../dist/index.html'),
      path.join(app.getAppPath(), 'dist/index.html'),
      path.join(process.resourcesPath, 'app/dist/index.html'),
      path.join(process.cwd(), 'dist/index.html')
    ];
    
    let loaded = false;
    for (const htmlPath of possiblePaths) {
      if (fs.existsSync(htmlPath)) {
        console.log('Loading HTML from:', htmlPath);
        mainWindow.loadFile(htmlPath);
        loaded = true;
        break;
      }
    }
    
    if (!loaded) {
      console.error('HTML not found in any location');
      mainWindow.loadURL('data:text/html,<h1>Error: index.html not found</h1><p>Checked paths:</p><ul>' + possiblePaths.map(p => '<li>' + p + '</li>').join('') + '</ul>');
    }
  }
  
  // Log errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });
  
  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log('Renderer:', message);
  });

  // Open DevTools with F12 (only in development)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.openDevTools();
    }
  });
}

function waitForServer(url, timeout) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      http.get(url, (res) => {
        resolve(true);
      }).on('error', (err) => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for server'));
        } else {
          setTimeout(check, 500);
        }
      });
    };
    
    check();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ============ IPC Handlers ============

// Select PDF file
ipcMain.handle('select-pdf', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });
  
  if (result.canceled) return null;
  return result.filePaths[0];
});

// Get PDF info
ipcMain.handle('get-pdf-info', async (event, filePath) => {
  try {
    return getPdfInfo(filePath);
  } catch (error) {
    return { error: error.message };
  }
});

// OCR: Text-based PDF
ipcMain.handle('ocr-textpdf', async (event, filePath) => {
  try {
    mainWindow.webContents.send('status-update', { 
      step: 'ocr', message: 'Извлечение текста из PDF...', progress: 50 
    });
    
    const text = extractTextFromPdf(filePath);
    return { success: true, text };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// OCR: Tesseract
ipcMain.handle('ocr-tesseract', async (event, imageDir) => {
  try {
    mainWindow.webContents.send('status-update', { 
      step: 'ocr', message: 'Распознавание Tesseract...', progress: 30 
    });
    
    const text = await processDirectory(imageDir, (current, total, percent) => {
      mainWindow.webContents.send('status-update', { 
        step: 'ocr', 
        message: `Tesseract: страница ${current}/${total}...`,
        progress: 30 + Math.round(percent * 0.6)
      });
    });
    
    return { success: true, text };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// OCR: AI Vision
ipcMain.handle('ocr-ai', async (event, imagePath, options) => {
  try {
    mainWindow.webContents.send('status-update', { 
      step: 'ocr', message: 'Распознавание AI Vision...', progress: 50 
    });
    
    const text = await ocrWithAI(imagePath, options);
    return { success: true, text };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Translation
ipcMain.handle('translate', async (event, text, options) => {
  try {
    mainWindow.webContents.send('status-update', { 
      step: 'translate', message: 'Перевод текста...', progress: 50 
    });
    
    const translated = await translate(text, options);
    return { success: true, text: translated };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Export file
ipcMain.handle('export-file', async (event, text, baseName, outputDir, formats) => {
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const results = await exportToMultiple(text, baseName, outputDir, formats);
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Full PDF processing pipeline
ipcMain.handle('process-pdf', async (event, filePath, options = {}) => {
  try {
    const { method = 'auto' } = options;
    const appPath = app.getAppPath();
    const inputDir = path.join(appPath, 'input');
    const outputDir = path.join(appPath, 'output');
    const imagesDir = path.join(inputDir, 'images');
    
    // Ensure directories exist
    [inputDir, outputDir, imagesDir].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
    
    // Copy PDF to input
    const fileName = path.basename(filePath);
    const destPath = path.join(inputDir, fileName);
    fs.copyFileSync(filePath, destPath);
    
    // Get PDF info
    mainWindow.webContents.send('status-update', { 
      step: 'info', message: 'Анализ файла...', progress: 10 
    });
    
    const info = getPdfInfo(destPath);
    
    // Convert to images (for OCR methods)
    mainWindow.webContents.send('status-update', { 
      step: 'convert', message: 'Конвертация PDF в изображения...', progress: 20 
    });
    
    // Clean old images
    if (fs.existsSync(imagesDir)) {
      fs.readdirSync(imagesDir).forEach(f => {
        if (f.endsWith('.png')) fs.unlinkSync(path.join(imagesDir, f));
      });
    }
    
    execSync(`pdftocairo -png "${destPath}" "${imagesDir}/page"`, { timeout: 60000 });
    
    const images = fs.readdirSync(imagesDir)
      .filter(f => f.endsWith('.png'))
      .sort()
      .map(f => path.join(imagesDir, f));
    
    let text = '';
    
    // Choose OCR method
    if (method === 'textpdf' || (method === 'auto' && info.isTextBased)) {
      // Use pdftotext for text-based PDFs
      mainWindow.webContents.send('status-update', { 
        step: 'ocr', message: 'Извлечение текста...', progress: 50 
      });
      text = extractTextFromPdf(destPath);
    } else if (method === 'tesseract') {
      // Use Tesseract
      text = await processDirectory(imagesDir, (current, total, percent) => {
        mainWindow.webContents.send('status-update', { 
          step: 'ocr', 
          message: `Tesseract: ${current}/${total}...`,
          progress: 30 + Math.round(percent * 0.6)
        });
      });
    } else {
      // Use AI Vision (default)
      mainWindow.webContents.send('status-update', { 
        step: 'ocr', message: 'AI Vision распознавание...', progress: 50 
      });
      
      // Process first page for now
      if (images.length > 0) {
        text = await ocrWithAI(images[0], options.ocrOptions || {});
      }
    }
    
    // Save results
    mainWindow.webContents.send('status-update', { 
      step: 'save', message: 'Сохранение результатов...', progress: 90 
    });
    
    const baseName = fileName.replace('.pdf', '');
    const mdFileName = `${baseName}.md`;
    const mdPath = path.join(outputDir, mdFileName);
    
    // Save as markdown
    fs.writeFileSync(mdPath, `# ${fileName}\n\n${text}`, 'utf-8');
    
    mainWindow.webContents.send('status-update', { 
      step: 'done', 
      message: 'Готово!',
      progress: 100,
      completed: true,
      info,
      files: {
        md: mdPath,
        mdName: mdFileName,
        images: images
      }
    });
    
    return { success: true, info, text, mdPath };
    
  } catch (error) {
    mainWindow.webContents.send('status-update', { 
      step: 'error', 
      message: `Ошибка: ${error.message}`,
      progress: 0,
      error: true 
    });
    return { success: false, error: error.message };
  }
});

// Download file
ipcMain.handle('download-file', async (event, { filePath, fileName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: fileName,
    filters: [{ name: 'All Files', extensions: ['*'] }]
  });
  
  if (!result.canceled) {
    fs.copyFileSync(filePath, result.filePath);
    return true;
  }
  return false;
});
