# Build context: project root (context: . in docker-compose)

# --- Stage 1: Install dependencies ---
FROM oven/bun:1 AS deps

RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY mooring-sim/package.json mooring-sim/bun.lock ./
COPY mooring-sim/packages/ packages/
RUN bun install --frozen-lockfile

# --- Stage 2: Build ---
FROM oven/bun:1 AS build

WORKDIR /app
COPY --from=deps /app/node_modules node_modules/
COPY --from=deps /app/packages packages/
COPY mooring-sim/package.json mooring-sim/bun.lock mooring-sim/vite.config.js mooring-sim/index.html ./
COPY mooring-sim/src/ src/
RUN bun run build

# --- Stage 3: Production runtime ---
FROM nginx:alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
