import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('workflow SQL isolates owners, deduplicates starts, claims once, and never retries uncertain steps', async()=>{
  const db=new PGlite(), alice=randomUUID(),bob=randomUUID();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,anon;`);
    await db.query('insert into auth.users values($1),($2)',[alice,bob]);
    await db.exec(await readFile(new URL('../supabase/migrations/202609190002_hosted_workflows.sql',import.meta.url),'utf8'));
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[alice]);
    const workflow=(await db.query<{id:string}>('insert into public.hosted_workflows(definition) values ($1) returning id',[{name:'Two steps',steps:[{},{}]}])).rows[0].id;
    await assert.rejects(db.query('insert into public.hosted_workflows(owner_id,definition) values($1,$2)',[bob,{steps:[{}]}]),/row-level security/);
    const run=randomUUID(), input={type:'text',value:'Source'};
    const start=()=>db.query<{id:string}>('select public.start_hosted_workflow($1,$2,$3) id',[run,workflow,input]);
    assert.equal((await start()).rows[0].id,run);assert.equal((await start()).rows[0].id,run);
    await assert.rejects(db.query('select public.start_hosted_workflow($1,$2,$3)',[run,workflow,{type:'text',value:'Changed'}]),/already used/);
    const claims=await Promise.all([0,0].map(i=>db.query<{token:string|null}>('select public.claim_hosted_step($1,$2) token',[run,i])));
    const tokens=claims.flatMap(x=>x.rows[0].token?[x.rows[0].token]:[]);assert.equal(tokens.length,1);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[bob]);
    assert.equal((await db.query('select * from public.hosted_workflows')).rows.length,0);
    assert.equal((await db.query('select * from public.hosted_workflow_runs')).rows.length,0);
    await assert.rejects(db.query('select public.claim_hosted_step($1,0)',[run]),/unavailable/);
    assert.equal((await db.query<{ok:boolean}>('select public.finish_hosted_step($1,$2,$3,null) ok',[run,tokens[0],input])).rows[0].ok,false);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[alice]);
    await db.query('select public.finish_hosted_step($1,$2,$3,null)',[run,tokens[0],input]);
    assert.equal((await db.query<{token:null}>('select public.claim_hosted_step($1,0) token',[run])).rows[0].token,null);
    const token=(await db.query<{token:string}>('select public.claim_hosted_step($1,1) token',[run])).rows[0].token;
    await db.query('select public.finish_hosted_step($1,$2,$3,null)',[run,token,input]);
    const result=(await db.query<{status:string;outputs:unknown[]}>('select status,outputs from public.hosted_workflow_runs where id=$1',[run])).rows[0];
    assert.equal(result.status,'completed'); assert.equal(result.outputs.length,2);
    assert.equal((await db.query<{token:null}>('select public.claim_hosted_step($1,2) token',[run])).rows[0].token,null);
    await assert.rejects(db.query("update public.hosted_workflow_runs set status='ready'"),/permission denied/);
    await assert.rejects(db.query('delete from public.hosted_workflow_budgets'),/permission denied/);
    // First idempotent start used one run budget, leaving nine.
    for(let i=0;i<9;i++)assert.ok((await db.query<{id:string}>('select public.start_hosted_workflow($1,$2,$3) id',[randomUUID(),workflow,input])).rows[0].id);
    assert.equal((await db.query<{id:null}>('select public.start_hosted_workflow($1,$2,$3) id',[randomUUID(),workflow,input])).rows[0].id,null);
    await db.exec('reset role');
    await db.query("update public.hosted_workflow_runs set status='running', started_at=now()-interval '6 minutes' where id=$1",[run]);
    await db.exec('set role authenticated');
    assert.equal((await db.query<{token:null}>('select public.claim_hosted_step($1,2) token',[run])).rows[0].token,null);
    assert.equal((await db.query<{status:string}>('select status from public.hosted_workflow_runs where id=$1',[run])).rows[0].status,'failed');
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.hosted_workflow_runs'),/permission denied/);
    await assert.rejects(db.query("select public.reserve_workflow_budget('plan')"),/permission denied/);
  }finally{await db.close();}
});
