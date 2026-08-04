# Stage 1: Dependencies
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# Stage 2: Development (hot reload with Vite)
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Stage 3: Build (production)
FROM deps AS builder
ARG VITE_API_BASE_URL
ARG VITE_GRAPHQL_URL
ARG VITE_ADMIN_API_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GRAPHQL_URL=$VITE_GRAPHQL_URL
ENV VITE_ADMIN_API_KEY=$VITE_ADMIN_API_KEY
COPY . .
RUN ./node_modules/.bin/tsc && ./node_modules/.bin/vite build

# Stage 4: Serve with Nginx (production)
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
