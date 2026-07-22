const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

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
  
  // Use Helvetica (supports basic Latin)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Split text into pages
  const lines = text.split('\n');
  let currentPage = pdfDoc.addPage();
  let yPosition = currentPage.getHeight() - 50;
  const lineHeight = 14;
  const margin = 50;
  const pageWidth = currentPage.getWidth();
  const maxWidth = pageWidth - 2 * margin;
  
  // Sanitize text - replace unsupported characters
  function sanitizeText(str) {
    // Replace common problematic characters
    return str
      .replace(/[^\x00-\x7F]/g, (ch) => {
        // Keep common Unicode characters that might work
        const code = ch.charCodeAt(0);
        if (code >= 0x0400 && code <= 0x04FF) {
          // Cyrillic - replace with similar Latin or skip
          return '?';
        }
        return '?';
      })
      .replace(/\u0000/g, '');
  }
  
  for (const line of lines) {
    // Check if we need a new page
    if (yPosition < margin + lineHeight) {
      currentPage = pdfDoc.addPage();
      yPosition = currentPage.getHeight() - margin;
    }
    
    const sanitizedLine = sanitizeText(line);
    
    // Handle headers
    if (line.startsWith('# ')) {
      currentPage.drawText(sanitizeText(line.substring(2)), {
        x: margin,
        y: yPosition,
        size: 18,
        font: fontBold,
        color: rgb(0, 0, 0)
      });
      yPosition -= lineHeight * 1.5;
    } else if (line.startsWith('## ')) {
      currentPage.drawText(sanitizeText(line.substring(3)), {
        x: margin,
        y: yPosition,
        size: 14,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2)
      });
      yPosition -= lineHeight * 1.3;
    } else if (line.trim() === '') {
      yPosition -= lineHeight;
    } else {
      // Regular text - wrap if needed
      const words = sanitizedLine.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const textWidth = font.widthOfTextAtSize(testLine, 10);
        
        if (textWidth > maxWidth) {
          currentPage.drawText(currentLine, {
            x: margin,
            y: yPosition,
            size: 10,
            font: font,
            color: rgb(0.1, 0.1, 0.1)
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
          font: font,
          color: rgb(0.1, 0.1, 0.1)
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
