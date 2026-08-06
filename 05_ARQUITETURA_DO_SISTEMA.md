# 05 — Arquitetura do sistema

## Escolha arquitetural

Aplicação modular em um único repositório, sem microserviços prematuros, com dois processos executáveis:

- **web**: interface, API, autenticação e webhooks;
- **worker**: filas, sincronização, conciliação, recorrências e lembretes.

## Stack recomendada

- Next.js com App Router;
- TypeScript strict;
- PostgreSQL;
- Prisma ORM;
- Tailwind CSS;
- shadcn/ui;
- biblioteca de gráficos compatível com React;
- Redis;
- BullMQ ou fila open source equivalente;
- biblioteca de autenticação madura para Next.js, sem implementar criptografia manualmente;
- Argon2id para senhas, quando aplicável;
- Zod para validação;
- Docker e Docker Compose;
- testes unitários, integração e end-to-end.

Não fixar versões sem verificar compatibilidade atual no momento da instalação.

## Camadas

```text
src/
  app/                    rotas e páginas
  components/             UI reutilizável
  features/               funcionalidades por domínio
  domain/                 entidades, regras e contratos
  application/            casos de uso
  infrastructure/         Prisma, filas, storage, provedores
  integrations/
    mercado-pago/         adapter do Mercado Pago
  jobs/                   tarefas do worker
  lib/                    utilitários compartilhados
  test/                   factories e helpers
```

## Módulos de domínio

- identity;
- workspaces;
- contacts;
- financial-items;
- installments;
- recurring-rules;
- external-transactions;
- reconciliation;
- charges;
- ledger;
- categories;
- notifications;
- attachments;
- integrations;
- audit.

## Provider Adapter

A integração externa deve ficar atrás de uma interface com capacidades explícitas:

```text
connectAccount()
refreshCredentials()
getCapabilities()
getBalance()
listTransactions(cursor, range)
createPixCharge(input)
getPayment(externalId)
verifyWebhook(headers, body)
getReceipt(externalId)       opcional
```

A aplicação não deve chamar SDK Mercado Pago diretamente em componentes ou rotas de UI.

## Eventos internos

Exemplos:

- `external_transaction.imported`
- `pix_charge.created`
- `payment.approved`
- `installment.matched`
- `installment.settled`
- `unplanned_expense.created`
- `recurring_occurrence.generated`
- `reminder.due`

Os eventos não precisam virar uma plataforma de event sourcing. Servem para desacoplar jobs e auditoria.

## Multiusuário futuro

- Criar `Workspace` e `Membership` desde o início.
- O primeiro usuário recebe um workspace pessoal.
- Todas as consultas filtram por `workspace_id`.
- Nunca confiar em `workspace_id` enviado pelo cliente sem validar a sessão.
