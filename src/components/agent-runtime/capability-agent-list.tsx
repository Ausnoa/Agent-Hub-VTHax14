'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api-client';
import { hostedApi } from '../../lib/hosted/browser';
import type { GeneralWorkflow } from '../../lib/general/contracts';
import type { HostedWorkflow } from '../../lib/hosted/workflow-contracts';
import Card from '../ui/card';

export default function CapabilityAgentList({local=false}:{local?:boolean}) {
  const [agents,setAgents]=useState<{id:string;rootId:string;name:string;description:string;revision:number;steps:number}[]>([]),[error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    const load=local?api<GeneralWorkflow[]>('general').then(items=>items.map(a=>({id:a.id,definition:a}))):hostedApi<HostedWorkflow[]>('workflows');
    load.then(items=>{
      const rows=items.filter(a=>a.definition.capability).map(a=>({id:a.id,rootId:a.definition.revision?.rootId??a.id,name:a.definition.name,description:a.definition.capability!.ui.description,revision:a.definition.revision?.number??1,steps:a.definition.steps.length}));
      if(active)setAgents([...new Map(rows.sort((a,b)=>a.revision-b.revision).map(a=>[a.rootId,a])).values()]);
    }).catch(()=>{if(active)setError('Could not load purpose-built agents.');});
    return()=>{active=false;};
  },[local]);
  return <section style={{marginBlock:24}}><h2>Purpose-built agents</h2>{error&&<p role="alert">{error}</p>}<div className="fleet-grid">{agents.map(agent=><Card key={agent.rootId}><h3>{agent.name}</h3><p>{agent.description}</p><p className="hint">{agent.steps} capabilities · Revision {agent.revision}</p><Link href={`/studio?agent=${agent.rootId}`}>Open / enhance →</Link></Card>)}</div><p><Link href="/studio">Create a purpose-built agent →</Link></p></section>;
}
