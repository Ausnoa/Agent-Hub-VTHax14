# Decision 001 — Local ANS registry index

Status: accepted, not yet implemented. Date: September 19, 2026.

## Context

Live ANS search is text-match only. Queries for the demo capabilities return mostly `*.helpagent.club` customer-support templates whose names happen to contain a query word (see `INTEGRATION-RESEARCH.md`). Calling ANS during every planning request also adds latency and makes the demo depend on registry availability.

A search with an empty `query` (filtered to `protocols=A2A`, `statuses=ACTIVE`) returns HTTP 200 with a `next` link, so the full active A2A registry can be enumerated page by page. The total registry size has not been measured yet.

## Decision

The backend maintains a local index of the ANS registry, and prompt-time discovery reads from that index instead of calling ANS.

1. **Sync.** On server start, a background job pages through the filtered registry using the existing `discoverAgents` client and upserts agents and endpoints. Startup does not wait for the sync to finish. The job repeats on an interval (`ANS_SYNC_INTERVAL_MINUTES`).
2. **Agent card enrichment.** After listing completes, a separate rate-limited pass fetches each endpoint's agent card and stores its declared skills. Capability matching uses these skills, not ANS display names.
3. **Discovery.** `POST /api/discover` searches the local index (full-text over skill names, descriptions, and tags) and returns candidates with their `fetched_at` timestamps.
4. **Execution-time check.** Before invoking a saved workflow, the orchestrator checks each selected agent against live ANS. It stops and requires review if an agent is no longer `ACTIVE` or its endpoint changed. This is the re-resolution step in `PLAN.md` Phase 5.

## Rules

- The index contains only data obtained from live ANS and from the agent cards it references. Test fixtures never enter it.
- Every record carries when it was last seen in ANS. The UI shows data as "discovered through ANS", with its age, and never as identity-verified unless a real check ran.
- A failed sync keeps the last successful data and is recorded in `sync_runs`; it never empties the index.
- Agents missing from a completed sync are marked inactive, not deleted.
- Pages are fetched back to back. The page token appears to be a point-in-time search cursor that may expire, so card fetching happens only after listing completes.
- Every indexed agent stores its ANS `agentDescription` (null when ANS omits it). The review screen shows it so users can compare candidates, and full-text search covers it alongside skills. It is written by the agent's owner, not verified by ANS: render it as plain text and pass it to an LLM only as quoted data, never as instructions.
- Agent cards are untrusted third-party input: HTTPS only, no credentials in the URL, no redirects, bounded timeout and response size. Accept both `/.well-known/agent-card.json` and `/.well-known/agent.json`.

## Storage

SQLite through Node's built-in `node:sqlite`, which keeps the project dependency-free. Revisit if the chosen host lacks a persistent filesystem.

| Table | Contents |
| --- | --- |
| `agents` | `ans_id`, `name`, `description`, `ans_name`, `status`, `first_seen_at`, `last_seen_at` |
| `agent_endpoints` | `ans_id`, `url`, `transports`, `metadata_url` |
| `agent_cards` | `ans_id`, `fetched_at`, `protocol_version`, `reachable`, `error`, `raw_json` |
| `agent_skills` | `ans_id`, `skill_id`, `name`, `description`, `tags` (full-text indexed) |
| `sync_runs` | `started_at`, `finished_at`, `pages`, `agent_count`, `card_count`, `status`, `error` |

## Consequences

- Discovery is faster and can match declared capabilities instead of display names.
- The demo keeps working during a brief ANS outage, using clearly timestamped data.
- Index data can be up to one sync interval old; the execution-time check limits the impact to showing a stale candidate, never invoking a stale endpoint.
- Registry size determines sync duration and database size. Measure it before choosing the interval.
