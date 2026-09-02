#!/bin/sh
set -eu

umask 077
mkdir -p /backups

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="/backups/novexfinance-${timestamp}.dump"

pg_dump --format=custom --file="$backup_file"
sha256sum "$backup_file" > "${backup_file}.sha256"

retention_days="${BACKUP_RETENTION_DAYS:-14}"
find /backups -maxdepth 1 -type f -name 'novexfinance-*.dump' -mtime "+${retention_days}" -delete
find /backups -maxdepth 1 -type f -name 'novexfinance-*.dump.sha256' -mtime "+${retention_days}" -delete

echo "backup NOVEX Finance concluído: $(basename "$backup_file")"
