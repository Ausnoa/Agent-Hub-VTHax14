# Hosted accounts and template agents

Milestone: sign in on the hosted website, create a template agent, reload and retrieve the saved definition, and test it using the configured model. Document progress and commit in small increments.

Current state: Next/Vercel UI and stateless A2A endpoints; local SQLite-backed workspace APIs remain localhost-only. No hosted identity or database provider is configured in source. Asked user about using Supabase for authentication and Postgres.

Plan: a separate authenticated hosted API, ownership enforced in the server and database, durable definitions and test results, and an account-aware template builder. Preserve local workspace behavior and keep public workflow execution out of this milestone. Never expose service credentials, allow arbitrary owner IDs, or treat client session data as verified identity. Real deployment acceptance requires an actual configured project, schema migration, and cross-user verification.

## Implemented and checked

Supabase is the selected implementation; user has now created a project and was given migration/environment/auth URL setup instructions. Hosted API uses verified bearer authentication via auth.getUser, user-scoped database clients, explicit owner filters, and Postgres RLS. The schema persists immutable agent definitions and test inputs/results; an atomic 20-attempt UTC daily limit applies to hosted inference. No service-role key is used. Public workflow execution remains local-only.

Account UI supports email/password sign-up, confirmation, sign-in, session restoration, sign-out, and separate local/hosted workspaces. Hosted records do not get local workflow buttons or claim ANS publication. Missing configuration shows a setup state. Browser checks confirmed local saved definitions still load and switching to the unconfigured hosted account does not expose local data.

Validation: 50 existing/new tests passed together, plus the additional SDK server-auth test passed separately (51 total). The actual SQL migration ran in embedded Postgres with owner/anonymous authorization and quota checks. Production build and typecheck passed. Docker was unavailable, so PGlite tests simulate Supabase auth.uid; real Supabase auth/email and deployed persistence still require live acceptance after the user's configuration. See HOSTED-BUILDER.md for setup and the two-account acceptance checklist.

## Live Supabase connection

User saved project configuration in .env.local. Live auth settings returned HTTP 200 with email sign-in enabled and auto-confirm disabled. Anonymous template_agents access returned permission-denied (401/42501). Rebuilt and restarted the preview; browser now shows the configured Supabase sign-in form. Requested that the user create/confirm/sign in directly to continue the authenticated create/reload/test acceptance. No secret values or user credentials were displayed. GitHub push still fails due to host DNS resolution; commits remain local.

## Authenticated live acceptance passed locally with Supabase

User signed in with confirmed email. First creation exposed a same-origin check mismatch: Next reports an internal hostname in Request.url. Fixed comparison to the request Host (never forwarded headers), preserving bearer-only authorization and cross-origin denial; added a regression test. Build/typecheck and targeted API tests pass.

Through the real browser and authenticated hosted API: saved Hosted invoice extractor, reloaded the page, restored the signed-in hosted workspace, reopened the Supabase definition, executed a real model test, and reloaded again. Persisted history shows completed output with invoice INV-104, vendor Acme Studio, amount $250, due date October 1. This is real Supabase storage/auth plus a local Next server, not yet a public Vercel acceptance. Cross-user isolation has passed actual Postgres policy tests; a second live account test is still outstanding.

Branch push succeeded using a per-command Git DNS resolution override obtained from a public DNS resolver; TLS verification remained enabled. No persistent network configuration was changed. Asked user to add matching Supabase public variables, hosted-testing flag, and existing model settings in Vercel before deployed testing.
