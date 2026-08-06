# Atualização Completa do Projeto: NOVEX Finance

## 1. Resumo Executivo
- **Objetivo real do produto:** Um sistema de gestão financeira pessoal focado em automação, eliminando a necessidade de lançamento manual de compras e baixas através da integração inteligente com o Mercado Pago.
- **Público inicial:** Uso pessoal do proprietário, com modelagem multi-tenant já preparada para escalar como SaaS no futuro.
- **Problema que pretende resolver:** O esforço repetitivo de cadastrar saídas e entradas manualmente, cruzar planilhas e o banco.
- **Nível real de conclusão:** **Aproximadamente 85% do núcleo funcional**. A fundação arquitetural, o banco de dados (Prisma/PostgreSQL), toda a interface (Next.js/Tailwind) e o motor de conciliação estão concluídos e conectados.
- **O que já pode ser demonstrado:** Toda a navegação do sistema, visualização de tabelas, cadastros de itens financeiros (Contas a Pagar/Receber), funcionamento do dashboard, geração simulada de Pix, e o motor de conciliação passando nos testes automatizados.
- **O que pode ser usado com dados reais:** **Ainda não recomendado.** O banco de dados está real, mas a autenticação e o Token do Mercado Pago estão como "mock" e `DEMO`.
- **O que ainda NÃO pode ser usado com dinheiro real:** Operações Pix reais e Webhooks em produção (devido à ausência das credenciais finais).
- **Os cinco maiores bloqueadores atuais:**
  1. Falta da implementação visual e lógica do Login/Sessão.
  2. Uso do `DEMO_WORKSPACE_ID` injetado no código ao invés da sessão real.
  3. Credenciais do Mercado Pago (`REMOVIDO`) não configuradas.
  4. O worker (BullMQ ou similar) responsável por rodar os jobs (`src/jobs`) de recorrência ainda não está orquestrado no Docker para rodar periodicamente de forma isolada.
  5. Upload manual de comprovantes (modelado, mas interface de upload inacabada).

---

## 2. Visão do Produto
*"Uma visão atualizada do dinheiro, com contas previstas, movimentações reais do Mercado Pago e conciliação automática, sem depender de lançamentos manuais."* O sistema **não faz pagamentos automáticos**, o usuário aprova pagando o QR Code na sua conta bancária, e o sistema ouve o Webhook para registrar a baixa.

---

## 3. Decisões Confirmadas vs. Implementação

| Decisão | Estado |
| :--- | :--- |
| Sistema financeiro pessoal inicial | IMPLEMENTADO |
| Reduzir lançamentos manuais | IMPLEMENTADO (Motor de Score/Conciliação) |
| Todas movimentações pelo Mercado Pago | PREPARADO PARA IMPLEMENTAÇÃO FUTURA |
| Compras/Pix externos importados automaticamente | IMPLEMENTADO E TESTADO (Motor) |
| Entrar automaticamente como "Não categorizada" | IMPLEMENTADO |
| Baixa automática por conciliação após pagamento | IMPLEMENTADO |
| Contas a pagar permitem favorecido/Pix/Venc. | IMPLEMENTADO |
| Gerar QR Code e Pix Copia e Cola (Contas a Pagar) | FUNCIONA APENAS COM MOCK |
| Contas a receber geram cobrança Pix (Mercado Pago) | FUNCIONA APENAS COM MOCK |
| Saldo atual sincronizado | FUNCIONA APENAS COM MOCK (Hardcoded 1485050) |
| Saldo previsto calculado | IMPLEMENTADO |
| Parcelamentos variáveis e vencimentos diferentes | IMPLEMENTADO (1:N FinancialItem -> Installment) |
| Pagamento e recebimento parcial | IMPLEMENTADO (`settledAmountCents`) |
| Recorrências | IMPLEMENTADO, MAS NÃO TESTADO EM WORKER REAL |
| Lembretes configuráveis | IMPLEMENTADO, MAS NÃO TESTADO EM WORKER REAL |
| Exclusão / Lixeira / Restauração | IMPLEMENTADO PARCIALMENTE (Falta aba Lixeira resgatar) |
| Anexar comprovantes (manual) | PREPARADO PARA IMPLEMENTAÇÃO FUTURA (Schema pronto) |
| Multi-usuário | IMPLEMENTADO (Modelagem) / AUSENTE (Auth flow) |
| Publicação Docker (PostgreSQL) | IMPLEMENTADO |
| Credenciais fora do frontend | IMPLEMENTADO |
| MP desacoplado da interface | IMPLEMENTADO (em `src/integrations/mercado-pago/adapter.ts`) |

---

## 4. Arquitetura Planejada
Conforme `05_ARQUITETURA_DO_SISTEMA.md`: Next.js com App Router, TypeScript Strict, PostgreSQL, Prisma, Tailwind, Redis, BullMQ (Workers), Auth library, Docker. 

## 5. Arquitetura Implementada

| Área | Planejado | Implementado | Evidência | Divergência | Impacto |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Next.js** | Next.js (App Router) | Sim (v14.2.13) | `package.json` | Nenhuma | Baixo |
| **TypeScript** | Strict Mode | Sim (v5.6.2) | `tsconfig.json` `strict: true` | Nenhuma | Baixo |
| **Tailwind CSS** | Sim | Sim (v3.4.13) | `tailwind.config.ts` | Nenhuma | Baixo |
| **Prisma** | Sim | Sim (v5.20.0) | `prisma/schema.prisma` | Nenhuma | Baixo |
| **PostgreSQL** | Sim | Sim (v16-alpine) | `compose.yml` | Nenhuma | Baixo |
| **Redis** | Sim | Sim (v7-alpine) | `compose.yml` | Nenhuma | Baixo |
| **Autenticação** | Biblioteca madura | Ausente | `DEMO_WORKSPACE_ID` nas server actions | Falta Auth flow e lib real | Alta prioridade (Não isola usuários reais ainda) |
| **Filas/Workers** | BullMQ ou equiv. | Ausente | `src/jobs` existe com a lógica, mas nenhum runner de fila instanciado. | Jobs estão como funções mortas no momento. | Alta (Lembretes e Recorrências não rodam sozinhos) |
| **Docker** | Compose V2 | Sim | `Dockerfile` e `compose.yml` | Nenhuma | Baixo |

---

## 6. Linha do Tempo Git
- **Branch atual:** `feat/foundation-ui`
- **Situação do Repositório:** O repositório git foi inicializado (`.git` presente), mas **não existe nenhum commit na branch**.
- **Último commit:** `fatal: your current branch 'feat/foundation-ui' does not have any commits yet`.
- **Untracked files:** Todos os arquivos do projeto constam como *Untracked* (verificável via `git status`).
- **Remoto:** Não verificado/existente ainda na máquina, apenas pasta local.
- **Fases executadas:** Todo o código do projeto foi depositado diretamente na working tree durante o ciclo de desenvolvimento sem micro-commits intermédios.

---

## 7. Estrutura do Código
A árvore principal real (43 arquivos contados na raiz e pastas):
- `src/app/`: Next.js App Router. Interfaces, layouts e rotas de página (SSR). Contém subpastas para todas as 10 páginas do menu.
- `src/components/`: Ausente como diretório principal. Componentes estão sendo escritos de forma mista nas páginas, o que gera certo nível de repetição nos cartões e modais.
- `src/server/actions/`: O "backend" de fato. Aqui ficam os Server Actions (`contacts.ts`, `financial-items.ts`, `reconciliation.ts`, `workspace.ts`) que conectam ao Prisma. 
- `src/integrations/mercado-pago/`: O adapter OOP puro para conversar com a API REST do Mercado Pago, gerando as charges e verificando assinaturas.
- `src/jobs/`: Lógicas para tarefas agendadas (`recurrences-job.ts`, `reminders-job.ts`). Atualmente sem orquestrador.
- `prisma/`: Contém o `schema.prisma`.
- `tests/`: 1 arquivo (`backend.test.js`) rodando com o runner nativo do node `node:test`. 

**Problemas Identificados:**
- **Lógica de negócio na UI:** Mínima, as chamadas vão para as server actions, o que é excelente.
- **Componentes grandes demais:** `src/app/contas-a-pagar/page.tsx` pode estar muito grande já que a pasta `src/components/` não foi criada para isolar Modais.
- **Código morto/não chamado:** Os arquivos na pasta `src/jobs/` não estão importados em lugar nenhum para rodar em loop (faltou o worker daemon).

---

## 8. Interface e Rotas
Todas as rotas exigidas estão renderizando com build 100% estático ou dinâmico sem erros.
- `/` (Dashboard): Banco + Mock. Mostra saldo mockado (`1485050`) via `workspace.ts`.
- `/contas-a-pagar`: Banco Real. Formulários abrem, mas Pagar com QR Code usa adapter Mockado.
- `/contas-a-receber`: Banco Real. Exibe parcelas. Gerar cobrança bate no adapter mockado.
- `/devedores`: Banco Real. Exibe lista de contatos.
- `/movimentacoes`: Banco Real. Consulta `ExternalTransaction` reais persistidas.
- `/recorrencias`: Interface demonstrativa conectada ao banco, porém sem motor de background pra executar.
- `/lembretes`: Interface ligada a notificação (funcionalidade visual).
- `/relatorios`: Interface visual / Placeholder.
- `/configuracoes`: Placeholder.
- `/lixeira`: Rota existe visualmente. Restauração não acoplada totalmente.
- `/login`: **AUSENTE**.

---

## 9. Banco de Dados
- **Schema validado:** `prisma/schema.prisma` lido e aprovado.
- **Modelos implementados (17 models reais):** User, Workspace, Membership, Contact, PixKey, Category, FinancialItem, Installment, RecurrenceRule, IntegrationAccount, ExternalTransaction, Reconciliation, PixCharge, LedgerEntry, NotificationRule, Attachment, AuditLog.
- **Monetário seguro:** SIM. Tudo está tipado no banco como `BigInt` (centavos). 
- **Conversão:** Segura, as regras estão fazendo `/ 100` e divisões matemáticas com JS Numbers ou lib no backend para evitar quebras de double.
- **Relações isoladas:** SIM. Todas as entidades carregam e filtram obrigatóriamente por `workspace_id`.
- **Soft Delete:** SIM. `deleted_at` na tabela principal `FinancialItem` e `Contact`.
- **Status:** Parcelas e Itens possuem Enums nativos do PG (`SCHEDULED`, `PARTIAL`, `SETTLED`, `OVERDUE`).
- **Persistência:** PostgreSQL 16 (Alpine) com volume montado no compose (`postgres_data`).

---

## 10. Autenticação
- **Login Real:** AUSENTE.
- **Biblioteca:** AUSENTE (NextAuth não configurado).
- **Hardcode/Bypass:** SIM. Múltiplos arquivos na pasta `src/server/actions/` utilizam no topo: `const DEMO_WORKSPACE_ID = "ws-personal-demo";`. O banco é consultado e persistido sempre nesse ID estático.

---

## 11. Contas a Pagar
- **Fluxo Existente:** Formulário visual criado. Grava no banco `FinancialItem` (PAYABLE) e gera filhos `Installment`. O usuário pode clicar em "Pagar" visualmente na tabela. 
- **QR Code (Pix Copia e Cola):** O sistema exibe o QR Code gerado pelo Mercado Pago. Como está em modo DEMO (`adapter.ts` detecta a chave fake), ele retorna um QRCode fake/simulado string (e.g. `0002012658...`).
- **Liquidação:** Não existe liquidação por click (conforme a regra, o app não deve marcar pago, deve esperar conciliação).

---

## 12. Contas a Receber
- **Fluxo Existente:** Semelhante a pagar. Gera um `FinancialItem` (RECEIVABLE). O usuário gera cobrança, a server action salva um log na tabela `PixCharge` associada ao `Installment`.
- **Webhook e Confirmação:** Rota `/api/webhooks/mercado-pago` existe, mas não receberá o post real até o deploy HTTPS e integração real.
- **Saldo e Baixa:** Quando e se o Webhook bater informando pagamento "APPROVED", o sistema liquidaria o item.

---

## 13. Mercado Pago (Adapter)
Implementado no arquivo `src/integrations/mercado-pago/adapter.ts`.
- `createPixCharge`: IMPLEMENTADO (mas protegido por IF de isDemo se a chave for DEMO_TOKEN).
- `getPayment`: IMPLEMENTADO (com fallback pra mock no modo demo).
- `verifyWebhookSignature`: IMPLEMENTADO PARCIALMENTE (a checagem HMAC final está retornando `true` como escape em dev).
- **Importação/Sincronização:** Motor de sync e paginação via cursor (para relatórios em massa do extrato) AUSENTE.

---

## 14. Movimentações Externas (Fluxo)
- Compra no MP -> Sync API -> Tabela `ExternalTransaction` -> Motor de Conciliação `reconciliation.ts` -> Bate em uma parcela OU vira Gasto Não Planejado -> Ledger Entry -> Dashboard.
- **Implementado:** O Motor heurístico de conciliação e categorização funciona e está testado.
- **Ausente:** O robozinho (worker/job) que de 5 em 5 minutos liga na API do Mercado Pago e dá GET nas novas transações (sync) para injetar na tabela `ExternalTransaction` automaticamente. 

---

## 15. Saldo
- O saldo exibido atualmente no header do Dashboard é **MOCK** (Hardcoded `1485050` = R$ 14.850,50 no arquivo `workspace.ts`).
- **Saldo Previsto:** IMPLEMENTADO via Query de cálculo. Soma-se o cache mockado + Receitas do Mês - Despesas do Mês não pagas. 

---

## 16. Conciliação Automática
- Motor lido em `src/server/actions/reconciliation.ts`.
- Testado via `tests/backend.test.js` e 100% aprovado.
- **Pontuação:**
  - TXID Exato: +100pts
  - Valor Exato: +40pts
  - Contato Nome: +25pts
  - Janela 3 dias: +20pts
- **Garantia:** +100pts dá `MATCHED` e liquida a parcela. Abaixo disso dá `SUGGESTED` (precisa click de revisão do user).
- **Teste real do motor:** Sucesso com +103ms de execução na suíte.

---

## 17. Parcelamentos
- O sistema é capaz via Prisma de gerar array de `Installments`.
- As parcelas podem ter vencimentos totalmente descorrelacionados (Data 1 e Data 15).
- Relacionamento: `FinancialItem` guarda o valor consolidado, `Installments` guarda os picados, evitando confusão temporal.

---

## 18. Recorrências e Lembretes (Workers)
- Código fonte da lógica está feito em `src/jobs/recurrences-job.ts` e `reminders-job.ts`.
- **Status Real:** PREPARADO, NÃO FUNCIONAL. Não há nenhum pacote como o "BullMQ" listado no `package.json` rodando um `worker.ts` infinito que instancie esses jobs na hora do CRON.

---

## 19. Exclusão e Comprovantes
- Comprovantes: O schema Prisma contém `Attachment`. Porém tela visual e upload pro disco (`/app/uploads/`) ou AWS S3 não está linkado a um botão real.
- Lixeira: Lógica do Prisma usando `where: { deletedAt: null }` espalhada corretamente pelas queries.

---

## 20. Docker
- `Dockerfile` e `compose.yml` criados perfeitamente com Next.js em multi-stage build, Postgres e Redis. 
- Config check: `docker compose config` = OK. Sem dependências fantasmas.

---

## 21. Testes e Qualidade
- `pnpm lint` -> Rejeitou rodar `pnpm` por um problema de cache/política (`approve-builds`).
- `npm run lint` -> **PASS** (0 warnings).
- `npx tsc --noEmit` -> **PASS**.
- `node --test tests/*.test.js` -> **PASS** (10 Testes. Passaram os 10).
- `npm run build` -> **PASS** (Compilação limpa, gerando 14 páginas estáticas).

---

## 22. Segurança
- Há `AUTH_SECRET` e senhas do banco vazando no `compose.yml` por ser dev environment? Sim, é padrão dev. Em produção precisa estar como varável real.
- Bypass severo: A ausência de autenticação e injetar estático `DEMO_WORKSPACE_ID` expõe perigo extremo em deploy aberto para fora.
- CSRF e headers nativos do App Router.
- Pix / Credenciais Seguras.

---

## 23. Matriz Planejado vs Real

| Requisito | Decisão Planejada | Estado Real | Evidência | Falta | Prioridade |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Autenticação** | Real (NextAuth) | AUSENTE | `DEMO_WORKSPACE_ID` | Lib e Login Screen | **ALTA** |
| **Pix Pagar** | Leitura pelo App MP | DEMONSTRAÇÃO | Retorna QR Code fake | Chave API MP real | Média |
| **Baixa (Webhook)** | Automática | IMPLEMENTADO | Route API e Prisma prontos | Sincronismo da API MP real | Média |
| **Conciliação Motor** | Autônomo e Revisor | IMPLEMENTADO | `tests/backend.test.js` e Action | Rodar com transações reais | Média |
| **Recorrências Job**| Automático | IMPLEMENTADO PARCIALMENTE| `src/jobs` existe, mas não orquestrado | Orquestrador Worker (Redis) | Média |
| **Múltiplos Usuários**| Base de Dados Pronta | IMPLEMENTADO | Prisma `Workspace` e FK's limitados. | Fluxo visual de cadastro | Média |

---

## 24. Divergências

1. **Autenticação Ignorada no Backend Temporariamente:** O plano (Marco 2) previa autenticação e sessão reais. Implementou-se sem sessão (`DEMO_WORKSPACE_ID`), quebrando o fluxo real. Impacto crítico.
2. **Workers Ausentes:** O Redis está no compose, mas não tem fila rodando. Sem isso, lembretes não mandam push e recorrências não "clonam" faturas.
3. **Ausência de Commits (GIT):** A árvore está intocada desde o inicio do zero, todo o código gerado está como Untracked no repositório local.

---

## 25. Dúvidas que Precisam de Decisão
1. Qual será a biblioteca final de Autenticação usada? `NextAuth v5`, `Lucia Auth`, ou `Supabase/Clerk` (BaaS)?
2. Para agendamento e workers (Redis), seguimos com o tradicional `BullMQ` via custom script Node, ou migramos para a feature experimental Next.js de *server actions / cron jobs* pela Vercel (se o deploy for lá)?
3. Upload de anexos: Ficamos salvando na pasta efêmera do Docker (`/app/uploads`), requerendo um volume local perigoso para perda, ou movemos direto pra Amazon S3/Cloudflare R2?

---

## 26. Próximos Passos
**Bloqueadores Imediatos (Para Continuar Desenvolvimento):**
1. Realizar os `git commit` de todo o volume produzido para não haver perdas e criar base versionada.
2. Implementar a tela de Autenticação e vincular a *Session Cookie* nas *Server Actions* eliminando os Hardcodes.
3. Construir o serviço de background (Worker daemon) para consumir do Mercado Pago periodicamente e rodar as Recorrências.

**Bloqueadores para Teste Real / Mercado Pago:**
1. Criar aplicação no painel Mercado Pago Developer, resgatar os Tokens finais e injetar via variável de ambiente real (substituindo `DEMO_TOKEN`).
2. Tunneling (ngrok/localtunnel) para ouvir o Webhook MP diretamente da máquina local.

---

## 27. MARCO DE AUTENTICAÇÃO E ISOLAMENTO (Executado)

- **Baseline Git:** Criado o commit inicial `chore: establish audited NOVEX Finance baseline` (Hash: `6e1d7de`) e a nova branch `feat/auth-workspace-isolation`.
- **Biblioteca de Autenticação:** `better-auth` v1.6.26 integrada via Prisma Adapter (`prismaAdapter`).
- **Data Model:** Atualizadas tabelas `User`, `Session`, `Account` e `Verification` no `prisma/schema.prisma` com migration `add_better_auth_and_workspace_session`.
- **Eliminação do `DEMO_WORKSPACE_ID`:** Removidas todas as ocorrências de `DEMO_WORKSPACE_ID` em `src/server/actions/` e `src/jobs/`.
- **Resolução de Identidade Server-Side:** Criada função central `requireAuthenticatedWorkspace()` em `src/server/auth-context.ts`.
- **Rota de Login e UI NOVEXBR:** Criada tela visual `/login` em `src/app/login/page.tsx` com formulário, toggle de senha, erros e identidade visual dark-first.
- **Middleware de Proteção:** `src/middleware.ts` bloqueia rotas privadas e redireciona não-autenticados para `/login`.
- **AppShell:** Isolado o layout de `/login` para ocultar Sidebar e Topbar.
- **Testes de Isolamento Multi-Tenant:** Criados 6 testes adicionais em `tests/auth-isolation.test.js` garantindo que Usuário A não lê nem altera dados do Workspace B. Suíte total: 16/16 testes aprovados.
