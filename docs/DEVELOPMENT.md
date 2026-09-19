# Development workflow

Before substantial changes, commit the current coherent state. Stage explicit paths, inspect the staged diff, and keep secrets out of Git. Commits are local unless pushing is requested.

For every milestone, update a Markdown progress record with implementation, validation, remaining work, and blockers. Record durable architectural decisions separately when they change, as `docs/DECISION-NNN-*.md`.

## Commands

Requires Node.js 24 or later. The initial integration probe uses native TypeScript execution and has no installed dependencies.

- `npm test`: offline contract checks using explicitly synthetic fixtures.
- `npm run probe:ans -- company research`: live, read-only discovery.
- Copy `.env.example` to `.env.local` when configuration is needed. Supply the authorization header expected by your ANS environment; never paste credentials into documentation or commit them.

The probe follows pagination up to `ANS_PROBE_MAX_PAGES` pages (default 5) and reports whether more results exist. It does not invoke discovered URLs, validate agent identity, or establish semantic compatibility.

## Backend server and registry index (planned)

Not implemented yet. See `docs/DECISION-001-ANS-REGISTRY-INDEX.md` for the design.

The backend keeps a local SQLite index of the ANS registry. On startup it begins a background sync that pages through all active A2A agents, then fetches their agent cards and stores declared skills. The server accepts requests before the sync finishes, using the last successful index. Prompt-time discovery reads the index; only workflow execution calls ANS live, to confirm selected agents are still active and unchanged.

Planned configuration, in `.env.local`:

| Variable | Purpose |
| --- | --- |
| `ANS_BASE_URL` | ANS API origin (default `https://api.godaddy.com`) |
| `ANS_AUTHORIZATION` | Optional authorization header value |
| `DATABASE_PATH` | SQLite file location, kept out of Git |
| `ANS_SYNC_INTERVAL_MINUTES` | How often to refresh the index |

When working on the backend:

- Never write test fixtures into the index database. Tests use a separate temporary database.
- A fresh clone starts with an empty index; discovery returns no candidates until the first sync completes. Check sync status before assuming ANS has no match.
- Delete the database file to force a full rebuild.
