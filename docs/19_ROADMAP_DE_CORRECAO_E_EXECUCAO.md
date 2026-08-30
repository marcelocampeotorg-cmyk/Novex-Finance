# 19 — Roadmap de Correção e Execução

Este documento não obriga uma ordem técnica cega. O agente deve auditar dependências e ajustar a sequência, preservando prioridades.

## Prioridade 0 — Segurança e reprodutibilidade
- migrations;
- segredos/server actions;
- remover/neutralizar funções que executem refund/saída;
- eliminar mocks que alterem estado financeiro.

## Prioridade 1 — Verdade financeira
- Account Money real;
- pipeline assíncrono persistente;
- ledger;
- saldo manual legítimo separado da conta Mercado Pago e sem sobrescrita do provedor;
- fonte/timestamp;
- source separation.

## Prioridade 2 — Cobranças e pagamentos
- cobrança Pix correta;
- status real;
- idempotência;
- QR de conta a pagar;
- intenção de pagamento;
- conciliação de saída.

## Prioridade 3 — Automação
- reconhecimento;
- regras aprendidas;
- recorrências;
- categorias;
- duplicidade/ambiguidade;
- Evolution API.

## Prioridade 4 — UX premium
- remover linguagem técnica da navegação;
- dashboard real;
- gráficos;
- mobile/PWA;
- atualização automática;
- notificações.

## Prioridade 5 — Produção
- testes completos;
- Cloudflare preview;
- observabilidade;
- backup;
- deploy somente com autorização.

Cada marco precisa terminar com evidência, atualização de `ERROR_LOG.md` e registro de limitações.
