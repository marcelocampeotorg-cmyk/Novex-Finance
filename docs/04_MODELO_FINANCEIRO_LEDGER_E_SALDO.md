# 04 — Modelo Financeiro, Ledger e Saldo

**Ledger = livro-caixa interno imutável/auditável que registra os fatos financeiros relevantes.**

## Objetivo
Manter saldos por fonte sem chamar a soma de um histórico incompleto de saldo absoluto e sem usar valores manuais para corrigir a conta Mercado Pago.

## Conta geral manual
- Existe uma única conta geral manual por workspace.
- O saldo nasce de uma âncora inicial datada e evolui por créditos, débitos, reversões e substituições auditáveis.
- Lançamentos manuais são fatos autorizados pelo usuário apenas nessa conta.
- Editar um fato contabilizado cria reversão e substituição; não altera silenciosamente o Ledger original.

## Conta Mercado Pago
- Existe somente no modo Híbrido e permanece separada da conta manual.
- Nenhum ajuste manual pode sobrescrever seu saldo ou seus fatos.
- Movimentação líquida importada é fluxo conhecido, não saldo atual.
- Saldo disponível somente é oficial quando um relatório/âncora oficial validado fornecer valor e corte temporal verificáveis.

## Regras
- Toda movimentação real altera a movimentação líquida conhecida. Saldo absoluto somente existe quando uma fonte oficial ou uma âncora com cobertura contínua suficiente o comprovar.
- Toda transação com impacto financeiro precisa ser idempotente.
- Uma transação não identificada não pode “sumir” do saldo.
- Categoria, descrição amigável e conciliação podem ser corrigidas sem apagar o fato financeiro original.
- O payload/origem bruta deve ser preservado de forma segura o suficiente para auditoria.
- Deve existir timestamp/fonte da última sincronização.
- Se houver lacuna de dados, mostrar “saldo em reconciliação” ou indicador equivalente; nunca mascarar a lacuna com o saldo da conta manual.
- Fatos em quarentena permanecem preservados, mas são excluídos de saldo, totais e relatórios até revisão.

## Mercado Pago
O relatório “Dinheiro em Conta” possui `SETTLEMENT_NET_AMOUNT`, descrito pelo Mercado Pago como o valor líquido da operação que impactou o dinheiro em conta. O sistema deve modelar o impacto real a partir dos campos oficiais, sem tentar deduzir saldo apenas por “payment approved”.

## Valor exibido
A UI deve distinguir:
- movimentação líquida conhecida ou saldo em reconciliação;
- período de cobertura comprovada;
- saldo absoluto, apenas quando comprovado por fonte oficial;
- entradas do período;
- saídas do período;
- contas a pagar futuras;
- contas a receber futuras;
- projeção.

O total consolidado só existe quando todos os saldos integrantes estão comprovados. Se o saldo Mercado Pago estiver indisponível, mostrar as contas separadas e omitir o total geral.

Não chamar “saldo em tempo real” se a fonte real for relatório assíncrono. Exibir última atualização.

## Auditoria
Correções de classificação não devem reescrever o valor original. Ajustes extraordinários precisam de trilha de auditoria e não podem ser usados como atalho para esconder falha de sincronização.
