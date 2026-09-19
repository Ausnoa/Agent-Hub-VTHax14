# Milestone 010 — Connection readiness

Checkpoint before implementation: repair the discovered ranking contract mismatch and add a repeatable registry readiness audit. Distinguish indexed registrations, transport/skill candidates, reachable compatible cards, and execution-approved agents. A successful card read is not proof of report compatibility or identity. Do not auto-allowlist agents or register workflows.

## Implemented

- Restored the shared skill type and normalized optional trust-score metadata; ranking safely handles older records without skills. Trust scores remain metadata, not identity verification.
- Added exact report-candidate lookup inside the registry gateway. Composition no longer loses approved candidates outside the first 50 text-search hits. Active/listed, expiration, 24-hour freshness, declared exact skill, card URL, and JSON-RPC transport checks still apply; allowlisting and live card inspection follow selection.
- Added `npm run agents:audit` for current counts and `npm run agents:audit -- --probe` for bounded card-only checks. The probe never invokes a public task or changes the allowlist.

## Measured readiness

At validation: 8,200 indexed registrations; 8,194 active/listed/unexpired registrations; latest sync incomplete (failed at the documented timeout). There are zero fresh exact-skill report candidates and zero approved public candidates. This does not mean those public agents are universally unreachable: they do not satisfy this application's narrow report adapter filters.

All three local fixture cards are reachable and compatible. The current workflow contract supports at most three sequential steps (research, risk analysis, summarization); registry size is not an execution capacity or concurrency measurement.

The next functional expansion requires a new adapter for an actual public agent's declared skill and output format, rather than falsely treating text similarity as compatibility. Local workflows remain site-owned and unregistered.

Validation: typecheck and all 25 non-port-binding tests pass. Production compilation and TypeScript checks now pass as well; no secrets or database contents are committed.
