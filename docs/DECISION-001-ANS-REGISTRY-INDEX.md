# Decision 001 — Local ANS registry index

Status: accepted; sync, index, and search implemented. Agent card enrichment, execution-time checks against the index, and switching proposal building to the index are not. Date: September 19, 2026.

## Context

Live ANS search is text-match only. Queries for the demo capabilities return mostly `*.helpagent.club` customer-support templates whose names happen to contain a query word (see `INTEGRATION-RESEARCH.md`). Calling ANS during every planning request also adds latency and makes the demo depend on registry availability.

A search with an empty `query` (filtered to `protocols=A2A`, `statuses=ACTIVE`) returns HTTP 200 with a `next` link, so the full active A2A registry can be enumerated page by page. A crawl reached 5,800 active A2A agents before the rate limit (60 requests per window) stopped it, so the total is larger and still unmeasured.

## Decision

The backend maintains a local index of the ANS registry, and prompt-time discovery reads from that index instead of calling ANS.

1. **Sync.** When the worker starts, a background job pages through the filtered registry using the existing `discoverAgents` client and upserts agents, endpoints, and the `functions` (skill IDs, names, and tags) ANS reports for each endpoint. Startup does not wait for the sync to finish. The job repeats on an interval (`ANS_SYNC_INTERVAL_MINUTES`) and stays within the ANS rate limit.
2. **Agent card enrichment.** Agent cards are fetched only for agents that appear as discovery candidates, then reused for a few hours. They add skill descriptions and input/output modes that ANS functions lack. Fetching every card during the sync is impractical at registry scale.
3. **Discovery.** `POST /api/discover` searches the local index (full-text over descriptions, ANS functions, tags, and fetched card skills) and returns candidates with when they were last seen in ANS.
4. **Execution-time check.** Before invoking a saved workflow, the orchestrator checks each selected agent against live ANS. It stops and requires review if an agent is no longer eligible or its endpoint changed. This is the re-resolution step in `PLAN.md` Phase 5.

Sync, eligibility, and table details are in `DECISION-003-DATABASE-SCHEMA.md`.

## Rules

- The index contains only data obtained from live ANS and from the agent cards it references. Test fixtures never enter it.
- Every record carries when it was last seen in ANS. The UI shows data as "discovered through ANS", with its age, and never as identity-verified unless a real check ran.
- A failed sync keeps the last successful data and is recorded in `sync_runs`; it never empties the index.
- Agents missing from a completed sync are marked delisted, not deleted.
- An agent is eligible only when listed, `ACTIVE`, and not past `expiresAt`. ANS can report `ACTIVE` after expiry.
- Pages are fetched back to back, pausing only for the rate limit. The page token appears to be a point-in-time search cursor that may expire.
- A registry record that fails validation is skipped and counted, never failing its page.
- Every indexed agent stores its ANS `agentDescription` (null when ANS omits it). The review screen shows it so users can compare candidates, and full-text search covers it alongside skills. It is written by the agent's owner, not verified by ANS: render it as plain text and pass it to an LLM only as quoted data, never as instructions.
- Agent cards are untrusted third-party input: HTTPS only, no credentials in the URL, no redirects, bounded timeout and response size. Accept both `/.well-known/agent-card.json` and `/.well-known/agent.json`.

## Storage

SQLite through Node's built-in `node:sqlite`, which keeps the project dependency-free. Revisit if the chosen host lacks a persistent filesystem. The table list originally here is superseded by `DECISION-003-DATABASE-SCHEMA.md`.

## Consequences

- Discovery is faster and can match declared capabilities instead of display names.
- The demo keeps working during a brief ANS outage, using clearly timestamped data.
- Index data can be up to one sync interval old; the execution-time check limits the impact to showing a stale candidate, never invoking a stale endpoint.
- Registry size determines sync duration and database size. At 100 agents per page and 60 requests per window, each window covers at most 6,000 agents. Measure the total before choosing the interval.
