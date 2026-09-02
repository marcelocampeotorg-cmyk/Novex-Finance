#!/bin/sh
set -eu

compose_file="docker-compose.prod.yml"
env_file=".env.production"

if [ ! -f "$compose_file" ]; then
  echo "ERRO: execute este script na raiz do NOVEX Finance."
  exit 1
fi

if [ ! -f "$env_file" ]; then
  echo "ERRO: .env.production ausente."
  exit 1
fi

mkdir -p backups
chmod 700 backups
chmod 600 "$env_file"

compose() {
  docker compose --env-file "$env_file" -f "$compose_file" "$@"
}

compose config --quiet

if compose ps --status running --services 2>/dev/null | grep -qx db; then
  echo "Gerando backup pré-deploy do banco NOVEX Finance..."
  compose run --rm --no-deps backup /bin/sh /opt/novex/backup-db-container.sh
fi

compose build --pull migrate app worker
compose up -d

attempt=0
until curl -fsS "http://127.0.0.1:${NOVEX_HTTP_PORT:-3001}/api/health" >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "ERRO: aplicação não ficou saudável no prazo."
    compose ps
    compose logs --tail=120 app migrate worker
    exit 1
  fi
  sleep 2
done

compose ps
echo "NOVEX Finance saudável no loopback do servidor."
