# SKILL 06 — Cobrança Pix / Recebíveis

Documento: `06_CONTAS_A_RECEBER_E_COBRANCA_PIX.md`.

## Regra
Cobrança gerada deve ser vinculada a item/parcela e possuir idempotência.

## Confirmação
Somente evento/status oficial adequado baixa a parcela.

## Divergência
Valor diferente não vira parcial automaticamente.

## Duplicidade
Não reaproveitar crédito duplicado silenciosamente.
