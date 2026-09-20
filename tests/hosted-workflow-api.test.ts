import test from 'node:test';
import assert from 'node:assert/strict';
import { handleWorkflowApi,hostedWorkflowDependencies } from '../src/lib/hosted/workflow-handler.ts';
import { prepareHosted,advanceHosted,workflowServices } from '../src/lib/hosted/workflow-service.ts';
import { HostedError } from '../src/lib/hosted/server.ts';
const id='00000000-0000-4000-8000-000000000001';
const step={agentId:id,skill:'summary',inputFrom:'original' as const,format:'text' as const,instruction:'',name:'Summary',endpoint:'https://agent.example/a2a',metadataUrl:'https://agent.example/card'};
const run={id,workflow_id:id,input:{type:'text' as const,value:'Source'},outputs:[],status:'ready' as const,error:null,started_at:null,created_at:new Date().toISOString()};
const workflow={id,definition:{name:'Workflow',steps:[step]},created_at:run.created_at};
const identity={} as never;
const request=(path:string,body?:unknown,origin='https://hub.example')=>new Request(`https://hub.example/api/hosted/${path}`,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});

test('hosted workflow APIs require authentication and reject cross-origin writes before processing',async()=>{
  let calls=0;
  const deps={...hostedWorkflowDependencies,authenticate:async()=>{calls++;throw new HostedError(401,'Sign in');}};
  assert.equal((await handleWorkflowApi(request('workflows'),['workflows'],deps)).status,401);
  assert.equal((await handleWorkflowApi(request('workflows',{},'https://evil.example'),['workflows'],deps)).status,403);
  assert.equal(calls,1);
});
test('run start and continuation require explicit execution confirmation',async()=>{
  let starts=0;
  const deps={...hostedWorkflowDependencies,authenticate:async()=>identity,agents:()=>({}) as never,enabled:()=>true,
    workflows:()=>({get:async()=>workflow,run:async()=>run,start:async()=>{starts++;return id;}}) as never};
  assert.equal((await handleWorkflowApi(request(`workflows/${id}/invoke`,{requestId:id,input:run.input}),['workflows',id,'invoke'],deps)).status,400);
  assert.equal((await handleWorkflowApi(request(`workflows/runs/${id}/advance`,{expectedStep:0}),['workflows','runs',id,'advance'],deps)).status,400);
  assert.equal(starts,0);
});
test('preparation ignores supplied endpoints and verifies template ownership',async()=>{
  const services={...workflowServices,resolve:async()=>[{ansId:id,name:'Real agent',endpoint:step.endpoint,metadataUrl:step.metadataUrl}] as never,inspect:async(s:{endpoint:string})=>{assert.equal(s.endpoint,step.endpoint);}};
  const result=await prepareHosted({name:'Example',steps:[{...step,endpoint:'http://127.0.0.1/admin'}]},{} as never,services);
  assert.equal(result.steps[0].endpoint,step.endpoint);
  await assert.rejects(prepareHosted({name:'Stolen',steps:[{...step,agentId:`template:${id}`}]},{get:async()=>{throw new HostedError(404,'Agent not found');}} as never),/not found/);
});
test('failed claim and changed registration never invoke an external agent',async()=>{
  let invoked=0,finished=0;
  const services={...workflowServices,resolve:async()=>[],invoke:async()=>{invoked++;return run.input;}};
  const store={claim:async()=>null,run:async()=>run,get:async()=>workflow,finish:async()=>{finished++;}};
  await advanceHosted(run,0,store as never,{} as never,services);assert.equal(invoked,0);assert.equal(finished,0);
  await advanceHosted(run,0,{...store,claim:async()=>id} as never,{} as never,services);assert.equal(invoked,0);assert.equal(finished,1);
});
test('template step shares test budget and persists output; result-save failures never reinvoke',async()=>{
  let invokes=0,reserved=0;
  const ownStep={...step,agentId:`template:${id}`,skill:'summarize-text'};
  const store={claim:async()=>id,run:async()=>run,get:async()=>({...workflow,definition:{name:'Own',steps:[ownStep]}}),finish:async()=>{throw new Error('database offline');}};
  const agents={get:async()=>({id,template:'summary',name:'Summary',instructions:'',fields:[],reference:''}),reserve:async()=>{reserved++;return id;},finish:async()=>{}};
  const services={...workflowServices,runTemplate:async()=>{invokes++;return 'Summary output';}};
  await assert.rejects(advanceHosted(run,0,store as never,agents as never,services),/database offline/);
  assert.equal(invokes,1);assert.equal(reserved,1);
});

test('menu suggestions constrain generation to exact available agent-skill choices',async()=>{
  const {suggestHosted}=await import('../src/lib/hosted/workflow-service.ts');
  const candidate={agentId:`template:${id}`,name:'Summary',description:'Summarize supplied text',source:'template' as const,skills:[{id:'summarize-text',name:'Summarizer',tags:[]}]};
  const services={...workflowServices,generate:async(input:string,_instructions:string,schema:any)=>{
    const choice=JSON.parse(input).choices[0].choice;
    const plan={name:'Menu ideas',steps:[{choice,inputFrom:'original',format:'text',instruction:'Extract key ideas from the supplied brewery menu.'}],unsupported:[]};
    assert.equal(schema.safeParse({...plan,steps:[{...plan.steps[0],choice:'invented-agent'}]}).success,false);
    return schema.parse(plan);
  }};
  const draft=await suggestHosted('Extract key ideas from a brewery menu',[candidate],services);
  assert.equal(draft.steps[0].agentId,candidate.agentId);
  assert.equal(draft.steps[0].skill,'summarize-text');
  await assert.rejects(suggestHosted('Menu ideas',[],services),/No agents/);
});
test('discovery timeouts are actionable without exposing upstream details',async()=>{
  const {searchHosted}=await import('../src/lib/hosted/workflow-service.ts');
  await assert.rejects(searchHosted('',undefined,{list:async()=>[]} as never,{...workflowServices,discover:async()=>{throw new DOMException('private upstream data','TimeoutError');}}),/ANS discovery timed out/);
});
