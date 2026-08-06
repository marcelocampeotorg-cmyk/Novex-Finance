# 00 — Comece aqui

## Missão imediata

Criar um sistema novo, em uma pasta nova, sem ERPNext e sem reaproveitar código do projeto anterior. O NOVEX Finance deve ser uma aplicação financeira pessoal, automatizada e preparada para rodar em Docker localmente e em um servidor Linux.

## Princípio central

O usuário não quer manter o painel digitando manualmente cada compra ou marcando contas como pagas. O sistema deve importar as movimentações do Mercado Pago, conciliá-las com contas e parcelas previstas e atualizar o painel automaticamente.

## O que pode ser reaproveitado do projeto anterior

Somente:

- identidade visual oficial NOVEXBR;
- imagens de referência da interface;
- requisitos e decisões deste pacote;
- código da integração Mercado Pago existente, **apenas após auditoria** e somente se for seguro, testável e compatível com a nova arquitetura.

Não reaproveitar:

- ERPNext;
- Frappe;
- banco de dados antigo;
- CSS antigo;
- Docker antigo;
- módulos contábeis ou empresariais;
- hacks, patches ou customizações de core.

## Primeira entrega esperada

O Antigravity deve:

1. criar o novo repositório;
2. configurar Docker para desenvolvimento;
3. construir a fundação visual com dados demonstrativos;
4. iniciar o sistema;
5. fornecer um link de preview local estável;
6. apresentar o que foi feito e os testes executados;
7. aguardar aprovação antes de avançar para a integração real.

## Regra de execução

Trabalhar por marcos. Não misturar interface, banco, integração e produção em uma alteração gigantesca. Cada marco deve terminar compilando, testado e visualizável.
