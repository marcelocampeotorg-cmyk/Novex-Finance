const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

const DEFAULT_BRAZILIAN_PATTERNS = [
  {
    categoryTarget: 'Alimentação & Mercado',
    patterns: [
      'ifood', 'rappi', 'mcdonald', 'burger king', 'habibs', 'subway', 'padaria', 'restaurante',
      'pizzaria', 'lanchonete', 'churrascaria', 'carrefour', 'pao de acucar', 'assai', 'atacadao',
      'extra', 'dia', 'supermercado', 'mercado', 'hortifruti', 'acougue', 'sams club', 'doceria', 'sorveteria'
    ]
  },
  {
    categoryTarget: 'Transporte & Mobilidade',
    patterns: [
      'uber', '99app', '99pop', 'taxi', 'estacionamento', 'pedagio', 'sem parar', 'veloe',
      'conectcar', 'moovit', 'metro', 'autopass', 'posto', 'shell', 'ipiranga', 'petrobras',
      'br distribuidora', 'ale', 'gasolina', 'combustivel', 'abastecimento', 'estapar'
    ]
  },
  {
    categoryTarget: 'Saúde & Farmácia',
    patterns: [
      'droga raia', 'drogasil', 'pacheco', 'pague menos', 'panvel', 'farmacia', 'drogaria',
      'laboratorio', 'hospital', 'clinica', 'unimed', 'dentista', 'otica', 'consulta medica'
    ]
  },
  {
    categoryTarget: 'Assinaturas & Lazer',
    patterns: [
      'netflix', 'spotify', 'youtube', 'prime video', 'disney', 'max', 'deezer', 'apple',
      'globo', 'twitch', 'crunchyroll', 'cinema', 'ingresso', 'sympla', 'eventim'
    ]
  },
  {
    categoryTarget: 'Telecom & Internet',
    patterns: [
      'claro', 'vivo', 'tim', 'oi', 'net virtua', 'starlink', 'algar', 'telefonia', 'internet'
    ]
  },
  {
    categoryTarget: 'Serviços & Softwares',
    patterns: [
      'google', 'aws', 'digitalocean', 'github', 'chatgpt', 'openai', 'anthropic', 'cursor',
      'canva', 'adobe', 'microsoft', 'hostinger', 'godaddy', 'vercel', 'slack', 'zoom', 'notion'
    ]
  },
  {
    categoryTarget: 'Compras & E-commerce',
    patterns: [
      'mercado livre', 'shopee', 'amazon', 'shein', 'aliexpress', 'magalu', 'magazine luiza',
      'casas bahia', 'americanas', 'zara', 'renner', 'riachuelo', 'centauro', 'netshoes', 'relogio'
    ]
  },
  {
    categoryTarget: 'Moradia & Utilidades',
    patterns: [
      'enel', 'sabesp', 'copel', 'cemig', 'cpfl', 'luz', 'agua', 'energia', 'aluguel',
      'imobiliaria', 'condominio', 'iptu', 'comgas'
    ]
  },
  {
    categoryTarget: 'Rendimentos & Tarifas MP',
    patterns: [
      'settlement', 'rendimento', 'tarifa', 'iof', 'taxa', 'tarifa bancaria'
    ]
  },
  {
    categoryTarget: 'Transferências & Carteiras',
    patterns: [
      'payouts', 'saque', 'retirada', '99pay', 'picpay', 'c6', 'santander', 'nu pagamentos',
      'nubank', 'inter', 'pagseguro', 'itau', 'bradesco', 'banco do brasil', 'caixa', 'bancoob', 'asaas'
    ]
  }
];

async function seed(workspaceId) {
  const categories = await db.category.findMany({ where: { workspaceId } });
  let seeded = 0;
  for (const group of DEFAULT_BRAZILIAN_PATTERNS) {
    const matched = categories.find(c =>
      c.name.toLowerCase().includes(group.categoryTarget.toLowerCase()) ||
      group.categoryTarget.toLowerCase().includes(c.name.toLowerCase())
    );
    if (!matched) continue;
    for (const pattern of group.patterns) {
      await db.categoryRule.upsert({
        where: { workspaceId_pattern: { workspaceId, pattern: pattern.toLowerCase().trim() } },
        update: { categoryId: matched.id, confidenceScore: 90, isEnabled: true },
        create: { workspaceId, pattern: pattern.toLowerCase().trim(), categoryId: matched.id, confidenceScore: 90, source: 'SYSTEM', isEnabled: true },
      });
      seeded++;
    }
  }
  return seeded;
}

async function main() {
  const targetWs = '28bac964-1e8b-4adb-8f67-a2c00ee23fbe';
  const total = await seed(targetWs);
  console.log(`REGRAS_SEMEADAS_COM_SUCESSO: ${total}`);

  // Auto-categorizar movimentacoes existentes que baterem com as regras
  const rules = await db.categoryRule.findMany({
    where: { workspaceId: targetWs, isEnabled: true },
    orderBy: { confidenceScore: 'desc' }
  });

  const txs = await db.externalTransaction.findMany({
    where: { workspaceId: targetWs, quarantinedAt: null },
    include: { ledgerEntries: true }
  });

  let categorized = 0;
  for (const tx of txs) {
    const text = `${tx.description || ''} ${tx.counterpartName || ''}`.toLowerCase();
    const rule = rules.find(r => text.includes(r.pattern.toLowerCase().trim()));
    if (rule) {
      for (const entry of tx.ledgerEntries) {
        if (!entry.categoryId || entry.categoryId !== rule.categoryId) {
          await db.ledgerEntry.update({
            where: { id: entry.id },
            data: { categoryId: rule.categoryId }
          });
          categorized++;
        }
      }
    }
  }
  console.log(`MOVIMENTACOES_AUTO_CATEGORIZADAS: ${categorized}`);
}

main().catch(console.error).finally(() => db.$disconnect());
