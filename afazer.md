# Registro de Estado e Tarefas — NOVEX Finance

> [!WARNING]
> **CONTEXTO PARA A PRÓXIMA SESSÃO (LEIA PRIMEIRO):**
> 1. **As correções de hoje NÃO foram eficientes.** O usuário relatou que a tela continuou travada nos menus e carregando infinitamente.
> 2. O saldo exibido continua incorreto em relação ao saldo real do Mercado Pago (Sandbox). A API do Sandbox retorna `Forbidden` para saldo, então o sistema está calculando a soma das transações importadas, o que divergiu do saldo real esperado pelo usuário.
> 3. A transação "antes das 18h" (`Venda #55445`) *foi* salva no banco (ID 172758033014), mas como a tela (React) estava travada devido a um loop no `window.addEventListener("focus")`, ela não apareceu no Dashboard para o usuário. 
> 4. Uma tentativa de correção com `useRef` foi feita no `page.tsx` para evitar o loop, mas o usuário finalizou a sessão reportando ineficiência. Amanhã, a primeira coisa a fazer é reavaliar o sync automático do Dashboard e encontrar uma maneira melhor de exibir/lidar com o saldo do Sandbox.

---

## 📌 Histórico de Tarefas Concluídas & Entregues

- [x] **Compilação & Hardening do Next.js 14:**
  - Server actions assíncronas tratadas e limpas de warnings.
  - Testes unitários e typecheck 100% aprovados (`npx tsc --noEmit`).

- [x] **Contas, Favorecidos e Chaves Pix:**
  - Limpeza de dados mock genéricos.
  - Favorecido livre (`contactName`) e campo de Chave Pix (`pixKey`) no `NewAccountModal.tsx`.
  - Novas categorias: "Pessoal", "Devedor Pagar" e "Devedor Receber".

- [x] **Recurso de Exclusão de Registros:**
  - Botão "Excluir / Apagar esta Conta" em `AccountDetailsDrawer.tsx` e exclusão direta no `financial-store.ts`.

- [x] **Integrações (Mercado Pago & Evolution API WhatsApp):**
  - Credenciais Sandbox/Produção no painel de configurações.
  - Evolution API mapeada para a porta **8081** no Docker Compose (`novexfinance`).

- [x] **Sincronização Automática & Indicadores do Dashboard:**
  - Auto-sync disparado automaticamente ao abrir o painel.
  - Animação de rotação com duas setas (`RefreshCw className="animate-spin"`) e exibições fiéis do status de sincronização real.

---

*Todas as tarefas anteriores foram validadas e concluídas com sucesso.*

