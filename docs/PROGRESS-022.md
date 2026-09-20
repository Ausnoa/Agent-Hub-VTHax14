# Hosted discovery and composition

Work in progress on codex/hosted-workflows. Replace hosted tab placeholders with authenticated live ANS discovery, private Supabase workflows, and persisted per-step Vercel execution. Local SQLite report pilots remain local.

Database milestone: migration 202609190002_hosted_workflows.sql adds immutable per-owner workflows, private runs, daily budgets (100 searches, 10 plans, 10 new runs), idempotent start IDs, atomic step claims, and guarded completion. Interrupted running steps become failed after five minutes when checked for continuation; they are never reclaimed automatically. Template invocations additionally retain the existing shared 20-test daily budget. Authenticated users cannot directly write runs or budgets. No service-role key is introduced.

Validation: the actual migration passed PGlite PostgreSQL tests for RLS, cross-owner denial, idempotent starts, duplicate claims, completed-step replay prevention, quotas, and interrupted-step handling. User has been given the SQL file to apply in Supabase. Backend and UI implementation continues.
