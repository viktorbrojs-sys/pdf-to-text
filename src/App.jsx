import React, { useState, useEffect } from 'react';
import OcrPanel from './components/OcrPanel';
import TranslationPanel from './components/TranslationPanel';
import ExportPanel from './components/ExportPanel';

const { version } = require('../package.json');

console.log('App.jsx loaded');

function App() {
  const [status, setStatus] = useState('idle');
  const [fileInfo, setFileInfo] = useState(null);
  const [ocrText, setOcrText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [currentText, setCurrentText] = useState('');
  const [ocrMethod, setOcrMethod] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    console.log('App mounted');
  }, []);

  const handleFileSelect = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.selectPdf();
      if (result) {
        const filePath = result.path || result;
        const fileType = result.type || 'pdf';
        if (fileType === 'image') {
          setFileInfo({ name: filePath.split('/').pop(), path: filePath, isImage: true, isTextBased: false });
        } else {
          const info = await window.electronAPI.getPdfInfo(filePath);
          setFileInfo({ ...info, path: filePath });
        }
        setStatus('loaded');
      }
    }
  };

  const handleHeaderDrop = async (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff', 'image/bmp', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Пожалуйста, выберите PDF или изображение');
      return;
    }
    
    if (window.electronAPI) {
      const result = await window.electronAPI.selectPdf();
      if (result) {
        const filePath = result.path || result;
        const fileType = result.type || 'pdf';
        if (fileType === 'image') {
          setFileInfo({ name: filePath.split('/').pop(), path: filePath, isImage: true, isTextBased: false });
        } else {
          const info = await window.electronAPI.getPdfInfo(filePath);
          setFileInfo({ ...info, path: filePath });
        }
        setStatus('loaded');
      }
    } else {
      alert('Для работы с файлами запустите приложение через Electron');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleOcrComplete = (text, method) => {
    setOcrText(text);
    setCurrentText(text);
    setOcrMethod(method);
    setStatus('ocr');
  };

  const handleTranslationComplete = (text) => {
    setTranslatedText(text);
    setCurrentText(text);
    setStatus('done');
  };

  const handleReset = (e) => {
    e.stopPropagation();
    setStatus('idle');
    setFileInfo(null);
    setOcrText('');
    setTranslatedText('');
    setCurrentText('');
    setOcrMethod(null);
  };

  const handleOpenLogFile = async () => {
    if (window.electronAPI?.openLogFile) {
      await window.electronAPI.openLogFile();
    }
  };

  return (
    <div className="app">
      {!fileInfo ? (
        <div
          className={`header-large ${isDragOver ? 'drag-over' : ''}`}
          onClick={handleFileSelect}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleHeaderDrop}
        >
          <div className="upload-icon">📄</div>
          <h1>PDF to Text</h1>
          <p>Нажмите или перетащите PDF/изображение</p>
        </div>
      ) : (
        <header
          className="header-compact header-with-info"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleHeaderDrop}
        >
          <div className="header-top-row">
            <span className="header-title">PDF to Text</span>
            <button className="close-btn" onClick={handleReset}>✕</button>
          </div>
          <div className="header-filename" onClick={handleFileSelect}>{fileInfo.name}</div>
          <div className="header-properties">
            {fileInfo.sizeFormatted && (
              <span className="header-prop">{fileInfo.sizeFormatted}</span>
            )}
            {fileInfo.pages && (
              <span className="header-prop">{fileInfo.pages} стр.</span>
            )}
            {fileInfo.isImage && (
              <span className="header-prop">Изображение</span>
            )}
            {fileInfo.author && (
              <span className="header-prop">{fileInfo.author}</span>
            )}
            {fileInfo.creationDate && (
              <span className="header-prop">{fileInfo.creationDate}</span>
            )}
            <span className="header-prop">{fileInfo.isTextBased ? '✓ Текст' : '✗ Изображ.'}</span>
          </div>
        </header>
      )}

      <main className="main three-col">
        {status !== 'idle' && (
          <>
            <div className="col-left">
              <div className="section" style={{ flex: 1 }}>
                <h2>▸ Распознавание</h2>
                <OcrPanel
                  fileInfo={fileInfo}
                  onOcrComplete={handleOcrComplete}
                />
              </div>
            </div>

            <div className="col-center">
              <div className="section">
                <h2>⇄ Перевод</h2>
                <TranslationPanel
                  sourceText={ocrText}
                  onTranslationComplete={handleTranslationComplete}
                />
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="footer">
        {(translatedText || currentText) && (
          <div className="footer-export">
            <ExportPanel
              text={currentText}
              fileName={fileInfo?.name}
              ocrMethod={ocrMethod}
              translatedText={translatedText}
            />
          </div>
        )}
        <div className="footer-bottom">
          <span className="footer-link" onClick={handleOpenLogFile}>📄 Логи</span>
          <span>PDF to Text v{version}</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
