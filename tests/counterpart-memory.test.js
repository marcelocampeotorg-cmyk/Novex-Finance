import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyTransactionDescription,
  extractCounterpartPattern,
  normalizeTransactionText,
  matchesCategoryPattern,
} from "../src/domain/transaction-classification.ts";
import { toTitleCaseCounterpart } from "../src/domain/mercado-pago-account-statement.ts";

test("Counterpart Memory: toTitleCaseCounterpart formata nomes preservando siglas e conectivos", () => {
  assert.equal(toTitleCaseCounterpart("FACEBOOK SERVICOS ONLINE DO BRASIL LTDA"), "Facebook Servicos Online do Brasil LTDA");
  assert.equal(toTitleCaseCounterpart("JOVANI ROSA DOS SANTOS"), "Jovani Rosa dos Santos");
  assert.equal(toTitleCaseCounterpart("POSTO DE COMBUSTIVEIS IPIRANGA S.A."), "Posto de Combustiveis Ipiranga S.A.");
  assert.equal(toTitleCaseCounterpart("ENEL DISTRIBUICAO DE ENERGIA"), "Enel Distribuicao de Energia");
  assert.equal(toTitleCaseCounterpart(""), "");
  assert.equal(toTitleCaseCounterpart(null), "");
});

test("Counterpart Memory: extractCounterpartPattern extrai termo chave conciso", () => {
  assert.equal(extractCounterpartPattern("FACEBOOK SERVICOS ONLINE DO BRASIL LTDA"), "facebook online");
  assert.equal(extractCounterpartPattern("MERCADO PAGO INSTITUICAO DE PAGAMENTO LTDA"), "mercado pago");
  assert.equal(extractCounterpartPattern("POSTO SHELL COMBUSTIVEIS LTDA"), "posto shell combustiveis");
});

test("Counterpart Memory: classifyTransactionDescription com regras dinâmicas", () => {
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
      pattern: "posto shell",
      canonicalName: "Posto Shell Conveniência",
      defaultCategory: "Transporte & Combustível",
      source: "USER_CONFIRMED",
      confidenceScore: 95,
      isEnabled: true,
    },
    {
      pattern: "regra inativa",
      canonicalName: "Inativa",
      isEnabled: false,
    },
  ];

  // 1. Match de regra aprendida do extrato oficial
  const res1 = classifyTransactionDescription("Pagamento via Pix Facebook Online Campanha 01", null, dynamicRules);
  assert.equal(res1.merchantName, "Facebook Serviços Online");
  assert.equal(res1.confidence, "HIGH");
  assert.equal(res1.suggestedCategory, "Marketing & Anúncios");

  // 2. Match de regra confirmada pelo usuário
  const res2 = classifyTransactionDescription("Compra débito Posto Shell Centro", null, dynamicRules);
  assert.equal(res2.merchantName, "Posto Shell Conveniência");
  assert.equal(res2.confidence, "HIGH");
  assert.equal(res2.suggestedCategory, "Transporte & Combustível");

  // 3. Regra desativada não dá match
  const res3 = classifyTransactionDescription("Operação com regra inativa", null, dynamicRules);
  assert.equal(res3.merchantName, null);
  assert.equal(res3.confidence, "LOW");

  // 4. Sem falso positivo para transação não relacionada
  const res4 = classifyTransactionDescription("Pagamento avulso desconhecido 999", null, dynamicRules);
  assert.equal(res4.merchantName, null);
  assert.equal(res4.confidence, "LOW");
});
