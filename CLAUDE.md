# mitsume

Personal, single-user, local-first notes + calendar app. Expo SDK 56 / RN 0.85
(+ RN Web) client; self-hosted backend (Radicale for calendar today; y-sweet +
MinIO planned for notes). Targets web + Android (Obtainium) — no iOS.

## Layout

- `app/` — the Expo client (all product code; has its own CLAUDE.md).
- `docs/` — `Requirements.md` (spec + decisions log), `Deploy.md` (web +
  same-origin Caddy), `Release.md` (Android APK pipeline).
- `server/` — stub; y-sweet + MinIO stack not yet scaffolded.
- `tooling/` — `dev-proxy/` (dockerized same-origin Caddy for web dev),
  `android-builder/` (local sign + release scripts).
- `.claude/plans/` — implementation plans and build logs (historical record).

## Dev loop (bun only — no Node on this machine)

- Always `cd app/` first, then `bun run --bun web`.
- Browse the dockerized dev proxy at `http://localhost:8880` (injects DAV
  auth), NOT Metro's `:8081` directly (CORS). Start it from
  `tooling/dev-proxy/`: `docker compose up -d` (needs its gitignored `.env`;
  see `.env.example`). Docker runtime is colima.
- Checks from `app/`: `bun run typecheck`, `bun run lint`, `bun run
  format:check`.
- Tests: local jest is broken under bun's runtime — run `bun test <files>`
  instead; CI runs jest via `bun run test`.
- Install Expo packages with `bunx expo install` (SDK 56 line), never
  `bun add expo-*@latest` (SDK 57 is out).

## Deploy & release

- Web: merge to `main` → CI pushes `ghcr.io/carrein/mitsume` → Watchtower
  redeploys. See `docs/Deploy.md`.
- Android: CI builds an unsigned APK; sign + publish locally with
  `tooling/android-builder/sign-release.sh` → GitHub Release → Obtainium.
  See `docs/Release.md`.

## Invariants

- **No CalDAV credentials client-side or in CI** — not in the repo, images,
  bundles, GitHub secrets, or devices. The host Caddy injects Authorization on
  `/dav/*` (password lives only in the server `.env`). Never reintroduce
  credential baking or client-side credential storage as defaults.
- Port 8080 on this Mac belongs to an unrelated dev server; mitsume tooling
  uses 8880.
