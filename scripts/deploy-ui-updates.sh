#!/bin/bash
set -euo pipefail

DEST="/home/servidor/Área de trabalho/Sistemas/novex finance"

echo "=== [1/3] Movendo arquivos sincronizados ==="
mkdir -p "$DEST/src/app/(protected)/contas-a-pagar" \
         "$DEST/src/app/(protected)/lembretes" \
         "$DEST/src/components/modals" \
         "$DEST/src/components/ui"

[ -f /tmp/page.tsx ] && cp /tmp/page.tsx "$DEST/src/app/(protected)/page.tsx"
[ -f /tmp/contas_a_pagar_page.tsx ] && cp /tmp/contas_a_pagar_page.tsx "$DEST/src/app/(protected)/contas-a-pagar/page.tsx"
[ -f /tmp/lembretes_page.tsx ] && cp /tmp/lembretes_page.tsx "$DEST/src/app/(protected)/lembretes/page.tsx"
[ -f /tmp/ManualSettlementModal.tsx ] && cp /tmp/ManualSettlementModal.tsx "$DEST/src/components/modals/ManualSettlementModal.tsx"
[ -f /tmp/AccountDetailsDrawer.tsx ] && cp /tmp/AccountDetailsDrawer.tsx "$DEST/src/components/ui/AccountDetailsDrawer.tsx"
[ -f /tmp/NewAccountModal.tsx ] && cp /tmp/NewAccountModal.tsx "$DEST/src/components/ui/NewAccountModal.tsx"

echo "=== [2/3] Reconstruindo e reiniciando o container Next.js da aplicacao ==="
cd "$DEST"
docker compose --env-file .env.production -f docker-compose.prod.yml build app
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps app

echo "=== [3/3] Aguardando healthcheck na porta 3001 ==="
attempt=0
until curl -fsS http://127.0.0.1:3001/api/health >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 50 ]; then
    echo "ERRO: healthcheck falhou apos 50 tentativas."
    docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=50 app
    exit 1
  fi
  sleep 2
done

echo "DEPLOY_CONCLUIDO_COM_SUCESSO"
