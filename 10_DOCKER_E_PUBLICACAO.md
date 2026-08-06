# 10 — Docker e publicação

## Objetivo

O mesmo repositório deve rodar localmente e em servidor Linux usando Docker, sem depender de estado dentro de containers efêmeros.

## Serviços

```text
web        Next.js/API/webhooks
worker     filas, sync, conciliação, recorrências e lembretes
postgres   banco de dados
redis      filas e locks
```

Opcional em produção:

```text
reverse-proxy  Caddy, Traefik ou Nginx
backup         job de backup
object-storage serviço S3 externo ou MinIO, conforme decisão futura
```

## Arquivos esperados

- `Dockerfile` multi-stage;
- `compose.yml`;
- `compose.dev.yml`;
- `compose.prod.yml` ou override equivalente;
- `.env.example`;
- scripts de migration;
- healthchecks;
- volume persistente do PostgreSQL;
- volume local de anexos no desenvolvimento;
- documentação de backup e restauração.

## Regras

- Não copiar `node_modules` do host.
- Usuário não-root no container.
- Build reproduzível.
- Migrations executadas de forma controlada.
- Nenhum segredo na imagem.
- Banco e Redis não expostos publicamente em produção.
- Webhook somente por HTTPS em produção.
- Logs estruturados e sem dados sensíveis.

## Desenvolvimento

O Docker deve publicar a aplicação em:

`http://localhost:3000`

O Antigravity deve manter o preview rodando e informar o link após cada marco visual.

## Produção futura

- domínio próprio;
- HTTPS;
- backup diário do banco;
- política de retenção;
- storage externo para comprovantes;
- monitoramento de healthcheck;
- reinício automático;
- atualização com rollback.
