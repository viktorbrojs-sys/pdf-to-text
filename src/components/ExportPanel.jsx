import React, { useState } from 'react';

function ExportPanel({ text, fileName }) {
  const [exporting, setExporting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleExport = async (formats) => {
    if (!text) {
      setError('Нет текста для экспорта');
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

  return (
    <div className="export-panel">
      <div className="export-buttons">
        <button 
          className="export-btn md"
          onClick={() => handleExport(['md'])}
          disabled={exporting || !text}
        >
          [MD] MD
        </button>

        <button 
          className="export-btn docx"
          onClick={() => handleExport(['docx'])}
          disabled={exporting || !text}
        >
          [PDF] DOCX
        </button>

        <button 
          className="export-btn pdf"
          onClick={() => handleExport(['pdf'])}
          disabled={exporting || !text}
        >
          [PDF] PDF
        </button>

        <button 
          className="export-btn all"
          onClick={() => handleExport(['md', 'docx', 'pdf'])}
          disabled={exporting || !text}
        >
          [Save] Все
        </button>
      </div>

      {exporting && <p className="exporting">Экспорт...</p>}

      {error && <div className="error-message">X {error}</div>}

      {results && (
        <div className="export-results">
          {Object.entries(results).map(([format, result]) => (
            <div key={format} className={`export-result ${result.success ? 'success' : 'error'}`}>
              <span className="format">.{format}</span>
              <span>{result.success ? 'OK' : 'X'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ExportPanel;
