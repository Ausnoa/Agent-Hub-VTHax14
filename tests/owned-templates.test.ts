import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {definitionSchema,templateFor} from '../src/lib/owned-agent/templates.ts';
import {OwnedStore} from '../src/lib/owned-agent/store.ts';
import {runDefinition} from '../src/lib/owned-agent/run.ts';
import {prepareGeneral,executeGeneral} from '../src/lib/general/service.ts';
import {GeneralStore} from '../src/lib/general/store.ts';
import type {structuredPlan} from '../src/lib/planner/index.ts';
const summary={name:'Meeting brief',template:'summary' as const,instructions:'Be concise',fields:[],reference:''};
const generate=(value:unknown)=> (async (_input, _instructions, schema)=>schema.parse(value)) as typeof structuredPlan;
test('template-specific configuration prevents empty references and ambiguous fields',()=>{
 assert.throws(()=>definitionSchema.parse({...summary,template:'qa'}));
 assert.throws(()=>definitionSchema.parse({...summary,template:'extract',fields:['Name','name']}));
 assert.throws(()=>definitionSchema.parse({...summary,template:'extract'}));
});
test('extractor validates requested field coverage and literal source grounding',async()=>{
 const agent={...summary,template:'extract' as const,fields:['amount','due']};
 assert.deepEqual(JSON.parse(await runDefinition(agent,'Total $250',generate({fields:[{name:'amount',value:'$250'},{name:'due',value:null}]}))),{amount:'$250',due:null});
 await assert.rejects(runDefinition(agent,'Total $250',generate({fields:[{name:'amount',value:'$500'},{name:'due',value:null}]})),/unsupported/);
 await assert.rejects(runDefinition(agent,'Total $250',generate({fields:[{name:'amount',value:'$250'}]})),/unsupported/);
});
test('Q&A requires evidence from saved reference and handles unanswerable questions',async()=>{
 const agent={...summary,template:'qa' as const,reference:'Returns are accepted within 30 days.'};
 assert.match(await runDefinition(agent,'Return window?',generate({answer:'30 days',evidence:['within 30 days'],supported:true})),/30 days/);
 await assert.rejects(runDefinition(agent,'Return window?',generate({answer:'90 days',evidence:['90 days'],supported:true})),/evidence/);
 assert.match(await runDefinition(agent,'Shipping cost?',generate({answer:'unknown',evidence:[],supported:false})),/not contain enough/);
});
test('saved agents survive reopen and execute as a sequential workflow without ANS network',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'owned-workflow-'));const old=process.env.COMPOSER_DB;process.env.COMPOSER_DB=join(folder,'test.sqlite');
 let owned=new OwnedStore();const first=owned.create(summary);const second=owned.create({...summary,name:'Follow-up brief'});owned.close();owned=new OwnedStore();
 const store=new GeneralStore();
 try {
  assert.equal(owned.get(first.id)?.name,summary.name);
  const steps=[first,second].map((a,i)=>({agentId:a.id,skill:templateFor(a.template).skill,inputFrom:i?'previous':'original',format:'text',instruction:''}));
  const noNetwork=async()=>{throw new Error('must not contact ANS');};
  const proposal=await prepareGeneral({name:'Created chain',steps},noNetwork);
  store.save(proposal);store.approve(proposal.id);store.enqueue(proposal.id,{type:'text',value:'source'});const run=store.claim()!;
  await executeGeneral(store,run,noNetwork,noNetwork,async(agent,text)=>`${agent.name}:${text}`);
  assert.equal(run.status,'completed');assert.equal(run.outputs[1].value,'Follow-up brief:Meeting brief:source');
  await assert.rejects(prepareGeneral({name:'Invalid skill',steps:[{...steps[0],skill:'wrong'}]},noNetwork),/unavailable/);
 }finally{owned.close();store.close();if(old===undefined)delete process.env.COMPOSER_DB;else process.env.COMPOSER_DB=old;rmSync(folder,{recursive:true,force:true});}
});
