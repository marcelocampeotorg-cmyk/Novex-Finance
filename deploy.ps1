# ==============================================================================
# NOVEX FINANCE - AUTOMATIZADOR DE DEPLOY COMPLETO
# Servidor Oficial: novexserver (192.168.4.12)
# Caminho Remoto: /srv/novex/finance
# ==============================================================================
[CmdletBinding()]
param (
    [string]$ServerUser = "frank",
    [string]$ServerIp = "192.168.4.12",
    [string]$RemoteDir = "/srv/novex/finance",
    [switch]$SkipTests,
    [switch]$ForceEnvSync
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  NOVEX FINANCE - WRAPPER DE DEPLOY E ISOLAMENTO DE PRODUÇÃO" -ForegroundColor Cyan
Write-Host "  Host Remoto: ${ServerUser}@${ServerIp}:${RemoteDir}" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. Testes e Auditoria Pré-Deploy
if (-not $SkipTests) {
    Write-Host "`n[1/5] Executando auditoria pré-deploy (Isolamento, Tipos e Testes)..." -ForegroundColor Yellow
    
    # Validação de zero hardcoding e isolamento de portas/redes
    Write-Host "  -> Checando zero hardcoding e isolamento..." -ForegroundColor Gray
    node --test tests/zero-hardcoding-and-isolation.test.js
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha na auditoria de isolamento e zero hardcoding! Abortando deploy."
        exit 1
    }

    # Validação de TypeScript
    Write-Host "  -> Checando tipagem com tsc..." -ForegroundColor Gray
    pnpm run typecheck
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha na checagem de tipos (tsc)! Abortando deploy."
        exit 1
    }

    Write-Host "[OK] Auditoria pré-deploy aprovada com sucesso." -ForegroundColor Green
} else {
    Write-Host "`n[1/5] Auditoria pré-deploy ignorada (--SkipTests fornecido)." -ForegroundColor DarkYellow
}

# 2. Empacotamento Seguro do Código Fonte
Write-Host "`n[2/5] Gerando pacote seguro de implantação..." -ForegroundColor Yellow
$ArchiveName = "novexfinance-deploy.tar.gz"
$ArchivePath = Join-Path $env:TEMP $ArchiveName

if (Test-Path $ArchivePath) {
    Remove-Item $ArchivePath -Force
}

# Usa tar nativo do Windows para compactar excluindo arquivos não necessários e sensíveis
tar --exclude=".git" `
    --exclude="node_modules" `
    --exclude=".next" `
    --exclude="dist" `
    --exclude="backups" `
    --exclude="tests" `
    --exclude=".env" `
    --exclude=".env.local" `
    --exclude="*.log" `
    --exclude="uploads" `
    --exclude="reports" `
    --exclude="playwright-report" `
    -czf $ArchivePath *

if (-not (Test-Path $ArchivePath)) {
    Write-Error "Falha ao gerar o arquivo compactado de deploy."
    exit 1
}
Write-Host "[OK] Pacote de deploy gerado: $ArchivePath" -ForegroundColor Green

# 3. Transferência Segura para o Servidor
Write-Host "`n[3/5] Transferindo pacote para $ServerUser@$ServerIp..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=no $ArchivePath "${ServerUser}@${ServerIp}:/tmp/${ArchiveName}"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Falha ao transferir pacote via SCP."
    exit 1
}

# Sincronização segura do .env.production se necessário
$EnvProductionLocal = Join-Path $PSScriptRoot ".env.production"
if (Test-Path $EnvProductionLocal) {
    $RemoteEnvExists = ssh -o BatchMode=yes "${ServerUser}@${ServerIp}" "[ -f '$RemoteDir/.env.production' ] && echo 'EXISTS' || echo 'NOT_FOUND'"
    if ($RemoteEnvExists.Trim() -ne "EXISTS" -or $ForceEnvSync) {
        Write-Host "  -> Sincronizando .env.production com permissões restritas (600)..." -ForegroundColor DarkCyan
        scp -o StrictHostKeyChecking=no $EnvProductionLocal "${ServerUser}@${ServerIp}:/tmp/.env.production.tmp"
        ssh -o BatchMode=yes "${ServerUser}@${ServerIp}" "mkdir -p '$RemoteDir' && mv /tmp/.env.production.tmp '$RemoteDir/.env.production' && chmod 600 '$RemoteDir/.env.production'"
    } else {
        Write-Host "  -> .env.production já existente no servidor remoto (preservado)." -ForegroundColor Gray
    }
}

# 4. Descompactação e Execução no Servidor
Write-Host "`n[4/5] Descompactando e iniciando deploy no servidor remoto..." -ForegroundColor Yellow
$RemoteCmd = "set -e; " + `
    "mkdir -p $RemoteDir; " + `
    "tar -xzf /tmp/$ArchiveName -C $RemoteDir; " + `
    "rm -f /tmp/$ArchiveName; " + `
    "sed -i 's/\r$//' $RemoteDir/scripts/*.sh 2>/dev/null || true; " + `
    "chmod +x $RemoteDir/scripts/*.sh; " + `
    "$RemoteDir/scripts/remote-deploy.sh"

ssh -o StrictHostKeyChecking=no "${ServerUser}@${ServerIp}" $RemoteCmd
if ($LASTEXITCODE -ne 0) {
    Write-Error "Erro durante o deploy remoto no servidor!"
    exit 1
}

# 5. Conclusão e Limpeza Local
Write-Host "`n[5/5] Limpando arquivos temporários locais..." -ForegroundColor Yellow
if (Test-Path $ArchivePath) {
    Remove-Item $ArchivePath -Force
}

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "  DEPLOY DO NOVEX FINANCE CONCLUÍDO COM SUCESSO NO SERVIDOR!" -ForegroundColor Green
Write-Host "  Stacks isoladas: Trade (8026), Oficina (8080/3000), Finance (3001)" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
