# PDF to Text Translation Project

A desktop application for extracting text from scanned/image-based PDF documents and translating them to English with preserved formatting.

**Note:** This is an Electron desktop app. It cannot run on Vercel or other web hosting services - run locally with `npm run electron:dev`.

## Project Structure

```
pdf-to-text/
├── electron/                  # Electron main process
│   ├── main.js               # Main process entry point
│   └── preload.js            # IPC bridge
├── src/                       # React frontend
│   ├── App.jsx               # Main component
│   ├── index.jsx             # Entry point
│   ├── index.html            # HTML template
│   ├── styles.css            # Styles
│   └── components/
│       ├── FileUpload.jsx    # Drag & drop zone
│       ├── StatusBar.jsx     # Progress indicator
│       └── DownloadPanel.jsx # Download buttons
├── scripts/                   # Backend logic
│   └── convert_to_docx.js   # DOCX generator
├── input/                     # Source PDF files
│   └── BEI.pdf              # Bioequivalence study report
├── output/                    # Generated files
│   ├── BEI_EN.md            # English translation (Markdown)
│   └── BEI_EN.docx          # Word document
├── dist/                      # Webpack build output
├── package.json
├── webpack.config.js
└── .gitignore
```

## Features

- **Electron Desktop App**: Native desktop experience
- **React UI**: Modern, responsive interface
- **Drag & Drop**: Easy PDF upload
- **Progress Tracking**: Real-time processing status
- **Multiple Formats**: Export to Markdown and Word
- **PDF to Image Conversion**: Using `pdftocairo`
- **DOCX Generation**: Using `docx` npm library

## Prerequisites

- Linux/macOS/Windows
- Node.js 18+
- `pdftocairo` (from Poppler utils)

## Installation

```bash
# Clone the repository
git clone https://github.com/viktorbrojs-sys/pdf-to-text.git
cd pdf-to-text

# Install dependencies
npm install
```

## Usage

### Development Mode

```bash
# Start Electron app with hot reload
npm run electron:dev
```

App opens at: http://localhost:3000

### Production Build

```bash
# Build for production
npm run electron:build
```

### Run Electron Only

```bash
# Build frontend first
npm run build

# Then start Electron
npm start
```

## Application Interface

### State 1: Initial (Upload)
```
┌─────────────────────────────────────────┐
│  PDF to Text                            │
│  Переводчик PDF документов              │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │   📄 Перетащите PDF сюда        │    │
│  │   или нажмите для выбора        │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### State 2: Processing
```
┌─────────────────────────────────────────┐
│  PDF to Text                            │
│                                         │
│  📄 document.pdf                        │
│                                         │
│  ████████████░░░░░░░░ 60%              │
│  Распознавание текста...               │
│                                         │
└─────────────────────────────────────────┘
```

### State 3: Completed
```
┌─────────────────────────────────────────┐
│  PDF to Text                            │
│                                         │
│  ✅ Перевод завершен!                   │
│                                         │
│  📥 Скачать Markdown                    │
│  📥 Скачать Word Document              │
│                                         │
│  📄 Загрузить новый PDF                │
│                                         │
└─────────────────────────────────────────┘
```

## Technical Details

### Architecture

```
Renderer (React)          Main (Electron)          Pipeline
      │                        │                      │
      ├── select-pdf ─────────→│                      │
      │                        ├── process-pdf ──────→│
      │←── status-update ──────┤←── progress ─────────┤
      │                        │                      │
      ├── download-file ──────→│                      │
      │←── file blob ──────────│                      │
```

### Dependencies

```json
{
  "dependencies": {
    "docx": "^9.7.1"
  },
  "devDependencies": {
    "electron": "^28.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "webpack": "^5.90.0"
  }
}
```

### System Tools

- `pdftocairo` (Poppler utils) - PDF to image conversion
- `pdfinfo` (Poppler utils) - PDF metadata

## Conversion Script

The `convert_to_docx.js` script creates Word documents with:

- **Heading hierarchy**: Title, H1, H2, H3
- **Tables**: With borders and header row formatting
- **Lists**: Bullet points and numbered items
- **Bold text**: Markdown-style `**bold**` support
- **Horizontal rules**: Section dividers

## GitHub Repository

**URL**: https://github.com/viktorbrojs-sys/pdf-to-text

**Branch**: `master`

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
