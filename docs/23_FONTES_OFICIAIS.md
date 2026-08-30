# 23 — Fontes Oficiais Técnicas

Estas referências devem ser revalidadas antes de uma implementação sensível, pois APIs evoluem.

## Mercado Pago
- Relatório Dinheiro em Conta — usos:
  https://www.mercadopago.com.br/developers/pt/docs/reports/account-money/how-to-use
- Campos do Dinheiro em Conta:
  https://www.mercadopago.com.br/developers/pt/docs/mp-point/additional-content/reports/account-money/report-fields
- Criar settlement report:
  POST https://api.mercadopago.com/v1/account/settlement_report
- Buscar settlement reports:
  GET https://api.mercadopago.com/v1/account/settlement_report/search
- Baixar settlement report pelo file_name:
  GET https://api.mercadopago.com/v1/account/settlement_report/{file_name}
- Criar order QR:
  https://www.mercadopago.com.br/developers/pt/reference/in-person-payments/qr-code/orders/create-order/post
- Status de order/transação QR:
  https://www.mercadopago.com.br/developers/pt/docs/qr-code/resources/status-order-transaction

Pontos confirmados e revalidados em 26/08/2026 e 29/08/2026:
- criação do settlement report é assíncrona e retorna uma tarefa; task, report e arquivo devem permanecer semanticamente separados;
- a tarefa específica é consultada por `/settlement_report/task/{task-id}` e o contrato efetivamente observado pode retornar `status=available`, identificador do report e uma coleção `files`;
- busca de relatórios gerados é realizada via /settlement_report/search;
- download oficial do arquivo de liquidação é efetuado via GET /settlement_report/{file_name} com Authorization Bearer;
- `SETTLEMENT_NET_AMOUNT` representa o impacto líquido no dinheiro em conta;
- `TRANSACTION_TYPE` diferencia settlement, refund, chargeback, dispute, withdrawal, payout etc.;
- criação de order exige idempotency key;
- status de transação `processed` com `status_detail=accredited` representa processamento bem-sucedido com valor compensado;
- Relatório de Liberações (Release Report): a documentação do Mercado Pago define os endpoints `/v1/account/release_report/config`, `/v1/account/release_report`, `/task/{id}`, `/list` e `/search`. Os campos oficiais documentados utilizam `RECORD_TYPE` (valores canônicos `initial_available_balance`, `available_balance`, `release`, `total`), coluna de data `DATE` e valores `NET_CREDIT_AMOUNT` / `NET_DEBIT_AMOUNT`. A elegibilidade de contas individuais depende de configuração prévia e nenhum POST deve ser realizado sem autorização explícita.

## Cloudflare
- Next.js em Workers:
  https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Aplicações full-stack:
  https://developers.cloudflare.com/workers/static-assets/routing/full-stack-application/

Na documentação consultada em 24/08/2026, Cloudflare recomenda Workers/OpenNext para Next.js full-stack; Pages é apropriado principalmente ao caso de exportação estática.

## Evolution API
Usar a documentação oficial correspondente à versão efetivamente instalada. Não copiar endpoint de blog/tutorial sem conferir a versão.
