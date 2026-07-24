import React, { useState } from 'react';

function ExportPanel({ text, fileName, ocrMethod, translatedText }) {
  const [exporting, setExporting] = useState(false);
  const [savedFiles, setSavedFiles] = useState({});
  const [error, setError] = useState(null);

  const getMethodSuffix = () => {
    if (translatedText) return '_EN';
    switch (ocrMethod) {
      case 'textpdf': return '_Text';
      case 'tesseract': return '_OCR';
      case 'ai': return '_AI';
      default: return '';
    }
  };

  const handleExport = async (formats) => {
    if (!text) {
      setError('✗ Нет текста для экспорта');
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const baseName = (fileName?.replace('.pdf', '') || 'output') + getMethodSuffix();
      const outputDir = window.electronAPI.outputDir || './output';

      const response = await window.electronAPI.exportFile(
        text,
        baseName,
        outputDir,
        formats
      );

      if (response.success) {
        setSavedFiles(prev => {
          const updated = { ...prev };
          Object.entries(response.results).forEach(([format, result]) => {
            if (result.success) {
              updated[format] = { fileName: `${baseName}.${format}`, path: result.path };
            }
          });
          return updated;
        });
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleOpenFile = async (filePath) => {
    if (window.electronAPI?.openFile) {
      await window.electronAPI.openFile(filePath);
    }
  };

  const baseName = (fileName?.replace('.pdf', '') || 'output') + getMethodSuffix();

  return (
    <div className="export-panel">
      <div className="export-buttons">
        <button className="export-btn md" onClick={() => handleExport(['md'])} disabled={exporting || !text}>MD</button>
        <button className="export-btn docx" onClick={() => handleExport(['docx'])} disabled={exporting || !text}>DOCX</button>
        <button className="export-btn pdf" onClick={() => handleExport(['pdf'])} disabled={exporting || !text}>PDF</button>
        <button className="export-btn all" onClick={() => handleExport(['md', 'docx', 'pdf'])} disabled={exporting || !text}>Все</button>
      </div>
      <div className="export-results">
        {savedFiles.md && (
          <div className="export-result">
            <span className="format">{savedFiles.md.fileName}</span>
            <span className="result-status">✓ Сохранено</span>
            <button className="open-btn" onClick={() => handleOpenFile(savedFiles.md.path)}>Открыть</button>
          </div>
        )}
        {savedFiles.docx && (
          <div className="export-result">
            <span className="format">{savedFiles.docx.fileName}</span>
            <span className="result-status">✓ Сохранено</span>
            <button className="open-btn" onClick={() => handleOpenFile(savedFiles.docx.path)}>Открыть</button>
          </div>
        )}
        {savedFiles.pdf && (
          <div className="export-result">
            <span className="format">{savedFiles.pdf.fileName}</span>
            <span className="result-status">✓ Сохранено</span>
            <button className="open-btn" onClick={() => handleOpenFile(savedFiles.pdf.path)}>Открыть</button>
          </div>
        )}
      </div>
      {exporting && <p className="exporting">… Экспорт...</p>}
      {error && <div className="error-message">{'✗'} {error}</div>}
    </div>
  );
}

export default ExportPanel;
