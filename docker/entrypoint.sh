#!/bin/sh
#
# Container start-up. POSIX sh, not bash: the image is Debian slim and the script does
# nothing that needs bash.
#
# Migrations run here rather than in the compose service's `command` so that a bare
# `docker run` of the image is also a working deployment — the image carries its own schema,
# so it should refuse to serve a database that is a migration behind.
set -e

if [ -z "${DATABASE_URL}" ]; then
  echo "entrypoint: DATABASE_URL is not set" >&2
  exit 1
fi

if [ -z "${AUTH_SECRET}" ]; then
  echo "entrypoint: AUTH_SECRET is not set — sessions cannot be signed" >&2
  exit 1
fi

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "entrypoint: applying migrations"
  npx prisma migrate deploy
fi

# Off by default and deliberately blunt: `db:seed` replaces the demo rows it owns, so an
# accidental seed on a live database would rewrite the team's data. Set SEED_ON_START=1
# once, for a fresh demo install, and remove it afterwards.
if [ "${SEED_ON_START:-0}" = "1" ]; then
  echo "entrypoint: seeding demo data"
  npm run db:seed
fi

echo "entrypoint: next start on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec npx next start -H "${HOSTNAME:-0.0.0.0}" -p "${PORT:-3000}"
