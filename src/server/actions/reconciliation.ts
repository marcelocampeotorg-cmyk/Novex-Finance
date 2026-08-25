"use server";

import * as service from "@/server/services/reconciliation-service";

export const calculateReconciliationScore = service.calculateReconciliationScore;
export const categorizeTransactionDescription = (description: string) => service.categorizeTransactionDescription(description);
export const runAutomaticReconciliationEngine = () => service.reconcileWorkspace();
export const confirmSuggestedMatch = (id: string) => service.confirmSuggestedMatch(id);
export const unmatchTransaction = (id: string) => service.unmatchTransaction(id);
