const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const logger = require('./logger');

const OLLAMA_TIMEOUT = 300000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

function isOllamaRunning() {
  try {
    execSync('ollama list', { encoding: 'utf-8', timeout: 5000, stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

async function restartOllama() {
  logger.info('Attempting Ollama restart from translate');
  try {
    execSync('pkill -f "ollama serve" || true', { encoding: 'utf-8', timeout: 5000, stdio: 'ignore' });
  } catch (e) {}

  await new Promise(r => setTimeout(r, 1000));

  try {
    const child = spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' });
    child.unref();
  } catch (e) {
    logger.error('Failed to spawn ollama serve', { error: e.message });
    return false;
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(isOllamaRunning());
    }, 3000);
  });
}

async function fetchWithTimeout(url, options, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (error) {
    clearTimeout(timer);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout / 1000}s. Ollama may be processing a large text.`);
    }
    throw error;
  }
}

/**
 * Translation Module
 * Supports: Ollama (local), OpenAI, DeepL, Anthropic
 */

// Default system prompt
const DEFAULT_SYSTEM_PROMPT = `Ты — профессиональный переводчик. Переведи текст с русского на английский язык.
Сохрани форматирование: заголовки, списки, таблицы.
Не переводи имена собственные, аббревиатуры и технические термины, если они не указаны в паттернах перевода.`;

/**
 * Load glossary patterns from CSV
 * @param {string} csvPath - Path to CSV file
 * @returns {Object} Pattern mappings
 */
function loadGlossary(csvPath) {
  if (!fs.existsSync(csvPath)) return {};
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const patterns = {};
  
  for (const line of lines) {
    const [source, target] = line.split(',').map(s => s.trim());
    if (source && target) {
      patterns[source] = target;
    }
  }
  
  return patterns;
}

/**
 * Save glossary patterns to CSV
 * @param {Object} patterns - Pattern mappings
 * @param {string} csvPath - Path to CSV file
 */
function saveGlossary(patterns, csvPath) {
  const lines = Object.entries(patterns).map(([k, v]) => `${k},${v}`);
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf-8');
}

/**
 * Apply glossary patterns to text before translation
 * @param {string} text - Source text
 * @param {Object} patterns - Pattern mappings
 * @returns {string} Text with patterns replaced
 */
function applyGlossary(text, patterns) {
  let result = text;
  for (const [source, target] of Object.entries(patterns)) {
    // Case-insensitive replacement
    const regex = new RegExp(source, 'gi');
    result = result.replace(regex, `[${target}]`);
  }
  return result;
}

/**
 * Restore glossary patterns after translation
 * @param {string} text - Translated text
 * @param {Object} patterns - Pattern mappings
 * @returns {string} Text with patterns restored
 */
function restoreGlossary(text, patterns) {
  if (!text || typeof text !== 'string') {
    return text || '';
  }
  let result = text;
  for (const [source, target] of Object.entries(patterns)) {
    // Remove brackets around translated terms
    const regex = new RegExp(`\\[${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g');
    result = result.replace(regex, target);
  }
  return result;
}

/**
 * Translate with Ollama (Local LLM)
 * @param {string} text - Text to translate
 * @param {Object} options - Options
 * @returns {Promise<string>} Translated text
 */
async function translateWithOllama(text, options = {}) {
  const { 
    model = 'llama3', 
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    glossary = {}
  } = options;
  
  const processedText = applyGlossary(text, glossary);
  logger.info('Ollama translation request', { model, textLength: text.length });
  
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info('Ollama translate attempt', { attempt, model });

      const response = await fetchWithTimeout('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          system: systemPrompt,
          prompt: processedText,
          stream: false
        })
      }, OLLAMA_TIMEOUT);
    
      if (!response.ok) {
        throw new Error(`Ollama server error: ${response.status}`);
      }
    
      const data = await response.json();
    
      if (!data.response) {
        throw new Error('Ollama returned empty response. Model may not be loaded.');
      }
    
      logger.info('Ollama translate success', { attempt, model });
      return restoreGlossary(data.response, glossary);
    } catch (error) {
      lastError = error;
      logger.error('Ollama translate attempt failed', { attempt, error: error.message });

      const isConnectionError = error.message.includes('fetch failed') ||
                                 error.message.includes('ECONNREFUSED') ||
                                 error.message.includes('ECONNRESET');

      if (isConnectionError && attempt < MAX_RETRIES) {
        logger.info('Connection error, attempting Ollama restart...', { attempt });
        const restarted = await restartOllama();
        if (restarted) {
          logger.info('Ollama restarted, retrying...');
          await new Promise(r => setTimeout(r, RETRY_DELAY));
          continue;
        }
      }

      if (attempt < MAX_RETRIES) {
        logger.info('Retrying after delay...', { attempt, delay: RETRY_DELAY });
        await new Promise(r => setTimeout(r, RETRY_DELAY));
        continue;
      }

      break;
    }
  }

  throw new Error(`Ollama translation failed after ${MAX_RETRIES} attempts: ${lastError.message}. Start Ollama with: ollama serve`);
}

/**
 * Translate with OpenAI API
 * @param {string} text - Text to translate
 * @param {Object} options - Options
 * @returns {Promise<string>} Translated text
 */
async function translateWithOpenAI(text, options = {}) {
  const { 
    apiKey,
    model = 'gpt-4o',
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    glossary = {}
  } = options;
  
  if (!apiKey) throw new Error('OpenAI API key required');
  
  const processedText = applyGlossary(text, glossary);
  logger.info('OpenAI translation request', { model });
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: processedText }
        ],
        max_tokens: 8192
      })
    });
    
    const data = await response.json();
    
    if (data.error) throw new Error(data.error.message);
    
    return restoreGlossary(data.choices[0].message.content, glossary);
  } catch (error) {
    logger.error('OpenAI API error', { error: error.message });
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

/**
 * Translate with DeepL API
 * @param {string} text - Text to translate
 * @param {Object} options - Options
 * @returns {Promise<string>} Translated text
 */
async function translateWithDeepL(text, options = {}) {
  const { apiKey, glossary = {} } = options;
  
  if (!apiKey) throw new Error('DeepL API key required');
  
  const processedText = applyGlossary(text, glossary);
  logger.info('DeepL translation request');
  
  try {
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: [processedText],
        target_lang: 'EN',
        source_lang: 'RU'
      })
    });
    
    const data = await response.json();
    
    if (data.message) throw new Error(data.message);
    
    return restoreGlossary(data.translations[0].text, glossary);
  } catch (error) {
    logger.error('DeepL API error', { error: error.message });
    throw new Error(`DeepL API error: ${error.message}`);
  }
}

/**
 * Translate with DeepSeek API
 * @param {string} text - Text to translate
 * @param {Object} options - Options
 * @returns {Promise<string>} Translated text
 */
async function translateWithDeepSeek(text, options = {}) {
  const {
    apiKey,
    model = 'deepseek-chat',
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    glossary = {}
  } = options;

  if (!apiKey) throw new Error('DeepSeek API key required');

  const processedText = applyGlossary(text, glossary);
  logger.info('DeepSeek translation request', { model });

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: processedText }
        ],
        max_tokens: 8192
      })
    });

    const data = await response.json();

    if (data.error) throw new Error(data.error.message);

    return restoreGlossary(data.choices[0].message.content, glossary);
  } catch (error) {
    logger.error('DeepSeek API error', { error: error.message });
    throw new Error(`DeepSeek API error: ${error.message}`);
  }
}

/**
 * Split text into chunks of maxChunkSize characters, breaking at sentence boundaries
 */
function splitIntoChunks(text, maxChunkSize = 2000) {
  if (text.length <= maxChunkSize) return [text];
  
  const chunks = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxChunkSize) {
      chunks.push(remaining);
      break;
    }
    
    let splitIdx = -1;
    const searchArea = remaining.substring(0, maxChunkSize);
    
    // Try to split at sentence boundary
    const sentenceEnd = searchArea.lastIndexOf('. ');
    if (sentenceEnd > maxChunkSize * 0.5) {
      splitIdx = sentenceEnd + 1;
    } else {
      // Try newline
      const newline = searchArea.lastIndexOf('\n');
      if (newline > maxChunkSize * 0.3) {
        splitIdx = newline + 1;
      } else {
        // Force split at maxChunkSize
        splitIdx = maxChunkSize;
      }
    }
    
    chunks.push(remaining.substring(0, splitIdx).trim());
    remaining = remaining.substring(splitIdx).trim();
  }
  
  return chunks;
}

/**
 * Main translation function
 * @param {string} text - Text to translate
 * @param {Object} options - Options
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Promise<string>} Translated text
 */
async function translate(text, options = {}, onProgress = null) {
  const { provider = 'ollama', ...rest } = options;

  const chunks = splitIntoChunks(text, 2000);
  
  if (chunks.length === 1) {
    const result = await translateByProvider(provider, chunks[0], rest);
    return result;
  }

  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) {
      onProgress({ current: i + 1, total: chunks.length, message: `Переводим часть ${i + 1}/${chunks.length}...` });
    }
    const translated = await translateByProvider(provider, chunks[i], rest);
    results.push(translated);
  }
  
  return results.join('\n\n');
}

async function translateByProvider(provider, text, options) {
  switch (provider) {
    case 'ollama':
      return translateWithOllama(text, options);
    case 'openai':
      return translateWithOpenAI(text, options);
    case 'deepl':
      return translateWithDeepL(text, options);
    case 'deepseek':
      return translateWithDeepSeek(text, options);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

module.exports = {
  translate,
  translateWithOllama,
  translateWithOpenAI,
  translateWithDeepL,
  translateWithDeepSeek,
  loadGlossary,
  saveGlossary,
  DEFAULT_SYSTEM_PROMPT
};
