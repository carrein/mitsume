# mitsume

Personal, single-user, local-first note-taking app for Android and web with
sync to a self-hosted backend.

- **Spec:** [docs/Requirements.md](docs/Requirements.md)
- **Client:** [`app/`](app/) — Expo / React Native (+ React Native Web), TypeScript
- **Server:** [`server/`](server/) — self-hosted sync stack (y-sweet + MinIO), not yet scaffolded

## Development

```sh
cd app
bun install
bun run start       # Expo dev server (press w for web, a for Android)
bun run typecheck
bun run lint
bun run test
```

## Distribution

Android ships as a universal APK attached to GitHub Releases, tracked by
[Obtainium](https://github.com/ImranR98/Obtainium). Web deploys to the
self-hosted environment.
