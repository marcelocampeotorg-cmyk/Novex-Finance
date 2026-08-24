# 05 — Mercado Pago — Integração Oficial

## Responsabilidades diferentes

### Cobrança Pix
Usada para gerar uma cobrança específica de recebimento, com identificador/idempotência e status verificável.

### Dinheiro em Conta
Usado para importar as movimentações que efetivamente impactaram o dinheiro da conta. Não confundir com busca de pagamentos.

## Pipeline do relatório
A documentação oficial atual descreve criação assíncrona:
`POST /v1/account/settlement_report` → HTTP 202
Depois localizar/baixar o relatório e processar o arquivo oficial.

O pipeline precisa persistir estado:
`REQUESTED/PROCESSING → AVAILABLE → IMPORTING → SUCCESS/PARTIAL/FAILED`.

Não criar um relatório novo a cada render/poll do frontend.

## Campos
Preservar os campos oficiais úteis, entre eles:
- identificadores;
- `TRANSACTION_TYPE`;
- `TRANSACTION_AMOUNT`;
- `TRANSACTION_DATE`;
- `SETTLEMENT_DATE`;
- `SETTLEMENT_NET_AMOUNT`;
- `REAL_AMOUNT`;
- `FEE_AMOUNT`;
- `PAYMENT_METHOD_TYPE`;
- `METADATA`;
- descrição e referências disponíveis.

Nem todo campo é garantido para todo tipo de operação. Ausência de nome/referência não invalida o fato financeiro.

## Tipos
Suportar os tipos realmente retornados, incluindo SETTLEMENT, REFUND, CHARGEBACK, DISPUTE, WITHDRAWAL, PAYOUT, CASHBACK e demais tipos documentados. “Suportar” aqui significa importar e contabilizar corretamente, não executar essas operações.

## Ambiente
Sandbox e Production não podem ser misturados. A integração ativa deve ser determinada explicitamente e de forma persistente.

## Segurança
- token server-only;
- criptografia em repouso quando aplicável;
- nunca retornar credencial completa para client/server action exposta;
- logs sanitizados;
- timeout/retry controlado;
- rate limit;
- idempotência;
- validação de webhook quando suportado.

## Proibição
Não implementar endpoint de refund, payout, transferência ou pagamento de saída na V1.

## Fontes oficiais
Ver `23_FONTES_OFICIAIS.md`.
