@echo off
setlocal enabledelayedexpansion
title ZAPAI DEPLOY SYSTEM
color 0E

set "ROOT=C:\projetos\ZAPAI-FINAL"
set "NODE_CMD=%ROOT%\node.exe"
set "VPS_IP=209.50.229.68"
set "VPS_USER=root"
set "VPS_DIR=/opt/zapai"

cls
echo ============================================================
echo               ZAPAI ONE-CLICK DEPLOY UTILITY
echo ============================================================
echo.
echo Este script ira:
echo 1. Validar localmente e commitar alteracoes pendentes
echo 2. Fazer push para o GitHub (origin main)
echo 3. Conectar via SSH na VPS (%VPS_IP%)
echo 4. Executar auto-deploy.sh na VPS
echo ============================================================
echo.

:: Verificar se tem alteracoes no git
echo [INFO] Verificando status do Git...
git status --short
echo.

set "commit_msg="
set /p commit_msg=Digite a mensagem do commit (ou ENTER para auto-commit): 

:: If space (from echo. pipe), set to empty
if "%commit_msg%"==" " set "commit_msg="
if "%commit_msg%"=="" (
    :: Obter data e hora atuais no Windows (formato YYYY-MM-DD HH:MM)
    for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "dt=%%I"
    set "year=!dt:~0,4!"
    set "month=!dt:~4,2!"
    set "day=!dt:~6,2!"
    set "hour=!dt:~8,2!"
    set "min=!dt:~10,2!"
    set "commit_msg=auto-deploy: !year!-!month!-!day! !hour!:!min!"
)

echo [INFO] Commitando alteracoes: "%commit_msg%"...
git add -A
git commit -m "%commit_msg%"
if %errorlevel% neq 0 (
    echo [WARN] Nada para commitar ou erro no commit. Continuando...
)

echo [INFO] Fazendo push para o GitHub (origin main)...
git push origin main
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao enviar para o GitHub. Verifique sua conexao e permissões.
    pause
    exit /b 1
)
echo [OK] Push concluido com sucesso!
echo.

echo ============================================================
echo       CONECTANDO A VPS (%VPS_IP%) E INICIANDO DEPLOY
echo ============================================================
echo.

ssh -o StrictHostKeyChecking=no %VPS_USER%@%VPS_IP% "cd %VPS_DIR% && bash deploy/auto-deploy.sh"
set "ssh_err=%errorlevel%"

echo.
if %ssh_err% neq 0 (
    color 0C
    echo ============================================================
    echo [ERRO] O DEPLOY FALHOU NA VPS! CODIGO DE RETORNO: %ssh_err%
    echo ============================================================
    pause
    exit /b %ssh_err%
) else (
    color 0A
    echo ============================================================
    echo [OK] DEPLOY CONCLUIDO COM SUCESSO E SISTEMA ESTABILIZADO!
    echo ============================================================
    pause
    exit /b 0
)
