# 13 — Dashboard, Relatórios e Analytics

## Dashboard
O dashboard responde rapidamente:
1. qual é o saldo da conta manual;
2. qual é o saldo oficial do Mercado Pago, quando comprovado;
3. se existe total consolidado comprovado;
4. quanto entrou e saiu;
5. qual período possui cobertura comprovada;
6. quanto vence em breve;
7. quanto há a receber;
8. o que mudou;
9. o que exige atenção.

## Períodos
Hoje, semana, mês e intervalos úteis. Não inventar dados quando não houver histórico.

## Indicadores
- movimentação líquida conhecida ou saldo absoluto, quando oficialmente comprovado;
- entradas;
- saídas;
- resultado do período;
- contas a pagar;
- contas a receber;
- inadimplência;
- recorrências;
- categorias principais;
- taxa de conciliação automática;
- movimentações não identificadas.
- progresso da sincronização histórica e quantidade de itens em quarentena.

Se o saldo Mercado Pago não estiver comprovado, o dashboard omite o total consolidado e mostra “Saldo do Mercado Pago indisponível/em reconciliação”. A movimentação líquida continua visível, com período e fonte, sem aparência de saldo.

## Gráficos
- evolução do saldo em linha/área;
- entradas e saídas por período;
- distribuição por categoria;
- previsão futura;
- comparativos.

## Qualidade
Não substituir erro por zero. “R$0” é dado; “não consegui carregar” é erro. A UI deve distinguir.

## Exportação
CSV real, UTF-8, período selecionado e dados reais. Sanitizar strings contra CSV Injection. PDF pode ficar fora da V1 se ainda não houver implementação real.
