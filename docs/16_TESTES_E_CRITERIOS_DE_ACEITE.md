# 16 — Testes e Critérios de Aceite

## Regra
Teste não pode duplicar a lógica de produção e provar apenas a cópia. Sempre que possível, importar/exercitar o código real.

## Gates mínimos
- lint;
- typecheck;
- testes unitários;
- testes de integração;
- build;
- `prisma validate`;
- `prisma generate`;
- `prisma migrate status`;
- migrations reproduzíveis em banco limpo controlado;
- QA no navegador;
- console sem erros relevantes;
- `git diff --check`.

## Fluxos críticos
1. autenticação e rotas protegidas;
2. credencial não vaza;
3. sandbox/production não se misturam;
4. Account Money assíncrono;
5. importação idempotente;
6. movimentação desconhecida altera ledger corretamente;
7. classificação não altera valor original;
8. cobrança Pix real no ambiente oficial de teste;
9. webhook duplicado não duplica crédito;
10. QR de conta a pagar não marca pago;
11. saída real concilia conta;
12. duplicidade gera alerta;
13. UI atualiza sem F5;
14. WhatsApp não duplica cobrança;
15. push/painel respeitam preferências;
16. lixeira real;
17. CSV real;
18. nenhum mock em runtime produtivo.

## Evidência
O relatório de entrega deve citar o comando/teste, resultado e limitação. “Build OK” sozinho nunca fecha um fluxo financeiro.
