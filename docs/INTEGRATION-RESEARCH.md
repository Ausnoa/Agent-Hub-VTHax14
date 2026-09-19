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

## Deep pagination search — September 19, 2026

Added cursor-based pagination to `discoverAgents` (`pageToken`/`nextPageToken`, following the ANS response's `links[rel=next].href`) and re-ran `company research`, `risk analysis`, `summarization`, and `investment analysis` across 5 pages each (~90–100 results per query) to check whether relevant candidates exist beyond the first page.

Findings:

- The `helpagent.club` customer-support template mill still accounts for the large majority of results at every depth.
- A second, larger cluster of distinct, purpose-built, plausibly-relevant agents exists entirely on one provider's domain, `agentworks.fr`: `Balance Sheet Analysis`, `Competitor Analysis`, `Lease Analysis`, `Property Company Advisor`, `Tender Analysis`, `Climate Risk Map`, `Compliance Audit`, `EU AI Act Classifier`, `Meeting Summary`, `Insurance Premium Calculator`, `Insurance Coverage Check`, `Fleet Analysis`, `Patent Pre-analysis`, and others. Several of these are strong name/description matches for `risk-analysis` and `summarization`. However, every `agentworks.fr` endpoint checked fails the TLS handshake — confirmed as a genuine server-side TLS/certificate problem, not a local trust-store issue: TCP connects on port 443 (`Test-NetConnection` succeeds), but the handshake fails even with client-side certificate validation bypassed entirely. This is a systemic, provider-wide outage, not a per-agent issue. **This is currently the single largest source of plausible risk-analysis/summarization candidates, and all of it is unreachable.**
- `DroneCraft Research Agent` (`dronecraft.co`) is real, reachable, and has genuine `search-documents` / `analyze-component` / `summarize-content` / `compare-components` skills — but is scoped to drone-component research, not company/investment research. Useful as a proof that well-formed multi-skill A2A agents with real summarization capability do exist and are reachable in principle.
- `Agent Harbor AI Agent` (`commerce.agentharbor.agency`) registered no metadata URL in the ANS record; the conventional `.well-known/agent-card.json` path returns 404, so its actual capabilities are unconfirmed.

Conclusion: deep search does not change the Phase 1 decision gate. No reachable, capability-matched candidate exists for any of the three demo capabilities. The most promising cluster (`agentworks.fr`) is blocked by an external, provider-side TLS failure outside our control, not by our search logic — retrying later is possible but not something to plan the demo around.
