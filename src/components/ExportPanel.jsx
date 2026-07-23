import React, { useState } from 'react';

function ExportPanel({ text, fileName, ocrMethod, translatedText }) {
  const [exporting, setExporting] = useState(false);
  const [results, setResults] = useState(null);
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
    setResults(null);

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
        setResults(response.results);
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
        <button className="export-btn md" onClick={() => handleExport(['md'])} disabled={exporting || !text}>◆ MD</button>
        <button className="export-btn docx" onClick={() => handleExport(['docx'])} disabled={exporting || !text}>◆ DOCX</button>
        <button className="export-btn pdf" onClick={() => handleExport(['pdf'])} disabled={exporting || !text}>◆ PDF</button>
        <button className="export-btn all" onClick={() => handleExport(['md', 'docx', 'pdf'])} disabled={exporting || !text}>◆ Все</button>
      </div>

      <div className="export-right">
        {exporting && <p className="exporting">… Экспорт...</p>}
        {error && <div className="error-message">{'✗'} {error}</div>}
        {results && (
          <div className="export-results">
            {Object.entries(results).map(([format, result]) => (
              <div key={format} className={`export-result ${result.success ? 'success' : 'error'}`}>
                <span className="format">{baseName}.{format}</span>
                <span className="result-status">{result.success ? '✓ Сохранено' : '✗ Ошибка'}</span>
                {result.success && result.path && (
                  <button className="open-btn" onClick={() => handleOpenFile(result.path)}>Open</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ExportPanel;
