#!/bin/sh
set -e

cd /app

echo "Migration Prisma..."
npx prisma migrate deploy

if [ "${SEED_DATABASE:-false}" = "true" ]; then
	echo "Seeding requested..."
	node prisma-dist/seed.js
fi

echo "Starting backend..."
exec node dist/src/index.js
