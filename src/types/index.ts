export type FinancialDirection = "PAYABLE" | "RECEIVABLE";
export type FinancialKind = "ONE_TIME" | "INSTALLMENT_PLAN" | "RECURRING";
export type FinancialStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELED";
export type InstallmentStatus = "SCHEDULED" | "PARTIAL" | "SETTLED" | "OVERDUE" | "CANCELED";
export type ReconciliationStatus = "UNMATCHED" | "SUGGESTED" | "MATCHED" | "IGNORED" | "REVERSED";
export type TransactionDirection = "CREDIT" | "DEBIT";
export type ContactType = "PERSON" | "COMPANY";
export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";

export interface PixKeyDTO {
  id: string;
  type: PixKeyType;
  value: string;
  label?: string;
  isDefault: boolean;
}

export interface ContactDTO {
  id: string;
  name: string;
  type: ContactType;
  document?: string;
  email?: string;
  phone?: string;
  isDebtor: boolean;
  isPayee: boolean;
  notes?: string;
  pixKeys: PixKeyDTO[];
  totalOwedCents?: number;
}

export interface InstallmentDTO {
  id: string;
  financialItemId: string;
  sequence: number;
  totalSequences: number;
  amountCents: number;
  settledAmountCents: number;
  dueDate: string;
  status: InstallmentStatus;
  pixKey?: PixKeyDTO;
  settlementDate?: string;
  uniqueReference: string;
}

export interface FinancialItemDTO {
  id: string;
  direction: FinancialDirection;
  kind: FinancialKind;
  title: string;
  description?: string;
  contact?: ContactDTO;
  pixKey?: string;
  category: string;
  categoryColor: string;
  totalAmountCents: number;
  startDate: string;
  status: FinancialStatus;
  installments: InstallmentDTO[];
  attachmentsCount: number;
  notes?: string;
}

export interface ExternalTransactionDTO {
  id: string;
  provider: "MERCADO_PAGO";
  externalId: string;
  direction: TransactionDirection;
  type: "PIX_SENT" | "PIX_RECEIVED" | "PURCHASE" | "TRANSFER" | "FEE" | "REFUND";
  status: "APPROVED" | "PENDING" | "REJECTED";
  amountCents: number;
  netAmountCents: number;
  occurredAt: string;
  counterpartName?: string;
  counterpartDocument?: string;
  description: string;
  reconciliationStatus: ReconciliationStatus;
  matchedInstallmentId?: string;
  category: string;
  confidenceScore?: number;
}

export interface RecurrenceRuleDTO {
  id: string;
  title: string;
  contactName: string;
  category: string;
  amountCents: number;
  frequency: "MONTHLY" | "WEEKLY" | "YEARLY";
  interval: number;
  dayOfMonth: number;
  startsAt: string;
  nextRunAt: string;
  active: boolean;
}

export interface NotificationRuleDTO {
  id: string;
  daysBefore: number[];
  onDueDate: boolean;
  overdueFrequencyDays: number;
  preferredHour: number;
  channels: ("DASHBOARD" | "EMAIL" | "WHATSAPP")[];
  enabled: boolean;
}

export interface BalanceSummaryDTO {
  knownNetMovementCents: number;
  manualBalanceCents: number | null;
  manualBalanceAt: string | null;
  mercadoPagoOfficialBalanceCents: number | null;
  mercadoPagoOfficialBalanceAt: string | null;
  mercadoPagoBalanceStatus: "CONFIRMED" | "UNAVAILABLE" | "RECONCILING";
  consolidatedBalanceCents: number | null;
  financeMode: "MANUAL" | "HYBRID";
  quarantineCount: number;
  coverageStart: string | null;
  coverageEnd: string | null;
  historyBackfillStatus: string | null;
  projectedKnownFlowCents: number;
  totalPayableMonthCents: number;
  totalReceivableMonthCents: number;
  totalOverdueCents: number;
  totalDebtorsOwedCents: number;
  lastSyncAt: string | null;
  syncSource: "SINCRONIZADO" | "PENDENTE" | "DESCONECTADO" | "CALCULADO";
  accountDisplayName: string;
  unresolvedTransactionsCount: number;
  uncategorizedCount: number;
  balanceDescription?: string;
  isOutdated?: boolean;
  monthIncomeCents: number;
  monthExpenseCents: number;
  monthNetCents: number;
  financialAccounts?: {
    id: string;
    type: "MANUAL" | "MERCADO_PAGO" | "BANK_ACCOUNT";
    name: string;
    openingBalanceCents: number | null;
    openingBalanceAt: string | null;
    officialBalanceCents: number | null;
    officialBalanceStatus: string;
  }[];
}

