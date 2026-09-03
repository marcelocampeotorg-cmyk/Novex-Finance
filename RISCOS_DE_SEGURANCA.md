# Auditoria defensiva de riscos de segurança — NOVEX Finance

**Data:** 02/09/2026  
**Escopo:** análise estática do checkout local. Nenhum ataque, login, chamada a produção, alteração de dependência, banco, configuração ou serviço foi realizado.  
**Conclusão:** há riscos relevantes antes de uma exposição direta à internet. O mais urgente é impedir abuso das rotas públicas de logs e webhook, fechar o cadastro por padrão e reduzir a duração/força da sessão administrativa.

## Como este relatório deve ser lido

- **Confirmado:** comportamento demonstrado diretamente pelo código/configuração atual.
- **Provável:** risco sustentado pelo desenho, mas dependente de proxy, ambiente ou implantação não verificados nesta auditoria.
- **Pendente de teste controlado:** precisa de homologação autorizada; não foi explorado.
- Severidades consideram confidencialidade, integridade financeira, disponibilidade e facilidade de exploração.

## Superfície observada

Aplicação Next.js, Better Auth, PostgreSQL/Prisma, worker HTTP interno, webhooks Mercado Pago, Evolution API e credenciais financeiras criptografadas. O repositório tinha mudanças locais preexistentes, que foram preservadas.

## Achados

### RF-01 — Alto — Endpoint público permite injeção ilimitada de logs e consumo de recursos

**Estado:** confirmado.  
**Onde:** `src/middleware.ts:7-16` libera todo `/api/logs`; `src/app/api/logs/client/route.ts:6-20` aceita POST sem sessão, limite específico, schema rígido ou rate limit.  
**Visão do atacante:** qualquer origem capaz de alcançar a aplicação pode enviar repetidamente mensagens, stacks e strings controladas, poluindo auditoria, ocupando disco/CPU e inserindo conteúdo enganoso nos logs. Cabeçalhos de IP encaminhados também são aceitos sem vínculo demonstrado com proxy confiável.  
**Impacto:** negação de serviço, perda de confiabilidade forense e possível exposição indireta caso visualizadores de log não escapem conteúdo.  
**Correção:** exigir sessão para telemetria do painel ou emitir token curto específico; validar esquema e comprimentos; limitar por IP/sessão; rejeitar conteúdo fora da allowlist; confiar em `X-Forwarded-For` somente após configurar proxy conhecido; aplicar cota e rotação de logs.  
**Aceite:** requisição anônima recebe 401/403; payload acima do limite recebe 413/400; rajadas recebem 429; conteúdo de controle não altera o formato do log.

### RF-02 — Alto — Cadastro público falha aberto quando a variável não é exatamente `false`

**Estado:** confirmado.  
**Onde:** `src/lib/auth.ts:21-42`.  
**Visão do atacante:** se `ALLOW_PUBLIC_SIGNUP` estiver ausente, digitada incorretamente ou com outro valor, o hook que limita criação de usuários não é aplicado. As rotas nativas de cadastro do Better Auth ficam potencialmente utilizáveis.  
**Impacto:** criação de conta não autorizada e acesso a dados/ações financeiras conforme o vínculo criado pelo restante do fluxo.  
**Correção:** cadastro deve ser bloqueado por padrão e habilitado apenas por valor explícito em ambiente local de bootstrap; em produção, abortar inicialização se a política estiver indefinida; desabilitar a rota depois do primeiro usuário por mecanismo transacional no banco.  
**Aceite:** produção sem variável ou com valor inválido não inicia; POST de cadastro anônimo sempre falha após o bootstrap; concorrência não cria segundo usuário.

### RF-03 — Alto — Webhook grava eventos inválidos antes de rejeitar assinatura

**Estado:** confirmado.  
**Onde:** `src/app/api/webhooks/mercado-pago/route.ts:76-132`.  
**Visão do atacante:** requisições sem assinatura válida ainda provocam consulta e `upsert` no banco antes do 401. IDs variados podem criar grande volume de registros inválidos. O JSON é lido antes da autenticação e não há rate limit específico demonstrado.  
**Impacto:** crescimento do banco, contenção, custo operacional e degradação/indisponibilidade do processamento financeiro legítimo.  
**Correção:** validar formato mínimo, timestamp e HMAC antes de qualquer escrita; impor limite de corpo no proxy e rota; rate limit separado; armazenar apenas contador/amostra agregada de falhas, com retenção curta; limitar comprimento de IDs e ação.  
**Aceite:** tráfego inválido não cria linhas; rajada inválida recebe 429 sem afetar processamento válido; testes cobrem IDs gigantes, JSON profundo e assinatura malformada.

### RF-04 — Alto — Sessão administrativa de 30 dias sem segundo fator demonstrado

**Estado:** confirmado no código; exposição real depende do ambiente.  
**Onde:** `src/lib/auth.ts:15-53`, especialmente `session.expiresIn` de 30 dias; autenticação habilita somente e-mail/senha.  
**Visão do atacante:** uma senha reutilizada, phishing, malware ou cookie roubado oferece uma janela longa de controle sobre o sistema financeiro.  
**Impacto:** leitura/alteração de lançamentos, integrações, cobranças e dados pessoais. Embora o sistema não deva enviar dinheiro, o comprometimento pode adulterar informação e cobranças.  
**Correção:** TOTP/WebAuthn obrigatório para a conta proprietária; sessão ociosa curta e teto absoluto; rotação após login/troca de senha; tela de sessões e revogação global; alertas de novo dispositivo; cookies `HttpOnly`, `Secure` e política SameSite verificada por teste de resposta real.  
**Aceite:** senha isolada não conclui login; cookie expira por inatividade; revogação invalida todas as sessões; flags são confirmadas no HTTPS implantado.

### RF-05 — Médio/Alto — Ausência de política explícita de cabeçalhos no Next.js

**Estado:** confirmado no repositório; o proxy externo pode compensar, mas não foi verificado.  
**Onde:** `next.config.mjs:1-8`.  
**Risco:** não há CSP, `frame-ancestors`, HSTS, Referrer-Policy ou Permissions-Policy definidos pela aplicação. Isso aumenta impacto de XSS, clickjacking e carregamento indevido caso o proxy também não os aplique.  
**Correção:** definir política no ponto único que realmente serve tráfego; CSP sem `unsafe-inline` sempre que possível; HSTS apenas em HTTPS consolidado; impedir framing; adicionar testes de headers.  
**Aceite:** scanner e teste automatizado confirmam headers em todas as respostas HTML e rotas sensíveis.

### RF-06 — Médio — CORS amplo na Evolution e confiança concentrada em uma API key

**Estado:** confirmado na configuração; alcance externo não confirmado.  
**Onde:** `docker-compose.prod.yml:128-134`.  
**Risco:** `CORS_ORIGIN=*` amplia uso por navegadores se a Evolution for publicada acidentalmente. A proteção depende de uma chave estática de alto privilégio.  
**Correção:** manter Evolution apenas em rede privada/loopback; allowlist exata; chave distinta por ambiente/instância, rotação e menor privilégio; bloquear portas no host/firewall.  
**Aceite:** varredura externa autorizada não alcança Evolution/PostgreSQL/Redis; origem não permitida é rejeitada.

### RF-07 — Médio — Middleware verifica presença do cookie, não sua validade

**Estado:** confirmado, com mitigação parcial.  
**Onde:** `src/middleware.ts:23-35`; o layout protegido chama `requireSession`, o que reduz o risco nas páginas.  
**Risco:** um cookie arbitrário passa pelo middleware. Qualquer nova rota adicionada fora do layout protegido pode virar bypass por erro de arquitetura.  
**Correção:** autenticar em cada Server Action/API e adotar teste arquitetural que proíba handlers sensíveis sem `requireSession`/`requireAuthenticatedWorkspace`; não tratar middleware como barreira de autorização.

### RF-08 — Médio — Mensagens internas podem ser devolvidas ao cliente ou registradas em excesso

**Estado:** confirmado em alguns handlers.  
**Onde:** `src/app/api/worker/run/route.ts:29-33` devolve `error.message`; ações de anexos também retornam mensagens capturadas.  
**Impacto:** enumeração de configuração/estrutura interna e dados úteis para exploração.  
**Correção:** resposta externa genérica com correlation ID; detalhe somente em log sanitizado; classificar erros esperados.

### RF-09 — Médio — Validação de anexo confia apenas em MIME e tamanho declarado

**Estado:** confirmado, atualmente mitigado porque o upload está desativado.  
**Onde:** `src/services/attachments-validator.ts:1-20` e `src/server/actions/attachments.ts:23-39`.  
**Risco futuro:** ao habilitar S3/GCS, MIME e tamanho controlados pelo cliente não impedem arquivo disfarçado, polyglot ou confirmação de objeto pertencente a outro recurso.  
**Correção antes de ativar:** magic bytes no servidor, streaming com limite real, nome opaco, antivírus quando aplicável, bucket privado, URL curta, validação de propriedade de `ownerId` e metadados assinados pelo servidor.

## Controles positivos encontrados

- Segredos principais são exigidos pelo Compose de produção e credenciais Mercado Pago usam AES-256-GCM.
- Worker compara segredo em tempo constante.
- Webhook Mercado Pago valida HMAC e janela temporal antes de processar pagamento.
- Serviços e Server Actions observados usam contexto autenticado de workspace.
- PostgreSQL, Redis e Evolution não aparecem publicados diretamente no Compose de produção; a intenção documentada é loopback/proxy autorizado.

## Plano priorizado de correção

1. **P0:** fechar cadastro por padrão e proteger `/api/logs`.
2. **P0:** mover rejeição do webhook para antes de qualquer escrita e limitar corpo/taxa.
3. **P1:** MFA e redução/rotação de sessão; confirmar cookies no HTTPS real.
4. **P1:** headers de navegador e validação de proxy/origem.
5. **P1:** comprovar externamente que somente a aplicação/proxy autorizado está acessível.
6. **P2:** preparar upload seguro antes de habilitá-lo e uniformizar respostas de erro.

## Verificações não realizadas

- Nenhum pentest dinâmico, DAST, brute force, fuzzing, teste de webhook real ou acesso ao servidor.
- Nenhuma credencial, `.env`, banco, dump ou log foi aberto para procurar valores.
- A auditoria de dependências via `pnpm audit` não produziu resultado conclusivo nesta sessão; deve ser repetida em CI com saída preservada e SBOM.
- Não foi comprovado o comportamento do proxy, firewall, TLS, DNS, backup, restauração ou containers ativos.

**Veredito:** não expor diretamente à internet antes dos itens P0. Após correção, executar homologação negativa autorizada e revisão externa do perímetro.
