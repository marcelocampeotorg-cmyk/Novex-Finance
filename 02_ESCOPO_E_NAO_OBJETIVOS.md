# 02 — Escopo e não objetivos

## Escopo confirmado da primeira versão funcional

- autenticação por e-mail e senha;
- workspace pessoal isolado por usuário;
- dashboard financeiro;
- integração de uma conta Mercado Pago;
- saldo atual ou saldo calculado com indicação da fonte;
- contas a pagar;
- contas a receber;
- pessoas, favorecidos e devedores;
- chaves Pix dos favorecidos;
- negociações com valor total e parcelas variáveis;
- pagamentos e recebimentos parciais;
- recorrências;
- lembretes configuráveis;
- geração de QR Code e Pix Copia e Cola para contas a pagar;
- criação de cobrança Pix Mercado Pago para contas a receber;
- webhook de recebimentos;
- importação de movimentações do Mercado Pago;
- conciliação automática;
- compras externas importadas automaticamente;
- categorização automática por regras;
- histórico e auditoria;
- anexos e comprovantes;
- lixeira e recuperação;
- Docker local e produção.

## Fora do escopo inicial

- ERPNext ou Frappe;
- estoque;
- catálogo de produtos;
- vendas empresariais;
- compras empresariais;
- ordens de serviço;
- oficina mecânica;
- ponto de venda;
- emissão fiscal;
- folha de pagamento;
- contabilidade formal;
- cartão de crédito Mercado Pago;
- pagamento automático iniciado pelo sistema;
- custódia de dinheiro;
- movimentação bancária sem confirmação no aplicativo Mercado Pago;
- WhatsApp automático no primeiro marco;
- marketplace, planos e cobrança do SaaS no primeiro marco.

## Diferença essencial

O sistema **gera os dados do Pix**, mas não executa o pagamento de uma conta. O usuário escaneia e confirma no Mercado Pago. Depois, a sincronização reconhece a saída e baixa a parcela automaticamente.
