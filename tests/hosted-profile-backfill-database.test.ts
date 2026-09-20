import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const migrations = ['202609190001_hosted_agents', '202609190002_hosted_workflows', '202609190003_profiles_and_visibility', '202609200004_archive_agents_workflows', '202609200005_backfill_profiles'];
const profileOf = (db: PGlite, user: string) => db.query<{ username: string }>('select username from public.profiles where user_id=$1', [user]);

test('profile backfill migration: existing accounts gain a profile, and ensure_profile self-heals a missing one', async () => {
  const db = new PGlite();
  const early = randomUUID(), late = randomUUID(), taken = randomUUID();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated, anon;`);
    for (const file of migrations.slice(0, 4)) await db.exec(await readFile(new URL(`../supabase/migrations/${file}.sql`, import.meta.url), 'utf8'));
    await db.query('insert into auth.users values ($1), ($2), ($3)', [early, late, taken]);

    // Simulate accounts created before 202609190003 added the trigger: the user
    // exists, the profile does not. This is what produced "Profile not found".
    await db.query('delete from public.profiles where user_id = any($1)', [[early, taken]]);
    assert.equal((await profileOf(db, early)).rows.length, 0);

    // A member has already claimed the name `taken` would be given by default.
    const collision = `user_${taken.replaceAll('-', '').slice(0, 12)}`;
    await db.query('update public.profiles set username=$2 where user_id=$1', [late, collision]);

    await db.exec(await readFile(new URL(`../supabase/migrations/${migrations[4]}.sql`, import.meta.url), 'utf8'));

    assert.match((await profileOf(db, early)).rows[0].username, /^user_[0-9a-f]{12}$/);
    // The collision steps aside instead of aborting the whole backfill.
    const stepped = (await profileOf(db, taken)).rows[0].username;
    assert.notEqual(stepped, collision);
    assert.match(stepped, /^user_[0-9a-f]{10}\d{2}$/);
    // Backfilling never renames an account that already had a profile.
    assert.equal((await profileOf(db, late)).rows[0].username, collision);
    // Re-running the backfill is a no-op rather than a duplicate-key failure.
    await db.exec(await readFile(new URL(`../supabase/migrations/${migrations[4]}.sql`, import.meta.url), 'utf8'));
    assert.equal((await db.query<{ n: number }>('select count(*)::int as n from public.profiles')).rows[0].n, 3);

    // ensure_profile recreates only the caller's own row, and is idempotent.
    await db.query('delete from public.profiles where user_id=$1', [early]);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [early]);
    const healed = (await db.query<{ username: string }>('select (public.ensure_profile()).username')).rows[0].username;
    assert.match(healed, /^user_[0-9a-f]{12}$/);
    assert.equal((await db.query<{ username: string }>('select (public.ensure_profile()).username')).rows[0].username, healed);
    assert.equal((await profileOf(db, late)).rows[0].username, collision);

    // A signed-out caller cannot mint a profile.
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    await assert.rejects(db.query('select public.ensure_profile()'), /Authentication required/);
  } finally { await db.close(); }
});
