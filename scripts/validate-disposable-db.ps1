$ErrorActionPreference = "Stop"

$containerName = "novexfinance-db-validation-20260902"
$port = 55433
$created = $false
$previousDatabaseUrl = $env:DATABASE_URL
$previousTestDatabaseUrl = $env:TEST_DATABASE_URL

try {
  $existing = docker ps -a --filter "name=^/${containerName}$" --format "{{.Names}}"
  if ($existing) {
    throw "Container de validação já existe; remova-o conscientemente antes de repetir."
  }

  docker run -d --name $containerName -e POSTGRES_PASSWORD=novex_validation_only -e POSTGRES_DB=novexfinance_validation -p "127.0.0.1:${port}:5432" postgres:16-alpine | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Falha ao iniciar PostgreSQL descartável." }
  $created = $true

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    docker exec $containerName pg_isready -U postgres -d novexfinance_validation | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw "PostgreSQL descartável não ficou pronto." }

  $databaseUrl = "postgresql://postgres:novex_validation_only@127.0.0.1:${port}/novexfinance_validation?schema=public"
  $env:DATABASE_URL = $databaseUrl
  $env:TEST_DATABASE_URL = $databaseUrl

  npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy falhou no banco limpo." }
  npx prisma migrate status
  if ($LASTEXITCODE -ne 0) { throw "prisma migrate status falhou no banco limpo." }
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  $env:TEST_DATABASE_URL = $databaseUrl
  npm test
  if ($LASTEXITCODE -ne 0) { throw "Testes com banco descartável falharam." }
}
finally {
  $env:DATABASE_URL = $previousDatabaseUrl
  $env:TEST_DATABASE_URL = $previousTestDatabaseUrl
  if ($created) {
    docker rm -f $containerName | Out-Null
  }
}
