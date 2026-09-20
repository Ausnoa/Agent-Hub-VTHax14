"use client";
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAccount } from '../../lib/hosted/use-account';
import { hostedApi } from '../../lib/hosted/browser';
import { templateFor, type OwnedAgent } from '../../lib/owned-agent/templates';
import type { HostedWorkflow, HostedRun } from '../../lib/hosted/workflow-contracts';
import PageShell from '../layout/page-shell';
import PageHeader from '../layout/page-header';
import Card, { CardHead } from '../ui/card';
import Button from '../ui/button';
import StatusPill from '../ui/status-pill';
import Avatar from './avatar';
import './hosted.css';
import './workflows.css';

type Owner = { userId: string; username: string; displayName: string; avatarUrl: string | null };
type Agent = { kind: 'template'; value: OwnedAgent } | { kind: 'workflow'; value: HostedWorkflow };

export default function AgentDetailPage() {
  const account = useAccount();
  const params = useParams<{ id: string }>();
  const id = params.id;
  if (!account.ready) return <PageShell><p role="status">Loading…</p></PageShell>;
  if (!account.configured) return <PageShell narrow><PageHeader eyebrow="AGENT" title="Agent detail" description="Hosted accounts are not configured yet." /></PageShell>;
  if (!account.session) return <PageShell narrow><PageHeader eyebrow="AGENT" title="Agent detail" description="Sign in to view and launch this agent." /><Link href={`/login?next=/agents/${id}`}>Sign in or create an account →</Link>{account.error && <p role="alert">{account.error}</p>}</PageShell>;
  return <Detail key={`${account.session.user.id}:${id}`} id={id} myId={account.session.user.id} />;
}

function Detail({ id, myId }: { id: string; myId: string }) {
  const [agent, setAgent] = useState<Agent>();
  const [owner, setOwner] = useState<Owner>();
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  async function save() {
    if (!agent) return;
    try { await hostedApi('saved', { kind: agent.kind, agentId: id }); setSaved(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this agent'); }
  }
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let found: Agent;
        try { found = { kind: 'template', value: await hostedApi<OwnedAgent>(`agents/${id}`) }; }
        catch { found = { kind: 'workflow', value: await hostedApi<HostedWorkflow>(`workflows/${id}`) }; }
        if (!active) return;
        setAgent(found);
        // The owner byline is decoration, and an account that predates the profile
        // trigger has no profile row. Keep its lookup out of the agent's own failure
        // path so a missing profile cannot hide an agent that loaded fine.
        const ownerId = found.kind === 'template' ? found.value.ownerId : found.value.owner_id;
        try { const profile = await hostedApi<Owner>(`profiles/by-id/${ownerId}`); if (active) setOwner(profile); } catch { /* render without the byline */ }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Could not load this agent'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id]);

  if (loading) return <PageShell><p role="status">Loading agent…</p></PageShell>;
  if (error || !agent) return <PageShell><div role="alert" className="alert"><strong>Something needs attention</strong><p>{error || 'Agent not found'}</p></div></PageShell>;

  const ownerId = agent.kind === 'template' ? agent.value.ownerId : agent.value.owner_id;
  const mine = ownerId === myId;
  const visibility = agent.value.visibility;
  const name = agent.kind === 'template' ? agent.value.name : agent.value.definition.name;
  const description = agent.kind === 'template'
    ? (agent.value.instructions || templateFor(agent.value.template).description)
    : (agent.value.definition.description || `${agent.value.definition.steps.length} connected agents`);

  return <PageShell>
    <PageHeader eyebrow={agent.kind === 'workflow' ? 'COMPOSITE WORKFLOW' : 'TEMPLATE AGENT'} title={name} description={description}
      action={<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <StatusPill tone={visibility === 'public' ? 'green' : 'neutral'}>{visibility === 'public' ? 'Public' : 'Private'}</StatusPill>
        {mine && <Link href={agent.kind === 'template' ? `/agent-preview?agent=${id}` : `/create?workflow=${id}`}>Edit →</Link>}
        {!mine && <Button size="sm" disabled={saved} onClick={() => void save()}>{saved ? 'Saved' : 'Save'}</Button>}
      </div>} />
    {owner && <Link href={`/profile/${owner.username}`} className="discover-card-owner">
      <Avatar url={owner.avatarUrl} name={owner.displayName || owner.username} />
      <span>Created by {owner.displayName || `@${owner.username}`}</span>
    </Link>}
    {agent.kind === 'workflow' && <Card><CardHead>How this composite works</CardHead>
      <div style={{ display: 'grid', gap: 10 }}>
        {agent.value.definition.steps.map((step, index) => <div className="registry-item" key={index}>
          <span className="registry-item-icon">{index + 1}</span>
          <div style={{ minWidth: 0, flex: 1 }}><h3>{step.name}</h3><p className="mono">{step.skill}</p></div>
          <StatusPill tone={step.agentId.startsWith('template:') ? 'accent' : 'violet'}>{step.agentId.startsWith('template:') ? 'Platform template' : 'Discovered via ANS'}</StatusPill>
        </div>)}
      </div>
    </Card>}
    {mine
      ? <p className="hint">This is one of your agents. Edit it from your own workspace using the link above.</p>
      : <p className="hint">Launching this agent does not give you ownership or edit access — it stays {owner?.displayName || (owner ? `@${owner.username}` : 'its owner')}&rsquo;s agent.</p>}
    {agent.kind === 'template' ? <TemplateLaunch id={id} template={agent.value.template} /> : <WorkflowLaunch workflow={agent.value} />}
  </PageShell>;
}

function TemplateLaunch({ id, template }: { id: string; template: OwnedAgent['template'] }) {
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [output, setOutput] = useState(''), [error, setError] = useState('');
  async function run() {
    setBusy(true); setError(''); setOutput('');
    try { const result = await hostedApi<{ output: string }>(`agents/${id}/test`, { text }); setOutput(result.output); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not run this agent'); }
    finally { setBusy(false); }
  }
  return <Card><CardHead>Try it</CardHead>
    <form className="hosted-form" onSubmit={(event) => { event.preventDefault(); void run(); }}>
      <label>{template === 'qa' ? 'Question and reference text' : 'Source text'}<textarea value={text} maxLength={12000} required disabled={busy} onChange={(event) => setText(event.target.value)} /></label>
      <Button variant="primary" type="submit" disabled={busy || !text.trim()}>{busy ? 'Running…' : 'Run'}</Button>
    </form>
    {error && <p role="alert">{error}</p>}
    {output && <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: 16, background: 'var(--bg-inset)' }}>{output}</pre>}
  </Card>;
}

function WorkflowLaunch({ workflow }: { workflow: HostedWorkflow }) {
  const active = useRef(true);
  const [source, setSource] = useState(''), [inputFormat, setInputFormat] = useState<'text' | 'json'>('text'), [confirmed, setConfirmed] = useState(false);
  const [run, setRun] = useState<HostedRun>(), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const requestKey = useRef<{ key: string; id: string } | undefined>(undefined);
  async function advance(current: HostedRun) {
    while (active.current && current.status === 'ready') {
      current = await hostedApi<HostedRun>(`workflows/runs/${current.id}/advance`, { expectedStep: current.outputs.length, confirmExternalExecution: true });
      if (active.current) setRun(current);
    }
  }
  async function start() {
    if (!confirmed) return;
    setBusy(true); setError('');
    try {
      const input = inputFormat === 'text' ? { type: 'text' as const, value: source } : { type: 'json' as const, value: JSON.parse(source) };
      const key = JSON.stringify([workflow.id, input]); if (requestKey.current?.key !== key) requestKey.current = { key, id: crypto.randomUUID() };
      const current = await hostedApi<HostedRun>(`workflows/${workflow.id}/invoke`, { requestId: requestKey.current.id, input, confirmExternalExecution: true });
      setRun(current); await advance(current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not run this workflow'); }
    finally { setBusy(false); }
  }
  return <Card><CardHead>Run this workflow</CardHead>
    <label>Input type<select disabled={busy} value={inputFormat} onChange={(event) => { setInputFormat(event.target.value as 'text' | 'json'); setConfirmed(false); }}><option value="text">Text</option><option value="json">JSON object</option></select></label>
    <label>Workflow input<textarea disabled={busy} value={source} maxLength={12000} onChange={(event) => { setSource(event.target.value); setConfirmed(false); }} /></label>
    <label className="hosted-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} />I reviewed these steps and authorize sending this input and intermediate outputs to the selected agents, including any actions they perform.</label>
    <Button variant="primary" disabled={busy || !source.trim() || !confirmed || Boolean(run)} onClick={() => void start()}>{busy ? 'Working…' : 'Run workflow'}</Button>
    {error && <p role="alert">{error}</p>}
    {run && <div className="hosted-run"><p role="status">{run.status} · {run.outputs.length} completed steps</p>{run.error && <p role="alert">{run.error}</p>}{run.outputs.map((output, index) => <details key={index} open={index === run.outputs.length - 1}><summary>Step {index + 1} output</summary><pre>{typeof output.value === 'string' ? output.value : JSON.stringify(output.value, null, 2)}</pre></details>)}</div>}
    {run && ['completed', 'failed'].includes(run.status) && <Button disabled={busy} onClick={() => { requestKey.current = undefined; setRun(undefined); setConfirmed(false); }}>Run again</Button>}
  </Card>;
}
