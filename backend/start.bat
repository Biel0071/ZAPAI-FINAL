@echo off
REM ZAPAI Backend Initialization Script for Windows
REM Usage: start.bat

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==================================
echo ZAPAI - Backend Server Starting
echo ==================================
echo.

REM Check if .env exists
if exist .env (
  echo [+] Loading .env
  REM Loading .env in Windows batch is limited, so just note it
) else (
  echo [!] Warning: .env not found, using defaults
)

REM Create required directories
echo Creating required directories...
if not exist sessions mkdir sessions
if not exist uploads mkdir uploads
if not exist logs mkdir logs
if not exist media mkdir media
if not exist data mkdir data
if not exist reports mkdir reports

REM Print info
echo.
echo Starting Node.js server on port 4025...
echo.

REM Start server
node server.js

pause
