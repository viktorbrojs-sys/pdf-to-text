const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'app.log');
const MAX_LOG_LINES = 1000;

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function getTimestamp() {
  return new Date().toISOString();
}

function log(level, message, meta = null) {
  const timestamp = getTimestamp();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  const line = `[${timestamp}] [${level}] ${message}${metaStr}\n`;

  try {
    fs.appendFileSync(LOG_FILE, line, 'utf-8');
    trimLogFile();
  } catch (e) {
    console.error('Logger write failed:', e.message);
  }
}

function trimLogFile() {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length > MAX_LOG_LINES) {
      const trimmed = lines.slice(-MAX_LOG_LINES).join('\n') + '\n';
      fs.writeFileSync(LOG_FILE, trimmed, 'utf-8');
    }
  } catch (e) {
    console.error('Logger trim failed:', e.message);
  }
}

function getRecentLogs(count = 100) {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    return lines.slice(-count);
  } catch (e) {
    console.error('Logger read failed:', e.message);
    return [];
  }
}

function info(message, meta) { log('INFO', message, meta); }
function warn(message, meta) { log('WARN', message, meta); }
function error(message, meta) { log('ERROR', message, meta); }

module.exports = { info, warn, error, getRecentLogs };
