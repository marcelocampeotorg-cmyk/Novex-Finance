#!/bin/bash
set -e

cd "/home/servidor/Área de trabalho/Sistemas/novex finance"

echo "=== [1/4] Iniciando build da imagem novexfinance-prod-app ==="
docker compose --env-file .env.production -f docker-compose.prod.yml build app

echo "=== [2/4] Atualizando container app ==="
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps app

echo "=== [3/4] Aguardando healthcheck do Next.js no loopback 127.0.0.1:3001 ==="
attempt=0
until curl -fsS http://127.0.0.1:3001/api/health >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 40 ]; then
    echo "ERRO: healthcheck falhou após 40 tentativas."
    docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=50 app
    exit 1
  fi
  sleep 2
done

echo "=== [4/4] Verificando integridade da imagem e do container ==="
docker inspect --format='Image Created: {{.Created}}' novexfinance-prod-app
docker ps --filter "name=novexfinance-prod-app" --format "Container: {{.Names}} | Status: {{.Status}}"

echo "BUILD_AND_DEPLOY_SUCCESS"
