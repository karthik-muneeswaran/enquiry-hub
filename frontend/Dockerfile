# syntax=docker/dockerfile:1

# Stage 1: Dependencies
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Stage 2: Development (hot reload with Vite)
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Stage 3: Build (production)
FROM deps AS builder
ARG VITE_API_BASE_URL
ARG VITE_GRAPHQL_URL

# Validate required build args
RUN if [ -z "$VITE_API_BASE_URL" ]; then echo "ERROR: VITE_API_BASE_URL build arg is required" && exit 1; fi
RUN if [ -z "$VITE_GRAPHQL_URL" ]; then echo "ERROR: VITE_GRAPHQL_URL build arg is required" && exit 1; fi

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GRAPHQL_URL=$VITE_GRAPHQL_URL
COPY . .
RUN npm run build

# Stage 4: Serve with Nginx (production)
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=5s \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
