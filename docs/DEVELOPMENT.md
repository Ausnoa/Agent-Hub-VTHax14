# Development workflow

Before substantial changes, commit the current coherent state. Stage explicit paths, inspect the staged diff, and keep secrets out of Git. Commits are local unless pushing is requested.

For every milestone, update a Markdown progress record with implementation, validation, remaining work, and blockers. Record durable architectural decisions separately when they change.

## Commands

Requires Node.js 24 or later and `npm install`. Command-line tools use native TypeScript execution; the application uses pinned dependencies recorded in `package-lock.json`.

- `npm test`: contract, persistence, API, and local HTTP protocol checks using explicitly synthetic fixtures. Ports 4311–4313 must be free.
- `npm run typecheck` and `npm run build`: compile-time and production-build checks.
- `npm run demo:agents`, `npm run worker`, and `npm run dev`: local development services; see `LOCAL-DEMO.md`.
- `npm run probe:ans -- company research`: live, read-only discovery.
- Copy `.env.example` to `.env.local` when configuration is needed. Supply the authorization header expected by your ANS environment; never paste credentials into documentation or commit them.

The probe follows registry cursors for up to five pages by default and explicitly reports whether additional results exist. It does not invoke discovered URLs, validate agent identity, or establish semantic compatibility.
