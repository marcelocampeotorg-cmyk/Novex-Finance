$ErrorActionPreference = "Stop"

Write-Host "Enviando arquivos de UI para o servidor 192.168.4.12..." -ForegroundColor Cyan

scp -o StrictHostKeyChecking=no "src/app/(protected)/page.tsx" "frank@192.168.4.12:/tmp/page.tsx"
scp -o StrictHostKeyChecking=no "src/app/(protected)/contas-a-pagar/page.tsx" "frank@192.168.4.12:/tmp/contas_a_pagar_page.tsx"
scp -o StrictHostKeyChecking=no "src/app/(protected)/lembretes/page.tsx" "frank@192.168.4.12:/tmp/lembretes_page.tsx"
scp -o StrictHostKeyChecking=no "src/components/modals/ManualSettlementModal.tsx" "frank@192.168.4.12:/tmp/ManualSettlementModal.tsx"
scp -o StrictHostKeyChecking=no "src/components/ui/AccountDetailsDrawer.tsx" "frank@192.168.4.12:/tmp/AccountDetailsDrawer.tsx"
scp -o StrictHostKeyChecking=no "src/components/ui/NewAccountModal.tsx" "frank@192.168.4.12:/tmp/NewAccountModal.tsx"
scp -o StrictHostKeyChecking=no "scripts/deploy-ui-updates.sh" "frank@192.168.4.12:/tmp/deploy-ui-updates.sh"

Write-Host "Arquivos transferidos com sucesso. Executando build e deploy no servidor..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no frank@192.168.4.12 "chmod +x /tmp/deploy-ui-updates.sh && /tmp/deploy-ui-updates.sh"

Write-Host "Deploy de UI finalizado com sucesso!" -ForegroundColor Green
