@echo off
setlocal

set "ROOT=C:\projetos\ZAPAI-FINAL"
set "NODE_CMD=%ROOT%\node.exe"

if not exist "%NODE_CMD%" (
  where node >nul 2>&1
  if errorlevel 1 (
    echo ERRO: node nao esta no PATH e node.exe local nao foi encontrado.
    pause
    exit /b 1
  )
  set "NODE_CMD=node"
)

cd /d "%ROOT%"
"%NODE_CMD%" scripts/runtime-start.mjs

start http://127.0.0.1:8080
