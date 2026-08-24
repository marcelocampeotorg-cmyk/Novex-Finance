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

Pontos confirmados na documentação consultada em 24/08/2026:
- criação do settlement report é assíncrona e retorna HTTP 202 com id e file_name;
- busca de relatórios gerados é realizada via /settlement_report/search;
- download oficial do arquivo de liquidação é efetuado via GET /settlement_report/{file_name} com Authorization Bearer;
- `SETTLEMENT_NET_AMOUNT` representa o impacto líquido no dinheiro em conta;
- `TRANSACTION_TYPE` diferencia settlement, refund, chargeback, dispute, withdrawal, payout etc.;
- criação de order exige idempotency key;
- status de transação `processed` com `status_detail=accredited` representa processamento bem-sucedido com valor compensado.

## Cloudflare
- Next.js em Workers:
  https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Aplicações full-stack:
  https://developers.cloudflare.com/workers/static-assets/routing/full-stack-application/

Na documentação consultada em 24/08/2026, Cloudflare recomenda Workers/OpenNext para Next.js full-stack; Pages é apropriado principalmente ao caso de exportação estática.

## Evolution API
Usar a documentação oficial correspondente à versão efetivamente instalada. Não copiar endpoint de blog/tutorial sem conferir a versão.
