# Workflow builder user testing — 2026-09-19

Agent-led usability walkthrough of the running local app, using browser controls for discovery, planning, editing, approval, execution, and reload. This is not a study with recruited human participants. API reads corroborated run results. No application code was changed.

## Outcome

Simple and three-step workflows can be created and executed. Successful A2A calls do not necessarily produce useful answers. The largest observed obstacles were registry rate limits, missing agent knowledge, loss of instructions when changing formats, and missing run-history/draft recovery in the general composer.

## Scenarios

| Scenario | Observed result |
| --- | --- |
| Manual one-step Bear Coffee product Q&A | Found agent, added Answer Questions, entered instructions, checked card, approved and saved through UI. First execution failed with ANS HTTP 429. Manual retry completed, but agent said its product database was unavailable. |
| LLM two-step translation and summarization | Correctly rejected: matching translation-business agents only offered customer support skills. Explanation was truncated mid-sentence. |
| LLM Bear Coffee → Big Fish Coffee | Correctly selected two named agents and Answer Questions skills; second step used previous output. First compatibility attempt hit HTTP 429. |
| Three-step Bear Coffee → Big Fish Coffee → Bear Coffee | Added a third step manually, restored instructions after format test, checked all cards, approved, saved, and executed. All three calls completed. First agent lacked catalog data; later steps requested context/products instead of generating the intended comparison. |
| Text → JSON → Text editing | Instructions disappeared and did not return when Text was reselected. No warning or undo. |
| Invalid JSON input | Entered `{"question":` with JSON input checked. Execution was rejected with “Unexpected end of JSON input”; the previous failed run remained visible. No new run appeared. |
| Search relevance | “Bear Coffee” returned the correct agent plus unrelated businesses matching “Bear,” including a sleep center and milling company. |
| No matches | Searching `zzzxqv7462` cleared results but displayed no no-results message. |
| Reload/reopen saved workflow | Saved workflow remained available. Draft returned to zero steps; input and visible result were gone. Selecting the saved workflow did not restore history. |
| Eight-step boundary | Added eight steps; Add buttons became disabled at 8/8. Duplicate steps were not executed. |
| Remove first step | Removing step one from eight steps produced seven steps and correctly reset the new first step to Original input. |
| Execution consent | Changing input/format cleared authorization; Run stayed disabled until authorization was selected. |

## Findings and suggested priority

### P1 — Preserve instructions across format changes

Reproduce: fill a step's Instructions, select JSON object unchanged, then select Text. The field is empty. This silently loses authored or generated work and can change workflow behavior.

Source: `src/app/general/page.tsx:61` explicitly clears `instruction` on every format change. Preserve a text draft while JSON is selected, or make destructive clearing explicit with recovery.

### P1 — Make unsuccessful answers visible in complex runs

The three-step run is marked completed even though no stage supplied the requested comparison. The first stage's catalog failure was propagated as ordinary text, so downstream agents kept asking for missing information.

This is a task-quality limitation, not evidence that A2A transport failed. Consider explicit output expectations, a needs-input/unavailable outcome, and stopping or asking the user when a prerequisite answer is missing. Do not rely on arbitrary text heuristics as definitive failure classification.

The available mapping chooses original input OR previous output. It cannot include both, and concatenates instructions and previous text without labels (`src/lib/general/contracts.ts:20`). Downstream stages can lose the original user constraints. Add a clearly labeled context mapping and preview it before execution. In this test, missing upstream catalog data also contributed; context formatting alone would not recover that data.

### P2 — Recover from registry rate limits clearly

Observed HTTP 429 during both execution and proposal checks. The UI showed only the raw resolution error, without cooldown/retry guidance. A background registry sync was active; it may have contributed, but this was not established causally.

The test worker was restarted with `ANS_SYNC_INTERVAL_MINUTES=0` for this process only. Afterward, a manual simple-run retry and three-step compatibility checks succeeded. No persistent environment file was changed. Add shared registry request coordination and actionable retry timing where available; avoid blindly retrying external agent actions.

### P2 — Restore drafts and expose saved run history

Reload discarded the draft and visible run. Selecting the saved workflow exposed a fresh runner without the prior result or a history control. Runs are still retrievable by API ID, so this is UI discoverability/recovery loss, not proven database loss. Add draft persistence and a run-history view linked to each workflow.

### P2 — Improve discovery and progress feedback

Exact business search was mixed with many partial matches, and zero results were indistinguishable from an untouched search. Planner/card-check buttons disabled while working but had no progress label. Mapping displays identical skill names and UUIDs instead of business names, making a multi-agent chain difficult to review. Show match count, exact matches first, a no-results state, operation-specific loading feedback, and agent names in each step.

### P2 — Place actionable validation near the input

Malformed JSON generated a raw parser error at the top of the page while an old failed run stayed below. Unsupported planner feedback was truncated at 300 characters by the API error handler. Explain the invalid field inline and preserve a complete actionable explanation.

## Saved evidence

| Artifact | ID |
| --- | --- |
| UT — Bear Coffee product questions | `449e4916-9461-4151-b947-49820b0bf3d6` |
| Initial simple run: failed, HTTP 429 | `f1eab6f2-c537-428f-b302-8823d5642908` |
| Simple retry: completed, catalog unavailable | `6b39e511-9a06-49dd-af75-3a836936ba75` |
| UT — Coffee alternatives chain | `aca7487d-c21a-43c8-a576-c19fe600f3c3` |
| Three-step run: completed, goal unmet | `22c1eb8a-0f87-4abe-bc06-2f2764b15161` |

Saved workflows are available at `http://127.0.0.1:3000/general`. Run evidence is available at `/api/general/runs/<run-id>` on that host. Test inputs contained only generic product questions. No order lookup, purchase, or customer account operation was executed. Test workflows were retained for review; the eight-step boundary draft was not saved.

Scope limits: no human participant interviews, mobile/accessibility audit, branching/parallel execution, file handling, or broad agent-catalog availability audit. No claim is made that agents' product facts were independently verified.
