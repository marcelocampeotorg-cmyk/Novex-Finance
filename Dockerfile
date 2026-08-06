# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar pnpm e dependências do sistema
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile || pnpm install

COPY . .

# Gerar Prisma Client e compilar Next.js em standalone
RUN npx prisma generate
RUN pnpm build

# Production Stage
FROM node:20-alpine AS runner

WORKDIR /app

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

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
