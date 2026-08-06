# Skill — Docker e DevOps

## Objetivo

Manter desenvolvimento e produção reproduzíveis.

## Regras

- Dockerfile multi-stage;
- usuário não-root;
- volumes persistentes;
- healthchecks;
- banco/Redis privados em produção;
- migrations controladas;
- backup e restauração documentados;
- link de preview local após cada marco.

## Pronto quando

`docker compose up` inicia ambiente completo e a aplicação responde em `http://localhost:3000`.
