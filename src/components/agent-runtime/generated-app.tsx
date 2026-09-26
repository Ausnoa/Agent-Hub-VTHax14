'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { valueSchema, type GeneralRun, type Value } from '../../lib/general/contracts';
import type { HostedRun } from '../../lib/hosted/workflow-contracts';
import { appMessageSchema, buildViewDocument, inputKind, outputData, MAX_VIEW_STATE, type ViewTheme } from '../../lib/agent-ui/view-bridge';
import { variantFor } from '../../lib/agent-ui/variant';
import type { RunStatus } from './agent-avatar';
import Button from '../ui/button';
import CapabilityRunner, { AudioInput, agentRootId, fromHosted, fromLocal, statusOf, stepSource, useAgentRequest, type AgentRun, type CapabilityAgent } from './capability-runner';

// Hosts an agent's generated app. The app is untrusted: it lives in an opaque-origin sandbox and
// can only ask. Glorria validates every request, confirms runs with the user in its own UI,
// executes through the real queue or hosted runner, and streams results back.

const READY_TIMEOUT_MS = 8000;
const tokens: [string, string][] = [['--g-bg', '--bg'], ['--g-surface', '--bg-raised'], ['--g-surface-2', '--bg-panel'], ['--g-text', '--text'], ['--g-muted', '--text-muted'], ['--g-border', '--border'], ['--g-accent', '--accent'], ['--g-accent-soft', '--accent-soft'], ['--g-good', '--green'], ['--g-warn', '--amber'], ['--g-bad', '--red'], ['--g-radius', '--radius-md'], ['--g-font', '--font-sans'], ['--g-font-display', '--font-display'], ['--g-font-mono', '--font-mono']];
function hostTheme(agentAccent: string): ViewTheme {
  const style = getComputedStyle(document.documentElement), theme: ViewTheme = { '--g-agent': agentAccent };
  for (const [name, source] of tokens) { const value = style.getPropertyValue(source).trim(); if (value) theme[name as `--g-${string}`] = value; }
  return theme;
}
function describeInput(input: Value) {
  if (input.type === 'audio') return `an audio clip (${Math.ceil(input.value.length * 0.75 / 1000)} KB)`;
  if (input.type === 'json') return 'a JSON object';
  return `${input.value.length.toLocaleString()} characters of text`;
}
const stateKey = (agent: CapabilityAgent) => `glorria-view:${agentRootId(agent)}`;

/** The agent's interface everywhere it appears: its generated app, or the component interface. */
export default function AgentInterface({ agent, local, mode, onStatus }: { agent: CapabilityAgent; local: boolean; mode: 'full' | 'compact'; onStatus?: (status: RunStatus) => void }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [agent.id]);
  if (agent.capability?.view && !failed) return <GeneratedApp key={agent.id} agent={agent} local={local} mode={mode} onStatus={onStatus} onFail={() => setFailed(true)} />;
  return <>{failed && <p className="hint">Showing the standard interface; this agent’s generated app could not start.</p>}<CapabilityRunner key={agent.id} agent={agent} local={local} compact={mode === 'compact'} onStatus={onStatus} /></>;
}

export function GeneratedApp({ agent, local, mode, preview = false, onStatus, onFail }: {
  agent: CapabilityAgent; local: boolean; mode: 'full' | 'compact';
  /** Before saving: feeds the specialists' sample data and never runs anything. */
  preview?: boolean;
  onStatus?: (status: RunStatus) => void; onFail?: () => void;
}) {
  const request = useAgentRequest(local);
  const view = agent.capability!.view!;
  // connected: the host shim said hello, so messages can flow. ready: the app itself booted.
  const frame = useRef<HTMLIFrameElement>(null), active = useRef(true), connected = useRef(false), ready = useRef(false);
  const [run, setRun] = useState<AgentRun>(), [history, setHistory] = useState<AgentRun[]>([]);
  const [consent, setConsent] = useState<{ requestId: string; input: Value }>(), [recorder, setRecorder] = useState<{ requestId: string; clip?: Value }>();
  const [height, setHeight] = useState(mode === 'full' ? 640 : 460), [notice, setNotice] = useState('');
  const accent = variantFor(agentRootId(agent)).accent;
  // Built after mount: the theme comes from the live document, and server and client render the same empty frame first.
  const [srcDoc, setSrcDoc] = useState('');
  useEffect(() => setSrcDoc(buildViewDocument(view.html, hostTheme(accent))), [view.html, accent]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 2500); return () => clearTimeout(timer); }, [notice]);
  const notify = useRef(onStatus); notify.current = onStatus;
  const fail = useRef(onFail); fail.current = onFail;
  const post = useCallback((message: object) => frame.current?.contentWindow?.postMessage(message, '*'), []);
  useEffect(() => {
    if (connected.current) post({ type: 'glorria:mode', payload: { mode } });
    setHeight(mode === 'full' ? 640 : 460);
  }, [mode, post]);
  const runPayload = (current?: AgentRun) => current ? { id: current.id, status: current.status, data: outputData(current.outputs), error: current.error ?? null } : { id: '', status: 'idle', data: [], error: null };

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (!preview) notify.current?.(statusOf(run)); }, [run, preview]);
  // Past runs; a still-processing local run is resumed, otherwise the latest result is shown.
  useEffect(() => {
    if (preview) { setRun({ id: 'preview', status: 'completed', outputs: view.sample as Value[], createdAt: new Date().toISOString() }); return; }
    (local ? request<GeneralRun[]>(`general/${agent.id}/runs`).then(items => items.map(fromLocal)) : request<HostedRun[]>('workflows/runs').then(items => items.filter(r => r.workflow_id === agent.id).map(fromHosted)))
      .then(items => { if (!active.current) return; setHistory(items); setRun(current => current ?? items[0]); })
      .catch(() => { /* history is optional */ });
  }, [agent.id, local, preview, request, view.sample]);
  useEffect(() => {
    if (!local || !run || !['queued', 'running'].includes(run.status)) return;
    const timer = setInterval(() => request<GeneralRun>(`general/runs/${run.id}`).then(r => { if (active.current) setRun(fromLocal(r)); }).catch(() => {}), 1500);
    return () => clearInterval(timer);
  }, [local, run, request]);
  useEffect(() => {
    if (connected.current) post({ type: 'glorria:run', payload: runPayload(run) });
    if (run) setHistory(old => old.map(item => item.id === run.id ? run : item));
  }, [run, post]);
  // Follow Glorria's light/dark toggle without reloading the app.
  useEffect(() => {
    const observer = new MutationObserver(() => post({ type: 'glorria:theme', payload: hostTheme(accent) }));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => observer.disconnect();
  }, [accent, post]);
  const giveUp = useCallback((reason: string) => { if (ready.current) return; console.warn(`Generated app replaced by the standard interface: ${reason}`); fail.current?.(); }, []);
  useEffect(() => { const timer = setTimeout(() => giveUp('it never called glorria.ready()'), READY_TIMEOUT_MS); return () => clearTimeout(timer); }, [giveUp]);

  const execute = useCallback(async (input: Value) => {
    if (local) { const started = fromLocal(await request<GeneralRun>(`general/${agent.id}/invoke`, { input, confirmExternalExecution: true })); setRun(started); setHistory(old => [started, ...old]); return; }
    let current = await request<HostedRun>(`workflows/${agent.id}/invoke`, { requestId: crypto.randomUUID(), input, confirmExternalExecution: true });
    setRun(fromHosted(current));
    while (active.current && current.status === 'ready') {
      current = await request<HostedRun>(`workflows/runs/${current.id}/advance`, { expectedStep: current.outputs.length, confirmExternalExecution: true });
      if (active.current) setRun(fromHosted(current));
    }
    window.dispatchEvent(new Event('hosted-workspace-changed'));
  }, [agent.id, local, request]);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const parsed = appMessageSchema.safeParse(event.data);
      if (!parsed.success) return;
      const message = parsed.data;
      switch (message.type) {
        case 'glorria:hello': {
          let savedState: unknown = null;
          try { savedState = JSON.parse(localStorage.getItem(stateKey(agent)) ?? 'null'); } catch { /* per-viewer convenience only */ }
          post({ type: 'glorria:init', payload: { mode, preview, agent: { title: agent.capability?.ui.title ?? agent.name, input: inputKind(agent.steps), outputs: agent.steps.map((step, index) => ({ index, name: step.name, shape: step.geminiTask === 'flashcards' || step.geminiTask === 'quiz' ? step.geminiTask : 'text' })) }, savedState, history: history.map(h => ({ id: h.id, status: h.status, createdAt: h.createdAt })) } });
          post({ type: 'glorria:run', payload: runPayload(run) });
          connected.current = true;
          break;
        }
        case 'glorria:ready': ready.current = true; break;
        case 'glorria:resize': setHeight(mode === 'full' ? Math.min(Math.max(message.height, 480), 4000) : Math.min(Math.max(message.height, 320), 540)); break;
        case 'glorria:error': giveUp(message.message); break;
        case 'glorria:saveState': try { const json = JSON.stringify(message.state); if (json.length <= MAX_VIEW_STATE) localStorage.setItem(stateKey(agent), json); } catch { /* ignore */ } break;
        case 'glorria:openRun': { const found = history.find(h => h.id === message.runId); if (found) setRun(found); break; }
        case 'glorria:recordAudio': if (preview) post({ type: 'glorria:audio', requestId: message.requestId, value: null }); else setRecorder({ requestId: message.requestId }); break;
        case 'glorria:copy': void navigator.clipboard?.writeText(message.text).then(() => setNotice('Copied to clipboard.')).catch(() => setNotice('Copying was blocked by the browser.')); break;
        case 'glorria:download': {
          const url = URL.createObjectURL(new Blob([message.content], { type: message.mimeType }));
          const link = document.createElement('a'); link.href = url; link.download = message.filename; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000); break;
        }
        case 'glorria:requestRun': {
          const reply = (result: 'accepted' | 'declined' | 'error', text?: string) => post({ type: 'glorria:runResult', requestId: message.requestId, result, ...(text ? { message: text } : {}) });
          if (preview) { reply('declined', 'This is a preview. Create the agent to run it.'); break; }
          const input = valueSchema.safeParse(message.input), expected = inputKind(agent.steps);
          if (!input.success || input.data.type !== expected) { reply('error', `This agent accepts ${expected === 'audio' ? 'an audio clip' : expected === 'json' ? 'a JSON object' : 'text'}.`); break; }
          if (run && ['queued', 'running', 'ready'].includes(run.status)) { reply('error', 'A run is already in progress.'); break; }
          setConsent({ requestId: message.requestId, input: input.data });
        }
      }
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [agent, giveUp, history, mode, post, preview, run]);

  async function confirm(accepted: boolean) {
    const pending = consent; setConsent(undefined);
    if (!pending) return;
    if (!accepted) { post({ type: 'glorria:runResult', requestId: pending.requestId, result: 'declined', message: 'Cancelled.' }); return; }
    try { await execute(pending.input); post({ type: 'glorria:runResult', requestId: pending.requestId, result: 'accepted' }); }
    catch (e) { post({ type: 'glorria:runResult', requestId: pending.requestId, result: 'error', message: e instanceof Error ? e.message.slice(0, 300) : 'Could not start the run.' }); }
  }
  const providers = [...new Set(agent.steps.map(stepSource))].join(', ');

  return <div className={`generated-app ${mode}`}>
    {preview && <p className="hint generated-app-note">Preview with sample data. Nothing runs until you create the agent.</p>}
    {/* Inserted only once its document exists: a srcdoc set after hydration may never load. */}
    {srcDoc ? <iframe ref={frame} title={`${agent.capability?.ui.title ?? agent.name} app`} sandbox="allow-scripts" allow="microphone" srcDoc={srcDoc} style={{ height }} /> : <div className="generated-app-loading" style={{ height }} />}
    {notice && <p role="status" className="hint generated-app-note">{notice}</p>}
    {consent && <div className="generated-app-overlay" role="dialog" aria-modal="true" aria-label="Confirm run">
      <div className="card">
        <h2>Run {agent.capability?.ui.title ?? agent.name}?</h2>
        <p>This sends {describeInput(consent.input)} and each step’s output to: <strong>{providers}</strong>{local ? '. Keep the local worker running to process it.' : '.'}</p>
        <div className="capability-actions"><Button variant="primary" autoFocus onClick={() => void confirm(true)}>Run</Button><Button onClick={() => void confirm(false)}>Cancel</Button></div>
      </div>
    </div>}
    {recorder && <div className="generated-app-overlay" role="dialog" aria-modal="true" aria-label="Record audio">
      <div className="card">
        <h2>Record audio</h2>
        <AudioInput disabled={false} onChange={clip => setRecorder(old => old && { ...old, clip })} />
        <div className="capability-actions">
          <Button variant="primary" disabled={!recorder.clip} onClick={() => { post({ type: 'glorria:audio', requestId: recorder.requestId, value: recorder.clip }); setRecorder(undefined); }}>Use this clip</Button>
          <Button onClick={() => { post({ type: 'glorria:audio', requestId: recorder.requestId, value: null }); setRecorder(undefined); }}>Cancel</Button>
        </div>
      </div>
    </div>}
  </div>;
}
