$ErrorActionPreference = "Stop"

Write-Host "Enviando arquivos para o servidor 192.168.4.12..." -ForegroundColor Cyan

scp -o StrictHostKeyChecking=no src/integrations/evolution-api/client.ts "frank@192.168.4.12:/tmp/client.ts"
scp -o StrictHostKeyChecking=no src/server/services/notification-service.ts "frank@192.168.4.12:/tmp/notification-service.ts"
scp -o StrictHostKeyChecking=no src/server/actions/notifications.ts "frank@192.168.4.12:/tmp/notifications.ts"
scp -o StrictHostKeyChecking=no src/components/ui/LiveNotificationPopup.tsx "frank@192.168.4.12:/tmp/LiveNotificationPopup.tsx"
scp -o StrictHostKeyChecking=no src/components/modals/ReceivablePixChargeModal.tsx "frank@192.168.4.12:/tmp/ReceivablePixChargeModal.tsx"
scp -o StrictHostKeyChecking=no "src/app/(protected)/configuracoes/page.tsx" "frank@192.168.4.12:/tmp/configuracoes_page.tsx"
scp -o StrictHostKeyChecking=no "src/app/(protected)/contas-a-receber/page.tsx" "frank@192.168.4.12:/tmp/contas_a_receber_page.tsx"
scp -o StrictHostKeyChecking=no tests/whatsapp-custom-message.test.js "frank@192.168.4.12:/tmp/whatsapp-custom-message.test.js"
scp -o StrictHostKeyChecking=no scripts/deploy-cobranca-pix-evolution.sh "frank@192.168.4.12:/tmp/deploy-cobranca-pix-evolution.sh"

Write-Host "Arquivos transferidos. Executando deploy e build no servidor..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no frank@192.168.4.12 "chmod +x /tmp/deploy-cobranca-pix-evolution.sh && /tmp/deploy-cobranca-pix-evolution.sh"

Write-Host "Deploy finalizado com sucesso!" -ForegroundColor Green
