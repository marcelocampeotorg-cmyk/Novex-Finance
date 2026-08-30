# 24 — Resumo Canônico Operacional

Este documento consolida a arquitetura e as regras atuais do NOVEX Finance para consulta e comparação. Em caso de conflito, prevalecem [Decisões Confirmadas](./21_DECISOES_CONFIRMADAS.md), [Regras Inegociáveis](./02_REGRAS_INEGOCIAVEIS.md) e o documento funcional específico.

## 1. Objetivo do NOVEX Finance

O NOVEX Finance é um gestor financeiro pessoal automatizado, inicialmente para uma única pessoa.

Ele deve controlar contas a pagar e receber, gerar cobranças Pix, gerar QR/Pix Copia e Cola para pagamentos realizados pelo usuário, observar o Mercado Pago, importar entradas e saídas reais, manter um Ledger auditável, conciliar movimentações, aprender padrões confirmados, cobrar devedores pela Evolution API e atualizar a interface sem F5.

Não é banco, ERP, terminal de trading, sistema contábil completo nem plataforma multiempresa. Ver [Visão do Produto](./01_VISAO_PRODUTO.md).

## 2. Regra financeira máxima

O NOVEX pode observar, importar, interpretar, categorizar, conciliar, gerar QR/Pix para o usuário pagar e gerar cobranças Pix para receber.

O NOVEX nunca pode enviar Pix, transferir dinheiro, pagar boleto, efetuar payout, sacar ou executar refund, estorno ou devolução pela API.

Gerar QR, abrir modal, clicar em “paguei” ou aguardar um intervalo nunca comprova pagamento. Ver [Regras Inegociáveis](./02_REGRAS_INEGOCIAVEIS.md).

## 3. Separação financeira

O domínio possui três camadas distintas:

1. **Planejamento:** conta, parcela, vencimento ou recorrência futura.
2. **Movimentação real:** dinheiro que efetivamente entrou ou saiu, comprovado por fonte oficial.
3. **Conciliação:** vínculo entre uma movimentação real e algo planejado.

Toda movimentação real afeta o Ledger e a movimentação líquida conhecida, mesmo quando ainda não foi identificada ou conciliada. Entretanto, a soma das movimentações importadas não prova automaticamente o saldo absoluto atual da conta.

Enquanto não houver âncora oficial e cobertura contínua suficiente, a conta Mercado Pago deve utilizar conceitos como “Movimentação líquida conhecida”, “Saldo em reconciliação”, “Fluxo conhecido” ou “Cobertura financeira conhecida”. Saldo manual não é arquitetura oficial na V1 e não deve ser exigido do usuário na interface nem utilizado para fabricar saldos do Mercado Pago.

Se futuramente uma fonte oficial fornecer saldo absoluto comprovado, esse saldo poderá ser exibido com sua fonte, cobertura e timestamp.

Ver [Fonte da Verdade](./00_FONTE_DA_VERDADE.md) e [Arquitetura Funcional](./03_ARQUITETURA_FUNCIONAL.md).

## 4. Ledger, cobertura e saldo

O Ledger é o livro-caixa interno, auditável e idempotente dos fatos financeiros conhecidos.

- movimentações desconhecidas também entram no Ledger;
- valor, direção, fonte e timestamp financeiro vêm da fonte oficial;
- classificação e conciliação podem ser corrigidas sem reescrever o fato original;
- o payload bruto deve ser preservado de forma segura para auditoria;
- lacunas de cobertura precisam permanecer explícitas;
- valor da conta manual não pode esconder falha de sincronização nem sobrescrever saldo Mercado Pago.

O sistema pode calcular entradas, saídas, resultado do período e movimentação líquida conhecida. Esses cálculos somente podem ser apresentados como saldo absoluto quando existir evidência oficial suficiente para isso.

Ver [Modelo Financeiro, Ledger e Saldo](./04_MODELO_FINANCEIRO_LEDGER_E_SALDO.md).

## 5. Mercado Pago: Orders e Account Money

Orders/PixCharge e Account Money possuem responsabilidades diferentes.

### Orders/PixCharge

- prova a situação de uma cobrança específica;
- associa devedor, item financeiro, parcela, cobrança e order/payment oficial;
- pode liquidar o planejamento da parcela quando houver evidência oficial suficiente de processamento e crédito;
- não cria, por si só, o fato monetário definitivo do Ledger.

Uma parcela não precisa aguardar necessariamente o Settlement Report quando a própria Order oficial já comprovar o pagamento conforme o contrato da API. Essa baixa altera o planejamento, não duplica o impacto financeiro no Ledger.

### Account Money/Dinheiro em Conta

- registra os fatos que realmente impactaram o dinheiro da conta;
- cria ou importa a `ExternalTransaction`;
- produz o `LedgerEntry` correspondente;
- usa `SETTLEMENT_NET_AMOUNT` como impacto líquido quando aplicável;
- preserva valor nominal, tarifas, referências, tipo, fonte e payload oficial.

O mesmo pagamento não pode gerar um impacto pelo fluxo de Orders e outro pelo Account Money. A Order confirma a cobrança e pode liquidar o planejamento; o Account Money registra o fato financeiro no Ledger.

O Settlement Report é assíncrono. O backend deve persistir e acompanhar task, report e `file_name`, baixar o arquivo oficial e importar de forma idempotente. Polling visual apenas acompanha o estado persistido e não cria relatórios repetidamente.

Ver [Integração Mercado Pago](./05_MERCADO_PAGO_INTEGRACAO.md) e [Fontes Oficiais](./23_FONTES_OFICIAIS.md).

## 6. Contas a receber e cobrança Pix

Uma obrigação a receber pode conter devedor, telefone, descrição, valor, vencimento, parcelas, observações e estratégia de cobrança.

O valor da cobrança Pix é derivado da obrigação persistida. O navegador não escolhe livremente o valor. Uma cobrança somente pode ser considerada paga com evidência oficial suficiente e compatível com seus identificadores e valor.

Pagamento divergente não vira parcial automaticamente. Pagamento duplicado gera alerta e não é aplicado silenciosamente a outra dívida. Repetição de webhook ou polling não pode duplicar baixa ou crédito.

Ver [Contas a Receber e Cobrança Pix](./06_CONTAS_A_RECEBER_E_COBRANCA_PIX.md).

## 7. Contas a pagar

O NOVEX gera BR Code/Pix Copia e Cola e QR Code real para o usuário pagar externamente. A geração cria uma intenção de pagamento, não um pagamento.

Somente uma movimentação oficial de saída, conciliada com evidência suficiente, pode confirmar a baixa. O NOVEX não envia o Pix e não simula pagamento.

Ver [Contas a Pagar e QR Code](./07_CONTAS_A_PAGAR_E_QR_CODE.md).

## 8. Conciliação inteligente

A conciliação considera múltiplas evidências, como identificador oficial, referência, valor, direção, contraparte, descrição, data, janela temporal, recorrência e vínculo com cobrança criada pelo NOVEX.

- confiança alta: pode conciliar automaticamente;
- confiança média: sugere ao usuário;
- confiança baixa: mantém não identificada.

Regras aprendidas devem ser visíveis, editáveis, desativáveis, auditáveis e reversíveis. Movimentação não identificada continua afetando o Ledger.

Ver [Movimentações e Conciliação](./08_MOVIMENTACOES_E_CONCILIACAO_INTELIGENTE.md).

## 9. Recorrências e categorias

O sistema pode identificar padrões, sugerir recorrências, projetar gastos, sugerir categorias e criar regras após evidência suficiente. Previsão nunca se transforma automaticamente em fato financeiro ou conta paga.

Ver [Automação, Recorrências e Categorias](./09_AUTOMACAO_RECORRENCIAS_E_CATEGORIAS.md).

## 10. Evolution API e WhatsApp

O WhatsApp é usado para cobrança de devedores. O servidor carrega a cobrança real, monta a mensagem e envia pela Evolution API conforme a cadência já configurada.

A API key permanece somente no servidor. Base URL, instância, telefone, timeout, retry, registro de tentativa e idempotência precisam ser tratados explicitamente. Reprocessamento não pode duplicar a mesma etapa de cobrança.

Falha no WhatsApp não altera o estado financeiro. Mensagem enviada e dívida paga são fatos independentes.

Ver [Evolution API e Cobranças por WhatsApp](./10_EVOLUTION_WHATSAPP_COBRANCAS.md).

## 11. Atualização automática, PWA e notificações

A interface deve atualizar sem F5 por meio de eventos, webhooks, polling controlado do estado persistido, SSE, WebSocket ou invalidação adequada. Polling visual não dispara operações remotas repetidamente.

A PWA deve possuir manifest, ícones oficiais, service worker seguro, modo standalone e experiência mobile. Push é opt-in e não pode ser declarado funcional sem configuração e homologação reais.

Ver [Atualização sem F5, PWA e Notificações](./11_REALTIME_PWA_E_NOTIFICACOES.md).

## 12. Interface e identidade visual

A interface é dark-first, premium, limpa, moderna, responsiva e coerente com a identidade NOVEX.

A experiência principal deve usar linguagem financeira. Termos como worker, settlement report, workspace, token e sandbox pertencem a Configurações ou Diagnóstico.

O dashboard deve priorizar:

- movimentação líquida conhecida ou saldo em reconciliação;
- fonte, período e cobertura financeira conhecida;
- entradas e saídas;
- projeções explicitamente identificadas como projeções;
- vencimentos e recebimentos;
- pendências que exigem decisão;
- evolução temporal com dados reais.

“Saldo atual” ou “saldo disponível” somente pode ser usado quando houver saldo absoluto comprovado por fonte oficial. Gráficos principais devem preferir linha ou área; candlestick não faz parte do produto.

Ver [UX/UI e Identidade Visual](./12_UX_UI_IDENTIDADE_VISUAL.md).

## 13. Dashboard e relatórios

O dashboard deve responder:

1. qual é a movimentação líquida conhecida;
2. quanto entrou e saiu;
3. qual período possui cobertura comprovada;
4. quanto vence em breve;
5. quanto há a receber;
6. o que mudou;
7. o que exige atenção.

Se futuramente existir saldo absoluto comprovado por fonte oficial, ele poderá ser exibido com fonte, cobertura e última atualização.

Erro nunca vira `R$ 0`. A interface distingue carregamento, ausência real de dados, processamento, erro e sucesso. Relatórios usam dados reais; CSV deve ser UTF-8 e seguro contra CSV Injection.

Ver [Dashboard, Relatórios e Analytics](./13_DASHBOARD_RELATORIOS_E_ANALYTICS.md).

## 14. Timestamps financeiros

Nenhum timestamp financeiro pode ser inventado.

Quando o provedor fornecer `occurred_at`, `transaction_date`, `settlement_date` ou outro campo oficialmente definido, o sistema preserva a semântica daquele campo. `created_date` ou `last_updated_date` de uma Order não deve ser chamado automaticamente de data do pagamento.

Não se pode usar `new Date()` ou `Date.now()` como fallback para afirmar data ou horário de pagamento ocorrido no provedor. Para fatos do Ledger, o timestamp deve vir da fonte financeira oficial. Timestamps técnicos locais de recepção, processamento e auditoria podem existir, mas precisam permanecer semanticamente separados do momento do fato financeiro.

## 15. Segurança

Credenciais ficam no servidor e, quando persistidas, são criptografadas em repouso. Server Actions públicas autenticam a sessão, não confiam em `workspaceId` arbitrário e retornam DTOs sanitizados. Logs não expõem segredos.

Webhooks devem validar autenticidade, deduplicar eventos, registrar falhas e suportar retry controlado. Concorrência precisa de transações e constraints adequadas no banco.

Ver [Segurança e Limites Financeiros](./14_SEGURANCA_E_LIMITES_FINANCEIROS.md).

## 16. Banco, migrations e idempotência

Alterações de banco usam migrations forward-only, versionadas e reproduzíveis. Não se usa `prisma migrate reset` em banco relevante, `db push` como substituto de migration ou `migrate resolve` sem auditoria do histórico.

Antes de reparar migrations, devem ser comparados o filesystem, `schema.prisma`, `_prisma_migrations` e o banco efetivamente utilizado.

Idempotência é obrigatória em cobrança Pix, webhook, Account Money, Ledger, baixa, WhatsApp, notificações e jobs.

Ver [Banco, Migrations, Concorrência e Idempotência](./15_BANCO_MIGRACOES_IDEMPOTENCIA.md).

## 17. Testes e critério de conclusão

Os gates mínimos incluem lint, typecheck, testes unitários e de integração, build, `prisma validate`, `prisma generate`, `prisma migrate status`, migrations reproduzidas em banco descartável, QA no navegador, console sem erros relevantes e `git diff --check`.

Testes de escrita devem usar `TEST_DATABASE_URL` ou banco descartável explicitamente separado. Testes não podem reimplementar a lógica de produção para provar apenas a cópia.

Mocks, build verde e respostas simuladas não comprovam Mercado Pago, Evolution, webhook, PWA ou qualquer integração externa. A conclusão precisa separar evidência local, sandbox oficial, integração real e bloqueios externos.

Ver [Testes e Critérios de Aceite](./16_TESTES_E_CRITERIOS_DE_ACEITE.md).

## 18. LLM e Gemini

LLM é uma camada opcional e auxiliar. Pode interpretar descrições, sugerir categorias, explicar variações e propor regras. Não decide valor, direção, ocorrência, saldo, pagamento, baixa ou autorização financeira.

Ver [LLM como Camada Inteligente Opcional](./18_LLM_CAMADA_INTELIGENTE_OPCIONAL.md).

## 19. Ordem de execução

1. Segurança, migrations e remoção de simulações.
2. Account Money, Ledger e cobertura financeira conhecida.
3. Cobrança Pix, status e conciliação.
4. Recorrências, categorias e Evolution.
5. Dashboard, mobile, PWA e notificações.
6. Preview, backup e deploy.

Cada marco termina com evidência, atualização do `ERROR_LOG` e declaração das limitações. Ver [Roadmap de Correção e Execução](./19_ROADMAP_DE_CORRECAO_E_EXECUCAO.md).

## 20. Deploy

O alvo futuro é `app.novexfinance.com.br`, com arquitetura compatível com Cloudflare Workers/OpenNext. Deploy exige testes, preview, migrations validadas, backup, rollback, segredos e autorização explícita do usuário.

Ver [Cloudflare e Deploy](./17_CLOUDFLARE_E_DEPLOY.md).

## 21. Como o agente deve executar correções

1. Ler decisões confirmadas e regras inegociáveis.
2. Ler o documento funcional da área.
3. Comparar documentação, código, banco e runtime.
4. Preservar alterações locais preexistentes.
5. Confirmar qual banco, processo e containers estão realmente ativos.
6. Não aceitar mensagens da interface, mocks ou build como prova operacional.
7. Revalidar os contratos oficiais dos provedores.
8. Registrar erros novos no `ERROR_LOG`.
9. Não inventar escopo ou regra de produto.
10. Usar migrations forward-only.
11. Testar código real, concorrência, idempotência e estados de erro.
12. Executar QA no navegador quando houver interface.
13. Provar Mercado Pago e Evolution com respostas reais quando a conclusão depender deles.
14. Separar fatos comprovados, limitações e validações externas pendentes.
15. Não fazer deploy sem autorização explícita.

## 22. Pontos da documentação atual que merecem comparação

- [Auditoria do Estado Atual](./20_AUDITORIA_ESTADO_ATUAL.md) declara como base o commit `512867412c22192a743eebd75e7b5bbc49f8b9f4`; por isso, pode não representar alterações posteriores do HEAD.
- [Fontes Oficiais](./23_FONTES_OFICIAIS.md) registra uma consulta realizada em 24/08/2026 e deve ser confrontado com a documentação oficial atual do Mercado Pago antes de mudanças sensíveis.
- [ERROR_LOG](./ERROR_LOG.md) contém histórico acumulado; estados antigos precisam ser reavaliados contra código, banco e runtime atuais antes de serem tratados como situação presente.
- O `ERROR_LOG` registra um incidente anterior de remoção do volume PostgreSQL local e substituição do `.env`. O estado corrente do banco e das credenciais deve ser verificado sem presumir recuperação.
- Mercado Pago, Evolution e PWA continuam dependendo de homologação externa quando isso estiver explicitamente indicado no `ERROR_LOG` e ainda não houver evidência operacional posterior.

## 23. Glossário

Os termos técnicos usados neste resumo seguem o [Glossário](./22_GLOSSARIO.md).
