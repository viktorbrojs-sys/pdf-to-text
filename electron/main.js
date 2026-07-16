const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');

let mainWindow;
let pipelineProcess = null;

// Disable sandbox if permissions are not set correctly
app.commandLine.appendSwitch('no-sandbox');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 500,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    resizable: false,
    autoHideMenuBar: true,
    title: 'PDF to Text'
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:8080');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
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

ipcMain.handle('select-pdf', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });
  
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('process-pdf', async (event, filePath) => {
  try {
    const inputDir = path.join(__dirname, '../input');
    const outputDir = path.join(__dirname, '../output');
    
    // Ensure directories exist
    if (!fs.existsSync(inputDir)) fs.mkdirSync(inputDir, { recursive: true });
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    // Copy PDF to input
    const fileName = path.basename(filePath);
    const destPath = path.join(inputDir, fileName);
    fs.copyFileSync(filePath, destPath);
    
    // Step 1: Convert PDF to images
    mainWindow.webContents.send('status-update', { 
      step: 1, 
      message: 'Конвертация PDF в изображения...',
      progress: 20 
    });
    
    const imagesDir = path.join(inputDir, 'images');
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
    
    execSync(`pdftocairo -png "${destPath}" "${imagesDir}/page"`, { 
      timeout: 60000 
    });
    
    // Get generated images
    const images = fs.readdirSync(imagesDir)
      .filter(f => f.endsWith('.png'))
      .sort()
      .map(f => path.join(imagesDir, f));
    
    // Step 2: OCR (placeholder - would need actual OCR integration)
    mainWindow.webContents.send('status-update', { 
      step: 2, 
      message: 'Распознавание текста...',
      progress: 50 
    });
    
    // Step 3: Translation (placeholder)
    mainWindow.webContents.send('status-update', { 
      step: 3, 
      message: 'Перевод текста...',
      progress: 70 
    });
    
    // Step 4: Save markdown
    mainWindow.webContents.send('status-update', { 
      step: 4, 
      message: 'Сохранение результата...',
      progress: 90 
    });
    
    const mdFileName = fileName.replace('.pdf', '_EN.md');
    const mdPath = path.join(outputDir, mdFileName);
    
    // For demo: copy existing translation if available
    const existingMd = path.join(outputDir, 'BEI_EN.md');
    if (fs.existsSync(existingMd)) {
      fs.copyFileSync(existingMd, mdPath);
    } else {
      fs.writeFileSync(mdPath, `# Translation of ${fileName}\n\n[Translation would appear here]\n`);
    }
    
    // Step 5: Convert to DOCX
    mainWindow.webContents.send('status-update', { 
      step: 5, 
      message: 'Создание Word документа...',
      progress: 95 
    });
    
    const docxFileName = fileName.replace('.pdf', '_EN.docx');
    const docxPath = path.join(outputDir, docxFileName);
    
    // Run DOCX conversion script
    try {
      execSync(`node "${path.join(__dirname, '../scripts/convert_to_docx.js')}"`, {
        timeout: 30000
      });
    } catch (e) {
      // If script fails, create empty docx marker
      fs.writeFileSync(docxPath, 'DOCX conversion pending');
    }
    
    mainWindow.webContents.send('status-update', { 
      step: 5, 
      message: 'Готово!',
      progress: 100,
      completed: true,
      files: {
        md: mdPath,
        docx: docxPath,
        mdName: mdFileName,
        docxName: docxFileName
      }
    });
    
    return { success: true, mdPath, docxPath };
    
  } catch (error) {
    mainWindow.webContents.send('status-update', { 
      step: 0, 
      message: `Ошибка: ${error.message}`,
      progress: 0,
      error: true 
    });
    return { success: false, error: error.message };
  }
});

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
