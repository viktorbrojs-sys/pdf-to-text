# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-07-22

### Added
- PDF to text extraction (OCR)
- AI Vision OCR with Ollama integration
- Tesseract OCR support
- Text-based PDF extraction
- Translation with Ollama (local LLM)
- System prompt configuration for translation
- Translation glossary/patterns
- Export to Markdown, DOCX, PDF formats
- Auto-installation of Ollama
- Auto-download of recommended models (qwen2.5:7b)
- Electron desktop application
- Support for Linux, Windows, macOS
- GitHub Actions CI/CD
- Dark theme UI

### Fixed
- Production build white screen issue
- Sandbox permissions on Linux
- AI Vision image path handling
- PDF export Unicode encoding
- DOCX export format errors

### Known Issues
- PDF export replaces Cyrillic characters with placeholders
- Ollama requires initial model download
