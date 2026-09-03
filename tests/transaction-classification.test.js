import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyTransactionDescription,
  matchesCategoryPattern,
  normalizeTransactionText,
} from "../src/domain/transaction-classification.ts";

test("distingue produtos Google que pertencem a categorias diferentes", () => {
  assert.equal(classifyTransactionDescription("GOOGLE*ADS").suggestedCategory, "Marketing & Anúncios");
  assert.equal(classifyTransactionDescription("Google Cloud Platform").suggestedCategory, "Infraestrutura & Hospedagem");
  assert.equal(classifyTransactionDescription("GOOGLE ONE").suggestedCategory, "Softwares & Ferramentas");
  assert.equal(classifyTransactionDescription("YouTubePremium").suggestedCategory, "Assinaturas & Lazer");
});

test("normaliza variações conhecidas de Meta e Facebook", () => {
  const facebk = classifyTransactionDescription("FACEBK *AB12CD");
  const meta = classifyTransactionDescription("META ADS 849201");

  assert.equal(facebk.merchantName, "Meta");
  assert.equal(facebk.productName, "Meta Ads");
  assert.equal(meta.suggestedCategory, "Marketing & Anúncios");
});

test("não classifica Google genérico como um produto específico", () => {
  const result = classifyTransactionDescription("Pagamento Google");

  assert.equal(result.suggestedCategory, null);
  assert.equal(result.confidence, "LOW");
});

test("regra textual respeita limites de palavras e acentos", () => {
  assert.equal(matchesCategoryPattern("Pagamento no São Paulo Center", "são paulo"), true);
  assert.equal(matchesCategoryPattern("Assinatura TIM", "tim"), true);
  assert.equal(matchesCategoryPattern("Ótimo Mercado", "tim"), false);
  assert.equal(normalizeTransactionText("  META*ADS  "), "meta ads");
});

test("extrai padrão nuclear de fornecedor removendo sufixos empresariais", async () => {
  const { extractCounterpartPattern } = await import("../src/domain/transaction-classification.ts");
  assert.equal(extractCounterpartPattern("FACEBOOK SERVICOS ONLINE DO BRASIL LTDA"), "facebook online");
  assert.equal(extractCounterpartPattern("AUTO PECAS GOIANIA ME"), "auto pecas goiania");
  assert.equal(extractCounterpartPattern("POSTO IPIRANGA S.A."), "posto ipiranga");
});

test("classificação com regras dinâmicas tem prioridade máxima e respeita isEnabled", () => {
  const dynamicRules = [
    {
      pattern: "facebook online",
      canonicalName: "Facebook Serviços Online",
      defaultCategory: "Marketing & Anúncios",
      source: "OFFICIAL_STATEMENT",
      confidenceScore: 90,
      isEnabled: true,
    },
    {
      pattern: "fornecedor desativado",
      canonicalName: "Regra Desativada",
      source: "USER_CONFIRMED",
      isEnabled: false,
    },
  ];

  const matched = classifyTransactionDescription("Pagamento Pix Facebook Online 1234", null, dynamicRules);
  assert.equal(matched.merchantName, "Facebook Serviços Online");
  assert.equal(matched.confidence, "HIGH");
  assert.equal(matched.suggestedCategory, "Marketing & Anúncios");

  const disabledMatch = classifyTransactionDescription("Pagamento fornecedor desativado", null, dynamicRules);
  assert.equal(disabledMatch.merchantName, null);
  assert.equal(disabledMatch.confidence, "LOW");
});

