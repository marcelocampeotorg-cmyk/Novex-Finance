const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_ACCOUNT_MONEY_WINDOW_DAYS = 60;
export const INCREMENTAL_OVERLAP_DAYS = 3;

export function selectMercadoPagoSyncWindow(input: {
  now: Date;
  coverageStart: Date | null;
  coverageEnd: Date | null;
  historyBackfillStatus: string;
  providerAccountCreatedAt: Date | null;
}) {
  if (input.coverageStart && ["NOT_STARTED", "IN_PROGRESS"].includes(input.historyBackfillStatus) && input.providerAccountCreatedAt) {
    const endDate = new Date(input.coverageStart.getTime() - 1);
    const candidate = new Date(endDate.getTime() - MAX_ACCOUNT_MONEY_WINDOW_DAYS * DAY_MS);
    return { purpose: "BACKFILL" as const, beginDate: candidate < input.providerAccountCreatedAt ? input.providerAccountCreatedAt : candidate, endDate };
  }
  if (input.coverageEnd) {
    const candidateBegin = new Date(input.coverageEnd.getTime() - INCREMENTAL_OVERLAP_DAYS * DAY_MS);
    const beginDate = input.providerAccountCreatedAt && candidateBegin < input.providerAccountCreatedAt
      ? input.providerAccountCreatedAt
      : candidateBegin;
    return { purpose: "INCREMENTAL" as const, beginDate, endDate: input.now };
  }
  return { purpose: "INITIAL" as const, beginDate: new Date(input.now.getTime() - MAX_ACCOUNT_MONEY_WINDOW_DAYS * DAY_MS), endDate: input.now };
}
