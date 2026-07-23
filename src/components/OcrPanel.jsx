import React, { useState, useEffect } from 'react';

const VISION_MODELS = [
  { name: 'qwen3-vl:4b', label: 'Qwen3-VL (Alibaba)', description: 'Лучший для русского текста, 32 языка' },
  { name: 'llama3.2-vision:11b', label: 'Llama 3.2 Vision (Meta)', description: 'Баланс качества и ресурсов' },
  { name: 'minicpm-v', label: 'MiniCPM-V (OpenBMB)', description: 'Компактная, хорошее качество' },
  { name: 'gemma3:4b', label: 'Gemma 3 4B (Google)', description: 'Быстрая, малый размер' },
  { name: 'gemma3:12b', label: 'Gemma 3 12B (Google)', description: 'Высокое качество' },
  { name: 'llava:7b', label: 'LLaVA 1.6', description: 'Классическая vision модель' },
  { name: 'glm-ocr', label: 'GLM-OCR (Zhipu AI)', description: 'Для таблиц, формул, сложных макетов' },
  { name: 'bakllava', label: 'BakLLaVA (Hugging Face)', description: 'Для рукописного текста' },
  { name: 'moondream', label: 'Moondream', description: 'Для маломощных устройств, быстрая' },
  { name: 'granite3.2-vision', label: 'Granite 3.2 Vision (IBM)', description: 'Для документов, таблиц, диаграмм' },
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
  const [elapsedTime, setElapsedTime] = useState(null);

  const [aiProvider, setAiProvider] = useState('ollama');
  const [apiKey, setApiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [customModel, setCustomModel] = useState('');

  const [ollamaStatus, setOllamaStatus] = useState({ installed: false, running: false, models: [] });
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [pullProgress, setPullProgress] = useState({ status: '', percent: null, downloaded: null, total: null, speed: null, eta: null });
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    checkOllamaStatus();
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onOllamaProgress) {
      window.electronAPI.onOllamaProgress((progress) => {
        setPullProgress(progress);
      });
    }
  }, []);

  const checkOllamaStatus = async () => {
    try {
      const status = await window.electronAPI.ollamaStatus();
      setOllamaStatus(status);
      if (status.models && status.models.length > 0 && (!aiModel || aiModel === '')) {
        setAiModel(status.models[0].name);
      }
    } catch (err) {
      console.error('Failed to check Ollama status:', err);
    }
  };

  const effectiveAiModel = aiModel || (ollamaStatus.models.length > 0 ? ollamaStatus.models[0].name : '');

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
    setPullProgress({ status: 'Начинаем скачивание...', percent: 0, downloaded: null, total: null, speed: null, eta: null });
    
    try {
      await window.electronAPI.ollamaPull(modelName);
      setPullProgress({ status: 'Готово!', percent: 100, downloaded: null, total: null, speed: null, eta: null });
      await checkOllamaStatus();
      setTimeout(() => setPullProgress({ status: '', percent: null, downloaded: null, total: null, speed: null, eta: null }), 2000);
    } catch (err) {
      setError(err.message);
      setErrorDetails(err.stack || '');
      setPullProgress({ status: '', percent: null, downloaded: null, total: null, speed: null, eta: null });
    }
  };

  const handleOcr = async (isRetry = false) => {
    if (!selectedMethod) return;
    setIsProcessing(true);
    setError(null);
    setErrorDetails('');
    setShowErrorDetails(false);
    setResult(null);
    setProgress(0);
    setElapsedTime(null);
    setStatusMessage(isRetry ? 'Повторная попытка...' : 'Подготовка...');

    try {
      let response;

      if (fileInfo?.isImage) {
        setStatusMessage('AI Vision: распознавание изображения...');
        setProgress(20);
        const ocrOptions = {
          provider: aiProvider,
          apiKey: apiKey || undefined,
          model: effectiveAiModel
        };
        response = await window.electronAPI.ocrAi(fileInfo.path, ocrOptions);
      } else {
        switch (selectedMethod) {
          case 'textpdf':
            setStatusMessage('Извлечение текста из PDF...');
            setProgress(10);
            const pdfInfo = await window.electronAPI.getPdfInfo(fileInfo.path);
            const totalPages = pdfInfo.pages || 1;
            setStatusMessage(`Извлечение текста со всех ${totalPages} страниц...`);
            setProgress(50);
            response = await window.electronAPI.ocrTextPdf(fileInfo.path);
            break;

          case 'tesseract':
            setStatusMessage('Конвертация PDF в изображения...');
            setProgress(5);
            const tessImagesResult = await window.electronAPI.processPdf(fileInfo.path, { method: 'tesseract' });
            if (tessImagesResult.success && tessImagesResult.files?.images) {
              const imgCount = tessImagesResult.files.images.length;
              setStatusMessage(`Tesseract: 0/${imgCount} страниц...`);
              setProgress(20);
              response = await window.electronAPI.ocrTesseract(tessImagesResult.files.imagesDir);
            } else {
              throw new Error(tessImagesResult.error || 'Не удалось конвертировать PDF');
            }
            break;

          case 'ai':
            if (aiProvider === 'ollama' && !ollamaStatus.running) {
              throw new Error('Ollama не запущен. Нажмите "Настроить Ollama" для запуска.');
            }
            if (aiProvider === 'ollama' && !isModelInstalled(effectiveAiModel)) {
              throw new Error(`Модель ${effectiveAiModel} не установлена. Скачайте модель.`);
            }
            setStatusMessage('Конвертация PDF в изображения...');
            setProgress(5);
            console.log('Sending to OCR:', { model: effectiveAiModel, provider: aiProvider });
            const aiImagesResult = await window.electronAPI.processPdf(fileInfo.path, { method: 'ai' });
            if (aiImagesResult.success && aiImagesResult.files?.images) {
              setStatusMessage(`AI Vision: распознавание (${effectiveAiModel})...`);
              setProgress(30);
              const ocrOptions = {
                provider: aiProvider,
                apiKey: apiKey || undefined,
                model: effectiveAiModel
              };
              console.log('OCR options being sent:', JSON.stringify(ocrOptions));
              response = await window.electronAPI.ocrAi(aiImagesResult.files.images[0], ocrOptions);
            } else {
              throw new Error(aiImagesResult.error || 'Не удалось конвертировать PDF');
            }
            break;

          default:
            throw new Error('Unknown method');
        }
      }

      if (response?.success) {
        setProgress(100);
        setElapsedTime(response.elapsed || null);
        setStatusMessage(response.elapsed ? `✓ Готово (${response.elapsed} сек)` : '✓ Готово!');
        setResult(response.text);
        onOcrComplete(response.text, selectedMethod);
      } else {
        throw new Error(response?.error || 'Неизвестная ошибка');
      }
    } catch (err) {
      const msg = err.message || String(err);
      setError(msg);
      setErrorDetails(err.stack || '');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setStatusMessage(''), 2000);
      setIsRetrying(false);
    }
  };

  const handleRetry = () => {
    if (selectedMethod) {
      setIsRetrying(true);
      handleOcr(true);
    }
  };

  const canStartOcr = () => {
    if (!selectedMethod) return false;
    if (isProcessing) return false;
    if (selectedMethod === 'ai' && aiProvider === 'ollama' && !ollamaStatus.running) return false;
    if (selectedMethod === 'ai' && aiProvider === 'ollama' && !isModelInstalled(effectiveAiModel)) return false;
    return true;
  };

  const getMethodLabel = (method) => {
    switch (method) {
      case 'textpdf': return 'Текстовый PDF';
      case 'tesseract': return 'Tesseract';
      case 'ai': return 'AI Vision';
      default: return method;
    }
  };

  return (
    <div className="ocr-panel">
      {!selectedMethod && (
        <>
          <div className="ollama-status">
            <p>Провайдер: {ollamaStatus.installed ? '✓ Ollama установлен' : '✗ Ollama не установлен'}</p>
            <p>{ollamaStatus.running ? '✓ Сервер запущен' : '✗ Сервер не запущен'}</p>
            {!ollamaStatus.installed && (
              <button 
                className="setup-btn"
                onClick={handleSetupOllama}
                disabled={isSettingUp}
              >
                {isSettingUp ? 'Установка...' : 'Установить Ollama'}
              </button>
            )}
            {ollamaStatus.installed && !ollamaStatus.running && (
              <button 
                className="setup-btn"
                onClick={handleSetupOllama}
                disabled={isSettingUp}
              >
                {isSettingUp ? 'Запуск...' : 'Запустить Ollama'}
              </button>
            )}
          </div>

          <div className="method-buttons">
            {!fileInfo?.isImage && (
              <button 
                className={`method-btn ${fileInfo?.isTextBased ? 'recommended' : ''}`}
                onClick={() => setSelectedMethod('textpdf')}
                disabled={isProcessing}
              >
                Текстовый PDF
                {fileInfo?.isTextBased && <span className="sub">рекомендуется</span>}
              </button>
            )}

            <button 
              className="method-btn"
              onClick={() => setSelectedMethod('tesseract')}
              disabled={isProcessing}
            >
              Tesseract
              <span className="sub">Локальный</span>
            </button>

            <button 
              className="method-btn ai"
              onClick={() => setSelectedMethod('ai')}
              disabled={isProcessing}
            >
              AI Vision
              <span className="sub">Высокое качество</span>
            </button>
          </div>
        </>
      )}

      {/* Dynamic content based on selected method */}
      {selectedMethod && (
        <>
          {/* Method header with back button */}
          <div className="selected-method-header">
            <button className="back-btn" onClick={() => { setSelectedMethod(null); setResult(null); setError(null); }} disabled={isProcessing}>
              ← Назад
            </button>
            <span className="method-title">{getMethodLabel(selectedMethod)}</span>
          </div>

          {/* AI settings - only for AI method */}
          {selectedMethod === 'ai' && (
            <div className="settings-section">
              <div className="setting-row">
                <label>API:</label>
                <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)}>
                  <option value="ollama">Ollama</option>
                  <option value="openai">OpenAI API</option>
                  <option value="google">Google Vision API</option>
                </select>
              </div>

              {aiProvider === 'ollama' && (
                <>
                  <div className="ollama-status">
                    <p>Провайдер: Ollama</p>
                    <p>Статус: {ollamaStatus.installed ? '✓ Установлен' : '✗ Не установлен'} | {ollamaStatus.running ? '✓ Запущен' : '✗ Не запущен'}</p>
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
                    <select value={effectiveAiModel} onChange={(e) => setAiModel(e.target.value)}>
                      {VISION_MODELS.map(m => {
                        const installed = isModelInstalled(m.name);
                        return (
                          <option key={m.name} value={m.name}>
                            {installed ? '✓' : '↓'} {m.label} — {m.description}
                          </option>
                        );
                      })}
                      {ollamaStatus.models.filter(m => !VISION_MODELS.some(r => r.name === m.name)).map(m => (
                        <option key={m.name} value={m.name}>{'✓'} {m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="setting-row">
                    <label>Своя модель:</label>
                    <input
                      type="text"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && customModel.trim()) setAiModel(customModel.trim()); }}
                      placeholder="name:tag"
                    />
                  </div>
                  <p className="model-hint">Введите название модели. Формат: name:tag. Список моделей: ollama.com/library</p>

                  <div className="model-recommendation-info">
                    Для русского текста: Qwen3-VL. Для баланса: Llama 3.2 Vision 11B. Для таблиц: GLM-OCR.
                  </div>

                  {ollamaStatus.installed && !isModelInstalled(effectiveAiModel) && (
                    <div className="download-section">
                      <button 
                        className="pull-btn"
                        onClick={() => handlePullModel(effectiveAiModel)}
                        disabled={!!pullProgress.status}
                      >
                        {pullProgress.percent != null && pullProgress.percent > 0
                          ? `Скачать ${effectiveAiModel}`
                          : (pullProgress.status || `Скачать ${effectiveAiModel}`)}
                      </button>
                      {pullProgress.percent != null && pullProgress.percent > 0 && (
                        <>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${pullProgress.percent}%` }} />
                          </div>
                          <div className="progress-info">
                            <span>{pullProgress.percent}%</span>
                            {pullProgress.downloaded && pullProgress.total && (
                              <span> — {pullProgress.downloaded} / {pullProgress.total}</span>
                            )}
                            {pullProgress.speed && <span> — {pullProgress.speed}</span>}
                            {pullProgress.eta && <span> — ~{pullProgress.eta}</span>}
                          </div>
                          {pullProgress.status && !pullProgress.status.match(/^\d+%/m) && (
                            <div className="progress-status-text">{pullProgress.status}</div>
                          )}
                        </>
                      )}
                    </div>
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
          )}

          {/* Start button */}
          <button 
            className="start-ocr-btn"
            onClick={() => handleOcr()}
            disabled={!canStartOcr()}
          >
            {isProcessing ? 'Обработка...' : 'Распознать'}
          </button>

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
                <span>{error}</span>
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

          {/* Result textarea - only shows after completion */}
          {result && (
            <div className="result-container">
              <textarea className="result-text" value={result} readOnly rows={6} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default OcrPanel;
