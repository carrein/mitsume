# Installer: bun resolves the repo's lockfile (bun is the toolchain everywhere).
FROM oven/bun:1.3-slim AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Runtime: Node, not bun — Hocuspocus v4's Server class is built on node:http
# + the crossws node adapter, which refuses to start under Bun (verified
# 2026-07-11). node:sqlite keeps persistence free of native modules, and
# Node 24 runs the TypeScript entry directly (type stripping).
FROM node:24-alpine
ENV NODE_ENV=production PORT=1234 SQLITE_PATH=/data/documents.sqlite
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json index.ts ./
# SQLite volume root, owned by the runtime uid — a host bind mount must
# likewise be writable by uid 1000 (node).
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 1234
CMD ["node", "index.ts"]
