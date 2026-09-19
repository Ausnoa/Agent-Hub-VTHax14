# Run Agent Composer locally

Requires Node.js 24+ and `npm install`. Keep the app bound to loopback; this MVP does not implement accounts or public access control.

Start three terminals from the repository:

```sh
npm run demo:agents
```

```sh
npm run worker
```

```sh
npm run dev
```

Open http://127.0.0.1:3000. Select Pilot catalog to use the configured LLM, inspect its selected agents, approve, and run the fictional Northstar notes. A2A messages pass through three separate local agent processes. The report is deterministic and based only on supplied notes, not live company research. Offline demo uses a fixed template without an LLM request.

## Small agent catalog

Three local services are automatically indexed. To add or refresh up to six real ANS records from one registry page, run:

```sh
npm run catalog:seed
```

The Pilot catalog screen separates local services from ANS records. Registry agents remain unverified and require a tested adapter before execution. Malformed registry records are skipped and counted. This is a bounded snapshot, not the full index; reruns upsert records, and older records may remain visible.

Catalog data lives in `.data/pilot-catalog.sqlite` (override with `PILOT_CATALOG_DB`). Records older than 24 hours are ineligible for ANS-mode selection until refreshed. The asynchronous `AgentCatalog` interface is the integration point for the future main database; composition and the report runtime do not need to know its storage implementation.

Keep `OPENAI_API_KEY` and `OPENAI_MODEL` in ignored `.env.local`, never in the tracked example. Restart the app after configuring them. Public ANS discovery omits credentials by default; set `ANS_AUTHENTICATED_DISCOVERY=true` only with valid authorized `ANS_AUTHORIZATION`. The configured credential returned HTTP 401 during testing, while public discovery succeeded.

The SQLite database is stored in `.data/composer.sqlite`, ignored by Git. The worker is separate from the web request lifecycle. Runs survive page reloads; an interrupted worker marks unfinished work failed after its lease can be reclaimed. A crashed worker's lease expires within two minutes.

## Live functionality

Discover agents performs real ANS queries without needing an LLM key. Live composition additionally needs `.env.local` with `OPENAI_API_KEY` and `OPENAI_MODEL`. Configure `COMPATIBLE_AGENTS_JSON` only after testing a registered agent against the report contract; its shape is a mapping from capability IDs to arrays of ANS agent IDs. No production-compatible entries are supplied by default.

Live A2A execution currently supports unauthenticated A2A 0.3.0 JSON-RPC agents implementing the explicit structured report contract and capability IDs. It re-resolves each identity before invocation and checks the card's endpoint and skill. These are compatibility checks, not cryptographic ANS identity verification.

Live LLM planning has been verified. Agent registration, public deployment, verified identity, and a full public-agent research pipeline remain incomplete. See the progress records for evidence and remaining dependencies.

## Validation commands

```sh
npm run typecheck
npm test
npm run build
```

The A2A test binds ports 4311–4313, so stop demo agents before running that test suite. No test invokes a public agent or spends LLM credits.
