# Hosted cat creation and reversible archiving

User requested the local creation animation on hosted cats and removal of cats, agents and workflows; user selected archive with preserved history. Hosted creation events now trigger the existing 2.4-second cat entrance for newly saved templates/workflows, never on reload. Hidden cats persist per account in this browser, with Show cats to restore them.

Added owner-scoped archive/restore endpoints and controls in My Agents and saved workflows on Compose. Archive confirmation explains privacy/history effects. Archived lists support restoration. Archiving makes an item private, filters active lists/bookmarks/discovery, prevents new invocations at the database boundary, and preserves test/run records. Restore keeps items private. Existing immutable workflow snapshots are not rewritten; attempts to invoke an archived template fail until it is restored.

Requires supabase/migrations/202609200004_archive_agents_workflows.sql before deployment. Database regression tests verify owner isolation, public hiding, blocked new execution, restoration, and retained history. API test verifies archived agent tests do not reach inference. Nine targeted tests and typecheck pass. User asked to apply the migration; deployment waits for that confirmation.

Full suite: all 83 tests pass. Prisma's additive schema now includes the archive columns to match the SQL migration. Production build succeeds. No permanent deletion was implemented, per the user's archive preference. Deployment is withheld until the migration is applied to avoid breaking existing workspace reads.

User confirmed the archive migration ran successfully in Supabase. Schema probes no longer report missing archive columns; anonymous table access remains denied. Deploying for authenticated production lifecycle verification.

Production acceptance passed on deployment ec1d0e0: created “Lifecycle check — archive me” and captured the cat entrance; hid its cat, reloaded, verified it stayed hidden, then restored cats. Archived and restored the synthetic agent through My Agents. Created “Lifecycle check — workflow”, observed its entrance, then archived/restored it through Compose. Both synthetic records were left archived after verification; existing user records were not changed and no inference runs were required. Both restore controls returned records to the active lists successfully. No new archive errors occurred.
