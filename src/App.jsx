import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import StatusBar from './components/StatusBar';
import DownloadPanel from './components/DownloadPanel';

function App() {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [resultFiles, setResultFiles] = useState(null);
  const [fileName, setFileName] = useState('');

  useEffect(() => {
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
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setFileName(file.name);
      setStatus('processing');
      setProgress(0);
      setMessage('Начинаю обработку...');
      
      if (window.electronAPI) {
        const filePath = await window.electronAPI.selectPdf();
        if (filePath) {
          await window.electronAPI.processPdf(filePath);
        }
      }
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
      </header>

      <main className="main">
        {status === 'idle' && (
          <FileUpload 
            onFileSelect={handleFileSelect}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
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
