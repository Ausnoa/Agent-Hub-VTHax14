# Agent creation (capability pipeline)

Every Glorria agent and workflow is created through this pipeline: ANS-first discovery, Gemini for supported gaps, and an interface designed by three specialist roles. Every saved agent keeps the original Glorria experience: a cat pops out, the agent joins the fleet, and it opens on a profile with a launchable interface.

## Where agents are created and live

| Surface | What happens |
|---|---|
| `/create` (nav "Create agent", fleet directive, dashboard) | Describe an agent → review the resolved steps and the designed interface → add suggestions or custom capabilities → **Create agent**. The cat pops out and the browser opens `/agents/{id}`. |
| `/general` (local) and hosted Compose | Hand-pick agents. Saving runs `capabilities/adopt`: the steps are kept, the specialists design the interface, and it is published as a revision. The description box hands off to `/create`. |
| `/agents` | One fleet grid: workflow agents (latest revision per family) next to report composites and template agents. **Launch Interface** opens the profile. |
| `/agents/{id}` | Profile: header, the specialist-designed interface wired to real runs, what powers the agent, past runs, and **Enhance** for the owner. |
| Cat (local pack or hosted bar) | The cat window renders the same interface in compact form, opening on the specialists' `primaryPanel`. The cat is keyed by the revision family, so enhancements update it. |
| `/agent-preview`, `/create/report` | Advanced links. The single-skill template builder and the legacy report composer demo are unchanged. `/studio` redirects to `/create` or to a profile. |

## Setup

Set `GEMINI_API_KEY` and `GEMINI_MODEL` on the server. `GEMINI_MODEL` may be a comma-separated fallback list (quota, overload, and retired-model responses move to the next model). Use models supporting structured JSON outputs and audio input if transcription is needed. Keys must never use the `NEXT_PUBLIC_` prefix. The provider adapter uses Google's [generateContent API](https://ai.google.dev/api/generate-content) and [structured JSON outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).

For local development, put the settings in `.env.local`, start `npm run dev`, and run `npm run worker` in another terminal. Both processes must use the same `COMPOSER_DB`. New SQLite proposal/head tables are created automatically.

For hosted accounts, apply `supabase/migrations/202609250001_capability_workflows.sql` after the existing migrations. Set `HOSTED_AGENT_TESTS_ENABLED=true` as well as the Gemini settings. The migration adds private proposals, revision heads, an atomic publish function, and a larger bounded input allowance for audio. It does not rewrite existing workflow definitions or runs. This branch does not apply migrations to a live Supabase project.

## Creation and execution

1. Gemini decomposes the explicit request into at most eight capabilities with input dependencies. Optional suggestions are not inserted.
2. Each new capability searches live ANS using its own query. Matching candidates are ranked and checked using the existing registration and A2A-card preparation path. Current discovery uses the first returned page for each capability query; it does not establish that the entire registry lacks a match.
3. A supported missing transformation can become an explicit Gemini step. Supported contracts are summarization, extraction, classification, text transformation, grounded answering, flashcards, quizzes, and audio transcription. External research, storage, databases, API actions, and similar infrastructure have no generic Gemini fallback. Registry search failures propagate rather than being mistaken for empty results.
4. Product, frontend, and backend model roles produce a typed presentation. Deterministic validation requires every panel to bind to an existing output; quiz and flashcard controls require their matching output contracts. Failure uses a deterministic functional layout.
5. The proposal is stored. Saving accepts its identifier, rechecks compatibility, and publishes an immutable workflow revision. Incomplete proposals cannot be published. Proposals expire after one hour.
6. Execution uses the existing local queue/worker or hosted step-claim RPCs. External registrations are re-resolved, and uncertain external actions are not automatically retried. Gemini calls use the same explicit step inputs and persist results in the run.

`inputStep` references an earlier step by index, allowing summary → flashcards and summary → quiz branches. Execution remains serial in topological order. Existing `original`/`previous` mappings still work. There are no joins, loops, or concurrent execution in this version.

Native recording/upload controls are derived from the original-input contract. Export downloads actual persisted outputs. These controls never prompt the model to pretend to record, store, or download a file.

## Interfaces and enhancements

`designInterface` (pipeline.ts) runs the product, frontend, and backend roles for creation, enhancement, and adoption. The specialists receive each output's allowed components and the native input contract. The interface they return chooses:

- a title, description, input label and hint, action label, and empty state
- tabs, stack, or columns
- one panel per output, with a description
- a `primaryPanel` for the cat window
- which supporting sections to show: `history`, `export`, `capabilities`

`repairUI` downgrades a mislabelled display component to text. `validateUI` still rejects bindings to missing or duplicated steps. Any failure keeps a deterministic layout, and during enhancement the existing layout is preserved. Older saved interfaces without the optional fields show every supporting section.

`CapabilityRunner` renders the interface everywhere: profile, local cat window, hosted cat chat. It uses Glorria's existing cards, buttons, and theme, and renders text, structured tables, revealable flashcards, scored quizzes, and real JSON downloads.

Enhancement starts from a saved workflow or a stored proposal. The existing steps are preserved; additions go through discovery, compatibility checking, fallback, and UI generation again. Publishing a revision preserves a stable `rootId`, increments the revision number, and retains the immutable workflow IDs used by old runs. Concurrent edits based on a stale revision are rejected. New hosted revisions start private, consistent with existing save behavior. Existing template agents remain usable as workflow steps in the manual builder.

The saved UI and suggestions are reused on load and on ordinary runs. Model specialists do not run while a user reveals a card, answers a quiz, switches panels, or downloads outputs. A creation request uses one decomposition call, at most one candidate-ranking call per requested capability, and up to three UI-role calls. Hosted planning/search/run budgets continue to apply. Gemini steps consume the workflow-run budget; they do not use the separate OpenAI template-test budget.

## Generated apps

Each agent's interface is an app written by the three specialists working as a team (`designView` in `src/lib/capabilities/view-design.ts`). It runs after `designInterface`, whose layout remains the fallback.

1. **Brief, in parallel.** The product specialist defines the journey, modes, and states. The backend specialist, working from the exact input and output contract (`outputContract`), lists:
   - the interactions possible with only these outputs plus in-browser logic
   - interactions excluded because they need a capability the agent lacks
   - data-handling notes
   - one realistic sample output per step
2. **Build.** The frontend specialist writes one self-contained app (HTML with inline CSS and JS, at most 34,000 characters). It works from both briefs, a concrete example run, and the bridge API. When enhancing, it extends the previous app.
3. **Review, in parallel.** The backend specialist traces the example run through the code and checks shapes, bridge use, and invented features. The product specialist checks the journey, both modes, and the states.
4. **Revise** once if either reviewer objects or lint fails. `lintView` rejects network, host access, storage, dynamic code, navigation, and apps that never call `glorria.ready()`/`onRun`.

**Where it appears.** The profile and fleet launch the agent into its cat window (compact and full screen, local and hosted). The profile remains the place to inspect and enhance the agent. The review card shows a live preview with sample data. Window controls belong to Glorria, outside the generated app; resizing and closing/reopening the active window preserve its mounted interface and draft input. Creating an agent still plays the cat entrance before it joins the bar, including when the bar has a custom selection.

**Sandbox.** The app runs in an iframe with `sandbox="allow-scripts"` and no `allow-same-origin`, which gives it an opaque origin. The host writes the document around it, with a CSP that allows no network, the theme variables (`--g-*`), and the `window.glorria` shim (`src/lib/agent-ui/view-bridge.ts`).
- **Messages.** Every message the app sends is validated with zod.
- **Data.** Apps receive `run.data[i]`: a string for text outputs, or a parsed object for flashcards and quizzes.
- **Running.** `glorria.requestRun(input)` is checked against the real input contract. Glorria then shows its own confirmation, and only the user's click there invokes the queue or the hosted runner.
- **Host-performed actions.** The host handles recording, downloads, copying, per-viewer saved state (in localStorage), and run history.

**Fallback.** If there is no app, or it doesn't call `ready()` within 8 seconds, or it errors while starting, the component interface renders in its place. The reason is logged to the browser console.

**Cost.** One design uses about 5–6 Gemini calls, and the app-code calls allow up to 32k output tokens and 150 seconds. Designs run only on create, enhance, and adopt, never on runs.

## Bounds and operational limits

- Eight steps; each step reads original input or one earlier output.
- Text/JSON outputs retain the existing 24 KB contract. Audio source clips are limited to 1 MB; browser recording stops after 60 seconds. This is short-clip transcription, not long-lecture streaming or large-file storage.
- Audio is kept as a private run input, not published in a workflow definition. ANS audio invocation requires the specific MIME type to be advertised by the agent card. Supported upload types are WebM, Ogg, WAV, MP3, and MP4.
- Hosted users must keep the page open to advance steps, or explicitly resume a ready run. No new background execution infrastructure is introduced.
- Saved templates keep their existing provider configuration. The new pipeline uses Gemini through `src/lib/models/gemini.ts`; model/endpoint selection is server controlled.
- Publishing and viewing older versions remains possible through the existing workflow APIs; the fleet and cats show the latest revision per family.

## Verification

Automated coverage includes ANS preference, Gemini eligibility, missing infrastructure, registry outages, graph/UI binding rejection, audio MIME and SDK file-part handling, provider error sanitization, execution dependency routing, immutable revisions, duplicate publishing, stale-edit conflicts, and Postgres owner isolation.

The manual browser fixture lives in `tests/fixtures/capability-provider.mjs`. It is never imported by application code and requires an explicitly isolated database. To use it in PowerShell, set these values in both the dev-server and worker terminals:

```powershell
$env:COMPOSER_DB='.data/capability-browser.sqlite'
$env:CAPABILITY_TEST_FIXTURE='1'
$env:GEMINI_API_KEY='fixture-not-a-real-key'
$env:GEMINI_MODEL='fixture-model'
$env:ANS_SYNC_INTERVAL_MINUTES='0'
$env:NODE_OPTIONS='--import ./tests/fixtures/capability-provider.mjs'
```

Then run `npm run dev -- --port 3010` and `npm run worker`. Fixture names and outputs are visibly labelled. Close those terminals before normal development so the overrides do not carry over.

Browser acceptance performed with the fixture: create a study agent; add flashcards before saving; add a quiz after saving; verify revision 2; upload synthetic WAV audio; invoke through the real API, queue, and worker; reveal a card; answer a quiz; reload and reopen persisted history. A separate text extraction request also completed through its generated text-input interface.

Live Gemini inference, live ANS speech-agent compatibility, physical microphone capture, and hosted deployment acceptance still require environment-specific verification. The fixture checks application wiring, not model quality or live service availability.
