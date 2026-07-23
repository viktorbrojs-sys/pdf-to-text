import React, { useState, useRef, useEffect } from 'react';

function ModelSelect({ models, value, onChange, installedModels = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(value);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setSelectedModel(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isModelInstalled = (modelName) => {
    const baseName = modelName.split(':')[0];
    return installedModels.some(m => m.name === modelName || m.name.startsWith(baseName));
  };

  const getSelectedModelInfo = () => {
    const model = models.find(m => m.name === selectedModel);
    if (model) {
      return {
        name: model.label || model.name,
        description: model.description || model.category || '',
        installed: isModelInstalled(model.name)
      };
    }
    const installed = installedModels.find(m => m.name === selectedModel);
    if (installed) {
      return { name: installed.name, description: '', installed: true };
    }
    return { name: 'Выберите модель', description: '', installed: false };
  };

  const selected = getSelectedModelInfo();

  return (
    <div className="model-select" ref={dropdownRef}>
      <div
        className="model-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="model-select-value">
          <span className="model-select-name">{selected.name}</span>
          {selected.description && (
            <span className="model-select-desc">{selected.description}</span>
          )}
        </div>
        <span className={`model-select-arrow ${isOpen ? 'open' : ''}`}>▾</span>
      </div>

      {isOpen && (
        <div className="model-select-dropdown">
          {models.map(m => {
            const installed = isModelInstalled(m.name);
            return (
              <div
                key={m.name}
                className={`model-select-option ${m.name === selectedModel ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedModel(m.name);
                  onChange(m.name);
                  setIsOpen(false);
                }}
              >
                <div className="model-option-content">
                  <span className="model-option-name">
                    {installed ? '✓ ' : '↓ '}
                    {m.label || m.name}
                  </span>
                  {m.description && (
                    <span className="model-option-desc">{m.description}</span>
                  )}
                </div>
              </div>
            );
          })}
          {installedModels
            .filter(m => !models.some(r => r.name === m.name))
            .map(m => (
              <div
                key={m.name}
                className={`model-select-option not-recommended ${m.name === selectedModel ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedModel(m.name);
                  onChange(m.name);
                  setIsOpen(false);
                }}
              >
                <div className="model-option-content">
                  <span className="model-option-name not-rec-name">
                    ✗ {m.name}
                  </span>
                  <span className="model-option-desc">не рекомендуется</span>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

export default ModelSelect;
