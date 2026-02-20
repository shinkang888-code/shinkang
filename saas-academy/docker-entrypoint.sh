#!/bin/sh
# docker-entrypoint.sh  – runs before CMD
set -e

echo "⏳  Waiting for PostgreSQL …"
# Simple pg-ready loop (nc is available in alpine)
until nc -z "${POSTGRES_HOST:-postgres}" "${POSTGRES_PORT:-5432}"; do
  echo "   postgres not ready – sleeping 2s"
  sleep 2
done
echo "✅  PostgreSQL is up."

echo "⏳  Running Prisma migrate deploy …"
npx prisma migrate deploy --schema=prisma/schema.prisma
echo "✅  Migrations done."

# Optionally seed if SEED=true
if [ "${SEED:-false}" = "true" ]; then
  echo "🌱  Seeding …"
  node -e "require('./prisma/seed.js')" 2>/dev/null || \
    npx tsx prisma/seed.ts || true
  echo "✅  Seed done."
fi

exec "$@"
