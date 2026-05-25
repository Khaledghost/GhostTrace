#!/bin/sh
set -eu

if [ "${WAIT_FOR_DB:-true}" = "true" ] && [ "${DB_ENABLED:-true}" != "false" ]; then
  echo "Waiting for PostgreSQL..."
  node /app/docker/wait-for-db.js
fi

exec node server.js
