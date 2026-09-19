# Current project status

## Working locally

- Real ANS search with cursor pagination and normalized agent metadata.
- Builder, approval, saved-agent library, reusable runner, execution trace, and reports.
- Three separate local fixture processes exchanging real A2A 0.3.0 JSON-RPC messages through the official client SDK.
- SQLite persistence, atomic queue claiming, worker lease, run history, explicit retries, and interrupted-run recovery.
- Verified live structured LLM planner, with pilot composition selecting local services through a replaceable catalog interface.
- Small SQLite catalog: three local test agents and six genuine ANS records, explicitly separated by provenance.
- Conservative allowlisted ANS-agent selection; registry presence alone never implies compatibility or verified identity.
- Local ANS registry index: the worker syncs live ANS into SQLite, searchable through `POST /api/registry/search`. Proposal building does not use it yet.

## Not yet demonstrated

- A company-research pipeline using agents discovered through ANS. Suitable registered candidates have not been confirmed reachable and compatible.
- Cryptographic ANS identity verification. Every identity remains explicitly unverified.
- Registering our own public agents, which requires domain control, public hosting, and authorized ANS registration setup.
- Public deployment, user authentication, or publishing composites back to ANS.

## Next integration milestone

Provide hosting/domain and registration setup; implement real research/analysis services behind the existing report contract; register them; discover and test their cards; configure their IDs in the compatibility allowlist; run the entire live path. Do not relabel fixture services as live research agents.

## Checkpoints

- Planning baseline and discovery probe committed before subsequent changes.
- A2A execution foundation committed before runtime changes.
- Durable runtime committed before interface changes.
- Further substantial work continues from a documented, tested commit.

See `LOCAL-DEMO.md` for startup and validation commands. Detailed evidence is in the numbered progress records.
