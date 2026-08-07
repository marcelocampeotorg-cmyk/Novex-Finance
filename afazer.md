# Próximas Tarefas — NOVEX Finance

Este arquivo lista o planejamento detalhado das próximas tarefas e marcos a serem executados na sequência do projeto.

---

## 📌 Estado Atual do Projeto
- [x] **Marco 0:** Fundação, Next.js 14, TypeScript, PostgreSQL, Redis, TailwindCSS, Docker Compose.
- [x] **Marco 1:** Interface navegável, Dark-First NOVEXBR, estatísticas do Dashboard, mock centralizado.
- [x] **Marco 2 & 3:** Autenticação real (Better Auth), sessão em banco, isolamento por Workspace, eliminação do DEMO_WORKSPACE_ID.
- [x] **Marco 4:** Credenciais criptografadas do Mercado Pago (AES-256-GCM), validação de conectividade Sandbox em `https://api.mercadolibre.com/users/me` e tela em Configurações.
- [x] **Marco 5:** Cobranças Pix de Contas a Receber via Orders API (`POST /v1/orders`), QR Code visual em SVG, Pix Copia e Cola, Webhook idempotente e baixa automática.

---

## 🚀 Próximos Marcos (A Fazer)

### 🗓️ Marco 6 — Extrato Bancário, Relatório "Dinheiro em Conta" e Conciliação Automática
- [ ] **Pipeline de Relatório "Dinheiro em Conta":**
  - Integração com a API de Relatórios/Settlement do Mercado Pago para solicitação de extrato bancário.
  - Download e parsing de arquivos CSV de movimentações externas.
- [ ] **Importação e Deduplicação:**
  - Persistência em `ExternalTransaction` com chave única `[integrationAccountId, provider, externalId]`.
- [ ] **Fluxo de Contas a Pagar:**
  - Importação de saídas, compras no cartão e transferências Pix efetuadas diretamente na conta.
- [ ] **Motor de Conciliação Automática por Score:**
  - Auto-match perfeito por TXID / referência única (Score >= 100).
  - Sugestões inteligentes por valor exato + contato (Score = 65).
  - Categorização automática de compras externas por texto.
  - Execução de baixa atômica de Contas a Pagar e criação de lançamentos de caixa (`LedgerEntry` de débito).

---

### 🗓️ Marco 7 — Lembretes Automáticos, Recorrências e Worker Daemon
- [ ] **Worker Daemon de Background:**
  - Orquestrador de tarefas em segundo plano (BullMQ / Redis).
- [ ] **Processamento de Recorrências:**
  - Geração automatizada de ocorrências de despesas e receitas recorrentes (`RecurrenceRule`).
- [ ] **Sistema de Notificações e Lembretes:**
  - Processamento e disparo de avisos de vencimento (`NotificationRule`).
  - Atualização do painel interno de notificações.

---

### 🗓️ Marco 8 — Hardening, Observabilidade e Preparação para Produção
- [ ] **Storage e Anexos:**
  - Upload de comprovantes de pagamento e notas fiscais (`Attachment`).
- [ ] **Segurança e Backup:**
  - Configuração de backups automatizados do PostgreSQL e plano de recuperação de desastres.
  - Configuração de produção Docker com HTTPS, segredos protegidos (Docker Secrets / Secret Manager) e observabilidade.

---

*Gravado em afazer.md para dar continuidade na próxima sessão de trabalho.*
