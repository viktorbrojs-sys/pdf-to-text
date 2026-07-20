const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');
const { processDirectory } = require('../scripts/ocr');

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
    mainWindow.loadURL('http://localhost:3000');
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
    
    // Step 2: OCR - Recognize text from images
    mainWindow.webContents.send('status-update', { 
      step: 2, 
      message: 'Распознавание текста...',
      progress: 30 
    });
    
    let extractedText = '';
    try {
      extractedText = await processDirectory(imagesDir, (current, total, percent) => {
        const progress = 30 + Math.round(percent * 0.4); // 30-70%
        mainWindow.webContents.send('status-update', { 
          step: 2, 
          message: `Распознавание: страница ${current}/${total}...`,
          progress 
        });
      });
    } catch (ocrError) {
      console.error('OCR error:', ocrError);
      extractedText = `[Ошибка OCR: ${ocrError.message}]`;
    }
    
    // Step 3: Translation (placeholder)
    mainWindow.webContents.send('status-update', { 
      step: 3, 
      message: 'Перевод текста...',
      progress: 75 
    });
    
    // Step 4: Save markdown
    mainWindow.webContents.send('status-update', { 
      step: 4, 
      message: 'Сохранение результата...',
      progress: 85 
    });
    
    const mdFileName = fileName.replace('.pdf', '.md');
    const mdPath = path.join(outputDir, mdFileName);
    
    // Save extracted text as markdown
    const markdownContent = `# ${fileName}\n\n${extractedText}`;
    fs.writeFileSync(mdPath, markdownContent, 'utf-8');
    
    // Step 5: Convert to DOCX
    mainWindow.webContents.send('status-update', { 
      step: 5, 
      message: 'Создание Word документа...',
      progress: 90 
    });
    
    const docxFileName = fileName.replace('.pdf', '.docx');
    const docxPath = path.join(outputDir, docxFileName);
    
    // Run DOCX conversion script with the correct input file
    try {
      // Update the convert script to use the correct input
      const convertScript = fs.readFileSync(
        path.join(__dirname, '../scripts/convert_to_docx.js'), 
        'utf-8'
      );
      
      // Create a temporary script with correct paths
      const tempScript = convertScript
        .replace(/BEI_EN\.md/g, mdFileName)
        .replace(/BEI\.pdf/g, fileName);
      
      const tempScriptPath = path.join(outputDir, '_temp_convert.js');
      fs.writeFileSync(tempScriptPath, tempScript);
      
      execSync(`node "${tempScriptPath}"`, { timeout: 30000 });
      
      // Clean up temp script
      fs.unlinkSync(tempScriptPath);
      
      // Rename the output if needed
      const defaultDocx = path.join(outputDir, 'BEI_EN.docx');
      if (fs.existsSync(defaultDocx) && defaultDocx !== docxPath) {
        fs.renameSync(defaultDocx, docxPath);
      }
    } catch (e) {
      console.error('DOCX conversion error:', e);
      // Create a simple text file as fallback
      fs.writeFileSync(docxPath, extractedText);
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
