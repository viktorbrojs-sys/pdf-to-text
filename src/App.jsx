import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import OcrPanel from './components/OcrPanel';
import TranslationPanel from './components/TranslationPanel';
import ExportPanel from './components/ExportPanel';

console.log('App.jsx loaded');

function App() {
  const [status, setStatus] = useState('idle'); // idle, loaded, ocr, translating, done
  const [fileInfo, setFileInfo] = useState(null);
  const [ocrText, setOcrText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [currentText, setCurrentText] = useState(''); // Active text for export

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
        <h1>PDF to Text</h1>
        <p className="subtitle">Распознавание и перевод PDF документов</p>
      </header>

      <main className="main">
        {status === 'idle' && (
          <FileUpload 
            onFileSelect={handleFileSelect}
            onDrop={handleDrop}
            onFileInput={handleFileInput}
          />
        )}

        {status !== 'idle' && fileInfo && (
          <div className="workspace">
            {/* File Info Bar */}
            <div className="file-info-bar">
              <span className="file-name">📄 {fileInfo.name}</span>
              <span className="file-meta">
                {fileInfo.sizeFormatted} • {fileInfo.pages} стр. • 
                {fileInfo.isTextBased ? ' Текстовый PDF' : ' Скан'}
              </span>
              <button className="reset-btn" onClick={handleReset}>✕ Новый файл</button>
            </div>

            {/* OCR Panel */}
            <div className="section">
              <OcrPanel 
                fileInfo={fileInfo}
                onOcrComplete={handleOcrComplete}
              />
            </div>

            {/* Translation Panel */}
            <div className="section">
              <TranslationPanel 
                sourceText={ocrText}
                onTranslationComplete={handleTranslationComplete}
              />
            </div>

            {/* Export Panel */}
            <div className="section">
              <ExportPanel 
                text={currentText}
                fileName={fileInfo.name}
              />
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>v2.0.0</p>
      </footer>
    </div>
  );
}

export default App;
