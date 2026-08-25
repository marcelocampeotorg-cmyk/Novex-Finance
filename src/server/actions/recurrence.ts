"use server";

import * as service from "@/server/services/recurrence-service";

export const calculateNextRecurrenceDate = service.calculateNextRecurrenceDate;
export const getRecurrenceRules = service.getRecurrenceRules;
export const createRecurrenceRule = service.createRecurrenceRule;
export const processActiveRecurrences = () => service.processActiveRecurrencesForWorkspace();
export const toggleRecurrenceRule = service.toggleRecurrenceRule;
export const deleteRecurrenceRule = service.deleteRecurrenceRule;
