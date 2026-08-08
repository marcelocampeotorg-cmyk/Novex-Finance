import {
  BalanceSummaryMock,
  ContactMock,
  ExternalTransactionMock,
  FinancialItemMock,
  NotificationRuleMock,
  RecurrenceRuleMock,
} from "@/types";

export const MOCK_BALANCE_SUMMARY: BalanceSummaryMock = {
  currentBalanceCents: 0,
  projectedBalanceCents: 0,
  totalPayableMonthCents: 0,
  totalReceivableMonthCents: 0,
  totalOverdueCents: 0,
  totalDebtorsOwedCents: 0,
  lastSyncAt: new Date().toISOString(),
  syncSource: "SINCRONIZADO",
  accountDisplayName: "Conta Real Pronta para Registro",
  unresolvedTransactionsCount: 0,
  uncategorizedCount: 0,
};

export const MOCK_CONTACTS: ContactMock[] = [];
export const MOCK_PAYABLES: FinancialItemMock[] = [];
export const MOCK_RECEIVABLES: FinancialItemMock[] = [];
export const MOCK_EXTERNAL_TRANSACTIONS: ExternalTransactionMock[] = [];
export const MOCK_RECURRENCES: RecurrenceRuleMock[] = [];

export const MOCK_NOTIFICATION_RULE: NotificationRuleMock = {
  id: "notif-rule-1",
  daysBefore: [7, 3, 1],
  onDueDate: true,
  overdueFrequencyDays: 1,
  preferredHour: 9,
  channels: ["DASHBOARD"],
  enabled: true,
};

export const MOCK_CHART_DATA = [
  { month: "Jan", entradas: 0, saídas: 0 },
  { month: "Fev", entradas: 0, saídas: 0 },
  { month: "Mar", entradas: 0, saídas: 0 },
  { month: "Abr", entradas: 0, saídas: 0 },
  { month: "Mai", entradas: 0, saídas: 0 },
  { month: "Jun", entradas: 0, saídas: 0 },
];
