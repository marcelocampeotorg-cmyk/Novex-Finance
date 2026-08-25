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
Correção: O resolver completo foi movido para serviço `server-only`; a Server Action pública não aceita `workspaceId`, autentica a sessão e retorna somente DTO sanitizado, sem `encryptedCredentials`.

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

### ERR-015 — Presença de scripts destrutivos de limpeza versionados no repositório
Status: RESOLVIDO
Resumo: Scripts temporários contendo `deleteMany({})` foram versionados em `scratch/`.
Correção: Removida a pasta `scratch/` e todos os utilitários temporários destrutivos do repositório.

### ERR-016 — Endpoint /list incompatível com a especificação oficial /settlement_report/search
Status: RESOLVIDO
Resumo: A busca de relatórios utilizava `/settlement_report/list` em vez do endpoint oficial `/settlement_report/search`.
Correção: Atualizado `MercadoPagoReportsClient.searchSettlementReports()` para consumir a rota oficial `/v1/account/settlement_report/search`.

### ERR-017 — Download dependente de downloadUrl arbitrária em vez do contrato oficial
Status: RESOLVIDO
Resumo: O download dependia exclusivamente da propriedade `downloadUrl`.
Correção: Implementado `downloadSettlementReport(fileName)` efetuando chamada `GET /v1/account/settlement_report/{file_name}` com token Bearer.

### ERR-018 — Parser CSV frágil a aspas e sem tratamento de diagnósticos
Status: RESOLVIDO
Resumo: O parser CSV utilizava `split` simples e convertia erros monetários silenciosamente para zero.
Correção: Implementado parser RFC 4180 robusto com tratamento de aspas, delimitadores, BOM e relatório de linhas rejeitadas com status `PARTIAL`.

### ERR-019 — Exceções de consulta convertidas silenciosamente em listas vazias
Status: RESOLVIDO
Resumo: `searchSettlementReports()` retornava `[]` em falhas HTTP ou exceções de rede.
Correção: Atualizado o método para propagar exceções HTTP/rede, distinguindo relatórios inexistentes de erros de comunicação.

### ERR-020 — Seleção de conta ativa dependente de ordenação por lastValidatedAt
Status: RESOLVIDO
Resumo: `getActiveMercadoPagoIntegration()` usava `orderBy: { lastValidatedAt: "desc" }` para definir a conta ativa.
Correção: O resolver interno único exige exatamente uma conta ativa e a migration `20260824000004_remaining_blockers` adiciona índice único parcial por workspace/provedor.

### ERR-021 — Relatório de implementação incompatível com o commit real 7a9cd92
Status: EM_CORRECAO  
Base: commit 7a9cd92  
Resumo: O relatório da execução anterior afirmou ter corrigido diversos arquivos que na verdade não constavam no commit Git.  
Evidência: `git diff c14ed7e..7a9cd92 --name-only` continha apenas 14 arquivos, enquanto o relatório alegou correções em mais de 25 arquivos.

### ERR-022 — settleInstallment ainda presente e desprotegido em financial-items.ts
Status: EM_CORRECAO  
Resumo: A Server Action `settleInstallment` recebia ID + valor arbitrário sem autenticação de workspace e gerava liquidação e ledger fictícios.

### ERR-023 — LedgerEntry não é criado atomicamente na ingestão de ExternalTransaction
Status: EM_CORRECAO  
Resumo: `importExternalTransactions` não criava `LedgerEntry`, delegando a criação para a conciliação, o que violava o princípio do fato financeiro e gerava duplicidades.

### ERR-024 — Saldo manual e dados fictícios de demonstração presentes na UI e em stores
Status: EM_CORRECAO  
Resumo: `configuracoes/page.tsx`, `financial-store.ts` e modais contavam com inputs, fallbacks ("82,73", R$100, e-mail fake) e estados simulados em memória.

### ERR-025 — False success em NewAccountModal ao falhar salvamento
Status: EM_CORRECAO  
Resumo: O bloco `catch` de `NewAccountModal` tratava falhas com `console.warn` e prosseguia para emitir mensagem de sucesso e fechar o modal.

### ERR-026 — PaymentIntention restrito ao schema sem integração com PaymentDialog
Status: EM_CORRECAO  
Resumo: `PaymentDialog` gerava QR Code no client-side sem consultar ou registrar `PaymentIntention` no backend server-side.

### ERR-027 — Hardcode de ambiente SANDBOX em chamadas e integrações
Status: EM_CORRECAO  
Resumo: Diversos módulos e formulários fixavam `environment: "SANDBOX"` em vez de utilizar o resolver server-side da integração ativa.

### ERR-028 — Evolution API Key exposta no frontend e com fallback embutido no código
Status: IMPLEMENTADO — AGUARDA VALIDAÇÃO EXTERNA
Resumo: `getEvolutionApiStatus` e `client.ts` devolviam a chave criptografada/decriptografada para o navegador ou usavam fallback `"42960010999"`.

### ERR-029 — Assets da PWA ausentes e Service Worker com estratégia de cache insegura
Status: IMPLEMENTADO — AGUARDA VALIDAÇÃO EXTERNA
Resumo: `manifest.json` e `sw.js` apontavam para `/brand/logo-novex-dark.svg` inexistente e o Service Worker aplicava cache-first na raiz.
Correção: Manifest usa PNGs reais 192/512, o RootLayout registra `/sw.js` e o service worker limita cache a assets públicos explícitos e exclui navegação/API. Installability em navegador real ainda não foi comprovada.
Teste de regressão: `tests/audit-hardening.test.js`.

### ERR-030 — Drift entre schema Prisma e migrations
Status: EM_CORRECAO
Resumo: Campos e índices financeiros presentes no schema não existiam na migration de domínio.
Correção: migration forward-only `20260824000003_audit_hardening`, sem editar migrations anteriores.
Teste de regressão: `tests/audit-hardening.test.js`; `prisma migrate status` confirmou drift histórico local: `20260824_hardening_phase2`, `20260824000002_hardening_fix` e `20260824000003_hardening_final` constam no banco mas não no checkout. Nenhum reset/resolve foi executado; fresh DB permanece não comprovado.

### ERR-031 — Account Money continuava run arbitrário e aceitava fallbacks do provedor
Status: IMPLEMENTADO — AGUARDA VALIDAÇÃO EXTERNA
Resumo: `syncRunId` era ignorado; status `processed`, tipo obrigatório, zero líquido e payload bruto não eram tratados corretamente.
Correção: `SyncRun` distingue task/report/file, acompanha exatamente `/task/{task-id}`, baixa somente `file_name`, usa search filtrado e parser fail-closed com zero legítimo distinto de campo ausente.
Teste de regressão: `tests/account-money-settlement.test.js`; falta credencial real Mercado Pago.

### ERR-032 — Orders/webhook usavam status legado e criavam segundo ledger
Status: IMPLEMENTADO — AGUARDA VALIDAÇÃO EXTERNA
Resumo: `approved` era aceito e polling/webhook criavam ledger provisório duplicável pelo Account Money.
Correção: somente `processed/accredited`, com payment ID, referência, valor e data oficiais; Orders baixa planejamento sem criar fato no ledger.
Teste de regressão: `tests/pix-receivables.test.js`; falta sandbox oficial.

### ERR-033 — Evolution com segredo fixo, máscara sobrescrevível e teste financeiro falso
Status: IMPLEMENTADO — AGUARDA VALIDAÇÃO EXTERNA
Resumo: API key hardcoded, máscara regravável e teste com cliente/valor/Pix fictícios.
Correção: configuração fail-closed, base URL validada, máscara rejeitada, campo vazio preserva segredo; cobrança pública recebe somente `pixChargeId`/estágio, recarrega os dados financeiros no servidor e usa chave de dedupe persistida. Teste manual permanece neutro.
Teste de regressão: `tests/audit-hardening.test.js`; falta instância Evolution real.

### ERR-034 — Store financeiro paralelo e tipos Mock no runtime
Status: RESOLVIDO
Resumo: `financial-store.ts` mantinha entidades em memória com IDs aleatórios e DTOs produtivos usavam nomes `*Mock`.
Correção: store reduzido a barramento de invalidação, exclusão usa Server Action/PostgreSQL e tipos renomeados para `*DTO`.
Teste: typecheck e build.

### ERR-035 — Segredos e banco Evolution na infraestrutura Docker
Status: IMPLEMENTADO — AGUARDA VALIDAÇÃO EXTERNA
Resumo: compose continha senhas/chaves fixas e não criava `evolution_db`.
Correção: variáveis obrigatórias sem defaults secretos, placeholders em `.env.example` e init SQL idempotente do banco Evolution.
Evidência pendente: daemon Docker indisponível nesta execução.

### ERR-036 — Descoberta de recorrências ausente
Status: RESOLVIDO
Resumo: somente regras manuais eram processadas; o histórico real não gerava sugestões determinísticas.
Correção: detecção mensal por descrição normalizada, intervalo, histórico e faixa de valor; gera apenas notificação auditável, nunca compromisso.
Teste de regressão: `tests/recurrence-discovery.test.js`.

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
