# Arquitetura de Integração com Mercado Pago — NOVEX Finance

Este documento define a arquitetura, limites e separação de responsabilidades da integração entre o **NOVEX Finance** e as APIs do **Mercado Pago**.

---

## 1. Visão Geral da Arquitetura e Separação de Módulos

A integração é dividida em 4 pilares totalmente desacoplados:

| Pilar | Escopo / Finalidade | Endpoint / Mecanismo Principal | Marco de Implementação |
| :--- | :--- | :--- | :--- |
| **1. Credenciais & Conectividade** | Gestão de Access Tokens Sandbox por Workspace, Criptografia AES-256-GCM, Validação de Conexão. | `GET https://api.mercadolibre.com/users/me` | **Marco 4** (Atual) |
| **2. Cobranças & Pix (Orders API)** | Criação de QR Codes Pix gerados pelo NOVEX, consulta de status e Webhooks de confirmação. | `POST /merchant_orders` / `POST /v1/payments` | Marco 5 |
| **3. Extrato & Movimentações Externas** | Importação de todas as compras, saídas e entradas realizadas na conta Mercado Pago. | Pipeline do Relatório "Dinheiro em conta" (CSV/Report API) | Marco 6 |
| **4. Orquestração em Background** | Disparo periódico de checagem de relatórios, vencimentos e conciliações. | Worker Daemon / BullMQ / Redis | Marco 7 |

---

## 2. Esclarecimento Crítico: Orders API vs. Relatório "Dinheiro em Conta"

> [!IMPORTANT]
> **A API Orders NÃO é um extrato bancário completo.**

1. **Orders API (`/merchant_orders` / `/v1/payments`):**
   - Serve **exclusivamente** para gerenciar cobranças ativamente iniciadas pelo NOVEX (ex: cobrar um devedor via QR Code Pix).
   - Não fornece histórico global de transações realizadas fora do sistema (ex: cartão de débito/crédito usado na rua, transferências PIX recebidas de terceiros diretamente no aplicativo Mercado Pago).

2. **Relatório "Dinheiro em Conta" (Extrato Bancário Completo):**
   - É o mecanismo oficial fornecido pelo Mercado Pago para reconciliação bancária completa.
   - **Fluxo do Pipeline (Marco 6):**
     1. Solicitação da geração de relatório via API de Reports (`/v1/account/settlement_report` ou `bank_report`).
     2. Geração assíncrona do arquivo pelo Mercado Pago.
     3. Download do arquivo CSV/ZIP gerado.
     4. Parsing local e deduplicação estrita via `externalId`.
     5. Gravação das movimentações em `ExternalTransaction`.
     6. Execução do motor de conciliação por score (`Reconciliation`).

---

## 3. Modelo de Credenciais e Segurança (Marco 4)

- **Criptografia Authenticated:** Todo Access Token Sandbox é criptografado via `aes-256-gcm` com IV aleatório de 12 bytes e chave de 32 bytes (`CREDENTIALS_ENCRYPTION_KEY_BASE64`).
- **Validação de Identidade:** Teste de conexão feito estritamente via backend no host oficial `GET https://api.mercadolibre.com/users/me` com timeout de 5 segundos via `AbortController`.
- **Proteção Server-Only:** O token em texto puro nunca é enviado para o navegador, nunca é exibido no HTML após salvo e jamais é registrado em logs ou auditoria.
- **Mascaramento:** O frontend recebe apenas a máscara sanitizada do token (`••••••••••••1234`).
- **Autorização:** Apenas usuários com o papel `OWNER` ou `ADMIN` no Workspace podem salvar, testar, alterar ou desconectar credenciais.
