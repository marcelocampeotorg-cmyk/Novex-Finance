# Guia de Infraestrutura, Acesso ao Servidor e Deploy — NOVEX Finance

> **Documento de Referência Técnica para Engenharia e Agentes (Codex / Antigravity)**
> **Atualizado em:** 2026-09-02
> **Domínio Oficial e Canônico:** `https://www.app.novexfinance.com.br` (Obrigatório o uso de `www.`)

---

## 1. Dados de Conexão e Acesso ao Servidor

* **Host / IP:** `192.168.4.12`
* **Porta SSH:** `22`
* **Usuário:** `servidor`
* **Comando de Acesso SSH:**
  ```bash
  ssh -o StrictHostKeyChecking=no servidor@192.168.4.12
  ```
* **Permissões do Usuário `servidor`:**
  * Pertence ao grupo `docker` (executa `docker` e `docker compose` diretamente sem necessidade de `sudo`);
  * Permissão de leitura e escrita completa no diretório da sua home.

---

## 2. Caminhos e Diretórios no Servidor

* **Diretório Raiz do NOVEX Finance:**
  `/home/servidor/Área de trabalho/Sistemas/novex finance`
* **Arquivo de Configuração de Produção:**
  `/home/servidor/Área de trabalho/Sistemas/novex finance/.env.production` (permissão `600`)
* **Arquivo Docker Compose de Produção:**
  `/home/servidor/Área de trabalho/Sistemas/novex finance/docker-compose.prod.yml`
* **Diretório de Backups Periódicos:**
  `/home/servidor/Área de trabalho/Sistemas/novex finance/backups`
* **Scripts Operacionais:**
  `/home/servidor/Área de trabalho/Sistemas/novex finance/scripts/` (`deploy-server.sh`, `backup-db.sh`, `backup-loop.sh`, `restore-db.sh`)

---

## 3. Princípio Rígido de Isolamento Arquitetural

O servidor hospeda múltiplos sistemas em produção que **NUNCA PODEM SER AFETADOS**:
* **Novex Oficina / SaaS:** Containers `saas-oficina-*` na rede `novexoficina_saas_network` (portas 8080, 3000, 5434, 6381, 8082);
* **Master Novex:** Containers `novex-master-*` (portas 3100, 5433, 6380);
* **Ponto Digital:** Nginx nativo na porta 5001.

### Regras de Isolamento do NOVEX Finance:
1. **Project Name Docker Exclusivo:** `novexfinance-prod` (definido no `docker-compose.prod.yml`);
2. **Redes Próprias e Isoladas:**
   * `novexfinance-prod-edge` (comunicação entre app, worker e evolution);
   * `novexfinance-prod-backend` (`internal: true`, isolando banco de dados, redis, migration e backup da rede externa);
3. **Volumes Próprios:**
   * `novexfinance-prod-postgres-data`
   * `novexfinance-prod-redis-data`
   * `novexfinance-prod-uploads-data`
4. **Portas Mapeadas no Host:**
   * **App Next.js:** Apenas em loopback `127.0.0.1:3001` (porta 3001);
   * **Evolution API:** Apenas em loopback `127.0.0.1:8081` (porta 8081);
   * **PostgreSQL e Redis:** Portas internas da rede Docker, **SEM bind público ou de host**.

---

## 4. Domínio Oficial, DNS e Cloudflare Zero Trust

* **Domínio Oficial Único:** `www.app.novexfinance.com.br`
* **Proibição Absoluta:** Nunca utilizar `app.novexfinance.com.br` (sem www), `finance.novexbr.com.br` ou qualquer outro domínio.
* **Túnel Cloudflare (Remotely Managed):**
  * O servidor roda o serviço systemd `cloudflared.service` gerenciado remotamente pelo painel do **Cloudflare Zero Trust** (Tunnel ID `658e11b9-3278-4908-a602-fa15fcc34530`).
  * **Roteamento no Cloudflare Zero Trust:**
    * **Public Hostname:** `www.app.novexfinance.com.br`
    * **Service:** `HTTP`
    * **URL:** `localhost:3001` (ou `127.0.0.1:3001`)

---

## 5. Comandos Operacionais para o Codex / Desenvolvedor

### A. Subir ou Atualizar a Stack de Produção
```bash
ssh servidor@192.168.4.12
cd "/home/servidor/Área de trabalho/Sistemas/novex finance"
sh scripts/deploy-server.sh
```

### B. Comandos Manuais do Docker Compose
```bash
cd "/home/servidor/Área de trabalho/Sistemas/novex finance"

# Validar sintaxe e variáveis
docker compose --env-file .env.production -f docker-compose.prod.yml config

# Rebuild das imagens
docker compose --env-file .env.production -f docker-compose.prod.yml build

# Executar migrações do Prisma
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm migrate

# Iniciar todos os serviços em background
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

# Visualizar status dos containers
docker compose --env-file .env.production -f docker-compose.prod.yml ps

# Acompanhar logs em tempo real
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f app worker

# Testar saúde da aplicação localmente no servidor
curl -fsS http://127.0.0.1:3001/api/health
```

### C. Rotina de Backup e Restauração
```bash
# Executar backup manual do banco do Finance
sh scripts/backup-db.sh

# Restaurar backup (somente se necessário)
sh scripts/restore-db.sh backups/caminho_do_arquivo.sql.gz
```
