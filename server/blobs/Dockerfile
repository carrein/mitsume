# Caddy + the webdav plugin (mholt/caddy-webdav): PUT/DELETE for a plain
# directory of content-addressed blobs. See Caddyfile for the route logic.
FROM caddy:2.11-builder AS builder
RUN xcaddy build --with github.com/mholt/caddy-webdav

FROM caddy:2.11
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile
# Caddy's own state stays in /tmp (the image points XDG_DATA_HOME at /data,
# which is root-owned and not ours to use).
ENV XDG_CONFIG_HOME=/tmp/caddy-config XDG_DATA_HOME=/tmp/caddy-data
# Blob root, owned by the runtime uid — a host bind mount must likewise be
# writable by uid 1000 (the stack's host-user convention).
RUN mkdir -p /blobs && chown 1000:1000 /blobs
USER 1000:1000
EXPOSE 8080
