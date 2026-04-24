#!/bin/sh
set -e

echo "=========================================="
echo "ZAPAI BACKEND - DOCKER ENTRYPOINT"
echo "=========================================="

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q'; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "PostgreSQL is ready!"

# Run migrations
echo "Running database migrations..."
node scripts/init-database.js || echo "Migrations skipped or already up-to-date"

# Run seed admin
echo "Seeding admin user..."
node scripts/seed-admin.js || echo "Admin seed skipped or already done"

# Start the application
echo "Starting backend server..."
exec node server.js
