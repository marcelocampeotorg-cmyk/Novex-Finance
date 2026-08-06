# 06 — Modelo de dados

## Convenções

- IDs UUID.
- Valores monetários em centavos (`BIGINT`) e moeda `BRL` na V1.
- Horários armazenados em UTC.
- Exibição padrão `America/Sao_Paulo`.
- Soft delete com `deleted_at` quando aplicável.
- Campos de auditoria: `created_at`, `updated_at`, `created_by`.
- Índices por `workspace_id`, datas, status e identificadores externos.

## Entidades principais

### User

- id
- email único
- password_hash ou vínculo da biblioteca de autenticação
- name
- timezone
- locale
- status

### Workspace

- id
- name
- type: PERSONAL ou ORGANIZATION
- owner_user_id

### Membership

- workspace_id
- user_id
- role

### Contact

- id
- workspace_id
- name
- type: PERSON ou COMPANY
- document opcional
- email, phone
- relationship flags
- notes
- archived_at, deleted_at

### PixKey

- id
- contact_id
- type: CPF, CNPJ, EMAIL, PHONE, RANDOM
- value criptografado quando necessário
- label
- is_default
- verified_at opcional

### Category

- id
- workspace_id
- name
- direction: EXPENSE, INCOME ou BOTH
- icon
- color token
- parent_id opcional
- system flag

### FinancialItem

Registro pai de uma obrigação ou direito.

- id
- workspace_id
- direction: PAYABLE ou RECEIVABLE
- kind: ONE_TIME, INSTALLMENT_PLAN, RECURRING
- title
- description
- contact_id
- category_id
- total_amount_cents
- start_date
- status: DRAFT, ACTIVE, COMPLETED, CANCELED
- recurrence_rule_id opcional
- source: USER, IMPORT, SYSTEM
- deleted_at

### Installment

- id
- financial_item_id
- sequence
- amount_cents
- due_date
- paid_amount_cents ou received_amount_cents
- status: SCHEDULED, PARTIAL, SETTLED, OVERDUE, CANCELED
- selected_pix_key_id opcional
- settlement_date opcional
- unique_reference

### RecurrenceRule

- id
- workspace_id
- frequency
- interval
- day_of_month opcional
- starts_at
- ends_at opcional
- next_run_at
- timezone
- active

### IntegrationAccount

- id
- workspace_id
- provider: MERCADO_PAGO
- external_account_id
- display_name
- encrypted_credentials
- capabilities JSON
- status
- last_sync_at

### ExternalTransaction

Registro imutável importado do provedor.

- id
- workspace_id
- integration_account_id
- provider
- external_id
- direction: CREDIT ou DEBIT
- type
- status
- amount_cents
- fee_cents
- net_amount_cents
- occurred_at
- counterpart_name opcional
- counterpart_document opcional
- txid opcional
- description
- raw_reference
- provider_payload redigido ou criptografado
- imported_at

Restrição única: `(integration_account_id, provider, external_id)`.

### Reconciliation

- id
- workspace_id
- external_transaction_id
- installment_id opcional
- financial_item_id opcional
- status: UNMATCHED, SUGGESTED, MATCHED, IGNORED, REVERSED
- score
- reasons JSON
- matched_by: SYSTEM ou USER
- matched_at
- reversed_at

### PixCharge

- id
- workspace_id
- installment_id
- provider
- external_charge_id
- external_reference única
- idempotency_key única
- amount_cents
- qr_code_text criptografado quando necessário
- qr_code_image_ref opcional
- ticket_url opcional
- expires_at
- status

### LedgerEntry

Registro derivado para relatórios e saldo local.

- id
- workspace_id
- external_transaction_id opcional
- installment_id opcional
- direction
- amount_cents
- occurred_at
- source_type
- source_id
- category_id
- excluded_from_reports boolean

### NotificationRule

- id
- workspace_id
- scope: GLOBAL ou FINANCIAL_ITEM
- financial_item_id opcional
- days_before array
- on_due_date
- overdue_frequency
- hour
- channels array
- enabled

### Attachment

- id
- workspace_id
- owner_type
- owner_id
- storage_key
- original_name
- mime_type
- size
- checksum
- uploaded_by

### WebhookEvent

- id
- provider
- provider_event_id ou fingerprint único
- received_at
- signature_valid
- processing_status
- attempts
- last_error redigido
- payload redigido ou criptografado

### SyncCursor

- integration_account_id
- resource_type
- cursor
- last_from
- last_to
- updated_at

### AuditLog

- workspace_id
- actor_type
- actor_id
- action
- entity_type
- entity_id
- metadata redigida
- created_at

## Regras de integridade

- Soma de parcelas deve fechar com o total, considerando ajustes explícitos.
- Uma movimentação externa pode ter somente uma conciliação ativa.
- Uma parcela pode receber várias movimentações parciais.
- Webhooks e importações devem ser idempotentes.
- Movimentações externas não são apagadas fisicamente.
