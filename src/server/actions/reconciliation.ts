"use server";

import * as service from "@/server/services/reconciliation-service";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";

export const calculateReconciliationScore = service.calculateReconciliationScore;
export const categorizeTransactionDescription = (description: string) => service.categorizeTransactionDescription(description);
export const runAutomaticReconciliationEngine = () => service.reconcileWorkspace();
export const confirmSuggestedMatch = (id: string) => service.confirmSuggestedMatch(id);
export const unmatchTransaction = (id: string) => service.unmatchTransaction(id);

export async function learnCategoryRuleAction(pattern: string, categoryId: string, applyToPast = true) {
  const { workspaceId } = await requireAuthenticatedWorkspace();
  return service.learnCategoryRule({ workspaceId, pattern, categoryId, applyToPast });
}

export async function updateTransactionCategoryAction(transactionId: string, categoryId: string, learnPattern?: string) {
  const { workspaceId } = await requireAuthenticatedWorkspace();
  return service.updateTransactionCategory({ workspaceId, transactionId, categoryId, learnPattern });
}

export async function runFullCategorizationAndReconciliationAction() {
  const { workspaceId } = await requireAuthenticatedWorkspace();
  return service.runFullCategorizationAndReconciliation(workspaceId);
}

export async function getWorkspaceCategoriesAction() {
  const { workspaceId } = await requireAuthenticatedWorkspace();
  return service.getWorkspaceCategories(workspaceId);
}

export async function seedWorkspaceCategoryRulesAction() {
  const { workspaceId } = await requireAuthenticatedWorkspace();
  return service.seedWorkspaceCategoryRules(workspaceId);
}

