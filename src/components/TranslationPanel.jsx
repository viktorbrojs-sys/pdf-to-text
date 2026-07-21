import React, { useState } from 'react';

const DEFAULT_SYSTEM_PROMPT = `Ты — профессиональный переводчик. Переведи текст с русского на английский язык.
Сохрани форматирование: заголовки, списки, таблицы.
Не переводи имена собственные, аббревиатуры и технические термины, если они не указаны в паттернах перевода.`;

function TranslationPanel({ sourceText, onTranslationComplete }) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Settings
  const [provider, setProvider] = useState('ollama');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('llama3');
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  
  // Glossary patterns
  const [patterns, setPatterns] = useState([
    { source: 'ДНК', target: 'DNA' },
    { source: 'ХБМ', target: 'HBM' },
    { source: 'УЗИ', target: 'US' },
  ]);
  const [newPatternSource, setNewPatternSource] = useState('');
  const [newPatternTarget, setNewPatternTarget] = useState('');

  const handleTranslate = async () => {
    if (!sourceText) {
      setError('Нет текста для перевода');
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

        {provider === 'ollama' && (
          <div className="setting-row">
            <label>Модель:</label>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="llama3">LLaMA 3</option>
              <option value="mistral">Mistral</option>
              <option value="qwen2">Qwen 2</option>
            </select>
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
