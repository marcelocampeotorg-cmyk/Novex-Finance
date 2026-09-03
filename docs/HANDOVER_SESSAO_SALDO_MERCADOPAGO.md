# HANDOVER DE TRANSIÇÃO TÉCNICA — Sincronização de Saldo e Extrato do Mercado Pago

**Data:** 03/09/2026  
**Autor:** Antigravity  
**Destinatário:** Codex / Próximo Engenheiro  
**Status do Trabalho:** CONCLUÍDO E VALIDADO EM PRODUÇÃO  

---

## 1. Contexto e Solicitação do Usuário

O usuário reportou a seguinte divergência no dashboard:
> *"hoje já é outro dia ele disse que sincronizou, mas o saldo atual não é o da minha conta"*

- **Sintoma visual anterior:**
  - Botão superior direito: `"Última sincronização: 03/09/2026 🔄"` (check verde).
  - Card de Saldo Mercado Pago: `"R$ 134,71"`, com o subtítulo `"Atualizado por fontes oficiais até 02/09/2026, 12:04:41"`.
  - Workspace: `"Finanças pessoais"` (`workspaceId: 28bac964-1e8b-4adb-8f67-a2c00ee23fbe`), modo `HYBRID`.
  - O saldo real na conta do Mercado Pago era menor devido a 4 transferências Pix de saída (payouts) realizadas na tarde/noite do dia 02/09.

---

## 2. Diagnóstico das Causas Raízes

Acessamos a infraestrutura de produção via SSH no servidor local (`servidor@192.168.4.12`) e executamos diagnósticos diretos no banco de dados PostgreSQL e na API oficial do Mercado Pago:

1. **Bug da Âncora de Saldo Oficial (`Release Report`):**
   - **Arquivo:** `src/integrations/mercado-pago/release-reports-client.ts`, função `findExistingReport`.
   - **Causa:** Havia uma regra de tolerância de 24 horas:
     `coversEnd = itemEnd >= endMs || (endMs - itemEnd) <= 24 * 3600 * 1000;`
     Ao sincronizar o dia fechado de ontem (02/09 -> 03/09), essa tolerância considerou que o relatório do dia anterior (01/09 -> 02/09) "cobria" o período.
   - **Consequência:** `mercado-pago-balance-service.ts` tentava atualizar o `BalanceSyncRun` com as datas antigas. Como já existia um registro para essas datas, o Prisma lançava `Unique constraint failed on the fields: (integration_account_id, begin_date, end_date)`. O registro travava em `FAILED`, e a âncora oficial permanecia congelada em R$ 59,68 (de 01/09).
   - **Segundo erro:** O serviço tentava chamar `client.getTask(run.remoteTaskId)` mesmo quando `remoteFileName` já estava disponível. Como o ID retornado na listagem era um `reportId` e não um `taskId`, o Mercado Pago retornava `HTTP 403 - Internal Server Error`.

2. **Bug do Extrato Contínuo (`Settlement Report`):**
   - **Arquivo:** `src/integrations/mercado-pago/reports-client.ts`, função `findMatchingSettlementReport`.
   - **Causa:** A mesma tolerância de 24 horas (`(reqEndTime - repEndTime) <= 24 * 3600 * 1000`) considerava que o relatório gerado ontem às 08:16 (`novex-settlement-manual-2026-09-02-071658.csv`) cobria o momento atual.
   - **Consequência:** A cada ciclo de 1 hora, o sistema baixava novamente o arquivo de ontem (0 inseridos, 13 atualizados), carimbava `lastSyncAt` com a data de hoje e marcava `SUCCESS`. Por isso o botão dizia que sincronizou hoje, mas **nenhum débito ocorrido após as 12:04 de ontem era importado**.

---

## 3. Alterações Implementadas no Código

### 1. `src/integrations/mercado-pago/release-reports-client.ts`
- Corrigida a função `findExistingReport`: removida a tolerância de 24 horas. Um relatório existente só é reaproveitado se a cobertura for real:
  `itemBegin <= beginMs && itemEnd >= endMs`.

### 2. `src/integrations/mercado-pago/reports-client.ts`
- Corrigida a função `findMatchingSettlementReport`:
  - Removida a tolerância de 24 horas.
  - Adicionada trava de frescor (`isIncrementalLive`): relatórios com término no presente só podem ser reutilizados se criados há menos de 15 minutos. Caso contrário, um novo relatório é solicitado obrigatoriamente.

### 3. `src/server/services/mercado-pago-balance-service.ts`
- Protegidas as datas `beginDate` e `endDate` contra colisões de chave única do Prisma.
- Otimização do fluxo de download: se o arquivo já estiver pronto e com `remoteFileName` identificado, o download é feito diretamente, sem chamar desnecessariamente o endpoint de tarefas com ID incorreto.

### 4. `docs/ERROR_LOG.md`
- Registrado o caso `ERR-072` com diagnóstico, regras, commits e evidências.

---

## 4. Evidências de Validação e Estado Atual

### Testes Automatizados
- `pnpm typecheck`: 0 erros de compilação.
- `pnpm test`: 132 testes aprovados (129 pass, 3 skipped, 0 fail).

### Validação em Produção (`192.168.4.12`)
- **Deploy:** Container `novexfinance-prod-app-1` recompilado e saudável (`healthy`).
- **Âncora Oficial de Saldo (Release Report):**
  - Processado o arquivo `reserve-novex-release-manual-2026-09-03-102315.csv`.
  - Status em `financial_accounts`: `CONFIRMED`.
  - Âncora oficial em centavos: `7619` (**R$ 76,19**) na data de corte `2026-09-03T02:59:59.000Z` (23:59:59 BRT de 02/09).
- **Extrato Oficial (Settlement Report):**
  - Solicitado e processado o arquivo `novex-settlement-manual-2026-09-03-095119.csv` (Task `103037015`).
  - 6 novas transações importadas em `external_transactions` e `ledger_entries`:
    - `02/09 11:03:27`: Débito -R$ 22,00 (PAYOUTS)
    - `02/09 11:06:48`: Débito -R$ 22,00 (PAYOUTS)
    - `02/09 17:04:58`: Débito -R$ 12,52 (PAYOUTS)
    - `02/09 22:37:26`: Débito -R$ 2,00 (PAYOUTS)
    - `03/09 01:21:34`: Crédito +R$ 0,04 (SETTLEMENT)
    - `03/09 01:21:34`: Débito -R$ 0,01 (SETTLEMENT)
- **Saldo Consolidado no Dashboard:**
  - Âncora: R$ 76,19
  - Eventos posteriores contínuos (dia 03/09): `+0,04 - 0,01 = +0,03`
  - **Saldo Final no Card: R$ 76,22**
  - Subtítulo no card: `"Atualizado por fontes oficiais até 03/09/2026, 01:21:34"`

---

## 5. Instruções para o Codex / Próximo Agente

1. **Acesso SSH ao Servidor de Produção:**
   - Host: `servidor@192.168.4.12`
   - Diretório: `/home/servidor/Área de trabalho/Sistemas/novex finance/`
   - Rebuild/deploy: `bash scripts/build-and-restart-app.sh`
2. **Regras Inegociáveis (`AGENTS.md` e `02_REGRAS_INEGOCIAVEIS.md`):**
   - O NOVEX **NUNCA** executa saída de dinheiro (não faz Pix de saída, não paga boletos, não transfere, não estorna).
   - O saldo oficial requer evidência oficial (`Release Report` para âncora + `Settlement Report` para transações contínuas). Nunca inventar saldo nem usar mocks.
3. **Ambiente Limpo:**
   - Todos os scripts temporários de diagnóstico criados em `scripts/` durante a investigação foram removidos.
   - Apenas os arquivos do projeto e a documentação em `docs/` foram modificados e mantidos limpos.
