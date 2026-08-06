# 04 — Fluxos do usuário

## Fluxo A — Cadastrar e pagar aluguel

1. Criar conta “Aluguel”.
2. Informar favorecido, valor, vencimento e chave Pix.
3. Definir recorrência e lembretes.
4. No vencimento, abrir a parcela.
5. Clicar em “Pagar”.
6. O sistema gera BR Code Pix com valor e identificador único.
7. O usuário escaneia pelo Mercado Pago e confirma.
8. O worker importa a saída.
9. O conciliador identifica a parcela.
10. A parcela muda automaticamente para paga.
11. Dashboard, saldo e histórico são atualizados.
12. Se houver ambiguidade, exibir somente uma confirmação de vínculo.

## Fluxo B — Compra feita fora do painel

1. O usuário compra diretamente usando Mercado Pago.
2. O worker importa a movimentação.
3. Nenhuma conta prevista é encontrada.
4. O sistema cria uma despesa não planejada automaticamente.
5. Uma regra tenta identificar a categoria.
6. Se não conseguir, usa “Não categorizada”.
7. O dashboard já considera a saída.

## Fluxo C — Cobrar uma pessoa

1. Cadastrar o devedor.
2. Criar conta a receber ou negociação parcelada.
3. Gerar cobrança Pix Mercado Pago para a parcela.
4. Exibir QR Code, Copia e Cola e link, quando disponível.
5. Usuário envia manualmente à pessoa.
6. Mercado Pago notifica o webhook após pagamento.
7. O backend valida e busca o pagamento oficial.
8. Registra a entrada e baixa a parcela automaticamente.
9. Atualiza saldo, histórico e notificações.

## Fluxo D — Recebimento externo não planejado

1. O usuário recebe um Pix diretamente no Mercado Pago.
2. O worker importa o crédito.
3. O conciliador tenta localizar devedor ou parcela.
4. Se houver correspondência forte, concilia automaticamente.
5. Se não houver, cria receita não identificada.
6. O painel permanece financeiramente atualizado.

## Fluxo E — Negociação parcelada variável

1. Informar valor total.
2. Escolher número de parcelas.
3. Editar valor e vencimento de cada parcela.
4. Validar soma.
5. Salvar o acordo.
6. Acompanhar cada parcela separadamente.
7. Em renegociação, preservar parcelas antigas e criar novo acordo relacionado.

## Fluxo F — Excluir cadastro errado

1. Selecionar item.
2. Enviar para lixeira.
3. Retirar dos painéis operacionais.
4. Permitir restauração dentro do prazo.
5. Impedir perda de transações importadas ou auditoria.
