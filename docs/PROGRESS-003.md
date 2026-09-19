# Milestone 003 — A2A execution foundation

The existing discovery and card-inspection checkpoints are preserved. A reachable SEO card independently confirmed A2A 0.3.0 JSON-RPC. The corn-futures host did not accept a connection.

## Implementation

- Pinned the official A2A SDK and app dependencies in the lockfile.
- Added validated input, report, workflow, and proposal contracts.
- Added card inspection and bounded A2A invocation, including polling asynchronous tasks and rejecting interrupted/failed tasks.
- Added network restrictions, DNS address pinning, redirect refusal, response size limits, and exact local-fixture exceptions.
- Added three independently launchable deterministic fixture services and a real HTTP protocol integration test using the official SDK client.

## Honest demo boundary

Fixtures process user-supplied notes. They do not perform live company research, are not ANS registered, and never claim verified identity. They unblock local runtime development while public hosting and registration are arranged. Live discovery is still a separate, real integration; the full live ANS-to-A2A milestone is not satisfied.

## Registration dependency

The [official registration reference](https://developer.godaddy.com/en/docs/references/rest/ans/registration) requires a hosted agent domain and identity CSR, and describes a validation challenge. Domain control, hosting, and authorized registration access are needed before publishing our own agents. No registration, DNS change, or paid hosting has been attempted.

## Validation

- `npx tsc --noEmit`: passed.
- `npm test`: 7 passed, including actual HTTP exchanges through the official SDK across three local services. Loopback binding required sandbox escalation.
- The resulting summary contains the risk signal from the original notes and retains its source attribution.
