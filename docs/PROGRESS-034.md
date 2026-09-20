# Reorganize the hosted Compose page around the workflow graph

Compose now leads with the workflow being built. The graph card is the first section, "Describe your workflow" sits beneath it, and the standalone "Find agents" card is gone — adding an agent is an action performed on the graph rather than a separate panel above it.

## Change

Reorganization, not redesign: the graph, the describe form, the ANS search form, the step review, run, saved-workflow and run-history sections keep their existing markup, copy and styling.

- **Find agents** is a control in the graph card's header, top right, one size step up from the base button (`14px 22px / 13.5px`). It opens `AgentFinder`, a non-modal panel anchored to the trigger that drops over the graph. It is absolutely positioned, so opening it never reflows the composer below. The translucent treatment reuses the existing panel tokens (`--bg-panel`, `--blur-panel`, `--border-strong`), matching the cat chat and every other floating surface.
- **Source selector** reuses the existing `SegmentedControl` primitive: ANS search, My agents, Favorites. The panel body scrolls internally and is capped at `min(60vh, 460px)`; the result grid's own scroll is disabled so there is only one scroller. Dismissed by the Close button, Escape, or a click outside, with focus returned to the trigger.
- **One add path.** All three sources call `addFromFinder`, which merges the chosen candidate into `candidates` (so its name resolves in the graph and step list before the workflow is saved) and then calls the existing `add()`. No second implementation of adding a step.
- **My agents** reads the signed-in user's own template agents, now held in a separate `myCandidates` list so bookmarked agents merged into the candidate pool are never mislabelled as the user's own templates.
- **Favorites** is backed by the existing `saved_agents` table and `GET /api/hosted/saved`; no new feature and no fabricated data. `saved.ts` now returns each saved template's advertised skill — one line, no extra query, since `templateFor()` was already called there for the description fallback — because a workflow step needs the skill id. Adding another member's public template already worked end to end: `repository().get()` is deliberately not owner-scoped and `reserve_agent_test` accepts public agents (`DECISION-005`). A saved *composite workflow* is not itself an A2A skill, so those rows link to their detail page instead of offering an add action.
- Copy that referred to the old layout was corrected: the suggestion hint no longer says "the search above", and the empty step list points at Find agents on the graph.

`mode='history'` previously also rendered the Find agents card; that mode is unreachable (`WorkspaceAccess` only mounts `discover` and `compose`), so nothing reachable lost it.

## Validation

`npm run typecheck`, all 84 tests, and `npm run build` pass. The Impeccable design detector reports no findings.

Not verified: the page was not exercised in a signed-in browser session. The graph, describe form, ANS search, My agents, add-an-agent, popout open/close, and layout stability at desktop and mobile width remain unchecked against a live session, and the user chose to deploy ahead of that check.
