# ---------- Stage 1: install dependencies ----------
# Build tools are present here so native modules (`bcrypt`) can compile
# if a prebuilt binary isn't available for this platform.
FROM node:22-slim AS deps

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests first so Docker can cache this layer
COPY package*.json ./

# Production dependencies only (nodemon is a devDependency)
RUN npm ci --omit=dev

# ---------- Stage 2: runtime image ----------
# Debian-based (not Alpine) because the app depends on `bcrypt`, which
# has better prebuilt binaries for glibc than musl.
FROM node:22-slim

WORKDIR /app

# Reuse the already-installed node_modules (no compilers in the final image)
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the server source
COPY . .

# The server listens on this port
EXPOSE 3000

# Run as the non-root user that ships with the Node image
USER node

CMD ["node", "server.js"]
