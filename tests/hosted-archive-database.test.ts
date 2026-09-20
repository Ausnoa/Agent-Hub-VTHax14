import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('archive is owner-only, hides public items, blocks new runs, and preserves history',async()=>{
 const db=new PGlite();const alice='00000000-0000-4000-8000-000000000001',bob='11111111-1111-4000-8000-000000000002';
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;`);
 for(const file of ['202609190001_hosted_agents','202609190002_hosted_workflows','202609190003_profiles_and_visibility','202609200004_archive_agents_workflows'])await db.exec(await readFile(new URL(`../supabase/migrations/${file}.sql`,import.meta.url),'utf8'));
 await db.query('insert into auth.users values ($1),($2)',[alice,bob]);await db.exec('set role authenticated');
 const user=(id:string)=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await user(alice);
 for(const [table,rpc] of [['template_agents','reserve_agent_test'],['hosted_workflows','start_hosted_workflow']]){
 const id=(await db.query<{id:string}>(`insert into public.${table}(definition) values ('{}') returning id`)).rows[0].id;
 const invoke=()=>rpc==='reserve_agent_test'?db.query('select public.reserve_agent_test($1,$2)',[id,'source']):db.query('select public.start_hosted_workflow(gen_random_uuid(),$1,$2)',[id,{type:'text',value:'source'}]);
 await db.query(`update public.${table} set visibility='public' where id=$1`,[id]);await invoke();await user(bob);
 assert.equal((await db.query(`update public.${table} set archived=true,visibility='private' where id=$1 returning id`,[id])).rows.length,0);
 await user(alice);await db.query(`update public.${table} set archived=true,visibility='private' where id=$1`,[id]);await assert.rejects(invoke(),/unavailable/);
 await user(bob);assert.equal((await db.query(`select id from public.${table} where id=$1`,[id])).rows.length,0);
 await user(alice);await db.query(`update public.${table} set archived=false where id=$1`,[id]);await invoke();
 }
 assert.equal((await db.query('select id from public.agent_test_runs')).rows.length,2);assert.equal((await db.query('select id from public.hosted_workflow_runs')).rows.length,2);
 }finally{await db.close();}
});
