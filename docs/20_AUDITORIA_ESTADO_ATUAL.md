# 20 — Auditoria do Estado Atual Conhecido

**Base auditada:** commit `512867412c22192a743eebd75e7b5bbc49f8b9f4` da branch `feat/mercado-pago-pix-receivables`.

Este documento é um mapa de riscos conhecidos, não substitui nova auditoria local.

## Correções válidas já observadas
- rotas protegidas movidas para grupo protegido;
- Better Auth usado na troca de senha;
- seed mais seguro;
- source enum e SyncRun iniciados;
- parte da UI deixou de usar usuário/workspace fictícios.

## Bloqueadores/riscos

### Migrations
GitHub continha apenas `migration_lock.toml`; migrations SQL não estavam versionadas. `.gitignore` tinha regra global de SQL no estado auditado. `schema.prisma.new` duplicado estava commitado. Reconciliar sem reset destrutivo.

### Server actions/credenciais
Há funções exportadas em módulos `use server` que podem retornar IntegrationAccount completo ou aceitar IDs sem isolamento suficiente. Sanitizar DTO e validar contexto autenticado.

### Integração ativa
Resolver “primeira conta conectada” não é regra segura. Ambiente ativo deve ser explícito/determinístico.

### Sandbox x Production
Fluxos de status/validação/UI ainda tinham Sandbox hardcoded em partes do projeto.

### Account Money
`reports-client.ts` ainda usava `/v1/payments/search` como se fosse extrato. Isso não atende ao desenho final. Implementar pipeline oficial de Dinheiro em Conta.

### CSV/manual
CSV criava/consultava IntegrationAccount incoerente e source podia cair como Mercado Pago API. Corrigir separação.

### Saldo manual
Havia fluxo de “saldo inicial manual” e até cast inválido de provider. Remover como mecanismo normal.

> **Decisão posterior de 2026-08-27:** este achado permanece válido para o mecanismo antigo, que tentava fazer a conta Mercado Pago “bater”. A Fonte da Verdade atual autoriza uma conta geral manual independente, com saldo inicial datado, ledger auditável e sem sobrescrita da conta integrada.

### Refund
Foi introduzida função “Devolver Pix”, inclusive com simulação de sucesso no Sandbox. Isso contradiz a fonte de verdade. Remover do escopo ativo.

### Cobrança Pix
Auditar Orders API atual, QR fields, status/status_detail, email real do pagador, ambiente e idempotência.

### Conta a pagar
`PaymentDialog` continha “Simular Pagamento Efetuado” e alterava estado visual por timeout. Remover. Gerar QR real e aguardar movimento real.

### Mocks
Ainda existiam mock attachment, lixeira hardcoded, export por alert e modal Pix demonstrativo. Nenhum mock deve persistir no runtime de produção.

### Dashboard
Erros eram convertidos em zeros/listas vazias em alguns fluxos. Não confundir ausência de dado com falha.

### Testes
Build verde não cobria todas as falhas de runtime. Ampliar suíte de produção real.

## Diretriz
Preservar o que está correto. Corrigir seletivamente o que contradiz esta documentação; não recriar o projeto do zero.

## Atualização operacional — 2026-09-01

- prioridade atual confirmada: modo Híbrido e dados reais do Mercado Pago; ampliações do Manual foram postergadas;
- Relatório Dinheiro em Conta está operacional com cobertura de 27/07/2026 até 01/09/2026 00:38:46 BRT e retomada pelo worker;
- três duplicatas legadas exatas foram colocadas em quarentena, removendo falsos impactos de R$ 45,80 em créditos e R$ 0,01 em débitos;
- Relatório Liberações real foi configurado, gerado, processado e baixado; task `888929868`, relatório `64840669`;
- âncora `BALANCE_AMOUNT`: R$ 137,66 no corte de 31/08/2026 23:59:59 BRT;
- nenhuma movimentação do Dinheiro em Conta foi registrada depois desse corte até 01/09/2026 00:38:46 BRT, portanto o saldo operacional nesse horário permanece R$ 137,66;
- Evolution local responde `open`; a regra atual usa apenas canal `DASHBOARD` e não existem cobranças Pix elegíveis, logo nenhum envio automático foi realizado;
- 120 testes executados, 117 aprovados e 3 pulados por ausência intencional de `TEST_DATABASE_URL`; lint, typecheck, build, Prisma validate/migrate status e runtime local passaram;
- Dashboard simplificado com foco exclusivo no Saldo Mercado Pago Oficial (corte R$ 137,66), Entradas, Saídas e Resultado Líquido;
- Camada de apresentação humana de transações (`formatTransactionDisplay`) aplicada no Dashboard e na aba Movimentações, eliminando rótulos técnicos crús (PAYOUTS/SETTLEMENT);
- Aba de Movimentações enriquecida com suporte a Mês Anterior (`PREVIOUS_MONTH`) e Últimos 30 dias (`LAST_30_DAYS`);
- pendência externa: comparar a âncora de R$ 137,66 com o aplicativo Mercado Pago no mesmo corte e executar um envio controlado quando houver destinatário/cobrança autorizados.

## Atualização operacional — 2026-09-02

- nova task real do Relatório Liberações concluída e âncora oficial atualizada para **R$ 59,68**, no corte de 01/09/2026 23:59:59 BRT;
- 101 movimentações oficiais ativas cobrem de 27/07/2026 01:47:53 BRT a 01/09/2026 10:36:59 BRT; nenhum valor líquido do período é chamado de saldo;
- Evolution local reconectada com estado autenticado `open`; a imagem oficial v2.3.7 possui `console.log` direto de payloads, por isso o container usa driver de log `none` e o diagnóstico ocorre por health/endpoints autenticados;
- suíte local: 122 testes, 119 aprovados e 3 isolados por ausência intencional de `TEST_DATABASE_URL`; em PostgreSQL descartável, 122/122 aprovados e as 10 migrations aplicaram sem erro;
- lint, typecheck, build de produção, Prisma validate/generate/status, Compose de produção e `git diff --check` aprovados;
- banco principal e banco da Evolution tiveram dumps restaurados com sucesso em PostgreSQL descartável antes do corte para o servidor;
- o deploy deve criar somente o projeto Docker `novexfinance-prod`, redes/volumes exclusivos e binds de app/Evolution no loopback, sem alterar qualquer recurso de Master ou Oficina.
