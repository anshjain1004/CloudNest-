# ---------- Stage 1: build the React app ----------
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# The API URL is baked into the JS bundle at build time.
# Override it with: docker compose build --build-arg VITE_BASE_URL=...
ARG VITE_BASE_URL=http://localhost:3000
ENV VITE_BASE_URL=$VITE_BASE_URL

RUN npm run build

# ---------- Stage 2: serve the static files with nginx ----------
FROM nginx:alpine

# SPA routing + /api proxy to the backend container
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
