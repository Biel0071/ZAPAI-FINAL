@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title ZAPFLOW CONTROL CENTER
color 0A
set "NODE_CMD=%~dp0node.exe"

:menu
cls
echo ============================================
echo          ZAPFLOW CONTROL CENTER
echo ============================================
echo.
echo Runtime oficial:
echo   node.exe scripts/runtime-start.mjs
echo.
echo [1] Iniciar sistema
echo [2] Parar sistema
echo [3] Reiniciar sistema
echo [4] Ver status
echo [5] Abrir painel
echo [6] Abrir logs
echo [0] Sair
echo.
set /p op=Escolha: 

if "%op%"=="1" goto start
if "%op%"=="2" goto stop
if "%op%"=="3" goto restart
if "%op%"=="4" goto status
if "%op%"=="5" goto open
if "%op%"=="6" goto logs
if "%op%"=="0" exit /b 0

goto menu

:start
call :ensure_node
if errorlevel 1 goto menu
echo.
echo Iniciando pelo runtime oficial...
call "%NODE_CMD%" scripts/runtime-start.mjs
echo.
pause
goto menu

:stop
call :ensure_node
if errorlevel 1 goto menu
echo.
echo Parando pelo runtime oficial...
call "%NODE_CMD%" scripts/runtime-stop.mjs
echo.
pause
goto menu

:restart
call :ensure_node
if errorlevel 1 goto menu
echo.
echo Reiniciando pelo runtime oficial...
call "%NODE_CMD%" scripts/runtime-restart.mjs
echo.
pause
goto menu

:status
cls
echo ============================================
echo              STATUS ZAPFLOW
echo ============================================
echo.
echo Backend health:
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 'http://127.0.0.1:4025/health'; Write-Host ('HTTP ' + [int]$r.StatusCode); Write-Host $r.Content } catch { Write-Host ('OFFLINE: ' + $_.Exception.Message) }"
echo.
echo Frontend:
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 'http://127.0.0.1:8080'; Write-Host ('HTTP ' + [int]$r.StatusCode + ' http://127.0.0.1:8080') } catch { Write-Host ('OFFLINE: ' + $_.Exception.Message) }"
echo.
echo Portas monitoradas pelo runtime oficial:
echo   3000, 4025, 4173, 5173, 8080
echo.
netstat -ano | findstr ":3000 :4025 :4173 :5173 :8080"
echo.
pause
goto menu

:open
start http://127.0.0.1:8080
goto menu

:logs
if not exist "%~dp0logs" mkdir "%~dp0logs"
explorer "%~dp0logs"
goto menu

:ensure_node
if not exist "%NODE_CMD%" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo.
    echo Node.js nao encontrado no PATH e node.exe local nao foi encontrado.
    echo.
    pause
    exit /b 1
  )
  set "NODE_CMD=node"
)
exit /b 0
