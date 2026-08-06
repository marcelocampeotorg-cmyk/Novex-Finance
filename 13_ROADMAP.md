# 13 — Roadmap de implementação

## Marco 0 — Fundação

- pasta nova;
- Git novo;
- Docker;
- Next.js/TypeScript;
- PostgreSQL/Redis;
- lint/typecheck/test/build;
- design tokens;
- preview em `http://localhost:3000`.

## Marco 1 — Interface navegável

- layout;
- telas das referências;
- Movimentações;
- estados de sync e conciliação;
- dados mock centralizados;
- responsividade;
- aprovação visual.

## Marco 2 — Autenticação e banco

- User, Workspace, Membership;
- sessão;
- migrations;
- contatos, categorias, itens, parcelas;
- CRUD real;
- lixeira.

## Marco 3 — Núcleo financeiro

- contas a pagar/receber;
- parcelamento variável;
- recorrências;
- pagamentos parciais;
- ledger e projeção;
- anexos locais.

## Marco 4 — Spike Mercado Pago

Antes de codar integração completa:

- auditar API existente;
- testar credenciais em ambiente seguro;
- mapear capacidades reais;
- testar saldo;
- testar listagem/relatório de movimentações;
- testar campos disponíveis em Pix de saída;
- testar webhook;
- documentar latência e limites.

## Marco 5 — Integração Mercado Pago

- adapter;
- credenciais criptografadas;
- cobrança Pix;
- webhook idempotente;
- sync por cursor;
- external transactions;
- botão sincronizar agora.

## Marco 6 — Conciliação automática

- txid/reference;
- heurísticas;
- auto-match;
- sugestões;
- compras não planejadas;
- categorização automática;
- reversões.

## Marco 7 — Lembretes e worker

- recorrências automáticas;
- lembretes configuráveis;
- fila e retry;
- notificações internas;
- métricas.

## Marco 8 — Hardening e deploy

- storage externo;
- backup;
- HTTPS;
- observabilidade;
- testes de carga moderada;
- produção Docker;
- manual de recuperação.

## Regra

O pacote descreve o produto completo, mas o Antigravity deve executar um marco por vez e não avançar sem apresentar evidências.
