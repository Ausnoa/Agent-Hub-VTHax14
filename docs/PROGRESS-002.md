# Milestone 002 — Agent card inspection and decision gate

## Completed

- Verified `npm test` (4/4) and the live discovery probe still pass on a fresh Node 24 install.
- Queried live ANS for the three demo capabilities (`company research`, `risk analysis`, `summarization`) and one adjacent term (`financial analysis`).
- Fetched and inspected the actual agent cards for the distinct (non-template) candidates returned, not just the ANS search metadata.
- Recorded findings in `docs/INTEGRATION-RESEARCH.md`.

## Key finding

Live ANS search for our three demo capabilities returns almost entirely generic `*.helpagent.club` "Customer Support Agent" templates matched on substring, not capability. The few distinct, purpose-built agents found either serve an unrelated capability (`Domain Impact Analyzer` scores DNS-takedown risk, not company risk) or are currently unreachable (`agentworks.fr` agents fail TLS handshake). No genuinely compatible, reachable candidate has been confirmed for company-research, risk-analysis, or summarization.

## Scope

This reaches the decision gate `PLAN.md` defines for Phase 1: "if registration, access, or compatible agents are blocked, resolve that dependency before polishing the UI." No A2A invocation has been attempted yet, because no confirmed-compatible, confirmed-reachable candidate exists to invoke.

- Added cursor-based pagination (`pageToken`/`nextPageToken`) to `discoverAgents` and the probe script, then re-searched `company research`, `risk analysis`, `summarization`, and `investment analysis` across 5 pages each (~90-100 results per query) to check for candidates beyond page one.
- Confirmed a second, larger cluster of plausibly-relevant agents exists entirely on `agentworks.fr` (Balance Sheet Analysis, Competitor Analysis, Meeting Summary, Compliance Audit, and others), but every endpoint on that domain fails the TLS handshake — confirmed as a genuine provider-side outage (TCP connects, handshake fails even with client-side cert validation bypassed), not a local or code issue.
- Confirmed `DroneCraft Research Agent` is a real, reachable, well-formed multi-skill A2A agent (search/analyze/summarize) but scoped to drone components, not company research.

## Remaining

- Decide the Phase 1 path: retry `agentworks.fr` later in case the TLS outage is transient, or build and register independent demo A2A agents (PLAN.md step 4) and discover them through the same live integration.
- Registration authentication requirements are still unverified.
- No A2A client/invocation harness exists yet in `src/lib/a2a/`.

## Validation

- `npm test`: 5 passed, 0 failed (Node v24.19.0, npm 11.17.0).
- Live queries: `company research`, `risk analysis`, `summarization`, `financial analysis`, `investment analysis` — all HTTP 200, no credentials, paginated up to 5 pages each.
- Agent card fetches: `helpagent.club` template card confirmed generic; `impact.webmesh.ai` card confirmed genuine but off-topic; `dronecraft.co` card confirmed genuine but off-topic; `agentworks.fr` cards unreachable (TLS handshake failure, confirmed with certificate validation bypassed and a raw TCP connect succeeding, so not a local trust-store or DNS issue); `agentharbor.agency` metadata URL returns 404 at the conventional path.
