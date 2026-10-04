---
name: anti-godcode
description: Diretrizes e arquitetura de engenharia para prevenir arquivos monolíticos ("Código Deus"), God Objects e funções infladas com milhares de linhas. Define fronteiras de responsabilidade única (SRP), desacoplamento por domínio, isolamento de efeitos colaterais e contratos claros entre módulos sem fragmentação excessiva no NOVEX Finance. Usar ao planejar, desenvolver, refatorar ou auditar arquivos e módulos extensos.
---

# Modularidade e Prevenção de Código Deus (Anti-God Code) — NOVEX Finance

## 1. O Problema do "Código Deus" (God Class / God File)

Concentrar todas as regras de negócio, rotas de API, Server Actions, persistência em banco, chamadas de rede externas e regras de interface em um único arquivo de milhares de linhas gera uma armadilha crítica de software:
1. **Fragilidade Extrema:** Qualquer alteração ou refatoração pontual (ex: um ajuste em um cálculo de juros ou parâmetro de webhook) tem alto risco de quebrar fluxos não relacionados dentro do mesmo arquivo monolítico.
2. **Impossibilidade de Testes Granulares:** Quando o estado interno está todo acoplado em um único módulo gigante, testes unitários se tornam lentos, instáveis e propensos a efeitos colaterais silenciosos.
3. **Complexidade Ciclomática e Bugs Ocultos:** Módulos que acumulam mais de 1.000 a 2.000 linhas escondem fluxos assíncronos não gerenciados, loops desnecessários e concorrência descontrolada.

---

## 2. Princípio do Equilíbrio: Nem Monólito Nem Fragmentação Fútil

> [!IMPORTANT]
> **A regra de ouro:** Não quebrar arquivos apenas por métrica cosmética de linhas, e **NUNCA** permitir que um único arquivo assuma o papel de "deus" do sistema. A separação deve ser guiada estritamente por **Coesão e Domínio de Negócio**.

### O que NÃO fazer:
* ❌ Não criar arquivos minúsculos com 10 a 20 linhas para cada funçãozinha trivial (over-engineering que polui a árvore de diretórios).
* ❌ Não criar classes wrapper vazias que só repassam parâmetros.
* ❌ Não deixar um arquivo acumular mais de 3 ou 4 responsabilidades arquiteturais distintas (ex: rotas HTTP + persistência SQL + conexão com Mercado Pago + envio de WhatsApp + renderização de UI).

### O que FAZER (Arquitetura Saudável):
* ✅ Manter módulos coesos com escopo bem delimitado (responsabilidade única de domínio).
* ✅ Separar camada de transporte (Next.js Routes/Actions) da camada de execução (Serviços de Domínio) e da camada de persistência (Prisma / Ledger).
* ✅ Funções puras para cálculos monetários, pontuação de reconciliação e regras de categorização (sem efeitos colaterais globais).

---

## 3. Matriz de Responsabilidades do NOVEX Finance

Ao criar ou expandir código no projeto, respeite rigorosamente a fronteira de cada camada:

| Camada / Módulo | Responsabilidade Exclusiva | O que NUNCA deve conter |
| :--- | :--- | :--- |
| **Persistência / Banco (`server/db.ts`, Prisma)** | Conexão Prisma, migrações determinísticas, integridade referencial e auditoria transacional. | Lógica de scraping de webhook ou chamadas HTTP externas. |
| **Integração Mercado Pago (`integrations/mercado-pago/`)** | Clientes HTTP com timeout, autenticação OAuth/Token, requisições de relatórios (Dinheiro em Conta e Liberações) e Orders API Pix. | Decisão de baixa contábil sem evidência ou manipulação de interface. |
| **Integração Evolution API (`integrations/evolution-api/`)** | Chamadas REST para instâncias do WhatsApp, envio de mensagens e tratamento de status de entrega. | Cálculos de saldo bancário ou persistência de dados fora do domínio de mensageria. |
| **Motor de Reconciliação (`reconciliation-service.ts`)** | Cálculo de score de vínculo, correspondência de TXID/valor/data e categorização textual. | Requisições HTTP diretas a provedores externos ou emissão de cobranças. |
| **Motor de Ledger e Saldo (`financial-balance.ts`, `balance-service.ts`)** | Lançamentos de partidas dobradas, cálculo de saldo oficial ancorado e histórico imutável. | Alterações silenciosas de saldo sem transação correspondente. |
| **Server Actions (`server/actions/`)** | Validação de sessão/workspace autenticado (auth-context), validação Zod de entrada e orquestração de serviços. | Cálculos financeiros complexos soltos sem modelo de domínio. |
| **Interface / Componentes (`src/app/`, `src/components/`)** | Apresentação visual, formulários com React Hook Form, estados visuais e PWA. | Consultas diretas ao banco de dados ou bypass da camada de serviço. |

---

## 4. Checklist Anti-Código Deus para o Desenvolvedor e o Agente

Antes de salvar um arquivo ou ao notar que um módulo está ultrapassando limites saudáveis:

1. **Teste da Responsabilidade Única (SRP):**
   * *Consigo resumir o propósito deste arquivo em uma única frase clara sem usar a palavra "E"?*
   * Se a resposta for "Este arquivo gerencia as transações, E processa o CSV, E sincroniza o Mercado Pago, E gerencia regras de contraparte", o arquivo virou Código Deus. Isole as funções auxiliares em serviços dedicados.

2. **Isolamento de Funções Numéricas e de Negócio:**
   * Funções de cálculo de saldo, parcelas e indexação devem ser puras, determinísticas e fáceis de testar:
     ```typescript
     export function calculateNextInstallmentDate(baseDate: Date, frequency: Frequency, sequence: number): Date { ... }
     ```

3. **Prevenção de Efeitos Colaterais Acoplados:**
   * Se a indisponibilidade da Evolution API puder abortar o salvamento de um lançamento no banco, **o código está perigosamente acoplado**.
   * Notificações e envios externos devem ser desacoplados ou executados de forma defensiva com tratamento explícito de falhas.
