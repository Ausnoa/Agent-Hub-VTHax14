"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount } from '../../lib/hosted/use-account';
import { hostedApi } from '../../lib/hosted/browser';
import PageShell from '../layout/page-shell';
import PageHeader from '../layout/page-header';
import Button from '../ui/button';
import PublicAgentCard, { type PublicAgentSummary } from './public-agent-card';
import './hosted.css';

type Saved = PublicAgentSummary & { owner: { username: string; displayName: string; avatarUrl: string | null } };

export default function SavedPage() {
  const account = useAccount();
  if (!account.ready) return <PageShell><p role="status">Loading…</p></PageShell>;
  if (!account.configured) return <PageShell narrow><PageHeader eyebrow="SAVED" title="Saved agents" description="Hosted accounts are not configured yet." /></PageShell>;
  if (!account.session) return <PageShell narrow><PageHeader eyebrow="SAVED" title="Saved agents" description="Sign in to bookmark public agents for later." /><Link href="/login?next=/saved">Sign in or create an account →</Link>{account.error && <p role="alert">{account.error}</p>}</PageShell>;
  return <SavedList key={account.session.user.id} />;
}

function SavedList() {
  const [agents, setAgents] = useState<Saved[]>();
  const [error, setError] = useState(''), [busy, setBusy] = useState('');
  useEffect(() => {
    let active = true;
    hostedApi<Saved[]>('saved').then((data) => { if (active) setAgents(data); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load saved agents'); });
    return () => { active = false; };
  }, []);
  async function remove(agent: Saved) {
    const key = `${agent.kind}:${agent.id}`;
    setBusy(key);
    try { await hostedApi(`saved/${agent.kind}/${agent.id}`, undefined, 'DELETE'); setAgents((old) => old?.filter((item) => `${item.kind}:${item.id}` !== key)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not remove this bookmark'); }
    finally { setBusy(''); }
  }
  return <PageShell>
    <PageHeader eyebrow="SAVED" title="Saved agents" description="Public agents you've bookmarked from Discover." />
    {error && <div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div>}
    {!agents && !error && <p className="hint">Loading…</p>}
    {agents && !agents.length && <p className="empty">Nothing saved yet. <Link href="/discover">Browse Discover →</Link></p>}
    {!!agents?.length && <div className="discover-grid">
      {agents.map((agent) => <PublicAgentCard key={`${agent.kind}:${agent.id}`} agent={agent} footer={
        <p className="discover-card-owner"><span>By {agent.owner.displayName || `@${agent.owner.username}`}</span></p>
      } aside={<Button size="sm" disabled={busy === `${agent.kind}:${agent.id}`} onClick={() => void remove(agent)}>{busy === `${agent.kind}:${agent.id}` ? 'Removing…' : 'Remove'}</Button>} />)}
    </div>}
  </PageShell>;
}
