"use client";
import { useState } from 'react';
import Link from 'next/link';
import {ArrowRight,Cpu,Radar,Search} from 'lucide-react';
import type {Candidate} from '../../lib/hosted/workflow-contracts';
import PageShell from '../layout/page-shell';
import PageHeader from '../layout/page-header';
import Card,{CardHead} from '../ui/card';
import Button from '../ui/button';
import StatusPill from '../ui/status-pill';
import TopologyGraph from '../agent-hub/topology-graph';
import PublicAgentCard, {type PublicAgentSummary} from './public-agent-card';

type Props={candidates:Candidate[];query:string;setQuery:(value:string)=>void;busy:boolean;loading:boolean;error:string;searched:boolean;hasMore:boolean;search:(more?:boolean)=>Promise<void>;add:(candidate:Candidate,skill:string)=>void;publicAgents?:PublicAgentSummary[];publicAgentsError?:string};
export default function HostedDiscover({candidates,query,setQuery,busy,loading,error,searched,hasMore,search,add,publicAgents,publicAgentsError}:Props){
  const saved=candidates.filter(c=>c.source==='template'),external=candidates.filter(c=>c.source==='ans');
  // Client-side filter over the already-loaded saved templates — no request, so no submit button.
  const [savedQuery,setSavedQuery]=useState('');
  const savedTerm=savedQuery.trim().toLowerCase();
  const visibleSaved=saved.filter(c=>!savedTerm||c.name.toLowerCase().includes(savedTerm)||(c.description||'').toLowerCase().includes(savedTerm)||c.skills.some(s=>s.name.toLowerCase().includes(savedTerm)||s.id.toLowerCase().includes(savedTerm))||c.agentId.toLowerCase().includes(savedTerm));
  // Same pattern for the public-agents row: the full list is already loaded, so filter locally.
  const [publicQuery,setPublicQuery]=useState('');
  const publicTerm=publicQuery.trim().toLowerCase();
  const visiblePublic=(publicAgents??[]).filter(a=>!publicTerm||a.name.toLowerCase().includes(publicTerm)||a.description.toLowerCase().includes(publicTerm));
  function row(candidate:Candidate){return <article className="registry-item" key={candidate.agentId}>
    <span className="registry-item-icon">{candidate.source==='template'?<Cpu size={15}/>:<Radar size={15}/>}</span>
    <div style={{minWidth:0,flex:1}}><h3>{candidate.name}</h3><p>{candidate.description||'No description provided by the agent owner.'}</p>
      <p className="mono" style={{marginTop:4}}>{candidate.skills.map(s=>s.name).join(' · ')}</p>
      <details><summary>View {candidate.source==='template'?'agent':'discovery'} details</summary><dl>
        <dt>Source</dt><dd>{candidate.source==='template'?'Your private saved template':'Live ANS registry'}</dd>
        {candidate.source==='ans'&&<><dt>Endpoint</dt><dd>{candidate.endpoint||'Checked when saving a workflow'}</dd><dt>Identity check</dt><dd>Not verified</dd></>}
        <dt>Use in a workflow</dt><dd className="discover-skill-actions">{candidate.skills.map(skill=><Button size="sm" key={skill.id} disabled={busy} onClick={()=>add(candidate,skill.id)}>Use {skill.name} <ArrowRight size={12}/></Button>)}</dd>
      </dl></details>
    </div><StatusPill tone={candidate.source==='template'?'accent':'violet'}>{candidate.source==='template'?'Private':'A2A'}</StatusPill>
  </article>;}
  return <PageShell className="screen-discovery hosted-discovery"><PageHeader eyebrow="AUTONOMOUS PIPELINE DISCOVERY" title="Browse the dashboard" description="See your agents, discover what other members have published, and manage your account — all in one place." action={<Link className="btn btn-primary" href="/dashboard">Open dashboard <ArrowRight size={14}/></Link>}/>
    <div className="split-layout">
      <Card className="mesh-panel"><CardHead>Compose an agent</CardHead><p className="hint" style={{marginBottom:16}}>Have an outcome in mind? Describe it and Agent Hub will suggest a workflow using your saved agents and this registry.</p>
        <TopologyGraph coreLabel="ANS Discovery" coreSublabel="Capability resolution" nodes={[{id:'directive',label:'Your directive',sublabel:'Describe an outcome',angle:225,radius:0.8},{id:'registry',label:'Agent registry',sublabel:'Browse capabilities',angle:45,radius:0.8,tone:'violet'}]}/>
        <p className="hint">Illustrative topology · search results appear in the registry panel.</p><Link className="btn btn-primary" href="/create" style={{marginTop:'auto'}}>Start composing <ArrowRight size={14}/></Link>
      </Card>
      <Card className="registry-panel"><CardHead badge={<Radar size={16}/>}>ANS capability resolution</CardHead>
        {error&&<div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div>}
        <section aria-label="Your saved agents"><h3 className="discover-section-title">Your saved agents</h3>
          {!loading&&!!saved.length&&<div className="search-bar fleet-search" style={{marginBottom:10}}>
            <Search size={16} aria-hidden="true"/>
            <label className="sr-only" htmlFor="hosted-saved-query">Search your saved agents</label>
            <input id="hosted-saved-query" placeholder="Search by name, capability, or id" value={savedQuery} onChange={e=>setSavedQuery(e.target.value)}/>
          </div>}
          {loading?<p role="status">Loading your agents…</p>:
            // Capped to roughly three rows so a growing saved list scrolls in place instead of
            // pushing "Search the live ANS registry" further down the page.
            <div className="registry-list registry-list-scroll">{visibleSaved.map(row)}</div>}
          {!loading&&!saved.length&&<p className="hint">No saved agents yet. <Link href="/agent-preview">Create an agent</Link> to use it in a workflow.</p>}
          {!loading&&!!saved.length&&!visibleSaved.length&&<p className="hint">No saved agents match that search.</p>}
        </section>
        <h3 className="discover-section-title">Search the live ANS registry</h3><p className="hint" style={{marginBottom:10}}>Queries the registry directly — no LLM key required. Up to 100 searches per UTC day.</p>
        <form className="search-bar" onSubmit={event=>{event.preventDefault();void search();}}><label className="sr-only" htmlFor="hosted-registry-query">Search ANS</label><input id="hosted-registry-query" value={query} maxLength={256} disabled={busy} onChange={e=>setQuery(e.target.value)} placeholder="Search for a capability"/><Button type="submit" variant="primary" disabled={busy}>{busy?'Searching…':<><Search size={14}/> Search</>}</Button></form>
        <p role="status" className="hint">{busy?'Searching the ANS registry…':searched?`${external.length} registry results shown.`:''}</p>
        <div className="registry-list" style={{marginTop:12}}>{external.map(row)}</div>
        {searched&&!busy&&!external.length&&!error&&<p className="empty">No matching active A2A agents. Try another capability.</p>}
        {hasMore&&<Button disabled={busy} onClick={()=>void search(true)}>Load more ANS results</Button>}
      </Card>
    </div>
    {/* Moved here from the dashboard: what other hosted members have published, distinct from
        the live ANS search above (this is other users' saved agents/workflows, not a registry). */}
    <Card style={{marginTop:20}}><CardHead>Discover public agents</CardHead>
      {publicAgentsError&&<div role="alert" className="alert"><strong>Something needs attention</strong><p>{publicAgentsError}</p></div>}
      {!publicAgentsError&&publicAgents===undefined&&<p className="hint">Loading…</p>}
      {!!publicAgents?.length&&<div className="search-bar fleet-search" style={{marginBottom:14}}>
        <Search size={16} aria-hidden="true"/>
        <label className="sr-only" htmlFor="hosted-public-query">Search public agents</label>
        <input id="hosted-public-query" placeholder="Search by name or description" value={publicQuery} onChange={e=>setPublicQuery(e.target.value)}/>
      </div>}
      {/* A horizontal scroller, not a wrapping grid: every public agent is here (the discover
          endpoint itself caps at 60), scrolled left/right instead of stacking into more rows. */}
      {!!visiblePublic.length&&<div className="discover-scroll">{visiblePublic.map(agent=><div className="discover-scroll-item" key={`${agent.kind}:${agent.id}`}><PublicAgentCard agent={agent}/></div>)}</div>}
      {publicAgents&&!publicAgents.length&&<p className="hint">No public agents published yet.</p>}
      {!!publicAgents?.length&&!visiblePublic.length&&<p className="hint">No public agents match that search.</p>}
    </Card>
  </PageShell>;
}
