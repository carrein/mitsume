# Notes Canvas V1 — Implementation Plan (rev 2)
Created: 2026-07-10 · Revised: 2026-07-10 (server-as-source-of-truth pivot)
Status: COMPLETE (2026-07-11)

## Context

The notes pane (left of the calendar, currently `ChatPlaceholder` "Notes — coming soon") becomes a spatial notes surface: a **CanvasBar** (narrow icon strip, one icon per canvas, + to add) and a **Canvas** (infinite pan/zoom 2D grid space). V1 supports pasting images from the clipboard (ctrl+v, web), selecting, moving/scaling with 32px grid snap, deleting, undo/redo.

**Rev 2 pivot (user):** the server is the source of truth from day 1 — the browser is a cache. V1 therefore scaffolds the `server/` stub into a real stack. Research found the spec's mid-2025 backend picks are both dead (y-sweet: company absorbed into Modal, repo frozen; MinIO OSS: archived 2026-04). User approved replacements: **Hocuspocus v4** (doc sync, SQLite volume) and a **caddy-webdav blob container** (plain dir, filename = SHA-256).

Future direction: a toggle rendering the same items spatially or as list notes — the data model is item-centric, not view-centric.

### Decisions (user-confirmed)
1. **Source of truth:** server. Client = Yjs doc synced via Hocuspocus + y-indexeddb local cache (web); editable offline, merges on reconnect.
2. **Sync server:** Hocuspocus v4 (replaces dead y-sweet — spec revision approved). Blob store: caddy-webdav directory (replaces dead MinIO — approved). Both authless behind the tailnet, same-origin under the existing mitsume Caddy site block (`/sync/*`, `/blobs/*`), zero client credentials (invariant preserved).
3. **Images:** every paste stores BOTH the untouched original AND a WebP display rendition (long edge ≤2048px) the canvas renders. Content-addressed by SHA-256. Deleting an image removes it from local cache and server (when no other item references it); the session keeps a RAM copy so ctrl+Z re-uploads; close the tab and the delete is final.
4. **Server CI/CD:** the existing `v*` tag pipeline also builds `ghcr.io/carrein/mitsume-sync` + `mitsume-blobs`; Watchtower labels on both. Host compose/Caddy changes are applied manually by the user from merge-ready fragments (Deploy.md-style).
5. **Canvas tech:** RN-first shared implementation (RN views + transforms; gesture-handler for drag/pinch; no reanimated in V1 — camera is plain React state), web input adapters (DOM wheel/paste/keydown). Renders on narrow screens too. Native V1: renders + syncs over WebSocket, no local persistence, no paste.
6. **CanvasBar:** icons only; user picks from a curated Basil set in a modal on +; add + switch only; always ≥1 default canvas (fixed id).
7. **Grid/interactions:** 32px dot grid, snap position + size; wheel zooms toward cursor (10%–400%), drag empty space pans; small zoom control; per-canvas viewport memory (localStorage). Paste lands at viewport center capped 640 canvas px; non-image paste silently ignored; single-select; aspect-locked corner scaling (width snaps, height follows aspect); Delete/Backspace; z = newest on top; undo = Yjs UndoManager, mod+Z/mod+shift+Z, item ops on current canvas only.
8. **Docs:** revise Requirements.md (decisions log + §9: Hocuspocus for y-sweet, blob-dir for MinIO, spatial canvas + future spatial/list toggle); extend Deploy.md; rewrite server/README.md.

## Research Summary

See `notes-canvas-research.md` (client round 1 + backend round 2). Load-bearing: yjs@^13.6.31 / y-indexeddb@^9.0.12 / @hocuspocus/provider@^4.3.0 / idb-keyval or idb; single Y.Doc `canvases→canvas{icon,createdAt,items→item{x,y,w,h,z,displayHash,originalHash,mimes,sizes}}` behind one store module; UndoManager scoped to active canvas items with UI_ORIGIN, commit-on-drop; useYSnapshot (useSyncExternalStore + observeDeep + cached toJSON); transform layer = 0×0 anchor + transformOrigin top-left; screen-fixed SVG dot grid; DOM wheel listener with `{passive:false}`; paste via clipboardData.files→items fallback; expo-image renders blob: URLs. Backend: Hocuspocus authless + extension-database/bun:sqlite (or extension-sqlite), health route in our own entry; caddy-webdav dir with DELETE enabled, truncated-PUT mitigated by post-PUT HEAD length check; host Caddy injects immutable Cache-Control on blob GETs (never on 404); client keeps ONE IDB `blobs` store where `uploaded:false` IS the retry queue, foreground drain loop (no service worker); HEAD-then-PUT dedup; gate first paint on y-indexeddb synced; default canvas seeded under a fixed key only after local sync.

## Architecture

```
browser ──ws /sync/*──► host Caddy ──► mitsume-sync   (Bun + Hocuspocus v4, SQLite volume)
        ──http /blobs/<sha256>──►    ──► mitsume-blobs (Caddy + webdav plugin, dir volume)
        ──http /dav/*──►             ──► radicale      (unchanged)
        local: y-indexeddb (doc cache) + IDB blobs store (cache + upload queue) + localStorage (viewports)
dev: tooling/dev-proxy Caddy :8880 gains /sync/* + /blobs/* → locally-built sync/blobs containers (colima)
```

## Implementation Phases

### Phase A: Client data foundation (no UI, no network) — DONE 2026-07-11
- [x] `bun add yjs@13.6.31 y-indexeddb@9.0.12 idb@8.0.3 @hocuspocus/provider@4.3.0`
- [x] `src/polyfills.ts`: guarded `crypto.getRandomValues` from expo-crypto
- [x] `src/notes/types.ts` — `CanvasMeta`, `CanvasItem`, `CanvasItems`
- [x] `src/notes/doc.ts` (`notesDoc` + `notesReady`); `persistence.web.ts` / `persistence.ts` split
- [x] `src/notes/store.ts` — `createNotesStore(doc)` factory (testable with bare docs); UI_ORIGIN as Symbol
- [x] `src/notes/canvas-math.ts` — incl. snapSize (min one cell), PASTE_MAX_EDGE
- [x] `src/notes/use-y-snapshot.ts` — minimal YObservable interface, no `any` leakage
- [x] Tests: 21 pass under `bun test` (incl. undo redo/scoping/origin cases, refcounts); typecheck/lint/format clean

### Phase B: Server stack (repo-local, runs under colima) — DONE 2026-07-11
- [x] `server/sync/` — index.ts (Hocuspocus v4 Server + extension-database + node:sqlite), Dockerfile (bun installer stage → node:24-alpine runtime), .dockerignore, committed `smoke-test.ts`
- [x] `server/blobs/` — Dockerfile (caddy:2.11 + caddy-webdav via xcaddy), Caddyfile (route block; immutable Cache-Control ONLY on existing files; PUT/DELETE webdav; 405 fallback; /health)
- [x] `server/compose.yml` — merge-ready host fragment (house hardening, healthchecks, watchtower labels, `MITSUME_SYNC_VOLUME`/`MITSUME_BLOBS_VOLUME`)
- [x] Dev stack: `tooling/dev-proxy/` compose + Caddyfile extended; VERIFIED via curl + smoke-test: blob PUT 201/GET byte-identical + immutable header/404-no-cache/405/DELETE; ws sync via proxy; SQLite persistence across container restart
- [x] CI: `.github/workflows/server-images.yml` (matrix sync/blobs, v* tags, ghcr)

**Deviation (B1):** sync runs on **Node 24**, not Bun — Hocuspocus v4's Server hardcodes the crossws *node* adapter, which throws under Bun ("incompatible environment", verified). node:sqlite replaces bun:sqlite; bun remains the installer stage. This was the planned fallback.
**Deviation (B2):** blob root is **/blobs**, not /data — the official caddy image owns /data (root-owned XDG state); /data also broke uid-1000 writes. Both containers now chown their volume root in the image; host bind mounts must be uid-1000-writable.
**Deviation (B3):** the sync route needs a **two-form matcher** (`@sync path /sync /sync/*` + `uri strip_prefix /sync`) — the ws client connects to bare `/sync`, which `handle_path /sync/*` does not match (found via 502s). The prod Caddyfile snippet in Deploy.md must use the same shape.

### Phase C: Client blob + sync wiring — DONE 2026-07-11
- [x] `src/config.ts` — `notesSyncUrl()` / `blobsBaseUrl()` (functions, not consts — window at call time; static export safe)
- [x] `src/notes/doc.ts` — LAZY `openNotes()` singleton (module-scope IndexedDB/WS would crash the Node static export); HocuspocusProvider attached when a sync URL exists
- [x] `src/notes/blob-cache.web.ts` (+ in-memory native twin) — one IDB store, `uploaded:false` = queue; session-trash Map for deleted blobs with auto-resurrect-on-read (powers delete-undo); `requestDurableStorage()`
- [x] `src/notes/ingest-plan.ts` (pure, tested) + `ingest.web.ts` (sha256, createImageBitmap, OffscreenCanvas→WebP q0.8 ≤2048; GIF passthrough; Safari may emit PNG — result type trusted)
- [x] `src/notes/backoff.ts` (pure, tested) + `uploader.web.ts` (+ no-op twin) — HEAD→PUT→verify-length drain with per-hash backoff; triggers start/online/visible/paste/60s
- [x] `src/notes/blob-source.web.ts` (+ native twin: direct server URLs into expo-image) + `use-blob-url.ts` (refcount-balanced hook)
- [x] `src/notes/delete-item.ts` — deleteItemWithBlobs (refcount-gated; local → session trash; server DELETE best-effort)
- [x] `types.ts` gained `displayMime`; 29 tests green; typecheck/lint/format clean

### Phase D: Canvas shell — DONE 2026-07-11 (verified in browser)
- [x] `_layout.tsx` GestureHandlerRootView; `home-screen.tsx` → NotesScreen (both branches); chat-placeholder.tsx deleted
- [x] `notes-screen.tsx` (ready-gate → NotesReady), `canvas-view.tsx` (key={canvasId} remount; camera = React state; pan/pinch via onChange deltas + functional updates — the react-hooks/refs rule forbids refs in gesture closures), `use-wheel` twins, `dot-grid.tsx`, `zoom-control.tsx`, `viewport-memory.ts`
- [x] Browser-verified on :8880: full-viewport dot grid, drag-pan (activation threshold semantics), wheel zoom (3 ticks → exactly 55%, pattern spacing 17.56px), +/reset buttons, camera persisted to localStorage

**Deviation (D1):** `metro.config.js` added — pins yjs to ONE module instance (mixed ESM/CJS imports across y-indexeddb/hocuspocus bundled two copies; "Yjs was already imported" breaks instanceof/undo origins). Web bundle clean after fix; a residual warning remains in the λ static-render context only (two Metro bundles in one Node process; no Yjs objects constructed there — benign).
**Deviation (D2):** react-native-svg `<Svg>` needs explicit `width/height="100%"` on web (absoluteFill alone → 300×150 SVG default). RN 0.85 also dropped `StyleSheet.absoluteFillObject` types — explicit position styles used.
**Note:** this machine has no watchman — Metro file-watching is unreliable; touch + full reload (or Metro restart for config changes) during dev.

### Phase E: Items — DONE 2026-07-11 (verified in browser end-to-end)
- [x] `use-paste.web.ts` (+ twin), `use-hotkeys.web.ts` (+ twin), `canvas-item.tsx`, `selection-chrome.tsx`, canvas-view integration, `resizeRect` + tests
- [x] Verified: paste → 640×427 snapped at center, blob uploaded (HEAD 200, byte-exact); select/deselect; drag-move snapped + committed; corner resize aspect-locked + snapped (512×342); Delete removes item AND server bytes (404); ctrl+Z restores item at exact rect, blob resurrects from session trash and re-uploads (200); reload persistence

**Deviation (E1):** interaction state (drag/resize) lifted into CanvasView and the selection chrome (border + handles) renders as a SIBLING overlay of the items — nested GestureDetectors do not orchestrate on RNGH web (the parent pan claims the pointer and the child handler never activates).
**Deviation (E2):** RNGH requires REFERENTIALLY STABLE gesture objects (recreating one mid-gesture detaches the running handler). Stable handler sets + a live ref carry current values; `react-hooks/refs` is disabled file-wide in canvas-view/canvas-item with justification (event-context reads the rule can't see).
**Note (E3):** RNGH web Pan resets translation at ACTIVATION and treats moves outside the view bounds specially — with the browser-pane's 2-move synthetic drags on a 12px handle this accumulates zero delta (pure test-harness artifact; realistic pointer streams verified working via a 20-move synthetic sequence). Real-mouse confirmation folded into the final user verification.

### Phase F: CanvasBar — DONE 2026-07-11 (verified in browser)
- [x] 12 curated Basil bodies (book, heart, cart, home, image, music, chart, idea, star, gift, wallet, camera) → `CanvasIconBodies` in icon-paths.ts + `CanvasIcon` in icons.tsx (unknown names fall back to book); store default icon `'book'`
- [x] `canvas-bar.tsx` — 56px strip, circular buttons (intentional exception to the 4px-radius convention, per the reference image), active = accent fill
- [x] `icon-picker.tsx` — event-editor modal pattern, icon grid + Cancel
- [x] Verified: + → picker → heart → new empty canvas selected + persisted as last-active; switch back to default shows the image (isolation ✓); WIDE layout verified (CanvasBar | canvas | calendar split)

### Phase G: Docs + verification — DONE 2026-07-11
- [x] `docs/Requirements.md` — §9.4 (Hocuspocus supersedes y-sweet), §9.5 (blob dir supersedes MinIO), decisions #10–12; `docs/Deploy.md` §Notes backend (compose merge, Caddyfile snippet incl. the two-form /sync matcher, verify curls, backup note); `server/README.md` rewritten; root `CLAUDE.md` header+layout updated
- [x] Checks: typecheck/lint/format clean; **65 unit tests** pass (`bun test src/`); **calendar e2e regression passes** (tooling/e2e, dockerized Playwright)
- [x] Verified full-stack: paste→upload (HEAD byte-exact); reload persistence; **wipe-ALL-local → reload → restored from server** (source-of-truth, literally); **offline edit while sync container stopped → restart → merge reached the server** (proven via second wipe+reload); delete removes server bytes; delete-undo re-uploads; canvas switching/isolation/icon picker; viewport memory; light + dark themes; wide + narrow layouts; calendar unaffected

**Deviation (G1) — real bug found & fixed by the wipe test:** `ensureDefaultCanvas` used to run after LOCAL load only; on an empty cache it re-seeded a rival `'default'` Y.Map before the websocket delivered the server doc, and the same-key CRDT merge could clobber the server's canvas (its items lost). Fix: `NotesHandle.synced` (first Hocuspocus `onSynced`) and seeding waits for `Promise.race([synced, 4s timeout])` — the timeout keeps offline-first boot working; the true concurrent-fresh-device race remains the documented accepted risk.

## Edge Cases & Error Handling
- Non-image / HTML-only clipboard → silently ignored; editable-target focus → paste/hotkeys bail
- Duplicate paste → same hashes, idempotent (IDB + HEAD-then-PUT), items share blobs; delete only GCs at zero references
- Truncated PUT (dropped connection) → post-PUT HEAD length check re-queues
- Blob 404 on another device before upload drains → placeholder tile, retry on next blob-source read
- Offline: doc edits merge via CRDT on reconnect; pending uploads drain via loop; `navigator.onLine` is a hint, fetch outcome is truth
- Two tabs: y-indexeddb + server ws both converge (no direct tab-to-tab channel needed)
- Concurrent first-boot on two devices: fixed 'default' key converges (early items on the losing side could vanish — accepted single-user risk)
- Sync container down: canvas fully usable from cache; docker `stop_signal` irrelevant for Hocuspocus (SQLite write-through via debounced onStoreDocument — confirm debounce at build)
- Zoom clamped 0.1–4; min item size 1 cell; pan unbounded

## Risks & Open Questions
- extension-database + bun:sqlite glue is ~30 lines of ours — if Hocuspocus v4 misbehaves on Bun, fall back to node:22-alpine + extension-sqlite (both researched)
- gesture-handler Pan vs click on web (minDistance tuning); Safari paste variance — test early
- Yjs dual-instance warning (Metro) — watch console
- React Compiler + gesture objects: officially fine; `'use no memo'` per component if not
- Host deploy is manual (user applies compose/Caddy fragments on catallenya) — plan ships copy-paste-ready blocks + verify curls

## Verification (end-to-end)
Unit (`bun test`) + static checks; runtime = the Phase G manual checklist against the full local stack (Metro + dev proxy + locally built sync/blobs containers under colima), then prod deploy per Deploy.md additions after release tag.

## Summary (build log, 2026-07-11)

**Client** — new `src/notes/` data layer (doc/store/persistence/blob-cache/ingest/uploader/blob-source/delete/camera-math/viewport-memory/use-y-snapshot/backoff, 33 unit tests) + `src/components/notes/` UI (notes-screen, canvas-bar, icon-picker, canvas-view, canvas-item, selection-chrome, dot-grid, zoom-control, use-wheel/paste/hotkeys web splits). Wired into home-screen (both layouts); chat-placeholder deleted; GestureHandlerRootView in root layout; `getRandomValues` polyfill; `notesSyncUrl()`/`blobsBaseUrl()` in config; `metro.config.js` (yjs single-instance pin); 12 curated Basil canvas icons.

**Server** — `server/sync/` (Hocuspocus v4 on Node 24 + node:sqlite, committed smoke test), `server/blobs/` (Caddy+webdav, immutable-only-on-existing-files), merge-ready `server/compose.yml`, dev-proxy compose/Caddyfile additions, `.github/workflows/server-images.yml` (v* tags).

**Docs** — Requirements.md §9.4/§9.5 + decisions #10–12 (spatial canvas; Hocuspocus replaces dead y-sweet; blob dir replaces archived MinIO), Deploy.md §Notes backend, server/README.md, root CLAUDE.md.

**Deviations:** B1 (sync runs Node, not Bun — crossws), B2 (/blobs volume root), B3 (two-form /sync matcher), D1 (metro yjs pin), D2 (Svg width/height on web), E1 (selection chrome as sibling — nested detectors don't orchestrate on web), E2 (stable gestures + live ref + scoped react-hooks/refs disable), G1 (seed-after-sync fix — found by the wipe test, would have clobbered server state).

**Verified end-to-end in a real browser:** paste→dedup-upload (byte-exact), drag/resize (snap + aspect lock), delete (removes server bytes), delete-undo (session-trash resurrect + re-upload), wipe-all-local→server restore, offline edit→reconnect merge→server truth, canvas create/switch/isolate, viewport memory, light/dark, wide/narrow, calendar e2e regression green. Real-mouse resize + real-clipboard paste left for the user's hands (browser-pane synthetic input is 2-move-coarse).
