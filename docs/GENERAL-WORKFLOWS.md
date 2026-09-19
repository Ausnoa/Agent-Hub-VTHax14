# General workflows (experimental)

Open `/general`, or follow the link on `/create`. Existing report demo workflows remain unchanged.

## Build and run

1. Search the local registry for relevant skills, or ask the configured LLM to suggest a draft. Suggestions use at most 20 indexed candidates and must select only supplied skill IDs. Descriptions are sent to the configured planner; task inputs are not part of planning.
2. Add 1–8 steps. Choose original input or the immediately previous output. Text serializes structured objects and optionally prepends instructions. JSON forwards an object unchanged; text-to-JSON parsing, JSON-path mapping, and inferred schema translation are not supported.
3. Check cards and review actual destination endpoints. The server resolves IDs rather than trusting client-supplied URLs. Save approval records a site-owned workflow, without registering it with ANS.
4. Select a saved workflow, enter input, and explicitly authorize sending it and intermediate outputs to the displayed agents. Use non-sensitive tasks; external services can cause side effects. Start/restart `npm run worker` after updating code.
5. The worker executes sequentially, persists outputs, and stops on failure. An interrupted run is marked failed on worker recovery; there is no automatic retry. Review possible external effects before manually starting another run.

## Supported subset and limits

- Public HTTPS endpoints with unauthenticated A2A 0.3.0 JSON-RPC cards and exact advertised skill IDs.
- Advertised `text/plain` or `application/json` modes; selected input mode must match the skill/card. A2A skill IDs describe capabilities, not a universal function-routing mechanism. Include the desired operation in text instructions; specialized invocation contracts still need dedicated adapters.
- Text parts or one JSON object output. Files, mixed text/data outputs, streaming, authenticated agents, and other protocol versions are rejected.
- Up to eight steps, 24 KB mapped inputs/outputs, 60-second task deadlines. Sequential dependencies can still fail when an agent returns a different format than expected.
- Cards are checked at preparation and invocation; ANS registrations are re-resolved at invocation. Expired/inactive registrations and changed endpoints are rejected. Cryptographic identity verification is not implemented, and a compatible card is not a security audit.

General workflow tables are separate from the original report tables, in the same local SQLite database. General work uses the existing worker lease. `GET /api/general`, proposal/approve/invoke endpoints, and `GET /api/general/runs/:id` expose this path. Saved workflows reload in the general builder; run records persist server-side but a full searchable general-run history UI is not yet implemented.

This expansion removes the three-capability/report-format restriction. It does not certify every indexed agent as callable or guarantee successful third-party execution.
