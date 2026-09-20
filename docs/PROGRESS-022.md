# Hosted discovery and composition

Work in progress on codex/hosted-workflows. Replace hosted tab placeholders with authenticated live ANS discovery, private Supabase workflows, and persisted per-step Vercel execution. Local SQLite report pilots remain local.

Database milestone: migration 202609190002_hosted_workflows.sql adds immutable per-owner workflows, private runs, daily budgets (100 searches, 10 plans, 10 new runs), idempotent start IDs, atomic step claims, and guarded completion. Interrupted running steps become failed after five minutes when checked for continuation; they are never reclaimed automatically. Template invocations additionally retain the existing shared 20-test daily budget. Authenticated users cannot directly write runs or budgets. No service-role key is introduced.

Validation: the actual migration passed PGlite PostgreSQL tests for RLS, cross-owner denial, idempotent starts, duplicate claims, completed-step replay prevention, quotas, and interrupted-step handling. User has been given the SQL file to apply in Supabase. Backend and UI implementation continues.

Backend milestone: authenticated live registry search, model-assisted drafts constrained to discovered candidates, compatibility-checked immutable workflows, and one-step execution now use Supabase and existing ANS/A2A clients. External registrations are resolved again before invocation; URLs supplied by browsers are ignored when saving. Private template steps read the authenticated owner's definition and reserve the shared test budget. Step completion errors never trigger inference retries. The Vercel route has a 300-second maximum; normal agent/model calls retain shorter internal timeouts. Existing local APIs retain localhost restrictions.

User confirmed the migration ran successfully. All 60 automated tests pass and the production build passes. Browser access using the existing local sign-in successfully loaded the live Supabase tables and found all three Glorria agents through the real ANS registry. Combined template/A2A workflow testing is in progress.
