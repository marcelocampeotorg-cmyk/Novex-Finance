# SKILL 14 — Deploy e infraestrutura

Documento: `17_CLOUDFLARE_E_DEPLOY.md`.

## Alvo atual
Servidor Linux próprio com Docker Compose exclusivo do NOVEX Finance. Cloudflare pode atuar como DNS/túnel/edge, sem hospedar ou acoplar o processo da aplicação nesta fase.

## Isolamento obrigatório
- project name, containers, redes e volumes exclusivos com prefixo `novexfinance-prod`;
- PostgreSQL, Redis e Evolution sem portas públicas;
- app exposto apenas no loopback do host para proxy/túnel;
- nenhuma dependência de diretório, Compose, rede, volume ou banco de Master, Oficina/Options;
- comandos de deploy e rollback sempre escopados ao Compose do Finance.

## Antes de deploy
Validar segredos, banco, jobs, migrations, backup restaurável, rollback, portas, proxy, DNS, QA e ausência de conflito com stacks existentes.

## Autoridade
Deploy exige autorização explícita. A autorização não permite reiniciar, remover ou reconfigurar outros sistemas do host.
