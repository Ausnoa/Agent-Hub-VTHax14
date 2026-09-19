# Hosted template builder setup

Branch: codex/hosted-agent-builder. Scope: email/password accounts, private saved template definitions, and saved test results. Local SQLite agents remain separate; they are not automatically uploaded. Hosted workflows, local fleet migration, public per-user A2A endpoints, and automated ANS registration are not included.

## Supabase project

1. Create a Supabase project in your account. Keep its database password private.
2. Open SQL Editor and run `supabase/migrations/202609190001_hosted_agents.sql` once. It creates template_agents, agent_test_runs, agent_test_budgets, RLS policies, and an atomic quota function. No existing local database is migrated or overwritten.
3. Enable email/password sign-in and keep email confirmation enabled. Configure Site URL as `https://www.gloryforglorria.us/agent-preview`. Add that exact URL to allowed redirects. For development also allow `http://127.0.0.1:3001/agent-preview`; add a branch preview's exact URL only when using it.
4. Copy the Project URL and the **publishable** API key (`sb_publishable_...`) into `.env.local` and Vercel environment settings. This implementation deliberately rejects secret/service-role keys and legacy JWT keys. The publishable key is safe for the browser; policies protect the data.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
HOSTED_AGENT_TESTS_ENABLED=true
```

Keep existing OPENAI_API_KEY and OPENAI_MODEL on the server. Do not prefix model credentials with NEXT_PUBLIC. Public configuration is included at build time: restart development and rebuild/redeploy after changing it. Enable the test flag only after the migration and model settings are ready. Without configuration the builder shows an explicit setup state.

## User flow

On `/agent-preview`, hosted visitors create an account, confirm the email, and sign in. Local visitors can choose **My hosted account** or **Local workspace**. Create an agent, reload the page, reopen it under **Your created agents**, and test it. Recent test outputs persist under the selected agent. Sign out clears the account-bound builder; signing in as another user loads only their data.

Definitions are immutable snapshots. Templates accept supplied text only. Test inputs, outputs, timestamps, and statuses are saved privately. Test content and saved instructions/reference are sent to the configured model provider; the UI discloses this. Do not use sensitive content during setup testing.

The budget is 20 test attempts per user per UTC day, enforced atomically in Postgres. Failed model calls count as attempts. Model calls time out after 45 seconds; the route has a 60-second budget. A terminated function can leave a run pending: history labels it pending/interrupted, and no automatic retry happens. This quota only covers authenticated template tests; existing standalone public A2A endpoints retain their separate configuration and controls.

## API

All hosted requests require `Authorization: Bearer <Supabase access token>`. The server calls `auth.getUser(token)` and requires confirmed email. A user-scoped database client passes that token to Postgres, retaining RLS, and queries also filter by verified owner ID. Cookies and supplied owner fields do not authorize access. No CORS access is enabled; browser writes must be same-origin.

- GET/POST `/api/hosted/agents`: list/create.
- GET `/api/hosted/agents/{uuid}`: retrieve your agent.
- POST `/api/hosted/agents/{uuid}/test` with `{"text":"..."}`: persist and execute a test.
- GET `/api/hosted/agents/{uuid}/tests`: latest 20 saved tests for that agent.

Existing `/api/owned` and workspace/workflow endpoints remain localhost-only.

## Acceptance and verification

Automated tests execute the actual SQL migration in embedded Postgres (PGlite), simulating Supabase's trusted auth.uid function. They verify owner isolation, denied anonymous access, denied forged ownership, persisted outputs, and atomic budget exhaustion. API tests cover authorization, ownership, input size, disabled inference, quota ordering, and sanitized provider errors. Auth tests exercise the SDK's server getUser verification using a mocked network response.

These tests do not prove real Supabase email delivery or Vercel setup. Before release, perform this live acceptance with two accounts:

1. Account A signs up, confirms email, signs in, saves an extraction agent, reloads, and tests it.
2. Account A reloads and confirms the output in saved history.
3. Account B sees no A records and gets 404 for A's agent/test endpoint.
4. Sign out and verify hosted API access returns 401 without a bearer token.
5. Confirm local workspace data and workflow behavior still work independently.

Reference docs: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/reference/javascript/auth-getuser .
