# 04 — Modelo Financeiro, Ledger e Saldo

**Ledger = livro-caixa interno imutável/auditável que registra os fatos financeiros relevantes.**

## Objetivo
Eliminar a dependência de “saldo atual digitado manualmente”.

## Regras
- O saldo operacional é derivado de fatos financeiros importados/confirmados e de uma referência inicial oficial quando disponível.
- Toda transação com impacto financeiro precisa ser idempotente.
- Uma transação não identificada não pode “sumir” do saldo.
- Categoria, descrição amigável e conciliação podem ser corrigidas sem apagar o fato financeiro original.
- O payload/origem bruta deve ser preservado de forma segura o suficiente para auditoria.
- Deve existir timestamp/fonte da última sincronização.
- Se houver lacuna de dados, mostrar “saldo em reconciliação” ou indicador equivalente; nunca mascarar a lacuna com valor manual inventado.

## Mercado Pago
O relatório “Dinheiro em Conta” possui `SETTLEMENT_NET_AMOUNT`, descrito pelo Mercado Pago como o valor líquido da operação que impactou o dinheiro em conta. O sistema deve modelar o impacto real a partir dos campos oficiais, sem tentar deduzir saldo apenas por “payment approved”.

## Saldo exibido
A UI deve distinguir:
- saldo calculado/sincronizado;
- entradas do período;
- saídas do período;
- contas a pagar futuras;
- contas a receber futuras;
- projeção.

Não chamar “saldo em tempo real” se a fonte real for relatório assíncrono. Exibir última atualização.

## Auditoria
Correções de classificação não devem reescrever o valor original. Ajustes extraordinários precisam de trilha de auditoria e não podem ser usados como atalho para esconder falha de sincronização.
