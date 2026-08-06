# 08 — Motor de conciliação automática

## Objetivo

Transformar movimentações reais importadas em atualização automática de contas, parcelas e dashboard, com mínima intervenção humana.

## Prioridade de correspondência

1. identificador explícito, `txid` ou `external_reference`;
2. movimento já originado por cobrança NOVEX;
3. direção correta;
4. valor exato ou soma parcial compatível;
5. favorecido/devedor compatível;
6. data próxima ao vencimento ou momento de geração do Pix;
7. descrição e metadados semelhantes;
8. histórico de regras do usuário.

## Score inicial sugerido

Os pesos são configuráveis e devem ser validados por testes:

- referência única: +100;
- direção correta: requisito obrigatório;
- valor exato: +40;
- contato compatível: +25;
- data dentro da janela: +20;
- descrição semelhante: +10;
- regra conhecida: +15.

Decisão:

- referência única válida: auto-match imediato;
- score alto e candidato único: auto-match;
- score médio: sugestão de um toque;
- empate ou score baixo: manter não conciliado.

Não automatizar quando dois candidatos forem quase equivalentes.

## Pagamentos parciais

- Uma transação menor que o saldo pode liquidar parcialmente.
- Múltiplas transações podem completar uma parcela.
- Uma transação maior não deve ser dividida silenciosamente sem regra clara.
- Permitir sugestão de divisão quando valores e contexto forem inequívocos.

## Compras não planejadas

Se nenhum item previsto corresponder a um débito:

1. criar registro financeiro automaticamente;
2. marcar como importado;
3. categorizar por regra;
4. usar “Não categorizada” como fallback;
5. incluir imediatamente no saldo real e relatórios.

## Regras de categorização

- normalização do nome do estabelecimento;
- regra por texto/contraparte;
- regra por faixa de valor opcional;
- categoria padrão por contato;
- prioridade explícita;
- possibilidade de desativar regra;
- histórico de alterações.

## Reversões

- Uma conciliação pode ser desfeita sem apagar a movimentação.
- Estorno ou reembolso do provedor deve reabrir o saldo da parcela, quando aplicável.
- Registrar auditoria completa.

## Métricas

- percentual conciliado automaticamente;
- quantidade pendente;
- taxa de correção manual;
- tempo médio entre movimento e atualização;
- falhas de sincronização;
- duplicidades bloqueadas.
