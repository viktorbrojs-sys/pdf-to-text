const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const logger = require('./logger');

const OLLAMA_TIMEOUT = 120000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

function imageToBase64(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString('base64');
}

function isOllamaRunning() {
  try {
    execSync('ollama list', { encoding: 'utf-8', timeout: 5000, stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function getInstalledModels() {
  try {
    const output = execSync('ollama list', { encoding: 'utf-8', timeout: 5000 });
    return output.split('\n').slice(1).map(line => line.split(/\s+/)[0]).filter(Boolean);
  } catch (e) {
    return [];
  }
}

async function restartOllama() {
  logger.info('Attempting Ollama restart from ocr-ai');
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
      throw new Error(`Request timed out after ${timeout / 1000}s. Ollama may be overloaded or the model is too large.`);
    }
    throw error;
  }
}

async function ocrWithOllama(imagePath, options = {}) {
  logger.info('ocrWithOllama called with options:', JSON.stringify(options));
  
  const { model = 'llava', prompt = 'Извлеки весь текст с этого изображения. Сохрани форматирование.' } = options;
  logger.info('ocrWithOllama model:', model);

  const installedModels = getInstalledModels();
  if (!installedModels.some(m => m.startsWith(model.split(':')[0]))) {
    logger.error('Model not installed:', { requested: model, available: installedModels });
    throw new Error(`Model ${model} is not installed. Available: ${installedModels.join(', ')}`);
  }

  const base64 = imageToBase64(imagePath);
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info('Ollama OCR attempt', { attempt, model, imageSize: base64.length });

      const response = await fetchWithTimeout('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          images: [base64],
          stream: false
        })
      }, OLLAMA_TIMEOUT);

      const data = await response.json();
      logger.info('Ollama OCR response', { response: data.response?.substring(0, 100) });

      if (!data.response || data.response.trim() === '') {
        const englishPrompt = 'Extract all text from this image. Preserve formatting.';
        logger.info('Trying with English prompt', { model });

        const englishResponse = await fetchWithTimeout('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt: englishPrompt,
            images: [base64],
            stream: false
          })
        }, OLLAMA_TIMEOUT);

        const englishData = await englishResponse.json();
        logger.info('English prompt response', { response: englishData.response?.substring(0, 100) });

        if (englishData.response) {
          return englishData.response;
        }
        throw new Error('Model returned empty response. The model may not support vision input.');
      }

      logger.info('Ollama OCR success', { attempt, model });
      return data.response;
    } catch (error) {
      lastError = error;
      logger.error('Ollama OCR attempt failed', { attempt, error: error.message });

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

  throw new Error(`Ollama OCR failed after ${MAX_RETRIES} attempts: ${lastError.message}. Make sure Ollama is running (ollama serve) and the model supports vision.`);
}

async function ocrWithOpenAI(imagePath, options = {}) {
  const { apiKey, model = 'gpt-4o', prompt = 'Извлеки весь текст с этого изображения. Сохрани форматирование.' } = options;
  
  if (!apiKey) throw new Error('OpenAI API key required');
  
  const base64 = imageToBase64(imagePath);
  const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
          ]
        }],
        max_tokens: 4096
      })
    });
    
    const data = await response.json();
    
    if (data.error) throw new Error(data.error.message);
    
    return data.choices[0].message.content;
  } catch (error) {
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

async function ocrWithGoogleVision(imagePath, options = {}) {
  const { apiKey } = options;
  
  if (!apiKey) throw new Error('Google Vision API key required');
  
  const base64 = imageToBase64(imagePath);
  
  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64 },
            features: [{ type: 'TEXT_DETECTION', maxResults: 10 }]
          }]
        })
      }
    );
    
    const data = await response.json();
    
    if (data.error) throw new Error(data.error.message);
    
    return data.responses[0]?.fullTextAnnotation?.text || '';
  } catch (error) {
    throw new Error(`Google Vision API error: ${error.message}`);
  }
}

async function ocrWithAI(imagePath, options = {}) {
  const { provider = 'ollama', ...rest } = options;
  
  switch (provider) {
    case 'ollama':
      return ocrWithOllama(imagePath, rest);
    case 'openai':
      return ocrWithOpenAI(imagePath, rest);
    case 'google':
      return ocrWithGoogleVision(imagePath, rest);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function processMultipleImages(imagePaths, options = {}, onProgress = () => {}) {
  const texts = [];
  
  for (let i = 0; i < imagePaths.length; i++) {
    onProgress(i + 1, imagePaths.length, Math.round((i / imagePaths.length) * 100));
    
    const text = await ocrWithAI(imagePaths[i], options);
    texts.push(text);
  }
  
  return texts.join('\n\n');
}

module.exports = {
  ocrWithAI,
  ocrWithOllama,
  ocrWithOpenAI,
  ocrWithGoogleVision,
  processMultipleImages
};
