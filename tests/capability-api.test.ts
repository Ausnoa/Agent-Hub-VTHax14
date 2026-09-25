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
