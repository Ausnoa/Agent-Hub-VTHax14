import test from 'node:test';
import assert from 'node:assert/strict';
import { workflowGraph } from '../src/lib/hosted/graph.ts';
import type { Selection } from '../src/lib/general/contracts.ts';
import type { HostedRun } from '../src/lib/hosted/workflow-contracts.ts';
const base:Selection={agentId:'example',skill:'summary',inputFrom:'original',format:'text',instruction:''};
test('graph connections follow original vs previous mappings, even with repeated agents',()=>{
  assert.deepEqual(workflowGraph([base,{...base,inputFrom:'previous'},base]).map(n=>[n.id,n.from]),[['step-0','input'],['step-1','step-0'],['step-2','input']]);
  assert.deepEqual(workflowGraph([]),[]);
});
test('graph highlights only completed, current, or failed steps from the selected run',()=>{
  const run={status:'running',outputs:[{type:'text',value:'done'}]} as HostedRun;
  assert.deepEqual(workflowGraph([base,base,base],run).map(n=>n.status),['completed','running','waiting']);
  assert.deepEqual(workflowGraph([base,base,base],{...run,status:'failed'}).map(n=>n.status),['completed','failed','waiting']);
  assert.deepEqual(workflowGraph([base,base]).map(n=>n.status),['waiting','waiting']);
});
