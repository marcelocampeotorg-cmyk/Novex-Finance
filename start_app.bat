@echo off
title Novex Finance Launcher
cd /d "e:\PROJETOS\SISTEMAS\NOVEX FINACE ORIGINAL"

:: Verificar se a porta 3000 ja esta em uso
netstat -ano | findstr :3000 >nul
if %errorlevel% equ 0 (
    echo Servidor ja esta em execucao! Abrindo painel...
    start http://localhost:3000
    exit
)

echo Iniciando servidor Novex Finance...
start "Novex Finance Server" /min cmd /c "npm run dev"

echo Aguardando inicializacao do servidor...
timeout /t 5 /nobreak >nul

start http://localhost:3000
