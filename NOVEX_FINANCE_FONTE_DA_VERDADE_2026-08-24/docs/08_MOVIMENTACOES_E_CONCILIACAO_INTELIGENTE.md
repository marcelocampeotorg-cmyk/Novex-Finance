# 08 — Movimentações e Conciliação Inteligente

## Conceito
A movimentação real nasce da fonte financeira. A conciliação decide se ela corresponde a algo planejado.

## Fases
1. ingestão;
2. deduplicação;
3. normalização;
4. identificação de direção/impacto;
5. enriquecimento;
6. busca de correspondências;
7. score/confiança;
8. ação automática ou pendência;
9. aprendizado após confirmação.

## Evidências de correspondência
Podem incluir:
- ID oficial;
- referência;
- valor;
- instituição/estabelecimento;
- nome normalizado;
- chave/contraparte quando disponível;
- tipo da operação;
- data/hora;
- recorrência histórica;
- vínculo com cobrança gerada pelo NOVEX;
- janela temporal;
- comportamento anterior confirmado.

## Confiança
- alta: concilia automaticamente;
- média: sugere ao usuário;
- baixa: mantém não identificada.

Os limites de confiança devem ser testados e configuráveis. Não usar uma LLM para produzir um “sim” sem evidências auditáveis.

## Regra aprendida
Quando o usuário corrige/ensina uma movimentação, o sistema pode criar regra reutilizável. A regra deve ser:
- visível;
- editável;
- desativável;
- auditável;
- específica o suficiente para evitar colisões.

## Não rigidez
Não exigir valor idêntico para uma assinatura que naturalmente varia. Usar combinação de padrões. Também não usar nome isolado como prova absoluta.

## Categorias
Há categorias base, mas o sistema e o usuário podem criar novas. Antes de criar automaticamente, evitar duplicatas semânticas (“Telefone”, “Telefonia”, “Plano celular”) por normalização/sugestão.

## Movimentação não reconhecida
Ainda afeta saldo. Fica pendente apenas a semântica, não a existência financeira.
