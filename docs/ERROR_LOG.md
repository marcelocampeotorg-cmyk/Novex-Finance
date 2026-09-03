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
Status: RESOLVIDO
Resumo: A Server Action `settleInstallment` recebia ID + valor arbitrário sem autenticação de workspace e gerava liquidação e ledger fictícios.
Correção: Função `settleInstallment` foi completamente removida.

### ERR-023 — LedgerEntry não é criado atomicamente na ingestão de ExternalTransaction
Status: RESOLVIDO
Resumo: `importExternalTransactions` não criava `LedgerEntry`, delegando a criação para a conciliação, o que violava o princípio do fato financeiro e gerava duplicidades.
Correção: `transactions-service.ts` cria `LedgerEntry` atomicamente dentro da transação Prisma na ingestão.

### ERR-024 — Saldo manual e dados fictícios de demonstração presentes na UI e em stores
Status: RESOLVIDO
Resumo: `configuracoes/page.tsx`, `financial-store.ts` e modais contavam com inputs, fallbacks ("82,73", R$100, e-mail fake) e estados simulados em memória.
Correção: Arquivos limpos de dados fictícios. `configuracoes/page.tsx` consome APIs reais.

### ERR-025 — False success em NewAccountModal ao falhar salvamento
Status: RESOLVIDO
Resumo: O bloco `catch` de `NewAccountModal` tratava falhas com `console.warn` e prosseguia para emitir mensagem de sucesso e fechar o modal.
Correção: Verificado no código atual que o `catch` exibe erro via `setFormErrorMessage` e impede a emissão de sucesso ou fechamento da modal.

### ERR-026 — PaymentIntention restrito ao schema sem integração com PaymentDialog
Status: RESOLVIDO
Resumo: `PaymentDialog` gerava QR Code no client-side sem consultar ou registrar `PaymentIntention` no backend server-side.
Correção: `PaymentDialog.tsx` já importa e chama `getOrCreatePaymentIntention` antes de gerar o QR Code.

### ERR-027 — Hardcode de ambiente SANDBOX em chamadas e integrações
Status: RESOLVIDO
Resumo: Diversos módulos e formulários fixavam `environment: "SANDBOX"` em vez de utilizar o resolver server-side da integração ativa.
Correção: Os labels da UI agora leem dinamicamente o campo `environment` vindo do servidor.

### ERR-028 — Evolution API Key exposta no frontend e com fallback embutido no código
Status: BLOQUEADO (Requer scan de QR Code com celular real na Evolution API)
Resumo: `getEvolutionApiStatus` e `client.ts` devolviam a chave criptografada/decriptografada para o navegador ou usavam fallback `"42960010999"`.

### ERR-029 — Assets da PWA ausentes e Service Worker com estratégia de cache insegura
Status: BLOQUEADO (Requer teste manual em navegador para validar PWA Installability)
Resumo: `manifest.json` e `sw.js` apontavam para `/brand/logo-novex-dark.svg` inexistente e o Service Worker aplicava cache-first na raiz.
Correção: Manifest usa PNGs reais 192/512, o RootLayout registra `/sw.js` e o service worker limita cache a assets públicos explícitos e exclui navegação/API. Installability em navegador real ainda não foi comprovada.
Teste de regressão: `tests/audit-hardening.test.js`.

### ERR-030 — Drift entre schema Prisma e migrations
Status: RESOLVIDO
Resumo: Campos e índices financeiros presentes no schema apresentavam divergências em relação a migrations antigas de ambiente local.
Correção: O schema foi alinhado via aplicação da cadeia canônica forward-only de 6 migrations (`20240101000000_init` até `20260825000005_recurrence_idempotency`). O ambiente de desenvolvimento teve seu histórico de migrations reinicializado a partir da cadeia oficial versionada no Git, reprovando e descontinuando qualquer manipulação manual direta na tabela `_prisma_migrations`.
Teste de regressão: `npx prisma migrate status` confirma alinhamento canônico em banco limpo.

### ERR-031 — Account Money continuava run arbitrário e aceitava fallbacks do provedor
Status: RESOLVIDO
Resumo: `syncRunId` era ignorado; status `processed`, tipo obrigatório, zero líquido e payload bruto não eram tratados corretamente.
Correção: `SyncRun` distingue task/report/file, acompanha exatamente `/task/{task-id}`, baixa somente `file_name`, usa search filtrado e parser fail-closed com zero legítimo distinto de campo ausente.
Teste de regressão: `tests/account-money-settlement.test.js`; em 2026-08-26 a task real `102939740` terminou em `SUCCESS`, com 54 inserções, 23 atualizações, zero rejeições e 54 fatos correspondentes no ledger.

### ERR-032 — Orders/webhook usavam status legado e criavam segundo ledger
Status: BLOQUEADO (Requer token de Sandbox/Produção real do Mercado Pago)
Resumo: `approved` era aceito e polling/webhook criavam ledger provisório duplicável pelo Account Money.
Correção: somente `processed/accredited`, com payment ID, referência, valor e data oficiais; Orders baixa planejamento sem criar fato no ledger.
Teste de regressão: `tests/pix-receivables.test.js`; falta sandbox oficial.

### ERR-033 — Evolution com segredo fixo, máscara sobrescrevível e teste financeiro falso
Status: EM VALIDAÇÃO (Requer scan de QR Code com celular real)
Resumo: API key hardcoded, máscara regravável e teste com cliente/valor/Pix fictícios.
Correção: configuração fail-closed, base URL validada, máscara rejeitada, campo vazio preserva segredo; cobrança pública recebe somente `pixChargeId`/estágio, recarrega os dados financeiros no servidor e usa chave de dedupe persistida. Teste manual permanece neutro.
Teste de regressão: `tests/audit-hardening.test.js`; a instância local real em Evolution v2.3.7 respondeu com QR base64 e código de pareamento em 2026-08-26. Falta somente o usuário escanear o QR no celular e comprovar estado `open`.

### ERR-034 — Store financeiro paralelo e tipos Mock no runtime
Status: RESOLVIDO
Resumo: `financial-store.ts` mantinha entidades em memória com IDs aleatórios e DTOs produtivos usavam nomes `*Mock`.
Correção: store reduzido a barramento de invalidação, exclusão usa Server Action/PostgreSQL e tipos renomeados para `*DTO`.
Teste: typecheck e build.

### ERR-035 — Segredos e banco Evolution na infraestrutura Docker
Status: VALIDADO LOCALMENTE / PENDENTE EM PRODUÇÃO
Resumo: compose continha senhas/chaves fixas e não criava `evolution_db`.
Correção: variáveis obrigatórias sem defaults secretos em código, placeholders seguros em `.env.example` e init SQL idempotente do banco Evolution no Compose.
Evidência: banco, Redis e Evolution v2.3.7 iniciados localmente, migrations da Evolution aplicadas e QR real emitido. Produção continua fora do escopo e sem autorização de deploy.

### ERR-036 — Descoberta de recorrências ausente
Status: RESOLVIDO
Resumo: somente regras manuais eram processadas; o histórico real não gerava sugestões determinísticas.
Correção: detecção mensal por descrição normalizada, intervalo, histórico e faixa de valor; gera apenas notificação auditável, nunca compromisso.
Teste de regressão: `tests/recurrence-discovery.test.js`.

### ERR-037 — Remoção inadvertida de volume PostgreSQL local via down -v e redefinição de .env
Status: RESOLVIDO
Base: Execução local em 2026-08-26
Resumo: Durante execução de testes de ambiente, o comando `docker-compose down -v` foi disparado, removendo o volume persistente local `novexfinance_novex_postgres_data` e redefinindo o arquivo `.env` para o padrão `.env.example`.
Impacto: O banco de dados local do container e as configurações locais de credenciais de integração foram reinicializados com valores placeholder. O impacto conhecido é limitado ao ambiente local de desenvolvimento (cuja documentação indicava ausência de dados operacionais relevantes após expurgo anterior em ERR-012, mas o conteúdo do volume removido não pode ser provado diretamente).
Correção: O container PostgreSQL foi recriado limpo e a cadeia canônica de 6 migrations (`20240101000000_init` até `20260825000005_recurrence_idempotency`) reconstruiu o schema do zero com sucesso. O `.env` permanece com placeholders e as credenciais reais do Mercado Pago e Evolution API aguardam reconfiguração manual antes de testes remotos em produção.
Evidência: `npx prisma migrate deploy` executado com sucesso e 69/69 testes integrados passando no ambiente limpo.

### ERR-038 — Configuração Account Money usava nomes de colunas não oficiais
Status: RESOLVIDO
Data: 2026-08-26
Severidade: CRÍTICA
Área: Mercado Pago / verdade financeira
Descrição: a configuração aceitava chaves como `RECORD_TYPE`, `NET_CREDIT_AMOUNT` e `SETTLEMENT_DATE_TIME`, mas o glossário oficial define `TRANSACTION_TYPE`, `SETTLEMENT_NET_AMOUNT`, `TRANSACTION_DATE` e `SETTLEMENT_DATE`. O arquivo resultante continha 77 identificadores, porém nenhum valor/data financeira utilizável.
Correção aplicada: configuração migrada por `PUT` para as colunas oficiais; o parser permanece fail-closed e a geração usa UTC sem milissegundos.
Teste de regressão: task real `102939740` importada com `SUCCESS`, 54 inserções, 23 atualizações e zero rejeições; `tests/account-money-settlement.test.js` cobre configuração, task, cabeçalho e datas.

### ERR-039 — Evolution v2.2.0 não emitia QR com o WhatsApp atual
Status: RESOLVIDO LOCALMENTE / PENDENTE DE PAREAMENTO
Data: 2026-08-26
Severidade: ALTA
Área: Evolution API / WhatsApp
Descrição: a instância permanecia em `close`/`connecting` e `/instance/connect` retornava somente `count`, sem QR. A imagem v2.2.0 usava uma versão antiga do motor Baileys.
Correção aplicada: backup recuperável do `evolution_db`, atualização controlada para a versão estável v2.3.7, migrations oficiais aplicadas e recriação da instância local sem sessão vinculada.
Evidência: `/instance/connect/novex-finance` passou a retornar `base64`, `pairingCode`, `code` e `count: 1`. O pareamento final depende do scan pelo usuário.
Observação: v2.3.7 é adequada ao uso exclusivamente local atual; antes de qualquer exposição pública, reavaliar o advisory vigente do Baileys e a versão segura disponível.

### ERR-040 — Worker local não tinha configuração explícita nem execução periódica no Compose
Status: CORRIGIDO NO CÓDIGO / CONFIGURAÇÃO LOCAL PENDENTE
Data: 2026-08-26
Severidade: ALTA
Área: Worker / operação local
Descrição: `WORKER_SECRET` não estava documentado no ambiente e não existia um processo Compose para retomar SyncRuns assíncronos.
Correção aplicada: `.env.example` documenta o segredo; `docker-compose.yml` adiciona sidecar periódico autenticado e healthcheck da aplicação.
Evidência: execução manual autenticada de `/api/worker/run` retomou a task real do Mercado Pago e concluiu o SyncRun em `SUCCESS`.
Pendência: definir um `WORKER_SECRET` forte no `.env` local antes de subir `app` e `worker` pelo Compose completo.

### ERR-041 — Dockerfile instalava pnpm incompatível e não isolava o contexto
Status: RESOLVIDO
Data: 2026-08-26
Severidade: ALTA
Área: Build / Docker
Descrição: `pnpm@latest` passou a exigir Node 22.13, enquanto a imagem usa Node 20, causando `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`. Sem `.dockerignore`, o build também enviava aproximadamente 523 MB de artefatos locais. Em seguida, a coleta de rotas falhava porque `AUTH_SECRET` é validado durante o build, antes da injeção das variáveis de runtime pelo Compose.
Correção aplicada: pnpm fixado em 10.15.1, instalação estritamente `--frozen-lockfile`, `.dockerignore` adicionado, OpenSSL instalado nos dois estágios para o engine Prisma correto e valores neutros limitados ao estágio de build para as duas variáveis exigidas na coleta de rotas. Os segredos reais continuam exclusivamente no runtime.
Teste de regressão: `docker compose build app`.

### ERR-042 — Fonte da Verdade anterior incompatível com os modos Manual e Híbrido aprovados
Status: RESOLVIDO
Data: 2026-08-27
Severidade: ALTA
Área: Produto / Ledger / Saldo
Descrição: A documentação anterior proibia saldo manual como arquitetura oficial, enquanto a decisão atual autoriza uma conta geral manual nos modos Manual e Híbrido. A ausência de separação formal poderia permitir que um valor manual mascarasse falha do Mercado Pago.
Correção aplicada: Documentação canônica atualizada para autorizar saldo inicial e lançamentos somente na conta manual, proibir sobrescrita do Mercado Pago, exigir reversão/substituição auditável e omitir total consolidado sem saldo oficial comprovado.
Teste de regressão: `tests/manual-hybrid-balance.test.js`; typecheck e build.

### ERR-043 — Sincronização limitada a 30 dias e movimentação líquida confundível com saldo
Status: CORRIGIDO NO CÓDIGO / VALIDAÇÃO REAL PENDENTE
Data: 2026-08-27
Severidade: CRÍTICA
Área: Mercado Pago / Dashboard
Descrição: `continueMercadoPagoSyncRun` inicia uma janela fixa de 30 dias e o dashboard soma `netAmountCents` do histórico importado. Esse resultado é fluxo líquido conhecido, não saldo atual, e não atende à carga do maior histórico disponível em blocos oficiais de até 60 dias.
Evidência: `src/server/services/transactions-service.ts` e `src/server/actions/workspace.ts`.
Impacto: Extrato incompleto e números que podem parecer saldo real sem coincidir com a conta.
Correção aplicada: Modos Manual/Híbrido, conta geral, semântica separada de saldo e fluxo, omissão do total sem âncora MP e backfill retomável em janelas de 60 dias até a data oficial da conta.
Teste de regressão: `tests/mercado-pago-sync-window.test.js`, `tests/manual-hybrid-balance.test.js` e `tests/account-money-settlement.test.js`.
Pendência: Docker/PostgreSQL indisponíveis impediram aplicar a migration e executar nova sincronização real nesta sessão.
Evidência posterior: Migration `20260827000006_manual_hybrid_accounts` aplicada em `BANCO` e `BANCO_TEST`; sincronização incremental real concluiu em `SUCCESS` com 2 inserções, 5 atualizações e zero rejeições. O provedor não retornou data oficial de criação da conta, portanto o backfill foi interrompido honestamente como `LIMIT_UNKNOWN` em vez de inventar o início da cobertura.

### ERR-044 — Ambiente local não inicia integralmente sem bootstrap de segredos
Status: RESOLVIDO LOCALMENTE
Data: 2026-08-27
Severidade: ALTA
Área: Docker / Worker / Evolution
Descrição: O Compose exige `WORKER_SECRET`, `CREDENTIALS_ENCRYPTION_KEY_BASE64`, `EVOLUTION_API_KEY` e demais valores, mas não existe bootstrap local idempotente para gerar/preservar a configuração. Sem worker, relatórios assíncronos podem não ser retomados; sem URL/instância Evolution coerentes, o QR não carrega.
Evidência: `docker compose ps` falhou antes de iniciar os serviços porque `WORKER_SECRET` estava ausente.
Correção aplicada: `scripts/bootstrap-local.ps1` gera apenas segredos ausentes/placeholders, preserva valores existentes e valida o Compose; scripts `local:bootstrap` e `local:start` adicionados. Diagnóstico Evolution diferencia serviço, autenticação, instância, pareamento e conexão.
Evidência posterior: bootstrap concluiu e `docker compose config --quiet` passou. O daemon Docker permaneceu inacessível e o serviço `com.docker.service` não pôde ser iniciado pelo agente.
Evidência final: Docker iniciado; `novexfinance-app` saudável em `localhost:3001`, banco e Redis saudáveis, worker ativo e Evolution v2.3.7 ativa com migrations concluídas. QR base64 e código de pareamento reais presentes. Pareamento `open` continua dependendo do scan pelo usuário.

### ERR-045 — Saldo oficial Mercado Pago ainda sem âncora real validada
Status: BLOQUEADO (Requer Docker/PostgreSQL e comparação com a conta Mercado Pago no mesmo corte)
Data: 2026-08-27
Severidade: CRÍTICA
Área: Mercado Pago / Saldo
Descrição: O relatório Dinheiro em Conta comprova fluxo, não saldo instantâneo. O relatório de Liberações é candidato a âncora, mas nenhum campo deve ser promovido a saldo oficial sem resposta real e comparação temporal com o aplicativo Mercado Pago.
Correção aplicada: Dashboard mantém `officialBalanceStatus=UNAVAILABLE/RECONCILING`, omite total consolidado no modo Híbrido e não converte movimentação líquida em saldo.
Teste de regressão: `tests/manual-hybrid-balance.test.js` comprova que o total Híbrido permanece nulo sem saldo oficial.

### ERR-046 — Service Worker redirecionado para login
Status: RESOLVIDO
Data: 2026-08-27
Severidade: MÉDIA
Área: PWA / Middleware
Descrição: O QA em navegador mostrou `SecurityError` porque `/sw.js` recebia redirect de autenticação, impedindo o registro da PWA.
Correção aplicada: `/sw.js` e `/manifest.json` foram explicitamente liberados no middleware e excluídos do matcher protegido.
Teste de regressão: Build, teste PWA existente e novo QA de console em navegador local.

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

### ERR-047 — Login local rejeitado por origem não confiável

Status: RESOLVIDO

- **Data:** 2026-08-28
- **Área:** autenticação local / Better Auth
- **Sintoma:** credenciais válidas eram aceitas em uma chamada direta sem cabeçalho `Origin`, mas o formulário no navegador exibia “Credenciais inválidas” e não criava a sessão.
- **Causa confirmada:** o Better Auth respondia `INVALID_ORIGIN` para `Origin: http://localhost:3001`. Além da ausência inicial de `trustedOrigins`, `NEXT_PUBLIC_APP_URL` era incorporada pelo build do Next.js como `http://localhost:3000`; portanto o processo no container ignorava, para esse trecho empacotado, o valor externo `http://localhost:3001` fornecido em runtime.
- **Correção:** a URL server-only passou a usar `BETTER_AUTH_URL`, fornecida em runtime pelo Compose, tanto em `baseURL` quanto em `trustedOrigins`. `NEXT_PUBLIC_APP_URL` permanece destinada ao cliente.
- **Evidência:** imagem reconstruída e container reiniciado; `POST /api/auth/sign-in/email` com `Origin: http://localhost:3001` retornou HTTP 200 e `Set-Cookie`; a requisição autenticada seguinte para `/` retornou HTTP 200 com conteúdo do dashboard.

### ERR-048 — Dependência residual de financeMode no backend
Status: RESOLVIDO
- **Data:** 2026-08-29
- **Área:** sincronização e leitura de movimentações / backend
- **Sintoma:** O backend ainda continha filtros `financeMode === "MANUAL" => source: "MANUAL_ADJUSTMENT"` e bloqueio de sincronização se `financeMode !== "HYBRID"`, ocultando movimentações Mercado Pago em workspaces legados.
- **Causa:** Remoção inicial focada na interface sem eliminação completa dos gates no serviço de backend.
- **Correção:** Eliminadas todas as travas condicionais de `financeMode` em `transactions-service.ts` e `workspace.ts`. A existência de integração ativa/conectada governa a leitura e sincronização.
- **Teste:** Testes comportamentais em `tests/forensic-finance-rules.test.js`.

### ERR-049 — Concorrência de SyncRun permitindo dois POSTs remotos simultâneos e risco de claim abandonado
Status: RESOLVIDO
- **Data:** 2026-08-29 / Atualizado em 2026-08-30
- **Área:** concorrência e idempotência de relatórios remotos
- **Sintoma:** Duas requisições simultâneas compartilhavam o mesmo SyncRun com `remoteTaskId: null` e ambas disparavam `requestSettlementReport` no Mercado Pago. Adicionalmente, se o processo sofresse crash durante o claim, o status ficava preso em `REQUESTING_REPORT` indefinidamente.
- **Causa:** Falta de trava atômica antes do disparo HTTP externo e falta de expiração de lease temporal no claim.
- **Correção:** Implementado claim atômico com lease de 2 minutos via `updateMany` condicional no PostgreSQL (`errorCode: "REQUESTING_REPORT"` com `startedAt < now - 2min` permitindo recuperação de worker morto). Implementada verificação prévia determinística na lista de relatórios do Mercado Pago antes de emitir qualquer novo POST (evita chamadas duplicadas em falhas de persistência após o POST).
- **Teste:** Testes comportamentais em `tests/forensic-finance-rules.test.js` cobrindo claim atômico, lease ativo e recuperação pós-expiração.

### ERR-050 — Forçar sincronização e cooldown ignorando momento real da falha e falta de backoff progressivo real
Status: RESOLVIDO
- **Data:** 2026-08-29 / Atualizado em 2026-08-30
- **Área:** proteção contra rate limits e cotas da API
- **Sintoma:** Cliques repetidos na UI (force=true) ou ticks do worker calculavam cooldown a partir do `createdAt` do run e não aumentavam o tempo de espera após falhas consecutivas, gerando dezenas de SyncRuns `FAILED` durante indisponibilidade do provedor.
- **Causa:** Cálculo temporal baseado em `createdAt`, ausência de rate limit central no `isForce` e intervalos fixos em vez de progressivos.
- **Correção:** Referência temporal ajustada para `finishedAt || updatedAt || createdAt`. Implementado backoff progressivo real com base no histórico de falhas consecutivas (15m -> 30m -> 60m para Max Reports/429; 5m -> 15m -> 30m para falhas gerais). Inserido rate limit central de 60 segundos mesmo com `isForce=true`.
- **Teste:** Testes em `tests/forensic-finance-rules.test.js`.

### ERR-051 — Inferência implícita de ambiente MP por prefixo de token e cast de NAO_DETECTADO
Status: RESOLVIDO
- **Data:** 2026-08-29
- **Área:** credenciais e tela de configurações
- **Sintoma:** `saveMercadoPagoCredentials` usava fallback `accessToken.startsWith("TEST-")` e a tela de configurações podia atribuir `"NAO_DETECTADO"` ao select de ambiente.
- **Causa:** Falta de validação estrita do enum de ambiente no backend e frontend.
- **Correção:** `saveCredentialsSchema` exige explicitamente `"PRODUCTION" | "SANDBOX"` sem fallback implícito e `configuracoes/page.tsx` somente atribui se o valor for estritamente um dos dois.
- **Teste:** Testes em `tests/forensic-finance-rules.test.js`.

### ERR-052 — Worker Daemon não iniciava nova sincronização quando activeSync era nulo
Status: RESOLVIDO
- **Data:** 2026-08-30
- **Área:** orquestração em background / Worker Daemon
- **Sintoma:** Após o término de um SyncRun (`activeSync === null`), os ticks subsequentes do worker não iniciavam uma nova sincronização automática, parando de puxar novas movimentações.
- **Causa:** Bloco de decisão de novo sync estava estruturado incorretamente dentro da cláusula `if (activeSync)` em vez de estar no ramo `else`.
- **Correção:** Estrutura corrigida com bifurcação estrita: `if (activeSync)` apenas retoma o run em andamento; `else` avalia a política de cadência e backoff progressivo e dispara novo ciclo quando elegível.
- **Teste:** Teste estrutural e comportamental em `tests/forensic-finance-rules.test.js`.

### ERR-053 — Transações históricas criadas por Payments API sem comprovação de liquidação contábil
Status: RESOLVIDO
- **Data:** 2026-08-30
- **Área:** conciliação contábil / auditoria forense
- **Sintoma:** 97 das 125 ExternalTransactions possuíam dados originados da antiga Payments API, podendo inflar ganhos e gastos do mês com eventos não liquidados.
- **Causa:** Histórico legado utilizava `/v1/payments/search` como fonte primária sem confrontar com os relatórios de liquidação.
- **Correção:** Auditoria forense confrontou todas as 97 transações com todos os 52 relatórios oficiais de liquidação existentes no Mercado Pago. 34 foram comprovadas com dados exatos e seus `rawProviderData` foram restaurados com o CSV do Settlement Report (movendo os dados de pagamento para `rawEnrichmentData`). As 63 transações restantes sem evidência contábil foram postas em quarentena auditável (`quarantinedAt: new Date()`, `quarantineReason: "UNCONFIRMED_PAYMENTS_API_IMPORT"`), expurgando R$ 1.146,95 de distorção não comprovada do mês de Agosto/2026.
- **Evidência:** Auditoria forense no banco e registro no `AuditLog` com id de lote `BATCH_97`.

### ERR-054 — Interface da Home exibindo CheckCircle verde em status PROCESSANDO e FALHA
Status: RESOLVIDO
- **Data:** 2026-08-30
- **Área:** UI / Dashboard / Feedback de Sincronização
- **Sintoma:** A Home exibia o ícone `CheckCircle2` verde com texto de última atualização mesmo quando o último run havia falhado (`FALHA`) ou estava em andamento (`PROCESSANDO`).
- **Causa:** As condições na Home apenas desviavam para alerta nos estados `DESCONECTADO` e `PENDENTE`.
- **Correção:** Mapeamento visual estrito: `PROCESSANDO` exibe spinner de carregamento e texto "Sincronização em andamento..."; `FALHA` exibe badge vermelho com `AlertTriangle` e mensagem de erro; `CheckCircle2` verde é renderizado exclusivamente no status `SINCRONIZADO`.
- **Teste:** Teste em `tests/forensic-finance-rules.test.js`.

### ERR-055 — Quarentena permanente após prova oficial, risco de POST duplicado em processing e mutação de startedAt
Status: RESOLVIDO
- **Data:** 2026-08-30
- **Área:** ingestão contábil / resiliência distribuída / integridade de auditoria
- **Sintoma:** (1) Transações quarentenadas com motivo `UNCONFIRMED_PAYMENTS_API_IMPORT` não eram reativadas automaticamente se um Settlement Report posterior as trouxesse; (2) A checagem prévia de relatórios antes de POST só buscava `status === "processed"`, ignorando relatórios em `processing` e podendo gerar duplicidade; (3) O lease do claim atômico atualizava `SyncRun.startedAt`, corrompendo a marcação histórica de início do run.
- **Causa:** Ausência de lógica de reativação condicional em `importExternalTransactions`, busca estrita por `processed` e uso indevido de `startedAt` como relógio de lease.
- **Correção:** (1) Implementada reativação automática restrita ao motivo `UNCONFIRMED_PAYMENTS_API_IMPORT` quando comprovado por Settlement Report oficial, restaurando dados oficiais, liberando `LedgerEntry` (`excludedFromReports: false`) e emitindo `AuditLog` (`TRANSACTION_REACTIVATED_FROM_SETTLEMENT`); (2) Checagem prévia expandida para todos os status e retorno fail-closed `PROCESSING` sem novo POST se já houver task em processamento; (3) Lease migrado para `updatedAt`, preservando `startedAt` original imutável.
- **Teste:** Testes em `tests/forensic-finance-rules.test.js` (itens 12.16, 12.17 e 12.18).

### ERR-056 — Colisão de SOURCE_ID colapsando eventos financeiros distintos e ausência de overlap para late-arriving
Status: RESOLVIDO
- **Data:** 2026-08-30
- **Área:** integridade contábil / parser CSV / idempotência
- **Sintoma:** (1) Diferença de 1 crédito e 1 débito entre CSV e Banco em Agosto/2026, com perda de débitos de retenção de impostos e sobrescrita mútua de liquidação e contestação (ex: disputa R$ 44,99 e rendimentos diários); (2) Janela incremental com overlap de apenas 1 dia arriscava perder movimentações liberadas pelo provedor com 48-72h de atraso (late-arriving transactions).
- **Causa:** Uso de `SOURCE_ID` simples como `externalId`, colapsando 24 pares de eventos financeiros distintos que compartilham o mesmo identificador de lote no Mercado Pago; janela incremental sem overlap seguro.
- **Correção:** (1) `reports-client.ts` atualizado para gerar chave contábil composta `${rawSourceId}_${typeStr}_${direction}_${absNetAmountCents}`, garantindo que fatos financeiros distintos sob o mesmo lote sejam 100% preservados no banco e no ledger, mantendo 100% de idempotência entre relatórios sobrepostos; (2) `importExternalTransactions` atualizado com migração retroativa de registros legados; (3) Janela incremental atualizada para sobreposição de 3 dias (`INCREMENTAL_OVERLAP_DAYS = 3`); (4) Fail-closed implementado para erros de rede na checagem prévia.
- **Evidência:** Reconciliação 1:1 exata em Agosto/2026: 51 CREDITs (R$ 2.722,43) e 26 DEBITs (R$ 305,13) em todas as 4 camadas (CSV, ExternalTransaction, LedgerEntry e Dashboard).
- **Teste:** Testes em `tests/forensic-finance-rules.test.js` (itens 12.19, 12.20 e 12.21) e `tests/mercado-pago-sync-window.test.js`.

### ERR-057 — Hardening financeiro: enriquecimento seguro, integridade de LedgerEntry, Pix Receivables e isolamento de testes
Status: RESOLVIDO
- **Data:** 2026-08-30
- **Área:** enriquecimento / integridade referencial / Pix Receivables / webhooks / testes
- **Sintoma:** (1) `enrichAllMercadoPagoTransactions` enviava a chave interna composta para `GET /v1/payments/{paymentId}`, quebrando o enriquecimento e tentando consultar transações de impostos/taxas; (2) `LedgerEntry.sourceId` continha divergências entre IDs de entidades e chaves de texto; (3) Cobrança Pix expirada não era carregada na contagem de tentativas (`failedAttempts`), podendo reutilizar idempotency key antiga; (4) Baixa atômica de Pix não barrava valor divergente e não emitia alerta em pagamento duplicado de dívida quitada; (5) Webhook só resolvia `data.id` via query string, falhando em payloads via body; (6) `TEST_DATABASE_URL` possuía fallback hardcoded inseguro em teste de concorrência.
- **Causa:** Acoplamento indevido entre identidade contábil interna e ID oficial de pagamento; consulta com filtro restritivo de status; ausência de validação de valor nominal na baixa atômica; dependência de query param no webhook; fallback hardcoded.
- **Correção:** (1) Enriquecimento corrigido para usar exclusivamente `rawProviderData.SOURCE_ID` numérico oficial e filtrar estritamente não-pagamentos (impostos, saques, taxas); (2) `LedgerEntry.sourceId` normalizado 100% para o `externalTransactionId` da entidade; (3) Status `EXPIRED` incluído na busca de cobranças Pix; (4) `settlePixChargeAtomic` atualizado para bloquear baixa e marcar `ACTION_REQUIRED` em valor divergente e emitir `MP_PIX_CHARGE_DUPLICATE_PAYMENT_ALERT` em parcela já quitada; (5) Webhook atualizado para extrair `dataId` de query ou body e compor `eventId` durável; (6) `TEST_DATABASE_URL` atualizado com skip fail-closed sem fallback para endereços fictícios.
- **Evidência:** 108 testes passando, fixtures sanitizadas em `tests/fixtures/settlement-fixtures.json` e reconciliação contábil 1:1 rigorosamente preservada.
- **Teste:** Suíte em `tests/pix-receivables-hardening.test.js` e `tests/concurrency-and-regressions.test.js`.
### ERR-058 — Fonte da Verdade voltou a contradizer os modos Manual e Híbrido
Status: RESOLVIDO
- **Data:** 2026-09-01
- **Área:** documentação / saldo / dashboard
- **Sintoma:** `docs/21_DECISOES_CONFIRMADAS.md` e `docs/24_RESUMO_CANONICO_OPERACIONAL.md` voltaram a afirmar que saldo manual não era arquitetura oficial, embora as regras, o schema e a decisão do usuário autorizem uma conta geral manual nos modos Manual e Híbrido. O cálculo consolidado também ignorava o saldo manual.
- **Correção documental:** modos Manual/Híbrido, separação de contas e regra de consolidação foram restaurados na documentação canônica e nas skills.
- **Validação:** cálculo e interface corrigidos; regressões de Manual/Híbrido passam. O usuário postergou ampliações do modo Manual para priorizar o Híbrido.

### ERR-059 — Saldo oficial Mercado Pago sem pipeline do Relatório de Liberações
Status: EM_HOMOLOGACAO
- **Data:** 2026-09-01
- **Área:** Mercado Pago / saldo atual
- **Sintoma:** o schema possui campos de saldo oficial, mas não existe cliente, worker e parser do Relatório de Liberações para preenchê-los com prova oficial. O dashboard permanece indefinidamente em reconciliação.
- **Correção documental:** o Relatório de Liberações foi definido como fonte obrigatória, com task assíncrona, CSV, fechamento aritmético e horário de corte.
- **Evidência atual:** task real `888929868` processada, arquivo oficial `64840669` baixado e `BALANCE_AMOUNT` de R$ 137,66 persistido no corte de 31/08/2026 23:59:59 BRT. Dinheiro em Conta coberto até 01/09/2026 00:38:46 BRT sem movimento posterior ao corte.
- **Validação pendente:** comparação visual do mesmo corte com o aplicativo Mercado Pago pelo usuário.

### ERR-060 — `total` do Relatório Liberações confundido com saldo e janela corrente normalizada para o futuro
Status: EM_HOMOLOGACAO
- **Data:** 2026-09-01
- **Área:** Mercado Pago / saldo / contrato oficial
- **Sintoma:** a primeira implementação tratava `total` como candidato a saldo e solicitava janela intradiária terminando no instante atual. A API real normalizou essa janela para dias civis completos, deixou o fim no futuro e manteve a task pendente. A configuração também recusou `execute_after_withdrawal` ausente/inválido e frequência diária.
- **Causa:** leitura incorreta de `total` e falta de validação real do comportamento de normalização do provedor. O glossário oficial define `total` como soma líquida de subtotais e `BALANCE_AMOUNT` como saldo restante após evento que altera o total.
- **Correção aplicada:** configuração com `execute_after_withdrawal=false` explícito e frequência mensal; job alterado para o último dia encerrado; task passa a prevalecer para `begin_date`/`end_date`; parser usa o `BALANCE_AMOUNT` cronologicamente mais recente e ignora `total` como saldo.
- **Evidência parcial:** chamada real aceita e tasks `888929829` (janela normalizada ainda aberta) e `888929868` (último dia encerrado) criadas em estado `pending`.
- **Evidência:** task do último dia encerrado processada; CSV real com 7 linhas validado; `BALANCE_AMOUNT` de R$ 137,66 persistido. Resta apenas comparação visual externa no mesmo corte.

### ERR-061 — Registros legados simples coexistiam com a nova chave composta e duplicavam o Ledger
Status: RESOLVIDO
- **Data:** 2026-09-01
- **Área:** Mercado Pago / extrato / idempotência
- **Sintoma:** três fatos oficiais já possuíam simultaneamente um registro legado com `externalId=SOURCE_ID` e outro canônico com chave composta, duplicando R$ 45,80 em créditos e R$ 0,01 em débitos nos relatórios internos.
- **Causa:** quando o registro composto já existia, a importação não verificava se o legado simples também permanecia ativo.
- **Correção:** os três legados foram colocados em quarentena auditável, seus LedgerEntries foram excluídos dos relatórios e os canônicos foram preservados. A ingestão agora detecta o par exato por SOURCE_ID, direção, valor líquido e timestamp, copia contraparte útil e quarentena o legado de forma idempotente.
- **Evidência:** correção local registrou `LEGACY_SETTLEMENT_DUPLICATE_QUARANTINED` para cada par; nenhum registro foi apagado.

### ERR-062 — Imagens falhavam no runtime standalone por ausência de `sharp`
Status: RESOLVIDO
- **Data:** 2026-09-01
- **Área:** runtime local / interface
- **Sintoma:** o container da aplicação registrou que `sharp` era obrigatório para otimização de imagens no modo standalone.
- **Causa:** a dependência não estava declarada no pacote de produção.
- **Correção:** `sharp` foi adicionado às dependências do projeto para integrar o binário compatível à imagem Docker.
- **Validação:** build local e imagem Docker concluídos; aplicação saudável e logs novos sem o erro de `sharp`.

### ERR-063 — Tentativa WhatsApp falha recebia `sentAt` por default
Status: RESOLVIDO
- **Data:** 2026-09-01
- **Área:** Evolution / auditoria de entrega
- **Sintoma:** `WhatsAppDeliveryLog.sentAt` era obrigatório e tinha default, então uma tentativa `SENDING` ou `FAILED` podia aparentar horário de envio concluído.
- **Correção:** `sentAt` passou a ser nulo até sucesso real; migração remove default/not-null e limpa o campo de registros não enviados. Retry mantém lease e horário de tentativa separados.
- **Validação:** Prisma validate/generate/status, cadeia de 10 migrations em banco descartável e suíte integrada aprovados em 02/09/2026.

### ERR-064 — Nomes técnicos de extrato (PAYOUTS/SETTLEMENT) exibidos ao usuário e sobrecarga visual no Dashboard
Status: RESOLVIDO
- **Data:** 2026-09-01
- **Área:** UI / Dashboard / Apresentação de Movimentações / Filtros
- **Sintoma:** (1) Transações com coluna `DESCRIPTION` vazia no CSV eram exibidas com rótulos técnicos crús como `PAYOUTS` e `SETTLEMENT`; (2) Dashboard continha cards redundantes de Saldo Manual e Saldo Total Comprovado; (3) Aba de Movimentações não possuía atalhos para Mês Anterior ou Últimos 30 dias.
- **Causa:** Parser usava `TRANSACTION_TYPE` técnico como fallback na ausência de descrição informada pelo provedor; dashboard acumulava múltiplos cards de saldo concebidos antes da decisão de priorizar o Mercado Pago; filtro de período só previa Mês Atual fixo.
- **Correção:** (1) Criado utilitário determinístico `formatTransactionDisplay` com descrições humanas somente quando amparadas pelos campos oficiais, mantendo fallback neutro e preservando os dados brutos contábeis no banco; (2) Dashboard simplificado com grid executivo de 4 cards em destaque para Saldo Oficial Mercado Pago, Entradas, Saídas e Resultado Líquido; (3) Suporte a `PREVIOUS_MONTH` e `LAST_30_DAYS` implementado no backend e nas opções da tela de movimentações.
- **Validação:** Testes unitários dedicados em `tests/transaction-presentation.test.js`, suíte de 122 testes (119 aprovados e 3 isolados sem `TEST_DATABASE_URL`; 122/122 no banco descartável), typecheck e lint verdes.

### ERR-065 — Apresentação humanizada inferia rendimento, imposto e Pix apenas pelo valor/tipo
Status: RESOLVIDO
- **Data:** 2026-09-02
- **Área:** UI / verdade financeira / apresentação de movimentações
- **Sintoma:** qualquer crédito `SETTLEMENT` abaixo de R$ 5,00 era rotulado como rendimento; qualquer débito de até R$ 0,50 era chamado de imposto; `PAYOUTS` era apresentado como Pix/saque mesmo sem prova do meio.
- **Causa:** heurísticas por valor e rótulo técnico foram tratadas como identificação oficial.
- **Impacto:** falsos positivos visíveis ao usuário, exatamente no fluxo que deve exibir dados reais e não inferidos.
- **Correção:** rendimento e imposto agora exigem texto explícito nos campos oficiais; `PAYOUT/PAYOUTS/WITHDRAWAL` recebe descrição neutra; contraparte ausente é exibida como “Não informado pelo provedor”.
- **Teste de regressão:** `tests/transaction-presentation.test.js` cobre evidência explícita e valores pequenos sem evidência.

### ERR-066 — Compose de produção não isolava nem completava a stack do Finance
Status: RESOLVIDO_NO_CODIGO_PENDENTE_DEPLOY
- **Data:** 2026-09-02
- **Área:** deploy / Docker / isolamento operacional
- **Sintoma:** `docker-compose.prod.yml` usava nomes genéricos (`web`, `postgres`, volumes `postgres_data`/`redis_data`), publicava a porta 3000, não incluía Evolution, não executava migrations e não definia worker/backup completos.
- **Impacto:** risco de colisão operacional, banco sem schema, jobs parados e acoplamento acidental a stacks vizinhas.
- **Correção:** stack `novexfinance-prod` criada com redes e volumes nomeados exclusivamente, banco/Redis internos, app e Evolution somente em loopback, migrator, worker, backup diário e logs rotacionados.
- **Validação pendente:** executar `docker compose config`, subida e prova de isolamento no servidor antes de alterar o status para `RESOLVIDO`.

### ERR-067 — Evolution em nível VERBOSE expunha chaves criptográficas de sessão nos logs
Status: RESOLVIDO_LOCALMENTE_PENDENTE_SERVIDOR
- **Data:** 2026-09-02
- **Área:** Evolution / segurança / logs
- **Sintoma:** logs locais da Evolution 2.3.7 incluíam `privKey`, `rootKey`, `remoteIdentityKey` e outros buffers internos da sessão Baileys.
- **Impacto:** material sensível da sessão WhatsApp ficava retido no driver de logs Docker e poderia vazar em coleta, suporte ou backup de logs.
- **Correção:** além de reduzir `LOG_LEVEL`, `LOG_BAILEYS`, persistência e telemetria, os Composes usam `logging.driver=none` exclusivamente na Evolution. Isso é necessário porque a própria v2.3.7 usa `console.log(messageRaw)` e `console.log('CACHE:', ...)`, fora do logger configurável. Saúde, autenticação, instância e conexão são diagnosticadas pelos endpoints autenticados.
- **Fonte:** documentação oficial de variáveis da Evolution Foundation e `.env.example` oficial da Evolution API.
- **Validação:** container local recriado, histórico anterior eliminado, leitura por `docker logs` indisponível por projeto e endpoint autenticado confirmou estado `open`. Repetir a prova no servidor.

### ERR-068 — Atualização diária escondia o último saldo confirmado e falha não podia ser retomada
Status: RESOLVIDO_LOCALMENTE_PENDENTE_SERVIDOR
- **Data:** 2026-09-02
- **Área:** Mercado Pago / saldo / worker
- **Sintoma:** ao iniciar a task do dia seguinte, `FinancialAccount.officialBalanceStatus` mudava imediatamente para `RECONCILING`, ocultando a última âncora comprovada. Se uma janela falhasse, a constraint única impedia criar uma nova tentativa para o mesmo período.
- **Impacto:** o usuário perdia a visualização do saldo válido durante uma atualização assíncrona e um erro transitório podia bloquear permanentemente o refresh daquele dia.
- **Correção:** atualização em andamento preserva a última âncora e seu corte; somente instalação sem âncora entra em reconciliação. Uma execução falha da mesma janela é reclamada de forma atômica, e o cliente consulta `/release_report/list` antes de qualquer novo POST para evitar relatório remoto duplicado.
- **Validação:** regressões aprovadas e task real da janela de 01/09/2026 concluída como `CONFIRMED`, publicando `BALANCE_AMOUNT` de R$ 59,68 no corte de 01/09/2026 23:59:59 BRT. A âncora anterior de R$ 137,66 permaneceu confirmada durante o processamento.

### ERR-069 — Exceção client-side ao renderizar contas sem parcelas pendentes e ausência de observabilidade no servidor
Status: RESOLVIDO
- **Data:** 2026-09-02
- **Área:** UI / Dashboard / Robustez Client-side / Observabilidade e Logs
- **Sintoma:** Ao autenticar na conta real do proprietário em `https://finance.novexbr.com.br`, o navegador exibia tela preta com `Application error: a client-side exception has occurred (see the browser console for more information)`.
- **Causa confirmada:**
  1. No Dashboard (`src/app/(protected)/page.tsx`), a listagem de contas a pagar mapeava `payables` e lia `item.installments[0].dueDate` diretamente. Quando a conta pertencia a um plano já liquidado (`installments: []`), `item.installments[0]` era `undefined`, disparando `TypeError: Cannot read properties of undefined (reading 'dueDate')`.
  2. Na sessão anterior, a compilação Docker disparada em background no servidor foi cancelada antes do término pelo encerramento da sessão; portanto, o servidor permaneceu rodando a imagem legada das 03:02:27 que continha o defeito.
  3. Ausência de Error Boundary (`error.tsx`/`global-error.tsx`) no Next.js App Router, resultando na tela preta sem telemetria para o servidor.
  4. Falta de utilitário centralizado de logs estruturados e persistência em arquivos para auditoria no host.
- **Correção aplicada:**
  1. Blindagem de formatadores em `src/lib/formatters.ts`: `formatDate`, `formatDateTime` e `formatCurrency` protegidos com `try/catch` contra nulos, indefinidos, `NaN` e strings inválidas.
  2. Blindagem de renderização em `src/app/(protected)/page.tsx` filtrando apenas itens com parcelas ativas e checagem defensiva de existência de `inst.dueDate`.
  3. Criação de Error Boundaries elegantes (`src/app/error.tsx` e `src/app/global-error.tsx`) no tema dark oficial do NOVEX Finance com botões de recuperação visual.
  4. Criação da rota `/api/logs/client` (liberada em `src/middleware.ts`) para ingestão segura de erros do navegador.
  5. Criação de `src/lib/logger.ts` com gravação simultânea em stdout e arquivos rotacionados persistentes (`logs/system.log`, `logs/error.log`, `logs/audit.log`) mapeados no volume `./logs:/app/logs` do Compose de produção.
  6. Criação do utilitário `scripts/view-logs.sh` no servidor para auditoria rápida e acompanhamento de logs via CLI.
  7. Imagem Docker `novexfinance-prod-app` recompilada com sucesso no servidor e container `novexfinance-prod-app-1` recriado e validado em loopback (`HTTP 200`).
- **Evidência:**
  - 124 testes unitários e de integração passando localmente (121 aprovados, 3 skipped por falta de `TEST_DATABASE_URL`).
  - Next.js build local e produção Docker com código de saída 0.
  - Teste de telemetria via loopback `curl -s -X POST http://127.0.0.1:3001/api/logs/client` retornou `{"received":true}` e gravou a entrada em `logs/error.log` no host do servidor.
  - Execução de `sh scripts/view-logs.sh errors` e `sh scripts/view-logs.sh system` no servidor validou o registro em arquivo.
  - `curl -sI https://finance.novexbr.com.br/login` respondeu `HTTP/1.1 200 OK`.
- **Commit:** bd86ead, 895b7ec

### ERR-070 — Falha no Sync por 'Max number of reports achieved' e bloqueio por cooldown estrito
Status: RESOLVIDO
- **Data:** 2026-09-02
- **Área:** Mercado Pago / Relatórios Assíncronos / Sincronização / Resiliência de Rate Limit
- **Sintoma:** Botão de sincronização no painel exibia `Falha no Sync: Max number of reports achieved` e o clique manual do usuário não conseguia forçar a sincronização.
- **Causa confirmada:**
  1. A API do Mercado Pago normaliza as datas de início e fim dos relatórios assíncronos (`settlement_report`) para marcos diários (ex: `03:00:00Z` e `02:59:59Z`).
  2. As rotinas de busca de relatórios existentes (`findExistingReport` e verificação prévia no `transactions-service`) exigiam igualdade estrita de strings ISO até os segundos (`repBeginIso === requestedBeginIso && repEndIso === requestedEndIso`). Como a janela calculada continha frações horárias (ex: `11:15:57Z`), o sistema considerava que nenhum relatório existia, mesmo com o arquivo `novex-settlement-manual-2026-09-02-071658.csv` (ID `103021711`) já processado e disponível no Mercado Pago.
  3. Com isso, o sistema emitia novos `POST /v1/account/settlement_report`, atingindo o limite de relatórios simultâneos da API (`Max number of reports achieved`).
  4. Além disso, o cooldown de 60 minutos bloqueava inclusive chamadas manuais com `isForce=true`.
- **Correção aplicada:**
  1. Implementada a função `findMatchingSettlementReport` com prioridade absoluta para match exato (preservando testes) e tolerância de dia civil / cobertura horária para arredondamentos do provedor.
  2. Implementada verificação prévia em `MercadoPagoReportsClient.requestSettlementReport` antes do `POST` para reaproveitar relatórios já prontos sem consumir quota da API.
  3. Atualizada a correspondência de relatórios em `ReleaseReportsClient.findExistingReport`.
  4. Ajustada a verificação de cooldown em `transactions-service`: chamadas com `isForce=true` (acionamento explícito pelo usuário no painel) bypassam o cooldown de erro e tentam reaproveitar relatórios existentes imediatamente.
- **Evidência:**
  - 124 testes unitários e de integração aprovados localmente (121 aprovados, 3 skipped).
  - Teste do endpoint do worker daemon via loopback autenticado retornou `{"success":true, "failedSyncRunsCount":0}`.
  - Imagem Docker compilada e container `novexfinance-prod-app-1` recriado com healthcheck `{"status":"ok"}`.
- **Commit:** 3d55e3b

### ERR-071 — Saldo desatualizado por ausência de captura intradiária de Pix e falso positivo de horário
Status: RESOLVIDO
- **Data:** 2026-09-02
- **Área:** Mercado Pago / Pagamentos Intradiários / Tempo Real / Observabilidade Temporal
- **Sintoma:** O painel exibia saldo de R$ 59,71 com o carimbo *"Atualizado por fontes oficiais até 02/09/2026, 12:14:14"*, quando o usuário havia recebido um Pix de R$ 75,00 às 12:04:41 (elevando a conta real para R$ 134,71).
- **Causa confirmada:**
  1. O sistema dependia exclusivamente do Relatório Dinheiro em Conta (lote assíncrono CSV). O último lote disponível havia sido gerado às 08:16:00 BRT e continha transações apenas até às 01:17:43 BRT.
  2. Como a API do Mercado Pago impôs cota restritiva (`HTTP 429 Max number of reports achieved`), o sistema não conseguia emitir novo lote para o mesmo dia e reutilizava o lote matinal.
  3. No cálculo do resumo do dashboard, `mercadoPagoOfficialBalanceAt` recebia a data/hora em que a sincronização executou (`12:14:14`), criando um falso positivo temporal de que os dados estavam apurados até aquele segundo.
- **Correção aplicada:**
  1. Implementada ingestão intradiária de pagamentos Pix via `/v1/payments/search` em `MercadoPagoPaymentsClient.searchRecentApprovedPayments` e `syncRecentMercadoPagoPayments`.
  2. O identificador composto `${payment.id}_SETTLEMENT_CREDIT_${amountCents}` garante 100% de idempotência, sendo herdado e conciliado perfeitamente quando o arquivo do relatório oficial for gerado posteriormente pelo provedor.
  3. O Worker Daemon de background passou a executar a checagem leve de pagamentos intradiários a cada ciclo, sem exigir cliques manuais do usuário.
  4. O cálculo de `mercadoPagoOfficialBalanceAt` foi corrigido para usar a data/hora real da última movimentação confirmada (`lastEntry.occurredAt`), eliminando projeções fictícias de horários futuros.
- **Evidência:**
  - Pagamento `176866825828` de R$ 75,00 (Itaú Unibanco -> Mercado Pago) importado com sucesso em `external_transactions` e `ledger_entries`.
  - Saldo oficial recalculado com precisão matemática em **R$ 134,71** (`59,68 + 0,03 + 75,00`).
  - Data/hora oficial fixada exatamente em `02/09/2026, 12:04:41` (momento exato do Pix recebido).
  - 121 testes unitários aprovados localmente e build Next.js com código 0.
  - Imagem Docker compilada e container `app` em produção saudável (`{"status":"ok"}`).
- **Commit:** b90080c

### ERR-073 — Regra genérica de fornecedor mistura produtos e recategoriza histórico sem escolha explícita
Status: CORRIGIDO LOCALMENTE, PENDENTE DE QA VISUAL E RUNTIME
- **Data:** 2026-09-03
- **Área:** Categorização / Aprendizado / Movimentações
- **Sintoma:** A regra sistêmica `google` classificava produtos distintos na mesma categoria, e o modal aplicava por padrão uma nova regra a todas as movimentações passadas e futuras.
- **Causa:** A categorização utilizava correspondência textual por substring sem identidade de produto e não oferecia escopo explícito para o aprendizado.
- **Correção aplicada:** Foi criada uma camada determinística e testável de normalização que distingue Google Ads, Google Cloud, Google Workspace, Google One, YouTube Premium e Meta Ads. Regras confirmadas pelo usuário têm precedência, regras de sistema genéricas ficam abaixo da identificação específica e a comparação de regras respeita termos completos. O modal agora permite aplicar somente ao lançamento, somente ao futuro ou ao histórico e futuro.
- **Evidência local:** testes unitários da classificação aprovados; typecheck aprovado. QA visual, build final e teste com banco descartável permanecem como critérios de fechamento.

### ERR-072 — Saldo e extrato congelados no dia anterior por tolerância indevida de 24h e colisão de chave única no Prisma
Status: RESOLVIDO
- **Data:** 2026-09-03
- **Área:** Mercado Pago / Relatórios Oficiais / Balance Anchor / Sincronização Incremental
- **Sintoma:** O painel exibia "Última sincronização: 03/09/2026", mas o saldo permanecia congelado em R$ 134,71 (atualizado até 02/09/2026, 12:04:41), enquanto a conta real do usuário possuía saldo inferior (R$ 76,22 após 4 payouts realizados no dia 02/09 e rendimentos do dia 03/09).
- **Causa confirmada:**
  1. Em `release-reports-client.ts` (`findExistingReport`) e `reports-client.ts` (`findMatchingSettlementReport`), a condição de correspondência aceitava relatórios encerrados no passado se `(endMs - itemEnd) <= 24h` ou `(reqEndTime - repEndTime) <= 24h`.
  2. Para o saldo oficial (Release Report), o sistema considerou que o relatório de 01/09 -> 02/09 cobria a janela de 02/09 -> 03/09. Quando `mercado-pago-balance-service.ts` tentou atualizar as datas do `BalanceSyncRun` para a janela do relatório matched, o Prisma disparou `Unique constraint failed on the fields: (integration_account_id, begin_date, end_date)`, travando o run em `FAILED` e mantendo a âncora em R$ 59,68.
  3. Além disso, `mercado-pago-balance-service.ts` tentava chamar `client.getTask(run.remoteTaskId)` mesmo quando `remoteFileName` já estava disponível. Como o ID retornado na listagem era um `reportId` e não um `taskId`, o Mercado Pago retornava `HTTP 403 - Internal Server Error`.
  4. Para o extrato (Settlement Report), a tolerância de 24h fez o sistema reutilizar continuamente o relatório matinal de ontem (`novex-settlement-manual-2026-09-02-071658.csv`). A cada hora, o worker baixava novamente os 13 eventos de ontem, reportava 0 inseridos e carimbava a sincronização como sucesso hoje, sem jamais solicitar novo relatório à API para capturar as saídas de ontem à tarde/noite e os eventos de hoje.
- **Correção aplicada:**
  1. Em `release-reports-client.ts`: removida tolerância de 24h. Um relatório só cobre se `itemBegin <= beginMs` e `itemEnd >= endMs`.
  2. Em `reports-client.ts`: removida tolerância de 24h e adicionada verificação de frescor (`isIncrementalLive`), impedindo a reutilização de relatórios gerados há mais de 15 minutos para janelas que chegam ao presente.
  3. Em `mercado-pago-balance-service.ts`: prevenidas colisões de chave única no Prisma e eliminado o polling redundante de `getTask` quando o arquivo já está disponível para download.
- **Evidência:**
  - 132 testes automatizados aprovados (0 falhas).
  - Release Report `reserve-novex-release-manual-2026-09-03-102315.csv` processado com sucesso: âncora oficial do saldo confirmada em **R$ 76,19** na data de corte `2026-09-03T02:59:59.000Z`.
  - Settlement Report `novex-settlement-manual-2026-09-03-095119.csv` gerado e baixado com sucesso: 6 novas transações inseridas (4 payouts de 02/09 e 2 movimentações de liquidação de 03/09).
  - Saldo final apurado e comprovado no dashboard: **R$ 76,22** (`76,19 + 0,04 - 0,01`).
  - Container de produção `novexfinance-prod-app-1` recompilado e saudável.

### ERR-074 — Extrato oficial continha favorecido, mas PAYOUT permanecia sem identificação no NOVEX
Status: CORRIGIDO_LOCALMENTE_PENDENTE_DEPLOY
- **Data:** 2026-09-03
- **Área:** Mercado Pago / identificação de contrapartes / Movimentações
- **Sintoma:** operações `PAYOUT` já comprovadas no Relatório Dinheiro em Conta eram mostradas apenas como “Transferência ou retirada registrada”, enquanto o Extrato de conta oficial do Mercado Pago exibia favorecido e operação.
- **Causa:** o relatório financeiro não fornece contraparte nesses `PAYOUT`; o importador CSV genérico criaria fatos financeiros novos, portanto não podia receber o Extrato de conta sem risco de duplicidade.
- **Correção:** importar o CSV do Extrato de conta somente como enriquecimento auditável, com vínculo estrito por `REFERENCE_ID`/`SOURCE_ID`, data, direção e valor; sem criar ledger, saldo ou conciliação. A apresentação passa a mostrar o favorecido e “Pagamento com Pix” quando o próprio extrato confirmar ambos.
- **Validação local:** CSV oficial de agosto processado com 96 registros válidos, 0 rejeitados e 53 contrapartes nominais; testes focados, typecheck e build aprovados. Ainda requer deploy autorizado e upload pelo painel para atualizar dados produtivos.
