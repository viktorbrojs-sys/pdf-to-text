# PDF to Text Translation Project

A tool for extracting text from scanned/image-based PDF documents and translating them to English with preserved formatting.

## Project Structure

```
pdf-to-text/
├── input/                    # Source PDF files
│   └── BEI.pdf              # Bioequivalence study report (20 pages)
├── output/                  # Generated output files
│   ├── BEI_EN.md           # English translation (Markdown)
│   └── BEI_EN.docx         # Word document
├── scripts/                 # Conversion scripts
│   └── convert_to_docx.js  # Node.js DOCX generator
├── node_modules/            # Dependencies
├── package.json             # Node.js configuration
└── .gitignore              # Git ignore rules
```

## Features

- **PDF to Image Conversion**: Convert scanned PDF pages to PNG images using `pdftocairo`
- **Vision-based OCR**: Extract text from images using AI vision capabilities
- **Translation**: Russian to English translation with formatting preservation
- **DOCX Generation**: Convert translated text to Microsoft Word format

## Prerequisites

- Linux/macOS/Windows
- Node.js 18+
- `pdftocairo` (from Poppler utils)
- GitHub account (for remote repository)

## Installation

```bash
# Clone the repository
git clone https://github.com/viktorbrojs-sys/pdf-to-text.git
cd pdf-to-text

# Install dependencies
npm install
```

## Usage

### 1. Extract Text from PDF

```bash
# Convert PDF to images
pdftocairo -png input/BEI.pdf /tmp/bei_page

# Images will be created as /tmp/bei_page-01.png through /tmp/bei_page-20.png
```

### 2. Translate Content

Use AI vision capabilities to read images and translate content. The translated output is saved to `output/BEI_EN.md`.

### 3. Generate DOCX

```bash
node scripts/convert_to_docx.js
```

Output: `output/BEI_EN.docx`

## Conversion Script

The `convert_to_docx.js` script uses the `docx` npm library to create Word documents with:

- **Heading hierarchy**: Title, H1, H2, H3
- **Tables**: With borders and header row formatting
- **Lists**: Bullet points and numbered items
- **Bold text**: Markdown-style `**bold**` support
- **Horizontal rules**: Section dividers

### Script Features

```javascript
// Key functions
parseContent(text)      // Parse Markdown-style text
createHeading(text)     // Create headings
createTable(rows)       // Create tables
createParagraph(text)   // Create paragraphs
createBulletPoint(text) // Create bullet lists
```

## Input File

**BEI.pdf** - Bioequivalence Study Report (20 pages)
- Language: Russian
- Format: Scanned/image-based PDF
- Content: Pharmaceutical study comparing LANSASOL vs LANZOPTOL

## Output Files

### BEI_EN.md (Markdown)
- 55 KB
- Full English translation
- Markdown formatting preserved

### BEI_EN.docx (Word)
- 29 KB
- Microsoft Word 2007+ format
- Tables, headings, and formatting preserved

## Technical Details

### PDF Processing Pipeline

1. **File Discovery**: `glob` to find PDF files
2. **Text Extraction**: Attempt `pdftotext` (fails for image-based PDFs)
3. **Image Conversion**: `pdftocairo -png` converts pages to images
4. **OCR Processing**: Vision model reads images and extracts text
5. **Translation**: AI translates Russian to English
6. **Output Generation**: Write to MD and DOCX formats

### Dependencies

```json
{
  "docx": "^8.0.0"
}
```

### System Tools Used

- `pdftocairo` (Poppler utils)
- `pdfinfo` (Poppler utils)
- Node.js 18+

## GitHub Repository

**URL**: https://github.com/viktorbrojs-sys/pdf-to-text

**Branch**: `master`

**Last Commit**: Initial commit with full project structure

## License

This project is for educational and research purposes.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Support

For issues or questions, please open an issue on GitHub.
