#!/bin/sh
set -eu

compose_file="docker-compose.prod.yml"
env_file=".env.production"
dump_dir="${1:-backups/migration-20260902}"
app_dump="$dump_dir/novexfinance-app.dump"
evolution_dump="$dump_dir/novexfinance-evolution.dump"

if [ ! -f "$compose_file" ] || [ ! -f "$env_file" ]; then
  echo "ERRO: execute este script na raiz do NOVEX Finance."
  exit 1
fi

if [ ! -f "$app_dump" ] || [ ! -f "$evolution_dump" ]; then
  echo "ERRO: dumps de migração ausentes em $dump_dir."
  exit 1
fi

compose() {
  docker compose --env-file "$env_file" -f "$compose_file" "$@"
}

compose up -d db redis

main_tables="$(compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT count(1) FROM information_schema.tables WHERE table_schema = '\''public'\'';"')"
evolution_tables="$(compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d evolution_db -Atc "SELECT count(1) FROM information_schema.tables WHERE table_schema = '\''public'\'';"')"

if [ "$main_tables" != "0" ] || [ "$evolution_tables" != "0" ]; then
  echo "ERRO: restore permitido somente em bancos novos e vazios (principal=$main_tables, evolution=$evolution_tables)."
  exit 1
fi

compose cp "$app_dump" db:/tmp/novexfinance-app.dump
compose cp "$evolution_dump" db:/tmp/novexfinance-evolution.dump

compose exec -T db sh -lc 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner /tmp/novexfinance-app.dump'
compose exec -T db sh -lc 'pg_restore -U "$POSTGRES_USER" -d evolution_db --no-owner /tmp/novexfinance-evolution.dump'
compose exec -T db rm -f /tmp/novexfinance-app.dump /tmp/novexfinance-evolution.dump

compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT (SELECT count(1) FROM workspaces),(SELECT count(1) FROM external_transactions),(SELECT count(1) FROM ledger_entries),(SELECT count(1) FROM _prisma_migrations);"'
compose exec -T db sh -lc 'psql -U "$POSTGRES_USER" -d evolution_db -Atc "SELECT count(1) FROM information_schema.tables WHERE table_schema = '\''public'\'';"'
