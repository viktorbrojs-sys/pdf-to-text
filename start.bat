@echo off
echo =========================================
echo   PDF to Text - Starting Application
echo =========================================

REM Check if node_modules exists
if not exist "node_modules" (
    echo [1/3] Installing dependencies...
    call npm install
) else (
    echo [1/3] Dependencies already installed.
)

REM Build project
echo [2/3] Building project...
call npm run build

REM Start application
echo [3/3] Starting Electron app...
echo =========================================
echo   App will open in a few seconds...
echo   Close this window to stop the app.
echo =========================================
call npm run electron:dev
