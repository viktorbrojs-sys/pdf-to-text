const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

/**
 * Export text to Markdown format
 * @param {string} text - Text content
 * @param {string} outputPath - Output file path
 */
function exportToMarkdown(text, outputPath) {
  fs.writeFileSync(outputPath, text, 'utf-8');
  return outputPath;
}

/**
 * Export text to DOCX format
 * @param {string} text - Text content
 * @param {string} outputPath - Output file path
 */
async function exportToDocx(text, outputPath) {
  // Simple DOCX generation using docx library
  const { Document, Packer, Paragraph, TextRun } = require('docx');
  
  const lines = text.split('\n');
  const paragraphs = [];
  
  for (const line of lines) {
    if (line.startsWith('# ')) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line.substring(2), bold: true, size: 32 })],
        heading: 'TITLE'
      }));
    } else if (line.startsWith('## ')) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line.substring(3), bold: true, size: 28 })],
        heading: 'HEADING_1'
      }));
    } else if (line.startsWith('### ')) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line.substring(4), bold: true, size: 24 })],
        heading: 'HEADING_2'
      }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: '• ' + line.substring(2) })],
        indent: { left: 720 }
      }));
    } else if (line.trim() === '') {
      paragraphs.push(new Paragraph({ children: [] }));
    } else {
      // Handle bold text
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const children = parts.map(part => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return new TextRun({ text: part.slice(2, -2), bold: true });
        }
        return new TextRun({ text: part });
      });
      paragraphs.push(new Paragraph({ children }));
    }
  }
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs
    }]
  });
  
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  
  return outputPath;
}

/**
 * Export text to PDF format
 * @param {string} text - Text content
 * @param {string} outputPath - Output file path
 */
async function exportToPdf(text, outputPath) {
  const pdfDoc = await PDFDocument.create();
  
  // Split text into pages
  const lines = text.split('\n');
  let currentPage = pdfDoc.addPage();
  let yPosition = currentPage.getHeight() - 50;
  const lineHeight = 14;
  const margin = 50;
  const pageWidth = currentPage.getWidth();
  const maxWidth = pageWidth - 2 * margin;
  
  for (const line of lines) {
    // Check if we need a new page
    if (yPosition < margin + lineHeight) {
      currentPage = pdfDoc.addPage();
      yPosition = currentPage.getHeight() - margin;
    }
    
    // Handle headers
    if (line.startsWith('# ')) {
      currentPage.drawText(line.substring(2), {
        x: margin,
        y: yPosition,
        size: 18,
        color: { red: 0, green: 0, blue: 0 }
      });
      yPosition -= lineHeight * 1.5;
    } else if (line.startsWith('## ')) {
      currentPage.drawText(line.substring(3), {
        x: margin,
        y: yPosition,
        size: 14,
        color: { red: 0.2, green: 0.2, blue: 0.2 }
      });
      yPosition -= lineHeight * 1.3;
    } else if (line.trim() === '') {
      yPosition -= lineHeight;
    } else {
      // Regular text - wrap if needed
      const words = line.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        if (testLine.length * 7 > maxWidth) { // Approximate character width
          currentPage.drawText(currentLine, {
            x: margin,
            y: yPosition,
            size: 10,
            color: { red: 0.1, green: 0.1, blue: 0.1 }
          });
          yPosition -= lineHeight;
          currentLine = word;
          
          if (yPosition < margin + lineHeight) {
            currentPage = pdfDoc.addPage();
            yPosition = currentPage.getHeight() - margin;
          }
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        currentPage.drawText(currentLine, {
          x: margin,
          y: yPosition,
          size: 10,
          color: { red: 0.1, green: 0.1, blue: 0.1 }
        });
        yPosition -= lineHeight;
      }
    }
  }
  
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  
  return outputPath;
}

/**
 * Export to multiple formats
 * @param {string} text - Text content
 * @param {string} baseName - Base file name (without extension)
 * @param {string} outputDir - Output directory
 * @param {string[]} formats - Array of formats: ['md', 'docx', 'pdf']
 */
async function exportToMultiple(text, baseName, outputDir, formats = ['md', 'docx', 'pdf']) {
  const results = {};
  
  for (const format of formats) {
    const outputPath = path.join(outputDir, `${baseName}.${format}`);
    
    try {
      switch (format) {
        case 'md':
          exportToMarkdown(text, outputPath);
          break;
        case 'docx':
          await exportToDocx(text, outputPath);
          break;
        case 'pdf':
          await exportToPdf(text, outputPath);
          break;
      }
      results[format] = { success: true, path: outputPath };
    } catch (error) {
      results[format] = { success: false, error: error.message };
    }
  }
  
  return results;
}

module.exports = {
  exportToMarkdown,
  exportToDocx,
  exportToPdf,
  exportToMultiple
};
