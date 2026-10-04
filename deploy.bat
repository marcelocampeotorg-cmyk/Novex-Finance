@echo off
setlocal
echo ====================================================
echo   NOVEX FINANCE - AUTOMATIZADOR DE DEPLOY COMPLETO
echo   Servidor Oficial: novexserver (192.168.4.12)
echo   Diretorio Alvo: /srv/novex/finance
echo ====================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] O processo de deploy falhou com codigo %errorlevel%.
    exit /b %errorlevel%
)

echo.
echo [SUCESSO] Operacao finalizada com sucesso.
endlocal
