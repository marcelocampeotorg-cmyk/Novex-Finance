import { db } from "@/server/db";
import { processActiveRecurrencesForWorkspace } from "@/server/services/recurrence-service";
import { processNotificationAlertsForWorkspace } from "@/server/services/notification-service";
import { reconcileWorkspace } from "@/server/services/reconciliation-service";
import { continueMercadoPagoSyncRun } from "@/server/services/transactions-service";
import { INTERNAL_WORKER_CONTEXT } from "@/server/internal-context";
import { discoverWorkspaceRecurrences } from "@/services/recurrence-discovery";

export interface WorkerRunResult {
  success: boolean;
  executedAt: string;
  processedWorkspacesCount?: number;
  recurrenceResult?: { generatedCount: number };
  notificationsResult?: { alertsCount: number };
  reconciliationResult?: { autoMatchedCount: number };
  resumedSyncRunsCount?: number;
  partialSyncRunsCount?: number;
  failedSyncRunsCount?: number;
  error?: string;
}

export class WorkerDaemonService {
  /**
   * Executa a rotina completa do Worker Daemon de background para todos os workspaces ativos.
   * Não requer cookies de sessão de navegador.
   */
  async runBackgroundJobs(): Promise<WorkerRunResult> {
    const executedAt = new Date().toISOString();

    try {
      console.log(`[WorkerDaemon] Iniciando rotina autônoma de segundo plano às ${executedAt}...`);

      // Buscar todos os workspaces cadastrados no sistema
      const workspaces = await db.workspace.findMany({
        select: { id: true, name: true },
      });

      let totalRecurrences = 0;
      let totalAlerts = 0;
      let totalReconciled = 0;
      let resumedSyncs = 0;
      let partialCount = 0;
      let failedCount = 0;
      let subsystemErrorsCount = 0;

      for (const ws of workspaces) {
        // 1. Processar regras de recorrência ativas do workspace
        try {
          const recRes = await processActiveRecurrencesForWorkspace(ws.id);
          if (recRes.success && recRes.generatedCount) {
            totalRecurrences += recRes.generatedCount;
          } else if (!recRes.success) {
            subsystemErrorsCount++;
          }
        } catch (e: any) {
          subsystemErrorsCount++;
          console.warn(`[WorkerDaemon] Erro ao processar recorrências para workspace ${ws.id}:`, e.message);
        }
        try {
          await discoverWorkspaceRecurrences(ws.id);
        } catch (e: any) {
          subsystemErrorsCount++;
          console.warn(`[WorkerDaemon] Erro ao descobrir recorrências para workspace ${ws.id}:`, e.message);
        }

        // 2. Avaliar alertas de notificação do workspace
        try {
          const alerts = await processNotificationAlertsForWorkspace(ws.id);
          totalAlerts += alerts.length;
        } catch (e: any) {
          subsystemErrorsCount++;
          console.warn(`[WorkerDaemon] Erro ao processar alertas para workspace ${ws.id}:`, e.message);
        }

        // 3. Executar motor de conciliação automática do workspace
        try {
          const reconRes = await reconcileWorkspace(INTERNAL_WORKER_CONTEXT, ws.id);
          if (reconRes.success && reconRes.autoMatchedCount) {
            totalReconciled += reconRes.autoMatchedCount;
          } else if (reconRes && !reconRes.success) {
            subsystemErrorsCount++;
          }
        } catch (e: any) {
          subsystemErrorsCount++;
          console.warn(`[WorkerDaemon] Erro ao executar conciliação para workspace ${ws.id}:`, e.message);
        }

        // 4. Continuar SyncRuns pendentes ou interrompidos (PROCESSING) do workspace (Regra 33)
        try {
          const pendingSyncs = await db.syncRun.findMany({
            where: {
              workspaceId: ws.id,
              status: "PROCESSING",
              source: "MERCADO_PAGO_API",
            },
            take: 5,
          });

          for (const syncRun of pendingSyncs) {
            try {
              console.log(`[WorkerDaemon] Retomando SyncRun ${syncRun.id} para workspace ${ws.id}...`);
              const syncResult = await continueMercadoPagoSyncRun({
                syncRunId: syncRun.id,
                integrationAccountId: syncRun.integrationAccountId,
                internalContext: INTERNAL_WORKER_CONTEXT,
              });
              if (syncResult && 'status' in syncResult && syncResult.status === 'PARTIAL') {
                partialCount++;
              }
              resumedSyncs++;
            } catch (syncErr: any) {
              failedCount++;
              console.error(`[WorkerDaemon] SyncRun ${syncRun.id} falhou:`, syncErr.message);
            }
          }
        } catch (e: any) {
          subsystemErrorsCount++;
          console.warn(`[WorkerDaemon] Erro ao retomar SyncRuns para workspace ${ws.id}:`, e.message);
        }
      }

      const overallSuccess = subsystemErrorsCount === 0 && failedCount === 0;

      if (overallSuccess) {
        console.log(
          `[WorkerDaemon] Rotina finalizada com sucesso. Workspaces: ${workspaces.length}, Recorrências geradas: ${totalRecurrences}, Alertas ativos: ${totalAlerts}, Auto-conciliações: ${totalReconciled}, SyncRuns retomados: ${resumedSyncs}`
        );
      } else {
        console.warn(
          `[WorkerDaemon] Rotina finalizada com alertas/falhas parciais. Erros em subsistemas: ${subsystemErrorsCount}, SyncRuns falhos: ${failedCount}, Parciais: ${partialCount}`
        );
      }

      return {
        success: overallSuccess,
        executedAt,
        processedWorkspacesCount: workspaces.length,
        recurrenceResult: { generatedCount: totalRecurrences },
        notificationsResult: { alertsCount: totalAlerts },
        reconciliationResult: { autoMatchedCount: totalReconciled },
        resumedSyncRunsCount: resumedSyncs,
        partialSyncRunsCount: partialCount,
        failedSyncRunsCount: failedCount + subsystemErrorsCount,
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
