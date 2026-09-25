'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { specForCapability } from '../../lib/agent-ui/derive';
import { uiExtras } from '../../lib/agent-ui/capability';
import { variantFor } from '../../lib/agent-ui/variant';
import { useAgentRuntime } from './agent-provider';
import Card, { CardHead } from '../ui/card';
import Button from '../ui/button';
import StatusPill from '../ui/status-pill';
import Mascot from './mascot';
import { agentRootId, stepSource, useAgentRequest, localAgent, hostedAgent, type CapabilityAgent } from './capability-runner';
import CapabilityComposer from './capability-composer';
import AgentInterface from './generated-app';
import type { GeneralWorkflow } from '../../lib/general/contracts';
import type { HostedWorkflow } from '../../lib/hosted/workflow-contracts';

/**
 * A saved agent pops out as a cat, like every other Glorria agent. Locally the cat joins the
 * runtime pack (keyed by revision family); hosted cats come from the account list and events.
 */
export function useAnnounceAgent(local: boolean) {
  const { spawn } = useAgentRuntime();
  return useCallback((agent: CapabilityAgent, animate = true) => {
    if (local) { spawn(specForCapability(agent), animate); return; }
    if (animate) window.dispatchEvent(new CustomEvent('hosted-agent-created', { detail: { id: agent.id, name: agent.capability?.ui.title ?? agent.name, kind: 'workflow', skills: agent.steps.map(s => s.geminiTask ?? s.skill) } }));
    window.dispatchEvent(new Event('hosted-workspace-changed'));
  }, [local, spawn]);
}

export function CapabilityHeader({ agent, action }: { agent: CapabilityAgent; action?: React.ReactNode }) {
  const ui = agent.capability?.ui, variant = variantFor(agentRootId(agent));
  return <header className="capability-profile-head">
    <span className="capability-profile-mascot" style={{ '--mascot-accent': variant.accent } as React.CSSProperties}><Mascot width={72} variant={variant} /></span>
    <div>
      <div className="eyebrow">GLORRIA AGENT · REVISION {agent.revision?.number ?? 1}</div>
      <h1>{ui?.title ?? agent.name}</h1>
      <p>{ui?.description ?? agent.description}</p>
      <div className="capability-actions">
        <StatusPill tone={agent.capability?.generation === 'specialists' ? 'violet' : 'neutral'}>{agent.capability?.generation === 'specialists' ? 'Specialist-designed interface' : 'Standard interface'}</StatusPill>
        {[...new Set(agent.steps.map(stepSource))].map(source => <StatusPill key={source} tone={source === 'ANS' ? 'accent' : 'green'}>{source}</StatusPill>)}
      </div>
    </div>
    {action}
  </header>;
}

/**
 * Everything below the header on an agent's profile: its launchable interface, what powers it,
 * and (for the owner) enhancement through the capability pipeline.
 */
export function CapabilityProfileBody({ agent, local, canEnhance, showCapabilities = true }: { agent: CapabilityAgent; local: boolean; canEnhance: boolean; /** Off where the page already lists the steps. */ showCapabilities?: boolean }) {
  const router = useRouter();
  const announce = useAnnounceAgent(local);
  const request = useAgentRequest(local);
  const extras = uiExtras(agent.capability?.ui);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  // Fleet cards link to #enhance; the section renders after data loads, so scroll once it exists.
  useEffect(() => { if (location.hash === '#enhance') requestAnimationFrame(() => document.getElementById('enhance')?.scrollIntoView({ block: 'start' })); }, []);
  const saved = (next: CapabilityAgent) => { announce(next, false); router.push(`/agents/${next.id}`); };
  // Workflows saved before interface design existed can adopt one without changing their steps.
  const design = async () => {
    setBusy(true); setError('');
    try { const next = await request<GeneralWorkflow | HostedWorkflow>('capabilities/adopt', { workflowId: agent.id }); saved('definition' in next ? hostedAgent(next) : localAgent(next)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not design an interface'); }
    finally { setBusy(false); }
  };
  return <>
    <AgentInterface key={agent.id} agent={agent} local={local} mode="full" />
    {showCapabilities && extras.has('capabilities') && <Card><CardHead>What powers this agent</CardHead>
      <ol className="capability-steps">{agent.steps.map((step, i) => <li key={i}><strong>{step.name}</strong><span>{stepSource(step)} · {step.inputFrom === 'original' ? 'Original input' : `Uses the output of step ${(step.inputStep ?? i - 1) + 1}`} · {step.skill}</span></li>)}</ol>
      <p className="hint">ANS agents are discovered from the registry (identity unverified). Gemini steps run only language tasks: transcription, summarization, extraction, classification, transformation, grounded answers, flashcards, and quizzes.</p>
    </Card>}
    {canEnhance && !agent.capability && <Card><h2>Design this agent’s interface</h2><p>The product, frontend, and backend specialists design an interface for its existing steps. The steps do not change.</p><Button variant="primary" disabled={busy} onClick={() => void design()}>{busy ? 'Designing…' : 'Design interface'}</Button>{error && <p role="alert">{error}</p>}</Card>}
    {canEnhance && <CapabilityComposer local={local} base={agent} onSaved={saved} />}
  </>;
}
