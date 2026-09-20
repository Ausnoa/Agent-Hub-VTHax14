# Separate login and hosted navigation

User requested a dedicated login page and reported that all other hosted tabs show the local-workflow notice. Split sign-in/signup into /login with allowlisted return destinations. The builder retains account status/sign-out and a login link, without embedded credential fields. Existing email confirmation redirects still target /agent-preview, so Supabase URL settings do not need changing.

Hosted /agents now lists the authenticated user's saved template definitions. Hosted /execution lists their latest 20 test results through a new bearer-authenticated /api/hosted/tests endpoint, with explicit owner filtering and existing RLS. Links reopen a selected agent in the builder. Account changes remount private views to clear prior results. Local fleet/execution pages remain intact.

Discover and Compose still require the local registry/workflow backend; navigation labels say Local and pages explain this specific limitation. This change does not claim hosted multi-agent execution is implemented.

Validation: all 54 tests pass, including authenticated history access and safe login return destinations. Production build passes. Browser checks verified standalone sign-in, signup toggle, and the hosted My Agents sign-in prompt. Signed-in production navigation still needs verification after deployment.
