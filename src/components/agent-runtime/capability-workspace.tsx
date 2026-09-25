'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api-client';
import { hostedApi } from '../../lib/hosted/browser';
import { useAccount } from '../../lib/hosted/use-account';
import { MAX_AUDIO_BYTES, valueSchema, type Value, type GeneralWorkflow, type GeneralRun, type GeneralStep } from '../../lib/general/contracts';
import type { CapabilityConfig } from '../../lib/capabilities/contracts';
import type { HostedWorkflow, HostedRun } from '../../lib/hosted/workflow-contracts';
import type { CapabilityProposal } from '../../lib/capabilities/store';
import Card from '../ui/card';
import Button from '../ui/button';
import PageShell from '../layout/page-shell';
import './capability-workspace.css';

type Agent = { id: string; name: string; steps: GeneralStep[]; capability?: CapabilityConfig; revision?: GeneralWorkflow['revision']; canEnhance?: boolean };
type Run = { id: string; status: string; outputs: Value[]; error?: string | null };
const localAgent = (a: GeneralWorkflow): Agent => a;
const hostedAgent = (a: HostedWorkflow): Agent => ({ id: a.id, ...a.definition });

export default function CapabilityWorkspace() {
  const [local, setLocal] = useState<boolean>();
  useEffect(() => setLocal(['localhost','127.0.0.1'].includes(location.hostname) && !new URLSearchParams(location.search).has('hosted')), []);
  if (local === undefined) return <PageShell><p>Loading workspace…</p></PageShell>;
  return local ? <Workspace local/> : <HostedWorkspace/>;
}
function HostedWorkspace() {
  const account = useAccount();
  if (!account.ready) return <PageShell><p>Loading account…</p></PageShell>;
  if (!account.session) return <PageShell><h1>Create a purpose-built agent</h1><Link href="/login?next=/studio">Sign in to continue →</Link></PageShell>;
  return <Workspace key={account.session.user.id} local={false} userId={account.session.user.id}/>;
}
function Workspace({ local, userId }: { local: boolean; userId?: string }) {
  const [description, setDescription] = useState('');
  const [addition, setAddition] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent>();
  const [proposal, setProposal] = useState<CapabilityProposal>();
  const [configured, setConfigured] = useState<boolean>();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [text, setText] = useState(''), [audio, setAudio] = useState<Value>();
  const [confirmed, setConfirmed] = useState(false), [run, setRun] = useState<Run>();
  const [history, setHistory] = useState<Run[]>([]);
  const active = useRef(true), requestKey = useRef<{ input: string; id: string } | undefined>(undefined);
  const request = useCallback(<T,>(path: string, body?: unknown) => local ? api<T>(path, body) : hostedApi<T>(path, body), [local]);
  const load = useCallback(async () => {
    const values = local ? (await request<GeneralWorkflow[]>('general')).map(localAgent) : (await request<HostedWorkflow[]>('workflows')).map(hostedAgent);
    if (active.current) setAgents(values);
    return values;
  }, [local, request]);
  useEffect(() => {
    active.current = true;
    const initial = sessionStorage.getItem('general-workflow-description') ?? sessionStorage.getItem('stitch-workflow-directive');
    if (initial) setDescription(initial.slice(0,2000));
    Promise.all([load(), request<{ configured: boolean }>('capabilities')]).then(async ([values, config]) => {
      if (!active.current) return;
      setConfigured(config.configured);
      const id = new URLSearchParams(location.search).get('agent');
      if (id) {
        let found=values.filter(a => (a.revision?.rootId ?? a.id) === id || a.id === id).sort((a,b)=>(b.revision?.number??1)-(a.revision?.number??1))[0];
        if(!found){
          if(local)found=localAgent(await request<GeneralWorkflow>(`general/${encodeURIComponent(id)}`));
          else{const publicAgent=await request<HostedWorkflow>(`workflows/${encodeURIComponent(id)}`);found={...hostedAgent(publicAgent),canEnhance:publicAgent.owner_id===userId};}
        }
        if(active.current)setSelected(found);
      }
    }).catch(e => { if (active.current) setError(e.message); });
    return () => { active.current = false; };
  }, [load, request, local, userId]);
  useEffect(() => {
    if (!selected) return;
    let live = true;
    const fetchHistory = local ? request<GeneralRun[]>(`general/${selected.id}/runs`) : request<HostedRun[]>('workflows/runs').then(items => items.filter(r => r.workflow_id === selected.id));
    fetchHistory.then(items => { if (live) setHistory(items); }).catch(e => { if(live)setError(e.message); });
    return () => { live = false; };
  }, [selected, local, request, run?.status]);
  useEffect(() => {
    if (!local || !run || !['queued','running'].includes(run.status)) return;
    let live = true;
    const timer = setInterval(() => request<GeneralRun>(`general/runs/${run.id}`).then(result => { if(live)setRun(result); }).catch(e=>{if(live)setError(e.message);}),1500);
    return () => { live=false;clearInterval(timer); };
  }, [local, run, request]);
  async function work(action: () => Promise<void>) {
    setBusy(true);setError('');
    try { await action(); } catch(e) { if(active.current)setError(e instanceof Error ? e.message : 'Request failed'); }
    finally { if(active.current)setBusy(false); }
  }
  async function plan(extra?: string) {
    await work(async () => {
      const result = await request<CapabilityProposal>('capabilities/plan', { description: extra ?? description, ...(extra ? proposal ? {proposalId:proposal.id} : selected ? {baseId:selected.id} : {} : {}) });
      if(active.current){setProposal(result);setAddition('');setRun(undefined);setConfirmed(false);}
    });
  }
  async function advance(current: HostedRun) {
    while(active.current && current.status === 'ready') {
      setRun({...current,status:'running'});
      current=await request<HostedRun>(`workflows/runs/${current.id}/advance`,{expectedStep:current.outputs.length,confirmExternalExecution:true});
      if(active.current)setRun(current);
    }
  }
  async function execute() {
    if(!selected || !confirmed)return;
    await work(async()=>{
      const input=valueSchema.parse(selected.steps.some(s=>s.inputFrom==='original'&&s.format==='audio') ? audio : selected.steps.some(s=>s.inputFrom==='original'&&s.format==='json') ? {type:'json',value:JSON.parse(text)} : {type:'text',value:text});
      if(local) {setRun(await request<GeneralRun>(`general/${selected.id}/invoke`,{input,confirmExternalExecution:true}));return;}
      const key=JSON.stringify([selected.id,input]);
      if(requestKey.current?.input!==key)requestKey.current={input:key,id:crypto.randomUUID()};
      const current=await request<HostedRun>(`workflows/${selected.id}/invoke`,{requestId:requestKey.current.id,input,confirmExternalExecution:true});
      if(active.current){setRun(current);await advance(current);}
    });
  }
  const definition=proposal?.definition ?? selected;
  const ui=definition?.capability?.ui;
  const running=!!run&&['queued','running','ready'].includes(run.status);
  const audioInput=selected?.steps.some(s=>s.inputFrom==='original'&&s.format==='audio');
  const latest = [...new Map([...agents].sort((a,b)=>(a.revision?.number??1)-(b.revision?.number??1)).map(a=>[a.revision?.rootId??a.id,a])).values()];
  function open(agent: Agent) {setSelected(agent);setProposal(undefined);setRun(undefined);setConfirmed(false);setAudio(undefined);setText('');setHistory([]);requestKey.current=undefined;}
  return <PageShell className="capability-workspace">
    <header className="compose-hero"><div className="eyebrow">GLORRIA · CAPABILITY STUDIO</div><h1>{ui?.title ?? 'Describe an agent. Make it yours.'}</h1><p>{ui?.description ?? 'Discover ANS agents, resolve supported gaps, and build an interface around what your agent can do.'}</p><Link href="/create">Manual workflow builder →</Link> · <Link href="/agent-preview">Template builder →</Link></header>
    {error&&<p role="alert" className="alert">{error}</p>}
    {configured===false&&<Card><h2>Gemini setup needed</h2><p>Configure GEMINI_API_KEY and GEMINI_MODEL on the server to create or enhance agents. Hosted generation also requires execution to be enabled. Existing saved agents remain available below.</p></Card>}
    <Card><h2>Create an agent</h2><label>What should it do?<textarea value={description} maxLength={2000} disabled={busy||running} onChange={e=>setDescription(e.target.value)} placeholder="Create a study tool with speech-to-text and summarization."/></label><Button variant="primary" disabled={busy||running||configured!==true||description.trim().length<3} onClick={()=>void plan()}>{busy?'Resolving capabilities…':'Discover and compose'}</Button><p className="hint">ANS is checked first. Gemini handles supported gaps. Review the resolved capabilities before saving. No agent task runs during creation.</p></Card>
    {definition&&<Card><h2>{proposal?'Review your composition':'Resolved capabilities'}</h2><ol className="capability-steps">{definition.steps.map((step,i)=><li key={i}><strong>{step.name}</strong><span>{step.geminiTask?'Gemini':step.agentId.startsWith('template:')||step.agentId.startsWith('owned:')?'Saved template':'ANS'} · {step.inputFrom==='original'?'Original input':`Output of step ${(step.inputStep??i-1)+1}`} · {step.format}</span></li>)}</ol>
      {definition.capability?.unresolved.map((gap,i)=><p key={i} role="status" className="alert"><strong>{gap.capability}</strong>: {gap.reason}</p>)}
      {definition.capability?.generation==='fallback'&&<p className="hint">Using the standard functional layout; specialist layout generation was unavailable.</p>}
      {proposal&&<Button variant="primary" disabled={busy||!!proposal.definition.capability?.unresolved.length} onClick={()=>void work(async()=>{const saved=local?localAgent(await request<GeneralWorkflow>('capabilities/save',{proposalId:proposal.id})):hostedAgent(await request<HostedWorkflow>('capabilities/save',{proposalId:proposal.id}));if(active.current){open(saved);await load();window.dispatchEvent(new Event('hosted-workspace-changed'));}})}>Save reviewed agent</Button>}
    </Card>}
    {definition&&(proposal||selected?.canEnhance!==false)&&<Card><h2>{selected&&!proposal?'Enhance this agent':'Optional enhancements'}</h2><p>Add a capability through the same discovery and resolution process.</p><div className="capability-actions">{definition.capability?.suggestions.map(s=><Button key={s} disabled={busy||running||configured!==true} onClick={()=>void plan(s)}>{s}</Button>)}</div><label>Custom capability<input value={addition} maxLength={1000} disabled={busy||running} onChange={e=>setAddition(e.target.value)} placeholder="Generate a practice quiz from the summary"/></label><Button disabled={busy||running||configured!==true||addition.trim().length<3} onClick={()=>void plan(addition)}>Resolve addition</Button></Card>}
    {selected&&!proposal&&<Card><h2>{ui?.inputLabel ?? 'Agent input'}</h2>{audioInput?<AudioInput key={selected.id} disabled={busy||running} onChange={value=>{setAudio(value);setConfirmed(false);}}/>:<label>{selected.steps.some(s=>s.format==='json'&&s.inputFrom==='original')?'JSON object':'Source text'}<textarea value={text} maxLength={20000} disabled={busy||running} onChange={e=>{setText(e.target.value);setConfirmed(false);}}/></label>}
      <label className="capability-confirm"><input type="checkbox" checked={confirmed} disabled={busy||running} onChange={e=>setConfirmed(e.target.checked)}/>Send this input and intermediate outputs to the listed providers and run these capabilities.</label>
      <Button variant="primary" disabled={busy||running||!confirmed||!!run||(audioInput?!audio:!text.trim())} onClick={()=>void execute()}>{ui?.actionLabel ?? 'Run agent'}</Button>
      {local&&<p className="hint">Keep the local workflow worker running to process queued tasks.</p>}
      {!local&&<p className="hint">Keep this page open while steps advance. Refreshing never repeats an uncertain step.</p>}
      {run&&<p role="status">Run {run.status}{run.error?`: ${run.error}`:''}</p>}
      {run&&['completed','failed'].includes(run.status)&&<Button disabled={busy} onClick={()=>{setRun(undefined);requestKey.current=undefined;setConfirmed(false);}}>Prepare another run</Button>}
      {!local&&run&&['running','ready'].includes(run.status)&&<Button disabled={busy||!confirmed} onClick={()=>void work(async()=>{const fresh=await request<HostedRun>(`workflows/runs/${run.id}`);setRun(fresh);if(fresh.status==='ready')await advance(fresh);else if(fresh.status==='running')setRun(await request<HostedRun>(`workflows/runs/${fresh.id}/advance`,{expectedStep:fresh.outputs.length,confirmExternalExecution:true}));})}>Refresh / continue</Button>}
    </Card>}
    {selected&&!proposal&&<OutputPanels key={`${selected.id}:${run?.id??"empty"}`} agent={selected} outputs={run?.outputs??[]}/>}
    {selected&&!proposal&&history.length>0&&<Card><h2>Saved runs</h2>{history.map(item=><Button key={item.id} disabled={busy||running} onClick={()=>{setRun(item);setConfirmed(false);}}>{item.id.slice(0,8)} · {item.status}</Button>)}</Card>}
    <Card><h2>Your agents</h2>{latest.map(agent=><article key={agent.id} className="capability-saved"><div><strong>{agent.name}</strong><p>{agent.steps.length} capabilities · Revision {agent.revision?.number??1}</p></div><Button disabled={busy||running} onClick={()=>open(agent)}>Open / enhance</Button></article>)}{!latest.length&&<p>No saved workflows yet.</p>}</Card>
  </PageShell>;
}

function AudioInput({ disabled, onChange }: { disabled: boolean; onChange: (value: Value | undefined) => void }) {
  const [recording,setRecording]=useState(false),[name,setName]=useState(''),[error,setError]=useState('');
  const recorder=useRef<MediaRecorder|undefined>(undefined),stream=useRef<MediaStream|undefined>(undefined),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),mounted=useRef(true);
  const notify=useRef(onChange);notify.current=onChange;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;clearTimeout(timer.current);if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());};},[]);
  async function accept(blob: Blob, label: string) {
    if(!mounted.current)return;
    setError('');notify.current(undefined);
    if(!blob.size||blob.size>MAX_AUDIO_BYTES){setError('Choose a nonempty audio clip of at most 1 MB.');return;}
    const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Could not read audio'));reader.readAsDataURL(blob);});
    if(!mounted.current)return;
    const parsed=valueSchema.safeParse({type:'audio',mimeType:blob.type.split(';')[0],value:data});
    if(!parsed.success){setError('Supported audio: WebM, Ogg, WAV, MP3, or MP4.');return;}
    setName(`${label} · ${Math.ceil(blob.size/1000)} KB`);notify.current(parsed.data);
  }
  async function start() {
    setError('');
    try{
      if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw new Error('Recording is unavailable in this browser. Upload an audio clip instead.');
      const media=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!mounted.current){media.getTracks().forEach(t=>t.stop());return;}
      stream.current=media;
      const mime=['audio/webm','audio/mp4','audio/ogg'].find(type=>MediaRecorder.isTypeSupported(type));
      if(!mime)throw new Error('No supported recording format. Upload an audio clip instead.');
      const rec=new MediaRecorder(media,{mimeType:mime,audioBitsPerSecond:64000});recorder.current=rec;
      const chunks:Blob[]=[];let size=0;
      rec.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);size+=e.data.size;if(size>=MAX_AUDIO_BYTES&&rec.state==='recording')rec.stop();}};
      rec.onstop=()=>{clearTimeout(timer.current);media.getTracks().forEach(t=>t.stop());if(mounted.current){setRecording(false);void accept(new Blob(chunks,{type:mime}),'Recorded audio').catch(e=>setError(e.message));}};
      rec.onerror=()=>{media.getTracks().forEach(t=>t.stop());if(mounted.current){setRecording(false);setError('Recording failed. Try uploading audio.');}};
      rec.start(1000);setRecording(true);notify.current(undefined);timer.current=setTimeout(()=>{if(rec.state==='recording')rec.stop();},60000);
    }catch(e){stream.current?.getTracks().forEach(t=>t.stop());setError(e instanceof Error?e.message:'Microphone access failed');}
  }
  return <div><p>Record up to 60 seconds or upload an audio clip up to 1 MB.</p><Button disabled={disabled} onClick={()=>recording?recorder.current?.stop():void start()}>{recording?'Stop recording':'Record audio'}</Button><label>Upload audio<input type="file" accept="audio/webm,audio/ogg,audio/wav,audio/mpeg,audio/mp4" disabled={disabled||recording} onChange={e=>{const file=e.target.files?.[0];if(file)void accept(file,file.name).catch(e=>setError(e.message));}}/></label>{name&&<p role="status">{name}</p>}{error&&<p role="alert">{error}</p>}</div>;
}

function OutputPanels({agent,outputs}:{agent:Agent;outputs:Value[]}) {
  const [tab,setTab]=useState(0);
  const ui=agent.capability?.ui;
  const panels=ui?.panels??agent.steps.map((s,step)=>({step,title:s.name,component:'text' as const}));
  const [href,setHref]=useState('');
  useEffect(()=>{if(!outputs.length){setHref('');return;}const url=URL.createObjectURL(new Blob([JSON.stringify(outputs,null,2)],{type:'application/json'}));setHref(url);return()=>URL.revokeObjectURL(url);},[outputs]);
  useEffect(()=>setTab(0),[agent.id]);
  return <section aria-label="Agent results"><div className="capability-actions">{ui?.layout==='tabs'&&panels.map((p,i)=><Button key={p.step} aria-pressed={i===tab} onClick={()=>setTab(i)}>{p.title}</Button>)}{href&&<a className="btn btn-secondary" href={href} download="agent-results.json">Download results</a>}</div><div className={`capability-results ${ui?.layout==='columns'?'capability-columns':''}`}>
    {panels.map((p,i)=>(ui?.layout!=='tabs'||i===tab)&&<Card key={p.step}><h2>{p.title}</h2>{outputs[p.step]?<Output key={`${agent.id}:${p.step}:${JSON.stringify(outputs[p.step]).slice(0,80)}`} value={outputs[p.step]} component={p.component}/>:<p>Run the agent to see this output.</p>}</Card>)}
  </div></section>;
}
function Output({value,component}:{value:Value;component:string}) {
  if(value.type==='json'&&component==='flashcards'&&Array.isArray(value.value.cards))return <div>{(value.value.cards as {front:string;back:string}[]).map((card,i)=><details className="study-card" key={i}><summary>{card.front}</summary><p>{card.back}</p></details>)}</div>;
  if(value.type==='json'&&component==='quiz'&&Array.isArray(value.value.questions))return <div>{(value.value.questions as {question:string;options:string[];answer:number;explanation:string}[]).map((q,i)=><QuizQuestion key={i} question={q}/>)}</div>;
  if(value.type==='json'&&component==='table')return <table><tbody>{Object.entries(value.value).map(([key,item])=><tr key={key}><th>{key}</th><td>{typeof item==='string'?item:JSON.stringify(item)}</td></tr>)}</tbody></table>;
  return <pre className="capability-output">{value.type==='audio'?'Audio source':typeof value.value==='string'?value.value:JSON.stringify(value.value,null,2)}</pre>;
}
function QuizQuestion({question:q}:{question:{question:string;options:string[];answer:number;explanation:string}}) {
  const [answer,setAnswer]=useState<number>();
  return <fieldset className="study-card"><legend>{q.question}</legend>{q.options.map((option,i)=><Button key={i} aria-pressed={answer===i} onClick={()=>setAnswer(i)}>{option}</Button>)}{answer!==undefined&&<p role="status">{answer===q.answer?'Correct.':`Correct answer: ${q.options[q.answer]}.`} {q.explanation}</p>}</fieldset>;
}
