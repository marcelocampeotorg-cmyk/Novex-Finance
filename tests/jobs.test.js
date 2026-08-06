const test = require("node:test");
const assert = require("node:assert");

function calculateNextRunDate(currentDate, frequency, interval = 1) {
  const next = new Date(currentDate);
  if (frequency === "MONTHLY") {
    next.setMonth(next.getMonth() + interval);
  } else if (frequency === "WEEKLY") {
    next.setDate(next.getDate() + 7 * interval);
  } else if (frequency === "YEARLY") {
    next.setFullYear(next.getFullYear() + interval);
  }
  return next;
}

function classifyReminderNotice(daysDiff) {
  if (daysDiff === 0) return "DUE_TODAY";
  if (daysDiff > 0 && daysDiff <= 7) return "DAYS_BEFORE";
  if (daysDiff < 0) return "OVERDUE";
  return "FUTURE";
}

test("Cálculo da Próxima Data de Recorrência Mensal", () => {
  const start = new Date("2026-08-10T00:00:00.000Z");
  const next = calculateNextRunDate(start, "MONTHLY", 1);
  assert.strictEqual(next.getMonth(), 8); // Setembro (0-indexed: 8 = Set)
});

test("Classificação de Notificação de Lembrete por Dias de Diferença", () => {
  assert.strictEqual(classifyReminderNotice(0), "DUE_TODAY");
  assert.strictEqual(classifyReminderNotice(3), "DAYS_BEFORE");
  assert.strictEqual(classifyReminderNotice(-2), "OVERDUE");
});
