# 17 — Auditoria da API existente

## Objetivo

Determinar o que pode ser reaproveitado da integração Mercado Pago já existente sem trazer o projeto antigo inteiro.

## Material necessário

O usuário fornecerá o caminho do repositório, ZIP ou arquivos do painel atual. Não solicitar nem copiar tokens reais.

## Inventário

Localizar:

- package manifest;
- cliente/SDK Mercado Pago;
- serviço de cobrança Pix;
- webhook;
- consulta de pagamentos;
- sincronização de movimentações;
- consulta ou cálculo de saldo;
- relatórios;
- banco e tabelas;
- idempotência;
- tratamento de erros;
- variáveis de ambiente;
- testes;
- logs de exemplo redigidos.

## Classificação

Para cada módulo:

- REUTILIZAR: isolado, licenciado, seguro e testado;
- ADAPTAR: lógica útil, mas acoplada;
- REESCREVER: inseguro, sem testes ou incompatível;
- DESCARTAR: redundante ou incorreto.

## Regras

- nunca copiar `.env`;
- substituir segredos por `REMOVIDO`;
- nunca colocar token no frontend;
- confirmar versão e licença de dependências;
- criar testes de contrato com fixtures redigidas;
- manter a nova integração atrás do adapter.

## Saída da auditoria

- diagrama do fluxo atual;
- capacidades confirmadas;
- endpoints usados;
- lacunas;
- riscos;
- arquivos reaproveitáveis;
- plano de migração;
- nenhuma alteração destrutiva no painel antigo.
