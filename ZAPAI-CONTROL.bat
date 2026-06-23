@echo off
setlocal enabledelayedexpansion
title ZAPAI CONTROL CENTER
color 0A

set "ROOT=C:\projetos\ZAPAI-FINAL"
set "NODE_CMD=%ROOT%\node.exe"
set "LOGS=%ROOT%\logs"
set "BACKEND_PORT=4025"
set "FRONTEND_PORT=8080"

:menu
cls
echo ============================================
echo            ZAPAI CONTROL CENTER
echo ============================================
echo.
echo [1] Iniciar Sistema
echo [2] Verificar Status
echo [3] Reiniciar Sistema
echo [4] Parar Sistema
echo [5] Abrir Painel
echo [6] Ver Logs
echo [0] Sair
echo.
set /p op=Escolha:

if "%op%"=="1" goto start
if "%op%"=="2" goto status
if "%op%"=="3" goto restart
if "%op%"=="4" goto stop
if "%op%"=="5" goto open
if "%op%"=="6" goto logs
if "%op%"=="0" exit /b 0

goto menu

:check_env
if not exist "%NODE_CMD%" (
  where node >nul 2>&1
  if errorlevel 1 (
    echo.
    echo ERRO: node nao esta no PATH e node.exe local nao foi encontrado.
    echo.
    exit /b 1
  )
  set "NODE_CMD=node"
)

exit /b 0

:start
call :start_services
pause
goto menu

:start_services
call :check_env
if errorlevel 1 exit /b 1

cd /d "%ROOT%"
"%NODE_CMD%" scripts/runtime-start.mjs
start http://127.0.0.1:%FRONTEND_PORT%

echo.
echo Sistema iniciado.
exit /b 0

:status
cls
echo ==============================
echo STATUS DAS PORTAS
echo ==============================
echo.
echo Backend  http://localhost:%BACKEND_PORT%/health
curl -s http://localhost:%BACKEND_PORT%/health
echo.
echo.
echo Portas em uso:
echo.
netstat -ano | findstr :%BACKEND_PORT%
echo.
netstat -ano | findstr :%FRONTEND_PORT%
echo.
pause
goto menu

:restart
call :stop_services
timeout /t 3 >nul
call :start_services
pause
goto menu

:stop
call :stop_services
pause
goto menu

:stop_services
echo.
echo Encerrando processos do ZAPAI nas portas %BACKEND_PORT% e %FRONTEND_PORT%...
cd /d "%ROOT%"
"%NODE_CMD%" scripts/runtime-stop.mjs
echo Sistema parado.
exit /b 0

:kill_port
set "PORT=%~1"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% "') do (
  if not "%%P"=="0" (
    taskkill /F /PID %%P >nul 2>&1
  )
)
exit /b 0

:open
start http://127.0.0.1:%FRONTEND_PORT%
goto menu

:logs
if not exist "%LOGS%" mkdir "%LOGS%"
explorer "%LOGS%"
goto menu
