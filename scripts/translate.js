const fs = require('fs');
const path = require('path');

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
  let result = text;
  for (const [source, target] of Object.entries(patterns)) {
    // Remove brackets around translated terms
    const regex = new RegExp(`\\[${target}\\]`, 'g');
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
  
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        prompt: processedText,
        stream: false
      })
    });
    
    const data = await response.json();
    return restoreGlossary(data.response, glossary);
  } catch (error) {
    throw new Error(`Ollama error: ${error.message}. Make sure Ollama is running.`);
  }
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
    throw new Error(`DeepL API error: ${error.message}`);
  }
}

/**
 * Main translation function
 * @param {string} text - Text to translate
 * @param {Object} options - Options
 * @returns {Promise<string>} Translated text
 */
async function translate(text, options = {}) {
  const { provider = 'ollama', ...rest } = options;
  
  switch (provider) {
    case 'ollama':
      return translateWithOllama(text, rest);
    case 'openai':
      return translateWithOpenAI(text, rest);
    case 'deepl':
      return translateWithDeepL(text, rest);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

module.exports = {
  translate,
  translateWithOllama,
  translateWithOpenAI,
  translateWithDeepL,
  loadGlossary,
  saveGlossary,
  DEFAULT_SYSTEM_PROMPT
};
