import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('actual Postgres migration isolates owners and enforces the shared test budget', async()=>{
  const db = new PGlite();
  const alice='00000000-0000-4000-8000-000000000001', bob='00000000-0000-4000-8000-000000000002';
  try {
    // Simulate Supabase's trusted auth identity function, then run the real migration.
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      insert into auth.users values ('${alice}'), ('${bob}');`);
    await db.exec(await readFile(new URL('../supabase/migrations/202609190001_hosted_agents.sql',import.meta.url),'utf8'));
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[alice]);
    const definition={name:'Alice agent',template:'summary',instructions:'',fields:[],reference:''};
    const created=await db.query<{id:string}>('insert into public.template_agents(definition) values ($1) returning id',[definition]);
    const agentId=created.rows[0].id;
    await assert.rejects(db.query('insert into public.template_agents(owner_id,definition) values ($1,$2)',[bob,definition]),/row-level security/);
    const attempts=await Promise.all(Array.from({length:25},()=>db.query<{id:string|null}>('select public.reserve_agent_test($1,$2) as id',[agentId,'Maya sends the draft Friday.'])));
    const ids=attempts.flatMap(result=>result.rows[0].id ? [result.rows[0].id] : []);
    assert.equal(ids.length,20);
    await assert.rejects(db.query('delete from public.agent_test_budgets'),/permission denied/);
    await db.query("update public.agent_test_runs set status='completed', output='Alice result' where id=$1",[ids[0]]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[bob]);
    assert.equal((await db.query('select * from public.template_agents')).rows.length,0);
    assert.equal((await db.query('select * from public.agent_test_runs')).rows.length,0);
    await assert.rejects(db.query('select public.reserve_agent_test($1,$2)',[agentId,'steal']),/Agent unavailable/);
    assert.equal((await db.query("update public.agent_test_runs set output='tampered' where id=$1 returning id",[ids[0]])).rows.length,0);
    await assert.rejects(db.query('update public.template_agents set owner_id=$1 where id=$2',[bob,agentId]),/permission denied/);
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.template_agents'),/permission denied/);
    await assert.rejects(db.query('select public.reserve_agent_test($1,$2)',[agentId,'test']),/permission denied/);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[alice]);
    assert.equal((await db.query('select * from public.template_agents')).rows.length,1);
    assert.equal((await db.query<{output:string}>('select output from public.agent_test_runs where id=$1',[ids[0]])).rows[0].output,'Alice result');
  } finally {await db.close();}
});
