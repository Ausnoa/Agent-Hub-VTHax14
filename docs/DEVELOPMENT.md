# Development workflow

Before substantial changes, commit the current coherent state. Stage explicit paths, inspect the staged diff, and keep secrets out of Git. Commits are local unless pushing is requested.

For every milestone, update a Markdown progress record with implementation, validation, remaining work, and blockers. Record durable architectural decisions separately when they change.

## Commands

Requires Node.js 24 or later. The initial integration probe uses native TypeScript execution and has no installed dependencies.

- `npm test`: offline contract checks using explicitly synthetic fixtures.
- `npm run probe:ans -- company research`: live, read-only discovery.
- Copy `.env.example` to `.env.local` when configuration is needed. Supply the authorization header expected by your ANS environment; never paste credentials into documentation or commit them.

The probe returns the first page and explicitly reports whether additional results exist. It does not invoke discovered URLs, validate agent identity, or establish semantic compatibility.
