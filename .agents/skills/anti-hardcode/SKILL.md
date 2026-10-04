---
name: anti-hardcode
description: Diretrizes de arquitetura e governança para separação estrita entre parâmetros comerciais/configuráveis e constantes técnicas legítimas no NOVEX FINANCE. Veta a fixação de credenciais, tokens, telefones, e-mails, URLs e chaves Pix hardcoded em código, documentações e Skills, preservando as fontes de verdade de ambiente e banco de dados.
---

# Configuração Canônica vs Parâmetros Comerciais (Anti-Hardcode) — NOVEX FINANCE

## 1. Princípio Fundamental de Desacoplamento

No desenvolvimento e manutenção do **NOVEX FINANCE**, é expressamente proibido fixar parâmetros dinâmicos, credenciais, URLs ou dados de clientes como se fossem constantes eternas em regras, Skills ou manuais técnicos.

Valores como chaves de API, segredos de webhook, credenciais do Mercado Pago, instâncias da Evolution API, domínios, portas e telefones evoluem conforme o ambiente (desenvolvimento, homologação e produção) e conforme o workspace contratante (no modelo SaaS Multi-Tenant).

---

## 2. Taxonomia de Configurações

### A. Parâmetros Comerciais e Operacionais Dinâmicos (NUNCA Hardcoded)

Estes valores são **dinâmicos**, gerenciados por variáveis de ambiente validadas, pelo banco de dados ou configuráveis via painel:

1. **Credenciais e Segredos:**
   - `AUTH_SECRET`, `WORKER_SECRET`, `CREDENTIALS_ENCRYPTION_KEY_BASE64`, `MERCADO_PAGO_WEBHOOK_SECRET`, `EVOLUTION_API_KEY`.
   - *Regra canônica:* Lido exclusivamente de variáveis de ambiente do servidor com permissão restrita (`600`). Nunca commitado, nunca exposto em frontends, logs ou prints.
2. **URLs e Portas de Rede:**
   - `NEXT_PUBLIC_APP_URL` (`https://finance.novexbr.com.br` em produção).
   - `EVOLUTION_API_URL` (`http://evolution:8080` na rede interna Docker, ou via proxy reverso loopback).
   - `DATABASE_URL` e `REDIS_URL`.
   - *Regra canônica:* Nenhuma URL de host local (`localhost:3000`, `192.168.4.12`) deve estar fixada no código de produção como destino obrigatório.
3. **Dados de Clientes e Workspaces:**
   - Nomes de favorecidos, e-mails, chaves Pix e telefones.
   - *Regra canônica:* Provenientes da sessão ativa e do banco de dados relacional com escopo obrigatório por `workspaceId`.
4. **Instâncias do WhatsApp na Evolution API:**
   - *Regra canônica:* Cada workspace possui sua própria instância dedicada (ex: `ws_<workspaceId>`). Nenhuma instância fixa deve ser assumida globalmente em cenários multi-tenant.

---

### B. Constantes Técnicas Legítimas (Permanecem no Código)

Estes valores representam **invariantes de engenharia, especificações de protocolo ou salvaguardas matemáticas de segurança**:

1. **Criptografia e Segurança:** Tamanho de chave AES-256 (256 bits), nonce GCM (96 bits), SHA-256 para checagem de assinatura de webhooks.
2. **Especificação de Moeda e Precisão:** Valores monetários armazenados em inteiros representando centavos de Real (`amount_cents`), prevenindo erros de ponto flutuante IEEE-754.
3. **Validação de Formatos:** Expressões regulares para validação sintática de CPF, CNPJ, E-mail, Telefone E.164 e Chave Aleatória (UUID) Pix.
4. **Timeouts e Limites de Protocolo:** Timeout padrão de requisições HTTP para Mercado Pago (15-30s), retentativas com backoff exponencial e limite de paginação da API.

---

## 3. Diretriz para o Agente e Desenvolvedores

Ao ler, editar ou auditar código e documentação:
- Se encontrar uma credencial, token, IP privado ou telefone em código ou documentação, sanitize-o imediatamente.
- Se uma funcionalidade precisar de um novo parâmetro de negócio ou de integração, leia-o da camada de configuração/ambiente ou persista no banco relacional.
- Em testes automatizados, utilize mocks de integração ou bancos efêmeros descartáveis; nunca rely em credenciais de produção para testes unitários.
