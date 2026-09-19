# Agent Composer — MVP build plan

Based on `context.md`. Target: a working hackathon demo within 48 hours.

## Outcome

A user describes an agent, reviews compatible agents genuinely discovered through ANS, saves a sequential workflow, and invokes it through a generated form. Real A2A calls pass results between independently running agents and produce a useful final report.

The initial demo is company research → risk analysis → summary, subject to finding or registering reliable compatible agents. A complete two-agent workflow is the minimum integration milestone; the three-agent demo is the target.

## Scope and decisions

- Follow the PRD's proposed Next.js architecture, using TypeScript across the interface and backend.
- Use one application and one generic workflow runtime. Creating a composite saves configuration; it does not generate code or deploy another server.
- Support sequential workflows and a small explicit capability catalog.
- Use predefined, versioned adapters for supported agent inputs and outputs.
- Obtain agent endpoints through ANS. Compatibility configuration may identify supported agents but must not substitute hardcoded endpoints for discovery.
- Discover from a local index of the ANS registry, synced in the background from live ANS and enriched with agent card skills. Check selected agents against live ANS before execution. See `docs/DECISION-001-ANS-REGISTRY-INDEX.md`.
- Generate form configuration from validated schemas using a fixed set of components.
- Persist workflows, runs, step attempts, and outputs in a relational database. Choose the database and hosting together after confirming deployment constraints.
- Keep credentials and external agent calls on the server.
- Route all database access through gateways in `lib/gateways/`, one per area of data. API routes and server-side jobs call gateways; nothing else touches the database. See `docs/DECISION-002-GATEWAY-AND-DATA-ACCESS.md`.
- Defer accounts, billing, marketplace features, arbitrary graphs, arbitrary schema translation, and workflow editing.

## Phase 1 — Prove ANS and A2A access (hours 0–6)

1. Confirm the actual ANS API, credentials, registration requirements, search facilities, identity evidence, and endpoint resolution behavior against official documentation.
2. Confirm which A2A version and transport the candidate agents support, including task completion and result retrieval.
3. Find compatible research, analysis, and summary agents. Invoke candidates before selecting the demo catalog.
4. If candidates are unavailable, build independently running A2A agents and register them in ANS, then discover them through the same application integration.
5. Define typed ANS client and A2A client boundaries so provider-specific response formats remain isolated.
6. Record the deployment requirements for public agent endpoints, identity checks, and the app runtime.

Acceptance: a small integration harness queries real ANS, resolves two agents, and successfully invokes them through A2A. Record real responses with secrets removed. No simulated discovery counts as passing.

Decision gate: if registration, access, or compatible agents are blocked, resolve that dependency before polishing the UI. Test fixtures may support development but must never be presented as live ANS results.

## Phase 2 — Contracts, persistence, and runtime (hours 6–14)

1. Define validated schemas for capabilities, discovered agents, identity evidence, workflow steps, UI configuration, and execution state.
2. Define the supported capability catalog and adapter registry. Each adapter declares accepted inputs, output validation, and compatibility requirements.
3. Store composite definitions and immutable workflow versions. Each run references the exact approved version.
4. Build a sequential orchestrator that resolves agents, validates compatibility, prepares input, invokes A2A, waits for completion, validates output, and persists results.
5. Preserve original input, accumulated context, previous output, and results indexed by step. Preserve research source references throughout the pipeline.
6. Add bounded timeouts and explicit failure states. Stop downstream execution when a step fails.
7. Build the registry sync: on server start and on an interval, page through all active A2A agents in ANS, upsert them into the local index, then fetch agent cards and store declared skills. Record each sync run. Startup must not wait for the sync.

Acceptance: run the same stored workflow twice with different inputs. The second agent receives the first agent's real output, and each execution has an independent persisted trace. A sync from live ANS populates the index, and a failed sync leaves the previous index intact.

## Phase 3 — Planning, discovery, and approval (hours 14–22)

1. Send the description to an LLM planner and validate its structured response against the supported capability catalog.
2. Keep planning separate from selection: the planner proposes capabilities, not agent identities or endpoint URLs.
3. Search the local registry index for each capability, matching against declared agent card skills rather than ANS display names. Return each candidate with when it was last seen in ANS.
4. Filter candidates by A2A support, usable status, and known compatibility. Rank eligible candidates by simple capability relevance and available identity evidence.
5. Return a reviewable proposal with selected agents, their purposes, provenance, and any unsupported capabilities.
6. Validate the approved proposal server-side before saving it. Do not accept arbitrary client-supplied endpoints or claim every submitted workflow is compatible.

Acceptance: a supported description produces an executable proposal. An unsupported description explains the missing capability without fabricating a match.

## Phase 4 — User interface (hours 22–32)

### Builder

- Description input, example prompt, and Build Agent action.
- Clear planning and discovery progress, including empty results and retryable failures.
- Optional preferred-agent input only if the core path is already stable.

### Review

- Ordered steps showing agent name, ANS description, purpose, protocol, and ANS provenance.
- Inspection of available identity evidence and compatibility status.
- Separate “discovered through ANS” from “identity verified”; badges reflect checks actually performed.
- Create Agent action with server-side validation.

### Saved agent and execution

- Persistent agent URL and form rendered from validated UI configuration.
- Run action and ordered progress: queued, running, completed, or failed.
- Per-step results, timings, and final report with preserved source references.
- Clear failed-step explanation and retry control.

Acceptance: a user completes description → review → creation → invocation without entering endpoints or manually mapping data.

## Phase 5 — Reliability and deployment (hours 32–40)

1. Persist step events and expose progress through a run-status endpoint. Begin with polling; add streaming only if time and hosting support permit.
2. Retry a failed step from persisted prior results, recording a new attempt. Disable simultaneous retries and avoid automatically replaying completed steps.
3. Handle asynchronous A2A tasks and agent failure responses according to the chosen protocol implementation.
4. Re-resolve agents against live ANS, not the local index, before execution and record the endpoint and identity evidence used. If an agent is no longer active, or its identity, endpoint, or compatibility materially changes, stop and require review.
5. Apply endpoint validation and request limits to discovered URLs before making server-side calls, including redirects.
6. Ensure long-running invocation is supported by the chosen host. Use a durable worker if request lifetime limits require one; returning a run ID alone does not keep work running.
7. Deploy the app and agents, verify credentials, and rehearse from a fresh browser session.

Acceptance: failed or unavailable agents produce an accurate visible error; downstream steps do not run; retry preserves completed work. Reloading the page recovers run status.

## Phase 6 — Demo and optional publishing (hours 40–48)

1. Rehearse the complete demo using the deployed environment.
2. Show genuine ANS discovery, agent review, real A2A execution, data passing, and a useful report.
3. Show that the saved composite can be invoked again with a different input.
4. Prepare a clearly labeled recorded successful run as a presentation fallback, without presenting it as a live run.
5. Only after the core demo is stable, expose the composite through a conforming A2A interface, satisfy ANS registration requirements, and verify that ANS can discover it.

Publishing is optional and must not consume time needed for core reliability. A generic HTTP invoke endpoint is not by itself an A2A endpoint.

## Proposed module layout

```text
src/
  app/                 Builder, review, saved-agent pages, API routes
  components/          Agent cards, workflow trace, schema-driven forms
  lib/contracts/       Validated internal schemas
  lib/planner/         Capability planning
  lib/ans/             Discovery, resolution, identity evidence
  lib/registry/        Registry sync, agent card fetching, local index search
  lib/a2a/             Protocol client and task lifecycle
  lib/adapters/        Supported capability and data adapters
  lib/workflows/       Proposal validation and sequential execution
  lib/gateways/        Only database access: registry index, composite, workflow, run, and step storage
agents/                Demo A2A services if needed
tests/                 Contract and end-to-end checks
```

## Data model

Tables, keys, and constraints for these objects are defined in `docs/DECISION-003-DATABASE-SCHEMA.md`.

| Object | Purpose |
| --- | --- |
| DiscoveredAgent | ANS identity, description, protocol, capabilities, endpoint, discovery timestamp, raw evidence reference |
| Registry index | Synced ANS agents, endpoints, functions, fetched agent cards, identity checks, and sync runs |
| WorkflowProposal | Planned capabilities, selected candidates, compatibility checks, review state |
| CompositeAgent | Name, description, original prompt, current approved version |
| WorkflowVersion | Immutable ordered steps, adapter versions, input schema, UI configuration |
| Run | Workflow version, submitted input, status, start/end time, final output |
| StepAttempt | Step, attempt number, resolved agent snapshot, external task reference, input/output, timing, failure |

## API boundaries

| Endpoint | Responsibility |
| --- | --- |
| `POST /api/plan` | Description → validated capabilities |
| `POST /api/discover` | Capabilities → compatible candidates from the local ANS index, and proposal |
| `GET /api/registry/status` | Last sync time, result, and indexed agent count |
| `POST /api/agents` | Validate and save approved proposal |
| `GET /api/agents/:id` | Read composite configuration |
| `POST /api/agents/:id/invoke` | Validate input and start a persisted run |
| `GET /api/runs/:id` | Read progress, step results, and final output |
| `POST /api/runs/:id/retry` | Retry an eligible failed step |
| `POST /api/agents/:id/publish` | Stretch: register a conforming composite with ANS |

## Validation priorities

- Contract checks for planner responses, normalized ANS records, and adapter inputs/outputs.
- Runtime checks for sequential ordering, correct data passing, failure stopping, and retry behavior.
- Integration checks against real ANS and at least two independently running A2A agents.
- Registry sync checks: full pagination, upsert, inactive marking, failed sync preserving the index, and unreachable or malformed agent cards.
- Browser check of the full user journey and recovery after reloading a running or completed invocation.
- Negative cases: no candidate, unsupported capability, invalid planner output, incompatible result, timeout, failed identity check, and duplicate retry.

## Working order and parallel work

The critical path is ANS access → callable agents → compatible data passing → orchestrator → composer UI → demo.

With multiple contributors, split after agreeing on shared contracts: one owns ANS/A2A integration and demo agents, one owns execution and persistence, and one owns the builder/review/run interface. Integrate a thin working path early rather than waiting for each area to be complete.

## Definition of done

- A natural-language request produces a supported capability plan.
- Selected agents and endpoints originate from live ANS discovery.
- Review shows accurate provenance and identity evidence.
- Approval creates a persistent, reusable composite.
- Multiple independently running agents are invoked through real A2A calls.
- Outputs flow through known adapters into subsequent steps.
- The user can observe progress, receive a useful report, and understand failures.
- The deployed demo succeeds repeatedly without manually configuring endpoints.

## Open questions to resolve during Phase 1

- What ANS environment, credentials, and registration facilities are available?
- Which agents and capabilities can be exercised reliably?
- Which A2A versions and transports do those agents actually support?
- What identity checks can the application perform and accurately display?
- Which LLM provider and hosting environment are available to the team? The host needs a persistent filesystem for the SQLite index, or the index moves to a hosted database.
- How many active A2A agents does ANS hold, and how long does a full sync take?
- How many contributors can work in parallel?

These are implementation dependencies, not reasons to delay the initial integration investigation. No external API behavior has been verified as part of this planning document.
