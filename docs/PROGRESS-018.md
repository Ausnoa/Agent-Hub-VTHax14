# Two more hosted agents and ANS workflows

Goal: publish Glorria Extract and Glorria Answers from the existing extraction and reference-Q&A templates, register each in production ANS, then resolve and invoke both through the general A2A workflow runtime.

Proposed hosts: extract.gloryforglorria.us and ask.gloryforglorria.us on the existing Vercel project. User asked to add domains and Vercel-provided DNS. Keep canonical card URLs server-configured and public inference opt-in. Existing Glorria Brief identity must remain unchanged. No local saved template will be mislabeled as registered.

Input contracts: extractor accepts optional Fields/Source sections (defaults owner, deadline, decision); answers requires Question/Reference sections. Both use text/plain A2A message/send so sequential workflow mapping works without additional transport support. Endpoint/card, validation, and actual SDK chain tests precede registration. Public reachability, domain ownership and final DNS validation are required to complete the hosted milestone.

## Implementation

Shared bounded A2A transport preserves Glorria Brief behavior. Canonical origins explicitly select summary/extract/qa by hostname; unknown or ambiguous hosts fail closed, and incoming hosts never construct advertised URLs. New templates are stateless: request-supplied fields/reference reuse existing grounded execution code. Public inference still requires AGENT_ENABLED=true.

General workflow UI can check and add a live ANS ID/skill directly through existing resolution/card validation. The reference-Q&A mapping starts with a Question/Reference prefix, followed by the original input or previous result. No resolution bypass or invented ANS identity was added.

45 tests pass, including host isolation, malformed input rejection before inference, existing summary behavior, and a complete two-agent chain through the A2A SDK and general queue with test-only registry/model responses. Typecheck passes after correcting an optional test assertion message. Public registration and live hosted chain remain pending domain setup/deployment.

## Registrations submitted

Both user-configured subdomains resolve to Vercel and present TLS-valid certificates. Production ANS accepted separate BYOC registrations at 22:27 UTC September 19:

- Glorria Extract: 39f5e2f3-7b54-4153-8757-0fe0733c5393, ans://v1.0.0.extract.gloryforglorria.us
- Glorria Answers: 51d689d3-146f-41d6-91dd-0966fc4d7aaa, ans://v1.0.0.ask.gloryforglorria.us

Both are PENDING_VALIDATION. Private keys and registration responses are ignored under .data/ans/extract-1.0.0 and .data/ans/qa-1.0.0. Requested exact DNS-01 TXT challenges from the user, expiring September 20 at 22:27 UTC. Do not resubmit registrations or overwrite keys.

Production build and typecheck pass. Live local HTTP A2A calls using real model inference extracted owner Maya, deadline Friday, decision undecided, then answered owner/deadline with literal JSON evidence. This validates local transport/model chaining, not public reachability: both public cards still return 404. User must deploy the branch and configure the three canonical origin variables plus model settings before hosted workflow acceptance.
