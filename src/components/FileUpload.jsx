import React, { useRef } from 'react';

function FileUpload({ onFileSelect, onDrop, onDragOver, onFileInput }) {
  const fileInputRef = useRef(null);

  const handleClick = () => {
    if (window.electronAPI) {
      onFileSelect();
    } else {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="file-upload">
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf"
        onChange={onFileInput}
        style={{ display: 'none' }}
      />
      <div 
        className="drop-zone"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onClick={handleClick}
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
