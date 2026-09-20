# Decision 005 — Multi-user dashboard, profiles, and discovery

Status: implemented. Date: September 19, 2026.

## Scope

Extends the hosted (Supabase-backed) path only. The local single-tenant SQLite workspace (`/agents`, `/create`, `/discover` on localhost, `docs/DECISION-003`) is unchanged and has no ownership/visibility/profile concept; it remains a single shared fleet.

Two existing hosted tables already had an owner and RLS: `template_agents` (single-skill agents from `/agent-preview`) and `hosted_workflows` (composite workflows from `/create`, whose steps may be ANS-discovered agents or the owner's own templates). Both become "agents" a user can own, publish, and discover. Raw ANS registrations are never independently owned or listed in Discover — they stay pure workflow components, resolved live through the existing registry/ANS client. This preserves the distinction between ANS-discovered components and platform-published composite/template agents without changing the registry or ANS code at all.

## Schema (`202609190003_profiles_and_visibility.sql`)

- `profiles`: one row per account (`user_id`, `username`, `display_name`, `avatar_url`, `bio`), created automatically by an `after insert on auth.users` trigger with a generated default username. Readable by any signed-in user, writable only by its owner. Never stores email.
- `visibility` (`public`/`private`, default `private`) added to `template_agents` and `hosted_workflows`. Read policies relaxed from owner-only to `owner_id = auth.uid() OR visibility = 'public'`; a new column-scoped `UPDATE` grant lets only the owner flip it.
- `saved_agents`: lightweight bookmarks (`owner_id`, `agent_kind`, `agent_id`), private to the saver, no FK to the agent tables (a stale bookmark just drops out of the resolved list instead of erroring).
- **Cross-owner invocation fix**: `agent_test_runs` and `hosted_workflow_runs` originally had a *composite* FK (`agent_id, owner_id`) forcing the run's owner to equal the agent's owner — which made using anyone else's agent structurally impossible. Replaced with a plain single-column FK, and the `reserve_agent_test`/`start_hosted_workflow` RPCs now accept `owner_id = actor OR visibility = 'public'`. A run/test is always attributed to the invoker, not the agent's owner, so using a public agent never grants edit rights over it and rate limits stay per-invoker.
- Covered by `tests/hosted-profiles-database.test.ts`, a PGlite RLS test following the same pattern as `tests/hosted-database.test.ts`.

## API surface

All under `/api/hosted/`, using the existing path-array dispatch and `HostedError`/`respond()` conventions:

| Route | Purpose |
| --- | --- |
| `GET/POST /profile` | Read/update the signed-in user's own profile |
| `GET /profiles/:username`, `GET /profiles/by-id/:userId` | Public profile lookup |
| `POST /agents/:id/visibility`, `POST /workflows/:id/visibility` | Owner-only publish/unpublish |
| `GET /workflows/:id` | Single-workflow read (previously missing; needed for the detail page) |
| `GET /discover`, `GET /discover/by-owner/:userId` | Public template + workflow agents, merged and filtered in application code (same style as `workflow-service.ts`'s existing candidate filtering) — basic, no new search infra |
| `GET/POST /saved`, `DELETE /saved/:kind/:id` | Bookmarks |

`repository().get()`/`workflowRepository().get()` dropped their old `.eq('owner_id', userId)` query filter — that filter, not just RLS, was what made cross-owner reads impossible; relying on RLS alone (`own OR public`) is what actually makes launching another user's public agent work.

## Routing

- `/discover` (hosted) previously duplicated the "search ANS/my templates to start composing" panel that already lives inline inside `/create`; it's now the public marketplace. Nothing lost — the component search stays in `/create`.
- `/agents/[id]` was unclaimed on hosted deployments (fell through to a generic placeholder in `WorkspaceAccess`); it's now the read-only agent detail/launch page, working for either kind, showing owner + (for composites) each step's ANS-vs-template provenance. Local behavior at the same path is untouched.
- New hosted-only pages (`/dashboard`, `/profile/[username]`, `/profile/settings`) are self-contained components using the existing `useAccount()`/`hostedApi()` pattern (own sign-in prompt, own "hosted not configured" state), added to `WorkspaceAccess`'s always-passthrough list rather than given bespoke local/hosted branches. Saved/bookmarked agents are not a standalone route — they're a "Saved agents" sub-section (`#saved`) rendered inside `/agents` (`AccountPages`/`AccountData`), reusing `saved-handler.ts`'s unchanged API below.
- `/` now client-side redirects to `/agents` on localhost or `/dashboard` otherwise, matching the hostname-sniffing convention already used by `WorkspaceAccess`/`BuilderAccess`. `loginTarget()`'s default (and the signup email redirect) moved from `/agent-preview` to `/dashboard`.

## Deferred / accepted tradeoffs

- Discovery pagination is a single capped page (60 of each kind), not cursor-based — acceptable per the "avoid overengineering discovery" scope; revisit only if the public agent count grows enough to matter.
- Avatars are a plain `https://` URL field, no upload pipeline.
- A composite workflow's own template-step components inherit whatever visibility the component currently has, evaluated live at run time; the workflow's own visibility doesn't cascade to them. If an owner later makes a component private, an already-public workflow embedding it fails that step gracefully rather than exposing it.
