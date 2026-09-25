import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { handleCapabilities, type CapabilityContext } from '../src/lib/capabilities/handler.ts';
import { defaultUI } from '../src/lib/agent-ui/capability.ts';
import type { GeneralStep } from '../src/lib/general/contracts.ts';
import { advanceHosted, workflowServices } from '../src/lib/hosted/workflow-service.ts';

const id=randomUUID();
const step:GeneralStep={agentId:'gemini:summarize',skill:'summarize',geminiTask:'summarize',name:'Summary',format:'text',inputFrom:'original',instruction:'',endpoint:'gemini:summarize',metadataUrl:'gemini:summarize'};
const definition={name:'Summary',description:'Summarizes input',steps:[step],capability:{version:1 as const,intent:'Summarize',ui:defaultUI('Summary',[step]),suggestions:[],unresolved:[],generation:'fallback' as const}};
const req=(body:unknown)=>new Request('http://localhost/api/capabilities/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

test('capability save uses server proposal, rechecks bindings and never accepts browser definitions',async()=>{
  let checked=0,published=0;
  const context={get:async()=>({id,definition,createdAt:new Date().toISOString()}),prepare:async(s:GeneralStep)=>{checked++;return s;},publish:async()=>{published++;return definition;}} as unknown as CapabilityContext;
  const response=await handleCapabilities(req({proposalId:id,definition:{steps:[{endpoint:'https://attacker.example'}]}}),['capabilities','save'],context);
  assert.equal(response.status,201);assert.equal(checked,1);assert.equal(published,1);
  context.prepare=async s=>({...s,endpoint:'changed'});
  await assert.rejects(handleCapabilities(req({proposalId:id}),['capabilities','save'],context),/changed since discovery/);assert.equal(published,1);
});
test('hosted Gemini branch reads its declared dependency and failed claims do not execute',async()=>{
  const steps=[step,{...step,inputFrom:'previous' as const,inputStep:0},{...step,inputFrom:'previous' as const,inputStep:0}];
  const run={id,workflow_id:id,input:{type:'text' as const,value:'Original'},outputs:[{type:'text' as const,value:'Summary'},{type:'text' as const,value:'Flashcards'}],status:'ready' as const,error:null,started_at:null,created_at:new Date().toISOString()};
  let calls=0,claim:string|null='claim-token',finished:unknown;
  const store={claim:async()=>claim,run:async()=>run,get:async()=>({definition:{name:'Study',steps}}),finish:async(_id:string,_token:string,result:unknown)=>{finished=result;}} as never;
  const services={...workflowServices,runCapability:async(_task:unknown,input:{value:unknown})=>{calls++;assert.equal(input.value,'Summary');return {type:'text' as const,value:'Quiz'};}};
  await advanceHosted(run,2,store,{} as never,services);assert.equal(calls,1);assert.deepEqual(finished,{type:'text',value:'Quiz'});
  claim=null;await advanceHosted(run,2,store,{} as never,services);assert.equal(calls,1);
});
test('adopting a hand-built workflow keeps its steps, designs a validated interface, and publishes a revision',async()=>{
  const manual={name:'Meeting notes',description:'',steps:[{...step,geminiTask:undefined,agentId:'ans-agent',skill:'summarize-text',endpoint:'https://agent.example/a2a',metadataUrl:'https://agent.example/card'}]};
  let put:{definition:unknown;parentId?:string}|undefined,budget=0;
  const roles:string[]=[];
  const generate=(async(_input:string,rules:string,schema:{parse:(v:unknown)=>unknown})=>{
    roles.push(rules.slice(0,40));
    if(rules.includes('product specialist'))return schema.parse({workflow:'Paste notes, read the brief',suggestions:['Extract action items']});
    return schema.parse({...defaultUI('Meeting notes',manual.steps as GeneralStep[]),title:'Meeting brief',extras:['history','export'],primaryPanel:0});
  }) as CapabilityContext['generate'];
  const context={enabled:true,budget:async()=>{budget++;},generate,getAgent:async(workflowId:string)=>{assert.equal(workflowId,id);const {asCapabilityDraft}=await import('../src/lib/capabilities/handler.ts');return asCapabilityDraft(manual as never);},
    put:async(definition:unknown,parentId?:string)=>{put={definition,parentId};return {id:randomUUID(),definition,parentId,createdAt:new Date().toISOString()};},
    publish:async()=>({published:true})} as unknown as CapabilityContext;
  const adopt=new Request('http://localhost/api/capabilities/adopt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workflowId:id})});
  const response=await handleCapabilities(adopt,['capabilities','adopt'],context);
  assert.equal(response.status,201);assert.equal(budget,1);assert.equal(roles.length,3,'product, frontend, and backend specialists each run once');
  assert.equal(put?.parentId,id);
  const saved=put?.definition as typeof definition;
  assert.deepEqual(saved.steps,manual.steps,'adoption never changes the hand-picked steps');
  assert.equal(saved.capability.ui.title,'Meeting brief');assert.equal(saved.capability.generation,'specialists');
  assert.deepEqual(saved.capability.suggestions,['Extract action items']);assert.deepEqual(saved.capability.unresolved,[]);
});
