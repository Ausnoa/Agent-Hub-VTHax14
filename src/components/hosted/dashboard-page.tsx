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

export default function DashboardPage() {
  const account = useAccount();
  if (!account.ready) return <PageShell><p role="status">Loading…</p></PageShell>;
  if (!account.configured) return <PageShell narrow><PageHeader eyebrow="DASHBOARD" title="Dashboard" description="Hosted accounts are not configured yet." /></PageShell>;
  if (!account.session) return <PageShell narrow><PageHeader eyebrow="DASHBOARD" title="Dashboard" description="Sign in to see your agents and discover what others have published." /><Link href="/login?next=/dashboard">Sign in or create an account →</Link>{account.error && <p role="alert">{account.error}</p>}</PageShell>;
  return <DashboardBody key={account.session.user.id} />;
}

function DashboardBody() {
  const [templates, setTemplates] = useState<OwnedAgent[]>(), [workflows, setWorkflows] = useState<HostedWorkflow[]>();
  const [saved, setSaved] = useState<PublicAgentSummary[]>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([hostedApi<OwnedAgent[]>('agents'), hostedApi<HostedWorkflow[]>('workflows'), hostedApi<PublicAgentSummary[]>('saved')])
      .then(([templateData, workflowData, savedData]) => { if (active) { setTemplates(templateData); setWorkflows(workflowData); setSaved(savedData.slice(0, 4)); } })
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
    <Card><CardHead>Your recent agents</CardHead>
      {!myAgents.length && <p className="empty">No agents yet. <Link href="/agent-preview">Create your first one →</Link></p>}
      {!!myAgents.length && <div className="discover-grid">{myAgents.map((agent) => <PublicAgentCard key={`${agent.kind}:${agent.id}`} agent={agent} />)}</div>}
    </Card>
  </PageShell>;
}
