# Milestone 011 — General A2A workflows

## Pre-implementation checkpoint

Add a separate versioned general-workflow path while retaining the report demo and saved report workflows. Support 1–8 sequential steps with arbitrary advertised skill IDs, explicit original/previous input mapping, text or JSON payloads, and bounded text/data outputs. Agents must expose public HTTPS, unauthenticated A2A 0.3 JSON-RPC cards. Unsupported authentication, files, streaming, and protocols fail closed.

General workflows remain site-owned. Require server-side discovery/card checks, review before saving, and explicit confirmation before sending inputs to external agents. Do not automatically invoke discovered services, auto-retry uncertain side effects, or claim ANS cryptographic identity verification. Persist queue state through the existing worker lease. Add UI, tests, and documented checkpoints.
