import React, { useState } from 'react';

function ExportPanel({ text, fileName }) {
  const [exporting, setExporting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleExport = async (formats) => {
    if (!text) {
      setError('\u2717 \u041D\u0435\u0442 \u0442\u0435\u043A\u0441\u0442\u0430 \u0434\u043B\u044F \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0430');
      return;
    }

    setExporting(true);
    setError(null);
    setResults(null);

    try {
      const baseName = fileName?.replace('.pdf', '') || 'output';
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

  const baseName = fileName?.replace('.pdf', '') || 'output';

  return (
    <div className="export-panel">
      <div className="export-buttons">
        <button 
          className="export-btn md"
          onClick={() => handleExport(['md'])}
          disabled={exporting || !text}
        >
          \u25C6 MD
        </button>

        <button 
          className="export-btn docx"
          onClick={() => handleExport(['docx'])}
          disabled={exporting || !text}
        >
          \u25C6 DOCX
        </button>

        <button 
          className="export-btn pdf"
          onClick={() => handleExport(['pdf'])}
          disabled={exporting || !text}
        >
          \u25C6 PDF
        </button>

        <button 
          className="export-btn all"
          onClick={() => handleExport(['md', 'docx', 'pdf'])}
          disabled={exporting || !text}
        >
          \u25C6 \u0412\u0441\u0435
        </button>
      </div>

      {exporting && <p className="exporting">\u2026 \u042D\u043A\u0441\u043F\u043E\u0440\u0442...</p>}

      {error && <div className="error-message">{'\u2717'} {error}</div>}

      {results && (
        <div className="export-results">
          {Object.entries(results).map(([format, result]) => (
            <div key={format} className={`export-result ${result.success ? 'success' : 'error'}`}>
              <span className="format">{baseName}_EN.{format}</span>
              <span className="result-status">{result.success ? '\u2713 \u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E' : '\u2717 \u041E\u0448\u0438\u0431\u043A\u0430'}</span>
              {result.success && result.path && (
                <button className="open-btn" onClick={() => handleOpenFile(result.path)}>
                  Open
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ExportPanel;
