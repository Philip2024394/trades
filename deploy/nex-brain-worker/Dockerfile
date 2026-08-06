# NEX Brain Cloud Worker — Dockerfile
# Philip 2026-08-06 · Phase 5 · deployed to Fly.io
#
# Build context is the REPO ROOT (see fly.toml `dockerfile` path).
# We copy only what the worker needs at runtime:
#   · package.json + lockfile      → for npm ci
#   · tsconfig.json                → tsx resolves @/* paths from here
#   · src/lib/nex/**               → brain manager + workers + storage
#   · scripts/nex-brain-cloud-worker.ts
#
# The Next.js app itself is NOT included — the cloud worker talks
# directly to Supabase and calls the brain manager in-process.

FROM node:22-slim AS base

# tini gives us a proper init so SIGTERM propagates to node (Fly
# sends SIGTERM on redeploy; node needs to exit within 5s or Fly kills
# it). tini is ~50KB.
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first so this layer caches when only source changes.
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --production=false --ignore-scripts

# Copy the brain code and worker entry point.
COPY tsconfig.json ./
COPY src/lib/nex ./src/lib/nex
COPY scripts/nex-brain-cloud-worker.ts ./scripts/nex-brain-cloud-worker.ts

ENV NODE_ENV=production
ENV NEX_BRAIN_BACKEND=supabase
ENV PORT=8080

EXPOSE 8080

# tini as PID 1 so SIGTERM reaches node cleanly.
ENTRYPOINT ["/usr/bin/tini", "--"]

# tsx runs the TypeScript directly. Path aliases (@/*) come from
# tsconfig.json which tsx auto-loads.
CMD ["npx", "tsx", "scripts/nex-brain-cloud-worker.ts"]
