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
