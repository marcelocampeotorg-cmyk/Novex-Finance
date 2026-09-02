# 23 — Fontes Oficiais Técnicas

Estas referências devem ser revalidadas antes de uma implementação sensível, pois APIs evoluem.

## Mercado Pago
- Contrato operacional pesquisado e consolidado:
  [25_CONTRATO_OPERACIONAL_MERCADO_PAGO.md](./25_CONTRATO_OPERACIONAL_MERCADO_PAGO.md)
- Visão geral dos relatórios:
  https://www.mercadopago.com.br/developers/pt/docs/reports/introduction
- Relatório de Liberações — introdução, usos, geração, campos e API:
  https://www.mercadopago.com.br/developers/pt/docs/reports/released-money/introduction
  https://www.mercadopago.com.br/developers/pt/docs/reports/released-money/how-to-use
  https://www.mercadopago.com.br/developers/pt/docs/reports/released-money/generate
  https://www.mercadopago.com.br/developers/pt/docs/reports/released-money/report-fields
  https://www.mercadopago.com.br/developers/pt/docs/reports/released-money/api
- Referência consolidada de endpoints de relatórios:
  https://www.mercadopago.com.br/developers/pt/reference/reports/overview
- Relatório Dinheiro em Conta — usos:
  https://www.mercadopago.com.br/developers/pt/docs/reports/account-money/how-to-use
- Campos do Dinheiro em Conta:
  https://www.mercadopago.com.br/developers/pt/docs/reports/account-money/report-fields
- Criar settlement report:
  POST https://api.mercadopago.com/v1/account/settlement_report
- Buscar settlement reports:
  GET https://api.mercadopago.com/v1/account/settlement_report/search
- Baixar settlement report pelo file_name:
  GET https://api.mercadopago.com/v1/account/settlement_report/{file_name}
- Pix com Orders API:
  https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix
- Status de Order:
  https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/status/order-status
- Webhooks de Orders:
  https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications
- Teste oficial Pix:
  https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix

Pontos confirmados e revalidados em 26/08/2026, 29/08/2026 e 01/09/2026:
- criação do settlement report é assíncrona e retorna uma tarefa; task, report e arquivo devem permanecer semanticamente separados;
- a tarefa específica é consultada por `/settlement_report/task/{task-id}` e o contrato efetivamente observado pode retornar `status=available`, identificador do report e uma coleção `files`;
- busca de relatórios gerados é realizada via /settlement_report/search;
- download oficial do arquivo de liquidação é efetuado via GET /settlement_report/{file_name} com Authorization Bearer;
- `SETTLEMENT_NET_AMOUNT` representa o impacto líquido no dinheiro em conta;
- `TRANSACTION_TYPE` diferencia settlement, refund, chargeback, dispute, withdrawal, payout etc.;
- criação de order exige idempotency key;
- status de transação `processed` com `status_detail=accredited` representa processamento bem-sucedido com valor compensado;
- Relatório de Liberações: a documentação define configuração, geração, task, lista/pesquisa e download. `BALANCE_AMOUNT` é o saldo restante após evento que afeta o total; `total` é resultado líquido de subtotais e não deve ser confundido com saldo. A API real exigiu `execute_after_withdrawal` booleano, frequência mensal na configuração e normalizou período intradiário para dias civis completos.
- a referência pública consultada não expõe endpoint direto de saldo instantâneo; saldo disponível deve ser obtido do Relatório de Liberações com horário de corte;
- relatórios de teste podem ser gerados/listados, mas a documentação alerta que podem vir sem dados;
- `POI_BANK_NAME`, `POI_WALLET_NAME` e `ISSUER_NAME` podem identificar instituição/carteira quando fornecidos; não existe garantia de nome/contraparte em toda movimentação;
- Pix Orders usa `payment_method.id=pix`, `type=bank_transfer`, `X-Idempotency-Key` e aguarda `processed/accredited`;
- webhook de Order requer validação de `x-signature`, `x-request-id` e `data.id`, seguida de GET da Order antes de alterar estado financeiro.

## Cloudflare
- Next.js em Workers:
  https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Aplicações full-stack:
  https://developers.cloudflare.com/workers/static-assets/routing/full-stack-application/

Na documentação consultada em 24/08/2026, Cloudflare recomenda Workers/OpenNext para Next.js full-stack; Pages é apropriado principalmente ao caso de exportação estática.

## Evolution API
Usar a documentação oficial correspondente à versão efetivamente instalada. Não copiar endpoint de blog/tutorial sem conferir a versão.
