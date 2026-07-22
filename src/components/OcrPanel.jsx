import React, { useState, useEffect } from 'react';

function OcrPanel({ fileInfo, onOcrComplete }) {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  // AI Vision settings
  const [aiProvider, setAiProvider] = useState('ollama');
  const [apiKey, setApiKey] = useState('');
  const [aiModel, setAiModel] = useState('llava');

  // Ollama status
  const [ollamaStatus, setOllamaStatus] = useState({ installed: false, running: false, models: [] });
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [pullProgress, setPullProgress] = useState('');

  useEffect(() => {
    checkOllamaStatus();
  }, []);

  const checkOllamaStatus = async () => {
    try {
      const status = await window.electronAPI.ollamaStatus();
      setOllamaStatus(status);
    } catch (err) {
      console.error('Failed to check Ollama status:', err);
    }
  };

  const handleSetupOllama = async () => {
    setIsSettingUp(true);
    setError(null);
    setStatusMessage('Проверка и установка Ollama...');
    
    try {
      const result = await window.electronAPI.ollamaSetup();
      setOllamaStatus(result);
      setStatusMessage('Ollama готов к работе!');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSettingUp(false);
    }
  };

  const handlePullModel = async (modelName) => {
    setPullProgress('Начинаем скачивание...');
    
    try {
      await window.electronAPI.ollamaPull(modelName);
      setPullProgress('');
      await checkOllamaStatus();
    } catch (err) {
      setError(err.message);
      setPullProgress('');
    }
  };

  const handleOcr = async (method) => {
    setSelectedMethod(method);
    setIsProcessing(true);
    setError(null);
    setResult(null);
    setProgress(0);
    setStatusMessage('Подготовка...');

    try {
      let response;

      switch (method) {
        case 'textpdf':
          setStatusMessage('Извлечение текста из PDF...');
          response = await window.electronAPI.ocrTextPdf(fileInfo.path);
          break;

        case 'tesseract':
          setStatusMessage('Конвертация PDF в изображения...');
          setProgress(10);
          const imagesResult = await window.electronAPI.processPdf(fileInfo.path, { method: 'tesseract' });
          if (imagesResult.success && imagesResult.files?.images) {
            setStatusMessage('Распознавание Tesseract...');
            setProgress(30);
            response = await window.electronAPI.ocrTesseract(imagesResult.files.imagesDir);
          } else {
            throw new Error('Не удалось конвертировать PDF');
          }
          break;

        case 'ai':
          if (aiProvider === 'ollama' && !ollamaStatus.running) {
            throw new Error('Ollama не запущен');
          }
          setStatusMessage('Конвертация PDF в изображения...');
          setProgress(10);
          const aiImagesResult = await window.electronAPI.processPdf(fileInfo.path, { method: 'ai' });
          if (aiImagesResult.success && aiImagesResult.files?.images) {
            setStatusMessage('Распознавание AI Vision...');
            setProgress(30);
            response = await window.electronAPI.ocrAi(aiImagesResult.files.images[0], {
              provider: aiProvider,
              apiKey: apiKey || undefined,
              model: aiModel
            });
          } else {
            throw new Error('Не удалось конвертировать PDF');
          }
          break;

        default:
          throw new Error('Unknown method');
      }

      if (response?.success) {
        setResult(response.text);
        onOcrComplete(response.text);
      } else {
        setError(response?.error || 'Unknown error');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="ocr-panel">
      <div className="method-buttons">
        <button 
          className={`method-btn ${fileInfo?.isTextBased ? 'recommended' : ''}`}
          onClick={() => handleOcr('textpdf')}
          disabled={isProcessing}
        >
          📄 Текстовый PDF
          {fileInfo?.isTextBased && <span className="badge">★</span>}
        </button>

        <button 
          className="method-btn"
          onClick={() => handleOcr('tesseract')}
          disabled={isProcessing}
        >
          🔍 Tesseract
          <span className="sub">Локальный</span>
        </button>

        <button 
          className="method-btn ai"
          onClick={() => handleOcr('ai')}
          disabled={isProcessing}
        >
          🤖 AI Vision
          <span className="sub">Высокое качество</span>
        </button>
      </div>

      {/* AI Vision Settings */}
      <div className="settings-section">
        <h3>AI Vision</h3>
        <div className="setting-row">
          <label>API:</label>
          <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)}>
            <option value="ollama">Ollama</option>
            <option value="openai">OpenAI</option>
            <option value="google">Google</option>
          </select>
        </div>

        {aiProvider === 'ollama' && (
          <>
            <div className="ollama-status">
              <p>
                {ollamaStatus.installed ? '✅' : '❌'} Ollama
                {ollamaStatus.running ? ' | ✅ ON' : ' | ❌ OFF'}
              </p>
              {!ollamaStatus.installed && (
                <button 
                  className="setup-btn"
                  onClick={handleSetupOllama}
                  disabled={isSettingUp}
                >
                  {isSettingUp ? 'Установка...' : 'Установить'}
                </button>
              )}
            </div>

            <div className="setting-row">
              <label>Модель:</label>
              <select value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
                {ollamaStatus.models.length > 0 ? (
                  ollamaStatus.models.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))
                ) : (
                  <option value="llava">llava</option>
                )}
              </select>
            </div>

            {ollamaStatus.installed && !ollamaStatus.models.some(m => m.name.startsWith(aiModel.split(':')[0])) && (
              <button 
                className="pull-btn"
                onClick={() => handlePullModel(aiModel)}
                disabled={!!pullProgress}
              >
                {pullProgress || `Скачать ${aiModel}`}
              </button>
            )}
          </>
        )}

        {aiProvider !== 'ollama' && (
          <div className="setting-row">
            <label>Key:</label>
            <input 
              type="password" 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API ключ"
            />
          </div>
        )}
      </div>

      {/* Progress */}
      {isProcessing && (
        <div className="progress-container">
          <p>{statusMessage || 'Обработка...'}</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {error && <div className="error-message">❌ {error}</div>}
      {statusMessage && !isProcessing && <div className="status-message">ℹ️ {statusMessage}</div>}

      {result && (
        <div className="result-container">
          <h3>Результат</h3>
          <textarea className="result-text" value={result} readOnly rows={6} />
        </div>
      )}
    </div>
  );
}

export default OcrPanel;
