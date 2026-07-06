# Static web image: bun build → Caddy file server. Build context = app/.
#
#   docker build -t ghcr.io/carrein/mitsume:latest app/
#
# CREDENTIAL-FREE by design: the host Caddy injects Authorization on /dav/*
# (see docs/Deploy.md), so no username/password is ever baked here. The only
# baked value is the relative DAV URL (/dav/), which resolves against the page
# origin at runtime — one image works on any host — and keeps the static-export
# prerender consistent with the client (hydration safety).

# ---- build ----
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .

ARG EXPO_PUBLIC_DAV_URL=/dav/
ENV EXPO_PUBLIC_DAV_URL=$EXPO_PUBLIC_DAV_URL \
    CI=1
RUN bunx expo export --platform web

# ---- serve ----
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80
