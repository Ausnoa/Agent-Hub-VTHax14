"use client";
import { useCallback,useEffect,useLayoutEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { Maximize2,Minimize2,X } from 'lucide-react';
import { useAccount } from '../../lib/hosted/use-account';
import { hostedApi } from '../../lib/hosted/browser';
import type { HostedWorkflow,HostedRun } from '../../lib/hosted/workflow-contracts';
import type { OwnedAgent } from '../../lib/owned-agent/templates';
import { variantFor } from '../../lib/agent-ui/variant';
import AgentAvatar from '../agent-runtime/agent-avatar';
import CatAgentBar from '../agent-runtime/cat-agent-bar';
import Mascot from '../agent-runtime/mascot';
import './cat.css';
import {chatPosition} from '../../lib/agent-ui/chat-position';
type Target={id:string;name:string;kind:'agent'|'workflow';createdAt:string;workflow?:HostedWorkflow};
type Message={id:string;input:string;output:string;status:string};
export default function HostedCatRuntime(){const account=useAccount();return account.session?<CatPack key={account.session.user.id} userId={account.session.user.id}/>:null;}
function CatPack({userId}:{userId:string}){
  const [targets,setTargets]=useState<Target[]>([]),[hidden,setHidden]=useState<string[]>([]),[selected,setSelected]=useState<string>();
  const [status,setStatus]=useState<Record<string,'idle'|'working'|'done'|'error'>>({});
  useEffect(()=>{let active=true;const refresh=()=>{Promise.all([hostedApi<OwnedAgent[]>('agents'),hostedApi<HostedWorkflow[]>('workflows')]).then(([agents,workflows])=>{if(active)setTargets([...agents.map(a=>({id:a.id,name:a.name,kind:'agent' as const,createdAt:a.createdAt})),...workflows.map(w=>({id:w.id,name:w.definition.name,kind:'workflow' as const,createdAt:w.created_at,workflow:w}))].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));}).catch(()=>{/* Main workspace shows account/storage errors. */});};refresh();window.addEventListener('hosted-workspace-changed',refresh);return()=>{active=false;window.removeEventListener('hosted-workspace-changed',refresh);};},[]);
  const [hiddenReady,setHiddenReady]=useState(false),[spawn,setSpawn]=useState<{id:string;name:string;skills:string[]}[]>([]);
  useEffect(()=>{try{const value=JSON.parse(localStorage.getItem(`hosted-hidden-cats:${userId}`)??'[]');if(Array.isArray(value))setHidden(value.filter(v=>typeof v==='string'));}catch{}setHiddenReady(true);},[userId]);
  useEffect(()=>{if(hiddenReady)try{localStorage.setItem(`hosted-hidden-cats:${userId}`,JSON.stringify(hidden));}catch{}},[hidden,hiddenReady,userId]);
  useEffect(()=>{const created=(e:Event)=>{const item=(e as CustomEvent).detail;if(item&&typeof item.id==='string'&&typeof item.name==='string'&&Array.isArray(item.skills))setSpawn(old=>[...old,{id:item.id,name:item.name,skills:item.skills.filter((s:unknown)=>typeof s==='string')}]);};window.addEventListener('hosted-agent-created',created);return()=>window.removeEventListener('hosted-agent-created',created);},[]);
  useEffect(()=>{if(!spawn.length)return;const timer=setTimeout(()=>setSpawn(old=>old.slice(1)),2400);return()=>clearTimeout(timer);},[spawn]);
  const visible=hiddenReady?targets.filter(t=>!hidden.includes(t.id)&&!spawn.some(s=>s.id===t.id)):[];const target=targets.find(t=>t.id===selected);
  // Same index the bar cat uses for its color, so the chat header's mascot always matches the
  // cat you actually clicked instead of a second, unrelated hash-based color.
  const targetIndex=target?visible.findIndex(item=>item.id===target.id):-1;
  // The bar owns cat position via raw DOM style updates during drag, not React state this
  // component can subscribe to, so the open cat's chat window tracks it by reading the DOM
  // directly, every frame, for as long as a chat is open.
  const catNodes=useRef(new Map<string,HTMLDivElement>());
  const [anchor,setAnchor]=useState<{x:number;y:number}>();
  useEffect(()=>{
    if(!selected)return;
    let frame:number;
    const measure=()=>{
      const node=catNodes.current.get(selected);
      if(node){const rect=node.getBoundingClientRect();setAnchor(old=>old&&old.x===rect.left&&old.y===rect.top?old:{x:rect.left,y:rect.top});}
      frame=requestAnimationFrame(measure);
    };
    frame=requestAnimationFrame(measure);
    return()=>cancelAnimationFrame(frame);
  },[selected]);
  return <>{spawn[0]&&<div key={spawn[0].id} className="agent-spawn" style={{zIndex:110}} aria-live="polite"><div className="agent-spawn-card"><span className="agent-spawn-halo"/><Mascot width={96} variant={variantFor(spawn[0].id,0)}/><span className="agent-spawn-kicker">Agent created</span><strong>{spawn[0].name}</strong><div className="agent-spawn-tags">{spawn[0].skills.slice(0,3).map((skill,i)=><span key={i}>{skill}</span>)}</div><small>Heading to the corner — click your cat to open its chat.</small></div></div>}
    <CatAgentBar
      storageKey={`hosted:${userId}`}
      candidates={visible.map(item=>({id:`hosted:${item.id}`,name:item.name}))}
      renderCat={(agentId,drag)=>{
        const item=visible.find(candidate=>`hosted:${candidate.id}`===agentId);
        if(!item)return null;
        const index=visible.indexOf(item);
        return <AgentAvatar key={item.id} agentId={agentId} name={item.name} variant={variantFor(item.id,index)} status={status[item.id]??'idle'} inline {...drag} dimmed={Boolean(selected&&selected!==item.id)} onOpen={()=>{if(!Object.values(status).includes('working'))setSelected(item.id);}} onRemove={()=>{if(status[item.id]==='working')return;setHidden(old=>[...old,item.id]);if(selected===item.id)setSelected(undefined);}} elementRef={el=>{if(el)catNodes.current.set(item.id,el);else catNodes.current.delete(item.id);}}/>;
      }}
    />
    {target&&<CatChat key={target.id} target={target} anchor={anchor} variantIndex={targetIndex>=0?targetIndex:undefined} onClose={()=>setSelected(undefined)} onStatus={value=>setStatus(old=>({...old,[target.id]:value}))}/>}
  </>;
}
function CatChat({target,anchor,variantIndex,onClose,onStatus}:{target:Target;anchor?:{x:number;y:number};variantIndex?:number;onClose:()=>void;onStatus:(status:'idle'|'working'|'done'|'error')=>void}){
  const [expanded,setExpanded]=useState(false),[text,setText]=useState(''),[json,setJson]=useState(false),[confirmed,setConfirmed]=useState(false);
  const [messages,setMessages]=useState<Message[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const lock=useRef(false),active=useRef(true),request=useRef<{key:string;id:string}|null>(null),dialog=useRef<HTMLElement>(null);
  const [placement,setPlacement]=useState<{left:number;top:number;maxHeight:number}>();
  useLayoutEffect(()=>{
    const element=dialog.current;if(!element||expanded||!anchor)return;
    const update=()=>{const rect=element.getBoundingClientRect();const maxHeight=Math.max(120,Math.min(window.innerHeight-100,Math.max(anchor.y-84,window.innerHeight-anchor.y-88)));const next={...chatPosition(anchor,{width:rect.width,height:Math.min(rect.height,maxHeight)},{width:window.innerWidth,height:window.innerHeight}),maxHeight};setPlacement(old=>old?.left===next.left&&old?.top===next.top&&old?.maxHeight===next.maxHeight?old:next);};
    update();const observer=new ResizeObserver(update);observer.observe(element);window.addEventListener('resize',update);
    return()=>{observer.disconnect();window.removeEventListener('resize',update);};
  },[anchor,expanded]);
  const [pending,setPending]=useState<HostedRun>();
  const refresh=useCallback(async()=>{
    if(target.kind==='agent'){
      const tests=await hostedApi<{id:string;input?:string;output:string|null;status:string}[]>(`agents/${target.id}/tests`);
      if(active.current)setMessages(tests.slice().reverse().map(t=>({id:t.id,input:t.input??'Saved agent test',output:t.output??'No result yet.',status:t.status})));
    }else{
      const runs=await hostedApi<HostedRun[]>('workflows/runs');
      if(active.current)setMessages(runs.filter(r=>r.workflow_id===target.id).reverse().map(r=>({id:r.id,input:typeof r.input.value==='string'?r.input.value:JSON.stringify(r.input.value),output:r.error??(r.outputs.length?String(typeof r.outputs.at(-1)!.value==='string'?r.outputs.at(-1)!.value:JSON.stringify(r.outputs.at(-1)!.value,null,2)):'No output yet.'),status:r.status})));
    }
  },[target.id,target.kind]);
  useEffect(()=>{active.current=true;refresh().catch(()=>{if(active.current)setError('Could not load saved results.');});dialog.current?.focus();return()=>{active.current=false;};},[refresh]);
  useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!lock.current)onClose();};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[onClose]);
  async function execute(){
    if(lock.current||!confirmed||!text.trim())return;lock.current=true;setBusy(true);setError('');onStatus('working');
    try{
      if(target.kind==='agent')await hostedApi(`agents/${target.id}/test`,{text});
      else{
        const input=json?{type:'json',value:JSON.parse(text)}:{type:'text',value:text};const key=JSON.stringify(input);
        if(!request.current||request.current.key!==key)request.current={key,id:crypto.randomUUID()};
        let run=await hostedApi<HostedRun>(`workflows/${target.id}/invoke`,{requestId:request.current.id,input,confirmExternalExecution:true});
        if(active.current)setPending(run);
        while(active.current&&run.status==='ready'){
          run=await hostedApi<HostedRun>(`workflows/runs/${run.id}/advance`,{expectedStep:run.outputs.length,confirmExternalExecution:true});if(active.current)setPending(run);
        }
        if(run.status==='failed')throw new Error(run.error??'Workflow failed');
        if(run.status!=='completed')throw new Error('A step is still running. Refresh status before starting another run.');
      }
      if(active.current){onStatus('done');setText('');setConfirmed(false);request.current=null;setPending(undefined);}
    }catch(e){if(active.current){onStatus('error');setError(`${e instanceof Error?e.message:'Request failed'}. Check history before starting another run.`);setConfirmed(false);}}
    finally{try{await refresh();}catch{/* Retain original execution error. */}window.dispatchEvent(new Event('hosted-workspace-changed'));lock.current=false;if(active.current)setBusy(false);}
  }
  return <section className={`hosted-cat-chat${expanded?' expanded':''}`} style={!expanded&&placement?{left:placement.left,top:placement.top,maxHeight:placement.maxHeight,right:'auto',bottom:'auto'}:undefined} role="dialog" aria-label={`${target.name} cat chat`} tabIndex={-1} ref={dialog}>
    <header><Mascot width={34} variant={variantFor(target.id,variantIndex)}/><div><strong>{target.name}</strong><small>{target.kind==='workflow'?'Workflow companion':'Agent companion'}</small></div><button onClick={()=>setExpanded(!expanded)} aria-label={expanded?'Minimize cat chat':'Expand cat chat'}>{expanded?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button><button disabled={busy} onClick={onClose} aria-label="Close cat chat"><X size={16}/></button></header>
    <div className="cat-chat-body"><p className="hint">Each message starts an independent {target.kind==='workflow'?'workflow run':'agent test'}. Previous messages are not sent as context.</p>
      <Link href={target.kind==='workflow'?`/create?workflow=${target.id}`:`/agent-preview?agent=${target.id}`}>Open {target.kind==='workflow'?'workflow':'agent'} →</Link>
      {target.workflow&&<details><summary>Review {target.workflow.definition.steps.length} steps</summary><ol>{target.workflow.definition.steps.map((s,i)=><li key={i}>{s.name} · {s.skill}<br/>{s.agentId.startsWith('template:')?'Your private template':s.endpoint}</li>)}</ol></details>}
      <div className="cat-messages" aria-live="polite">{!messages.length&&<p>No saved messages yet. Send a task to get started.</p>}{messages.map(m=><article key={m.id}><p className="cat-user">{m.input}</p><pre>{m.output}</pre><small>{m.status}</small></article>)}</div>
      {error&&<p role="alert" className="alert">{error}</p>}
      {pending&&<p role="status">{pending.status} · {pending.outputs.length} steps completed</p>}
      <form onSubmit={e=>{e.preventDefault();void execute();}}>
        {target.kind==='workflow'&&<label className="cat-confirm"><input type="checkbox" checked={json} disabled={busy} onChange={e=>{setJson(e.target.checked);setConfirmed(false);}}/>Send a JSON object</label>}
        <label>Message to {target.name}<textarea value={text} maxLength={12000} disabled={busy} onChange={e=>{setText(e.target.value);setConfirmed(false);}} placeholder="Give this agent a task…"/></label>
        <label className="cat-confirm"><input type="checkbox" disabled={busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{target.kind==='workflow'?'I reviewed the steps and authorize sending this message and outputs to the selected agents and OpenAI, including their actions.':'Send this message to OpenAI to run my saved template.'}</label>
        <div className="cat-actions"><button type="submit" className="btn btn-primary" disabled={busy||!confirmed||!text.trim()}>{busy?'Working…':'Send task'}</button><button type="button" disabled={busy} onClick={()=>void refresh().catch(()=>setError('Could not refresh history.'))}>Refresh history</button></div>
      </form>
    </div>
  </section>;
}
