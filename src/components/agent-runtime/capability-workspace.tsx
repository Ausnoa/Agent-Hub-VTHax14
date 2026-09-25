'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAccount } from '../../lib/hosted/use-account';
import PageShell from '../layout/page-shell';
import CapabilityComposer from './capability-composer';
import { useAnnounceAgent } from './capability-profile';
import type { CapabilityAgent } from './capability-runner';
import './capability-workspace.css';

/** Descriptions handed over from other entry points (fleet directive, Compose, legacy composer). */
const draftKeys = ['general-workflow-description', 'stitch-workflow-directive'];

// /create: the one place agents are created. The result is saved, pops out as a cat, joins the
// fleet, and opens on its profile with the specialist-designed interface.
export default function CreateAgentPage() {
  const [local, setLocal] = useState<boolean>();
  useEffect(() => setLocal(['localhost', '127.0.0.1'].includes(location.hostname) && !new URLSearchParams(location.search).has('hosted')), []);
  if (local === undefined) return <PageShell><p>Loading workspace…</p></PageShell>;
  return local ? <CreateWorkspace local /> : <HostedCreate />;
}
function HostedCreate() {
  const account = useAccount();
  if (!account.ready) return <PageShell><p>Loading account…</p></PageShell>;
  if (!account.session) return <PageShell><h1>Create an agent</h1><Link href="/login?next=/create">Sign in to continue →</Link></PageShell>;
  return <CreateWorkspace key={account.session.user.id} local={false} />;
}
function CreateWorkspace({ local }: { local: boolean }) {
  const router = useRouter();
  const announce = useAnnounceAgent(local);
  const [initial, setInitial] = useState('');
  useEffect(() => {
    try {
      const key = draftKeys.find(k => sessionStorage.getItem(k));
      if (key) { setInitial(sessionStorage.getItem(key)!.slice(0, 2000)); sessionStorage.removeItem(key); }
    } catch { /* drafts are a convenience only */ }
  }, []);
  function saved(agent: CapabilityAgent) {
    announce(agent);
    router.push(`/agents/${agent.id}`);
  }
  return <PageShell className="capability-workspace">
    <header className="compose-hero"><div className="eyebrow">GLORRIA · CREATE AN AGENT</div><h1>Describe an agent. Make it yours.</h1>
      <p>Glorria finds matching agents on ANS, fills supported gaps with Gemini, and designs an interface around what your agent can actually do.</p></header>
    <CapabilityComposer local={local} initialDescription={initial} onSaved={saved} />
    <p className="hint capability-advanced">Advanced: <Link href="/general">hand-pick agents in the workflow builder</Link> · <Link href="/agent-preview">single-skill template builder</Link>{local && <> · <Link href="/create/report">report composer demo</Link></>}</p>
  </PageShell>;
}
