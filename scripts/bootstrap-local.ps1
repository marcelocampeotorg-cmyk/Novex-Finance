param([switch]$Start, [switch]$Initialize)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot ".env"
$values = [ordered]@{}

if (Test-Path -LiteralPath $envPath) {
  foreach ($line in Get-Content -LiteralPath $envPath) {
    if ($line -match '^\s*([^#][^=]+)=(.*)$') {
      $values[$matches[1].Trim()] = $matches[2]
    }
  }
}

function New-HexSecret([int]$bytes = 32) {
  $buffer = New-Object byte[] $bytes
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($buffer) } finally { $generator.Dispose() }
  return ([BitConverter]::ToString($buffer) -replace '-', '').ToLowerInvariant()
}

function New-Base64Secret([int]$bytes = 32) {
  $buffer = New-Object byte[] $bytes
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($buffer) } finally { $generator.Dispose() }
  return [Convert]::ToBase64String($buffer)
}

function Set-IfMissing([string]$name, [string]$value) {
  $current = if ($values.Contains($name)) { [string]$values[$name] } else { "" }
  if ([string]::IsNullOrWhiteSpace($current) -or ($Initialize -and $current -match 'GERAR_|USUARIO|SENHA_FORTE|REMOVIDO|BANCO$')) {
    $values[$name] = $value
  }
}

Set-IfMissing "NODE_ENV" "development"
Set-IfMissing "NOVEX_HTTP_PORT" "3001"
Set-IfMissing "APP_URL" "http://localhost:3001"
Set-IfMissing "NEXT_PUBLIC_APP_URL" "http://localhost:3001"
Set-IfMissing "POSTGRES_USER" "novex"
Set-IfMissing "POSTGRES_PASSWORD" (New-HexSecret 24)
Set-IfMissing "POSTGRES_DB" "novex_finance"
Set-IfMissing "AUTH_SECRET" (New-Base64Secret 48)
Set-IfMissing "WORKER_SECRET" (New-HexSecret 32)
Set-IfMissing "CREDENTIALS_ENCRYPTION_KEY_BASE64" (New-Base64Secret 32)
Set-IfMissing "MERCADO_PAGO_WEBHOOK_SECRET" (New-HexSecret 32)
Set-IfMissing "EVOLUTION_API_KEY" (New-HexSecret 32)
Set-IfMissing "EVOLUTION_API_URL" "http://127.0.0.1:8081"
Set-IfMissing "EVOLUTION_PUBLIC_URL" "http://localhost:8081"
Set-IfMissing "EVOLUTION_INSTANCE_NAME" "novex-finance"

Set-IfMissing "DATABASE_URL" "postgresql://$($values['POSTGRES_USER']):$($values['POSTGRES_PASSWORD'])@localhost:5432/$($values['POSTGRES_DB'])"
$lines = foreach ($item in $values.GetEnumerator()) { "$($item.Key)=$($item.Value)" }
Set-Content -LiteralPath $envPath -Value $lines -Encoding utf8

Write-Host "Configuração local validada. Valores existentes foram preservados; somente ausentes/placeholders foram gerados."
if ($Start) {
  & docker compose --project-directory $projectRoot up -d --build
  if ($LASTEXITCODE -ne 0) { throw "docker compose up falhou com código $LASTEXITCODE" }
}
