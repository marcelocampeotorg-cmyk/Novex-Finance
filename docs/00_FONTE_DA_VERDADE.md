# 00 — Fonte da Verdade

O NOVEX Finance é um sistema financeiro pessoal automatizado, inicialmente usado por uma única pessoa. O objetivo não é transformar o software em um banco nem conceder a ele autoridade para movimentar dinheiro.

O produto deve reduzir ao mínimo o trabalho manual de lançamento, cobrança, conciliação, categorização e acompanhamento.

## Modelo mental

Há três camadas que nunca devem ser confundidas:

### Planejamento
Algo que ainda vai acontecer: conta a pagar, dívida a receber, parcela, recorrência, vencimento.

### Movimentação real
Dinheiro que de fato entrou ou saiu. No modo Híbrido, a conta Mercado Pago exige prova oficial do provedor. Na conta geral manual, o lançamento confirmado pelo usuário é a fonte autorizada e deve manter autoria, data e trilha de auditoria.

### Conciliação
Vínculo entre uma movimentação real e algo que já estava planejado.

Uma movimentação real pode existir sem planejamento prévio. Ex.: compra no Mercado Livre, débito automático da Claro ou Pix espontâneo.

## Princípio de autonomia
O usuário não deve ter que cadastrar manualmente transações que a integração já consegue observar. O usuário cadastra aquilo que deseja planejar, cobrar, parcelar, prever ou controlar antecipadamente.

## Modos operacionais

O produto possui apenas:

- **Manual:** uma conta geral com saldo inicial datado, receitas, despesas e ajustes auditáveis;
- **Híbrido:** a mesma conta geral manual mais uma conta Mercado Pago sincronizada.

As contas permanecem separadas por fonte. O valor manual nunca substitui, corrige ou mascara a conta Mercado Pago.

## Princípio de segurança
Fato financeiro não é inferência. Valor, direção e ocorrência de uma movimentação vêm da fonte financeira e do ledger. Regras, heurísticas ou LLM podem interpretar significado, categoria ou provável vínculo, mas não inventar entrada/saída nem confirmar pagamento inexistente.
