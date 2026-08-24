# 15 — Banco, Migrations, Concorrência e Idempotência

## Migration
Migration = histórico reproduzível de mudanças do banco.

Regras:
- `prisma migrate reset` não deve ser usado em banco com dados relevantes;
- `db push` não substitui migrations de produção;
- arquivos `migration.sql` precisam estar versionados;
- `.gitignore` não pode ignorar migrations oficiais;
- não reescrever migration já aplicada silenciosamente;
- comparar estado do filesystem, schema e `_prisma_migrations` antes de reparar histórico.

## Estado conhecido
No commit auditado `512867412c22192a743eebd75e7b5bbc49f8b9f4`, o GitHub tinha apenas `prisma/migrations/migration_lock.toml`, sem as migrations SQL que o histórico local aparentava ter usado. Há também `prisma/schema.prisma.new` duplicado. Isso é bloqueador de deploy até reconciliação segura.

## Idempotência
Idempotência = repetir o mesmo evento sem duplicar efeito.
Obrigatória para:
- cobrança Pix;
- webhook;
- importação de relatório;
- ledger;
- baixa de parcela;
- mensagem WhatsApp;
- notificações;
- jobs.

## Concorrência
Polling e webhook podem chegar juntos. A proteção precisa existir no banco/transação/constraint apropriada, não apenas por “ler antes de gravar”.

## Fonte
Cada movimentação deve ter fonte explícita:
- Mercado Pago/API/relatório;
- CSV importado;
- ajuste manual excepcional;
e não criar IntegrationAccount falso para representar CSV.
