# Hosted Robocat and Compose graph

User requested bringing the previously merged local cat interface and Compose graph to the hosted website. Reuse the existing Mascot, AgentAvatar, variants, and empty-state TopologyGraph. Hosted users get a separate account-scoped runtime backed by the existing authenticated Supabase APIs, preserving the local report runtime.

Cats load the four most recent private templates/workflows. Each opens a compact message panel with expansion, saved results, step review, explicit execution confirmation, and status. Agent messages use the existing test endpoint; workflow messages use stable request IDs and atomic step advancement. Each message is an independent task, not conversational memory. Private content is kept in component state, cleared on account change/unmount; only the existing avatar position uses localStorage. No new auth, credentials, or database migration.

Compose shows the existing illustrative graph before steps are chosen, then a directed graph generated from actual original/previous mappings. Nodes link to step editing and reflect selected-run progress. Saving agents/workflows refreshes the global cats. Keyboard activation of the original avatar button now works alongside drag/pointer actions.

Validation in progress: typecheck and eight targeted API/graph tests passed. Graph tests cover repeated agents, original-input branches, previous-output edges, and running/failed/completed status mapping. Browser visual and execution QA follows the build.

Hosted runtime implementation compiled successfully. Browser smoke page displayed the restored illustrative Compose graph, but Supabase rejected the previously saved localhost session (verified-email sign-in required), so private cat loading/execution is awaiting a fresh sign-in. The user was asked to sign in again or opt to test after deployment. No auth/session bypass or credential copying was used. Runtime uses only /api/hosted endpoints; account-keyed mounting clears messages and targets on sign-out/account change. API history now includes the already stored owner-scoped input so chat history shows real prior inputs.
