#!/usr/bin/env bash
# Script de Restauração Controlada do PostgreSQL — NOVEX Finance
# Valida o checksum SHA-256 e restaura o dump comprimido de backup.

set -e

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "Uso: ./scripts/restore-db.sh <caminho_do_arquivo_backup.sql.gz>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERRO: Arquivo de backup não encontrado: ${BACKUP_FILE}"
  exit 1
fi

# Validar checksum se o arquivo .sha256 existir
if [ -f "${BACKUP_FILE}.sha256" ]; then
  echo "Verificando integridade SHA-256..."
  sha256sum -c "${BACKUP_FILE}.sha256"
  echo "Checksum validado com sucesso!"
fi

echo "==== Restaurando banco de dados a partir de: ${BACKUP_FILE} ===="

gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"

echo "==== Restauração Concluída com Sucesso ===="
