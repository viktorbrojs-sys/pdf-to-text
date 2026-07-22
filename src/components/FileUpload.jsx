import React, { useRef } from 'react';

function FileUpload({ onFileSelect, onDrop, onFileInput }) {
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
        onDragOver={(e) => e.preventDefault()}
        onClick={handleClick}
      >
        <div className="icon">📄</div>
        <p className="drop-text">Перетащите PDF</p>
        <p className="drop-subtext">или нажмите для выбора</p>
      </div>
    </div>
  );
}

export default FileUpload;
