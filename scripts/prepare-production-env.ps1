param(
  [string]$PublicUrl = "https://www.app.novexfinance.com.br"
)

$ErrorActionPreference = "Stop"
$sourcePath = Join-Path $PSScriptRoot "..\.env"
$targetPath = Join-Path $PSScriptRoot "..\.env.production"

if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw ".env local não encontrado."
}

$values = @{}
foreach ($line in Get-Content -LiteralPath $sourcePath) {
  if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
  $name, $value = $line -split '=', 2
  $values[$name.Trim()] = $value.Trim()
}

$required = @(
  "AUTH_SECRET",
  "WORKER_SECRET",
  "CREDENTIALS_ENCRYPTION_KEY_BASE64",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "EVOLUTION_API_KEY"
)

foreach ($name in $required) {
  $value = [string]$values[$name]
  if ([string]::IsNullOrWhiteSpace($value) -or $value -match '^(GERAR|REMOVIDO|USUARIO|SENHA|BANCO)') {
    throw "Variável obrigatória inválida para produção: $name"
  }
}

$randomBytes = New-Object byte[] 32
$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$random.GetBytes($randomBytes)
$random.Dispose()
$serverDbPassword = [Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+', 'A').Replace('/', 'B')

$instanceName = if ($values["EVOLUTION_INSTANCE_NAME"]) { $values["EVOLUTION_INSTANCE_NAME"] } else { "novex-finance" }
$content = @(
  "NODE_ENV=production",
  "NOVEX_HTTP_PORT=3001",
  "NOVEX_EVOLUTION_PORT=8081",
  "NEXT_PUBLIC_APP_URL=$PublicUrl",
  "POSTGRES_USER=novexfinance",
  "POSTGRES_PASSWORD=$serverDbPassword",
  "POSTGRES_DB=novexfinance",
  "AUTH_SECRET=$($values['AUTH_SECRET'])",
  "WORKER_SECRET=$($values['WORKER_SECRET'])",
  "CREDENTIALS_ENCRYPTION_KEY_BASE64=$($values['CREDENTIALS_ENCRYPTION_KEY_BASE64'])",
  "MERCADO_PAGO_WEBHOOK_SECRET=$($values['MERCADO_PAGO_WEBHOOK_SECRET'])",
  "EVOLUTION_API_KEY=$($values['EVOLUTION_API_KEY'])",
  "EVOLUTION_INSTANCE_NAME=$instanceName",
  "BACKUP_RETENTION_DAYS=14",
  "BACKUP_INTERVAL_SECONDS=86400"
) -join "`n"

[System.IO.File]::WriteAllText($targetPath, "$content`n", [System.Text.UTF8Encoding]::new($false))
Write-Output ".env.production criado sem exibir segredos."
