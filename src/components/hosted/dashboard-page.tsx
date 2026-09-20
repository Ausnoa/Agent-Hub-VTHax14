"use client";
import { useEffect, useState } from 'react';
import AnsShowcase from "./ans-showcase";
import Link from 'next/link';
import { useAccount } from '../../lib/hosted/use-account';
import { hostedApi } from '../../lib/hosted/browser';
import type { OwnedAgent } from '../../lib/owned-agent/templates';
import type { HostedWorkflow } from '../../lib/hosted/workflow-contracts';
import PageShell from '../layout/page-shell';
import PageHeader from '../layout/page-header';
import Card, { CardHead } from '../ui/card';
import MetricTile from '../ui/metric-tile';
import PublicAgentCard, { type PublicAgentSummary } from './public-agent-card';
import './hosted.css';
import WorkflowGraph from './workflow-graph';
import {showcaseDraft,showcaseAgents} from '../../lib/hosted/showcase';

export default function DashboardPage() {
  const account = useAccount();
  if (!account.ready) return <PageShell><p role="status">Loading…</p></PageShell>;
  if (!account.configured) return <PageShell narrow><PageHeader eyebrow="DASHBOARD" title="Dashboard" description="Hosted accounts are not configured yet." /></PageShell>;
  if (!account.session) return <PageShell narrow><PageHeader eyebrow="DASHBOARD" title="Dashboard" description="Sign in to see your agents and discover what others have published." /><Link href="/login?next=/dashboard">Sign in or create an account →</Link>{account.error && <p role="alert">{account.error}</p>}</PageShell>;
  return <DashboardBody key={account.session.user.id} />;
}

function DashboardBody() {
  const [templates, setTemplates] = useState<OwnedAgent[]>(), [workflows, setWorkflows] = useState<HostedWorkflow[]>();
  const [discover, setDiscover] = useState<PublicAgentSummary[]>(), [saved, setSaved] = useState<PublicAgentSummary[]>();
  const [error, setError] = useState('');
  const [graphId,setGraphId]=useState('demo');
  const graphWorkflow=workflows?.find(w=>w.id===graphId);
  const graphSteps=graphWorkflow?.definition.steps??showcaseDraft('all')!.steps;
  const graphNames=graphWorkflow?.definition.steps.map(s=>s.name)??graphSteps.map(s=>showcaseAgents.find(a=>a.id===s.agentId)!.name);
  const graphUrl=graphWorkflow?`/create?workflow=${graphWorkflow.id}`:'/create?showcase=all';
  useEffect(() => {
    let active = true;
    Promise.all([hostedApi<OwnedAgent[]>('agents'), hostedApi<HostedWorkflow[]>('workflows'), hostedApi<PublicAgentSummary[]>('discover?query='), hostedApi<PublicAgentSummary[]>('saved')])
      .then(([templateData, workflowData, discoverData, savedData]) => { if (active) { setTemplates(templateData); setWorkflows(workflowData); setDiscover(discoverData.slice(0, 4)); setSaved(savedData.slice(0, 4)); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load your dashboard'); });
    return () => { active = false; };
  }, []);

  const myAgents: PublicAgentSummary[] = [
    ...(templates ?? []).map((agent) => ({ kind: 'template' as const, id: agent.id, name: agent.name, description: agent.instructions || '' })),
    ...(workflows ?? []).map((workflow) => ({ kind: 'workflow' as const, id: workflow.id, name: workflow.definition.name, description: workflow.definition.description })),
  ].slice(0, 4);
  const publicCount = (templates?.filter((agent) => agent.visibility === 'public').length ?? 0) + (workflows?.filter((workflow) => workflow.visibility === 'public').length ?? 0);

  return <PageShell>
    <PageHeader eyebrow="DASHBOARD" title="Your dashboard" description="Manage your agents and discover what other members have published." />
    <AnsShowcase />
    {error && <div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div>}
    <div className="metric-row">
      <MetricTile label="Your agents" value={String((templates?.length ?? 0) + (workflows?.length ?? 0))} />
      <MetricTile label="Published public" value={String(publicCount)} />
      <MetricTile label="Saved agents" value={String(saved?.length ?? 0)} />
    </div>
    <nav className="filter-bar" style={{ marginBottom: 24 }} aria-label="Dashboard shortcuts">
      <Link className="filter-chip" href="/discover">Discover agents</Link>
      <Link className="filter-chip" href="/agents">My agents</Link>
      <Link className="filter-chip" href="/agent-preview">Create agent</Link>
      <Link className="filter-chip" href="/agents#saved">Saved agents</Link>
      <Link className="filter-chip" href="/profile/settings">Profile</Link>
    </nav>
    <Card className="dashboard-workflow" style={{marginBottom:24}}><CardHead>Workflow graph</CardHead>
      <p className="hint">Explore how input moves between agents. Select a step to open it in Compose.</p>
      <label htmlFor="dashboard-workflow-select" style={{display:'block',margin:'16px 0 8px'}}>Show workflow</label>
      <select id="dashboard-workflow-select" value={graphId} onChange={event=>setGraphId(event.target.value)} style={{maxWidth:'100%',padding:12,background:'var(--bg-inset)',color:'var(--text)',border:'1px solid var(--border-strong)',borderRadius:10}}>
        <option value="demo">Three-agent demo · Example</option>{workflows?.map(w=><option key={w.id} value={w.id}>{w.definition.name}</option>)}
      </select>
      <WorkflowGraph steps={graphSteps} names={graphNames} editUrl={graphUrl}/>
      <p className="hint">{graphWorkflow?'Saved workflow structure.':'Example: Extract → Brief → Answers. Answers uses the original menu for evidence.'} This view does not start a run or show live execution status.</p>
      <Link className="btn btn-primary" href={graphUrl}>Open in Compose →</Link>
    </Card>
    <Card><CardHead>Your recent agents</CardHead>
      {!myAgents.length && <p className="empty">No agents yet. <Link href="/agent-preview">Create your first one →</Link></p>}
      {!!myAgents.length && <div className="discover-grid">{myAgents.map((agent) => <PublicAgentCard key={`${agent.kind}:${agent.id}`} agent={agent} />)}</div>}
    </Card>
    <Card style={{ marginTop: 20 }}><CardHead>Discover public agents</CardHead>
      {!discover?.length && <p className="hint">Loading…</p>}
      {!!discover?.length && <div className="discover-grid">{discover.map((agent) => <PublicAgentCard key={`${agent.kind}:${agent.id}`} agent={agent} />)}</div>}
      <p><Link href="/discover">Browse all public agents →</Link></p>
    </Card>
  </PageShell>;
}
