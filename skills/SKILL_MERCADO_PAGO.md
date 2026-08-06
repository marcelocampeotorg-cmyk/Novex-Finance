# Skill — Mercado Pago

## Objetivo

Integrar recebimentos e movimentações com segurança e idempotência.

## Método

1. Auditar API existente.
2. Fazer spike com ambiente seguro.
3. Mapear capacidades reais.
4. Implementar adapter.
5. Criar fixtures redigidas.
6. Implementar cobrança Pix.
7. Implementar webhook.
8. Implementar sync por cursor.
9. Testar duplicidade e retry.

## Não fazer

- token no frontend;
- confiar apenas no payload do webhook;
- assumir saldo/relatório sem teste;
- logar dados sensíveis;
- acoplar SDK ao domínio.
