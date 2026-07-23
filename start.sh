#!/bin/bash

echo "========================================="
echo "  PDF to Text - Starting Application"
echo "========================================="

# 1. Kill existing process on port 3000
echo "[1/6] Освобождение порта 3000..."
lsof -ti:3000 | xargs -r kill -9 2>/dev/null
sleep 1

# 2. Git pull (if git repo exists)
if [ -d ".git" ]; then
  echo "[2/6] Обновление кода с GitHub..."
  git pull origin master 2>/dev/null || echo "  (нет изменений или нет подключения)"
else
  echo "[2/6] Git не найден, пропускаю..."
fi

# 3. Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "[3/6] Установка зависимостей..."
  npm install
else
  echo "[3/6] Зависимости уже установлены."
fi

# 4. Fix /dev/shm permissions if needed
if [ -d "/dev/shm" ]; then
  SHM_PERMS=$(stat -c %a /dev/shm 2>/dev/null)
  if [ "$SHM_PERMS" != "1777" ]; then
    echo "[4/6] Исправление прав /dev/shm..."
    sudo chmod 1777 /dev/shm 2>/dev/null
  else
    echo "[4/6] /dev/shm OK."
  fi
else
  echo "[4/6] Пропуск проверки /dev/shm."
fi

# 5. Set Electron sandbox flag
export ELECTRON_DISABLE_SANDBOX=1

# 6. Build and start
echo "[5/6] Сборка проекта..."
npm run build

echo "[6/6] Запуск Electron..."
echo "========================================="
echo "  Приложение откроется через несколько секунд..."
echo "  Закройте это окно для остановки."
echo "========================================="
npm run electron:dev
