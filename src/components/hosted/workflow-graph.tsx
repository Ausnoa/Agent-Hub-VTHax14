"use client";
import { useId } from 'react';
import type { Selection } from '../../lib/general/contracts';
import type { HostedRun } from '../../lib/hosted/workflow-contracts';
import { workflowGraph } from '../../lib/hosted/graph';
import TopologyGraph from '../agent-glorria/topology-graph';
export default function WorkflowGraph({steps,names,run}:{steps:Selection[];names:string[];run?:HostedRun}){
  const marker=useId().replace(/:/g,'');const nodes=workflowGraph(steps,run);
  if(!steps.length)return <><TopologyGraph coreLabel="Your workflow" coreSublabel="Choose agents to connect" nodes={[{id:'input',label:'Your input',angle:210,radius:1},{id:'agents',label:'Agent skills',angle:330,radius:1,tone:'violet'},{id:'output',label:'Results',angle:90,radius:1,tone:'green'}]}/><p className="hint">Preview only. Add steps to see their actual connections.</p></>;
  return <div className="workflow-graph" role="region" aria-label="Workflow graph" tabIndex={0}><svg viewBox={`0 0 680 ${steps.length*125+40}`} style={{height:steps.length*125+40}} role="img" aria-label="Workflow input connections and step status">
    <defs><marker id={marker} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="var(--accent)"/></marker></defs>
    <rect x="15" y="20" width="140" height="56" rx="14" fill="var(--bg-panel)" stroke="var(--accent)"/><text x="85" y="53" textAnchor="middle" fill="var(--text)" fontSize="14">Original input</text>
    {nodes.map((node,index)=>{const y=20+index*125;return <g key={node.id}>
      <path d={node.from==='input'?`M155 48 H190 V${y+38} H240`:`M440 ${y-49} V${y}`} fill="none" stroke="var(--accent)" strokeWidth="2" markerEnd={`url(#${marker})`}/>
      <a href={`#hosted-step-${index}`} aria-label={`Edit step ${index+1}: ${names[index]}. Input: ${steps[index].inputFrom}. ${node.status}`}>
        <rect x="240" y={y} width="400" height="76" rx="14" fill="var(--bg-panel)" stroke={node.status==='completed'?'var(--green)':node.status==='failed'?'var(--red)':'var(--accent)'} strokeWidth="1.5"/>
        <text x="258" y={y+26} fill="var(--text)" fontSize="14">{index+1}. {(names[index]??steps[index].skill).slice(0,42)}</text>
        <text x="258" y={y+49} fill="var(--text-muted)" fontSize="12">{steps[index].skill.slice(0,36)} Â· {steps[index].format}</text>
        <text x="625" y={y+65} textAnchor="end" fill="var(--text-muted)" fontSize="11">{node.status}</text>
      </a>
    </g>;})}
  </svg><p className="hint">Arrows show input sources. Steps execute in numbered order. Select a node to edit it.</p></div>;
}
