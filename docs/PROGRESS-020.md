# Hosted accounts and template agents

Milestone: sign in on the hosted website, create a template agent, reload and retrieve the saved definition, and test it using the configured model. Document progress and commit in small increments.

Current state: Next/Vercel UI and stateless A2A endpoints; local SQLite-backed workspace APIs remain localhost-only. No hosted identity or database provider is configured in source. Asked user about using Supabase for authentication and Postgres.

Plan: a separate authenticated hosted API, ownership enforced in the server and database, durable definitions and test results, and an account-aware template builder. Preserve local workspace behavior and keep public workflow execution out of this milestone. Never expose service credentials, allow arbitrary owner IDs, or treat client session data as verified identity. Real deployment acceptance requires an actual configured project, schema migration, and cross-user verification.
