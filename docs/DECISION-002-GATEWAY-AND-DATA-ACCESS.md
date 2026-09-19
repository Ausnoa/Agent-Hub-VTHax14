# Decision 002 — Gateway and data access layer

Status: accepted, partly implemented. Date: September 19, 2026.

The registry gateway (`src/lib/gateways/registry.ts`) and shared connection and migrations (`src/lib/gateways/db.ts`) exist. Proposals, composites, and runs are still stored by `src/lib/persistence/store.ts`, which already acts as their gateway; it moves into `src/lib/gateways/` the next time it changes, rather than disrupting working code.

## Context

The browser needs data from the backend database: registry index search results, saved composite agents, and run progress. The database also receives writes from server-side jobs that have no browser involved, such as the registry sync (`DECISION-001-ANS-REGISTRY-INDEX.md`) and the workflow orchestrator.

## Decision

All database access goes through gateways: client → gateway → database.

1. **Gateways live in `src/lib/gateways/`, one per area of data**: the registry index, composite agents and workflow versions, and runs and step attempts. Each gateway owns every query for its area and enforces that area's data rules. No other code touches the database. This follows the Table Data Gateway pattern.
2. **API routes are a thin HTTP layer.** They parse and validate the request, call a gateway, and shape the response for the UI. The routes are the ones listed under "API boundaries" in `PLAN.md`. They are part of the same application, not a separately deployed service.
3. **Server-side jobs call gateways directly.** The registry sync and orchestrator import them rather than calling the API routes over HTTP.

```text
browser ──► API routes (parse, validate, shape response)
                 │
                 ▼
          lib/gateways/ (the only code that touches the database)
                 ▲
                 │
   registry sync job, orchestrator ──► ANS, A2A agents
```

## Rules

- The browser never connects to the database and never receives database credentials or file paths.
- Gateways expose domain operations, such as searching candidates for a capability or reading a run. They never accept arbitrary filters, sort expressions, or SQL from the client.
- API routes validate every request body and parameter before calling a gateway.
- Data rules live in gateways so every caller follows them. In particular, agent endpoints come only from the registry index; endpoint URLs supplied by the browser are rejected.
- ANS credentials, LLM keys, and outbound agent calls stay on the server.
- Responses contain what the UI needs, not raw table rows. Registry-supplied text such as agent descriptions is returned as data for the UI to render as plain text.

## Consequences

- Queries, data rules, and credential handling live in one place.
- The web server and the worker share one SQLite file. WAL mode and a busy timeout let them read and write concurrently, provided every write transaction stays short and never waits on the network.
- For the hackathon, the local machine hosts the app, worker, and database (decided September 19, 2026). A public deployment would need a long-lived process with a persistent filesystem; serverless platforms without persistent disk cannot host SQLite, and would mean moving to a hosted database behind the same gateways.
- The gateways could later move into a separate service without changing the browser's API contract. This is not worth the extra deployment, network hop, and service-to-service authentication within the hackathon window.
