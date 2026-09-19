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
