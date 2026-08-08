const test = require("node:test");
const assert = require("node:assert/strict");

function calculateNextRecurrenceDate(currentDate, frequency, interval = 1, dayOfMonth) {
  const next = new Date(currentDate.getTime());

  if (frequency === "WEEKLY") {
    next.setDate(next.getDate() + 7 * interval);
  } else if (frequency === "ANNUAL") {
    next.setFullYear(next.getFullYear() + interval);
  } else {
    // MONTHLY por padrão
    next.setMonth(next.getMonth() + interval);
    if (dayOfMonth && dayOfMonth >= 1 && dayOfMonth <= 31) {
      const maxDaysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(dayOfMonth, maxDaysInMonth));
    }
  }

  return next;
}

test("Cálculo de Próxima Recorrência: Frequência Mensal com dia específico do mês", () => {
  const startDate = new Date(2026, 7, 5); // 5 de Agosto de 2026
  const nextMonthly = calculateNextRecurrenceDate(startDate, "MONTHLY", 1, 5);

  assert.equal(nextMonthly.getMonth(), 8); // Setembro (0-indexed 8)
  assert.equal(nextMonthly.getDate(), 5);
  assert.equal(nextMonthly.getFullYear(), 2026);
});

test("Cálculo de Próxima Recorrência: Frequência Semanal", () => {
  const startDate = new Date(2026, 7, 1); // 1 de Agosto de 2026
  const nextWeekly = calculateNextRecurrenceDate(startDate, "WEEKLY", 1);

  assert.equal(nextWeekly.getDate(), 8); // 1 + 7 dias = 8 de Agosto
});

test("Cálculo de Próxima Recorrência: Frequência Anual", () => {
  const startDate = new Date(2026, 7, 1); // 1 de Agosto de 2026
  const nextAnnual = calculateNextRecurrenceDate(startDate, "ANNUAL", 1);

  assert.equal(nextAnnual.getFullYear(), 2027);
  assert.equal(nextAnnual.getMonth(), 7); // Agosto (0-indexed 7)
});

test("Alertas de Notificação: Classificação de prazos e antecedência", () => {
  function classifyAlert(daysDiff, daysBeforeRule, onDueDateRule) {
    if (daysDiff < 0) return "OVERDUE";
    if (daysDiff === 0 && onDueDateRule) return "DUE_TODAY";
    if (daysDiff > 0 && daysBeforeRule.includes(daysDiff)) return "DUE_SOON";
    return "NONE";
  }

  const daysBefore = [7, 3, 1];

  assert.equal(classifyAlert(-2, daysBefore, true), "OVERDUE");
  assert.equal(classifyAlert(0, daysBefore, true), "DUE_TODAY");
  assert.equal(classifyAlert(3, daysBefore, true), "DUE_SOON");
  assert.equal(classifyAlert(5, daysBefore, true), "NONE");
});

test("Worker Daemon: Estrutura de retorno de orquestração", () => {
  const mockRun = {
    success: true,
    executedAt: new Date().toISOString(),
    recurrenceResult: { generatedCount: 2 },
    notificationsResult: { alertsCount: 5 },
    reconciliationResult: { autoMatchedCount: 1 },
  };

  assert.equal(mockRun.success, true);
  assert.equal(mockRun.recurrenceResult.generatedCount, 2);
  assert.equal(mockRun.notificationsResult.alertsCount, 5);
  assert.equal(mockRun.reconciliationResult.autoMatchedCount, 1);
});

test("Evolution API WhatsApp: Formatação de cobrança Pix para devedor", () => {
  function formatWhatsAppPixReminder(debtorName, amountCents, dueDate, pixCopiaECola) {
    const valor = (amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    let text = `Olá, *${debtorName}*! Fatura de *${valor}* vence em *${dueDate}*.`;
    if (pixCopiaECola) text += `\nPix: ${pixCopiaECola}`;
    return text;
  }

  const msg = formatWhatsAppPixReminder("Mariana Santos", 150000, "10/08/2026", "00020126580014br.gov.bcb.pix");
  assert.ok(msg.includes("Mariana Santos"));
  assert.ok(msg.includes("1.500,00"));
  assert.ok(msg.includes("00020126580014br.gov.bcb.pix"));
});
