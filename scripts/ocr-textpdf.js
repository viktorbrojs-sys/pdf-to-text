const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Extract text from text-based PDF using pdftotext
 * @param {string} pdfPath - Path to PDF file
 * @param {Object} options - Options
 * @returns {string} Extracted text
 */
function extractTextFromPdf(pdfPath, options = {}) {
  const { layout = false } = options;
  
  try {
    const flag = layout ? '-layout' : '';
    const text = execSync(`pdftotext ${flag} "${pdfPath}" -`, { 
      encoding: 'utf-8',
      timeout: 30000
    });
    
    return text;
  } catch (error) {
    console.error('pdftotext error:', error.message);
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

/**
 * Extract text with layout preservation
 * @param {string} pdfPath - Path to PDF file
 * @returns {string} Extracted text with layout
 */
function extractTextWithLayout(pdfPath) {
  return extractTextFromPdf(pdfPath, { layout: true });
}

/**
 * Convert extracted text to Markdown format
 * @param {string} text - Raw text
 * @param {string} fileName - Original file name
 * @returns {string} Markdown formatted text
 */
function textToMarkdown(text, fileName) {
  // Clean up the text
  let md = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  // Try to detect headers (lines that are short and followed by empty line)
  const lines = md.split('\n');
  const processedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1]?.trim();
    
    // Detect potential headers
    if (line.length > 0 && line.length < 100 && 
        (nextLine === '' || nextLine === undefined) &&
        line === line.toUpperCase() &&
        !line.match(/^\d/)) {
      // Likely a header
      processedLines.push(`## ${line}`);
    } else {
      processedLines.push(line);
    }
  }
  
  return `# ${fileName}\n\n${processedLines.join('\n')}`;
}

module.exports = {
  extractTextFromPdf,
  extractTextWithLayout,
  textToMarkdown
};
