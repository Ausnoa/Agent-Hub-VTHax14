# Milestone: create, test, host, and register our first agent

Branch: `codex/agent-creation`.

## Objective and acceptance criteria

Create one useful agent we own, expose a compatible A2A service, test it locally and publicly, register it with production ANS, and invoke it through the existing general-workflow runtime after discovering it in ANS. A local fixture, a deployed card alone, or PENDING_VALIDATION does not satisfy this milestone.

Done requires evidence for all of:

1. Agreed purpose, advertised skill, input/output contract, and representative examples.
2. Real implementation with meaningful success, invalid-input, and upstream-failure tests; mocked unit tests are labeled separately from live execution.
3. Public HTTPS endpoint and agent card whose URL, version, skill IDs, and declared formats agree with the implementation.
4. Production ANS registration with domain ownership verified and all returned required DNS records published; status ACTIVE.
5. Existing ANS discovery/resolution finds that registration; existing A2A client invokes it successfully; a saved workflow produces a useful result.

## Reuse and scope

- Reuse ANS resolution/indexing and general A2A compatibility checks and execution.
- Existing fixture server provides a local protocol example, not the production implementation or claimed intelligence.
- Keep the local composer control API private; public hosting should expose the agent service rather than the entire local workspace API.
- First deliver one agent; a general agent-creation UI and multiple templates follow after this milestone.
- Preserve existing workflows and database. Use temporary stores for tests.

## Questions sent to the user

- Agent purpose: suggested supplied-text brief/action-item extraction; alternatives include supplied-document Q&A or a user-defined task.
- Public domain, hosting provider, and DNS access.
- Whether a production GoDaddy credential already exists locally; only variable/file location requested, never secret values in chat.

Purpose, domain, hosting, and credential setup are pending answers. Agent name and CSR organization details will be finalized with those choices. No deployment or registration has occurred.

## Registration research / checkpoints

- ANS CLI is already installed at `/opt/homebrew/bin/ans-cli`; reinstall is unnecessary.
- CLI production base must be explicit: `https://api.godaddy.com`; its default is OTE.
- CLI credentials use `ANS_API_KEY`; the app currently uses `ANS_AUTHORIZATION` for optionally authenticated discovery. These are distinct configuration interfaces.
- Advertise A2A with JSON-RPC transport and actual function IDs/tags so the existing planner can discover the new skill. The CLI defaults to MCP/STREAMABLE-HTTP, which must be overridden.
- Use a fresh ignored directory for each CSR generation. Existing CLI output files can be overwritten. Keep private keys and credentials out of commits.
- Registration requires a server CSR or a supplied server certificate, not both. Choose the certificate path with the hosting setup rather than assuming managed hosting can install an ANS-issued certificate.
- Follow returned ACME challenges and DNS records exactly. Do not invent TXT values or infer ACTIVE from a registration ID.

Sources checked on 2026-09-19:

- User-supplied GoDaddy/MLH registration instructions.
- [Official ANS CLI reference](https://github.com/agentnameservice/ans-sdk-go/blob/main/cmd/ans-cli/README.md).
- [ANS registration specification](https://github.com/agentnameservice/ans-registry/blob/main/spec/ans-1-registration.md).

## Commit plan

1. This scope/research checkpoint before implementation.
2. Agent contract/service plus focused tests and local evidence.
3. Hosting and registration tooling/runbook, based on selected provider/domain.
4. Public deployment, ACTIVE registration, and end-to-end evidence (no secrets committed).

Each implementation checkpoint records actual checks and remaining blockers. Do not claim the milestone complete until public ANS-to-A2A invocation passes.

## Implementation checkpoint

User selected a simple first agent. Domain: gloryforglorria.us at Porkbun. Hosting: Vercel, currently deploying main; implementation remains on codex/agent-creation. Added Glorria Brief, a stateless supplied-text summarizer, public /a2a and /.well-known/agent-card.json routes. Reuses structured model generation; no SQLite/worker dependency. Inference is disabled unless AGENT_ENABLED=true. The card requires a configured HTTPS origin rather than trusting request headers. Focused tests and live validation follow in the next checkpoint.
