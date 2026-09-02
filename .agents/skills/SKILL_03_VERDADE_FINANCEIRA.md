# SKILL 03 — Verdade Financeira

Documentos: `04_MODELO_FINANCEIRO_LEDGER_E_SALDO.md`, `08_MOVIMENTACOES_E_CONCILIACAO_INTELIGENTE.md`.

## Regra central
Nunca confundir:
- planejamento;
- fato financeiro;
- conciliação.

Um valor só entra/sai do ledger por fonte autorizada ou ajuste excepcional auditável.

## Modos e saldo
- Manual: saldo inicial datado + lançamentos manuais auditáveis.
- Híbrido: conta manual separada da conta Mercado Pago.
- Mercado Pago: âncora somente pelo `BALANCE_AMOUNT` validado do Relatório de Liberações; atualização posterior apenas pela cadeia contínua de fatos oficiais do extrato.
- Relatório assíncrono sempre exige horário de corte visível.

## Anti-fake
Não usar timeout, botão “simular”, mock, alert ou flag local para dizer que dinheiro entrou/saiu.

## Erro
Falha de consulta não vira zero.
Movimentação desconhecida não vira inexistente.
