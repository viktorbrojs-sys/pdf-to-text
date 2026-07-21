import React, { useState, useEffect, useRef } from 'react';
import FileUpload from './components/FileUpload';
import StatusBar from './components/StatusBar';
import DownloadPanel from './components/DownloadPanel';

console.log('App.jsx loaded');

function App() {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [resultFiles, setResultFiles] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    console.log('App mounted, electronAPI:', !!window.electronAPI);
    setIsElectron(!!window.electronAPI);
    
    if (window.electronAPI) {
      window.electronAPI.onStatusUpdate((data) => {
        setProgress(data.progress);
        setMessage(data.message);
        
        if (data.completed) {
          setStatus('completed');
          setResultFiles(data.files);
        } else if (data.error) {
          setStatus('error');
        } else {
          setStatus('processing');
        }
      });
    }
  }, []);

  console.log('App rendering, status:', status);

  const handleFileSelect = async () => {
    if (window.electronAPI) {
      const filePath = await window.electronAPI.selectPdf();
      if (filePath) {
        setFileName(filePath.split(/[/\\]/).pop());
        setStatus('processing');
        setProgress(0);
        setMessage('Начинаю обработку...');
        await window.electronAPI.processPdf(filePath);
      }
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      alert('Пожалуйста, выберите PDF файл');
      return;
    }

    setFileName(file.name);
    
    if (window.electronAPI) {
      // Electron mode - use file dialog
      setStatus('processing');
      setProgress(0);
      setMessage('Начинаю обработку...');
      const filePath = await window.electronAPI.selectPdf();
      if (filePath) {
        await window.electronAPI.processPdf(filePath);
      } else {
        setStatus('idle');
      }
    } else {
      // Browser mode - show message that backend is needed
      setStatus('error');
      setMessage('Для обработки файлов запустите приложение через Electron: npm run electron:dev');
    }
  };

  const handleFileInput = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      alert('Пожалуйста, выберите PDF файл');
      return;
    }

    setFileName(file.name);
    
    if (window.electronAPI) {
      setStatus('processing');
      setProgress(0);
      setMessage('Начинаю обработку...');
      const filePath = await window.electronAPI.selectPdf();
      if (filePath) {
        await window.electronAPI.processPdf(filePath);
      } else {
        setStatus('idle');
      }
    } else {
      setStatus('error');
      setMessage('Для обработки файлов запустите приложение через Electron: npm run electron:dev');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDownload = async (type) => {
    if (resultFiles && window.electronAPI) {
      const filePath = type === 'md' ? resultFiles.md : resultFiles.docx;
      const fileName = type === 'md' ? resultFiles.mdName : resultFiles.docxName;
      await window.electronAPI.downloadFile({ filePath, fileName });
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setProgress(0);
    setMessage('');
    setResultFiles(null);
    setFileName('');
  };

  return (
    <div className="app">
      <header className="header">
        <h1>PDF to Text</h1>
        <p className="subtitle">Переводчик PDF документов</p>
        {!isElectron && (
          <p className="web-warning">
            ⚠️ Веб-версия: загрузка файлов недоступна. 
            Запустите локально: <code>npm run electron:dev</code>
          </p>
        )}
      </header>

      <main className="main">
        {status === 'idle' && (
          <FileUpload 
            onFileSelect={handleFileSelect}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onFileInput={handleFileInput}
          />
        )}

        {status === 'processing' && (
          <StatusBar 
            progress={progress}
            message={message}
            fileName={fileName}
          />
        )}

        {(status === 'completed' || status === 'error') && (
          <DownloadPanel 
            status={status}
            message={message}
            fileName={fileName}
            onDownload={handleDownload}
            onReset={handleReset}
            resultFiles={resultFiles}
          />
        )}
      </main>

      <footer className="footer">
        <p>v1.0.0</p>
      </footer>
    </div>
  );
}

export default App;
