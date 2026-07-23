const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');
const http = require('http');

// Import modules
const { getPdfInfo } = require('../scripts/pdfinfo');
const { extractTextFromPdf } = require('../scripts/ocr-textpdf');
const { processDirectory } = require('../scripts/ocr');
const { ocrWithAI } = require('../scripts/ocr-ai');
const { translate } = require('../scripts/translate');
const { exportToMultiple } = require('../scripts/export');
const ollamaSetup = require('../scripts/ollama-setup');
const logger = require('../scripts/logger');

let mainWindow;

// Disable sandbox if permissions are not set correctly
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-setuid-sandbox');
app.commandLine.appendSwitch('disable-web-security');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
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

function tryStartOllama() {
  logger.info('Checking Ollama status...');
  try {
    execSync('ollama list', { encoding: 'utf-8', timeout: 3000, stdio: 'ignore' });
    logger.info('Ollama is already running');
    return true;
  } catch (e) {
    logger.info('Ollama not running, attempting to start...');
  }

  try {
    const child = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    logger.info('Ollama serve process spawned');
  } catch (e) {
    logger.warn('Could not spawn ollama serve', { error: e.message, stack: e.stack });
    return false;
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        execSync('ollama list', { encoding: 'utf-8', timeout: 3000, stdio: 'ignore' });
        logger.info('Ollama started successfully after auto-start');
        resolve(true);
      } catch (e) {
        logger.warn('Ollama still not running after 3s wait', { error: e.message });
        resolve(false);
      }
    }, 3000);
  });
}

async function restartOllama() {
  logger.info('Attempting Ollama restart...');
  try {
    execSync('pkill -f "ollama serve" || true', { encoding: 'utf-8', timeout: 5000, stdio: 'ignore' });
  } catch (e) {
    logger.info('No existing Ollama process to kill');
  }

  await new Promise(r => setTimeout(r, 1000));

  try {
    const child = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    logger.info('Ollama serve respawned');
  } catch (e) {
    logger.error('Failed to respawn ollama serve', { error: e.message, stack: e.stack });
    return false;
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        execSync('ollama list', { encoding: 'utf-8', timeout: 3000, stdio: 'ignore' });
        logger.info('Ollama restart successful');
        resolve(true);
      } catch (e) {
        logger.error('Ollama restart failed', { error: e.message });
        resolve(false);
      }
    }, 3000);
  });
}

app.whenReady().then(async () => {
  logger.info('App starting');
  await tryStartOllama();
  createWindow();
});

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
  if (mainWindow) {
    mainWindow.focus();
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });

  if (result.canceled) {
    logger.info('PDF selection canceled');
    return null;
  }
  logger.info('PDF selected', { path: result.filePaths[0] });
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
    logger.error('Text PDF extraction failed', { filePath, error: error.message, stack: error.stack });
    return { success: false, error: error.message, details: error.stack };
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
    logger.error('Tesseract OCR failed', { imageDir, error: error.message, stack: error.stack });
    return { success: false, error: error.message, details: error.stack };
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
    logger.error('AI Vision OCR failed', { imagePath, options: { ...options, apiKey: options.apiKey ? '***' : undefined }, error: error.message, stack: error.stack });
    return { success: false, error: error.message, details: error.stack };
  }
});

// Translation
ipcMain.handle('translate', async (event, text, options) => {
  try {
    logger.info('Translation started', { provider: options.provider || 'ollama', textLength: text.length });
    mainWindow.webContents.send('status-update', { 
      step: 'translate', message: 'Перевод текста...', progress: 50 
    });
    
    const translated = await translate(text, options);
    return { success: true, text: translated };
  } catch (error) {
    logger.error('Translation failed', { provider: options.provider, error: error.message, stack: error.stack });
    return { success: false, error: error.message, details: error.stack };
  }
});

// Export file
ipcMain.handle('export-file', async (event, text, baseName, outputDir, formats) => {
  try {
    logger.info('Export started', { baseName, formats });
    const resolvedOutputDir = path.join(app.getAppPath(), 'output');
    if (!fs.existsSync(resolvedOutputDir)) {
      fs.mkdirSync(resolvedOutputDir, { recursive: true });
    }
    
    const results = await exportToMultiple(text, baseName, resolvedOutputDir, formats);
    return { success: true, results };
  } catch (error) {
    logger.error('Export failed', { baseName, formats, error: error.message, stack: error.stack });
    return { success: false, error: error.message, details: error.stack };
  }
});

// Ollama Setup
ipcMain.handle('ollama-setup', async (event) => {
  try {
    const result = await ollamaSetup.setupCheck((message) => {
      mainWindow.webContents.send('status-update', { 
        step: 'ollama', message, progress: 50 
      });
    });
    return { success: true, ...result };
  } catch (error) {
    logger.error('Ollama setup failed', { error: error.message, stack: error.stack });
    return { success: false, error: error.message, details: error.stack };
  }
});

// Ollama: Get installed models
ipcMain.handle('ollama-models', async () => {
  try {
    const models = ollamaSetup.getInstalledModels();
    return { success: true, models };
  } catch (error) {
    logger.error('Failed to get Ollama models', { error: error.message, stack: error.stack });
    return { success: false, error: error.message, models: [] };
  }
});

// Ollama: Pull model
ipcMain.handle('ollama-pull', async (event, modelName) => {
  try {
    await ollamaSetup.pullModel(modelName, (progress) => {
      mainWindow.webContents.send('ollama-progress', progress);
    });
    return { success: true };
  } catch (error) {
    logger.error('Failed to pull Ollama model', { modelName, error: error.message, stack: error.stack });
    return { success: false, error: error.message };
  }
});

// Ollama: Check status
ipcMain.handle('ollama-status', async () => {
  try {
    const installed = ollamaSetup.isOllamaInstalled();
    let running = ollamaSetup.isOllamaRunning();

    if (installed && !running) {
      logger.info('Ollama installed but not running, auto-restarting...');
      running = await restartOllama();
    }

    const models = installed ? ollamaSetup.getInstalledModels() : [];
    logger.info('Ollama status checked', { installed, running, modelCount: models.length });
    return { success: true, installed, running, models };
  } catch (error) {
    logger.error('Ollama status check failed', { error: error.message, stack: error.stack });
    return { success: false, error: error.message, installed: false, running: false, models: [] };
  }
});

// Full PDF processing pipeline
ipcMain.handle('process-pdf', async (event, filePath, options = {}) => {
  try {
    const { method = 'auto' } = options;
    logger.info('PDF processing started', { filePath, method });
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
    
    return { success: true, info, text, mdPath, files: { images, imagesDir } };
    
  } catch (error) {
    logger.error('PDF processing failed', { filePath, error: error.message, stack: error.stack });
    mainWindow.webContents.send('status-update', { 
      step: 'error', 
      message: `Ошибка: ${error.message}`,
      progress: 0,
      error: true,
      details: error.stack
    });
    return { success: false, error: error.message, details: error.stack };
  }
});

// Get recent logs
ipcMain.handle('get-logs', async () => {
  return logger.getRecentLogs(100);
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

// Open file with system default application
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
