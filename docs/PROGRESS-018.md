# Two more hosted agents and ANS workflows

Goal: publish Glorria Extract and Glorria Answers from the existing extraction and reference-Q&A templates, register each in production ANS, then resolve and invoke both through the general A2A workflow runtime.

Proposed hosts: extract.gloryforglorria.us and ask.gloryforglorria.us on the existing Vercel project. User asked to add domains and Vercel-provided DNS. Keep canonical card URLs server-configured and public inference opt-in. Existing Glorria Brief identity must remain unchanged. No local saved template will be mislabeled as registered.

Input contracts: extractor accepts optional Fields/Source sections (defaults owner, deadline, decision); answers requires Question/Reference sections. Both use text/plain A2A message/send so sequential workflow mapping works without additional transport support. Endpoint/card, validation, and actual SDK chain tests precede registration. Public reachability, domain ownership and final DNS validation are required to complete the hosted milestone.

## Implementation

Shared bounded A2A transport preserves Glorria Brief behavior. Canonical origins explicitly select summary/extract/qa by hostname; unknown or ambiguous hosts fail closed, and incoming hosts never construct advertised URLs. New templates are stateless: request-supplied fields/reference reuse existing grounded execution code. Public inference still requires AGENT_ENABLED=true.

General workflow UI can check and add a live ANS ID/skill directly through existing resolution/card validation. The reference-Q&A mapping starts with a Question/Reference prefix, followed by the original input or previous result. No resolution bypass or invented ANS identity was added.

45 tests pass, including host isolation, malformed input rejection before inference, existing summary behavior, and a complete two-agent chain through the A2A SDK and general queue with test-only registry/model responses. Typecheck passes after correcting an optional test assertion message. Public registration and live hosted chain remain pending domain setup/deployment.
