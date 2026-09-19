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

Open http://127.0.0.1:3000. Select Local demo, build the fixed template, inspect its agents, approve, and run the fictional Northstar notes. A2A messages pass through three separate local agent processes. The report is deterministic and based only on supplied notes, not live company research.

The SQLite database is stored in `.data/composer.sqlite`, ignored by Git. The worker is separate from the web request lifecycle. It also syncs the live ANS registry into a local index when it starts and every 30 minutes; check progress at http://127.0.0.1:3000/api/registry/status. Runs survive page reloads; an interrupted worker marks unfinished work failed after its lease can be reclaimed. A crashed worker's lease expires within two minutes.

## Live functionality

Discover agents performs real ANS queries without needing an LLM key. Live composition additionally needs `.env.local` with `OPENAI_API_KEY` and `OPENAI_MODEL`. Configure `COMPATIBLE_AGENTS_JSON` only after testing a registered agent against the report contract; its shape is a mapping from capability IDs to arrays of ANS agent IDs. No production-compatible entries are supplied by default.

Live A2A execution currently supports unauthenticated A2A 0.3.0 JSON-RPC agents implementing the explicit structured report contract and capability IDs. It re-resolves each identity before invocation and checks the card's endpoint and skill. These are compatibility checks, not cryptographic ANS identity verification.

Agent registration, public deployment, verified identity, and live LLM execution are not complete. See the progress records for evidence and remaining dependencies.

## Validation commands

```sh
npm run typecheck
npm test
npm run build
```

The A2A test binds ports 4311–4313, so stop demo agents before running that test suite. No test invokes a public agent or spends LLM credits.
