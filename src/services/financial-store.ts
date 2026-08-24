import { FinancialItemMock, ContactMock, PixKeyType } from "@/types";

// In-memory store for newly added real items during session
let payablesStore: FinancialItemMock[] = [];
let receivablesStore: FinancialItemMock[] = [];
let contactsStore: ContactMock[] = [];

type Listener = () => void;
const listeners: Set<Listener> = new Set();

export function subscribeFinancialStore(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyStoreChange() {
  listeners.forEach((l) => l());
}

export function getPayables() {
  return payablesStore;
}

export function getReceivables() {
  return receivablesStore;
}

export function getContacts() {
  return contactsStore;
}

export function addFinancialItem(item: {
  direction: "PAYABLE" | "RECEIVABLE";
  kind: "ONE_TIME" | "INSTALLMENT_PLAN" | "RECURRING";
  title: string;
  description?: string;
  contactName: string;
  category: string;
  totalAmount: number;
  startDate: string;
  pixKey?: string;
  pixKeyType?: "CPF" | "CNPJ" | "EMAIL" | "PHONE";
  installments?: { sequence: number; amount: number; dueDate: string }[];
}) {
  const amountCents = Math.round(item.totalAmount * 100);
  const nowId = `real-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Se o contato foi informado, incluir ou localizar no catálogo de contatos
  let contact: ContactMock = {
    id: `cnt-${Date.now()}`,
    name: item.contactName || "Contato Principal",
    type: "PERSON",
    isDebtor: item.direction === "RECEIVABLE",
    isPayee: item.direction === "PAYABLE",
    pixKeys: item.pixKey && item.pixKeyType
      ? [{ id: `pix-${Date.now()}`, type: item.pixKeyType, value: item.pixKey, isDefault: true }]
      : [],
  };

  if (item.contactName) {
    const existing = contactsStore.find((c) => c.name.toLowerCase() === item.contactName.toLowerCase());
    if (existing) {
      contact = existing;
      if (item.pixKey && item.pixKeyType && (!existing.pixKeys || existing.pixKeys.length === 0)) {
        existing.pixKeys = [{ id: `pix-${Date.now()}`, type: item.pixKeyType, value: item.pixKey, isDefault: true }];
      }
    } else {
      contactsStore.unshift(contact);
    }
  }

  // Montar parcelas
  const rawInstallments =
    item.installments && item.installments.length > 0
      ? item.installments
      : [{ sequence: 1, amount: item.totalAmount, dueDate: item.startDate }];

  const newItem: FinancialItemMock = {
    id: nowId,
    direction: item.direction,
    kind: item.kind,
    title: item.title,
    description: item.description,
    contact,
    category: item.category,
    categoryColor: item.direction === "PAYABLE" ? "#EF4444" : "#10B981",
    totalAmountCents: amountCents,
    startDate: item.startDate,
    status: "ACTIVE",
    attachmentsCount: 0,
    installments: rawInstallments.map((inst, idx) => ({
      id: `${nowId}-inst-${idx + 1}`,
      financialItemId: nowId,
      sequence: inst.sequence || idx + 1,
      totalSequences: rawInstallments.length,
      amountCents: Math.round(inst.amount * 100),
      settledAmountCents: 0,
      dueDate: inst.dueDate,
      status: "SCHEDULED",
      uniqueReference: `NOVEX-${item.direction.slice(0, 3)}-${Date.now().toString().slice(-4)}-${idx + 1}`,
      pixKey: item.pixKey && item.pixKeyType ? { id: `pk-${Date.now()}`, type: item.pixKeyType, value: item.pixKey, isDefault: true } : undefined,
    })),
  };

  if (item.direction === "PAYABLE") {
    payablesStore.unshift(newItem);
  } else {
    receivablesStore.unshift(newItem);
  }

  notifyStoreChange();
  return newItem;
}

export function deleteFinancialItem(id: string) {
  payablesStore = payablesStore.filter((item) => item.id !== id);
  receivablesStore = receivablesStore.filter((item) => item.id !== id);
  notifyStoreChange();
}

export function deleteContact(id: string) {
  contactsStore = contactsStore.filter((c) => c.id !== id);
  notifyStoreChange();
}
