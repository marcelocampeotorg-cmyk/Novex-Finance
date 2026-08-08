import { processActiveRecurrences } from "@/server/actions/recurrence";
import { processNotificationAlerts } from "@/server/actions/notifications";
import { runAutomaticReconciliationEngine } from "@/server/actions/reconciliation";

export interface WorkerRunResult {
  success: boolean;
  executedAt: string;
  recurrenceResult?: { generatedCount: number };
  notificationsResult?: { alertsCount: number };
  reconciliationResult?: { autoMatchedCount: number };
  error?: string;
}

export class WorkerDaemonService {
  /**
   * Executa a rotina completa do Worker Daemon de background
   */
  async runBackgroundJobs(): Promise<WorkerRunResult> {
    const executedAt = new Date().toISOString();

    try {
      console.log(`[WorkerDaemon] Iniciando rotina de tarefas em segundo plano às ${executedAt}...`);

      // 1. Processar regras de recorrência ativas
      const recurrenceRes = await processActiveRecurrences();

      // 2. Avaliar alertas de notificação e lembretes
      const alerts = await processNotificationAlerts();

      // 3. Executar motor de conciliação automática
      const reconRes = await runAutomaticReconciliationEngine();

      console.log(
        `[WorkerDaemon] Rotina finalizada com sucesso. Recorrências geradas: ${
          recurrenceRes.generatedCount || 0
        }, Alertas ativos: ${alerts.length}, Auto-conciliações: ${reconRes.autoMatchedCount || 0}`
      );

      return {
        success: true,
        executedAt,
        recurrenceResult: { generatedCount: recurrenceRes.generatedCount || 0 },
        notificationsResult: { alertsCount: alerts.length },
        reconciliationResult: { autoMatchedCount: reconRes.autoMatchedCount || 0 },
      };
    } catch (err: any) {
      console.error("[WorkerDaemon] Erro durante execução da rotina de background:", err);
      return {
        success: false,
        executedAt,
        error: err.message || "Erro durante execução do worker daemon",
      };
    }
  }
}

export const workerDaemon = new WorkerDaemonService();
