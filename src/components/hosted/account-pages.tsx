"use client";
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { useAccount } from '../../lib/hosted/use-account';
import { hostedApi } from '../../lib/hosted/browser';
import type { OwnedAgent } from '../../lib/owned-agent/templates';
import PageShell from '../layout/page-shell';
import PageHeader from '../layout/page-header';
import Card from '../ui/card';
import Button from '../ui/button';
import PublicAgentCard, { type PublicAgentSummary } from './public-agent-card';
import HostedAgentCard from './hosted-agent-card';
import './hosted.css';
type Run={id:string;agent_id:string;status:string;output:string|null;created_at:string};
type Saved = PublicAgentSummary & { owner: { username: string; displayName: string; avatarUrl: string | null } };
export default function AccountPages({history=false}:{history?:boolean}){
  const account=useAccount();
  if(!account.ready)return <PageShell><p role="status">Loading account…</p></PageShell>;
  if(!account.session)return <PageShell narrow><PageHeader eyebrow="YOUR HOSTED WORKSPACE" title={history?'Your test history':'Your agents'} description="Sign in to access your private hosted workspace."/><Link href={`/login?next=${history?'/execution':'/agents'}`}>Sign in or create an account →</Link>{account.error&&<p role="alert">{account.error}</p>}</PageShell>;
  return <AccountData key={`${account.session.user.id}:${history}`} history={history}/>;
}
function AccountData({history}:{history:boolean}){
  const [agents,setAgents]=useState<OwnedAgent[]>([]),[runs,setRuns]=useState<Run[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState('');
  const [saved,setSaved]=useState<Saved[]>(),[savedError,setSavedError]=useState(''),[savedBusy,setSavedBusy]=useState('');
  // Runs are always fetched (not just in history mode): the My Agents cards use them for a
  // real per-agent run count, the same way the local fleet cards show a run count from stats.
  useEffect(()=>{let active=true;Promise.all([hostedApi<OwnedAgent[]>('agents'),hostedApi<Run[]>('tests')]).then(([agents,runs])=>{if(active){setAgents(agents);setRuns(runs);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[history]);
  useEffect(()=>{
    if(history)return;
    let active=true;
    hostedApi<Saved[]>('saved').then(data=>{if(active)setSaved(data);}).catch(reason=>{if(active)setSavedError(reason instanceof Error?reason.message:'Could not load saved agents');});
    return()=>{active=false;};
  },[history]);
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
  return <PageShell><PageHeader eyebrow="YOUR HOSTED WORKSPACE" title={history?'Agent test history':'My Agents'} description={history?'Your latest 20 template tests and their saved results.':'Your saved template agents. Publish one to make it discoverable to other members.'} action={<Link href="/agent-preview">Create agent →</Link>}/>
    {loading&&<p role="status">Loading {history?'tests':'agents'}…</p>}{error&&<p role="alert">{error}</p>}
    {!loading&&!error&&(history?runs.length?runs.map(run=><Card key={run.id}><h2>{agents.find(a=>a.id===run.agent_id)?.name??'Agent test'}</h2><p>{new Date(run.created_at).toLocaleString()} · {run.status==='running'?'Pending or interrupted':run.status}</p>{run.output&&<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{run.output}</pre>}<Link href={`/agent-preview?agent=${run.agent_id}`}>Open agent →</Link></Card>):<p>No tests yet. Open an agent to run your first test.</p>:agents.length?
      // Same fleet-grid + card layout as the local /agents page.
      <div className="fleet-grid">{agents.map(agent=><HostedAgentCard key={agent.id} agent={agent} runs={runs} busy={busy} onToggleVisibility={toggleVisibility}/>)}</div>
      :<p>No agents yet. Choose a template to create your first agent.</p>)}
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
