# Milestone 006 — Validation and review boundaries

- Saved composites now carry a fixed UI configuration rendered through a reusable form component, rather than generated frontend code.
- Added API tests proving cross-origin rejection, local hostname enforcement, server-owned endpoint selection, input validation, persisted queued runs, and rejection of premature retries.
- Removed a readiness claim that was not backed by a worker health check.
- Updated development instructions for installed dependencies and cursor-based discovery.
- Next.js generated repository guidance during development. Read its installed route-handler, CSS, and client/server guides before this update, and committed that generated guidance with the interface checkpoint.

The local workflow, directory, and persistence are implemented. Hosted agent registration, cryptographic identity verification, and the full live research pipeline remain external integration work, as documented in `STATUS.md`.

- Full suite: 12 passing tests, including real loopback A2A HTTP exchanges.
- Production build: passed. Node reports its built-in SQLite API as experimental; Next.js reports an unrelated parent-directory lockfile that it ignores.
- Browser: a deliberately unavailable fixture service caused the run to fail visibly. Restoring services and selecting Retry failed step completed the same run with a second attempt recorded.
- Improved network-failure text after observing the raw fetch error in that test.
- App, worker, and all three fixture agents are running locally for review.
