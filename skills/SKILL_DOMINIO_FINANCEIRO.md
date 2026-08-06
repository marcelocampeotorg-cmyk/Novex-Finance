# Skill — Domínio financeiro

## Objetivo

Modelar compromissos, parcelas, movimentos e saldo sem inconsistência.

## Regras

- centavos inteiros;
- total e parcelas fecham;
- pagamentos parciais acumulam;
- recorrência gera ocorrências independentes;
- transação externa é imutável;
- exclusão não apaga auditoria;
- saldo real e previsto são separados;
- origem e última sincronização são exibidas.

## Testes obrigatórios

- arredondamento;
- soma de parcelas;
- parcial;
- estorno;
- renegociação;
- timezone de vencimento;
- exclusão/lixeira.
