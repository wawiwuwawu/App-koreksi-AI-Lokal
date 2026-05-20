# Stage 1: Install semua dependensi (termasuk devDependencies untuk build Next.js)
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Salin package.json & package-lock.json
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build Aplikasi Next.js
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Salin dependensi dari Stage 1 dan seluruh kode sumber
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Suntikkan variabel dummy agar lolos validasi Prisma config saat build
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
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

# 4. Install Prisma CLI & dependensi database secara utuh untuk runtime migration & seeding
# Gunakan --force agar menimpa dependensi parsial hasil pemotongan (tree-shaking) Next.js
RUN npm install --no-save --force prisma@7 tsx dotenv pg @prisma/adapter-pg @prisma/client

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
