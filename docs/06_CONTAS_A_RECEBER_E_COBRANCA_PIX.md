# 06 — Contas a Receber e Cobrança Pix

## Cadastro
Uma obrigação a receber pode conter:
- devedor;
- telefone;
- descrição;
- valor;
- vencimento;
- número de parcelas;
- observações;
- estratégia/cadência de cobrança já existente no sistema.

## Cobrança
O NOVEX deve criar uma cobrança Pix específica para aquela parcela e associar identificadores persistentes:
devedor → item financeiro → parcela → cobrança → order/payment real.

## WhatsApp
A cobrança é enviada pela Evolution API. A cadência já configurada no produto deve ser preservada. Não inventar uma nova sequência de D-7/D0/D+N sem auditar o comportamento atual e as preferências já persistidas.

## Confirmação
Uma cobrança só é paga após status oficial compatível com crédito efetivo. Não aceitar “processed” genérico sem conferir o `status_detail` apropriado para a API utilizada.

## Valor diferente
Como o QR gerado possui valor definido, um pagamento oficial daquela cobrança deve corresponder ao valor esperado.

Se aparecer outra entrada semelhante, porém com valor diferente:
- não tratá-la automaticamente como parcial daquela cobrança;
- registrar a entrada real;
- sugerir vínculo apenas se houver evidência;
- solicitar confirmação quando necessário.

## Pagamento parcial
O modelo pode suportar parcial como exceção de domínio, mas não deve transformar qualquer divergência em parcial.

## Pagamento duplicado
Se a mesma obrigação aparentar receber duas entradas:
- primeira baixa normal;
- segunda fica como “possível pagamento duplicado/crédito excedente”;
- notificar o usuário;
- não aplicar automaticamente em outra dívida;
- usuário decide se é duplicidade, outra dívida ou outro fato.

## Idempotência
Repetição de webhook/poll não pode gerar duas baixas ou dois créditos.
