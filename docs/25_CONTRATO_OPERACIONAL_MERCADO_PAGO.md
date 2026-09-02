# 25 — Contrato Operacional Mercado Pago

**Pesquisa oficial revalidada em:** 2026-09-01
**Escopo:** saldo disponível, extrato, identificação de movimentações, cobranças Pix e webhooks.
**Regra:** este documento descreve como o NOVEX deve usar as APIs; não autoriza refund, payout, transferência ou qualquer saída de dinheiro.

## 1. Mapa de responsabilidades

| Necessidade do NOVEX | Fonte oficial | O que comprova | O que não comprova |
|---|---|---|---|
| Âncora do saldo disponível | `BALANCE_AMOUNT` do Relatório de Liberações | Saldo restante logo depois do último evento coberto | Saldo instantâneo sem complementar o período posterior |
| Saldo operacional atualizado | Âncora `BALANCE_AMOUNT` + `SETTLEMENT_NET_AMOUNT` posterior | Saldo calculado quando a cobertura oficial entre âncora e extrato é contínua | Saldo quando houver lacuna, job pendente ou extrato atrasado |
| Entradas e saídas | Relatório Dinheiro em Conta | Movimentações aprovadas que impactaram o dinheiro em conta | Saldo absoluto atual pela simples soma |
| Cobrança Pix | Orders API | QR, código Pix, estado da cobrança e crédito quando `processed/accredited` | Fato monetário duplicado no Ledger |
| Atualização de cobrança | Webhook de Order + GET `/v1/orders/{id}` | Mudança autenticada e estado oficial atual da Order | Crédito sem consultar o recurso oficial |
| Nome/instituição | Campos do relatório e enriquecimento oficial aplicável | Apenas dados efetivamente retornados pelo provedor | Nome de pessoa ou banco em toda movimentação |

Não foi encontrado, na referência pública oficial consultada, um endpoint direto documentado de “balance now”. A API oficial de Relatórios expõe configuração, geração assíncrona, task, listagem/pesquisa e download. Portanto, o NOVEX usa o Relatório de Liberações como fonte do saldo disponível e sempre mostra o horário do corte.

## 2. Saldo disponível — Relatório de Liberações

### 2.1 Endpoints oficiais

- `GET/POST/PUT /v1/account/release_report/config`
- `POST /v1/account/release_report`
- `GET /v1/account/release_report/task/{task-id}`
- `GET /v1/account/release_report/list`
- `GET /v1/account/release_report/search`
- `GET /v1/account/release_report/{file_name}`

A criação retorna HTTP 202 e é assíncrona. `task-id`, `report_id` e `file_name` são identidades diferentes e devem ser persistidas separadamente.

### 2.2 Janela, horário e atualidade

- período máximo: 60 dias;
- detalhe mínimo documentado: 1 dia;
- `begin_date` e `end_date` da API usam ISO 8601/UTC;
- o relatório possui fuso configurável e a documentação manda considerar o fuso da conta/país;
- a geração pode levar alguns minutos.

Na validação real de 2026-09-01, o provedor normalizou uma janela intradiária para dias civis completos no fuso configurado e manteve a tarefa pendente quando o fim ainda estava no futuro. O job de âncora solicita o último dia civil já encerrado. O `begin_date`/`end_date` devolvido pela task prevalece sobre o intervalo originalmente solicitado.

A configuração aceita `frequency.type=monthly`; isso não impede geração manual sob demanda. `execute_after_withdrawal` deve ser booleano explícito. O valor confirmado é rotulado com o corte financeiro real, não com o horário do download.

### 2.3 Colunas obrigatórias

Configuração CSV com, no mínimo:

- `DATE`;
- `SOURCE_ID`;
- `EXTERNAL_REFERENCE`;
- `RECORD_TYPE`;
- `DESCRIPTION`;
- `NET_CREDIT_AMOUNT`;
- `NET_DEBIT_AMOUNT`;
- `GROSS_AMOUNT`;
- `MP_FEE_AMOUNT`;
- `FINANCING_FEE_AMOUNT`;
- `SHIPPING_FEE_AMOUNT`;
- `TAXES_AMOUNT`;
- `COUPON_AMOUNT`;
- `INSTALLMENTS`;
- `PAYMENT_METHOD`.
- `BALANCE_AMOUNT`.

### 2.4 Tipos de registro e cálculo

- `initial_available_balance`: saldo disponível no início do período;
- `release`: liberações/movimentos que compõem o saldo;
- `total`: resultado líquido da soma dos subtotais; **não é sinônimo de saldo da conta**;
- `available_balance`: snapshots antes/depois de saque ou transferência, identificados por `pre_`/`pos_` na descrição.

O parser usa o `BALANCE_AMOUNT` da linha cronologicamente mais recente como âncora oficial, pois o glossário o define como saldo restante depois de uma transação que afetou o total. Nunca usar `total`, movimentação líquida ou soma do período como saldo. Linhas `available_balance` são informativas e não podem ser tratadas como prova isolada nem somadas como movimentos.

Para aproximar o saldo operacional do momento atual sem inventar dado, o NOVEX pode somar à âncora somente os `SETTLEMENT_NET_AMOUNT` oficiais posteriores ao corte quando o Relatório Dinheiro em Conta comprovar cobertura contínua até o horário exibido. A interface distingue **âncora oficial** de **saldo atualizado a partir de fontes oficiais**. Lacuna, task pendente, arquivo inválido ou cobertura atrasada mantém reconciliação e preserva o último corte conhecido.

### 2.5 Estados persistidos

`REQUESTED → PROCESSING → AVAILABLE → PARSING → CONFIRMED`

Estados de exceção:

- `FAILED`: API/task/download falhou;
- `INVALID`: CSV, moeda, período ou aritmética inválidos;
- `RECONCILING`: arquivo válido, mas a comparação inicial divergiu ou ainda não foi aprovada;
- `STALE`: saldo confirmado, porém acima da idade operacional configurada.

Enquanto não estiver `CONFIRMED`, o saldo Mercado Pago e o total Híbrido não aparecem como número oficial.

### 2.6 Idempotência e concorrência

- chave lógica: integração + `begin_date` + `end_date` + tipo `RELEASE`;
- um job em `REQUESTED/PROCESSING/AVAILABLE/PARSING` bloqueia novo POST equivalente;
- antes de repetir POST após timeout ambíguo, consultar task/list/search;
- download e parse podem ser repetidos, mas a âncora persistida precisa ser idempotente;
- uma âncora mais antiga nunca sobrescreve outra mais recente confirmada;
- falha do saldo não altera nem apaga as movimentações do Dinheiro em Conta.

## 3. Extrato — Relatório Dinheiro em Conta

### 3.1 Contrato

O Settlement Report contém transações aprovadas que afetaram o dinheiro em conta. Transações pendentes ou recusadas não aparecem. O NOVEX usa:

- `POST /v1/account/settlement_report`;
- `GET /v1/account/settlement_report/task/{task-id}`;
- `GET /v1/account/settlement_report/search` ou listagem oficial;
- `GET /v1/account/settlement_report/{file_name}`.

A geração também é assíncrona. Polling do frontend consulta estado persistido e nunca cria relatórios repetidamente.

### 3.2 Campos financeiros prioritários

- identidade: `SOURCE_ID`, `EXTERNAL_REFERENCE`, `ORDER_ID`, `ORDER_MP`, `TRANSACTION_INTENT_ID`;
- tipo: `TRANSACTION_TYPE`;
- bruto: `TRANSACTION_AMOUNT`;
- líquido que impactou a conta: `SETTLEMENT_NET_AMOUNT`;
- líquido ajustado: `REAL_AMOUNT`, quando aplicável;
- tarifas/impostos: `FEE_AMOUNT`, `MKP_FEE_AMOUNT`, `FINANCING_FEE_AMOUNT`, `SHIPPING_FEE_AMOUNT`, `TAXES_AMOUNT`;
- datas: `TRANSACTION_DATE`, `SETTLEMENT_DATE`, `MONEY_RELEASE_DATE`;
- método: `PAYMENT_METHOD`, `PAYMENT_METHOD_TYPE`, `OPERATION_TAGS`;
- descrição/auditoria: `DESCRIPTION`, `METADATA`, `SALE_DETAIL`.

`SETTLEMENT_NET_AMOUNT` é o impacto contábil atômico usado pelo Ledger. Bruto, taxas e payload oficial permanecem preservados; não gerar vários lançamentos para representar o mesmo impacto líquido.

### 3.3 Tipos de movimentação

Importar e contabilizar os tipos documentados e realmente retornados, incluindo `SETTLEMENT`, `REFUND`, `CHARGEBACK`, `DISPUTE`, `WITHDRAWAL`, `WITHDRAWAL_CANCEL`, `PAYOUT` e trava de recebível. Importar `PAYOUT` significa observar uma saída já ocorrida; nunca executá-la.

### 3.4 Histórico e late-arriving

- blocos consecutivos de até 60 dias;
- retomada persistida após reinicialização;
- overlap incremental de 3 dias;
- idempotência por identidade contábil composta quando um `SOURCE_ID` contiver mais de um evento;
- cobertura mostra somente janelas concluídas com sucesso;
- ausência de data inicial oficial permanece `LIMIT_UNKNOWN`, sem afirmar “histórico completo”.

## 4. Nomes, bancos e contrapartes

### 4.1 O que o relatório pode fornecer

- `DESCRIPTION`: descrição operacional;
- `POI_BANK_NAME`: instituição bancária de origem em pagamentos virtuais cobrados por QR, quando fornecida;
- `POI_WALLET_NAME`: carteira digital de origem, quando fornecida;
- `ISSUER_NAME`: instituição emissora do cartão/meio, quando fornecida;
- `STORE_NAME` e `POS_NAME`: loja/caixa em pagamentos físicos;
- `PAYMENT_METHOD` e `PAYMENT_METHOD_TYPE`: método/tipo;
- `SALE_DETAIL`: detalhe de venda;
- `METADATA`: dados adicionais oficiais ou fornecidos pela própria integração.

### 4.2 Limites

O glossário não garante nome da pessoa, instituição ou referência em todas as operações; `EXTERNAL_REFERENCE` pode vir vazio em boletos e envios de dinheiro. O sistema deve usar a seguinte precedência:

1. dado explícito no Settlement Report;
2. dado oficial de Order/Payment quando o `SOURCE_ID` representar de fato esse recurso e o endpoint aceitar a consulta;
3. vínculo interno confirmado pelo usuário/regra auditável;
4. **“Não informado pelo provedor”**.

Não consultar IDs de impostos, tarifas, saques ou eventos contábeis no endpoint de pagamentos. Não inferir pessoa a partir de descrição truncada e não expor documento pessoal desnecessário na interface.

## 5. Cobrança Pix — Orders API

### 5.1 Criação

- `POST /v1/orders` server-side;
- `X-Idempotency-Key` único e persistido;
- `processing_mode: automatic` para criação/processamento no mesmo fluxo;
- `payment_method.id: pix`;
- `payment_method.type: bank_transfer`;
- `external_reference` vinculada à parcela/cobrança NOVEX;
- valor vem da obrigação persistida, nunca de valor livre do navegador;
- e-mail do pagador é obrigatório no contrato documentado.

A resposta pode trazer `ticket_url`, `qr_code` e `qr_code_base64`. Antes do pagamento, o estado esperado é `action_required/waiting_transfer`.

### 5.2 Confirmação

Somente `status=processed` e `status_detail=accredited`, com Order/Payment, referência e valor compatíveis, pode liquidar o planejamento. `created`, `processing`, `action_required`, `waiting_transfer` ou simples exibição do QR nunca significam pagamento.

A Order baixa a obrigação planejada; o Settlement Report cria o fato monetário no Ledger. Repetição de polling/webhook não pode duplicar nenhum dos dois efeitos.

### 5.3 Teste oficial

O Mercado Pago documenta teste Pix pela Orders API usando credenciais de teste e um pagador de teste; após a criação, a Order muda de estado conforme o cenário oficial e deve ser consultada por `GET /v1/orders/{id}`. Relatórios de contas de teste podem vir sem dados, portanto teste de Order não substitui a prova contábil do extrato real.

## 6. Webhooks de Order

- configurar tópico `Order (Mercado Pago)`;
- produção exige URL HTTPS pública;
- validar `x-signature` e `x-request-id` com o segredo da aplicação;
- obter `data.id` dos query params/body conforme o payload recebido;
- manifesto HMAC-SHA256: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, omitindo pares ausentes conforme contrato oficial;
- comparação de assinatura em tempo constante;
- assinatura inválida retorna 401;
- webhook válido responde rapidamente e agenda processamento idempotente;
- sempre buscar `GET /v1/orders/{id}` antes de aplicar mudança financeira.

Como a instalação atual é somente local, webhooks produtivos externos não alcançam `localhost` sem túnel/URL pública. Até existir autorização para exposição, o worker deve manter polling controlado das Orders persistidas como fallback operacional, sem confundi-lo com prova de webhook produtivo.

## 7. Erros, segurança e observabilidade

- Access Token somente no servidor, criptografado em repouso;
- nunca enviar token por query string quando o endpoint suporta Bearer;
- timeout e retry com backoff/jitter;
- 401/403: falha de credencial/permissão, sem retry infinito;
- 429/5xx: retry controlado respeitando rate limit;
- timeout após POST: resultado ambíguo, pesquisar antes de repetir;
- payloads e CSVs preservados com acesso controlado, sem segredos em logs;
- erro nunca vira saldo zero, lista vazia ou status sincronizado;
- dashboard separa última sincronização do extrato, corte do saldo e estado das cobranças.

## 8. Critérios de aceite externos

### Saldo

- task real processada;
- CSV real baixado;
- aritmética fechada;
- `BALANCE_AMOUNT` e corte devolvido pela task persistidos;
- saldo atualizado só com cobertura contínua do Dinheiro em Conta após a âncora;
- comparação inicial com aplicativo no mesmo corte;
- divergência mantém reconciliação.

### Extrato

- amostra real comparada por ID, valor líquido e data;
- totais de créditos/débitos conferem com o CSV;
- instituição/nome somente quando fornecido;
- overlap não duplica fatos;
- reinicialização retoma o job.

### Pix

- cobrança oficial criada com idempotência;
- QR/copia e cola oficiais;
- transição oficial até `processed/accredited`;
- parcela baixada uma vez;
- Settlement registra o Ledger uma vez;
- webhook/polling duplicado não duplica efeito.

## 9. Fontes oficiais consultadas

- [Visão geral dos Relatórios](https://www.mercadopago.com.br/developers/pt/docs/reports/introduction)
- [Relatório de Liberações](https://www.mercadopago.com.br/developers/pt/docs/reports/released-money/introduction)
- [Usos do Relatório de Liberações](https://www.mercadopago.com.br/developers/pt/docs/reports/released-money/how-to-use)
- [Gerar Relatório de Liberações](https://www.mercadopago.com.br/developers/pt/docs/reports/released-money/generate)
- [Campos do Relatório de Liberações](https://www.mercadopago.com.br/developers/pt/docs/reports/released-money/report-fields)
- [API do Relatório de Liberações](https://www.mercadopago.com.br/developers/pt/docs/reports/released-money/api)
- [Referência de endpoints de Relatórios](https://www.mercadopago.com.br/developers/pt/reference/reports/overview)
- [Relatório Dinheiro em Conta](https://www.mercadopago.com.br/developers/pt/docs/reports/account-money/introduction)
- [Usos do Dinheiro em Conta](https://www.mercadopago.com.br/developers/pt/docs/reports/account-money/how-to-use)
- [Campos do Dinheiro em Conta](https://www.mercadopago.com.br/developers/pt/docs/reports/account-money/report-fields)
- [API do Dinheiro em Conta](https://www.mercadopago.com.br/developers/pt/docs/reports/account-money/api)
- [Pix com Orders API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix)
- [Status de Order](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/status/order-status)
- [Webhooks de Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications)
- [Teste oficial de Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix)
