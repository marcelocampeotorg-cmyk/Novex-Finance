import test from "node:test";
import assert from "node:assert/strict";
import { MAX_ACCOUNT_MONEY_WINDOW_DAYS, selectMercadoPagoSyncWindow } from "../src/domain/mercado-pago-sync-window.ts";

test("Account Money: janela inicial respeita máximo oficial de 60 dias", () => {
  const now = new Date("2026-08-27T12:00:00.000Z");
  const window = selectMercadoPagoSyncWindow({ now, coverageStart: null, coverageEnd: null, historyBackfillStatus: "NOT_STARTED", providerAccountCreatedAt: null });
  assert.equal(window.purpose, "INITIAL");
  assert.equal((window.endDate.getTime() - window.beginDate.getTime()) / 86_400_000, MAX_ACCOUNT_MONEY_WINDOW_DAYS);
});

test("Account Money: backfill nunca ultrapassa a criação oficial da conta", () => {
  const created = new Date("2026-01-15T00:00:00.000Z");
  const window = selectMercadoPagoSyncWindow({ now: new Date("2026-08-27T00:00:00.000Z"), coverageStart: new Date("2026-02-01T00:00:00.000Z"), coverageEnd: new Date("2026-08-27T00:00:00.000Z"), historyBackfillStatus: "IN_PROGRESS", providerAccountCreatedAt: created });
  assert.equal(window.purpose, "BACKFILL");
  assert.equal(window.beginDate.toISOString(), created.toISOString());
});

test("Account Money: incremental sobrepõe um dia para ajustes tardios", () => {
  const coverageEnd = new Date("2026-08-26T12:00:00.000Z");
  const window = selectMercadoPagoSyncWindow({ now: new Date("2026-08-27T12:00:00.000Z"), coverageStart: new Date("2026-01-01T00:00:00.000Z"), coverageEnd, historyBackfillStatus: "COMPLETE", providerAccountCreatedAt: new Date("2025-01-01T00:00:00.000Z") });
  assert.equal(window.purpose, "INCREMENTAL");
  assert.equal(window.beginDate.toISOString(), "2026-08-25T12:00:00.000Z");
});
