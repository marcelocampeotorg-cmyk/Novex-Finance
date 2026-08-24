# SKILL 12 — Banco e Migrations

Documento: `15_BANCO_MIGRACOES_IDEMPOTENCIA.md`.

## Antes de alterar schema
Auditar migration filesystem + `_prisma_migrations` + schema.

## Proibido em banco relevante
- reset destrutivo;
- `db push` como substituto silencioso de migration;
- reescrever migration aplicada;
- ignorar `migration.sql` no Git.

## Entrega
Provar reprodução em ambiente controlado e `migrate status`.
