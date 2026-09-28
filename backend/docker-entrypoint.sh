#!/bin/sh
set -e

cd /app

echo "Migration Prisma..."
npx prisma migrate deploy

if [ "${SEED_DATABASE:-false}" = "true" ]; then
	echo "Seeding requested..."
	# The build compiles prisma/seed.ts together with src (see tsconfig include).
	node dist/prisma/seed.js
fi

echo "Starting backend..."
exec node dist/src/index.js
