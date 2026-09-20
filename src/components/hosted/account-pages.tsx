"use client";
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { useAccount } from '../../lib/hosted/use-account';
import { hostedApi } from '../../lib/hosted/browser';
import type { OwnedAgent } from '../../lib/owned-agent/templates';
import { templateFor } from '../../lib/owned-agent/templates';
import PageShell from '../layout/page-shell';
import PageHeader from '../layout/page-header';
import Card from '../ui/card';
type Run={id:string;agent_id:string;status:string;output:string|null;created_at:string};
export default function AccountPages({history=false}:{history?:boolean}){
  const account=useAccount();
  if(!account.ready)return <PageShell><p role="status">Loading account…</p></PageShell>;
  if(!account.session)return <PageShell narrow><PageHeader eyebrow="YOUR HOSTED WORKSPACE" title={history?'Your test history':'Your agents'} description="Sign in to access your private hosted workspace."/><Link href={`/login?next=${history?'/execution':'/agents'}`}>Sign in or create an account →</Link>{account.error&&<p role="alert">{account.error}</p>}</PageShell>;
  return <AccountData key={`${account.session.user.id}:${history}`} history={history}/>;
}
function AccountData({history}:{history:boolean}){
  const [agents,setAgents]=useState<OwnedAgent[]>([]),[runs,setRuns]=useState<Run[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let active=true;Promise.all([hostedApi<OwnedAgent[]>('agents'),history?hostedApi<Run[]>('tests'):Promise.resolve([])]).then(([agents,runs])=>{if(active){setAgents(agents);setRuns(runs);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[history]);
  return <PageShell><PageHeader eyebrow="YOUR HOSTED WORKSPACE" title={history?'Agent test history':'My Agents'} description={history?'Your latest 20 template tests and their saved results.':'Your private saved template agents. Open an agent to test it or create a new version.'} action={<Link href="/agent-preview">Create agent →</Link>}/>
    {loading&&<p role="status">Loading {history?'tests':'agents'}…</p>}{error&&<p role="alert">{error}</p>}
    {!loading&&!error&&(history?runs.length?runs.map(run=><Card key={run.id}><h2>{agents.find(a=>a.id===run.agent_id)?.name??'Agent test'}</h2><p>{new Date(run.created_at).toLocaleString()} · {run.status==='running'?'Pending or interrupted':run.status}</p>{run.output&&<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{run.output}</pre>}<Link href={`/agent-preview?agent=${run.agent_id}`}>Open agent →</Link></Card>):<p>No tests yet. Open an agent to run your first test.</p>:agents.length?agents.map(agent=><Card key={agent.id}><h2>{agent.name}</h2><p>{templateFor(agent.template).name} · Private · Not ANS registered</p><p>{agent.instructions||templateFor(agent.template).description}</p><Link href={`/agent-preview?agent=${agent.id}`}>Open and test →</Link></Card>):<p>No saved agents yet. Choose a template to create your first agent.</p>)}
  </PageShell>;
}
