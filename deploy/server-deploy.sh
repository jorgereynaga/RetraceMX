#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
ENV_FILE="$ROOT_DIR/.env.production"

log() {
  printf '[ReTrace MX] %s\n' "$*"
}

fail() {
  printf '[ReTrace MX] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

cd "$ROOT_DIR"

log "Starting production deployment from $ROOT_DIR"

require_command docker

if [[ ! -f "$ENV_FILE" ]]; then
  fail "Missing .env.production. Copy .env.production.example and configure it first."
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  fail "Missing docker-compose.prod.yml."
fi

log "Validating compose configuration"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config >/dev/null

log "Building and starting services"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up --build -d --remove-orphans

log "Waiting for backend to become available"
sleep 5

log "Current service status"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

log "Running Django system check"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend python manage.py check

log "Deployment complete"
log "Frontend: https://retracemx.softwaresci.org"
log "API: https://apiretracemx.softwaresci.org"
