"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAccount } from '../../lib/hosted/use-account';
import { hostedApi } from '../../lib/hosted/browser';
import PageShell from '../layout/page-shell';
import PageHeader from '../layout/page-header';
import Card from '../ui/card';
import StatusPill from '../ui/status-pill';
import Avatar from './avatar';
import './hosted.css';

type PublicAgent = { kind: 'template' | 'workflow'; id: string; name: string; description: string; createdAt: string; owner: { userId: string; username: string; displayName: string; avatarUrl: string | null } };

export default function DiscoveryPage() {
  const account = useAccount();
  if (!account.ready) return <PageShell><p role="status">Loading…</p></PageShell>;
  if (!account.configured) return <PageShell narrow><PageHeader eyebrow="DISCOVER" title="Discover agents" description="Hosted accounts are not configured yet." /></PageShell>;
  if (!account.session) return <PageShell narrow><PageHeader eyebrow="DISCOVER" title="Discover agents" description="Sign in to browse public agents made by other members." /><Link href="/login?next=/discover">Sign in or create an account →</Link>{account.error && <p role="alert">{account.error}</p>}</PageShell>;
  return <DiscoveryList key={account.session.user.id} />;
}

function DiscoveryList() {
  const [agents, setAgents] = useState<PublicAgent[]>();
  const [query, setQuery] = useState(''), [kind, setKind] = useState<'all' | 'template' | 'workflow'>('all');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    hostedApi<PublicAgent[]>(`discover?query=${encodeURIComponent(query)}`)
      .then((data) => { if (active) setAgents(data); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load Discover'); });
    return () => { active = false; };
  }, [query]);
  const shown = useMemo(() => agents?.filter((agent) => kind === 'all' || agent.kind === kind), [agents, kind]);

  return <PageShell>
    <PageHeader eyebrow="DISCOVER" title="Discover agents" description="Browse public agents published by other members. Using one never gives you ownership or edit rights over it." />
    {error && <div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div>}
    <div className="search-bar" style={{ marginBottom: 16 }}>
      <label className="sr-only" htmlFor="discover-search">Search public agents</label>
      <input id="discover-search" placeholder="Search public agents" value={query} maxLength={256} onChange={(event) => setQuery(event.target.value)} />
    </div>
    <div className="filter-bar" style={{ marginBottom: 16 }}>
      {(['all', 'template', 'workflow'] as const).map((option) => <button key={option} aria-pressed={kind === option} className={`filter-chip${kind === option ? ' active' : ''}`} onClick={() => setKind(option)}>{option === 'all' ? 'All' : option === 'template' ? 'Templates' : 'Composite workflows'}</button>)}
    </div>
    {!agents && !error && <p className="hint">Loading public agents…</p>}
    {shown && !!shown.length && <div className="discover-grid">
      {shown.map((agent) => <Card key={`${agent.kind}:${agent.id}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <h2 style={{ margin: 0 }}>{agent.name}</h2>
          <StatusPill tone={agent.kind === 'workflow' ? 'violet' : 'accent'}>{agent.kind === 'workflow' ? 'Composite' : 'Template'}</StatusPill>
        </div>
        <p>{agent.description}</p>
        <Link href={`/profile/${agent.owner.username}`} className="discover-card-owner">
          <Avatar url={agent.owner.avatarUrl} name={agent.owner.displayName || agent.owner.username} small />
          <span>{agent.owner.displayName || `@${agent.owner.username}`}</span>
        </Link>
        <p><Link href={`/agents/${agent.id}`}>Open agent →</Link></p>
      </Card>)}
    </div>}
    {shown && !shown.length && <p className="empty">No public agents match yet. Publish one from My Agents to be the first.</p>}
  </PageShell>;
}
