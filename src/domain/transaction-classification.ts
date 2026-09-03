export interface TransactionClassification {
  normalizedText: string;
  merchantName: string | null;
  productName: string | null;
  suggestedCategory: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
  matchedPattern: string | null;
}

interface ClassificationRule {
  merchantName: string;
  productName?: string;
  category: string;
  patterns: RegExp[];
}

export const EXPENSE_CATEGORY_DEFINITIONS = [
  { name: "Marketing & Anúncios", colorToken: "#F97316" },
  { name: "Infraestrutura & Hospedagem", colorToken: "#06B6D4" },
  { name: "Softwares & Ferramentas", colorToken: "#10B981" },
  { name: "Assinaturas & Lazer", colorToken: "#8B5CF6" },
] as const;

const RULES: ClassificationRule[] = [
  {
    merchantName: "Google",
    productName: "Google Ads",
    category: "Marketing & Anúncios",
    patterns: [/\bgoogle\s*(ads|adwords)\b/, /\bgads\b/],
  },
  {
    merchantName: "Meta",
    productName: "Meta Ads",
    category: "Marketing & Anúncios",
    patterns: [/\bmeta\s*(ads|pay)\b/, /\bfacebook\s*(ads|advertising)\b/, /\bfacebk\b/, /\bfb\s*ads\b/],
  },
  {
    merchantName: "Google",
    productName: "Google Cloud",
    category: "Infraestrutura & Hospedagem",
    patterns: [/\bgoogle\s*cloud\b/, /\bgcp\b/],
  },
  {
    merchantName: "Google",
    productName: "Google Workspace",
    category: "Softwares & Ferramentas",
    patterns: [/\bgoogle\s*workspace\b/, /\bg\s*suite\b/],
  },
  {
    merchantName: "Google",
    productName: "Google One",
    category: "Softwares & Ferramentas",
    patterns: [/\bgoogle\s*one\b/],
  },
  {
    merchantName: "Google",
    productName: "YouTube Premium",
    category: "Assinaturas & Lazer",
    patterns: [/\byoutube\s*premium\b/, /\byoutubepremium\b/],
  },
  {
    merchantName: "Meta",
    category: "Marketing & Anúncios",
    patterns: [/\bfacebook\b/, /\bmeta\b/],
  },
];

export function normalizeTransactionText(...values: Array<string | null | undefined>): string {
  return values
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesCategoryPattern(text: string, pattern: string): boolean {
  const normalizedText = ` ${normalizeTransactionText(text)} `;
  const normalizedPattern = normalizeTransactionText(pattern);
  if (normalizedPattern.length < 2) return false;
  return normalizedText.includes(` ${normalizedPattern} `);
}

const CORPORATE_STOP_WORDS = new Set([
  "ltda",
  "sa",
  "me",
  "epp",
  "eireli",
  "brasil",
  "de",
  "da",
  "do",
  "dos",
  "das",
  "ip",
  "instituicao",
  "pagamento",
  "pagamentos",
  "servico",
  "servicos",
]);

export function extractCounterpartPattern(name: string): string {
  const normalized = normalizeTransactionText(name);
  if (!normalized) return "";
  const words = normalized.split(/\s+/).filter((w) => !CORPORATE_STOP_WORDS.has(w) && w.length > 1);
  if (words.length === 0) return normalized;
  return words.slice(0, 3).join(" ");
}

export interface DynamicCounterpartRule {
  pattern: string;
  canonicalName: string;
  defaultCategory?: string | null;
  confidenceScore?: number;
  source?: string;
  isEnabled?: boolean;
}

export function classifyTransactionDescription(
  description?: string | null,
  counterpartName?: string | null,
  dynamicRules: DynamicCounterpartRule[] = [],
): TransactionClassification {
  const normalizedText = normalizeTransactionText(description, counterpartName);

  // 1. Prioridade máxima: Regras dinâmicas do usuário ou aprendidas de extratos oficiais
  const activeRules = dynamicRules.filter((r) => r.isEnabled !== false);
  for (const rule of activeRules) {
    if (matchesCategoryPattern(normalizedText, rule.pattern)) {
      const isUserConfirmed = rule.source === "USER_CONFIRMED";
      return {
        normalizedText,
        merchantName: rule.canonicalName,
        productName: null,
        suggestedCategory: rule.defaultCategory || null,
        confidence: isUserConfirmed || (rule.confidenceScore ?? 85) >= 80 ? "HIGH" : "MEDIUM",
        reason: isUserConfirmed
          ? `Fornecedor confirmado pelo usuário: ${rule.canonicalName}`
          : `Histórico oficial confirmado: ${rule.canonicalName}`,
        matchedPattern: rule.pattern,
      };
    }
  }

  // 2. Regras globais determinísticas (Google, Meta, etc.)
  for (const rule of RULES) {
    const matchedPattern = rule.patterns.find((pattern) => pattern.test(normalizedText));
    if (matchedPattern) {
      return {
        normalizedText,
        merchantName: rule.merchantName,
        productName: rule.productName || null,
        suggestedCategory: rule.category,
        confidence: rule.productName ? "HIGH" : "MEDIUM",
        reason: rule.productName
          ? `Fornecedor e produto identificados: ${rule.productName}`
          : `Fornecedor identificado: ${rule.merchantName}`,
        matchedPattern: matchedPattern.source,
      };
    }
  }

  // 3. Fallback seguro: sem falso positivo
  return {
    normalizedText,
    merchantName: null,
    productName: null,
    suggestedCategory: null,
    confidence: "LOW",
    reason: "Descrição sem fornecedor ou produto reconhecido com segurança",
    matchedPattern: null,
  };
}
