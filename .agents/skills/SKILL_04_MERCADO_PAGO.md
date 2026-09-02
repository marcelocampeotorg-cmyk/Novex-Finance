# SKILL 04 — Mercado Pago

Documentos: `05_MERCADO_PAGO_INTEGRACAO.md`, `23_FONTES_OFICIAIS.md`.

## Antes de alterar
Revalidar documentação oficial do endpoint específico.

## Separação
- cobrança Pix != extrato;
- Orders/Payment status != Dinheiro em Conta;
- Dinheiro em Conta != saldo disponível;
- âncora do saldo = `BALANCE_AMOUNT` mais recente do Relatório de Liberações, com corte devolvido pela task;
- `total` do relatório não é saldo;
- saldo atualizado exige âncora + cobertura contínua dos `SETTLEMENT_NET_AMOUNT` posteriores;
- Sandbox != Production.

## Proibido
Implementar operação que retire/devolva dinheiro.

## Evidência
Sandbox oficial pode testar integração, mas nunca substituir resposta remota por “sucesso simulado”.

Para concluir saldo, provar em resposta real: task `processed`, arquivo oficial com `BALANCE_AMOUNT`, horário de corte persistido, cobertura posterior sem lacunas e comparação inicial com o aplicativo no mesmo corte.
