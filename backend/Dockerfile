# syntax=docker/dockerfile:1

# Stage 1: Dependencies (all deps for building)
FROM node:24-alpine AS deps
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY prisma ./prisma
RUN npx prisma generate

# Stage 2: Development (used by docker-compose.yml with target: dev)
FROM deps AS dev
COPY . .
CMD ["npm", "run", "start:dev"]

# Stage 3: Build (production build)
FROM deps AS builder
COPY . .
RUN npm run build

# Stage 4: Production dependencies only
FROM node:24-alpine AS prod-deps
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate

# Stage 5: Production
FROM node:24-alpine AS production
RUN apk add --no-cache openssl libc6-compat
RUN npm install -g pm2 && \
    npm cache clean --force && \
    rm -rf /usr/local/lib/node_modules/npm
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/ecosystem.config.js .

USER appuser
EXPOSE 3000 8081

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -qO- http://localhost:3000/health/ready || exit 1

CMD ["pm2-runtime", "ecosystem.config.js"]
