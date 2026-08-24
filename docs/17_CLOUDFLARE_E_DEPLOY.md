# 17 — Cloudflare e Deploy

## Alvo
Domínio canônico: `app.novexfinance.com.br`.

## Next.js
A documentação atual da Cloudflare recomenda **Cloudflare Workers** para aplicações Next.js full-stack, usando o adaptador OpenNext. Pages deve ficar restrito a exportação estática quando esse for realmente o caso.

## Requisito de compatibilidade
Antes de migrar/deployar:
- auditar dependências Node usadas pelo projeto;
- validar no runtime `workerd`, não apenas no `next dev`;
- executar preview compatível com Cloudflare;
- tratar segredos no ambiente Cloudflare;
- verificar acesso ao PostgreSQL/Redis/serviços externos;
- avaliar duração/limites de jobs e separar workers quando necessário.

## Arquitetura de background
Relatórios assíncronos, cobrança, recorrências e reconciliação não devem depender de um navegador aberto. A implementação deve escolher mecanismo compatível com Cloudflare e/ou serviço de worker persistente existente, conforme auditoria.

## Deploy
Nenhum agente faz deploy automaticamente. Primeiro:
- testes;
- preview;
- migração validada;
- backup;
- revisão;
- autorização explícita.

## Domínio/PWA
HTTPS obrigatório para service worker/push. Manifest e ícones devem usar marca oficial.

## Fonte
Ver `23_FONTES_OFICIAIS.md`.
