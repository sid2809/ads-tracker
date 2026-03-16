FROM node:20-alpine AS base

# --- Dependencies layer (cached unless package.json/lock changes) ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

# --- Build layer (only rebuilds when source changes) ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY next.config.js tailwind.config.js postcss.config.js jsconfig.json ./
COPY src ./src
COPY public ./public
RUN npm run build

# --- Runtime layer (tiny final image) ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public* ./public/
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
