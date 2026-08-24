import { db } from "@/server/db";
import { processActiveRecurrences } from "@/server/actions/recurrence";
import { processNotificationAlerts } from "@/server/actions/notifications";
import { runAutomaticReconciliationEngine } from "@/server/actions/reconciliation";
import { syncMercadoPagoStatement } from "@/server/actions/transactions";
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

      for (const ws of workspaces) {
        // 1. Processar regras de recorrência ativas do workspace
        try {
          const recRes = await processActiveRecurrences(ws.id);
          if (recRes.success && recRes.generatedCount) {
            totalRecurrences += recRes.generatedCount;
          }
        } catch (e: any) {
          console.warn(`[WorkerDaemon] Erro ao processar recorrências para workspace ${ws.id}:`, e.message);
        }
        try {
          await discoverWorkspaceRecurrences(ws.id);
        } catch (e: any) {
          console.warn(`[WorkerDaemon] Erro ao descobrir recorrências para workspace ${ws.id}:`, e.message);
        }

        // 2. Avaliar alertas de notificação do workspace
        try {
          const alerts = await processNotificationAlerts(ws.id);
          totalAlerts += alerts.length;
        } catch (e: any) {
          console.warn(`[WorkerDaemon] Erro ao processar alertas para workspace ${ws.id}:`, e.message);
        }

        // 3. Executar motor de conciliação automática do workspace
        try {
          const reconRes = await runAutomaticReconciliationEngine(INTERNAL_WORKER_CONTEXT, ws.id);
          if (reconRes.success && reconRes.autoMatchedCount) {
            totalReconciled += reconRes.autoMatchedCount;
          }
        } catch (e: any) {
          console.warn(`[WorkerDaemon] Erro ao executar conciliação para workspace ${ws.id}:`, e.message);
        }

        // 4. Continuar SyncRuns pendentes ou interrompidos (PROCESSING) do workspace (Regra 33)
        try {
          const pendingSyncs = await db.syncRun.findMany({
            where: {
              workspaceId: ws.id,
              status: "PROCESSING",
            },
            take: 5,
          });

          for (const syncRun of pendingSyncs) {
            console.log(`[WorkerDaemon] Retomando SyncRun ${syncRun.id} para workspace ${ws.id}...`);
            await syncMercadoPagoStatement({
              syncRunId: syncRun.id,
              integrationAccountId: syncRun.integrationAccountId,
              internalContext: INTERNAL_WORKER_CONTEXT,
            });
            resumedSyncs++;
          }
        } catch (e: any) {
          console.warn(`[WorkerDaemon] Erro ao retomar SyncRuns para workspace ${ws.id}:`, e.message);
        }
      }

      console.log(
        `[WorkerDaemon] Rotina finalizada com sucesso. Workspaces: ${workspaces.length}, Recorrências geradas: ${totalRecurrences}, Alertas ativos: ${totalAlerts}, Auto-conciliações: ${totalReconciled}, SyncRuns retomados: ${resumedSyncs}`
      );

      return {
        success: true,
        executedAt,
        processedWorkspacesCount: workspaces.length,
        recurrenceResult: { generatedCount: totalRecurrences },
        notificationsResult: { alertsCount: totalAlerts },
        reconciliationResult: { autoMatchedCount: totalReconciled },
        resumedSyncRunsCount: resumedSyncs,
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
