#!/bin/sh
set -eu

while true; do
  /bin/sh /opt/novex/backup-db-container.sh
  sleep "${BACKUP_INTERVAL_SECONDS:-86400}"
done
