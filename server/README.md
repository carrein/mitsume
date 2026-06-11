# server

Self-hosted sync stack — **not yet scaffolded** (deferred until the client has
a Yjs sync layer; see `.claude/plans/repo-init-plan.md`).

Will contain a docker-compose stack per docs/Requirements.md §9.4–9.5:

- **y-sweet** (`ghcr.io/jamsocket/y-sweet`) — Yjs sync server, persists doc state
- **MinIO** — S3-compatible, content-addressed blob store for attachments
- Reached over Tailscale only; TLS via `tailscale serve`
