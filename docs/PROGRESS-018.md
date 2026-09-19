# Two more hosted agents and ANS workflows

Goal: publish Glorria Extract and Glorria Answers from the existing extraction and reference-Q&A templates, register each in production ANS, then resolve and invoke both through the general A2A workflow runtime.

Proposed hosts: extract.gloryforglorria.us and ask.gloryforglorria.us on the existing Vercel project. User asked to add domains and Vercel-provided DNS. Keep canonical card URLs server-configured and public inference opt-in. Existing Glorria Brief identity must remain unchanged. No local saved template will be mislabeled as registered.

Input contracts: extractor accepts optional Fields/Source sections (defaults owner, deadline, decision); answers requires Question/Reference sections. Both use text/plain A2A message/send so sequential workflow mapping works without additional transport support. Endpoint/card, validation, and actual SDK chain tests precede registration. Public reachability, domain ownership and final DNS validation are required to complete the hosted milestone.
