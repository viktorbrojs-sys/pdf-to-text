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

  // Check Ollama status on mount
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
            throw new Error('Не удалось конвертировать PDF в изображения');
          }
          break;

        case 'ai':
          if (aiProvider === 'ollama' && !ollamaStatus.running) {
            throw new Error('Ollama не запущен. Нажмите "Настроить Ollama"');
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
            throw new Error('Не удалось конвертировать PDF в изображения');
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
      <h2>Метод распознавания</h2>
      
      <div className="method-buttons">
        <button 
          className={`method-btn ${fileInfo?.isTextBased ? 'recommended' : ''}`}
          onClick={() => handleOcr('textpdf')}
          disabled={isProcessing}
        >
          📄 Текстовый PDF
          {fileInfo?.isTextBased && <span className="badge">Рекомендуется</span>}
        </button>

        <button 
          className="method-btn"
          onClick={() => handleOcr('tesseract')}
          disabled={isProcessing}
        >
          🔍 Tesseract OCR
          <span className="sub">Локальный, бесплатный</span>
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
      <div className="ai-settings">
        <h3>Настройки AI Vision</h3>
        <div className="setting-row">
          <label>Провайдер:</label>
          <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)}>
            <option value="ollama">Ollama (локальный)</option>
            <option value="openai">OpenAI API</option>
            <option value="google">Google Vision</option>
          </select>
        </div>

        {aiProvider === 'ollama' && (
          <>
            {/* Ollama Status */}
            <div className="ollama-status">
              <p>
                {ollamaStatus.installed ? '✅ Ollama установлен' : '❌ Ollama не установлен'}
                {ollamaStatus.running ? ' | ✅ Сервер запущен' : ' | ❌ Сервер не запущен'}
              </p>
              {!ollamaStatus.installed && (
                <button 
                  className="setup-btn"
                  onClick={handleSetupOllama}
                  disabled={isSettingUp}
                >
                  {isSettingUp ? 'Установка...' : 'Установить Ollama'}
                </button>
              )}
            </div>

            {/* Model Selection */}
            <div className="setting-row">
              <label>Модель:</label>
              <select value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
                {ollamaStatus.models.length > 0 ? (
                  ollamaStatus.models.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))
                ) : (
                  <>
                    <option value="llava">llava (рекомендуется)</option>
                    <option value="minicpm-v">minicpm-v</option>
                    <option value="bakllava">bakllava</option>
                  </>
                )}
              </select>
            </div>

            {/* Pull Model */}
            {ollamaStatus.installed && !ollamaStatus.models.some(m => m.name.startsWith(aiModel.split(':')[0])) && (
              <div className="pull-model">
                <button 
                  className="pull-btn"
                  onClick={() => handlePullModel(aiModel)}
                  disabled={!!pullProgress}
                >
                  {pullProgress || `Скачать ${aiModel}`}
                </button>
              </div>
            )}

            {pullProgress && (
              <div className="progress-container">
                <p>{pullProgress}</p>
              </div>
            )}
          </>
        )}

        {aiProvider !== 'ollama' && (
          <div className="setting-row">
            <label>API ключ:</label>
            <input 
              type="password" 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Введите API ключ"
            />
          </div>
        )}
      </div>

      {/* Progress */}
      {isProcessing && (
        <div className="progress-container">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p>{statusMessage || 'Обработка...'}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="result-container">
          <h3>Результат ({selectedMethod})</h3>
          <textarea 
            className="result-text" 
            value={result} 
            readOnly 
            rows={10}
          />
        </div>
      )}
    </div>
  );
}

export default OcrPanel;
