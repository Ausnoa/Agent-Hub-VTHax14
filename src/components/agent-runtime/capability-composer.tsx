'use client';

import { useEffect, useRef, useState } from 'react';
import type { GeneralWorkflow } from '../../lib/general/contracts';
import type { HostedWorkflow } from '../../lib/hosted/workflow-contracts';
import type { CapabilityProposal } from '../../lib/capabilities/store';
import Card from '../ui/card';
import Button from '../ui/button';
import StatusPill from '../ui/status-pill';
import { hostedAgent, localAgent, stepSource, useAgentRequest, type CapabilityAgent } from './capability-runner';

// Creation and enhancement share one path: requested capability → ANS discovery → Gemini
// fallback where eligible → composition → specialist-designed interface → review → save.
export default function CapabilityComposer({ local, base, initialDescription = '', onSaved }: {
  local: boolean;
  /** Present when enhancing a saved agent; its steps are preserved and new ones appended. */
  base?: CapabilityAgent;
  initialDescription?: string;
  onSaved: (agent: CapabilityAgent) => void;
}) {
  const request = useAgentRequest(local);
  const [configured, setConfigured] = useState<boolean>();
  const [description, setDescription] = useState(initialDescription), [addition, setAddition] = useState('');
  const [proposal, setProposal] = useState<CapabilityProposal>();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const active = useRef(true);
  useEffect(() => { active.current = true; request<{ configured: boolean }>('capabilities').then(c => { if (active.current) setConfigured(c.configured); }).catch(e => { if (active.current) setError(e.message); }); return () => { active.current = false; }; }, [request]);
  useEffect(() => { if (initialDescription) setDescription(initialDescription); }, [initialDescription]);

  async function work(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Request failed'); }
    finally { if (active.current) setBusy(false); }
  }
  const plan = (text: string) => work(async () => {
    const result = await request<CapabilityProposal>('capabilities/plan', { description: text, ...(proposal ? { proposalId: proposal.id } : base ? { baseId: base.id } : {}) });
    if (active.current) { setProposal(result); setAddition(''); }
  });
  const save = () => work(async () => {
    if (!proposal) return;
    const saved = local ? localAgent(await request<GeneralWorkflow>('capabilities/save', { proposalId: proposal.id })) : hostedAgent(await request<HostedWorkflow>('capabilities/save', { proposalId: proposal.id }));
    if (active.current) { setProposal(undefined); onSaved(saved); }
  });

  const draft = proposal?.definition;
  const suggestions = draft?.capability?.suggestions ?? base?.capability?.suggestions ?? [];
  const blocked = busy || configured !== true;
  return <>
    {configured === false && <Card><h2>Gemini setup needed</h2><p>Configure GEMINI_API_KEY and GEMINI_MODEL on the server to create or enhance agents.{local ? '' : ' Hosted generation also requires execution to be enabled.'} Existing agents keep working.</p></Card>}
    {error && <p role="alert" className="alert">{error}</p>}
    {!base && !proposal && <Card><h2>Describe your agent</h2>
      <label>What should it do?<textarea value={description} maxLength={2000} disabled={busy} onChange={e => setDescription(e.target.value)} placeholder="Create a study tool that can record lectures, transcribe them, and summarize them." /></label>
      <Button variant="primary" disabled={blocked || description.trim().length < 3} onClick={() => void plan(description)}>{busy ? 'Discovering and composing…' : 'Discover and compose'}</Button>
      <p className="hint">ANS is searched first for each capability. Gemini fills only language tasks it can actually perform; storage, research, and external actions stay unresolved. Three specialists then design the interface. This usually takes 20–60 seconds.</p>
    </Card>}
    {draft && <Card><h2>{base ? 'Review the enhancement' : 'Review your agent'}</h2>
      <p><strong>{draft.capability?.ui.title ?? draft.name}</strong> · {draft.capability?.ui.description}</p>
      <ol className="capability-steps">{draft.steps.map((step, i) => <li key={i}><strong>{step.name}</strong><span>{stepSource(step)} · {step.inputFrom === 'original' ? 'Original input' : `Output of step ${(step.inputStep ?? i - 1) + 1}`} · {step.format}{base && i >= base.steps.length ? ' · new' : ''}</span></li>)}</ol>
      {draft.capability && <details><summary>Interface the specialists designed</summary><p>{draft.capability.ui.layout} layout · input “{draft.capability.ui.inputLabel}” · action “{draft.capability.ui.actionLabel}”</p><ul>{draft.capability.ui.panels.map(p => <li key={p.step}>{p.title} ({p.component}){p.description ? ` — ${p.description}` : ''}</li>)}</ul></details>}
      {draft.capability?.unresolved.map((gap, i) => <p key={i} role="status" className="alert"><strong>{gap.capability}</strong>: {gap.reason}</p>)}
      {draft.capability?.generation === 'fallback' && <p className="hint">Using the standard functional layout; specialist interface design was unavailable. You can enhance the agent later to try again.</p>}
      <div className="capability-actions">
        <Button variant="primary" disabled={busy || !!draft.capability?.unresolved.length} onClick={() => void save()}>{busy ? 'Saving…' : base ? 'Save new revision' : 'Create agent'}</Button>
        <Button disabled={busy} onClick={() => setProposal(undefined)}>Discard</Button>
      </div>
    </Card>}
    {(base || proposal) && <Card id="enhance"><h2>{base && !proposal ? 'Enhance this agent' : 'Add capabilities'} <StatusPill tone="violet">Optional</StatusPill></h2>
      <p className="hint">Each addition goes through the same ANS discovery, Gemini fallback, and interface design. Nothing is added until you save.</p>
      {!!suggestions.length && <div className="capability-actions">{suggestions.map(s => <Button key={s} disabled={blocked} onClick={() => void plan(s)}>{s}</Button>)}</div>}
      <label>Describe a capability<input value={addition} maxLength={1000} disabled={busy} onChange={e => setAddition(e.target.value)} placeholder="Generate a practice quiz from the summary" /></label>
      <Button disabled={blocked || addition.trim().length < 3} onClick={() => void plan(addition)}>{busy ? 'Resolving…' : 'Resolve addition'}</Button>
    </Card>}
  </>;
}
