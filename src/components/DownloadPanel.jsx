import React from 'react';

function DownloadPanel({ status, message, fileName, onDownload, onReset, resultFiles }) {
  return (
    <div className="download-panel">
      {status === 'completed' ? (
        <>
          <div className="success-message">
            <span className="icon">{'\u2713'}</span>
            <p>Перевод завершен!</p>
          </div>
          
          <div className="download-buttons">
            <button 
              className="download-btn md"
              onClick={() => onDownload('md')}
            >
              {'\u25C6'} \u0421\u043A\u0430\u0447\u0430\u0442\u044C Markdown
            </button>
            
            <button 
              className="download-btn docx"
              onClick={() => onDownload('docx')}
            >
              {'\u25C6'} \u0421\u043A\u0430\u0447\u0430\u0442\u044C Word Document
            </button>
          </div>
        </>
      ) : (
        <div className="error-message">
          <span className="icon">{'\u2717'}</span>
          <p>{message || 'Произошла ошибка'}</p>
        </div>
      )}
      
      <button className="reset-btn" onClick={onReset}>
        {'\u2B06'} \u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043D\u043E\u0432\u044B\u0439 PDF
      </button>
    </div>
  );
}

export default DownloadPanel;
