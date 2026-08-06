export type FinancialDirection = "PAYABLE" | "RECEIVABLE";
export type FinancialKind = "ONE_TIME" | "INSTALLMENT_PLAN" | "RECURRING";
export type FinancialStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELED";
export type InstallmentStatus = "SCHEDULED" | "PARTIAL" | "SETTLED" | "OVERDUE" | "CANCELED";
export type ReconciliationStatus = "UNMATCHED" | "SUGGESTED" | "MATCHED" | "IGNORED" | "REVERSED";
export type TransactionDirection = "CREDIT" | "DEBIT";
export type ContactType = "PERSON" | "COMPANY";
export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";

export interface PixKeyMock {
  id: string;
  type: PixKeyType;
  value: string;
  label?: string;
  isDefault: boolean;
}

export interface ContactMock {
  id: string;
  name: string;
  type: ContactType;
  document?: string;
  email?: string;
  phone?: string;
  isDebtor: boolean;
  isPayee: boolean;
  notes?: string;
  pixKeys: PixKeyMock[];
  totalOwedCents?: number;
}

export interface InstallmentMock {
  id: string;
  financialItemId: string;
  sequence: number;
  totalSequences: number;
  amountCents: number;
  settledAmountCents: number;
  dueDate: string;
  status: InstallmentStatus;
  pixKey?: PixKeyMock;
  settlementDate?: string;
  uniqueReference: string;
}

export interface FinancialItemMock {
  id: string;
  direction: FinancialDirection;
  kind: FinancialKind;
  title: string;
  description?: string;
  contact?: ContactMock;
  category: string;
  categoryColor: string;
  totalAmountCents: number;
  startDate: string;
  status: FinancialStatus;
  installments: InstallmentMock[];
  attachmentsCount: number;
  notes?: string;
}

export interface ExternalTransactionMock {
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

export interface RecurrenceRuleMock {
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

export interface NotificationRuleMock {
  id: string;
  daysBefore: number[];
  onDueDate: boolean;
  overdueFrequencyDays: number;
  preferredHour: number;
  channels: ("DASHBOARD" | "EMAIL" | "WHATSAPP")[];
  enabled: boolean;
}

export interface BalanceSummaryMock {
  currentBalanceCents: number;
  projectedBalanceCents: number;
  totalPayableMonthCents: number;
  totalReceivableMonthCents: number;
  totalOverdueCents: number;
  totalDebtorsOwedCents: number;
  lastSyncAt: string;
  syncSource: "SINCRONIZADO" | "CALCULADO";
  accountDisplayName: string;
  unresolvedTransactionsCount: number;
  uncategorizedCount: number;
}
