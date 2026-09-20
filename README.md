# Agent-Glorria-VTHax14
VTHax project, agent glorria of multiagentic workflows supporting ANS security and agent composition

## Quick start

Requires Node.js 24+.

```sh
npm install
```

Start three terminals from the repository root:

```sh
npm run demo:agents   # three local fixture A2A agents on ports 4311-4313
```

```sh
npm run worker        # picks up and executes queued workflow runs
```

```sh
npm run dev           # Next.js app on http://127.0.0.1:3000
```

All three must be running for a composed agent to actually execute — without the worker, invocations stay queued forever; without the fixture agents, the worker can't reach them.

Open http://127.0.0.1:3000 and go to **Compose**. Select **Offline demo** to run the full pipeline (plan → discover → review → execute) with no API keys required — it uses a fixed template and the three local fixture agents above. **Pilot catalog** and **ANS catalog** modes additionally need real LLM planning, which requires `OPENAI_API_KEY` and `OPENAI_MODEL` in an untracked `.env.local`; check `GET /api/status` for `plannerConfigured` to confirm they're picked up, and restart `npm run dev` after adding them. See [the local demo guide](docs/LOCAL-DEMO.md) for the full walkthrough, the agent catalog, and live ANS/A2A behavior.

```sh
npm run typecheck
npm test
npm run build
```

The A2A test suite binds ports 4311–4313, so stop `npm run demo:agents` before running `npm test`.

## Project documentation

- [Product requirements](context.md)
- [Build plan](PLAN.md)
- [Development and commit workflow](docs/DEVELOPMENT.md)
- [Integration research](docs/INTEGRATION-RESEARCH.md)
- [Decision 001: local ANS registry index](docs/DECISION-001-ANS-REGISTRY-INDEX.md)
- [Decision 002: database gateways](docs/DECISION-002-GATEWAY-AND-DATA-ACCESS.md)
- [Decision 003: database schema](docs/DECISION-003-DATABASE-SCHEMA.md)
- [First milestone](docs/PROGRESS-001.md)
- [A2A execution](docs/PROGRESS-003.md)
- [Durable runtime](docs/PROGRESS-004.md)
- [Composer interface](docs/PROGRESS-005.md)
- [Run the local demo](docs/LOCAL-DEMO.md)
- [Current status](docs/STATUS.md)
- [Implemented architecture](docs/ARCHITECTURE.md)
- [Second milestone](docs/PROGRESS-002.md)

Run `npm run probe:ans -- company research` for a live ANS discovery check outside the app. Fixture outputs and unverified identities are labeled explicitly throughout the UI.
