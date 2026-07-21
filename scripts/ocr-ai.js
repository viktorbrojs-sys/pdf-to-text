const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * AI Vision OCR Module
 * Supports: Local LLM (Ollama), OpenAI API, Google Vision API
 */

/**
 * Convert image to base64
 * @param {string} imagePath 
 * @returns {string} Base64 encoded image
 */
function imageToBase64(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString('base64');
}

/**
 * OCR with Ollama (Local LLM)
 * @param {string} imagePath - Path to image
 * @param {Object} options - Options
 * @returns {Promise<string>} Extracted text
 */
async function ocrWithOllama(imagePath, options = {}) {
  const { model = 'llava', prompt = 'Извлеки весь текст с этого изображения. Сохрани форматирование.' } = options;
  
  const base64 = imageToBase64(imagePath);
  
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        images: [base64],
        stream: false
      })
    });
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    throw new Error(`Ollama error: ${error.message}. Make sure Ollama is running (ollama serve)`);
  }
}

/**
 * OCR with OpenAI API
 * @param {string} imagePath - Path to image
 * @param {Object} options - Options
 * @returns {Promise<string>} Extracted text
 */
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

/**
 * OCR with Google Vision API
 * @param {string} imagePath - Path to image
 * @param {Object} options - Options
 * @returns {Promise<string>} Extracted text
 */
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

/**
 * Main OCR function - routes to appropriate provider
 * @param {string} imagePath - Path to image
 * @param {Object} options - Options
 * @returns {Promise<string>} Extracted text
 */
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

/**
 * Process multiple images with AI Vision
 * @param {string[]} imagePaths - Array of image paths
 * @param {Object} options - Options
 * @param {function} onProgress - Progress callback
 * @returns {Promise<string>} Combined extracted text
 */
async function processMultipleImages(imagePaths, options = {}, onProgress = () => {}) {
  const texts = [];
  
  for (let i = 0; i < imagePaths.length; i++) {
    onProgress(i + 1, imagePaths.length, Math.round((i / imagePaths.length) * 100));
    
    const text = await ocrWithAI(imagePaths[i], options);
    texts.push(text);
  }
  
  return texts.join('\n\n--- PAGE BREAK ---\n\n');
}

module.exports = {
  ocrWithAI,
  ocrWithOllama,
  ocrWithOpenAI,
  ocrWithGoogleVision,
  processMultipleImages
};
