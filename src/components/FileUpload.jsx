import React from 'react';

function FileUpload({ onFileSelect, onDrop, onDragOver }) {
  return (
    <div className="file-upload">
      <div 
        className="drop-zone"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onClick={onFileSelect}
      >
        <div className="drop-zone-content">
          <span className="icon">📄</span>
          <p className="drop-text">Перетащите PDF сюда</p>
          <p className="drop-subtext">или нажмите для выбора</p>
        </div>
      </div>
    </div>
  );
}

export default FileUpload;
