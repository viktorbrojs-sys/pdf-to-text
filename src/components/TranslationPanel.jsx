import React, { useState, useEffect } from 'react';

const DEFAULT_SYSTEM_PROMPT = `Ты — профессиональный переводчик. Переведи текст с русского на английский язык.
Сохрани форматирование: заголовки, списки, таблицы.
Не переводи имена собственные, аббревиатуры и технические термины, если они не указаны в паттернах перевода.`;

function TranslationPanel({ sourceText, onTranslationComplete }) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Ollama status
  const [ollamaStatus, setOllamaStatus] = useState({ installed: false, running: false, models: [] });
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [pullProgress, setPullProgress] = useState('');
  
  // Settings
  const [provider, setProvider] = useState('ollama');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('qwen2.5:7b');
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  
  // Glossary patterns
  const [patterns, setPatterns] = useState([
    { source: 'ДНК', target: 'DNA' },
    { source: 'ХБМ', target: 'HBM' },
    { source: 'УЗИ', target: 'US' },
  ]);
  const [newPatternSource, setNewPatternSource] = useState('');
  const [newPatternTarget, setNewPatternTarget] = useState('');

  // Check Ollama status on mount
  useEffect(() => {
    checkOllamaStatus();
  }, []);

  const checkOllamaStatus = async () => {
    try {
      const status = await window.electronAPI.ollamaStatus();
      setOllamaStatus(status);
      
      if (status.installed && status.models.length > 0) {
        setModel(status.models[0].name);
      }
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
      
      if (result.installed && result.models.length > 0) {
        setModel(result.models[0].name);
      }
      
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
      setModel(modelName);
    } catch (err) {
      setError(err.message);
      setPullProgress('');
    }
  };

  const handleTranslate = async () => {
    if (!sourceText) {
      setError('Нет текста для перевода');
      return;
    }

    if (provider === 'ollama' && !ollamaStatus.running) {
      setError('Ollama не запущен. Нажмите "Настроить Ollama"');
      return;
    }

    setIsTranslating(true);
    setError(null);
    setResult(null);

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

      if (response.success) {
        setResult(response.text);
        onTranslationComplete(response.text);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsTranslating(false);
    }
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
      <h2>Перевод</h2>

      {/* Provider Settings */}
      <div className="settings-section">
        <h3>Настройки</h3>
        <div className="setting-row">
          <label>Провайдер:</label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="ollama">Ollama (локальный)</option>
            <option value="openai">OpenAI API</option>
            <option value="deepl">DeepL API</option>
          </select>
        </div>

        {provider === 'ollama' && (
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
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                {ollamaStatus.models.length > 0 ? (
                  ollamaStatus.models.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))
                ) : (
                  <>
                    <option value="qwen2.5:7b">qwen2.5:7b (рекомендуется)</option>
                    <option value="llama3.1:8b">llama3.1:8b</option>
                    <option value="mistral:7b">mistral:7b</option>
                  </>
                )}
              </select>
            </div>

            {/* Pull Model */}
            {ollamaStatus.installed && !ollamaStatus.models.some(m => m.name === model) && (
              <div className="pull-model">
                <button 
                  className="pull-btn"
                  onClick={() => handlePullModel(model)}
                  disabled={!!pullProgress}
                >
                  {pullProgress || `Скачать ${model}`}
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
          rows={5}
        />
      </div>

      {/* Glossary Patterns */}
      <div className="settings-section">
        <h3>Паттерны перевода (аббревиатуры)</h3>
        
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

      {/* Translate Button */}
      <button 
        className="translate-btn"
        onClick={handleTranslate}
        disabled={isTranslating || !sourceText}
      >
        {isTranslating ? '⏳ Переводим...' : '🔄 Перевести'}
      </button>

      {/* Error */}
      {error && (
        <div className="error-message">❌ {error}</div>
      )}

      {/* Status */}
      {statusMessage && (
        <div className="status-message">ℹ️ {statusMessage}</div>
      )}

      {/* Result */}
      {result && (
        <div className="result-container">
          <h3>Перевод</h3>
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

export default TranslationPanel;
