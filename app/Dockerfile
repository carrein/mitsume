# Static web image: bun build → Caddy file server. Build context = app/.
#
#   docker build -t ghcr.io/carrein/mitsume:latest app/
#
# EXPO_PUBLIC_* values are INLINED INTO THE JS BUNDLE at export time (they are not
# runtime env vars — changing them requires a rebuild, and they are readable in the
# image/bundle, so keep the GHCR package private while credentials are baked in).
# DAV_URL defaults to the relative /dav/ so the same image works on any host that
# serves Radicale same-origin under /dav/ (see docs/Deploy.md).

# ---- build ----
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .

ARG EXPO_PUBLIC_DAV_URL=/dav/
ARG EXPO_PUBLIC_DAV_USER
ARG EXPO_PUBLIC_DAV_PASS
ENV EXPO_PUBLIC_DAV_URL=$EXPO_PUBLIC_DAV_URL \
    EXPO_PUBLIC_DAV_USER=$EXPO_PUBLIC_DAV_USER \
    EXPO_PUBLIC_DAV_PASS=$EXPO_PUBLIC_DAV_PASS \
    CI=1
RUN bunx expo export --platform web

# ---- serve ----
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80
