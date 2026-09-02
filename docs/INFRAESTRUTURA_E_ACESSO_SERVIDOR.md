# Guia de Infraestrutura, Acesso ao Servidor e Deploy — NOVEX Finance

> **Documento de Referência Técnica para Engenharia e Agentes (Codex / Antigravity)**
> **Atualizado em:** 2026-09-02
> **Domínio Oficial e Canônico:** `https://finance.novexbr.com.br`
 
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
 
* **Domínio Oficial Único:** `https://finance.novexbr.com.br`
* **Zona no Cloudflare:** `novexbr.com.br` (zona já ativa e gerenciada)
 
### Configuração do Cloudflare Zero Trust Tunnel (Remotely Managed)
* **Account Tag:** `820b26ab31089eb3d67b2c9ffb0cebcd`
* **Tunnel ID:** `658e11b9-3278-4908-a602-fa15fcc34530`
* **Serviço no Host Linux:** `cloudflared.service` (Systemd gerenciado remotamente)
* **Painel de Gerenciamento:** [Cloudflare Zero Trust](https://one.dash.cloudflare.com) -> Networks -> Tunnels
* **Public Hostname Configurado:**
  * **Public Hostname:** `finance.novexbr.com.br`
  * **Subdomain:** `finance`
  * **Domain:** `novexbr.com.br`
  * **Service Type:** `HTTP`
  * **URL de Destino:** `127.0.0.1:3001` (ou `localhost:3001`)
  * **Proxy & HTTPS:** Ativo (gerenciado automaticamente pelo Cloudflare Edge com certificado SSL Universal).

---

## 5. Matriz Completa de Portas e Serviços do Servidor (Zero Conflito)

| Sistema | Serviço / Container | Bind no Host / IP | Porta Interna | Rede Docker |
|---|---|---|---|---|
| **NOVEX Finance** | `novexfinance-prod-app` | `127.0.0.1:3001` | 3000/tcp | `novexfinance-prod-edge`, `backend` |
| **NOVEX Finance** | `novexfinance-prod-evolution` | `127.0.0.1:8081` | 8080/tcp | `novexfinance-prod-edge`, `backend` |
| **NOVEX Finance** | `novexfinance-prod-db` | *Sem bind público* | 5432/tcp | `novexfinance-prod-backend` (internal) |
| **NOVEX Finance** | `novexfinance-prod-redis` | *Sem bind público* | 6379/tcp | `novexfinance-prod-backend` (internal) |
| **NOVEX Finance** | `novexfinance-prod-worker` | *Sem porta* | - | `novexfinance-prod-edge` |
| **Novex Oficina** | `saas-oficina-frontend` | `0.0.0.0:8080` | 80/tcp | `novexoficina_saas_network` |
| **Novex Oficina** | `saas-oficina-api` | `0.0.0.0:3000` | 3000/tcp | `novexoficina_saas_network` |
| **Novex Oficina** | `saas-oficina-evolution` | `0.0.0.0:8082` | 8080/tcp | `novexoficina_saas_network` |
| **Novex Oficina** | `saas-oficina-db` | `0.0.0.0:5434` | 5432/tcp | `novexoficina_saas_network` |
| **Novex Oficina** | `saas-oficina-redis` | `0.0.0.0:6381` | 6379/tcp | `novexoficina_saas_network` |
| **Master Novex** | `novex-master-prod-postgres` | *Sem bind* | 5432/tcp | `novex-master-prod_novex-master-net` |
| **Master Novex** | `novex-master-prod-redis` | *Sem bind* | 6379/tcp | `novex-master-prod_novex-master-net` |
| **Ponto Digital** | Nginx nativo | `0.0.0.0:5001` | - | Host |

---

## 6. Comandos Operacionais e Runbooks de Diagnóstico

### A. Subir ou Atualizar a Stack do Finance
```bash
ssh servidor@192.168.4.12
cd "/home/servidor/Área de trabalho/Sistemas/novex finance"
sh scripts/deploy-server.sh
```

### B. Diagnóstico do Cloudflare Tunnel
```bash
# Verificar status do serviço do túnel
systemctl status cloudflared

# Ver últimos logs de tráfego e conexão do túnel
journalctl -u cloudflared -n 50 --no-pager
```

### C. Diagnóstico dos Serviços do NOVEX Finance
```bash
cd "/home/servidor/Área de trabalho/Sistemas/novex finance"

# Status de todos os containers do projeto
docker compose --env-file .env.production -f docker-compose.prod.yml ps

# Healthcheck interno do Next.js
curl -fsS http://127.0.0.1:3001/api/health

# Acompanhar logs do worker
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail=50 worker

# Verificar integridade da Evolution API via loopback
curl -fsS http://127.0.0.1:8081/instance/fetchInstances
```

### D. Rotina de Backup e Restauração
```bash
cd "/home/servidor/Área de trabalho/Sistemas/novex finance"

# Executar backup manual sob demanda
sh scripts/backup-db.sh

# Restaurar backup verificado em caso de contingência
sh scripts/restore-db.sh backups/nome_do_arquivo.sql.gz
```
