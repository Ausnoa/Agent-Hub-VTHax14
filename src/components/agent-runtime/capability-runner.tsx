'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api-client';
import { hostedApi } from '../../lib/hosted/browser';
import { uiExtras } from '../../lib/agent-ui/capability';
import { MAX_AUDIO_BYTES, valueSchema, type Value, type GeneralWorkflow, type GeneralRun, type GeneralStep } from '../../lib/general/contracts';
import type { CapabilityConfig } from '../../lib/capabilities/contracts';
import type { HostedWorkflow, HostedRun } from '../../lib/hosted/workflow-contracts';
import type { RunStatus } from './agent-avatar';
import Card from '../ui/card';
import Button from '../ui/button';
import './capability-workspace.css';

// One launchable interface for every workflow agent: the profile page, the local cat window,
// and the hosted cat chat all render this, driven by the specialist-designed `capability.ui`.

export type CapabilityAgent = { id: string; name: string; description?: string; steps: GeneralStep[]; capability?: CapabilityConfig; revision?: GeneralWorkflow['revision']; canEnhance?: boolean };
export type AgentRun = { id: string; status: string; outputs: Value[]; error?: string | null; createdAt: string };
export const localAgent = (a: GeneralWorkflow): CapabilityAgent => a;
export const hostedAgent = (a: HostedWorkflow): CapabilityAgent => ({ id: a.id, ...a.definition });
/** Stable across revisions, so an enhanced agent keeps its cat and its place in the fleet. */
export const agentRootId = (a: Pick<CapabilityAgent, 'id' | 'revision'>) => a.revision?.rootId ?? a.id;
/** Latest revision of each agent family. */
export function latestRevisions<T extends CapabilityAgent>(agents: T[]): T[] {
  return [...new Map([...agents].sort((a, b) => (a.revision?.number ?? 1) - (b.revision?.number ?? 1)).map(a => [agentRootId(a), a])).values()];
}
export function stepSource(step: GeneralStep) {
  if (step.geminiTask) return 'Gemini';
  if (step.agentId.startsWith('template:') || step.agentId.startsWith('owned:')) return 'Saved template';
  return 'ANS';
}
export function useAgentRequest(local: boolean) {
  return useCallback(<T,>(path: string, body?: unknown) => local ? api<T>(path, body) : hostedApi<T>(path, body), [local]);
}
const fromLocal = (r: GeneralRun): AgentRun => ({ id: r.id, status: r.status, outputs: r.outputs, error: r.error, createdAt: r.createdAt });
const fromHosted = (r: HostedRun): AgentRun => ({ id: r.id, status: r.status, outputs: r.outputs, error: r.error, createdAt: r.created_at });
const statusOf = (run?: AgentRun): RunStatus => !run ? 'idle' : ['queued', 'running', 'ready'].includes(run.status) ? 'working' : run.status === 'completed' ? 'done' : 'error';

export default function CapabilityRunner({ agent, local, compact = false, onStatus }: { agent: CapabilityAgent; local: boolean; compact?: boolean; onStatus?: (status: RunStatus) => void }) {
  const request = useAgentRequest(local);
  const ui = agent.capability?.ui, extras = uiExtras(ui);
  const audioInput = agent.steps.some(s => s.inputFrom === 'original' && s.format === 'audio');
  const jsonInput = agent.steps.some(s => s.inputFrom === 'original' && s.format === 'json');
  const [text, setText] = useState(''), [audio, setAudio] = useState<Value>();
  const [confirmed, setConfirmed] = useState(false), [run, setRun] = useState<AgentRun>(), [history, setHistory] = useState<AgentRun[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const active = useRef(true), resumed = useRef(false), requestKey = useRef<{ input: string; id: string } | undefined>(undefined);
  const notify = useRef(onStatus); notify.current = onStatus;
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { notify.current?.(statusOf(run)); }, [run]);

  const loadHistory = useCallback(async () => {
    const items = local ? (await request<GeneralRun[]>(`general/${agent.id}/runs`)).map(fromLocal) : (await request<HostedRun[]>('workflows/runs')).filter(r => r.workflow_id === agent.id).map(fromHosted);
    if (!active.current) return;
    setHistory(items);
    // Reopening a cat or profile while its queued run is still processing resumes following it.
    if (!resumed.current) { resumed.current = true; if (local && items[0] && ['queued', 'running'].includes(items[0].status)) setRun(items[0]); }
  }, [agent.id, local, request]);
  useEffect(() => { loadHistory().catch(e => { if (active.current) setError(e.message); }); }, [loadHistory, run?.status]);
  useEffect(() => {
    if (!local || !run || !['queued', 'running'].includes(run.status)) return;
    const timer = setInterval(() => request<GeneralRun>(`general/runs/${run.id}`).then(r => { if (active.current) setRun(fromLocal(r)); }).catch(e => { if (active.current) setError(e.message); }), 1500);
    return () => clearInterval(timer);
  }, [local, run, request]);

  async function work(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Request failed'); }
    finally { if (active.current) setBusy(false); }
  }
  async function advance(current: HostedRun) {
    while (active.current && current.status === 'ready') {
      setRun({ ...fromHosted(current), status: 'running' });
      current = await request<HostedRun>(`workflows/runs/${current.id}/advance`, { expectedStep: current.outputs.length, confirmExternalExecution: true });
      if (active.current) setRun(fromHosted(current));
    }
    window.dispatchEvent(new Event('hosted-workspace-changed'));
  }
  const execute = () => work(async () => {
    const input = valueSchema.parse(audioInput ? audio : jsonInput ? { type: 'json', value: JSON.parse(text) } : { type: 'text', value: text });
    if (local) { setRun(fromLocal(await request<GeneralRun>(`general/${agent.id}/invoke`, { input, confirmExternalExecution: true }))); return; }
    const key = JSON.stringify([agent.id, input]);
    if (requestKey.current?.input !== key) requestKey.current = { input: key, id: crypto.randomUUID() };
    const current = await request<HostedRun>(`workflows/${agent.id}/invoke`, { requestId: requestKey.current.id, input, confirmExternalExecution: true });
    if (active.current) { setRun(fromHosted(current)); await advance(current); }
  });
  const resume = () => work(async () => {
    if (!run) return;
    const fresh = await request<HostedRun>(`workflows/runs/${run.id}`); setRun(fromHosted(fresh));
    if (fresh.status === 'ready') await advance(fresh);
    else if (fresh.status === 'running') setRun(fromHosted(await request<HostedRun>(`workflows/runs/${fresh.id}/advance`, { expectedStep: fresh.outputs.length, confirmExternalExecution: true })));
  });
  const running = !!run && ['queued', 'running', 'ready'].includes(run.status);
  const providers = [...new Set(agent.steps.map(stepSource))].join(', ');

  const input = <Card className={compact ? 'capability-compact-input' : undefined}>
    <h2>{ui?.inputLabel ?? 'Agent input'}</h2>
    {ui?.inputHint && <p className="hint">{ui.inputHint}</p>}
    {audioInput
      ? <AudioInput key={agent.id} compact={compact} disabled={busy || running} onChange={value => { setAudio(value); setConfirmed(false); }} />
      : <label>{jsonInput ? 'JSON object' : 'Source text'}<textarea value={text} maxLength={20000} disabled={busy || running} onChange={e => { setText(e.target.value); setConfirmed(false); }} /></label>}
    <label className="capability-confirm"><input type="checkbox" checked={confirmed} disabled={busy || running} onChange={e => setConfirmed(e.target.checked)} />Send this input and intermediate outputs to the listed providers ({providers}) and run these capabilities.</label>
    <Button variant="primary" disabled={busy || running || !confirmed || (audioInput ? !audio : !text.trim())} onClick={() => void execute()}>{running ? 'Working…' : ui?.actionLabel ?? 'Run agent'}</Button>
    {local && run?.status === 'queued' && <p className="hint">Queued. Keep the local workflow worker (npm run worker) running to process it.</p>}
    {!local && !compact && <p className="hint">Keep this page open while steps advance. Refreshing never repeats an uncertain step.</p>}
    {run && <p role="status">Run {run.status}{run.outputs.length && running ? ` · ${run.outputs.length}/${agent.steps.length} steps done` : ''}{run.error ? `: ${run.error}` : ''}</p>}
    {run && ['completed', 'failed'].includes(run.status) && <Button disabled={busy} onClick={() => { setRun(undefined); requestKey.current = undefined; setConfirmed(false); }}>Prepare another run</Button>}
    {!local && run && ['running', 'ready'].includes(run.status) && <Button disabled={busy} onClick={() => void resume()}>Refresh / continue</Button>}
    {error && <p role="alert" className="alert">{error}</p>}
  </Card>;

  return <div className={`capability-runner${compact ? ' compact' : ''}`}>
    {input}
    <OutputPanels key={`${agent.id}:${run?.id ?? 'empty'}`} agent={agent} outputs={run?.outputs ?? []} compact={compact} />
    {!compact && extras.has('history') && history.length > 0 && <Card><h2>Past runs</h2><div className="capability-actions">{history.map(item => <Button key={item.id} aria-pressed={run?.id === item.id} disabled={busy || running} onClick={() => { setRun(item); setConfirmed(false); }}>{new Date(item.createdAt).toLocaleString()} · {item.status}</Button>)}</div></Card>}
  </div>;
}

export function OutputPanels({ agent, outputs, compact = false }: { agent: CapabilityAgent; outputs: Value[]; compact?: boolean }) {
  const ui = agent.capability?.ui, extras = uiExtras(ui);
  const panels = ui?.panels ?? agent.steps.map((s, step) => ({ step, title: s.name, component: 'text' as const, description: undefined }));
  const layout = compact ? 'tabs' : ui?.layout ?? 'tabs';
  const first = compact && ui?.primaryPanel !== undefined ? Math.max(0, panels.findIndex(p => p.step === ui.primaryPanel)) : 0;
  const [tab, setTab] = useState(first);
  const [href, setHref] = useState('');
  useEffect(() => { if (!outputs.length) { setHref(''); return; } const url = URL.createObjectURL(new Blob([JSON.stringify(outputs, null, 2)], { type: 'application/json' })); setHref(url); return () => URL.revokeObjectURL(url); }, [outputs]);
  return <section aria-label="Agent results" className="capability-outputs">
    <div className="capability-actions">
      {layout === 'tabs' && panels.map((p, i) => <Button key={p.step} size={compact ? 'sm' : undefined} aria-pressed={i === tab} onClick={() => setTab(i)}>{p.title}</Button>)}
      {href && extras.has('export') && <a className="btn btn-secondary" href={href} download="agent-results.json">Download results</a>}
    </div>
    <div className={`capability-results ${layout === 'columns' ? 'capability-columns' : ''}`}>
      {panels.map((p, i) => (layout !== 'tabs' || i === tab) && <Card key={p.step}><h2>{p.title}</h2>{p.description && !compact && <p className="hint">{p.description}</p>}
        {outputs[p.step] ? <Output key={`${agent.id}:${p.step}:${JSON.stringify(outputs[p.step]).slice(0, 80)}`} value={outputs[p.step]} component={p.component} /> : <p>{ui?.emptyState ?? 'Run the agent to see this output.'}</p>}</Card>)}
    </div>
  </section>;
}
function Output({ value, component }: { value: Value; component: string }) {
  if (value.type === 'json' && component === 'flashcards' && Array.isArray(value.value.cards)) return <div>{(value.value.cards as { front: string; back: string }[]).map((card, i) => <details className="study-card" key={i}><summary>{card.front}</summary><p>{card.back}</p></details>)}</div>;
  if (value.type === 'json' && component === 'quiz' && Array.isArray(value.value.questions)) return <div>{(value.value.questions as { question: string; options: string[]; answer: number; explanation: string }[]).map((q, i) => <QuizQuestion key={i} question={q} />)}</div>;
  if (value.type === 'json' && component === 'table') return <table><tbody>{Object.entries(value.value).map(([key, item]) => <tr key={key}><th>{key}</th><td>{typeof item === 'string' ? item : JSON.stringify(item)}</td></tr>)}</tbody></table>;
  return <pre className="capability-output">{value.type === 'audio' ? 'Audio source' : typeof value.value === 'string' ? value.value : JSON.stringify(value.value, null, 2)}</pre>;
}
function QuizQuestion({ question: q }: { question: { question: string; options: string[]; answer: number; explanation: string } }) {
  const [answer, setAnswer] = useState<number>();
  return <fieldset className="study-card"><legend>{q.question}</legend>{q.options.map((option, i) => <Button key={i} aria-pressed={answer === i} onClick={() => setAnswer(i)}>{option}</Button>)}{answer !== undefined && <p role="status">{answer === q.answer ? 'Correct.' : `Correct answer: ${q.options[q.answer]}.`} {q.explanation}</p>}</fieldset>;
}

function AudioInput({ disabled, compact, onChange }: { disabled: boolean; compact?: boolean; onChange: (value: Value | undefined) => void }) {
  const [recording, setRecording] = useState(false), [name, setName] = useState(''), [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | undefined>(undefined), stream = useRef<MediaStream | undefined>(undefined), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), mounted = useRef(true);
  const notify = useRef(onChange); notify.current = onChange;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current); if (recorder.current?.state === 'recording') recorder.current.stop(); stream.current?.getTracks().forEach(t => t.stop()); }; }, []);
  async function accept(blob: Blob, label: string) {
    if (!mounted.current) return;
    setError(''); notify.current(undefined);
    if (!blob.size || blob.size > MAX_AUDIO_BYTES) { setError('Choose a nonempty audio clip of at most 1 MB.'); return; }
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Could not read audio')); reader.readAsDataURL(blob); });
    if (!mounted.current) return;
    const parsed = valueSchema.safeParse({ type: 'audio', mimeType: blob.type.split(';')[0], value: data });
    if (!parsed.success) { setError('Supported audio: WebM, Ogg, WAV, MP3, or MP4.'); return; }
    setName(`${label} · ${Math.ceil(blob.size / 1000)} KB`); notify.current(parsed.data);
  }
  async function start() {
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Recording is unavailable in this browser. Upload an audio clip instead.');
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      const mime = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mime) throw new Error('No supported recording format. Upload an audio clip instead.');
      const rec = new MediaRecorder(media, { mimeType: mime, audioBitsPerSecond: 64000 }); recorder.current = rec;
      const chunks: Blob[] = []; let size = 0;
      rec.ondataavailable = e => { if (e.data.size) { chunks.push(e.data); size += e.data.size; if (size >= MAX_AUDIO_BYTES && rec.state === 'recording') rec.stop(); } };
      rec.onstop = () => { clearTimeout(timer.current); media.getTracks().forEach(t => t.stop()); if (mounted.current) { setRecording(false); void accept(new Blob(chunks, { type: mime }), 'Recorded audio').catch(e => setError(e.message)); } };
      rec.onerror = () => { media.getTracks().forEach(t => t.stop()); if (mounted.current) { setRecording(false); setError('Recording failed. Try uploading audio.'); } };
      rec.start(1000); setRecording(true); notify.current(undefined); timer.current = setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 60000);
    } catch (e) { stream.current?.getTracks().forEach(t => t.stop()); setError(e instanceof Error ? e.message : 'Microphone access failed'); }
  }
  return <div>{!compact && <p>Record up to 60 seconds or upload an audio clip up to 1 MB.</p>}<Button disabled={disabled} onClick={() => recording ? recorder.current?.stop() : void start()}>{recording ? 'Stop recording' : 'Record audio'}</Button><label>Upload audio<input type="file" accept="audio/webm,audio/ogg,audio/wav,audio/mpeg,audio/mp4" disabled={disabled || recording} onChange={e => { const file = e.target.files?.[0]; if (file) void accept(file, file.name).catch(e => setError(e.message)); }} /></label>{name && <p role="status">{name}</p>}{error && <p role="alert">{error}</p>}</div>;
}
