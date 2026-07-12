# mitsume

Personal, single-user, local-first notes + calendar app. Expo SDK 56 / RN 0.85
(+ RN Web) client; self-hosted backend (Radicale for calendar; Hocuspocus for
notes doc sync + a content-addressed blob store for pasted images). Targets
web + Android (Obtainium) — no iOS.

## Layout

- `app/` — the Expo client (all product code; has its own CLAUDE.md).
- `docs/` — `Requirements.md` (spec + decisions log), `Deploy.md` (web +
  same-origin Caddy + notes backend), `Release.md` (Android APK pipeline).
- `server/` — notes backend: `sync/` (Hocuspocus v4 + SQLite, Node) and
  `blobs/` (Caddy + webdav, SHA-256-named files); merge-ready `compose.yml`
  for the host stack (see its README).
- `tooling/` — `dev-proxy/` (dockerized same-origin Caddy for web dev; also
  runs the notes backend locally), `android-builder/` (local sign + release
  scripts).
- `.claude/plans/` — implementation plans and build logs (historical record).

## Dev loop (bun for scripts/checks; Metro and Gradle run under node)

Bun runs checks, tests, and package installs. Metro and the Android build both
need real node: `--bun` shims node→bun, and bun can't load fsevents (Metro's
macOS file watcher — edits silently never reach the bundle) or run the Gradle
helper scripts. See the web and Android bullets below.

- Always `cd app/` first, then plain `bun run web:proxy` — NOT `--bun`
  (breaks file watching → stale bundles; found 2026-07-12). `web:proxy`
  forces the same-origin `/dav/` URL; plain `web` bakes the tailnet URL from
  `app/.env` into the bundle and CORS-breaks behind the proxy. Edits then
  ship on save; only metro.config.js changes need a Metro restart.
- Web e2e: `tooling/e2e/run.sh` — dockerized Playwright + a throwaway Radicale
  behind its own Caddy on :8881 (never touches the real calendar). Needs Metro
  running (`web:proxy`).
- Android hot reload: plain `bun run android:dev` — do NOT add `--bun`. The
  Gradle steps shell out to `node` (expo autolinking, entry resolution), and
  `--bun` shims `node`→bun and breaks the build in ~3s at `settings.gradle`
  (`command 'node' … exit value 1`).
  (debug build under `com.carrein.mitsume.dev`, coexists with the release app;
  needs the local Android SDK — installed 2026-07-07 via Android Studio, env in
  `~/.zshrc`.)
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

- Releases are SYMMETRIC: pushes to `main` only run CI checks; a `v*` tag
  builds BOTH the web image (→ Watchtower) and the unsigned APK from the same
  commit — web and Android versions always match (see the in-app badge).
- Cut: bump `expo.version` + `android.versionCode` in `app/app.json` → push →
  `git tag vX.Y.Z && git push origin main vX.Y.Z` → green → sign + publish with
  `tooling/android-builder/sign-release.sh` → Obtainium + Watchtower deliver.
  See `docs/Release.md`, `docs/Deploy.md`.

## Invariants

- **No CalDAV credentials client-side or in CI** — not in the repo, images,
  bundles, GitHub secrets, or devices. The host Caddy injects Authorization on
  `/dav/*` (password lives only in the server `.env`). Never reintroduce
  credential baking or client-side credential storage as defaults.
- Port 8080 on this Mac belongs to an unrelated dev server; mitsume tooling
  uses 8880.
