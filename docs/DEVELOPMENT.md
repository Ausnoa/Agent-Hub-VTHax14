# Development workflow

Before substantial changes, commit the current coherent state. Stage explicit paths, inspect the staged diff, and keep secrets out of Git. Commits are local unless pushing is requested.

For every milestone, update a Markdown progress record with implementation, validation, remaining work, and blockers. Record durable architectural decisions separately when they change, as `docs/DECISION-NNN-*.md`.

## Commands

Requires Node.js 24 or later and `npm install`. Command-line tools use native TypeScript execution; the application uses pinned dependencies recorded in `package-lock.json`.

- `npm test`: contract, persistence, API, and local HTTP protocol checks using explicitly synthetic fixtures. Ports 4311–4313 must be free.
- `npm run typecheck` and `npm run build`: compile-time and production-build checks.
- `npm run demo:agents`, `npm run worker`, and `npm run dev`: local development services; see `LOCAL-DEMO.md`.
- `npm run probe:ans -- company research`: live, read-only discovery.
- Copy `.env.example` to `.env.local` when configuration is needed. Supply the authorization header expected by your ANS environment; never paste credentials into documentation or commit them.

The probe follows pagination up to `ANS_PROBE_MAX_PAGES` pages (default 5) and reports whether more results exist. It does not invoke discovered URLs, validate agent identity, or establish semantic compatibility.

## Database and registry index

Everything runs on the local machine. The app, worker, and registry index share one SQLite file. Design: `DECISION-001` (index), `DECISION-002` (gateways), `DECISION-003` (schema).

- `src/lib/gateways/` is the only code that touches the database for the registry index: `db.ts` opens connections and applies migrations, `registry.ts` is the registry gateway. Proposals, composites, and runs are still in `src/lib/persistence/store.ts`.
- `npm run worker` syncs every active A2A registration from live ANS into the index at startup and then on an interval, alongside running workflows. A full sync is rate-limited by ANS and takes a few minutes; the worker logs each result.
- `GET /api/registry/status` reports the last sync and indexed agent counts. `POST /api/registry/search` with `{ "query": "summarization" }` returns eligible candidates with the index's age.
- Prompt-time proposal building and the Discover directory still query ANS live.

Configuration, in `.env.local`:

| Variable | Purpose |
| --- | --- |
| `ANS_BASE_URL` | ANS API origin (default `https://api.godaddy.com`) |
| `ANS_AUTHORIZATION` | Optional authorization header value |
| `COMPOSER_DB` | SQLite file (default `.data/composer.sqlite`, ignored by Git) |
| `ANS_SYNC_INTERVAL_MINUTES` | Minutes between syncs (default 30; 0 disables syncing) |

When working on the database:

- Never write test fixtures into the `COMPOSER_DB` database. Tests use in-memory or temporary databases.
- A fresh database has an empty index until the worker's first sync completes. Check `/api/registry/status` before concluding ANS has no match.
- Delete the database file to rebuild from scratch. This also deletes saved agents and runs.
- Schema changes are a new entry at the end of `src/lib/gateways/migrations.ts`; never edit an applied migration.
