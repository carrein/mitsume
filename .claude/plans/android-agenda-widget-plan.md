# Android Agenda Widget — Implementation Plan
Created: 2026-07-07
Status: IN PROGRESS — Phases A–D approved 2026-07-07; Phase E gated separately

## Context

First feature after v0.1.0: an Android home-screen **agenda widget** showing the **next 10
upcoming CalDAV events**. Decisions from the interview (2026-07-07):

- **Window:** next 10 from now — timed + all-day + in-progress, each recurring instance
  counts; 60-day horizon.
- **Freshness:** Android's ~30-min automatic cycle + refresh on app open + a **manual
  refresh tap target** on the widget.
- **Offline/failure:** keep last-good events with a small "updated HH:mm" line.
- **Tap:** whole widget opens the app's calendar screen (`app://calendar`).
- **Appearance:** match the app — orange accent (`#E66000`), row = time + title (+ location
  if it fits), system dark/light, ~4x2 resizable.
- **Workflow (trunk-only, user-stated):** commit straight to `main`, no branches, no local
  Android testing; verification happens in production via release → Obtainium. Web redeploys
  from every push to main, so each commit must keep web green.

## Research Summary

See `android-agenda-widget-research.md`. Load-bearing: RNAW **0.20.3** (≥0.20.3 mandatory —
earlier 0.20.x shipped a broken Expo plugin) on the open-ended RN ≥0.76 compat range;
new-arch since 0.16.0, dark mode since 0.19.0; RN 0.85/SDK 56 maintainer-untested (risk #1).
Config plugin + prebuild = zero CI workflow changes. Entry-point override required for the
task handler; polyfills and web-bundle safety are on us. `fetchMonth` is already a generic
range fetch; new code is a pure selector, a small cache, the widget UI, and the handler.
Net-new deps: `react-native-android-widget`, `expo-file-system`.

## Approach

Reuse the existing caldav layer untouched. All new code lives in `app/src/widget/`. The
headless task handler does: fetch range → select next 10 → write last-good cache → render;
on fetch failure it renders from cache. The app's calendar screen triggers a widget refresh
on load (covers "refresh on app open"). Pure logic (`selectUpcoming`, row formatting) is
unit-tested; native behavior is verified on-device after a release cut.

### Design Priorities (in order)
1. Minimal code / simplicity
2. Performance
3. Explicit and traceable code
4. Reusability / modularity
5. Readability / maintainability

## Implementation Phases

### Phase A: Dependencies + wiring
- [ ] `bunx expo install react-native-android-widget expo-file-system` (pin RNAW ≥0.20.3;
      commit `bun.lock`)
- [ ] `app.json`: add `['react-native-android-widget', { widgets: [{ name: 'Agenda',
      label: 'mitsume agenda', description: 'Next 10 events', minWidth: '250dp',
      minHeight: '110dp', targetCellWidth: 4, targetCellHeight: 2,
      updatePeriodMillis: 1800000 }] }]` — add resize/preview fields only if the
      `WithAndroidWidgetsParams` type supports them
- [ ] New `app/index.ts` entry: `@/polyfills` first, then `expo-router/entry`, then
      Android-guarded lazy `require` + `registerWidgetTaskHandler`
- [ ] `app/package.json`: `"main": "index.ts"`
- Files: `app/package.json`, `app/bun.lock`, `app/app.json`, `app/index.ts`

### Phase B: Widget data layer (pure, tested)
- [ ] `app/src/widget/types.ts` — slim `WidgetEvent` (`summary`, `start`/`end` ISO strings,
      `allDay`, `location?`) + `WidgetCache { events: WidgetEvent[]; fetchedAt: string }`
- [ ] `app/src/widget/select-upcoming.ts` — pure: filter `end > now`, sort by `start`,
      slice(0, 10); CalEvent → WidgetEvent mapping
- [ ] `app/src/widget/cache.ts` — read/write one JSON file via `expo-file-system`
      (document dir), tolerant of missing/corrupt file
- [ ] `app/src/widget/fetch-upcoming.ts` — `getDefaultCalendar()` + `fetchMonth(now,
      now+60d)` + selector; returns events or throws (caller decides stale fallback)
- [ ] Tests for `select-upcoming` (timed/all-day/in-progress/recurring-instance ordering,
      limit, exclusive all-day end) in the existing jest style, runnable via `bun test`
- Files: `app/src/widget/{types,select-upcoming,cache,fetch-upcoming}.ts`,
  `app/src/widget/select-upcoming.test.ts`

### Phase C: Widget UI + task handler
- [ ] `app/src/widget/agenda-widget.tsx` — root `FlexWidget` with `clickAction: 'OPEN_URI'`
      → `app://calendar`; header row: "updated HH:mm" (from `toTimeString`) + refresh glyph
      with `clickAction: 'REFRESH'`; `ListWidget` of compact rows (day + time via existing
      date utils, title, location if present); light/dark palettes from
      `Colors`/`AccentColor`; empty state ("No events in the next 60 days") and
      unconfigured state (`davConfigured === false`)
- [ ] `app/src/widget/task-handler.tsx` — imports `@/polyfills` first; on
      WIDGET_ADDED / WIDGET_UPDATE / WIDGET_RESIZED / WIDGET_CLICK('REFRESH'):
      fetch → cache → render; on error: render cache (stale timestamp shows it)
- [ ] Refresh-on-app-open: `requestWidgetUpdate` fire-and-forget from the calendar screen's
      mount (Android only)
- Files: `app/src/widget/{agenda-widget,task-handler}.tsx`, small touch in
  `app/src/app/calendar.tsx` (or `use-month-events.ts`)

### Phase D: Checks + land on main
- [ ] `bun run typecheck` · `bun run lint -- --max-warnings 0` · `bun run format:check` ·
      `bun test` on the new pure modules
- [ ] `bunx expo export --platform web` — prove the entry-point change didn't break the web
      bundle (the web Docker image runs this exact export)
- [ ] Commit to `main` + push → CI (typecheck/lint/test) + web image redeploy
- [ ] Smoke the APK build without releasing: `gh workflow run 'Android APK'` and watch it
      green — this is where "RNAW on RN 0.85" actually gets proven (risk #1)
- Files: commit only

### Phase E: Release cut + on-phone verification (separate go/no-go)
- [ ] Bump `app.json`: `expo.version` → `0.2.0`, `android.versionCode` → 2; push
- [ ] `gh workflow run 'Android APK'` → green → `./tooling/android-builder/sign-release.sh`
      (local keystore signs + publishes the GitHub Release)
- [ ] Obtainium updates on the phone; verify: widget in picker → add 4x2 → next-10 list
      renders → tap opens calendar → refresh tap refetches → airplane-mode shows stale +
      timestamp → dark/light both readable
- Files: `app/app.json`

## Edge Cases & Error Handling
- Fetch failure / off-tailnet → render last-good cache; "updated HH:mm" conveys staleness.
- No cache + fetch failure (first add while off-tailnet) → friendly "can't reach calendar"
  state, retries next cycle.
- `EXPO_PUBLIC_DAV_URL` unset (local debug builds) → explicit "not configured" widget state.
- Fewer than 10 events in 60 days → show what exists; zero → empty state.
- All-day events: exclusive end already normalized in ics.ts; rows show "all day", no time.
- Corrupt/missing cache file → treated as empty, overwritten on next success.
- ListWidget row height must stay ≤ widget height → single-line compact rows.

## Risks & Open Questions
- **RNAW on RN 0.85/SDK 56 is maintainer-untested** (declared through RN 0.83). Proven or
  broken at Phase D's CI APK smoke. Fallback: try latest RNAW master / pin experiments;
  last resort a native Glance module (out of scope unless needed).
- **Headless timeout unverified** — cold fetch is ~6 round-trips; if updates silently miss,
  suspect the native task timeout first. Cache limits blast radius to staleness.
- `resizeMode`/preview not confirmed as Expo-plugin fields — inspect the package's TS types
  in Phase A; resizable is nice-to-have, not blocking.
- Dark-mode mechanism (v0.19.0+) details unverified — style both palettes; verify on device.
- `expo-file-system` in the headless context is expected to work (native module in the same
  bundle) but is only proven on device.
- Widget must never touch credentials — it inherits the credential-less origin; nothing to
  do, just don't add auth (memory: mitsume-caldav-auth-architecture).
