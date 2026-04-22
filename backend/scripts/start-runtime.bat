@echo off
REM ZapFlow Runtime Startup Script for Windows
REM This script:
REM - Starts the Node.js server
REM - Runtime manager automatically:
REM   * Starts ngrok tunnel
REM   * Monitors health
REM   * Auto-restarts on failure
REM - Initializes Baileys sessions
REM - Enables business hours and AI features

echo.
echo ======================================
echo   ZapFlow - Baileys Server Startup
echo ======================================
echo.

REM Get the directory where this script is located
setlocal enabledelayedexpansion
set SCRIPT_DIR=%~dp0
set WORK_DIR=%SCRIPT_DIR%..
cd /d %WORK_DIR%

echo [Startup] Current working directory: %cd%
echo [Startup] Script directory: %SCRIPT_DIR%
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [Startup] Node.js found: 
node --version
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed or not in PATH
    pause
    exit /b 1
)

echo [Startup] npm found:
npm --version
echo.

REM Check if ngrok is installed
where ngrok >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] ngrok is not installed or not in PATH
    echo ngrok is required for remote tunnel access
    echo Download from: https://ngrok.com/download
    echo.
)

REM Check if node_modules exist, if not install dependencies
if not exist "%WORK_DIR%\node_modules" (
    echo [Startup] Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo [Startup] Dependencies installed successfully
    echo.
)

REM Warn about ngrok auth token if ngrok is available
if defined NGROK_AUTH_TOKEN (
    echo [Startup] ngrok auth token is set
) else (
    where ngrok >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo [WARNING] NGROK_AUTH_TOKEN environment variable is not set
        echo Your ngrok tunnel may be limited to 2 hours per session
        echo Set NGROK_AUTH_TOKEN to use your ngrok account for unlimited sessions
        echo.
    )
)

echo [Startup] Starting ZapFlow runtime...
echo [Startup] Launching: node server.js
echo [Startup] Runtime Manager will automatically handle ngrok tunnel and monitoring
echo.

REM Set environment variables for startup
if not defined PORT set PORT=4000
set NODE_ENV=production
set NGROK_MANAGED_EXTERNALLY=false
set NGROK_PORT=%PORT%

echo [Startup] Runtime PORT: %PORT%
echo [Startup] ngrok target PORT: %NGROK_PORT%
echo.

REM Start the server - this will keep running
REM Press Ctrl+C to stop
node server.js

REM If the script reaches here, the server has stopped
echo.
echo [Startup] ZapFlow server has stopped
echo.
echo Check logs/runtime.log for detailed information
echo.
pause
exit /b 0
