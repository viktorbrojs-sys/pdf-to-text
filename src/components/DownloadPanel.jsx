import React from 'react';

function DownloadPanel({ status, message, fileName, onDownload, onReset, resultFiles }) {
  return (
    <div className="download-panel">
      {status === 'completed' ? (
        <>
          <div className="success-message">
            <span className="icon">✅</span>
            <p>Перевод завершен!</p>
          </div>
          
          <div className="download-buttons">
            <button 
              className="download-btn md"
              onClick={() => onDownload('md')}
            >
              📥 Скачать Markdown
            </button>
            
            <button 
              className="download-btn docx"
              onClick={() => onDownload('docx')}
            >
              📥 Скачать Word Document
            </button>
          </div>
        </>
      ) : (
        <div className="error-message">
          <span className="icon">❌</span>
          <p>{message || 'Произошла ошибка'}</p>
        </div>
      )}
      
      <button className="reset-btn" onClick={onReset}>
        📄 Загрузить новый PDF
      </button>
    </div>
  );
}

export default DownloadPanel;
