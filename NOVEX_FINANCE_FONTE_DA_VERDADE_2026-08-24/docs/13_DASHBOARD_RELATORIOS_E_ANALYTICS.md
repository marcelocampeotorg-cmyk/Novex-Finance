# 13 — Dashboard, Relatórios e Analytics

## Dashboard
O dashboard responde rapidamente:
1. quanto há disponível/calculado;
2. quanto entrou e saiu;
3. quanto vence em breve;
4. quanto há a receber;
5. o que mudou;
6. o que exige atenção.

## Períodos
Hoje, semana, mês e intervalos úteis. Não inventar dados quando não houver histórico.

## Indicadores
- saldo;
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
