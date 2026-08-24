export type RecurrenceSample = { id: string; description: string; occurredAt: Date; amountCents: number };
export type RecurrenceSuggestion = { pattern: string; sampleIds: string[]; averageAmountCents: number; confidence: number };

export function normalizeRecurrenceCounterparty(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\d+/g, " ").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
}

export function detectMonthlyRecurrences(samples: RecurrenceSample[]): RecurrenceSuggestion[] {
  const groups = new Map<string, RecurrenceSample[]>();
  for (const sample of samples) {
    const pattern = normalizeRecurrenceCounterparty(sample.description);
    if (pattern.length < 3) continue;
    groups.set(pattern, [...(groups.get(pattern) || []), sample]);
  }
  const suggestions: RecurrenceSuggestion[] = [];
  for (const [pattern, group] of groups) {
    const ordered = group.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    if (ordered.length < 3) continue;
    const intervals = ordered.slice(1).map((item, index) => (item.occurredAt.getTime() - ordered[index].occurredAt.getTime()) / 86_400_000);
    if (!intervals.every((days) => days >= 25 && days <= 35)) continue;
    const amounts = ordered.map((item) => item.amountCents);
    const average = Math.round(amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length);
    const maxDeviation = Math.max(...amounts.map((amount) => Math.abs(amount - average) / Math.max(average, 1)));
    if (maxDeviation > 0.3) continue;
    const confidence = Math.min(95, 70 + (ordered.length - 3) * 5 + Math.round((1 - maxDeviation) * 10));
    suggestions.push({ pattern, sampleIds: ordered.map((item) => item.id), averageAmountCents: average, confidence });
  }
  return suggestions;
}
