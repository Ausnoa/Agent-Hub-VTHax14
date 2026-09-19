# Template builder and owned-agent workflows

User requested three templates in place of the preloaded preview, a real ANS registration attempt, and eventual orchestration of user-created agents in the existing general workflow builder.

Plan: immutable saved named agents with summary, extraction, and reference-Q&A templates; test inputs; local persistent storage; add-to-workflow handoff; owned-agent resolution/invocation in the existing sequential runtime. Keep remote ANS agents on their existing validation path. Local created agents are explicitly unregistered, not fixtures or verified public identities. Local saving uses the existing guarded workspace API; hosted multi-user persistence/accounts remain separate work.

Registration preflight: ANS CLI installed; no usable ANS_API_KEY or sso-key pair found in .env/.env.local (values not printed). User asked to supply a local credential location and confirm DNS availability. System DNS lookup failed for www.gloryforglorria.us, while dig returned a Vercel CNAME/IPs; investigate this separately from domain ownership. Do not submit duplicate registrations or claim ACTIVE without verification.

## Registration submitted

Loaded lowercase ans_api_key and ans_api_secret from ignored .env into the CLI environment (no secret values displayed or committed). Submitted production registration using the existing, TLS-validated Vercel leaf certificate as BYOC and a freshly generated EC P-256 identity CSR. ANS accepted the request:

- ID: 2076c6a9-5114-42c8-8d63-c76eabcea804
- Name: ans://v1.0.0.www.gloryforglorria.us
- Status: PENDING_VALIDATION
- Challenge expiry: 2026-09-20T21:52:29Z
- Private materials/response: ignored .data/ans/glorria-1.0.0/

Requested Porkbun TXT host _acme-challenge.www with the exact returned public challenge. Awaiting user DNS publication before verify-acme; final ANS DNS records follow validation. The public agent-card URL still returns 404 because main does not yet include this branch. Registration acceptance does not establish reachability or ACTIVE status. Automatic Vercel certificate rotation will require ANS certificate renewal planning.

## Builder implementation

Three configurable templates: supplied-text summary, extraction of named fields (null when absent), and reference-grounded Q&A. Immutable saved agents persist in owned_agents via the existing SQLite workspace database. Created agents are selectable in /general, and the runtime validates and invokes their saved definitions locally; external ANS steps retain the previous resolution/card checks. Local runs do not pretend to be ANS-registered A2A calls. Hosted builder shows a clear local-storage limitation; public multi-user creation remains out of scope until accounts and durable hosted storage exist.

## Verification and DNS follow-up

All 42 automated tests, typecheck, and production build passed. Tests cover template validation, exact extraction fields/source values, Q&A evidence, persisted definitions, and a two-step owned-agent workflow without ANS calls. Live UI summary test succeeded with two explicit actions and an undecided launch date. Live reference Q&A correctly returned the 30-day policy and a literal supporting quote. A live summary → extraction workflow timed out at the upstream 45-second boundary on its first run; a manual retry completed successfully (run 8d9ec51b-fb7f-40d9-b819-4e320073d94f), preserving the summary actions and extracting owner Maya with launch date null. No automatic retry was added.

The user published the exact challenge TXT. ANS verify-acme returned DNS-record-not-found; investigation showed validating DNS resolvers fail DNSSEC. A diagnostic lookup with checking disabled finds the exact challenge, while the parent DS has no matching published DNSKEY. User enabled Porkbun DNSSEC; awaiting signing/propagation before another verification attempt. Registration remains pending, not ACTIVE.

Final follow-up: after the user enabled DNSSEC, a second verify-acme attempt still returned 422 (DNS challenge not found; HTTP challenge 404). Public resolver DNSSEC errors and missing authoritative DNSKEY persisted. No final ANS records are available yet. Continue verification against the existing registration after DNSSEC publishes/propagates; do not submit again. The final production build/typecheck passed, and saved agents remained visible after restarting the local server. Changes pushed to codex/agent-creation; main was not merged.

## DNSSEC recovered; domain verified

September 19, 2026, 22:04 UTC: authoritative Porkbun DNS now publishes DNSKEY/RRSIG; Cloudflare and Google validating resolvers return the correct challenge with authenticated-data flags. verify-acme succeeded and DOMAIN_VALIDATION is complete. Registration 2076c6a9-5114-42c8-8d63-c76eabcea804 is now PENDING_DNS, not ACTIVE. Latest response saved locally in .data/ans/glorria-1.0.0/status.json. Required TXT records returned:

- _ans.www: `v=ans1; version=v1.0.0; p=a2a; mode=direct; url=https://www.gloryforglorria.us/a2a`
- _ans-badge.www: `v=ans-badge1; version=v1.0.0; url=https://transparency.ans.godaddy.com/v1/agents/2076c6a9-5114-42c8-8d63-c76eabcea804`

TTL 3600. API also returns HTTPS and TLSA suggestions without required=true; do not replace the existing Vercel CNAME or bind a rotating leaf certificate without lifecycle planning. Next: publish required TXT records and run verify-dns.

## ANS registration ACTIVE

September 19, 2026, 22:13 UTC: both required TXT records resolve with exact expected values. verify-dns succeeded with status ACTIVE, phase COMPLETED, and completed domain validation, certificate issuance, and DNS provisioning. A separate status request confirmed ACTIVE for registration 2076c6a9-5114-42c8-8d63-c76eabcea804 (ans://v1.0.0.www.gloryforglorria.us). Responses saved in ignored .data/ans/glorria-1.0.0/. Neither optional HTTPS nor TLSA records was needed for activation.

Public agent-card URL still returns HTTP 404. Registration is complete, but hosted runtime acceptance is not: deploy the agent-creation branch to the canonical domain, configure server environment, and smoke-test A2A before claiming the agent is usable end to end.
