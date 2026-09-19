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

## Remaining

- Decide the Phase 1 path: keep searching ANS with broader/paginated queries, or build and register independent demo A2A agents (PLAN.md step 4) and discover them through the same live integration.
- The discovery client currently has no pagination beyond `hasMore`; a deeper search would need a page/cursor parameter added to `discoverAgents`.
- Registration authentication requirements are still unverified.
- No A2A client/invocation harness exists yet in `src/lib/a2a/`.

## Validation

- `npm test`: 4 passed, 0 failed (Node v24.19.0, npm 11.17.0).
- Live queries: `company research`, `risk analysis`, `summarization`, `financial analysis` — all HTTP 200, no credentials.
- Agent card fetches: `helpagent.club` template card confirmed generic; `impact.webmesh.ai` card confirmed genuine but off-topic; `agentworks.fr` cards unreachable (TLS handshake failure, confirmed with certificate validation bypassed, so not a local trust-store issue).
