const fs = require('fs');
const path = require('path');

function sanitizeControlChars(str) {
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function exportToMarkdown(text, outputPath) {
  fs.writeFileSync(outputPath, sanitizeControlChars(text), 'utf-8');
  return outputPath;
}

async function exportToDocx(text, outputPath) {
  const { Document, Packer, Paragraph, TextRun } = require('docx');

  const sanitized = sanitizeControlChars(text);
  const lines = sanitized.split('\n');
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

function loadDejaVuFontBase64() {
  const fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
  if (fs.existsSync(fontPath)) {
    return fs.readFileSync(fontPath).toString('base64');
  }
  return null;
}

async function exportToPdf(text, outputPath) {
  const { jsPDF } = require('jspdf');

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const fontBase64 = loadDejaVuFontBase64();
  if (fontBase64) {
    doc.addFileToVFS('DejaVuSans.ttf', fontBase64);
    doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
    doc.setFont('DejaVuSans');
  }

  const fontSize = 10;
  const lineHeight = fontSize * 1.5;
  const margin = 50;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - 2 * margin;

  let y = margin;
  const lines = text.split('\n');

  function newPage() {
    doc.addPage();
    y = margin;
  }

  for (const line of lines) {
    if (y > pageHeight - margin) {
      newPage();
    }

    if (line.startsWith('# ')) {
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      const wrapped = doc.splitTextToSize(line.substring(2), maxWidth);
      for (const wl of wrapped) {
        if (y > pageHeight - margin) newPage();
        doc.text(wl, margin, y);
        y += 18 * 1.5;
      }
      doc.setFontSize(fontSize);
      doc.setFont(undefined, 'normal');
      y += 4;
    } else if (line.startsWith('## ')) {
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      const wrapped = doc.splitTextToSize(line.substring(3), maxWidth);
      for (const wl of wrapped) {
        if (y > pageHeight - margin) newPage();
        doc.text(wl, margin, y);
        y += 14 * 1.5;
      }
      doc.setFontSize(fontSize);
      doc.setFont(undefined, 'normal');
      y += 2;
    } else if (line.trim() === '') {
      y += lineHeight;
    } else {
      const wrapped = doc.splitTextToSize(line, maxWidth);
      for (const wl of wrapped) {
        if (y > pageHeight - margin) newPage();
        doc.text(wl, margin, y);
        y += lineHeight;
      }
    }
  }

  doc.save(outputPath);
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
