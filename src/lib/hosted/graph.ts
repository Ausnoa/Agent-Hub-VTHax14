import type { Selection } from '../general/contracts.ts';
import type { HostedRun } from './workflow-contracts.ts';
export function workflowGraph(steps:Selection[],run?:HostedRun){
  return steps.map((step,index)=>({
    id:`step-${index}`,from:step.inputFrom==='original'?'input':`step-${step.inputStep ?? index-1}`,
    status:index<(run?.outputs.length??0)?'completed':index===(run?.outputs.length??-1)?run?.status==='running'?'running':run?.status==='failed'?'failed':'waiting':'waiting',
  }));
}
