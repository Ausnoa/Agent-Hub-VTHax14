import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('capability SQL preserves ownership, idempotent publishing, revisions, old runs and bounded audio',async()=>{
  const db=new PGlite(),alice=randomUUID(),bob=randomUUID();
  try{
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;`);
    for(const file of ['202609190001_hosted_agents','202609190002_hosted_workflows','202609190003_profiles_and_visibility','202609200004_archive_agents_workflows','202609250001_capability_workflows'])await db.exec(await readFile(new URL(`../supabase/migrations/${file}.sql`,import.meta.url),'utf8'));
    await db.query('insert into auth.users values($1),($2)',[alice,bob]);await db.exec('set role authenticated');
    const user=(id:string)=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await user(alice);
    async function proposal(parentId?:string,unresolved:unknown[]=[]) {
      const id=randomUUID();await db.query('insert into public.capability_proposals(id,body) values($1,$2)',[id,{id,parentId,definition:{name:'Study',steps:[{}],capability:{unresolved}}}]);return id;
    }
    const publish=async(id:string)=>(await db.query<{result:{id:string;definition:{revision:{rootId:string;number:number}}}}>('select public.publish_capability_proposal($1) result',[id])).rows[0].result;
    const firstProposal=await proposal(),first=await publish(firstProposal);
    assert.equal((await publish(firstProposal)).id,first.id);assert.equal(first.definition.revision.rootId,first.id);
    const runId=randomUUID();await db.query('select public.start_hosted_workflow($1,$2,$3)',[runId,first.id,{type:'audio',mimeType:'audio/webm',value:'A'.repeat(100000)}]);
    const a=await proposal(first.id),b=await proposal(first.id);const second=await publish(a);
    assert.equal(second.definition.revision.number,2);assert.equal(second.definition.revision.rootId,first.id);
    await assert.rejects(publish(b),/Revision conflict/);
    assert.equal((await db.query<{workflow_id:string}>('select workflow_id from public.hosted_workflow_runs where id=$1',[runId])).rows[0].workflow_id,first.id);
    await assert.rejects(publish(await proposal(undefined,[{capability:'Storage',reason:'Unsupported'}])),/incomplete/);
    await assert.rejects(db.query('select public.start_hosted_workflow($1,$2,$3)',[randomUUID(),second.id,{type:'audio',value:'A'.repeat(1340001)}]),/check constraint/);
    await user(bob);assert.equal((await db.query('select * from public.capability_proposals')).rows.length,0);
    await assert.rejects(publish(firstProposal),/unavailable/);
    await assert.rejects(publish(await proposal(first.id)),/unavailable/);
    await assert.rejects(db.query('update public.capability_heads set workflow_id=$1',[first.id]),/permission denied/);
    await db.exec('set role anon');await assert.rejects(publish(firstProposal),/permission denied/);
  }finally{await db.close();}
});
