# Milestone 007 — Small catalog and live planner

## Configuration

The configured LLM successfully returned a schema-valid three-capability plan from a live request. Settings were moved from the tracked example into ignored `.env.local`; the example contains placeholders only.

## Implementation

- `AgentCatalog` is the asynchronous lookup interface for composition. `SqliteAgentCatalog` is its small local implementation.
- Three local test agents are seeded into a separate development table. They are not inserted into the ANS registry snapshot.
- `catalog:seed` imports at most six distinct agents from one genuine ANS response. No complete-registry crawl or periodic synchronization is started.
- Pilot mode combines actual LLM planning with indexed, locally tested A2A services. Offline demo remains deterministic and key-free. ANS mode uses indexed records and explicit compatibility configuration.
- The directory shows both populations with distinct provenance, descriptions, capability names, indexing timestamps, and compatibility labels.
- Records older than 24 hours are visible but ineligible for ANS-mode selection; execution still re-resolves live ANS identities.

## Validation

- Live public ANS import succeeded: six registry agents and three separate local agents. One malformed source record was skipped; discovery now counts skipped records instead of failing the entire page. Configured authenticated discovery returned HTTP 401, so public reads default to no authorization header unless explicitly opted in.
- `npm run typecheck`, all 17 tests, and `npm run build` passed. Existing nonblocking warnings concern experimental Node SQLite and an unrelated parent-directory lockfile.
- Browser verification: the configured LLM created a three-step pilot proposal, approval saved composite `3db9dd4e-328d-41c9-9df1-a9bd2f18fa03`, and the worker completed all three A2A steps using fictional Northstar notes. The completed report visibly retained its fixture-output warning.
- Browser catalog verification showed three local agents and six ANS records with separate provenance and compatibility labels.
- Local report outputs remain deterministic fixture output, not live web research. Public registry agents were indexed, not invoked or identity-verified.

## Next database integration

Implement the same `AgentCatalog` search/candidates interface against the main database, preserve provenance and freshness checks, then supply it to composition. Expand capability adapters separately; adding rows cannot make arbitrary A2A agents compatible with the report schema.
