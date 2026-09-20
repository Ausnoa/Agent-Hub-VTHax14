# Hosted discovery and composition

## Deployment

The hosted backend runs as Node.js route handlers on the existing Vercel project. No SQLite file or local worker is required for this path. Apply both Supabase migrations in order:

- `supabase/migrations/202609190001_hosted_agents.sql`
- `supabase/migrations/202609190002_hosted_workflows.sql`

- `supabase/migrations/202609190003_profiles_and_visibility.sql` (profiles, agent visibility, saved agents — see `DECISION-005`)

Existing environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `HOSTED_AGENT_TESTS_ENABLED=true`, `OPENAI_API_KEY`, `OPENAI_MODEL`. No service-role secret is required. Keep GoDaddy registration credentials off the browser. Discovery uses the existing public ANS API by default; `ANS_BASE_URL` defaults to `https://api.godaddy.com`.

For the three public Glorria agents registered separately with ANS, configure these on the production deployment serving their domains:

```
AGENT_PUBLIC_ORIGIN=https://www.gloryforglorria.us
EXTRACT_AGENT_PUBLIC_ORIGIN=https://extract.gloryforglorria.us
QA_AGENT_PUBLIC_ORIGIN=https://ask.gloryforglorria.us
AGENT_ENABLED=true
```

A registry entry does not prove its service is live. Each agent card must return 200 and advertise its canonical A2A endpoint. Registration does not provide caller authentication or inference limits on those public endpoints.

The hosted route exports `maxDuration=300`. Vercel Fluid compute supports this on Hobby and higher plans. A legacy Hobby deployment without Fluid compute must enable it. See https://vercel.com/docs/functions/configuring-functions/duration . A step normally uses the existing shorter ANS, model, and A2A timeouts; the five-minute function maximum is not a polling interval.

## User flow

Sign in at `/login`, which lands on `/dashboard` by default. `/create` composes a workflow: choose up to eight skills manually, or request a suggested draft — suggestions use the first registry page for the search phrase plus saved private templates, not a complete global semantic index, and are constrained to supplied skill IDs.

Check compatibility and save the immutable workflow, review resolved endpoints, provide input, and confirm execution. Private templates run as the signed-in owner. External steps re-resolve ANS registration and inspect the A2A card, retain public-network restrictions, and support the existing unauthenticated A2A 0.3 JSON-RPC text/JSON subset.

`/execution` shows workflow runs and agent test history. `/agents` shows the signed-in user's own template agents and workflows, each with a Publish/Make private toggle (`DECISION-005`). `/discover` is the public marketplace — other members' published agents, searchable, each opening at `/agents/:id` for a read-only detail view and a Launch action that runs it without granting ownership. `/profile/:username` shows a member's public agents (never their email); `/saved` lists bookmarked public agents. Local report pilots and the old SQLite index remain local. To test hosted composition using a localhost sign-in, open `/create?hosted=1` (or `/discover?hosted=1`). This changes presentation only; hosted endpoints always require verified bearer authentication and RLS.

## Execution semantics

One request claims and executes one step, saving the result before another step is sent. While the page remains open, the browser advances successful steps. Closing or refreshing the page stops further advancement, although an already accepted server request may finish. Open the workflow, choose Review run, reconfirm its saved input/steps, and continue. This is not an unattended background worker.

Run creation has a stable request UUID. Duplicate submissions return the existing run. A claim compares the expected step number and locks the row; duplicate or delayed requests cannot execute a later step accidentally. A claimed step is never automatically reclaimed. Checking an interrupted running step after five minutes marks it failed with an uncertain-effects warning. No agent retry occurs automatically. Result persistence failures require status review. Prepare a new run explicitly to intentionally repeat completed/failed work.

Shared Supabase budgets: 100 ANS searches, 10 suggestions, and 10 new workflow runs per verified account per UTC day. Template steps also consume the existing 20-test budget. Run history and results remain owner-scoped through explicit queries, foreign keys, RLS, and guarded RPCs. These limits do not impose a global spend cap or protect independently public A2A endpoints.

## Validation

Automated PostgreSQL tests cover owner isolation, forbidden direct run writes, atomic claims, idempotency, budget exhaustion, and interruption. Service tests cover external registration changes, ownership, endpoint injection, execution confirmation, quota reservation, and persistence failure without re-invocation. Browser smoke testing against real Supabase completed an invoice-extraction workflow and reloaded its saved result.

### Deployment troubleshooting

`Model generation unavailable (not-configured)` means at least one of OPENAI_API_KEY / OPENAI_MODEL is missing or empty in that deployment. Local `.env.local` is not uploaded. Set both in the correct Vercel project's **Production** environment, remove unintended branch restrictions, and redeploy. `model provider HTTP ...` exposes only a status code; inspect the provider account/configuration without posting keys. Incomplete or invalid model output is reported separately. A healthy agent card only verifies routing and advertised capabilities, not inference configuration.
