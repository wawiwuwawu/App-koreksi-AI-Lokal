# Stage 1: Install semua dependensi (termasuk devDependencies untuk build Next.js)
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Salin package.json & package-lock.json
COPY package.json package-lock.json ./
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci && \
    npm install --no-save @napi-rs/canvas-linux-x64-musl@1.0.0 @napi-rs/canvas-linux-arm64-musl@1.0.0 --force

# Stage 2: Build Aplikasi Next.js
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Salin dependensi dari Stage 1 dan seluruh kode sumber
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Suntikkan variabel dummy agar lolos validasi Prisma config saat build
ENV DATABASE_URL=mysql://dummy:dummy@localhost:3306/dummy
ENV DB_HOST=localhost
ENV DB_PORT=3306
ENV DB_USER=dummy
ENV DB_PASSWORD=dummy
ENV DB_NAME=dummy
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client dan build aplikasi Next.js
RUN npx prisma generate && npm run build

# Stage 3: Production Runner (Image Akhir yang Ringan & Aman)
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Konfigurasi Environment default produksi
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 1. Buat grup dan user khusus non-root demi keamanan kontainer
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 2. Salin output build standalone Next.js & static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 3. Salin folder prisma, skema, dan migrasi untuk keperluan runtime migration
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# 4. Hapus paket parsial dari standalone (tree-shaken oleh Next.js) lalu install ulang secara utuh
RUN rm -rf node_modules/@prisma node_modules/prisma \
      node_modules/mariadb \
      node_modules/tsx node_modules/esbuild node_modules/dotenv && \
    npm install --no-save prisma@7 tsx dotenv @prisma/client @prisma/adapter-mariadb mariadb

# 5. Salin & siapkan script entrypoint
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# 6. Ubah kepemilikan direktori kerja ke user non-root
RUN chown -R nextjs:nodejs /app

# 7. Pindah ke user non-root untuk menjalankan kontainer
USER nextjs

# Expose port Next.js
EXPOSE 3000

# 8. Healthcheck end-to-end yang memeriksa status Next.js dan Database via endpoint /api/config
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/config', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["./docker-entrypoint.sh"]
