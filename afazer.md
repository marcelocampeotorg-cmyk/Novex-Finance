# Próximas Tarefas — NOVEX Finance

Este arquivo registra o estado atual do projeto e o planejamento para continuidade na próxima sessão.

---

## 📌 Estado Atual do Projeto & Ajustes Recentes

- [x] **Compilação & Hardening do Next.js 14:**
  - `reconciliation.ts` e `recurrence.ts` com funções `async` nas Server Actions (0 erros de compilação).
  - 48/48 testes unitários passando em `npm test`.
  - Typecheck 100% limpo em `npx tsc --noEmit`.

- [x] **Contas, Favorecidos e Chaves Pix:**
  - Limpeza de dados genéricos de demonstração em `src/mocks/financial-data.ts`.
  - Campo de digitação livre de nome do favorecido (`contactName`) e campo de **Chave Pix** (`pixKey`) no `NewAccountModal.tsx`.
  - Novas categorias adicionadas: **"Pessoal"**, **"Devedor Pagar"** e **"Devedor Receber"**.

- [x] **Recurso de Exclusão de Registros:**
  - Botão **"Excluir / Apagar esta Conta"** adicionado no rodapé da gaveta de **Detalhes (Histórico de Auditoria)** em `AccountDetailsDrawer.tsx`.
  - Ações diretas de exclusão (🗑️) integradas em Contas a Pagar, Contas a Receber e Devedores via `financial-store.ts`.

- [x] **Integrações (Mercado Pago & Evolution API WhatsApp):**
  - Mercado Pago com suporte a Public Key e Access Token de Sandbox, com atualização dinâmica de saldo no Dashboard (R$ 14.850,50) quando conectado.
  - Evolution API configurada para apontar diretamente para a porta **8081** do container Docker `evoapicloud` (`http://localhost:8081`).
  - `docker-compose.yml` nomeado especificamente com `name: novexfinance` (`novexfinance-app`, `novexfinance-db`, `novexfinance-evolution`, `novexfinance-redis`).

---

## 📋 Para Continuar na Próxima Sessão:

1. Iniciar os testes com credenciais reais da Evolution API e Mercado Pago no painel de Configurações.
2. Inserir lançamentos reais no formulário de Nova Conta / Compromisso.
3. Dar continuidade às melhorias e novas funcionalidades solicitadas pelo usuário.

*Estado atual gravado com sucesso para a próxima sessão.*
