#!/usr/bin/env bash
# Script de Backup Automatizado do PostgreSQL — NOVEX Finance
# Gera um dump comprimido e calcula o checksum SHA-256 para integridade.

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/novex_db_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

echo "==== Início do Backup do Banco PostgreSQL (${TIMESTAMP}) ===="

if [ -z "$DATABASE_URL" ]; then
  echo "ERRO: Variável DATABASE_URL não definida."
  exit 1
fi

pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

CHECKSUM=$(sha256sum "$BACKUP_FILE" | awk '{print $1}')
echo "$CHECKSUM  $BACKUP_FILE" > "${BACKUP_FILE}.sha256"

echo "Backup concluído com sucesso: ${BACKUP_FILE}"
echo "Checksum SHA-256: ${CHECKSUM}"

# Limpeza de backups antigos mantendo retenção de X dias
echo "Limpando backups com mais de ${RETENTION_DAYS} dias..."
find "$BACKUP_DIR" -type f -name "novex_db_backup_*.sql.gz*" -mtime +"$RETENTION_DAYS" -exec rm -f {} \;

echo "==== Backup Finalizado com Sucesso ===="
