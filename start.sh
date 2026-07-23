#!/bin/bash

echo "========================================="
echo "  PDF to Text - Starting Application"
echo "========================================="

set -e

# Check if git is installed
if ! command -v git &> /dev/null; then
  echo "✗ Git не установлен. Установите git и попробуйте снова."
  echo "  Ubuntu/Debian: sudo apt install git"
  echo "  macOS: xcode-select --install"
  exit 1
fi
echo "✓ Git установлен"

# Check if node is installed
if ! command -v node &> /dev/null; then
  echo "✗ Node.js не установлен. Установите Node.js и попробуйте снова."
  echo "  https://nodejs.org/"
  exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  echo "✗ npm не установлен. Установите npm и попробуйте снова."
  exit 1
fi
echo "✓ Node.js $(node -v) и npm $(npm -v) установлены"

# Auto-clone if directory is empty
if [ ! -f "package.json" ]; then
  echo "Директория пуста. Клонирование проекта..."
  REPO_URL="https://github.com/viktorbrojs-sys/pdf-to-text.git"
  git clone "$REPO_URL" . 2>/dev/null || {
    echo "✗ Не удалось клонировать репозиторий."
    echo "  URL: $REPO_URL"
    exit 1
  }
  echo "✓ Проект успешно клонирован"
fi

# Kill existing process on port 3000
echo "[1/6] Освобождение порта 3000..."
lsof -ti:3000 | xargs -r kill -9 2>/dev/null || true
sleep 1

# Git pull (if git repo exists)
if [ -d ".git" ]; then
  echo "[2/6] Обновление кода с GitHub..."
  git pull origin master 2>/dev/null || echo "  (нет изменений или нет подключения)"
else
  echo "[2/6] Git репозиторий не найден, пропускаю..."
fi

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
  echo "[3/6] Установка зависимостей..."
  npm install || {
    echo "✗ Ошибка установки зависимостей. Попробуйте: rm -rf node_modules && npm install"
    exit 1
  }
else
  echo "[3/6] Зависимости уже установлены."
fi

# Fix /dev/shm permissions if needed
if [ -d "/dev/shm" ]; then
  SHM_PERMS=$(stat -c %a /dev/shm 2>/dev/null)
  if [ "$SHM_PERMS" != "1777" ]; then
    echo "[4/6] Исправление прав /dev/shm..."
    sudo chmod 1777 /dev/shm 2>/dev/null || echo "  (не удалось исправить права, возможно нужен sudo)"
  else
    echo "[4/6] /dev/shm OK."
  fi
else
  echo "[4/6] Пропуск проверки /dev/shm."
fi

# Set Electron sandbox flag
export ELECTRON_DISABLE_SANDBOX=1

# Build and start
echo "[5/6] Сборка проекта..."
npm run build || {
  echo "✗ Ошибка сборки. Проверьте ошибки выше."
  exit 1
}

echo "[6/6] Запуск Electron..."
echo "========================================="
echo "  Приложение откроется через несколько секунд..."
echo "  Закройте это окно для остановки."
echo "========================================="
npm run electron:dev
