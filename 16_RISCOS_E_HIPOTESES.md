# 16 — Riscos e hipóteses

## Capacidades do Mercado Pago ainda precisam de teste real

Não assumir sem evidência:

- endpoint de saldo atual;
- latência de atualização das saídas;
- campos disponíveis em uma saída Pix;
- presença de `txid` no relatório/importação;
- cobertura de compras feitas fora do painel;
- comprovante por API;
- histórico retroativo;
- rate limits da conta;
- formato exato de webhooks na integração existente.

## Mitigações

- criar spike antes da integração completa;
- manter adapter por capacidades;
- exibir última sincronização;
- polling configurável;
- importação idempotente;
- conciliação por score;
- confirmação de um toque em ambiguidades;
- não exigir lançamento manual.

## Risco de conciliação errada

Duas contas podem ter mesmo valor e data. O sistema não deve adivinhar quando a confiança for insuficiente.

## Risco de saldo incorreto

- duplicidade;
- estorno não processado;
- janela de sync perdida;
- atraso de relatório;
- saldo inicial ausente.

Mitigação: cursor, sobreposição de janela, unique constraints, reconciliação histórica e indicador de saúde.

## Risco de escopo

Tentar implementar SaaS, WhatsApp, produção e integração completa antes de validar a interface e o domínio pode atrasar o produto. Seguir marcos.
