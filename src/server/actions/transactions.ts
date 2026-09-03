"use server";

import type { MercadoPagoRawTransaction } from "@/integrations/mercado-pago/reports-client";
import * as service from "@/server/services/transactions-service";

export const getExternalTransactions = (period = "MONTHLY") => service.getExternalTransactions(period);
export const importCsvExternalTransactions = (rows: MercadoPagoRawTransaction[]) => service.importCsvExternalTransactions(rows);
export const ignoreExternalTransaction = (id: string) => service.ignoreExternalTransaction(id);
export const getReconciliationSummary = (period = "MONTHLY") => service.getReconciliationSummary(period);
export const matchReconciliation = (externalTransactionId: string, installmentId: string) => service.matchReconciliation(externalTransactionId, installmentId);
export const reconcileWithNewItem = (data: { externalTransactionId: string; title: string; categoryName: string; contactName?: string; description?: string }) => service.reconcileWithNewItem(data);
export const syncMercadoPagoStatement = (force = false) => service.continueMercadoPagoSyncRun(force);
export const enrichMercadoPagoTransactions = () => service.enrichAllMercadoPagoTransactions();

