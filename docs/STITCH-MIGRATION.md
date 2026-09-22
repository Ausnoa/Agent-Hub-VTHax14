# Celestial UI migration

Branch: `stitch`. Reference: Stitch project `12991651217486243557`, screen `780eac5503124f8dbf67e194234748ea` (3D Celestial Liquid Glass with Rotating Topology).

Stitch MCP is already configured and authenticated. Project and screen reads succeeded. The separate HTML download requires browser authentication; do not save its Google sign-in response as design code. Use the returned design tokens, supplied screenshot and existing exported screen references.

## Preservation map

| Existing feature | Component / route | Stitch equivalent | Approach |
| --- | --- | --- | --- |
| Local fleet search, capability filters, metrics, DAGs, launch | `app/agents`, `agent-card` | Active Agent Fleet | Keep fetching/filtering/actions; add celestial overview above existing fleet |
| Hosted templates, visibility, archive/restore, bookmarks | `hosted/account-pages`, `hosted-agent-card`, `archive-controls` | Fleet cards | Keep all account-scoped actions; shared overview and surfaces |
| Dashboard counts, recent agents and live demo | `hosted/dashboard-page`, `ans-showcase` | Workspace | Restyle shared primitives, retain measured health and links |
| Registry search, pagination, public agents and saves | `discover`, `available`, hosted discovery | ANS capability resolution | Retain data provenance and handlers; restyle topology and cards |
| Local report/general planning modes | `create`, `general`, `discovery` | Natural language composer | Preserve all mode choices, validation and planning state |
| Hosted suggestion, finder, eight steps, input mapping, compatibility save | `hosted/workflow-pages` | Workflow composer | Keep handlers and dialogs; style graph and form surfaces |
| Review, approval, run input, execution consent, polling, retry, receipts | `workflow`, `execution`, hosted workflow pages | Review / Live execution | Preserve behavior, especially uncertain-run handling; shared surfaces |
| Template configuration, extraction fields, Q&A reference, save/test | `agent-preview/summary-preview` | Create agent / runtime | Keep conditional inputs and validation; harmonize tokens |
| Companion drag, mini-window, fullscreen, run history | `agent-runtime/*` | Companion dock | Preserve provider, pointer handling and placement |
| Sign-in, profile, public details and saved ownership | login / profile / hosted detail | No complete equivalent | Keep entire flows with shared navy styling |
| Theme, mobile navigation, keyboard focus, loading/errors | layout / UI primitives | Shell / design system | Keep light mode; add responsive refinements and motion controls |

## Guardrails and baseline

- No backend, schema, API contract, authentication or route changes.
- Identity stays unverified where the application cannot attest it. No invented latency, fleet counts, health, or execution activity.
- Decorative orbit motion must be pausable and respect reduced-motion preferences. Text and actual workflow edges remain stationary.
- Existing suite before changes: 84 passed, 0 failed.
- Next 16.3.5 bundled CSS guide reviewed: shared tokens in root CSS; component-specific layout in CSS Modules; check production build ordering.

## Validation checkpoint (2026-09-22)

- `npm test`: 84 passed, 0 failed.
- `npm run typecheck`: passed.
- `npm run build`: passed. The sandbox initially blocked Google Fonts; the network-enabled retry completed successfully.
- Browser checks covered desktop and 390px mobile layouts, fleet search and empty results, light/dark themes, topology pause/resume, and the local compose/discovery/review/save/runtime journey.
- The local fictional Northstar briefing completed successfully; its rendered report and saved run history were verified again on September 22.
- Corrected the review-save redirect race, garbled Unicode punctuation, and the signed-out hosted workspace's primary heading level.
- Kept the latest Agent Glorria branding and companion-bar changes from main. Shared celestial components now live in `src/components/agent-glorria`.
- Authenticated hosted end-to-end checks remain pending: this checkout has no Supabase URL or publishable key configured. Local demo checks do not establish hosted authentication, persistence, or remote execution success.
- No production deployment performed. Local preview remains at http://127.0.0.1:3000/agents.