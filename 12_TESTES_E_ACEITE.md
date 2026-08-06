# 12 — Testes e critérios de aceite

## Qualidade automática

- lint;
- typecheck;
- build;
- testes unitários;
- testes de integração com PostgreSQL;
- testes end-to-end dos fluxos críticos;
- testes de migrations;
- teste de build Docker;

## Cenários críticos

### Importação

- importar movimento novo;
- ignorar duplicado;
- retomar por cursor;
- recuperar após erro temporário;
- processar estorno.

### Conciliação

- referência única;
- valor e data compatíveis;
- dois candidatos ambíguos;
- pagamento parcial;
- movimentação maior que parcela;
- desfazer vínculo;
- compra não planejada.

### Recebimento

- criar cobrança com idempotência;
- webhook válido;
- webhook inválido;
- webhook repetido;
- status pendente e aprovado;
- reembolso.

### Segurança

- usuário A não acessa workspace B;
- token não aparece no browser;
- upload inválido é bloqueado;
- login limitado;
- rota de webhook não confia no payload sem consulta oficial.

### Interface

- todas as rotas carregam;
- dark theme legível;
- modal funciona;
- filtros funcionam;
- mobile utilizável;
- erro de sync visível;
- preview sem console errors.

## Critério de aceite da automação

O produto não é considerado funcional enquanto:

- uma compra feita fora do painel não aparecer automaticamente;
- um pagamento de conta não puder ser conciliado sem marcar manualmente;
- uma cobrança recebida não atualizar a parcela;
- o saldo não indicar fonte e última atualização;
- duplicidades puderem alterar o saldo duas vezes.

## Evidência exigida por marco

- comandos executados;
- resultado dos testes;
- capturas;
- link de preview;
- lista de limitações reais;
- estado Git.
