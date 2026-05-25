@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title ZAPFLOW AI — Control Panel

echo.
echo  ╔════════════════════════════════════════════════════╗
echo  ║         ZAPFLOW AI — PAINEL DE CONTROLE           ║
echo  ╠════════════════════════════════════════════════════╣
echo  ║                                                    ║
echo  ║   [1]  START RUNTIME  (Backend + Frontend)         ║
echo  ║   [2]  STOP RUNTIME   (Kill managed processes)     ║
echo  ║   [3]  RESTART        (Restart managed runtime)     ║
echo  ║   [4]  CLEAN          (Clear builds & cache)       ║
echo  ║   [0]  EXIT                                        ║
echo  ║                                                    ║
echo  ╚════════════════════════════════════════════════════╝
echo.
set /p CHOICE="  Select option: "

if "%CHOICE%"=="1" goto START
if "%CHOICE%"=="2" goto STOP
if "%CHOICE%"=="3" goto RESTART
if "%CHOICE%"=="4" goto CLEAN
if "%CHOICE%"=="0" goto EXIT

echo Invalid option.
timeout /t 2 /nobreak >nul
goto EXIT

:START
node scripts/runtime-start.mjs
pause
goto EXIT

:STOP
node scripts/runtime-stop.mjs
pause
goto EXIT

:RESTART
node scripts/runtime-restart.mjs
pause
goto EXIT

:CLEAN
node scripts/runtime-clean.mjs
pause
goto EXIT

:EXIT
exit /b 0

