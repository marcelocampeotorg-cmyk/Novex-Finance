import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Zero Hardcoding e Isolamento: Docker Compose de Produção", () => {
  const composePath = path.resolve(process.cwd(), "docker-compose.prod.yml");
  assert.ok(fs.existsSync(composePath), "docker-compose.prod.yml deve existir na raiz do projeto");

  const composeContent = fs.readFileSync(composePath, "utf8");

  // 1. Project name exclusivo
  assert.match(composeContent, /^name:\s*novexfinance-prod/m, "Project name deve ser 'novexfinance-prod'");

  // 2. Redes exclusivas com prefixo do produto
  assert.match(composeContent, /novexfinance-prod-edge/, "Rede de borda deve ter prefixo exclusivo");
  assert.match(composeContent, /novexfinance-prod-backend/, "Rede de backend deve ter prefixo exclusivo");
  assert.match(composeContent, /internal:\s*true/, "Rede backend deve ser estritamente interna (internal: true)");

  // 3. Volumes exclusivos com prefixo do produto
  assert.match(composeContent, /novexfinance-prod-postgres-data/, "Volume do Postgres deve ser exclusivo");
  assert.match(composeContent, /novexfinance-prod-redis-data/, "Volume do Redis deve ser exclusivo");
  assert.match(composeContent, /novexfinance-prod-uploads-data/, "Volume de Uploads deve ser exclusivo");

  // 4. Portas mapeadas exclusivamente no loopback do host (Zero exposição pública de portas)
  assert.match(composeContent, /127\.0\.0\.1:\$\{NOVEX_HTTP_PORT:-3001\}:3000/, "App deve estar vinculado estritamente a 127.0.0.1:3001");
  assert.match(composeContent, /127\.0\.0\.1:\$\{NOVEX_EVOLUTION_PORT:-8081\}:8080/, "Evolution deve estar vinculada estritamente a 127.0.0.1:8081");

  // 5. Banco de dados e Redis não devem ter mapeamento de porta para o host
  const dbMatch = composeContent.match(/\n  db:\s*\n([\s\S]*?)(?=\n  [a-z0-9_-]+:|$)/);
  const dbSection = dbMatch ? dbMatch[1] : "";
  assert.doesNotMatch(dbSection, /ports:\s*\n\s*-\s*["']?\d+/, "Banco de dados não deve expor portas no host");

  const redisMatch = composeContent.match(/\n  redis:\s*\n([\s\S]*?)(?=\n  [a-z0-9_-]+:|$)/);
  const redisSection = redisMatch ? redisMatch[1] : "";
  assert.doesNotMatch(redisSection, /ports:\s*\n\s*-\s*["']?\d+/, "Redis não deve expor portas no host");

  // 6. Limites de recursos definidos para todos os containers (proteção contra exaustão de memória no host compartilhado)
  assert.match(composeContent, /memory:\s*512M/, "Limites de memória devem estar definidos");
  assert.match(composeContent, /memory:\s*128M/, "Limites de memória do worker/redis devem estar definidos");

  // 7. Não colisão com outros produtos (Oficina, Trader, Master)
  assert.doesNotMatch(composeContent, /saas-oficina/, "Não deve haver referências a containers da Oficina");
  assert.doesNotMatch(composeContent, /novex_trade/, "Não deve haver referências a containers do Trade");
  assert.doesNotMatch(composeContent, /novex-master/, "Não deve haver referências a containers do Master");
});

test("Zero Hardcoding: Varredura de Código Fonte (src)", () => {
  const srcDir = path.resolve(process.cwd(), "src");

  function getFiles(dir, files = []) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        getFiles(fullPath, files);
      } else if (/\.(ts|tsx|js|mjs)$/.test(file)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const allFiles = getFiles(srcDir);
  assert.ok(allFiles.length > 50, "Deve haver arquivos no diretório src");

  for (const filePath of allFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");

    // Veto a chaves de produção reais hardcoded
    const liveTokenMatch = content.match(/APP_USR-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i);
    assert.equal(liveTokenMatch, null, `Chave/token real embutido encontrado em ${relativePath}`);

    // Veto a IP privado do servidor hardcoded no código de execução
    const privateIpMatch = content.match(/192\.168\.\d+\.\d+/);
    assert.equal(privateIpMatch, null, `IP privado fixo encontrado em ${relativePath}`);
  }
});
