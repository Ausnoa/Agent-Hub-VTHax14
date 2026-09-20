# Fix "Profile not found" when opening an agent

Opening any agent from the dashboard — under **Your recent agents** or **Discover public agents** — showed "Something needs attention / Profile not found" instead of the agent.

## Cause

Two defects, one root cause.

`202609190003_profiles_and_visibility.sql` creates a profile from an `after insert on auth.users` trigger and its comment states that read paths therefore never need to handle a missing profile. The trigger only fires for accounts created after that migration ran; every account created during the earlier hosted-builder phase has no `profiles` row, so the guarantee does not hold for them.

`agent-detail-page.tsx` then fetched the owner's profile inside the same `try` as the agent itself. The agent loaded fine, the owner lookup returned the profile endpoint's 404 text, and the page rendered that error in place of the whole agent. The byline it feeds is already optional (`{owner && …}`), so nothing about the agent actually depended on it. `GET /api/hosted/profile` (profile settings) failed the same way for those accounts. Discover's *listing* was unaffected because `discover.ts` already falls back to `unknownOwner`.

## Change

- `202609200005_backfill_profiles.sql`: backfills a profile for every `auth.users` row that lacks one, re-runnable and skipping accounts that already have one. Adds `public.default_username(uuid)`, shared with the trigger, which steps to a suffixed name rather than aborting if a member has manually claimed the generated default. Adds `public.ensure_profile()` (`security definer`, granted to `authenticated`) so a caller whose trigger never fired can create only their own row — the `profiles` grants are select/update only, so the client cannot insert one itself.
- `profile.ts`: `me()` calls `ensure_profile` when the select finds no row, instead of returning 404. The existing row path is unchanged.
- `agent-detail-page.tsx`: the owner lookup is its own `try`/`catch`; a missing profile now renders the agent without a byline.

No table or column changes, so `prisma/schema.prisma` does not need refreshing (Prisma does not introspect functions).

## Validation

`tests/hosted-profile-backfill-database.test.ts` runs all five migrations against PGlite: it deletes profile rows to reproduce a pre-trigger account, applies the backfill, and asserts the row returns, that a username collision steps aside instead of aborting, that an existing profile is never renamed, that a second application is a no-op, that `ensure_profile` is idempotent and touches only the caller's row, and that a signed-out caller is rejected.

All 84 tests, `npm run typecheck`, and `npm run build` pass. Apply `202609200005_backfill_profiles.sql` in Supabase before deploying; hosted browser verification follows.
