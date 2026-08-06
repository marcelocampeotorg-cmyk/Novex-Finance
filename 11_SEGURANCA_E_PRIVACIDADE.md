# 11 — Segurança e privacidade

## Princípios

- menor privilégio;
- validação no servidor;
- isolamento por workspace;
- segredos somente no backend;
- auditoria;
- criptografia adequada;
- dados financeiros minimizados.

## Controles obrigatórios

- autenticação com biblioteca madura;
- hash de senha forte;
- cookies `HttpOnly`, `Secure` em produção e `SameSite` adequado;
- proteção CSRF quando necessária;
- rate limiting em login, recuperação e webhooks;
- validação Zod nas fronteiras;
- autorização por workspace em toda consulta;
- tokens Mercado Pago criptografados;
- webhook com validação de assinatura;
- idempotência;
- prevenção de SSRF em uploads/URLs;
- limite de tamanho e MIME de anexos;
- headers de segurança;
- dependências auditadas;
- logs redigidos.

## Dados que não podem aparecer em logs

- Access Token;
- refresh token;
- segredo de webhook;
- senha;
- chave Pix completa sem necessidade;
- documento completo;
- payload financeiro bruto sem redação.

## Exclusão e LGPD

- permitir exportação futura;
- excluir dados pessoais quando legalmente possível;
- preservar transações e auditoria necessárias;
- separar exclusão visual de remoção física;
- registrar consentimento quando OAuth multiusuário for adicionado.

## Ameaças específicas

- webhook duplicado;
- webhook falso;
- importação repetida;
- conciliação errada;
- exposição de token no frontend;
- acesso cruzado entre workspaces;
- manipulação de valor pelo cliente;
- upload malicioso;
- execução concorrente de sync.

Cada ameaça deve possuir teste ou controle documentado.
