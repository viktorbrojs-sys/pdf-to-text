import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import OcrPanel from './components/OcrPanel';
import TranslationPanel from './components/TranslationPanel';
import ExportPanel from './components/ExportPanel';

// Get version from package.json
const { version } = require('../package.json');

console.log('App.jsx loaded');

function App() {
  const [status, setStatus] = useState('idle');
  const [fileInfo, setFileInfo] = useState(null);
  const [ocrText, setOcrText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [currentText, setCurrentText] = useState('');

  useEffect(() => {
    console.log('App mounted');
  }, []);

  const handleFileSelect = async () => {
    if (window.electronAPI) {
      const filePath = await window.electronAPI.selectPdf();
      if (filePath) {
        const info = await window.electronAPI.getPdfInfo(filePath);
        setFileInfo({ ...info, path: filePath });
        setStatus('loaded');
      }
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Пожалуйста, выберите PDF файл');
      return;
    }
    
    if (window.electronAPI) {
      const filePath = await window.electronAPI.selectPdf();
      if (filePath) {
        const info = await window.electronAPI.getPdfInfo(filePath);
        setFileInfo({ ...info, path: filePath });
        setStatus('loaded');
      }
    } else {
      alert('Для работы с файлами запустите приложение через Electron');
    }
  };

  const handleFileInput = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') return;
    
    if (window.electronAPI) {
      const filePath = await window.electronAPI.selectPdf();
      if (filePath) {
        const info = await window.electronAPI.getPdfInfo(filePath);
        setFileInfo({ ...info, path: filePath });
        setStatus('loaded');
      }
    }
  };

  const handleOcrComplete = (text) => {
    setOcrText(text);
    setCurrentText(text);
    setStatus('ocr');
  };

  const handleTranslationComplete = (text) => {
    setTranslatedText(text);
    setCurrentText(text);
    setStatus('done');
  };

  const handleReset = () => {
    setStatus('idle');
    setFileInfo(null);
    setOcrText('');
    setTranslatedText('');
    setCurrentText('');
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>PDF to Text</h1>
          <p className="subtitle">Распознавание и перевод PDF</p>
        </div>
        <span className="version">v{version}</span>
      </header>

      <main className="main three-col">
        {status === 'idle' ? (
          <div className="col-left">
            <div className="section">
              <FileUpload
                onFileSelect={handleFileSelect}
                onDrop={handleDrop}
                onFileInput={handleFileInput}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="col-left">
              {fileInfo && (
                <div className="file-info-bar">
                  <span className="file-name">[PDF] {fileInfo.name}</span>
                  <span className="file-meta">
                    {fileInfo.sizeFormatted} • {fileInfo.pages} стр.
                  </span>
                  <button className="reset-btn" onClick={handleReset}>✕</button>
                </div>
              )}

              <div className="section">
                <h2>[OCR] Распознавание</h2>
                <OcrPanel
                  fileInfo={fileInfo}
                  onOcrComplete={handleOcrComplete}
                />
              </div>
            </div>

            <div className="col-center">
              <div className="section">
                <h2>[Translate] Перевод</h2>
                <TranslationPanel
                  sourceText={ocrText}
                  onTranslationComplete={handleTranslationComplete}
                />
              </div>
            </div>

            <div className="col-right">
              <div className="section">
                <h2>[Save] Сохранение</h2>
                <ExportPanel
                  text={currentText}
                  fileName={fileInfo?.name}
                />
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="footer">
        <p>PDF to Text v{version}</p>
      </footer>
    </div>
  );
}

export default App;
