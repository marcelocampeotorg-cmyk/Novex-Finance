#!/bin/bash
set -euo pipefail

DEST="/home/servidor/Área de trabalho/Sistemas/novex finance"

mkdir -p "$DEST/src/app/api/logs/client" "$DEST/logs"

cp /tmp/formatters.ts "$DEST/src/lib/formatters.ts"
cp /tmp/logger.ts "$DEST/src/lib/logger.ts"
cp /tmp/error.tsx "$DEST/src/app/error.tsx"
cp /tmp/global-error.tsx "$DEST/src/app/global-error.tsx"
cp /tmp/route_client_logs.ts "$DEST/src/app/api/logs/client/route.ts"
cp /tmp/docker-compose.prod.yml "$DEST/docker-compose.prod.yml"
cp /tmp/view-logs.sh "$DEST/scripts/view-logs.sh"
chmod +x "$DEST/scripts/view-logs.sh"
cp /tmp/page_protected.tsx "$DEST/src/app/(protected)/page.tsx"
cp /tmp/workspace.ts "$DEST/src/server/actions/workspace.ts"

echo "ALL_FILES_SYNCED_OK"
