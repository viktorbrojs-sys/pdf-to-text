import React, { useState, useEffect } from 'react';
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
      alert('\u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 PDF \u0444\u0430\u0439\u043B');
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
      alert('\u0414\u043B\u044F \u0440\u0430\u0431\u043E\u0442\u044B \u0441 \u0444\u0430\u0439\u043B\u0430\u043C\u0438 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0447\u0435\u0440\u0435\u0437 Electron');
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
          <p className="subtitle">\u0420\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u0432\u0430\u043D\u0438\u0435 \u0438 \u043F\u0435\u0440\u0435\u0432\u043E\u0434 PDF</p>
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
                <div className="file-info-card">
                  <div className="file-info-header">
                    <span className="file-info-icon">{'\u25A0'}</span>
                    <span className="file-name">{fileInfo.name}</span>
                    <button className="reset-btn" onClick={handleReset}>{'\u2717'}</button>
                  </div>
                  <div className="file-info-grid">
                    <div className="file-info-item">
                      <span className="file-info-label">\u0420\u0430\u0437\u043C\u0435\u0440</span>
                      <span className="file-info-value">{fileInfo.sizeFormatted}</span>
                    </div>
                    <div className="file-info-item">
                      <span className="file-info-label">\u0421\u0442\u0440\u0430\u043D\u0438\u0446\u044B</span>
                      <span className="file-info-value">{fileInfo.pages}</span>
                    </div>
                    {fileInfo.title && (
                      <div className="file-info-item">
                        <span className="file-info-label">\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A</span>
                        <span className="file-info-value">{fileInfo.title}</span>
                      </div>
                    )}
                    {fileInfo.author && (
                      <div className="file-info-item">
                        <span className="file-info-label">\u0410\u0432\u0442\u043E\u0440</span>
                        <span className="file-info-value">{fileInfo.author}</span>
                      </div>
                    )}
                    {fileInfo.creationDate && (
                      <div className="file-info-item">
                        <span className="file-info-label">\u0421\u043E\u0437\u0434\u0430\u043D</span>
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
                      <span className="file-info-label">\u0422\u0435\u043A\u0441\u0442</span>
                      <span className="file-info-value">{fileInfo.isTextBased ? '\u2713 \u0414\u0430' : '\u2717 \u041D\u0435\u0442'}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="section">
                <h2>{'\u25B6'} \u0420\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u0432\u0430\u043D\u0438\u0435</h2>
                <OcrPanel
                  fileInfo={fileInfo}
                  onOcrComplete={handleOcrComplete}
                />
              </div>

              {(ocrText || currentText) && (
                <div className="section">
                  <h2>{'\u25C6'} \u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435</h2>
                  <ExportPanel
                    text={currentText}
                    fileName={fileInfo?.name}
                  />
                </div>
              )}
            </div>

            <div className="col-center">
              <div className="section">
                <h2>{'\u21C4'} \u041F\u0435\u0440\u0435\u0432\u043E\u0434</h2>
                <TranslationPanel
                  sourceText={ocrText}
                  onTranslationComplete={handleTranslationComplete}
                />
              </div>
            </div>

            <div className="col-right">
              {(translatedText || currentText) && (
                <div className="section">
                  <h2>{'\u25C6'} \u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0435</h2>
                  <ExportPanel
                    text={currentText}
                    fileName={fileInfo?.name}
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
