import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCapabilities, defaultUI, validateUI, type PipelineServices } from '../src/lib/capabilities/pipeline.ts';
import { executeTask } from '../src/lib/capabilities/tasks.ts';
import { draftSchema, mapInput, valueSchema, type GeneralStep } from '../src/lib/general/contracts.ts';
import { GeneralStore } from '../src/lib/general/store.ts';
import { executeGeneral } from '../src/lib/general/service.ts';
import { invokeGeneral } from '../src/lib/general/client.ts';
import { gemini } from '../src/lib/models/gemini.ts';
import { AnsHttpError } from '../src/lib/ans/client.ts';

const speech = { agentId: 'speech-agent', name: 'Speech to text', description: 'Transcribes audio', skills: [{ id: 'transcribe', name: 'Transcribe' }] };
const resolved = { ansId:speech.agentId,name:speech.name,description:speech.description,ansName:'ans://speech.example',endpoint:'https://speech.example/a2a',metadataUrl:'https://speech.example/card',transports:['JSON-RPC'],discoveredAt:new Date().toISOString(),identityStatus:'not-verified' as const };
const audio = { type:'audio' as const,mimeType:'audio/webm' as const,value:Buffer.from('test audio').toString('base64') };
const request = (task:string, inputStep:number, format='text') => ({label:task,query:task,task,inputStep,format,instruction:''});
function services(capabilities:unknown[], search:PipelineServices['search']=async()=>[]):PipelineServices {
  return { search, prepare:async step=>({...step,name:speech.name,endpoint:resolved.endpoint,metadataUrl:resolved.metadataUrl}),
    generate:async(input,instructions,schema)=> {
      if(instructions.startsWith('Decompose'))return schema.parse({name:'Study tool',capabilities});
      if(instructions.startsWith('Rank'))return schema.parse({keys:[`${speech.agentId}/transcribe`]});
      if(instructions.includes('agent/product specialist'))return schema.parse({workflow:'Source to useful outputs',suggestions:['Generate flashcards','Generate practice quiz']});
      const payload=JSON.parse(input);
      return schema.parse(payload.proposedUI??defaultUI('Study tool',payload.steps));
    },
  };
}
test('study composition prefers ANS audio, fills only the summary gap, then extends with independent flashcards and quiz branches',async()=>{
  const searches:string[]=[];
  const study=await resolveCapabilities('Create a study tool with speech-to-text and summarization',services([request('transcribe',-1,'audio'),request('summarize',0)],async query=>{searches.push(query);return query==='transcribe'?[speech]:[];}));
  assert.equal(study.steps[0].agentId,speech.agentId);assert.equal(study.steps[1].geminiTask,'summarize');
  assert.deepEqual(searches,['transcribe','summarize']);assert.equal(study.capability.generation,'specialists');
  assert.equal(study.steps.length,2,'suggestions are not automatically added');
  const enhanced=await resolveCapabilities('Add flashcards and quizzes',services([request('flashcards',1),request('quiz',1)]),study);
  assert.deepEqual(enhanced.steps.slice(0,2),study.steps);assert.equal(enhanced.steps[3].inputStep,1);
  const custom={...study,capability:{...study.capability,ui:{...study.capability.ui,title:'Lecture lab',layout:'columns' as const,panels:study.capability.ui.panels.map(p=>({...p,title:`Custom ${p.step}`}))}}};
  const failing=services([request('flashcards',1)]),plan=failing.generate;
  failing.generate=async(input,rules,schema)=>rules.includes('specialist')?Promise.reject(new Error('provider overloaded')):plan(input,rules,schema);
  const kept=await resolveCapabilities('Add flashcards',failing,custom);
  assert.equal(kept.capability.generation,'fallback');assert.equal(kept.capability.ui.title,'Lecture lab');assert.equal(kept.capability.ui.layout,'columns');
  assert.deepEqual(kept.capability.ui.panels.map(p=>[p.step,p.title,p.component]),[[0,'Custom 0','text'],[1,'Custom 1','text'],[2,'flashcards','flashcards']],'a failed enhancement keeps the existing interface and appends the new output');
  const store=new GeneralStore(':memory:');
  try{
    const proposal=store.putCapability(enhanced);const saved=store.publishCapability(proposal.id);
    const queued=store.enqueue(saved.id,audio);const run=store.claim()!;
    const received:string[]=[];
    await executeGeneral(store,run,async(step,input)=>{assert.equal(step.agentId,speech.agentId);assert.deepEqual(input,audio);return {type:'text',value:'Lecture transcript'};},async()=>[resolved],undefined,async(task,input,instruction)=>{
      received.push(`${task}:${input.value}`);
      return executeTask(task,input,instruction,async(_input,_rules,schema)=>schema.parse(task==='summarize'?{text:'Lecture summary'}:task==='flashcards'?{cards:[{front:'Question',back:'Answer'}]}:{questions:[{question:'Question',options:['A','B'],answer:0,explanation:'From source'}]}));
    });
    assert.equal(store.run(queued.id)?.status,'completed');assert.equal(run.outputs.length,4);
    assert.deepEqual(received,['summarize:Lecture transcript','flashcards:Lecture summary','quiz:Lecture summary']);
  }finally{store.close();}
});
test('transcription input is audio even when the planner describes its text output',async()=>{
  for (const format of ['text','json']) {
    for (const useANS of [false,true]) {
      const deps=services([request('transcribe',-1,format),request('summarize',0)],async query=>useANS&&query==='transcribe'?[speech]:[]);
      const prepare=deps.prepare;
      deps.prepare=async step=>{assert.equal(step.format,'audio');assert.equal(step.inputFrom,'original');return prepare(step);};
      const draft=await resolveCapabilities('Transcribe audio and summarize the notes',deps);
      assert.equal(draft.steps[0].format,'audio');
      assert.equal(draft.steps[0].agentId,useANS?speech.agentId:'gemini:transcribe');
      assert.equal(draft.steps[1].inputStep,0);
      assert.equal(draft.steps[1].geminiTask,'summarize');
      assert.deepEqual(draft.capability.unresolved,[]);
      assert.deepEqual(mapInput(draft.steps[0],audio),audio);
      assert.deepEqual(mapInput(draft.steps[1],audio,{type:'text',value:'Transcript'},[{type:'text',value:'Transcript'}]),{type:'text',value:'Transcript'});
    }
  }
});

test('transcription cannot reinterpret a previous text output as original audio',async()=>{
  const draft=await resolveCapabilities('Invalid transcription dependency',services([request('summarize',-1),request('transcribe',0,'text')]));
  assert.equal(draft.steps.length,1);
  assert.match(draft.capability.unresolved[0].reason,/original audio/);
});

test('text extraction resolves while external research stays explicitly unresolved',async()=>{
  const draft=await resolveCapabilities('Extract concepts, then research current prices',services([request('extract',-1),{...request('unsupported',0),label:'Live research'}]));
  assert.equal(draft.steps.length,1);assert.equal(draft.steps[0].geminiTask,'extract');
  assert.equal(draft.capability.unresolved[0].capability,'Live research');
  const store=new GeneralStore(':memory:');try{assert.throws(()=>store.publishCapability(store.putCapability(draft).id),/incomplete/);}finally{store.close();}
});
test('registry outage never becomes fallback; invalid UI falls back to executable panels',async()=>{
  await assert.rejects(resolveCapabilities('Summarize supplied text',services([request('summarize',-1)],async()=>{throw new Error('Registry outage');})),/Registry outage/);
  for(const status of [429,503]){
    const deps=services([request('transcribe',-1,'audio')],async()=>[speech]);
    deps.prepare=async()=>{throw new AnsHttpError(`ANS resolution failed (HTTP ${status})`,status,null);};
    await assert.rejects(resolveCapabilities('Transcribe lectures',deps),new RegExp(String(status)),'a rate-limited or failing registry never becomes a Gemini substitute');
  }
  const deps=services([request('summarize',-1)]),generate=deps.generate;
  deps.generate=async(input,rules,schema)=>rules.includes('frontend specialist')?schema.parse({...defaultUI('Bad',[]),panels:[{step:7,title:'Invented',component:'quiz'}]}):generate(input,rules,schema);
  const draft=await resolveCapabilities('Summarize supplied text',deps);
  assert.equal(draft.capability.generation,'fallback');assert.equal(draft.capability.ui.panels[0].step,0);
});
test('bindings reject cycles, forged Gemini skills and invented UI actions',()=>{
  const step:GeneralStep={agentId:'gemini:summarize',geminiTask:'summarize',skill:'summarize',name:'Summary',endpoint:'gemini:summarize',metadataUrl:'gemini:summarize',format:'text',inputFrom:'original',instruction:''};
  assert.throws(()=>draftSchema.parse({name:'Bad',steps:[{...step,inputFrom:'previous',inputStep:0}]}));
  assert.throws(()=>draftSchema.parse({name:'Bad',steps:[{...step,agentId:'external'}]}));
  assert.throws(()=>validateUI({...defaultUI('Summary',[step]),panels:[{step:0,title:'Buy shares',component:'quiz'}]},[step]));
  assert.throws(()=>mapInput(step,audio),/transcribed/);
  assert.equal(valueSchema.safeParse({...audio,value:'!not base64!'}).success,false);
});
test('published revisions are idempotent, preserve old runs, and reject stale concurrent enhancements',async()=>{
  const draft=await resolveCapabilities('Summarize text',services([request('summarize',-1)]));
  const store=new GeneralStore(':memory:');
  try{
    const proposal=store.putCapability(draft);const first=store.publishCapability(proposal.id);
    assert.equal(store.publishCapability(proposal.id).id,first.id);
    const oldRun=store.enqueue(first.id,{type:'text',value:'Old source'});
    const a=store.putCapability(draft,first.id),b=store.putCapability(draft,first.id);
    const second=store.publishCapability(a.id);assert.equal(second.revision?.rootId,first.id);assert.equal(second.revision?.number,2);
    assert.throws(()=>store.publishCapability(b.id),/newer revision/);assert.equal(store.run(oldRun.id)?.workflowId,first.id);
    assert.equal(store.get(first.id)?.steps.length,1);
  }finally{store.close();}
});
test('A2A audio uses real file parts and refuses unadvertised MIME types',async()=>{
  const step:GeneralStep={agentId:speech.agentId,skill:'transcribe',name:speech.name,endpoint:resolved.endpoint,metadataUrl:resolved.metadataUrl,format:'audio',inputFrom:'original',instruction:''};
  let calls=0;
  const fetcher:typeof fetch=async(url,init)=>{
    if(String(url)===step.metadataUrl)return Response.json({url:step.endpoint,protocolVersion:'0.3.0',defaultInputModes:['audio/webm'],defaultOutputModes:['text/plain'],skills:[{id:'transcribe'}]});
    calls++;const body=JSON.parse(String(init?.body));const part=body.params.message.parts[0];
    assert.equal(part.kind,'file');assert.equal(part.file.bytes,audio.value);assert.equal(part.file.mimeType,'audio/webm');
    return Response.json({jsonrpc:'2.0',id:body.id,result:{kind:'message',messageId:'reply',role:'agent',parts:[{kind:'text',text:'Actual transcript'}]}});
  };
  assert.deepEqual(await invokeGeneral(step,audio,fetcher),{type:'text',value:'Actual transcript'});
  await assert.rejects(invokeGeneral(step,{...audio,mimeType:'audio/wav'},fetcher),/recorded audio format/);assert.equal(calls,1);
});
test('Gemini provider validates structured output and does not leak error bodies',async()=>{
  const oldFetch=globalThis.fetch,oldKey=process.env.GEMINI_API_KEY,oldModel=process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY='test-key';process.env.GEMINI_MODEL='test-model';
  try{
    globalThis.fetch=async(_url,init)=>{const body=JSON.parse(String(init?.body));assert.equal(body.generationConfig.responseMimeType,'application/json');return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"text":"A summary"}'}]}}]});};
    assert.deepEqual(await executeTask('summarize',{type:'text',value:'Source'},'',gemini),{type:'text',value:'A summary'});
    let attempts=0;
    globalThis.fetch=async()=>++attempts<3?new Response('temporary',{status:503}):Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"text":"Recovered"}'}]}}]});
    assert.deepEqual(await executeTask('summarize',{type:'text',value:'Source'},'',gemini),{type:'text',value:'Recovered'});
    assert.equal(attempts,3);
    attempts=0;
    globalThis.fetch=async()=>{attempts++;return new Response('temporary',{status:503});};
    await assert.rejects(executeTask('summarize',{type:'text',value:'Source'},'',gemini),/503/);
    assert.equal(attempts,3,'temporary failures have a bounded retry count');
    process.env.GEMINI_MODEL='exhausted-model, backup-model';
    const used:string[]=[];
    globalThis.fetch=async url=>{const model=String(url).match(/models\/([^:]+):/)![1];used.push(model);return model==='exhausted-model'?new Response('quota',{status:429}):Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"text":"From backup"}'}]}}]});};
    assert.deepEqual(await executeTask('summarize',{type:'text',value:'Source'},'',gemini),{type:'text',value:'From backup'});
    assert.deepEqual(used,['exhausted-model','backup-model']);
    used.length=0;
    globalThis.fetch=async url=>{const model=String(url).match(/models\/([^:]+):/)![1];used.push(model);return model==='exhausted-model'?new Response('busy',{status:503}):Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"text":"From backup"}'}]}}]});};
    assert.deepEqual(await executeTask('summarize',{type:'text',value:'Source'},'',gemini),{type:'text',value:'From backup'});
    assert.deepEqual(used,['exhausted-model','backup-model'],'an overloaded model hands over without spending retries');
    used.length=0;
    globalThis.fetch=async url=>{used.push(String(url));return new Response('bad request',{status:400});};
    await assert.rejects(executeTask('summarize',{type:'text',value:'Source'},'',gemini),/400/);
    assert.equal(used.length,1,'request errors do not fall through to other models');
    process.env.GEMINI_MODEL='test-model';
    globalThis.fetch=async()=>new Response('secret provider body',{status:429});
    await assert.rejects(executeTask('summarize',{type:'text',value:'Source'},'',gemini),error=>error instanceof Error&&error.message.includes('429')&&!error.message.includes('secret'));
  }finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;if(oldModel===undefined)delete process.env.GEMINI_MODEL;else process.env.GEMINI_MODEL=oldModel;}
});
