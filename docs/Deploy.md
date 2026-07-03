# Deploy — mitsume web + Radicale (same-origin)

> First-cut deployment for the calendar web app. Android/Obtainium is a separate,
> deferred track (see `.claude/plans/caldav-calendar-plan.md`).

## Shape

One new container (`mitsume`, static web app) plus one new site block on the existing
host Caddy. The app and Radicale share ONE origin — the app is served at `/` and
Radicale is proxied under `/dav/` — so the browser never makes a cross-origin CalDAV
request and **no CORS configuration is needed anywhere**.

```
browser ── https://<host>:<MITSUME_PORT>/        → mitsume:80   (static app)
        └─ https://<host>:<MITSUME_PORT>/dav/*   → radicale:5232 (X-Script-Name /dav)
```

CD matches the rest of the stack: pushes to `main` build `ghcr.io/carrein/mitsume:latest`
(`.github/workflows/web-image.yml`) and Watchtower redeploys it.

## 1. Compose service

Add to `docker-compose.yml` (mirrors the stack's hardening conventions):

```yaml
  mitsume:
    container_name: mitsume
    image: ghcr.io/carrein/mitsume:latest
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE # in-container Caddy binds :80
    deploy:
      resources:
        limits:
          memory: 64M
    labels:
      - flame.type=application
      - flame.name=mitsume
      - flame.icon=custom
      - com.centurylinklabs.watchtower.enable=true
```

And a new env var + port mapping on the `caddy` service:

```yaml
    environment:
      MITSUME_REVERSE_PROXY_PORT: ${MITSUME_REVERSE_PROXY_PORT}
    ports:
      - ${MITSUME_REVERSE_PROXY_PORT}:${MITSUME_REVERSE_PROXY_PORT}
```

## 2. Host Caddyfile site block

```caddyfile
{$TAILNET_DOMAIN}.{$TAILNET_DNS_NAME}:{$MITSUME_REVERSE_PROXY_PORT} {
	# CalDAV, same-origin: strip /dav before proxying; X-Script-Name makes
	# Radicale emit hrefs under /dav so discovery resolves through this block.
	handle_path /dav/* {
		reverse_proxy radicale:5232 {
			header_up X-Script-Name /dav
		}
	}

	handle {
		reverse_proxy mitsume:80
	}
}
```

Existing clients (Etar/DAVx5, Apple Calendar) keep using the current
`:${RADICALE_REVERSE_PROXY_PORT}` block unchanged — `/dav/` is an *additional* path
to the same Radicale.

## 3. Credentials (first cut)

`EXPO_PUBLIC_*` values are **baked into the JS bundle at build time** — they are not
runtime env vars, and anyone with the image or bundle can read them:

- The workflow bakes `EXPO_PUBLIC_DAV_URL=/dav/` (relative → same-origin on any host)
  plus repo secrets `DAV_USER` / `DAV_PASS` if set. **Keep the GHCR package private.**
- Rotating the password = update the secret → re-run the workflow → Watchtower pulls.
- Hardening follow-up (deferred): stop baking credentials and have the host Caddy
  inject `Authorization` on `/dav/*` upstream requests instead, or move to the
  planned in-app settings + secure-store.

## 4. Verify after deploy

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://<host>:<port>/            # 200 (app)
curl -s -o /dev/null -w '%{http_code}\n' https://<host>:<port>/calendar    # 200 (route)
curl -s -o /dev/null -w '%{http_code}\n' -X PROPFIND -H 'Depth: 0' \
  https://<host>:<port>/dav/                                               # 401 (Radicale, auth required)
```

Then run the smoke tests in `.claude/plans/caldav-calendar-plan.md` §Smoke tests.

## Local web dev (same-origin without Docker)

Use `tooling/dev-proxy/Caddyfile` (see its header comment):
Metro on `:8081` + Radicale under `http://localhost:8080/dav/`.
