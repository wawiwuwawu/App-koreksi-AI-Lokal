#!/bin/sh
set -e

echo "Waiting for database to be reachable..."
MAX_RETRIES=30
RETRY_COUNT=0

until node -e "
const net = require('net');
const url = new URL(process.env.DATABASE_URL);
const port = Number(url.port || 3306);
const socket = net.createConnection({ host: url.hostname, port }, () => {
  socket.end();
  process.exit(0);
});
socket.on('error', () => process.exit(1));
" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "ERROR: Database not ready after ${MAX_RETRIES} retries. Exiting."
    exit 1
  fi
  echo "Database is not ready yet. Retrying in 2 seconds... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

echo "Database is reachable! Running migrations..."
npx prisma migrate deploy

echo "Starting Next.js application..."
exec node server.js
