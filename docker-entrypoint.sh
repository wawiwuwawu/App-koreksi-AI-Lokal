#!/bin/sh

# Exit immediately if a command exits with a non-zero status
set -e

echo "Waiting for database to be ready..."
until npx prisma migrate status > /dev/null 2>&1; do
  echo "Database is not ready yet. Retrying in 2 seconds..."
  sleep 2
done

echo "Database is ready! Running migrations..."
npx prisma migrate deploy

echo "Checking if database needs seeding..."
# Check if database is empty using a quick node script with Prisma client
node -e "
const { PrismaClient } = require('./generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => {
    const adapter = new PrismaPg(client);
    const prisma = new PrismaClient({ adapter });
    return prisma.lecturer.count();
  })
  .then((count) => {
    if (count === 0) {
      console.log('No lecturers found. Database is empty. Seeding...');
      process.exit(0);
    } else {
      console.log('Lecturers already exist. Skipping seed.');
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Error checking database status:', err);
    process.exit(2);
  });
" && SEED_STATUS=0 || SEED_STATUS=$?

if [ "$SEED_STATUS" -eq 0 ]; then
  echo "Executing database seed..."
  npx prisma db seed
elif [ "$SEED_STATUS" -eq 1 ]; then
  echo "Database already has data. Skipping seed."
else
  echo "Failed to check database status (Code: $SEED_STATUS). Skipping seed to prevent errors."
fi

echo "Starting Next.js application..."
exec node server.js
