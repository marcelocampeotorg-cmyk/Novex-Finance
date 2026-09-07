#!/bin/bash
set -euo pipefail

DEST="/home/servidor/Área de trabalho/Sistemas/novex finance"

echo "=== [1/3] Movendo arquivos sincronizados ==="
mkdir -p "$DEST/src/components/modals" "$DEST/src/server/actions" "$DEST/src/lib" "$DEST/tests"

[ -f /tmp/manual-settlement.ts ] && cp /tmp/manual-settlement.ts "$DEST/src/server/actions/manual-settlement.ts"
[ -f /tmp/ManualSettlementModal.tsx ] && cp /tmp/ManualSettlementModal.tsx "$DEST/src/components/modals/ManualSettlementModal.tsx"
[ -f /tmp/transaction-presentation.ts ] && cp /tmp/transaction-presentation.ts "$DEST/src/lib/transaction-presentation.ts"
[ -f /tmp/workspace.ts ] && cp /tmp/workspace.ts "$DEST/src/server/actions/workspace.ts"
[ -f /tmp/page.tsx ] && cp /tmp/page.tsx "$DEST/src/app/(protected)/page.tsx"
[ -f /tmp/manual-settlement.test.js ] && cp /tmp/manual-settlement.test.js "$DEST/tests/manual-settlement.test.js"

echo "=== [2/3] Rodando testes dentro do servidor ==="
cd "$DEST"
npm test

echo "=== [3/3] Reconstruindo e reiniciando o container Next.js da aplicação ==="
docker compose --env-file .env.production -f docker-compose.prod.yml build app
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps app

echo "=== Aguardando healthcheck na porta 3001 ==="
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

echo "DEPLOY_CONCLUIDO_COM_SUCESSO"
