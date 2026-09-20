import test from 'node:test';
import assert from 'node:assert/strict';
import {showcaseDraft,demoMenu,showcaseAgents} from '../src/lib/hosted/showcase.ts';
import {draftSchema,mapInput} from '../src/lib/general/contracts.ts';
test('showcase preserves source evidence and uses the three registered agent skills',()=>{
 const demo=showcaseDraft('all')!;draftSchema.parse(demo);
 assert.deepEqual(demo.steps.map(s=>s.inputFrom),['original','previous','original']);
 assert.equal(new Set(demo.steps.map(s=>s.agentId)).size,3);
 const original={type:'text' as const,value:demoMenu};
 const answer=mapInput(demo.steps[2],original,{type:'text',value:'Lossy summary'});
 assert.ok(String(answer.value).includes('Reference:\n'+demoMenu));
 assert.ok(!String(answer.value).includes('Lossy summary'));
 for(const agent of showcaseAgents)assert.equal(showcaseDraft(agent.key)?.steps[0].agentId,agent.id);
 assert.equal(showcaseDraft('unknown'),undefined);
});
