# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Fixar uma versão compatível com Node 20 e com o lockfile v9.
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile

COPY . .

ENV DOCKER_BUILD=true

# Gerar Prisma Client e compilar Next.js em standalone
RUN npx prisma generate
RUN AUTH_SECRET=build-only-not-used-at-runtime-32-characters-minimum \
    NEXT_PUBLIC_APP_URL=http://localhost:3000 \
    pnpm build

# Production Stage
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Usuário não-root por segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
