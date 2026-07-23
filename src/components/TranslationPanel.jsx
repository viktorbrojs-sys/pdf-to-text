import React, { useState, useEffect } from 'react';

const DEFAULT_SYSTEM_PROMPT = `Ты — профессиональный переводчик. Переведи текст с русского на английский язык.
Сохрани форматирование: заголовки, списки, таблицы.
Не переводи имена собственные, аббревиатуры и технические термины, если они не указаны в паттернах перевода.`;

const TRANSLATION_MODELS = [
  { name: 'qwen2.5:32b', label: 'Qwen2.5 32B', category: 'Качество', description: 'Высокое качество для русского' },
  { name: 'qwen2.5:14b', label: 'Qwen2.5 14B', category: 'Баланс', description: 'Хорошее качество, умеренный размер' },
  { name: 'qwen2.5:7b', label: 'Qwen2.5 7B', category: 'Скорость', description: 'Быстрый, хорошее качество' },
  { name: 'llama3.1:8b', label: 'Llama 3.1 8B', category: 'Баланс', description: 'Универсальная модель' },
  { name: 'llama3.1:70b', label: 'Llama 3.1 70B', category: 'Качество', description: 'Максимальное качество' },
  { name: 'deepseek-r1:7b', label: 'DeepSeek R1 7B', category: 'Рассуждения', description: 'Хорошо рассуждает' },
  { name: 'mistral:7b', label: 'Mistral 7B', category: 'Скорость', description: 'Быстрая модель' },
];

function TranslationPanel({ sourceText, onTranslationComplete }) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState('');
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  const [ollamaStatus, setOllamaStatus] = useState({ installed: false, running: false, models: [] });
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [pullProgress, setPullProgress] = useState({ status: '', percent: null });
  
  const [provider, setProvider] = useState('ollama');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('qwen2.5:7b');
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  
  const [patterns, setPatterns] = useState([
    { source: 'ДНК', target: 'DNA' },
    { source: 'ХБМ', target: 'HBM' },
    { source: 'УЗИ', target: 'US' },
  ]);
  const [newPatternSource, setNewPatternSource] = useState('');
  const [newPatternTarget, setNewPatternTarget] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [translateProgress, setTranslateProgress] = useState({ current: 0, total: 0, message: '' });
  const [elapsedTime, setElapsedTime] = useState(null);

  useEffect(() => {
    checkOllamaStatus();
    
    if (window.electronAPI?.onOllamaProgress) {
      window.electronAPI.onOllamaProgress((progress) => {
        setPullProgress(progress);
      });
    }

    if (window.electronAPI?.onTranslationProgress) {
      window.electronAPI.onTranslationProgress((progress) => {
        setTranslateProgress(progress);
      });
    }
  }, []);

  const checkOllamaStatus = async () => {
    try {
      const status = await window.electronAPI.ollamaStatus();
      setOllamaStatus(status);
      
      if (status.installed && status.models.length > 0) {
        const preferred = status.models.find(m => m.name.startsWith('qwen2.5')) || status.models[0];
        setModel(preferred.name);
      }
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
    setErrorDetails('');
    setStatusMessage('Проверка и установка Ollama...');
    
    try {
      const result = await window.electronAPI.ollamaSetup();
      setOllamaStatus(result);
      
      if (result.installed && result.models?.length > 0) {
        const preferred = result.models.find(m => m.name.startsWith('qwen2.5')) || result.models[0];
        setModel(preferred.name);
      }
      
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
    setPullProgress({ status: 'Начинаем скачивание...', percent: 0 });
    
    try {
      await window.electronAPI.ollamaPull(modelName);
      setPullProgress({ status: 'Готово!', percent: 100 });
      await checkOllamaStatus();
      setModel(modelName);
      setTimeout(() => setPullProgress({ status: '', percent: null }), 2000);
    } catch (err) {
      setError(err.message);
      setErrorDetails(err.stack || '');
      setPullProgress({ status: '', percent: null });
    }
  };

  const handleTranslate = async (isRetry = false) => {
    if (!sourceText) {
      setError('Нет текста для перевода');
      return;
    }

    if (provider === 'ollama' && !ollamaStatus.running) {
      setError('Ollama не запущен. Нажмите "Настроить Ollama"');
      return;
    }

    if (provider === 'ollama' && !isModelInstalled(model)) {
      setError(`Модель ${model} не установлена. Скачайте модель или выберите установленную.`);
      return;
    }

    setIsTranslating(true);
    setError(null);
    setErrorDetails('');
    setShowErrorDetails(false);
    setResult(null);
    setElapsedTime(null);
    setTranslateProgress({ current: 0, total: 0, message: 'Переводим...' });

    try {
      const glossary = {};
      patterns.forEach(p => { glossary[p.source] = p.target; });

      const response = await window.electronAPI.translate(sourceText, {
        provider,
        apiKey: apiKey || undefined,
        model,
        systemPrompt,
        glossary
      });

      setTranslateProgress({ current: 1, total: 1, message: 'Готово!' });

      if (response.success) {
        setElapsedTime(response.elapsed || null);
        setResult(response.text);
        onTranslationComplete(response.text);
      } else {
        throw new Error(response.error || 'Неизвестная ошибка перевода');
      }
    } catch (err) {
      const msg = err.message || String(err);
      setError(msg);
      setErrorDetails(err.stack || '');
    } finally {
      setIsTranslating(false);
      setIsRetrying(false);
      setTimeout(() => setTranslateProgress({ current: 0, total: 0, message: '' }), 2000);
    }
  };

  const handleRetry = () => {
    setIsRetrying(true);
    handleTranslate(true);
  };

  const addPattern = () => {
    if (newPatternSource && newPatternTarget) {
      setPatterns([...patterns, { source: newPatternSource, target: newPatternTarget }]);
      setNewPatternSource('');
      setNewPatternTarget('');
    }
  };

  const removePattern = (index) => {
    setPatterns(patterns.filter((_, i) => i !== index));
  };

  return (
    <div className="translation-panel">

      {/* Error Banner with details */}
      {error && (
        <div className="error-block">
          <div className="error-banner">
            <span>{'✗'} {error}</span>
            <button onClick={() => { setError(null); setErrorDetails(''); }}>✕</button>
          </div>
          <div className="error-actions">
            <button className="retry-btn" onClick={handleRetry} disabled={isTranslating || isRetrying}>
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
          {showErrorDetails && errorDetails && (
            <pre className="error-details">{errorDetails}</pre>
          )}
        </div>
      )}

      {/* Status Banner */}
      {statusMessage && (
        <div className="status-banner">
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Provider Settings */}
      <div className="settings-section">
        <h3>Настройки</h3>
        <div className="setting-row">
          <label>Провайдер:</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="ollama">Ollama (локальный)</option>
            <option value="openai">OpenAI API</option>
            <option value="deepseek">DeepSeek API</option>
            <option value="deepl">DeepL API</option>
          </select>
        </div>

        {provider === 'ollama' && (
          <>
            <div className="ollama-status">
              <p>
                {ollamaStatus.installed ? '✓ Ollama установлен' : '✗ Ollama не установлен'}
                {ollamaStatus.running ? ' | ✓ Сервер запущен' : ' | ✗ Сервер не запущен'}
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

            <div className="setting-row">
              <label>Модель:</label>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                {TRANSLATION_MODELS.map(m => {
                  const installed = isModelInstalled(m.name);
                  return (
                    <option key={m.name} value={m.name}>
                      {installed ? '✓' : '↓'} {m.label} [{m.category}] — {m.description}
                    </option>
                  );
                })}
                {ollamaStatus.models.filter(m => !TRANSLATION_MODELS.some(r => r.name === m.name)).map(m => (
                  <option key={m.name} value={m.name}>{'✓'} {m.name}</option>
                ))}
              </select>
            </div>

            <div className="model-recommendation-info">
              Для русского→английского: Qwen2.5 32B (лучшее качество) или 7B (быстрее). Для сложных текстов: DeepSeek R1.
            </div>

            {ollamaStatus.installed && !isModelInstalled(model) && (
              <div className="download-section">
                <button 
                  className="pull-btn"
                  onClick={() => handlePullModel(model)}
                  disabled={!!pullProgress.status}
                >
                  {pullProgress.status || `Скачать ${model}`}
                </button>
                {pullProgress.percent !== null && pullProgress.percent > 0 && (
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pullProgress.percent}%` }} />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {provider !== 'ollama' && (
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

      {/* System Prompt */}
      <div className="settings-section">
        <h3>Системный промт</h3>
        <textarea 
          className="system-prompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={3}
        />
      </div>

      {/* Glossary Patterns */}
      <div className="settings-section">
        <h3>Паттерны перевода</h3>
        
        <div className="patterns-list">
          {patterns.map((p, i) => (
            <div key={i} className="pattern-item">
              <span>{p.source} → {p.target}</span>
              <button onClick={() => removePattern(i)}>✕</button>
            </div>
          ))}
        </div>

        <div className="add-pattern">
          <input 
            type="text" 
            value={newPatternSource}
            onChange={(e) => setNewPatternSource(e.target.value)}
            placeholder="Исходное"
          />
          <span>→</span>
          <input 
            type="text" 
            value={newPatternTarget}
            onChange={(e) => setNewPatternTarget(e.target.value)}
            placeholder="Перевод"
          />
          <button onClick={addPattern}>+</button>
        </div>
      </div>

      {/* Translation Progress */}
      {isTranslating && (
        <div className="translation-progress">
          <div className="progress-label active">{translateProgress.message || 'Переводим...'}</div>
          {translateProgress.total > 0 && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${(translateProgress.current / translateProgress.total) * 100}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Translate Button */}
      <button 
        className="translate-btn"
        onClick={() => handleTranslate()}
        disabled={isTranslating || !sourceText}
      >
        {isTranslating ? '... Переводим...' : '⇄ Перевести'}
      </button>

      {elapsedTime && !isTranslating && (
        <div className="status-message">✓ Готово ({elapsedTime} сек)</div>
      )}

      {/* Result */}
      {result && (
        <div className="result-container">
          <textarea 
            className="result-text" 
            value={result} 
            readOnly 
            rows={6}
          />
        </div>
      )}
    </div>
  );
}

export default TranslationPanel;
