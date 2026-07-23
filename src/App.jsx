import React, { useState, useEffect, useRef } from 'react';
import FileUpload from './components/FileUpload';
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

  const handleDrop = async (e) => {
    e.preventDefault();
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

  const handleFileInput = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff', 'image/bmp', 'image/webp'];
    if (!allowedTypes.includes(file.type)) return;
    
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
          className="header-compact"
          onClick={handleFileSelect}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleHeaderDrop}
        >
          <span>
            <strong>PDF to Text</strong> — {fileInfo.name}
          </span>
          <button className="close-btn" onClick={handleReset}>✕</button>
        </header>
      )}

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
                <div className="file-info-card">
                  <div className="file-info-grid">
                    <div className="file-info-item">
                      <span className="file-info-label">Размер</span>
                      <span className="file-info-value">{fileInfo.sizeFormatted}</span>
                    </div>
                    {fileInfo.pages && (
                      <div className="file-info-item">
                        <span className="file-info-label">Страницы</span>
                        <span className="file-info-value">{fileInfo.pages}</span>
                      </div>
                    )}
                    {fileInfo.isImage && (
                      <div className="file-info-item">
                        <span className="file-info-label">Тип</span>
                        <span className="file-info-value">Изображение</span>
                      </div>
                    )}
                    {fileInfo.title && (
                      <div className="file-info-item">
                        <span className="file-info-label">Заголовок</span>
                        <span className="file-info-value">{fileInfo.title}</span>
                      </div>
                    )}
                    {fileInfo.author && (
                      <div className="file-info-item">
                        <span className="file-info-label">Автор</span>
                        <span className="file-info-value">{fileInfo.author}</span>
                      </div>
                    )}
                    {fileInfo.creationDate && (
                      <div className="file-info-item">
                        <span className="file-info-label">Создан</span>
                        <span className="file-info-value">{fileInfo.creationDate}</span>
                      </div>
                    )}
                    {fileInfo.pdfVersion && (
                      <div className="file-info-item">
                        <span className="file-info-label">PDF</span>
                        <span className="file-info-value">{fileInfo.pdfVersion}</span>
                      </div>
                    )}
                    <div className="file-info-item">
                      <span className="file-info-label">Текст</span>
                      <span className="file-info-value">{fileInfo.isTextBased ? '✓ Да' : '✗ Нет'}</span>
                    </div>
                  </div>
                </div>
              )}

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

            <div className="col-right">
              {(translatedText || currentText) && (
                <div className="section">
                  <h2>◆ Сохранение</h2>
                  <ExportPanel
                    text={currentText}
                    fileName={fileInfo?.name}
                    ocrMethod={ocrMethod}
                    translatedText={translatedText}
                  />
                </div>
              )}
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
