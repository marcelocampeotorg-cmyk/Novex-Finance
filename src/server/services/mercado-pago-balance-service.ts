import "server-only";

import { revalidatePath } from "next/cache";
import { MercadoPagoReleaseReportsClient } from "@/integrations/mercado-pago/release-reports-client";
import { parseMercadoPagoCredentials } from "@/lib/server/credentials-crypto";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";
import { db } from "@/server/db";
import { INTERNAL_WORKER_CONTEXT } from "@/server/internal-context";

const BALANCE_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

type BalanceSyncOptions = {
  workspaceId?: string;
  internalContext?: symbol;
  force?: boolean;
};

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").slice(0, 1200);
}

function lastCompletedLocalDay(): { beginDate: Date; endDate: Date } {
  const beginDate = new Date();
  beginDate.setHours(0, 0, 0, 0);
  beginDate.setDate(beginDate.getDate() - 1);
  const endDate = new Date(beginDate);
  endDate.setHours(23, 59, 59, 0);
  return { beginDate, endDate };
}

async function resolveWorkspaceId(options: BalanceSyncOptions): Promise<string> {
  if (options.internalContext === INTERNAL_WORKER_CONTEXT && options.workspaceId) return options.workspaceId;
  return (await requireAuthenticatedWorkspace()).workspaceId;
}

export async function continueMercadoPagoBalanceSync(options: BalanceSyncOptions = {}) {
  const workspaceId = await resolveWorkspaceId(options);
  const integration = await db.integrationAccount.findFirst({
    where: { workspaceId, provider: "MERCADO_PAGO", status: "CONNECTED", isActive: true },
    include: { financialAccount: true },
  });
  if (!integration?.encryptedCredentials) {
    return { success: false as const, status: "UNAVAILABLE" as const, error: "Integração Mercado Pago conectada não encontrada." };
  }

  const financialAccount = integration.financialAccount || await db.financialAccount.upsert({
    where: { workspaceId_type: { workspaceId, type: "MERCADO_PAGO" } },
    create: { workspaceId, type: "MERCADO_PAGO", name: "Mercado Pago", officialBalanceStatus: "UNAVAILABLE" },
    update: { isActive: true },
  });
  if (!integration.financialAccountId) {
    await db.integrationAccount.update({ where: { id: integration.id }, data: { financialAccountId: financialAccount.id } });
  }

  let run = await db.balanceSyncRun.findFirst({
    where: { integrationAccountId: integration.id, activeKey: integration.id },
    orderBy: { createdAt: "desc" },
  });
  const hasConfirmedAnchor = financialAccount.officialBalanceCents !== null && financialAccount.officialBalanceAt !== null;
  if (run && hasConfirmedAnchor && financialAccount.officialBalanceStatus !== "CONFIRMED") {
    await db.financialAccount.update({
      where: { id: financialAccount.id },
      data: { officialBalanceStatus: "CONFIRMED" },
    });
  }

  if (!run) {
    const targetWindow = lastCompletedLocalDay();
    const lastRun = await db.balanceSyncRun.findFirst({
      where: { integrationAccountId: integration.id },
      orderBy: { createdAt: "desc" },
    });
    if (
      lastRun?.status === "CONFIRMED" &&
      lastRun.beginDate.getTime() === targetWindow.beginDate.getTime() &&
      lastRun.endDate.getTime() === targetWindow.endDate.getTime()
    ) {
      return {
        success: true as const,
        status: "ALREADY_CONFIRMED" as const,
        officialBalanceAt: financialAccount.officialBalanceAt?.toISOString() || null,
      };
    }
    const lastEvent = lastRun?.finishedAt || lastRun?.updatedAt || lastRun?.createdAt;
    if (!options.force && lastEvent && Date.now() - lastEvent.getTime() < BALANCE_REFRESH_INTERVAL_MS) {
      return {
        success: true as const,
        status: "COOLDOWN" as const,
        officialBalanceAt: financialAccount.officialBalanceAt?.toISOString() || null,
      };
    }

    const { beginDate, endDate } = targetWindow;
    const previousWindowRun = await db.balanceSyncRun.findFirst({
      where: { integrationAccountId: integration.id, beginDate, endDate },
    });
    if (previousWindowRun && previousWindowRun.status !== "CONFIRMED") {
      const claimed = await db.balanceSyncRun.updateMany({
        where: { id: previousWindowRun.id, activeKey: null },
        data: {
          status: "PROCESSING",
          activeKey: integration.id,
          remoteTaskId: null,
          remoteReportId: null,
          remoteFileName: null,
          requestedAt: null,
          finishedAt: null,
          errorCode: null,
          errorMessage: null,
        },
      });
      if (claimed.count > 0) run = await db.balanceSyncRun.findUnique({ where: { id: previousWindowRun.id } });
    }
    if (!run) {
      try {
        run = await db.balanceSyncRun.create({
          data: {
            workspaceId,
            integrationAccountId: integration.id,
            financialAccountId: financialAccount.id,
            status: "PROCESSING",
            beginDate,
            endDate,
            activeKey: integration.id,
          },
        });
      } catch {
        run = await db.balanceSyncRun.findFirst({
          where: { integrationAccountId: integration.id, activeKey: integration.id },
          orderBy: { createdAt: "desc" },
        });
        if (!run) throw new Error("Não foi possível adquirir a execução exclusiva do saldo Mercado Pago.");
      }
    }
    if (!hasConfirmedAnchor) {
      await db.financialAccount.update({
        where: { id: financialAccount.id },
        data: { officialBalanceStatus: "RECONCILING" },
      });
    }
  }

  const credentials = parseMercadoPagoCredentials(integration.encryptedCredentials);
  const client = new MercadoPagoReleaseReportsClient(credentials.accessToken);

  try {
    if (!run.remoteTaskId) {
      const requested = await client.requestReport(run.beginDate, run.endDate);
      run = await db.balanceSyncRun.update({
        where: { id: run.id },
        data: {
          remoteTaskId: requested.taskId,
          remoteReportId: requested.reportId || null,
          remoteFileName: requested.fileName || null,
          beginDate: requested.beginDate ? new Date(requested.beginDate) : run.beginDate,
          endDate: requested.endDate ? new Date(requested.endDate) : run.endDate,
          requestedAt: new Date(),
        },
      });
      if (requested.status === "FAILED") throw new Error("Mercado Pago marcou a geração do Relatório Liberações como falha.");
      if (requested.status !== "READY") {
        return { success: true as const, status: "PROCESSING" as const, runId: run.id, retainedBalanceCents: financialAccount.officialBalanceCents };
      }
    }

    const task = await client.getTask(run.remoteTaskId!);
    const normalizedBeginDate = task.beginDate ? new Date(task.beginDate) : run.beginDate;
    const normalizedEndDate = task.endDate ? new Date(task.endDate) : run.endDate;
    if (normalizedBeginDate.getTime() !== run.beginDate.getTime() || normalizedEndDate.getTime() !== run.endDate.getTime()) {
      run = await db.balanceSyncRun.update({
        where: { id: run.id },
        data: { beginDate: normalizedBeginDate, endDate: normalizedEndDate },
      });
    }
    if (task.status === "PROCESSING") {
      return { success: true as const, status: "PROCESSING" as const, runId: run.id, retainedBalanceCents: financialAccount.officialBalanceCents };
    }
    if (task.status === "FAILED") throw new Error("Mercado Pago marcou a tarefa do Relatório Liberações como falha.");
    const fileName = task.fileName || run.remoteFileName;
    if (!fileName) throw new Error("Tarefa concluída sem file_name para baixar o Relatório Liberações.");

    const csv = await client.download(fileName);
    const evidence = client.parseBalance(csv);
    if (!evidence.valid || evidence.balanceCents === null) {
      throw new Error(`Relatório Liberações não reconciliou: ${evidence.errors.join(" ")}`);
    }

    const finishedAt = new Date();
    await db.$transaction(async (tx) => {
      await tx.financialAccount.update({
        where: { id: financialAccount.id },
        data: {
          officialBalanceCents: BigInt(evidence.balanceCents!),
          officialBalanceAt: normalizedEndDate,
          officialBalanceStatus: "CONFIRMED",
        },
      });
      await tx.balanceSyncRun.update({
        where: { id: run!.id },
        data: {
          status: "CONFIRMED",
          activeKey: null,
          remoteReportId: task.reportId || run!.remoteReportId,
          remoteFileName: fileName,
          balanceCents: BigInt(evidence.balanceCents!),
          evidenceSummary: {
            initialBalanceCents: evidence.initialBalanceCents,
            movementCents: evidence.movementCents,
            rowCount: evidence.rowCount,
            recordTypeCounts: evidence.recordTypeCounts,
            latestBalanceRecordAt: evidence.balanceAt,
          },
          finishedAt,
          errorCode: null,
          errorMessage: null,
        },
      });
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorType: options.internalContext === INTERNAL_WORKER_CONTEXT ? "WORKER" : "USER",
          actorId: options.internalContext === INTERNAL_WORKER_CONTEXT ? "worker-daemon" : "authenticated-user",
          action: "MERCADO_PAGO_BALANCE_CONFIRMED",
          entityType: "FinancialAccount",
          entityId: financialAccount.id,
          metadata: { balanceSyncRunId: run!.id, cutAt: normalizedEndDate.toISOString(), latestBalanceRecordAt: evidence.balanceAt, reportId: task.reportId || null },
        },
      });
    });

    if (options.internalContext !== INTERNAL_WORKER_CONTEXT) revalidatePath("/");
    return {
      success: true as const,
      status: "CONFIRMED" as const,
      balanceCents: evidence.balanceCents,
      officialBalanceAt: normalizedEndDate.toISOString(),
      runId: run.id,
    };
  } catch (error) {
    const errorMessage = safeError(error);
    const errorCode = errorMessage.includes("HTTP 403") ? "MERCADO_PAGO_RELEASE_REPORT_FORBIDDEN" : "MERCADO_PAGO_BALANCE_RECONCILIATION_FAILED";
    await db.$transaction([
      db.balanceSyncRun.update({
        where: { id: run.id },
        data: { status: "FAILED", activeKey: null, finishedAt: new Date(), errorCode, errorMessage },
      }),
      db.financialAccount.update({
        where: { id: financialAccount.id },
        data: { officialBalanceStatus: hasConfirmedAnchor ? "CONFIRMED" : "RECONCILING" },
      }),
      db.auditLog.create({
        data: {
          workspaceId,
          actorType: options.internalContext === INTERNAL_WORKER_CONTEXT ? "WORKER" : "USER",
          actorId: options.internalContext === INTERNAL_WORKER_CONTEXT ? "worker-daemon" : "authenticated-user",
          action: "MERCADO_PAGO_BALANCE_RECONCILIATION_FAILED",
          entityType: "BalanceSyncRun",
          entityId: run.id,
          metadata: { errorCode, errorMessage },
        },
      }),
    ]);
    if (options.internalContext !== INTERNAL_WORKER_CONTEXT) revalidatePath("/");
    return { success: false as const, status: "FAILED" as const, errorCode, error: errorMessage, runId: run.id };
  }
}

export async function refreshMercadoPagoBalance() {
  return continueMercadoPagoBalanceSync({ force: true });
}
