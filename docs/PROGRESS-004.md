# Milestone 004 — Durable composition and execution

## Implementation

- SQLite persistence stores reviewed proposals, immutable composites, runs, and all step attempts.
- A separate worker claims queued runs atomically and uses a renewable lease to exclude duplicate workers on the same database.
- A failed step stops the pipeline. Explicit retry reconstructs state from completed outputs and resumes the failed step.
- Restart recovery marks interrupted work as failed for review rather than silently replaying external calls.
- Live execution re-resolves the selected ANS identity and rejects endpoint changes.
- An optional Responses API planner returns schema-validated capabilities. Both API key and model are explicitly configured; no credentials are required for the labeled deterministic demo template.
- Live selection requires a server-configured compatibility allowlist and matching card skills. No arbitrary discovered agent is automatically treated as adapter-compatible.

## Decisions

Use SQLite and a persistent Node worker for the single-machine MVP. This is not a serverless or multi-host deployment architecture. Public deployment requires authentication and a shared durable runtime strategy.

The live planner follows [official Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs). It is implemented but cannot be live-validated without configured API credentials and model access.

Local fixtures allow the remainder of the workflow to be built despite the external registration dependency. This deliberately continues local implementation past the original live integration gate, without declaring that gate passed.

## Validation

- `npx tsc --noEmit`: passed.
- `npm test`: 10 passed. Tests cover failed-step stopping, preservation of completed results, duplicate retry rejection, exclusive worker leasing, and interrupted-run recovery.
