"use client";
import { useEffect,useMemo,useState } from 'react';
import Link from 'next/link';
import { Plus,Search } from 'lucide-react';
import { useAccount } from '../../lib/hosted/use-account';
import { hostedApi } from '../../lib/hosted/browser';
import { templateFor,type OwnedAgent } from '../../lib/owned-agent/templates';
import PageShell from '../layout/page-shell';
import PageHeader from '../layout/page-header';
import Card from '../ui/card';
import Button from '../ui/button';
import PublicAgentCard, { type PublicAgentSummary } from './public-agent-card';
import HostedAgentCard from './hosted-agent-card';
import FleetOverview from '../agent-hub/fleet-overview';
import './hosted.css';
import {ArchiveButton,ArchivedItems} from './archive-controls';
type Run={id:string;agent_id:string;status:string;output:string|null;created_at:string};
type Saved = PublicAgentSummary & { owner: { username: string; displayName: string; avatarUrl: string | null } };
export default function AccountPages({history=false}:{history?:boolean}){
  const account=useAccount();
  if(!account.ready)return <PageShell><p role="status">Loading account…</p></PageShell>;
  if(!account.session)return <PageShell narrow><PageHeader headingLevel={history?1:2} eyebrow="YOUR HOSTED WORKSPACE" title={history?'Your test history':'Your agents'} description="Sign in to access your private hosted workspace."/><Link href={`/login?next=${history?'/execution':'/agents'}`}>Sign in or create an account →</Link>{account.error&&<p role="alert">{account.error}</p>}</PageShell>;
  return <AccountData key={`${account.session.user.id}:${history}`} history={history}/>;
}
function AccountData({history}:{history:boolean}){
  const [agents,setAgents]=useState<OwnedAgent[]>([]),[runs,setRuns]=useState<Run[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState('');
  const [saved,setSaved]=useState<Saved[]>(),[savedError,setSavedError]=useState(''),[savedBusy,setSavedBusy]=useState('');
  const [query,setQuery]=useState(''),[templateFilter,setTemplateFilter]=useState('all');
  // Runs are always fetched (not just in history mode): the My Agents cards use them for a
  // real per-agent run count, the same way the local fleet cards show a run count from stats.
  useEffect(()=>{let active=true;Promise.all([hostedApi<OwnedAgent[]>('agents'),hostedApi<Run[]>('tests')]).then(([agents,runs])=>{if(active){setAgents(agents);setRuns(runs);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[history]);
  useEffect(()=>{
    if(history)return;
    let active=true;
    hostedApi<Saved[]>('saved').then(data=>{if(active)setSaved(data);}).catch(reason=>{if(active)setSavedError(reason instanceof Error?reason.message:'Could not load saved agents');});
    return()=>{active=false;};
  },[history]);
  async function refreshAgents(){setAgents(await hostedApi<OwnedAgent[]>('agents'));}
  async function toggleVisibility(agentId:string,next:'public'|'private'){
    setBusy(agentId);
    try{const updated=await hostedApi<OwnedAgent>(`agents/${agentId}/visibility`,{visibility:next});setAgents(old=>old.map(a=>a.id===agentId?updated:a));}
    catch(e){setError(e instanceof Error?e.message:'Could not update visibility');}
    finally{setBusy('');}
  }
  async function removeSaved(agent:Saved){
    const key=`${agent.kind}:${agent.id}`;
    setSavedBusy(key);
    try{await hostedApi(`saved/${agent.kind}/${agent.id}`,undefined,'DELETE');setSaved(old=>old?.filter(item=>`${item.kind}:${item.id}`!==key));}
    catch(reason){setSavedError(reason instanceof Error?reason.message:'Could not remove this bookmark');}
    finally{setSavedBusy('');}
  }
  // Same search + capability-chip pattern as the local fleet page, but the "capability" here is
  // one of the three fixed templates instead of an open-ended A2A capability set.
  const usedTemplates=useMemo(()=>Array.from(new Set(agents.map(a=>a.template))),[agents]);
  const filteredAgents=useMemo(()=>{
    const term=query.trim().toLowerCase();
    return agents.filter(agent=>{
      const matchesTemplate=templateFilter==='all'||agent.template===templateFilter;
      const t=templateFor(agent.template);
      const matchesQuery=!term||agent.name.toLowerCase().includes(term)||agent.instructions.toLowerCase().includes(term)||t.name.toLowerCase().includes(term)||t.skill.toLowerCase().includes(term)||agent.id.toLowerCase().includes(term);
      return matchesTemplate&&matchesQuery;
    });
  },[agents,query,templateFilter]);
  return <PageShell>{!history&&<FleetOverview hosted/>}<PageHeader headingLevel={history?1:2} eyebrow="YOUR HOSTED WORKSPACE" title={history?'Agent test history':'Your agent fleet'} description={history?'Your latest 20 template tests and their saved results.':'Your saved template agents. Publish one to make it discoverable to other members.'} action={<Link href="/agent-preview"><Button variant="primary"><Plus size={14}/> Create agent</Button></Link>}/>
    {loading&&<p role="status">Loading {history?'tests':'agents'}…</p>}{error&&<p role="alert">{error}</p>}
    {!history&&!loading&&!error&&!!agents.length&&<section className="fleet-toolbar" aria-label="Filter your agents">
      <div className="search-bar fleet-search">
        <Search size={16} aria-hidden="true"/>
        <label className="sr-only" htmlFor="hosted-fleet-search">Search agents</label>
        <input id="hosted-fleet-search" placeholder="Search by agent name, template, or id" value={query} onChange={e=>setQuery(e.target.value)}/>
      </div>
      <div className="filter-bar">
        <button aria-pressed={templateFilter==='all'} className={`filter-chip${templateFilter==='all'?' active':''}`} onClick={()=>setTemplateFilter('all')}>All ({agents.length})</button>
        {usedTemplates.map(id=><button aria-pressed={templateFilter===id} key={id} className={`filter-chip${templateFilter===id?' active':''}`} onClick={()=>setTemplateFilter(id)}>{templateFor(id).name}</button>)}
      </div>
    </section>}
    {!loading&&!error&&(history?runs.length?runs.map(run=><Card key={run.id}><h2>{agents.find(a=>a.id===run.agent_id)?.name??'Agent test'}</h2><p>{new Date(run.created_at).toLocaleString()} · {run.status==='running'?'Pending or interrupted':run.status}</p>{run.output&&<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{run.output}</pre>}<Link href={`/agent-preview?agent=${run.agent_id}`}>Open agent →</Link></Card>):<p>No tests yet. Open an agent to run your first test.</p>:agents.length?
      // Same fleet-grid + card layout, and the same search/filter behavior, as the local /agents page.
      <>
        <div className="fleet-grid">{filteredAgents.map(agent=><HostedAgentCard key={agent.id} agent={agent} runs={runs} busy={busy} onToggleVisibility={toggleVisibility} onArchived={()=>void refreshAgents()}/>)}</div>
        {!filteredAgents.length&&<p className="empty">No agents match that search.</p>}
      </>
      :<p>No agents yet. Choose a template to create your first agent.</p>)}
    {!history&&<ArchivedItems kind="agents" onChanged={()=>void refreshAgents()}/>}
    {!history&&<section id="saved" style={{marginTop:32}}>
      <h2>Saved agents</h2>
      <p className="hint">Public agents you&apos;ve bookmarked from Discover.</p>
      {savedError&&<div role="alert" className="alert"><strong>Something needs attention</strong><p>{savedError}</p></div>}
      {!saved&&!savedError&&<p className="hint">Loading…</p>}
      {saved&&!saved.length&&<p className="empty">Nothing saved yet. <Link href="/discover">Browse Discover →</Link></p>}
      {!!saved?.length&&<div className="discover-grid">
        {saved.map(agent=><PublicAgentCard key={`${agent.kind}:${agent.id}`} agent={agent} footer={
          <p className="discover-card-owner"><span>By {agent.owner.displayName||`@${agent.owner.username}`}</span></p>
        } aside={<Button size="sm" disabled={savedBusy===`${agent.kind}:${agent.id}`} onClick={()=>void removeSaved(agent)}>{savedBusy===`${agent.kind}:${agent.id}`?'Removing…':'Remove'}</Button>}/>)}
      </div>}
    </section>}
  </PageShell>;
}
