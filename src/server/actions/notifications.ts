"use server";

import * as service from "@/server/services/notification-service";
export type { NotificationAlert } from "@/server/services/notification-service";

export const getNotificationRule = () => service.getNotificationRuleForWorkspace();
export const updateNotificationRule = service.updateNotificationRule;
export const processNotificationAlerts = () => service.processNotificationAlertsForWorkspace();
export const checkEvolutionConnectionState = service.checkEvolutionConnectionState;
export const fetchEvolutionQRCode = service.fetchEvolutionQRCode;
export const sendWhatsAppDebtorReminder = service.sendWhatsAppDebtorReminder;
export const sendNeutralWhatsAppTest = service.sendNeutralWhatsAppTest;
