#!/usr/bin/env bash
#
# All-in-one dev/demo entrypoint: boots an embedded PostgreSQL alongside the
# Timesheet Portal (Go API + static Next.js frontend) inside a single container.
#
# On first run the official postgres entrypoint runs initdb and creates the
# POSTGRES_DB / POSTGRES_USER from the environment below; the data directory is
# ephemeral unless a volume is mounted at $PGDATA.

set -euo pipefail

export POSTGRES_USER="${POSTGRES_USER:-timesheet}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-timesheet}"
export POSTGRES_DB="${POSTGRES_DB:-timesheet}"

echo "[aio] starting embedded PostgreSQL..."
# The postgres base image ships docker-entrypoint.sh on PATH; run it as root so
# it can initdb and drop privileges to the postgres user, backgrounded so we can
# also run the app in this container.
docker-entrypoint.sh postgres &
PG_PID=$!

echo "[aio] waiting for PostgreSQL to accept connections..."
# pg_isready over TCP only succeeds once the real server (post-init) is up, by
# which point POSTGRES_DB / POSTGRES_USER already exist.
until pg_isready -h localhost -U "$POSTGRES_USER" >/dev/null 2>&1; do
  if ! kill -0 "$PG_PID" 2>/dev/null; then
    echo "[aio] PostgreSQL exited during startup" >&2
    exit 1
  fi
  sleep 1
done
echo "[aio] PostgreSQL is ready."

# Point the app at the embedded database unless the operator overrides it.
export DATABASE_URL="${DATABASE_URL:-host=localhost user=${POSTGRES_USER} password=${POSTGRES_PASSWORD} dbname=${POSTGRES_DB} port=5432 sslmode=disable TimeZone=Asia/Jakarta}"

echo "[aio] starting Timesheet Portal (API + frontend) on port ${PORT:-8080}..."
./main &
APP_PID=$!

# Propagate termination to both children and exit when either one stops.
shutdown() {
  kill -TERM "$APP_PID" "$PG_PID" 2>/dev/null || true
}
trap shutdown TERM INT

wait -n "$APP_PID" "$PG_PID"
STATUS=$?
echo "[aio] a process exited (status ${STATUS}); shutting down..."
shutdown
wait || true
exit "$STATUS"
