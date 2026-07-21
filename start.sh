#!/bin/bash

echo "========================================="
echo "  PDF to Text - Starting Application"
echo "========================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "[1/4] Installing dependencies..."
    npm install
else
    echo "[1/4] Dependencies already installed."
fi

# Check if /dev/shm permissions are correct (Linux)
if [ -d "/dev/shm" ]; then
    SHM_PERMS=$(stat -c %a /dev/shm 2>/dev/null)
    if [ "$SHM_PERMS" != "1777" ]; then
        echo "[2/4] Fixing /dev/shm permissions..."
        sudo chmod 1777 /dev/shm
    else
        echo "[2/4] /dev/shm permissions OK."
    fi
else
    echo "[2/4] Skipping /dev/shm check."
fi

# Build project
echo "[3/4] Building project..."
npm run build

# Start application
echo "[4/4] Starting Electron app..."
echo "========================================="
echo "  App will open in a few seconds..."
echo "  Close this terminal to stop the app."
echo "========================================="
npm run electron:dev
