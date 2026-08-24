# SKILL 11 — Segurança e Segredos

Documento: `14_SEGURANCA_E_LIMITES_FINANCEIROS.md`.

## Regras
- menor privilégio;
- segredos server-only;
- DTO sanitizado;
- auth server-side;
- nenhuma ação sensível confia em workspace/id arbitrário;
- webhook validado;
- logs sem credenciais.

Qualquer vazamento potencial entra imediatamente no `ERROR_LOG.md`.
