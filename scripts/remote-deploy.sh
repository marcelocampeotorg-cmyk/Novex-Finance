#!/usr/bin/env bash
# ==============================================================================
# NOVEX FINANCE - SCRIPT DE DEPLOY E VALIDAÇÃO REMOTA (LINUX)
# Servidor Oficial: novexserver (192.168.4.12)
# Caminho Canônico: /srv/novex/finance
# ==============================================================================
set -euo pipefail

TARGET_DIR="/srv/novex/finance"
BACKUP_DIR="/srv/novex/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

echo "=== [1/6] Verificando integridade do ambiente /srv/novex/finance ==="
mkdir -p "${TARGET_DIR}" "${BACKUP_DIR}" "${TARGET_DIR}/logs"
cd "${TARGET_DIR}"

# 1. Garantir que .env.production existe e tem permissões restritas (600)
if [ ! -f "${TARGET_DIR}/.env.production" ]; then
  echo "ERRO CRÍTICO: ${TARGET_DIR}/.env.production não encontrado!"
  echo "Por favor, crie o arquivo com as credenciais antes de iniciar o deploy."
  exit 1
fi
chmod 600 "${TARGET_DIR}/.env.production"

# 2. Backup pré-deploy da stack Finance se compose já existir
if [ -f "${TARGET_DIR}/docker-compose.prod.yml" ]; then
  echo "=== [2/6] Criando backup dos manifestos atuais em ${BACKUP_DIR} ==="
  tar -czf "${BACKUP_DIR}/finance-pre-deploy-${TIMESTAMP}.tar.gz" \
    --exclude="node_modules" \
    --exclude=".next" \
    --exclude="uploads" \
    --exclude="*.log" \
    docker-compose.prod.yml 2>/dev/null || true
fi

# 3. Execução das migrações do Prisma com isolamento transacional
echo "=== [3/6] Aplicando migrações do banco de dados (Prisma Migrate) ==="
docker compose -p novexfinance-prod --env-file .env.production -f docker-compose.prod.yml up -d db redis
for i in $(seq 1 30); do
  db_health=$(docker inspect --format='{{json .State.Health.Status}}' novexfinance-prod-db-1 2>/dev/null || echo '"starting"')
  if [ "$db_health" = '"healthy"' ]; then
    echo "PostgreSQL pronto e saudável!"
    break
  fi
  sleep 2
done

# Executa container efêmero de migração
docker compose -p novexfinance-prod --env-file .env.production -f docker-compose.prod.yml run --rm migrate

# 4. Build das imagens de produção (App Next.js e Worker de Cobrança)
echo "=== [4/6] Compilando imagens Docker otimizadas (App & Worker) ==="
docker compose -p novexfinance-prod --env-file .env.production -f docker-compose.prod.yml build --pull app worker

# 5. Inicialização dos serviços com isolamento total
echo "=== [5/6] Subindo stack novexfinance-prod ==="
docker compose -p novexfinance-prod --env-file .env.production -f docker-compose.prod.yml up -d --remove-orphans app worker evolution

# 6. Validação de Saúde no Loopback e Isolamento de Stacks
echo "=== [6/6] Validando saúde dos serviços e garantia de não-colisão ==="
attempt=0
max_attempts=30
health_ok=0

echo "Aguardando endpoint http://127.0.0.1:3001/api/health responder HTTP 200..."
until curl -fsS http://127.0.0.1:3001/api/health >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "ERRO: O healthcheck de novexfinance-prod-app falhou após ${max_attempts} tentativas!"
    docker compose -p novexfinance-prod --env-file .env.production -f docker-compose.prod.yml logs --tail=60 app
    exit 1
  fi
  sleep 2
done

echo "Healthcheck do App: OK (HTTP 200 via 127.0.0.1:3001)"

# Verificação de segurança: checar se os outros produtos permanecem ativos no servidor
echo "Verificando integridade das outras stacks hospedadas no servidor..."
docker ps --format '{{.Names}}' | grep -q "novex_trade_engine" && echo "Stack Novex Trade: ATIVA (intacta)" || echo "Aviso: novex_trade_engine não detectado."
docker ps --format '{{.Names}}' | grep -q "saas-oficina" && echo "Stack Novex Oficina: ATIVA (intacta)" || echo "Aviso: saas-oficina não detectado."

echo "----------------------------------------------------------------------"
echo "DEPLOY DO NOVEX FINANCE CONCLUÍDO COM SUCESSO!"
echo "Containers ativos:"
docker ps --filter "name=novexfinance-prod" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo "----------------------------------------------------------------------"
