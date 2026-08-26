"use server";

import * as service from "@/server/services/recurrence-service";

import { requireAuthenticatedWorkspace } from "@/server/auth-context";

export const calculateNextRecurrenceDate = service.calculateNextRecurrenceDate;

export async function getRecurrenceRules() {
  const { workspaceId } = await requireAuthenticatedWorkspace();
  return service.getRecurrenceRulesForWorkspace(workspaceId);
}

export const createRecurrenceRule = service.createRecurrenceRule;
export const processActiveRecurrences = () => service.processActiveRecurrencesForWorkspace();
export const toggleRecurrenceRule = service.toggleRecurrenceRule;
export const deleteRecurrenceRule = service.deleteRecurrenceRule;
