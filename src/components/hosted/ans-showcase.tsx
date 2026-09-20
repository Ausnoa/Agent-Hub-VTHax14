"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,ExternalLink} from 'lucide-react';
import {showcaseAgents} from '../../lib/hosted/showcase';
import Mascot from '../agent-runtime/mascot';
import {variantFor} from '../../lib/agent-ui/variant';
import './showcase.css';
export default function AnsShowcase(){
  const [health,setHealth]=useState<{agents:{key:string;live:boolean}[];checkedAt:string}>();
  useEffect(()=>{let active=true;fetch('/api/showcase').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(active)setHealth(data);}).catch(()=>{if(active)setHealth({agents:[],checkedAt:''});});return()=>{active=false;};},[]);
  return <section className="ans-showcase" aria-labelledby="showcase-title">
    <div className="showcase-intro"><div><p className="eyebrow">BUILT HERE · REGISTERED WITH ANS · SPEAKING A2A</p><h2 id="showcase-title">Three agents. One live demo.</h2><p>Meet the Glorria team. Discover their identities, give them a task, and watch them work together.</p></div><Link className="btn btn-primary" href="/create?showcase=all">Try the three-agent demo <ArrowRight size={16}/></Link></div>
    <div className="showcase-grid">{showcaseAgents.map((agent,index)=><article key={agent.key} className={`showcase-agent showcase-agent-${index}`}>
      <div className="showcase-face"><Mascot width={72} variant={variantFor(agent.id,index)}/><span>{agent.role}</span></div><h3>{agent.name}</h3><p>{agent.purpose}</p>
      <div className="showcase-badges"><a href={`https://transparency.ans.godaddy.com/v1/agents/${agent.id}`} target="_blank" rel="noreferrer">ANS registration <ExternalLink size={11}/></a><a href={`${agent.origin}/.well-known/agent-card.json`} target="_blank" rel="noreferrer">A2A 0.3</a></div>
      <p className="showcase-health" role="status">{!health?'Checking endpoint…':health.agents.find(a=>a.key===agent.key)?.live?'● Live agent card':'○ Endpoint check unavailable'}</p>
      <div className="showcase-actions"><Link href={`/create?showcase=${agent.key}`}>Try an example <ArrowRight size={13}/></Link><Link href={`/create?showcase=${agent.key}&blank=1`}>Add to workflow</Link></div>
    </article>)}</div>
    <p className="showcase-note">The demo uses a fictional brewery menu: Extract → Brief → Answers. Answers reads the original menu to preserve evidence. Review and save the steps before running. Live checks confirm the agent card responds, not inference availability.{health?.checkedAt&&` Checked ${new Date(health.checkedAt).toLocaleTimeString()}.`}</p>
  </section>;
}
