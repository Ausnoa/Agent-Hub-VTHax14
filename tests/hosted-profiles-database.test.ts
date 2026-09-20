import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('profiles and visibility migration: public profiles, publishable agents, cross-owner invocation, private bookmarks', async () => {
  const db = new PGlite();
  const alice = randomUUID(), bob = randomUUID();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated, anon;`);
    await db.exec(await readFile(new URL('../supabase/migrations/202609190001_hosted_agents.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202609190002_hosted_workflows.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202609190003_profiles_and_visibility.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users values ($1), ($2)', [alice, bob]);

    const asAlice = () => db.query("select set_config('request.jwt.claim.sub',$1,false)", [alice]);
    const asBob = () => db.query("select set_config('request.jwt.claim.sub',$1,false)", [bob]);

    await db.exec('set role authenticated');
    await asAlice();

    // The signup trigger creates a profile with a generated username immediately.
    const aliceProfile = (await db.query<{ username: string }>('select username from public.profiles where user_id=$1', [alice])).rows[0];
    assert.match(aliceProfile.username, /^user_[0-9a-f]{12}$/);

    await db.query("update public.profiles set username='alice',display_name='Alice A.',bio='Builds agents.' where user_id=$1", [alice]);
    // A column outside the update grant (user_id) is rejected even when it would be a no-op value.
    await assert.rejects(db.query('update public.profiles set user_id=$1 where user_id=$1', [alice]), /permission denied/);

    await asBob();
    // Any signed-in user can read another user's profile (but never write it).
    assert.equal((await db.query<{ display_name: string }>('select display_name from public.profiles where user_id=$1', [alice])).rows[0].display_name, 'Alice A.');
    assert.equal((await db.query("update public.profiles set bio='hijacked' where user_id=$1 returning user_id", [alice])).rows.length, 0);
    await assert.rejects(db.query("update public.profiles set username='alice' where user_id=$1", [bob]), /duplicate key|unique/);

    // Agents default private: the owner sees them, nobody else does.
    await asAlice();
    const definition = { name: 'Alice agent', template: 'summary', instructions: '', fields: [], reference: '' };
    const agentId = (await db.query<{ id: string }>('insert into public.template_agents(definition) values ($1) returning id', [definition])).rows[0].id;
    await asBob();
    assert.equal((await db.query('select * from public.template_agents where id=$1', [agentId])).rows.length, 0);
    await assert.rejects(db.query('select public.reserve_agent_test($1,$2)', [agentId, 'Maya sends the draft Friday.']), /Agent unavailable/);
    assert.equal((await db.query("update public.template_agents set visibility='public' where id=$1 returning id", [agentId])).rows.length, 0);

    // Once the owner publishes it, another signed-in user can read it and invoke it,
    // and the resulting test run is attributed to the invoker, not the owner.
    await asAlice();
    assert.equal((await db.query("update public.template_agents set visibility='public' where id=$1 returning visibility", [agentId])).rows[0].visibility, 'public');
    await asBob();
    assert.equal((await db.query('select id from public.template_agents where id=$1', [agentId])).rows.length, 1);
    const testRun = (await db.query<{ id: string }>('select public.reserve_agent_test($1,$2) id', [agentId, 'Maya sends the draft Friday.'])).rows[0].id;
    assert.ok(testRun);
    assert.equal((await db.query<{ owner_id: string }>('select owner_id from public.agent_test_runs where id=$1', [testRun])).rows[0].owner_id, bob);
    // Using someone else's public agent grants no edit/delete rights over it.
    assert.equal((await db.query("update public.template_agents set visibility='private' where id=$1 returning id", [agentId])).rows.length, 0);

    // The same public/private and cross-owner rules apply to composite workflows.
    await asAlice();
    const workflowId = (await db.query<{ id: string }>('insert into public.hosted_workflows(definition) values ($1) returning id', [{ name: 'Two steps', steps: [{}, {}] }])).rows[0].id;
    await asBob();
    const privateRun = randomUUID();
    await assert.rejects(db.query('select public.start_hosted_workflow($1,$2,$3)', [privateRun, workflowId, { type: 'text', value: 'x' }]), /Workflow unavailable/);
    await asAlice();
    await db.query("update public.hosted_workflows set visibility='public' where id=$1", [workflowId]);
    await asBob();
    const publicRun = randomUUID();
    const started = (await db.query<{ id: string }>('select public.start_hosted_workflow($1,$2,$3) id', [publicRun, workflowId, { type: 'text', value: 'x' }])).rows[0].id;
    assert.equal(started, publicRun);
    assert.equal((await db.query<{ owner_id: string }>('select owner_id from public.hosted_workflow_runs where id=$1', [publicRun])).rows[0].owner_id, bob);

    // Bookmarks are private to whoever saved them.
    await db.query('insert into public.saved_agents(agent_kind,agent_id) values ($1,$2)', ['workflow', workflowId]);
    assert.equal((await db.query('select * from public.saved_agents')).rows.length, 1);
    await asAlice();
    assert.equal((await db.query('select * from public.saved_agents')).rows.length, 0);

    await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.profiles'), /permission denied/);
    await assert.rejects(db.query('select * from public.saved_agents'), /permission denied/);
  } finally {
    await db.close();
  }
});
