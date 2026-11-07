# YumEra: Eternal Universe — production image
# Stage 1: dependencies (native modules need python/make/g++)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Stage 2: build
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: runtime
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    YUMERA_DATA_DIR=/app/data
# Apply distributor security updates in the final image and keep only what the server needs.
RUN apt-get update \
  && apt-get -y upgrade \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 yumera \
  && useradd --system --uid 1001 --gid yumera yumera \
  && mkdir -p /app/data/uploads && chown -R yumera:yumera /app/data

COPY --from=builder --chown=yumera:yumera /app/.next/standalone ./
COPY --from=builder --chown=yumera:yumera /app/.next/static ./.next/static
COPY --from=builder --chown=yumera:yumera /app/public ./public
# Native module is traced by Next, but copy explicitly so the SQLite driver is always present.
COPY --from=builder --chown=yumera:yumera /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

USER yumera
EXPOSE 3000
CMD ["node", "server.js"]
