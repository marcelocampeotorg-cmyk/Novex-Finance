#!/bin/sh
# scripts/view-logs.sh — Utilitário de Visualização e Auditoria de Logs do NOVEX Finance

set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOGS_DIR="$DIR/logs"

mkdir -p "$LOGS_DIR"

COMMAND="${1:-menu}"

case "$COMMAND" in
  app)
    echo "=== [LOGS] Container App (Últimas 100 linhas) ==="
    docker compose --env-file "$DIR/.env.production" -f "$DIR/docker-compose.prod.yml" logs --tail=100 -f app
    ;;
  worker)
    echo "=== [LOGS] Container Worker (Últimas 100 linhas) ==="
    docker compose --env-file "$DIR/.env.production" -f "$DIR/docker-compose.prod.yml" logs --tail=100 -f worker
    ;;
  evolution)
    echo "=== [LOGS] Container Evolution (Status e Health) ==="
    curl -sS http://127.0.0.1:8081/instance/fetchInstances || echo "Evolution offline ou sem resposta"
    ;;
  system)
    echo "=== [LOGS] Arquivo system.log (Operações Gerais) ==="
    if [ -f "$LOGS_DIR/system.log" ]; then
      tail -n 100 "$LOGS_DIR/system.log"
    else
      echo "Nenhum registro ainda em $LOGS_DIR/system.log"
    fi
    ;;
  errors)
    echo "=== [LOGS] Arquivo error.log (Erros do Servidor e Exceções de Cliente) ==="
    if [ -f "$LOGS_DIR/error.log" ]; then
      tail -n 100 "$LOGS_DIR/error.log"
    else
      echo "Nenhum erro registrado em $LOGS_DIR/error.log"
    fi
    ;;
  audit)
    echo "=== [LOGS] Arquivo audit.log (Auditoria Financeira e Operações Sensíveis) ==="
    if [ -f "$LOGS_DIR/audit.log" ]; then
      tail -n 100 "$LOGS_DIR/audit.log"
    else
      echo "Nenhum registro em $LOGS_DIR/audit.log"
    fi
    ;;
  follow)
    echo "=== [LOGS] Acompanhamento em tempo real (system.log e error.log) ==="
    touch "$LOGS_DIR/system.log" "$LOGS_DIR/error.log"
    tail -f "$LOGS_DIR/system.log" "$LOGS_DIR/error.log"
    ;;
  clean)
    echo "=== [LOGS] Rotação / Limpeza de logs antigos ==="
    for f in "$LOGS_DIR"/*.log; do
      if [ -f "$f" ]; then
        tail -n 500 "$f" > "${f}.tmp" && mv "${f}.tmp" "$f"
        echo "Truncado para últimas 500 linhas: $f"
      fi
    done
    ;;
  *)
    echo "========================================================="
    echo "  NOVEX Finance — Utilitário de Visualização de Logs    "
    echo "========================================================="
    echo "Uso: sh scripts/view-logs.sh [comando]"
    echo ""
    echo "Comandos disponíveis:"
    echo "  app        - Seguir logs do container Next.js (app)"
    echo "  worker     - Seguir logs do container de background (worker)"
    echo "  system     - Ver últimas 100 linhas de logs/system.log"
    echo "  errors     - Ver últimas 100 linhas de logs/error.log"
    echo "  audit      - Ver últimas 100 linhas de logs/audit.log"
    echo "  follow     - Acompanhar arquivos de log em tempo real"
    echo "  clean      - Rotacionar e manter apenas últimas 500 linhas"
    echo "========================================================="
    ;;
esac
