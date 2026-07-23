import React from 'react';

function StatusBar({ progress, message, fileName }) {
  return (
    <div className="status-bar">
      <div className="file-info">
        <span className="icon">[PDF]</span>
        <span className="file-name">{fileName}</span>
      </div>
      
      <div className="progress-container">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="progress-text">{progress}%</span>
      </div>
      
      <p className="status-message">{message}</p>
    </div>
  );
}

export default StatusBar;
