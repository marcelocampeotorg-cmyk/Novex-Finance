# 05 — Mercado Pago — Integração Oficial

## Responsabilidades diferentes

### Cobrança Pix
Usada para gerar uma cobrança específica de recebimento, com identificador/idempotência e status verificável.

### Dinheiro em Conta
Usado para importar as movimentações que efetivamente impactaram o dinheiro da conta. Não confundir com busca de pagamentos.

### Separação de efeitos
Uma Order/PixCharge oficial pode liquidar o planejamento de uma parcela quando houver evidência suficiente, mas não cria o fato monetário definitivo do Ledger. Account Money cria/importa a `ExternalTransaction` e o `LedgerEntry` correspondente. Os dois fluxos não podem criar impactos duplicados para o mesmo pagamento.

## Pipeline do relatório
A documentação oficial atual descreve criação assíncrona:
`POST /v1/account/settlement_report` → HTTP 202
Depois localizar/baixar o relatório e processar o arquivo oficial.

O pipeline precisa persistir estado:
`REQUESTED/PROCESSING → AVAILABLE → IMPORTING → SUCCESS/PARTIAL/FAILED`.

Não criar um relatório novo a cada render/poll do frontend.

## Cobertura histórica

- Cada relatório cobre no máximo 60 dias.
- A carga inicial percorre janelas consecutivas de até 60 dias até a data oficial de criação/limite realmente disponibilizado pelo provedor.
- Se o provedor não informar uma data inicial confiável, registrar a limitação e não inventar cobertura.
- A sincronização normal retoma de `coverageEnd`, com sobreposição curta e importação idempotente para capturar ajustes tardios.
- Progresso, janela atual, cobertura, rejeições e erro precisam ser persistidos e exibidos.

## Saldo disponível

O relatório Dinheiro em Conta comprova movimentações, não deve ser somado e rotulado como saldo atual. O relatório de Liberações pode ser usado como âncora somente depois de validar em resposta real os campos, o horário de corte e a correspondência com o saldo exibido pelo Mercado Pago. Sem essa prova, o saldo permanece indisponível/em reconciliação.

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

Nenhum timestamp financeiro pode ser inventado. Datas de criação ou atualização técnica de uma Order não são automaticamente a data do pagamento. O `occurredAt` do Ledger deve preservar o timestamp oficial associado ao fato financeiro importado.

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
