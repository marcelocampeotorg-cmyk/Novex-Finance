const test = require("node:test");
const assert = require("node:assert");

test("Recorrência descoberta: sugere padrão mensal variável sem criar compromisso", async () => {
  const { detectMonthlyRecurrences } = require("../src/services/recurrence-detector.ts");
  const suggestions = detectMonthlyRecurrences([
    { id: "1", description: "CLARO FATURA 001", occurredAt: new Date("2026-05-10T12:00:00Z"), amountCents: 10000 },
    { id: "2", description: "Claro Fatura 002", occurredAt: new Date("2026-06-09T12:00:00Z"), amountCents: 11000 },
    { id: "3", description: "CLARO FATURA 003", occurredAt: new Date("2026-07-10T12:00:00Z"), amountCents: 10500 },
  ]);
  assert.strictEqual(suggestions.length, 1);
  assert.strictEqual(suggestions[0].pattern, "claro fatura");
  assert.ok(suggestions[0].confidence >= 70);
  assert.strictEqual(suggestions[0].averageAmountCents, 10500);
});

test("Recorrência descoberta: rejeita coincidência esparsa ou variação insegura", () => {
  const { detectMonthlyRecurrences } = require("../src/services/recurrence-detector.ts");
  const result = detectMonthlyRecurrences([
    { id: "1", description: "Loja X", occurredAt: new Date("2026-05-01"), amountCents: 1000 },
    { id: "2", description: "Loja X", occurredAt: new Date("2026-06-01"), amountCents: 9000 },
    { id: "3", description: "Loja X", occurredAt: new Date("2026-07-01"), amountCents: 1000 },
  ]);
  assert.deepStrictEqual(result, []);
});
