const { execSync, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

/**
 * Ollama Setup Module
 * Auto-detects OS, checks/installs Ollama, manages models
 */

const RECOMMENDED_MODELS = [
  { name: 'qwen2.5:7b', size: '4.7GB', description: 'Отличное для русского языка' },
  { name: 'llama3.1:8b', size: '4.7GB', description: 'Хорошее общее качество' },
  { name: 'mistral:7b', size: '4.1GB', description: 'Быстрое, среднее качество' },
  { name: 'gemma2:9b', size: '5.4GB', description: 'Отличное, но больше размер' }
];

const DEFAULT_MODEL = 'qwen2.5:7b';

/**
 * Get OS type
 */
function getOsType() {
  const platform = os.platform();
  if (platform === 'linux') return 'linux';
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  return 'unknown';
}

/**
 * Check if Ollama is installed
 */
function isOllamaInstalled() {
  try {
    execSync('ollama --version', { encoding: 'utf-8', stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Check if Ollama server is running
 */
function isOllamaRunning() {
  try {
    execSync('ollama list', { encoding: 'utf-8', timeout: 5000 });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Start Ollama server
 */
function startOllamaServer() {
  return new Promise((resolve, reject) => {
    const child = spawn('ollama', ['serve'], { 
      detached: true, 
      stdio: 'ignore' 
    });
    child.unref();
    
    // Wait a bit for server to start
    setTimeout(() => {
      if (isOllamaRunning()) {
        resolve(true);
      } else {
        reject(new Error('Failed to start Ollama server'));
      }
    }, 3000);
  });
}

/**
 * Install Ollama
 */
async function installOllama(onProgress = () => {}) {
  const osType = getOsType();
  
  onProgress('Установка Ollama...');
  
  try {
    if (osType === 'linux' || osType === 'macos') {
      execSync('curl -fsSL https://ollama.com/install.sh | sh', { 
        encoding: 'utf-8',
        timeout: 300000 // 5 minutes
      });
    } else if (osType === 'windows') {
      throw new Error('Для Windows скачайте Ollama с https://ollama.com/download');
    }
    
    onProgress('Ollama установлен!');
    return true;
  } catch (error) {
    throw new Error(`Ошибка установки Ollama: ${error.message}`);
  }
}

/**
 * Get list of installed models
 */
function getInstalledModels() {
  try {
    const output = execSync('ollama list', { encoding: 'utf-8' });
    const lines = output.trim().split('\n').slice(1); // Skip header
    
    return lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        name: parts[0],
        size: parts[2] || '',
        modified: parts.slice(3).join(' ') || ''
      };
    }).filter(m => m.name);
  } catch (e) {
    return [];
  }
}

/**
 * Check if model is installed
 */
function isModelInstalled(modelName) {
  const models = getInstalledModels();
  return models.some(m => m.name === modelName || m.name.startsWith(modelName.split(':')[0]));
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\[\?[0-9]*[a-z]/g, '');
}

function parsePullProgress(cleaned) {
  const progress = { percent: null, downloaded: null, total: null, speed: null, eta: null };

  const pctMatch = cleaned.match(/(\d+)%/);
  if (pctMatch) progress.percent = parseInt(pctMatch[1], 10);

  const sizeMatch = cleaned.match(/([\d.]+\s*[KMG]B)\s*\/\s*([\d.]+\s*[KMG]B)/i);
  if (sizeMatch) {
    progress.downloaded = sizeMatch[1].trim();
    progress.total = sizeMatch[2].trim();
  }

  const speedMatch = cleaned.match(/([\d.]+\s*[KMG]B\/s)/i);
  if (speedMatch) progress.speed = speedMatch[1].trim();

  const etaMatch = cleaned.match(/(\d+[smhd]\d*[smhd]?|\d+[smhd])/);
  if (etaMatch) progress.eta = etaMatch[1].trim();

  return progress;
}

/**
 * Pull model with progress
 */
async function pullModel(modelName, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('ollama', ['pull', modelName]);
    let output = '';
    let buf = '';
    
    child.stdout.on('data', (data) => {
      buf += data.toString();
      const parts = buf.split('\n');
      buf = parts.pop();
      for (const part of parts) {
        const cleaned = stripAnsi(part).trim();
        if (!cleaned) continue;
        try {
          const json = JSON.parse(cleaned);
          if (json.status) {
            const pct = json.completed != null && json.total
              ? Math.round((json.completed / json.total) * 100)
              : null;
            onProgress({ status: json.status, percent: pct });
          }
        } catch (e) {
          const parsed = parsePullProgress(cleaned);
          onProgress({ status: cleaned, percent: parsed.percent, downloaded: parsed.downloaded, total: parsed.total, speed: parsed.speed, eta: parsed.eta });
        }
      }
    });
    
    child.stderr.on('data', (data) => {
      buf += data.toString();
      const parts = buf.split('\n');
      buf = parts.pop();
      for (const part of parts) {
        const cleaned = stripAnsi(part).trim();
        if (!cleaned) continue;
        if (cleaned.includes('pulling') || cleaned.includes('verifying')) {
          const parsed = parsePullProgress(cleaned);
          onProgress({ status: cleaned, percent: parsed.percent, downloaded: parsed.downloaded, total: parsed.total, speed: parsed.speed, eta: parsed.eta });
        }
      }
    });
    
    child.on('close', (code) => {
      if (buf.trim()) {
        const cleaned = stripAnsi(buf).trim();
        try {
          const json = JSON.parse(cleaned);
          if (json.status) {
            onProgress({ status: json.status, percent: null });
          }
        } catch (e) {
          const parsed = parsePullProgress(cleaned);
          onProgress({ status: cleaned, percent: parsed.percent });
        }
      }
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`Failed to pull model: ${output}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Get recommended model for Russian
 */
function getRecommendedModel() {
  return RECOMMENDED_MODELS[0]; // qwen2.5:7b
}

/**
 * Full setup check
 */
async function setupCheck(onProgress = () => {}) {
  const result = {
    os: getOsType(),
    ollamaInstalled: false,
    ollamaRunning: false,
    installedModels: [],
    recommendedModel: getRecommendedModel()
  };
  
  onProgress('Проверка Ollama...');
  result.ollamaInstalled = isOllamaInstalled();
  
  if (!result.ollamaInstalled) {
    onProgress('Ollama не установлен. Установка...');
    await installOllama(onProgress);
    result.ollamaInstalled = true;
  }
  
  onProgress('Проверка сервера Ollama...');
  result.ollamaRunning = isOllamaRunning();
  
  if (!result.ollamaRunning) {
    onProgress('Запуск сервера Ollama...');
    try {
      await startOllamaServer();
      result.ollamaRunning = true;
    } catch (e) {
      onProgress('Не удалось запустить Ollama автоматически. Запустите вручную: ollama serve');
    }
  }
  
  onProgress('Проверка моделей...');
  result.installedModels = getInstalledModels();
  
  return result;
}

module.exports = {
  RECOMMENDED_MODELS,
  DEFAULT_MODEL,
  getOsType,
  isOllamaInstalled,
  isOllamaRunning,
  startOllamaServer,
  installOllama,
  getInstalledModels,
  isModelInstalled,
  pullModel,
  getRecommendedModel,
  setupCheck
};
