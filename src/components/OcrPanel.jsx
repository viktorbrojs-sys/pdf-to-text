import React, { useState, useEffect } from 'react';

const RECOMMENDED_MODELS = [
  { name: 'qwen2.5:7b', label: 'qwen2.5:7b (рекомендуется)' },
  { name: 'llama3.1:8b', label: 'llama3.1:8b' },
  { name: 'mistral:7b', label: 'mistral:7b' },
  { name: 'llava', label: 'llava (vision)' },
];

function OcrPanel({ fileInfo, onOcrComplete }) {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState('');
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [aiProvider, setAiProvider] = useState('ollama');
  const [apiKey, setApiKey] = useState('');
  const [aiModel, setAiModel] = useState('llava');

  const [ollamaStatus, setOllamaStatus] = useState({ installed: false, running: false, models: [] });
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [pullProgress, setPullProgress] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);

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

  const isModelInstalled = (modelName) => {
    const baseName = modelName.split(':')[0];
    return ollamaStatus.models.some(m => m.name === modelName || m.name.startsWith(baseName));
  };

  const handleSetupOllama = async () => {
    setIsSettingUp(true);
    setError(null);
    setStatusMessage('Проверка и установка Ollama...');
    
    try {
      const result = await window.electronAPI.ollamaSetup();
      setOllamaStatus(result);
      setStatusMessage('Ollama готов к работе!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      setError(err.message);
      setErrorDetails(err.stack || '');
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
      setErrorDetails(err.stack || '');
      setPullProgress('');
    }
  };

  const handleOcr = async (method, isRetry = false) => {
    setSelectedMethod(method);
    setIsProcessing(true);
    setError(null);
    setErrorDetails('');
    setShowErrorDetails(false);
    setResult(null);
    setProgress(0);
    setStatusMessage(isRetry ? 'Повторная попытка...' : 'Подготовка...');

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
            throw new Error(imagesResult.error || 'Не удалось конвертировать PDF');
          }
          break;

        case 'ai':
          if (aiProvider === 'ollama' && !ollamaStatus.running) {
            throw new Error('Ollama не запущен. Нажмите "Настроить Ollama" для запуска.');
          }
          if (aiProvider === 'ollama' && !isModelInstalled(aiModel)) {
            throw new Error(`Модель ${aiModel} не установлена. Скачайте модель или выберите установленную.`);
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
            throw new Error(aiImagesResult.error || 'Не удалось конвертировать PDF');
          }
          break;

        default:
          throw new Error('Unknown method');
      }

      if (response?.success) {
        setResult(response.text);
        onOcrComplete(response.text);
      } else {
        throw new Error(response?.error || 'Неизвестная ошибка');
      }
    } catch (err) {
      const msg = err.message || String(err);
      setError(msg);
      setErrorDetails(err.stack || response?.details || '');
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
      setIsRetrying(false);
    }
  };

  const handleRetry = () => {
    if (selectedMethod) {
      setIsRetrying(true);
      handleOcr(selectedMethod, true);
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
          ■ Текстовый PDF
          {fileInfo?.isTextBased && <span className="badge">★</span>}
        </button>

        <button 
          className="method-btn"
          onClick={() => handleOcr('tesseract')}
          disabled={isProcessing}
        >
          ▸ Tesseract
          <span className="sub">Локальный</span>
        </button>

        <button 
          className="method-btn ai"
          onClick={() => handleOcr('ai')}
          disabled={isProcessing || (aiProvider === 'ollama' && !ollamaStatus.running)}
        >
          ★ AI Vision
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
                {ollamaStatus.installed ? '✓' : '✗'} Ollama
                {ollamaStatus.running ? ' | ✓ ON' : ' | ✗ OFF'}
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
              {ollamaStatus.installed && !ollamaStatus.running && (
                <button 
                  className="setup-btn"
                  onClick={handleSetupOllama}
                  disabled={isSettingUp}
                >
                  {isSettingUp ? 'Запуск...' : 'Запустить'}
                </button>
              )}
            </div>

            <div className="setting-row">
              <label>Модель:</label>
              <select value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
                {RECOMMENDED_MODELS.map(m => {
                  const installed = isModelInstalled(m.name);
                  return (
                    <option key={m.name} value={m.name} disabled={!installed && ollamaStatus.models.length > 0}>
                      {installed ? '✓' : '✗'} {m.label}
                    </option>
                  );
                })}
                {ollamaStatus.models.filter(m => !RECOMMENDED_MODELS.some(r => r.name === m.name)).map(m => (
                  <option key={m.name} value={m.name}>{'✓'} {m.name}</option>
                ))}
              </select>
            </div>

            {ollamaStatus.installed && !isModelInstalled(aiModel) && (
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

      {/* Error with details */}
      {error && (
        <div className="error-block">
          <div className="error-message">
            <span>{'✗'} {error}</span>
            <div className="error-actions">
              <button className="retry-btn" onClick={handleRetry} disabled={isProcessing || isRetrying}>
                {isRetrying ? 'Повтор...' : 'Повторить'}
              </button>
              {errorDetails && (
                <button 
                  className="details-toggle"
                  onClick={() => setShowErrorDetails(!showErrorDetails)}
                >
                  {showErrorDetails ? '▲ Скрыть' : '▼ Подробности'}
                </button>
              )}
            </div>
          </div>
          {showErrorDetails && errorDetails && (
            <pre className="error-details">{errorDetails}</pre>
          )}
        </div>
      )}

      {statusMessage && !isProcessing && <div className="status-message">{statusMessage}</div>}

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
