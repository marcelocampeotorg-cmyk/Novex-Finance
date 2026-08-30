import { db } from "@/server/db";
import { processActiveRecurrencesForWorkspace } from "@/server/services/recurrence-service";
import { processNotificationAlertsForWorkspace } from "@/server/services/notification-service";
import { reconcileWorkspace } from "@/server/services/reconciliation-service";
import { continueMercadoPagoSyncRun, enrichAllMercadoPagoTransactions } from "@/server/services/transactions-service";
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
  private static isRunning = false;

  /**
   * Executa a rotina completa do Worker Daemon de background para todos os workspaces ativos.
   * Não requer cookies de sessão de navegador.
   */
  async runBackgroundJobs(): Promise<WorkerRunResult> {
    if (WorkerDaemonService.isRunning) {
      console.warn("[WorkerDaemon] Execução anterior ainda em andamento. Ignorando overlapping tick.");
      return {
        success: true,
        executedAt: new Date().toISOString(),
        error: "WORKER_BUSY_OVERLAPPING_IGNORED",
      };
    }

    WorkerDaemonService.isRunning = true;
    const executedAt = new Date().toISOString();

    try {
      console.log(`[WorkerDaemon] Iniciando rotina autônoma de segundo plano às ${executedAt}...`);

      // Buscar todos os workspaces cadastrados no sistema
      const workspaces = await db.workspace.findMany({
        select: { id: true, name: true, financeMode: true },
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

        // 4. Continuar SyncRuns pendentes ou executar sync controlado do Mercado Pago
        try {
          const mpIntegrations = await db.integrationAccount.findMany({
            where: { workspaceId: ws.id, provider: "MERCADO_PAGO", status: "CONNECTED", isActive: true },
          });

          for (const integration of mpIntegrations) {
            // Verificar se já existe um SyncRun PROCESSING ativo para esta integração
            const activeSync = await db.syncRun.findFirst({
              where: {
                workspaceId: ws.id,
                integrationAccountId: integration.id,
                status: "PROCESSING",
              },
              orderBy: { createdAt: "desc" },
            });

            if (activeSync) {
              try {
                console.log(`[WorkerDaemon] Retomando SyncRun ativo ${activeSync.id} para integração ${integration.id}...`);
                const syncResult = await continueMercadoPagoSyncRun({
                  syncRunId: activeSync.id,
                  integrationAccountId: integration.id,
                  internalContext: INTERNAL_WORKER_CONTEXT,
                  workspaceId: ws.id,
                });
                if (syncResult && "status" in syncResult && syncResult.status === "PARTIAL") {
                  partialCount++;
                }
                resumedSyncs++;
              } catch (syncErr: any) {
                failedCount++;
                console.error(`[WorkerDaemon] SyncRun ${activeSync.id} falhou:`, syncErr.message);
              }
              // Decisão estrita de CRIAR novo report: baseada no momento real da última falha ou término
              const now = Date.now();
              const lastRun = await db.syncRun.findFirst({
                where: { integrationAccountId: integration.id },
                orderBy: { createdAt: "desc" },
              });

              const lastEventTime = lastRun
                ? (lastRun.finishedAt || lastRun.updatedAt || lastRun.createdAt).getTime()
                : 0;
              const isBackfill = ["NOT_STARTED", "IN_PROGRESS"].includes(integration.historyBackfillStatus);
              const isLastFailed = lastRun?.status === "FAILED";
              const isMaxReports = Boolean(lastRun?.errorMessage && lastRun.errorMessage.includes("Max number of reports"));
              const isRateLimit = Boolean(lastRun?.errorMessage && (lastRun.errorMessage.includes("429") || lastRun.errorMessage.includes("Rate limit")));

              // Backoff progressivo: 15 min em Max Reports/429, 5 min em falha geral, 60s em backfill saudável
              const minIntervalMs = (isMaxReports || isRateLimit)
                ? 15 * 60 * 1000
                : isLastFailed
                ? 5 * 60 * 1000
                : (isBackfill ? 60 * 1000 : 5 * 60 * 1000);

              if (now - lastEventTime >= minIntervalMs) {
                try {
                  const syncResult = await continueMercadoPagoSyncRun({
                    integrationAccountId: integration.id,
                    internalContext: INTERNAL_WORKER_CONTEXT,
                    workspaceId: ws.id,
                  });
                  if (syncResult && "status" in syncResult && syncResult.status === "PARTIAL") {
                    partialCount++;
                  }
                  await enrichAllMercadoPagoTransactions(INTERNAL_WORKER_CONTEXT, ws.id);
                  resumedSyncs++;
                } catch (syncErr: any) {
                  failedCount++;
                  console.error(`[WorkerDaemon] Novo Sync para integração ${integration.id} falhou:`, syncErr.message);
                }
              }
            }
          }
        } catch (e: any) {
          subsystemErrorsCount++;
          console.warn(`[WorkerDaemon] Erro ao gerenciar SyncRuns para workspace ${ws.id}:`, e.message);
        }
      }

      const overallSuccess = subsystemErrorsCount === 0 && failedCount === 0 && partialCount === 0;

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
    } finally {
      WorkerDaemonService.isRunning = false;
    }
  }
}

export const workerDaemon = new WorkerDaemonService();
