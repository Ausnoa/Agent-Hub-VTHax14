# Integration findings — September 19, 2026

## ANS

The [official agent API reference](https://developer.godaddy.com/en/docs/references/rest/ans/agents) documents a registered-agent list operation, query filters, endpoint metadata, and pagination. The initial probe follows that operation and locally excludes inactive or non-A2A endpoints.

Discovery is not an application-performed identity check. Normalized results explicitly remain unverified. The probe never follows registry-provided URLs or sends registry credentials to agents.

The [API introduction](https://developer.godaddy.com/en/docs/api-users) names the production API origin. Access and authentication requirements must still be validated against the actual hackathon environment. Do not assume the example server URLs in generated reference examples are deployable services.

## A2A

The [official JavaScript SDK](https://github.com/a2aproject/a2a-js) supports clients and servers and documents current protocol compatibility. Pin a released version after inspecting actual candidate agent cards. Do not assume an older tutorial's methods match the selected release.

## Remaining integration gate

Public registry access was confirmed with HTTP 200, and the implemented search probe succeeded without credentials. Registration access remains untested. Next, inspect actual agent cards, select compatible transports, and invoke two independently running agents. Until then, the Phase 1 acceptance criterion remains incomplete.

## Agent card inspection — September 19, 2026

Probed live ANS for the three demo capabilities (`company research`, `risk analysis`, `summarization`) plus `financial analysis`, then fetched the returned candidates' actual agent cards.

Findings:

- The large majority of matches for all three demo capabilities are generic GoDaddy-hosted template agents on `*.helpagent.club`, all named `<company> Customer Support Agent`. Their agent cards confirm identical skills (`answer-questions`, `order-lookup`) regardless of the company name in the title. They matched purely because the registered company name contains a query word (e.g. "Research", "Risk", "Sum"). None expose a company-research, risk-analysis, or summarization skill. This confirms and sharpens the concern already recorded in `PROGRESS-001.md`: text-match relevance does not imply capability compatibility.
- A smaller set of distinct, purpose-built agents also surfaced: `Domain Impact Analyzer` (webmesh.ai) and, for "financial analysis", `Balance Sheet Analysis`, `Lease Analysis`, `Property Company Advisor`, `Competitor Analysis`, `Tender Analysis` (all on `agentworks.fr`).
  - `Domain Impact Analyzer`'s card is a genuine, well-formed, high-trust A2A agent (protocolVersion `1.0`, ANS trust card, transparency-log entry, `noAuth` security scheme, real `analyze` skill) — but its actual capability is scoring domain-takedown risk for DNS/registry operations, not company financial or business risk. Not usable for our demo despite the "risk" name match.
  - The `agentworks.fr` agents have names that plausibly map to `risk-analysis` (Balance Sheet Analysis, Competitor Analysis) and `company-research`, but every endpoint on that domain (`competitor-analysis.agentworks.fr`, `balance-sheet-analysis.agentworks.fr`) currently fails the TLS handshake outright ("underlying connection was closed") even with certificate validation bypassed client-side — this is a server-side TLS misconfiguration, not a trust-store issue we can work around. These agents are currently unreachable regardless of what their cards claim.
- Also observed: registered agent cards use inconsistent `protocolVersion` values (`0.3.0` on the helpagent.club template vs `1.0` on Domain Impact Analyzer) and inconsistent well-known paths (`/.well-known/agent-card.json` vs `/.well-known/agent.json`). Any A2A client must tolerate both.

Conclusion: as of this probe, live ANS does not reliably surface a genuinely compatible, reachable agent for any of the three demo capabilities (company-research, risk-analysis, summarization). This reaches the decision gate PLAN.md defines for Phase 1: candidates are effectively blocked, so the fallback path (build and register our own demo A2A agents, then discover them through the same live integration) should be evaluated before further UI or orchestrator work.
