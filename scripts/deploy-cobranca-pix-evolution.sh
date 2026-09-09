#!/bin/bash
set -euo pipefail

DEST="/home/servidor/Área de trabalho/Sistemas/novex finance"

echo "=== [1/3] Movendo arquivos sincronizados ==="
mkdir -p "$DEST/src/integrations/evolution-api" \
         "$DEST/src/server/services" \
         "$DEST/src/server/actions" \
         "$DEST/src/components/ui" \
         "$DEST/src/components/modals" \
         "$DEST/src/app/(protected)/configuracoes" \
         "$DEST/src/app/(protected)/contas-a-receber" \
         "$DEST/tests"

[ -f /tmp/client.ts ] && cp /tmp/client.ts "$DEST/src/integrations/evolution-api/client.ts"
[ -f /tmp/notification-service.ts ] && cp /tmp/notification-service.ts "$DEST/src/server/services/notification-service.ts"
[ -f /tmp/notifications.ts ] && cp /tmp/notifications.ts "$DEST/src/server/actions/notifications.ts"
[ -f /tmp/LiveNotificationPopup.tsx ] && cp /tmp/LiveNotificationPopup.tsx "$DEST/src/components/ui/LiveNotificationPopup.tsx"
[ -f /tmp/ReceivablePixChargeModal.tsx ] && cp /tmp/ReceivablePixChargeModal.tsx "$DEST/src/components/modals/ReceivablePixChargeModal.tsx"
[ -f /tmp/configuracoes_page.tsx ] && cp /tmp/configuracoes_page.tsx "$DEST/src/app/(protected)/configuracoes/page.tsx"
[ -f /tmp/contas_a_receber_page.tsx ] && cp /tmp/contas_a_receber_page.tsx "$DEST/src/app/(protected)/contas-a-receber/page.tsx"
[ -f /tmp/whatsapp-custom-message.test.js ] && cp /tmp/whatsapp-custom-message.test.js "$DEST/tests/whatsapp-custom-message.test.js"

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
  if [ "$attempt" -ge 50 ]; then
    echo "ERRO: healthcheck falhou após 50 tentativas."
    docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=50 app
    exit 1
  fi
  sleep 2
done

echo "DEPLOY_CONCLUIDO_COM_SUCESSO"
