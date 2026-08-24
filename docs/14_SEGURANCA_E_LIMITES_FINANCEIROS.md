# 14 — Segurança e Limites Financeiros

## Princípio de menor privilégio
Toda integração recebe apenas o acesso necessário para seu papel.

## Saída de dinheiro
A V1 não deve possuir código ativo capaz de:
- enviar Pix;
- efetuar transferência;
- pagar boleto;
- fazer payout;
- sacar;
- refund/devolver via API.

Se uma biblioteca/SDK expõe essas funções, não significa que o NOVEX deve usá-las.

## Credenciais
- variáveis secretas server-side;
- criptografia em repouso quando armazenadas;
- nenhum retorno de modelo de banco com `encryptedCredentials` ao frontend;
- DTO sanitizado;
- logs com redaction;
- sem token em screenshot;
- rotação possível.

## Autenticação
Usar biblioteca madura. Rotas protegidas no servidor. Nenhuma server action sensível deve confiar em `workspaceId` vindo do cliente sem validar o contexto autenticado.

## Webhooks
- validar assinatura/autenticidade conforme documentação do provedor;
- deduplicar;
- responder rápido;
- processar pesado em background;
- registrar falhas/retry.

## Dados
- dinheiro em centavos/Decimal apropriado;
- timezone bem definido;
- datas auditáveis;
- soft delete onde necessário;
- backup e restauração testados.

## Falha segura
Quando não houver certeza, o sistema preserva o fato financeiro e reduz automação; não fabrica sucesso.
