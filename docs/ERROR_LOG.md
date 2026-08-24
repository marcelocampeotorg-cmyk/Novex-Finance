# ERROR LOG — Registro Vivo de Erros e Riscos

Este arquivo deve ser atualizado pela skill `SKILL_02_REGISTRO_DE_ERROS.md`.

## Regras
- não apagar histórico resolvido;
- usar status `ABERTO`, `EM_CORRECAO`, `RESOLVIDO`, `NAO_REPRODUZIDO`, `ADIADO`;
- citar arquivo/rota/migration/commit;
- registrar evidência;
- diferenciar defeito real de hipótese.

## Erros conhecidos iniciais

### ERR-001 — Migrations não reproduzíveis
Status: RESOLVIDO  
Base: commit 5128674  
Resumo: GitHub continha somente migration_lock, apesar de histórico local aparentar migrations aplicadas.  
Correção: Adicionada a regra `!prisma/migrations/**/*.sql` no `.gitignore`, versionando todas as migrations SQL no Git. Validadas 4 migrations ativas com `prisma migrate status`.

### ERR-002 — Refund fora do escopo
Status: RESOLVIDO  
Resumo: fluxo de “Devolver Pix” contradizia a regra inegociável de não movimentar saída de dinheiro.  
Correção: Removida a ação `refundPixCharge`, neutralizado o cliente de refund para retornar erro explícito `REGRA_DE_SEGURANCA_ABS` e removidos botões/modais de estorno da interface.

### ERR-007 — Exposição de credenciais em Server Action getActiveMercadoPagoIntegration
Status: RESOLVIDO  
Resumo: `getActiveMercadoPagoIntegration` retornava `IntegrationAccount` do Prisma completa (com segredos) e aceitava workspaceId sem validação de sessão.  
Correção: Adicionada validação de contexto com `requireAuthenticatedWorkspace` e retorno sanitizado utilizando o DTO `IntegrationAccountDTO`.

### ERR-008 — Duplicidade da Fonte da Verdade e localização de Skills
Status: RESOLVIDO  
Resumo: As novas skills e documentos permaneciam em uma subpasta duplicada (`NOVEX_FINANCE_FONTE_DA_VERDADE_2026-08-24`), violando a regra de Fonte da Verdade única na raiz.  
Correção: A estrutura de `docs/` (25 arquivos), `templates/` e `assets/` foi mantida na raiz e a coleção única de skills (18 arquivos em `.agents/skills/`) foi instalada exclusivamente no diretório de customização de agentes do Antigravity (`.agents/skills/`).

### ERR-003 — Simulação de pagamento em conta a pagar
Status: RESOLVIDO  
Resumo: PaymentDialog simulava reconhecimento de pagamento por timeout.  
Correção: Removida a simulação visual e substituída pela mensagem informativa de intenção de pagamento, aguardando conciliação bancária externa real.

### ERR-004 — Account Money ainda não implementado corretamente
Status: RESOLVIDO  
Resumo: payments/search usado como extrato.  
Correção: Implementados os métodos oficiais `requestSettlementReport` (`POST /v1/account/settlement_report`) e `listSettlementReports` (`GET /v1/account/settlement_report/list`) no cliente de relatórios do Mercado Pago (`reports-client.ts`).

### ERR-005 — Saldo/manual e source separation
Status: RESOLVIDO  
Resumo: fluxos de saldo manual, CSV e provider/source apresentavam inconsistências.  
Correção: Corrigida a Server Action `setManualInitialBalance` para utilizar `provider: "MERCADO_PAGO"` e `source: "MANUAL_ADJUSTMENT"`, garantindo a separação limpa de enums no Prisma.

### ERR-006 — Mocks de runtime
Status: RESOLVIDO  
Resumo: attachments/lixeira/export/Pix demonstrativo precisavam ser removidos ou desativados de forma honesta.  
Correção: Implementada exportação CSV real com sanitização contra injeção em `export.ts`, lixeira real integrada com `deletedAt` no Prisma em `trash.ts`, desativação segura de presigned URLs em `attachments.ts` e remoção completa de botões de simulação em `PaymentDialog.tsx`.

### ERR-012 — Registros de teste/demo e parcelas fictícias no banco local
Status: RESOLVIDO
Resumo: O banco local continha 150 movimentações originadas de `/v1/payments/search`, 4 itens recuperados e 5 SyncRuns fictícios gerando saldo artificial de R$ 5.333,73.
Correção: Executada auditoria read-only completa e purga segura dos registros de teste/fixtures, deixando o banco limpo com saldo R$ 0,00 e lastSyncAt nulo.

### ERR-013 — Status "Sincronizado" e data de sincronização fictícia sem importação real
Status: RESOLVIDO
Resumo: A UI exibia "Sincronizado" e inicializava `lastSyncAt` com a data atual mesmo quando a sincronização real não havia ocorrido.
Correção: Atualizado `getWorkspaceSummary` e componentes visuais para manter `lastSyncAt: null` e exibir "Não Sincronizado" / "Pendente" até que uma sincronização real ocorra.

### ERR-014 — Fallbacks artificiais (Date.now() / new Date()) no parser de liquidação
Status: RESOLVIDO
Resumo: O parser de liquidação fabricava IDs e datas artificiais em caso de omissão no CSV.
Correção: Removidos fallbacks artificiais do parser; linhas sem identificador ou data oficiais válidos são rejeitadas deterministicamente.

---

## Template
ID:  
Data:  
Status:  
Severidade:  
Área:  
Descoberto por:  
Descrição:  
Evidência:  
Impacto:  
Hipótese de causa:  
Correção aplicada:  
Teste de regressão:  
Commit:  
Observações:
