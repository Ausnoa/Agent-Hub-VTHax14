"use client";
import { useCallback,useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { hostedApi } from '../../lib/hosted/browser';
import { useAccount } from '../../lib/hosted/use-account';
import { templateFor,type OwnedAgent } from '../../lib/owned-agent/templates';
import type { Candidate,HostedWorkflow,HostedRun } from '../../lib/hosted/workflow-contracts';
import type { PublicAgentSummary } from './public-agent-card';
import type { PublicAgent } from '../../lib/hosted/discover';
import type { Selection } from '../../lib/general/contracts';
import {showcaseAgents,showcaseDraft} from "../../lib/hosted/showcase";
import {ArchiveButton,ArchivedItems} from "./archive-controls";
import HostedDiscover from "./discover-page";
import WorkflowGraph from "./workflow-graph";
import PageShell from '../layout/page-shell';
import PageHeader from '../layout/page-header';
import Card from '../ui/card';
import Button from '../ui/button';
import SegmentedControl from '../ui/segmented-control';
import './workflows.css';
type Mode='discover'|'compose'|'history';
// Where the agent finder is currently reading from. All three end in the same add().
type FinderSource='ans'|'mine'|'saved';
function mergeCandidates(items:Candidate[]){const map=new Map<string,Candidate>();for(const item of items){const old=map.get(item.agentId);map.set(item.agentId,{...item,skills:[...new Map([...(old?.skills??[]),...item.skills].map(s=>[s.id,s])).values()]});}return [...map.values()];}
export default function WorkflowPages({mode}:{mode:Mode}){
  const account=useAccount();
  if(!account.ready)return <PageShell><p role="status">Loading account…</p></PageShell>;
  if(!account.session)return <PageShell narrow><PageHeader eyebrow="HOSTED WORKSPACE" title={mode==='discover'?'Discover agents':mode==='compose'?'Compose a workflow':'Workflow history'} description="Sign in to discover agents, compose workflows, and keep your runs private."/><Link href={`/login?next=${mode==='discover'?'/discover':mode==='compose'?'/create':'/execution'}`}>Sign in or create an account →</Link>{account.error&&<p role="alert">{account.error}</p>}</PageShell>;
  return <Workspace key={`${account.session.user.id}:${mode}`} mode={mode}/>;
}
function Workspace({mode}:{mode:Mode}){
  const router=useRouter();const active=useRef(true);
  const [candidates,setCandidates]=useState<Candidate[]>([]),[workflows,setWorkflows]=useState<HostedWorkflow[]>([]),[runs,setRuns]=useState<HostedRun[]>([]);
  // Kept apart from `candidates` so bookmarked agents merged in for name resolution
  // are never mislabelled as the signed-in user's own templates.
  const [myCandidates,setMyCandidates]=useState<Candidate[]>([]);
  const [finderOpen,setFinderOpen]=useState(false),[finderSource,setFinderSource]=useState<FinderSource>('ans');
  const [favorites,setFavorites]=useState<PublicAgent[]>(),[favoritesError,setFavoritesError]=useState('');
  const finderAnchor=useRef<HTMLDivElement>(null);
  const [publicAgents,setPublicAgents]=useState<PublicAgentSummary[]>(),[publicAgentsError,setPublicAgentsError]=useState('');
  const [hasSearched,setHasSearched]=useState(false);
  const [query,setQuery]=useState(''),[searched,setSearched]=useState(''),[nextPage,setNextPage]=useState<string>();
  const [name,setName]=useState('My workflow'),[description,setDescription]=useState(''),[summary,setSummary]=useState(''),[steps,setSteps]=useState<Selection[]>([]);
  const [selected,setSelected]=useState<HostedWorkflow>(),[run,setRun]=useState<HostedRun>();
  const [source,setSource]=useState(''),[inputFormat,setInputFormat]=useState<'text'|'json'>('text'),[confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [suggesting,setSuggesting]=useState(false),[suggestionError,setSuggestionError]=useState(''),[suggestionNotice,setSuggestionNotice]=useState('');
  const requestKey=useRef<{key:string;id:string}|undefined>(undefined);
  function open(workflow:HostedWorkflow){setSelected(workflow);setName(workflow.definition.name);setSummary(workflow.definition.description);setSteps(workflow.definition.steps);setRun(undefined);setConfirmed(false);setError('');}
  useEffect(()=>{
    active.current=true;
    Promise.all([hostedApi<OwnedAgent[]>('agents'),hostedApi<HostedWorkflow[]>('workflows'),hostedApi<HostedRun[]>('workflows/runs')]).then(([agents,saved,history])=>{
      if(!active.current)return;
      const mine:Candidate[]=agents.map(agent=>({agentId:`template:${agent.id}`,name:agent.name,description:agent.instructions||templateFor(agent.template).description,source:'template',skills:[{id:templateFor(agent.template).skill,name:templateFor(agent.template).name,tags:[]}]}));
      setCandidates(mine);setMyCandidates(mine);
      setWorkflows(saved);setRuns(history);
      const params=new URLSearchParams(location.search),workflow=saved.find(w=>w.id===params.get('workflow'));
      if(workflow)open(workflow);
      if(mode==='compose'){
        const directive=sessionStorage.getItem('stitch-workflow-directive');
        if(directive){setDescription(directive.slice(0,2000));sessionStorage.removeItem('stitch-workflow-directive');}
        const demo=showcaseDraft(params.get('showcase')??'');
        if(demo){setName(demo.name);setSteps(demo.steps);setSource(params.has('blank')?'':demo.input);setCandidates(old=>mergeCandidates([...old,...showcaseAgents.map(a=>({agentId:a.id,name:a.name,description:a.purpose,source:'ans' as const,endpoint:`${a.origin}/a2a`,skills:[{id:a.skill,name:a.name,tags:[]}]}))]));setSelected(undefined);setRun(undefined);setConfirmed(false);return;}

        const pending=sessionStorage.getItem('hosted-workflow-step');
        if(pending){sessionStorage.removeItem('hosted-workflow-step');const value=JSON.parse(pending);if(typeof value.agentId==='string'&&typeof value.skill==='string'){setSelected(undefined);setSteps([{agentId:value.agentId,skill:value.skill,format:'text',inputFrom:'original',instruction:''}]);}}
      }
    }).catch(e=>{if(active.current)setError(e.message);}).finally(()=>{if(active.current)setLoading(false);});
    return()=>{active.current=false;};
  },[mode]);
  // Discover public agents lives at the bottom of the Discover page (moved off the dashboard);
  // only fetched in that mode.
  useEffect(()=>{
    if(mode!=='discover')return;
    let live=true;
    // Full list (the discover endpoint itself caps at 60), not just a preview slice — the
    // Discover page shows the whole thing in a scrollable row with its own search.
    hostedApi<PublicAgentSummary[]>('discover?query=').then(data=>{if(live)setPublicAgents(data);}).catch(e=>{if(live)setPublicAgentsError(e instanceof Error?e.message:'Could not load public agents');});
    return()=>{live=false;};
  },[mode]);
  // Bookmarks are fetched only once the finder actually shows them.
  useEffect(()=>{
    if(!finderOpen||finderSource!=='saved'||favorites)return;
    let live=true;
    hostedApi<PublicAgent[]>('saved').then(data=>{if(live)setFavorites(data);}).catch(e=>{if(live)setFavoritesError(e instanceof Error?e.message:'Could not load your favorite agents');});
    return()=>{live=false;};
  },[finderOpen,finderSource,favorites]);
  async function task(work:()=>Promise<void>){setBusy(true);setError('');try{await work();}catch(e){if(active.current)setError(e instanceof Error?e.message:'Request failed');}finally{if(active.current)setBusy(false);}}
  async function toggleVisibility(workflow:HostedWorkflow){await task(async()=>{
    const updated=await hostedApi<HostedWorkflow>(`workflows/${workflow.id}/visibility`,{visibility:workflow.visibility==='public'?'private':'public'});
    if(active.current){setWorkflows(old=>old.map(w=>w.id===updated.id?updated:w));if(selected?.id===updated.id)setSelected(updated);}
  });}
  async function suggest(){
    if(busy)return;
    setBusy(true);setSuggesting(true);setError('');setSuggestionError('');setSuggestionNotice('');
    try{
      const result=await hostedApi<{draft:{name:string;steps:Selection[]};candidates:Candidate[]}>('workflows/suggest',{description,query});
      if(!active.current)return;
      if(!result.draft.steps.length)throw new Error('No suitable workflow was found. Try a more specific outcome or add a matching agent.');
      setName(result.draft.name);setSteps(result.draft.steps);setCandidates(old=>mergeCandidates([...old,...result.candidates]));setSelected(undefined);setRun(undefined);setConfirmed(false);
      setSuggestionNotice(`Suggested ${result.draft.steps.length} steps for “${result.draft.name}”. Review the graph and steps below, then save.`);
      requestAnimationFrame(()=>{if(active.current){const graph=document.getElementById('suggested-workflow');graph?.focus({preventScroll:true});graph?.scrollIntoView({block:'start'});}});
    }catch(e){if(active.current)setSuggestionError(e instanceof Error?e.message:'Could not suggest a workflow. Please try again.');}
    finally{if(active.current){setBusy(false);setSuggesting(false);}}
  }
  async function search(more=false){await task(async()=>{const result=await hostedApi<{candidates:Candidate[];nextPageToken?:string}>('registry/search',{query:more?searched:query,...(more?{pageToken:nextPage}:{})});if(active.current){setCandidates(old=>mergeCandidates([...(more?old:old.filter(a=>a.source==='template')),...result.candidates]));setHasSearched(true);setSearched(query);setNextPage(result.nextPageToken);}});}
  function add(candidate:Candidate,skill:string){
    if(mode==='discover'){sessionStorage.setItem('hosted-workflow-step',JSON.stringify({agentId:candidate.agentId,skill}));router.push('/create');return;}
    setSteps(old=>[...old,{agentId:candidate.agentId,skill,inputFrom:old.length?'previous':'original',format:'text',instruction:''}]);setSelected(undefined);setRun(undefined);setConfirmed(false);
  }
  // Every finder source funnels into add(); merging the candidate first keeps a
  // bookmarked agent's name resolvable in the graph and step list before saving.
  function addFromFinder(candidate:Candidate,skill:string){setCandidates(old=>mergeCandidates([...old,candidate]));add(candidate,skill);}
  const closeFinder=useCallback(()=>{setFinderOpen(false);finderAnchor.current?.querySelector('button')?.focus();},[]);
  function edit(index:number,patch:Partial<Selection>){setSteps(old=>old.map((s,i)=>i===index?{...s,...patch}:s));setSelected(undefined);setRun(undefined);setConfirmed(false);}
  async function advance(current:HostedRun){
    while(active.current&&current.status==='ready'){
      setRun({...current,status:'running'});
      current=await hostedApi<HostedRun>(`workflows/runs/${current.id}/advance`,{expectedStep:current.outputs.length,confirmExternalExecution:true});
      if(active.current)setRun(current);
    }
    if(active.current){setRuns(await hostedApi<HostedRun[]>('workflows/runs'));window.dispatchEvent(new Event('hosted-workspace-changed'));}
  }
  async function start(){if(!selected||!confirmed)return;await task(async()=>{
    const input=inputFormat==='text'?{type:'text',value:source}:{type:'json',value:JSON.parse(source)};
    const key=JSON.stringify([selected.id,input]);if(requestKey.current?.key!==key)requestKey.current={key,id:crypto.randomUUID()};
    const current=await hostedApi<HostedRun>(`workflows/${selected.id}/invoke`,{requestId:requestKey.current.id,input,confirmExternalExecution:true});
    if(active.current){setRun(current);await advance(current);}
  });}
  if(mode==='discover')return <HostedDiscover candidates={candidates} query={query} setQuery={setQuery} busy={busy} loading={loading} error={error} searched={hasSearched} hasMore={Boolean(nextPage)} search={search} add={add} publicAgents={publicAgents} publicAgentsError={publicAgentsError}/>;
  const title=mode==='compose'?'Compose a workflow':'Workflow runs';
  return <PageShell className="hosted-workflows"><PageHeader eyebrow="YOUR HOSTED WORKSPACE" title={title} description={mode==='compose'?'Connect up to eight agents, review the steps, then run them with your input.':'Your latest 20 workflow runs. Open a workflow to review its saved steps and continue between completed steps.'}/>
    {loading&&<p role="status">Loading your workspace…</p>}{error&&<div role="alert" className="alert">{error}</div>}
    {mode==='compose'&&<>
      <div className="celestial-composer-grid">
      <Card id="suggested-workflow" tabIndex={-1} style={{scrollMarginTop:90}}>
        <div className="workflow-graph-head"><h2>Workflow graph</h2>
          <div className="workflow-graph-actions" ref={finderAnchor}><Button aria-expanded={finderOpen} aria-controls="agent-finder" disabled={loading} onClick={()=>finderOpen?closeFinder():setFinderOpen(true)}>{finderOpen?'Close agent finder':'Find agents'}</Button>
            {finderOpen&&<AgentFinder source={finderSource} setSource={setFinderSource} close={closeFinder} query={query} setQuery={setQuery} search={search} busy={busy} loading={loading} searched={hasSearched} hasMore={Boolean(nextPage)} ansResults={candidates.filter(c=>c.source==='ans')} myAgents={myCandidates} favorites={favorites} favoritesError={favoritesError} full={steps.length>=8} add={addFromFinder}/>}
          </div>
        </div>
        <WorkflowGraph steps={steps} names={steps.map((s,i)=>selected?.definition.steps[i]?.name??candidates.find(c=>c.agentId===s.agentId)?.name??s.skill)} run={run}/>
      </Card>
      <Card className="celestial-directive" aria-busy={suggesting}><p className="eyebrow">DESCRIBE YOUR WORKFLOW</p><h2>Start with an outcome.</h2><label>Desired outcome<textarea value={description} maxLength={2000} disabled={busy} onChange={e=>{setDescription(e.target.value);setSuggestionNotice('');setSuggestionError('');}} placeholder="Summarize my meeting notes, then extract owners and deadlines."/></label>
        <Button variant="primary" block disabled={busy||loading||description.trim().length<10} onClick={()=>void suggest()}>{suggesting?'Suggesting workflow…':'Suggest workflow'}</Button>
        {description.trim().length<10&&<p className="hint">Describe your desired outcome in at least 10 characters to get a suggestion.</p>}
        <p role="status" aria-live="polite">{suggesting?'Finding agents and drafting your workflow. This can take up to a minute.':suggestionNotice}</p>
        {suggestionError&&<p role="alert" className="alert">{suggestionError}</p>}
        <p className="hint">Uses your saved templates and the first page of ANS results for the query in Find agents. Sends the description and candidate details to OpenAI. Up to 10 suggestions per UTC day; review every proposed step.</p>
      </Card>
      </div>
      <Card><h2>Review the steps</h2><label>Workflow name<input value={name} maxLength={100} disabled={busy} onChange={e=>{setName(e.target.value);setSelected(undefined);setRun(undefined);setConfirmed(false);}}/></label>
        <label>Public summary (shown on Discover if you publish this workflow)<textarea value={summary} maxLength={300} disabled={busy} onChange={e=>{setSummary(e.target.value);setSelected(undefined);setRun(undefined);setConfirmed(false);}} placeholder="What does this workflow do, and who is it for?"/></label>
        {steps.map((step,index)=><article id={`hosted-step-${index}`} className="hosted-step" key={index}><h3>{index+1}. {selected?.definition.steps[index]?.name??candidates.find(c=>c.agentId===step.agentId)?.name??step.agentId}</h3><p>{step.skill}</p>
          {selected&&<p className="hint">{step.agentId.startsWith('template:')?'Your private saved template':`Endpoint: ${selected.definition.steps[index].endpoint}`}</p>}
          <div className="hosted-step-controls"><label>Input from<select disabled={busy||index===0} value={step.inputFrom} onChange={e=>edit(index,{inputFrom:e.target.value as Selection['inputFrom']})}><option value="original">Original input</option><option value="previous">Previous step output</option></select></label><label>Format<select disabled={busy||step.agentId.startsWith('template:')} value={step.format} onChange={e=>edit(index,{format:e.target.value as Selection['format'],instruction:''})}><option value="text">Text</option><option value="json">JSON object</option></select></label></div>
          <label>Step instruction<textarea disabled={busy||step.format==='json'} value={step.instruction} maxLength={2000} onChange={e=>edit(index,{instruction:e.target.value})}/></label><Button disabled={busy} onClick={()=>{setSteps(old=>old.filter((_,i)=>i!==index).map((s,i)=>i===0?{...s,inputFrom:'original'}:s));setSelected(undefined);setRun(undefined);setConfirmed(false);}}>Remove step</Button>
        </article>)}
        {!steps.length&&<p>Add agents with Find agents on the workflow graph, or request a suggested workflow.</p>}
        <Button variant="primary" disabled={busy||!steps.length||!name.trim()} onClick={()=>void task(async()=>{const saved=await hostedApi<HostedWorkflow>('workflows',{name,steps,description:summary});if(active.current){setSelected(saved);setSteps(saved.definition.steps);setSummary(saved.definition.description);setRun(undefined);setConfirmed(false);setWorkflows(await hostedApi<HostedWorkflow[]>('workflows'));window.dispatchEvent(new CustomEvent('hosted-agent-created',{detail:{id:saved.id,name:saved.definition.name,kind:'workflow',skills:saved.definition.steps.map(s=>s.skill)}}));window.dispatchEvent(new Event('hosted-workspace-changed'));}})}>Check compatibility and save</Button><p className="hint">Saving checks current ANS endpoints and skill compatibility. Existing workflows remain unchanged when you save a new version.</p>
      </Card>
      {selected&&<Card><h2>Run {selected.definition.name}</h2><label>Input type<select disabled={busy} value={inputFormat} onChange={e=>{setInputFormat(e.target.value as 'text'|'json');setConfirmed(false);}}><option value="text">Text</option><option value="json">JSON object</option></select></label><label>Workflow input<textarea disabled={busy} value={source} maxLength={12000} onChange={e=>{setSource(e.target.value);setConfirmed(false);}}/></label><label className="hosted-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed these steps and authorize sending this input and intermediate outputs to the selected agents (and OpenAI for my templates), including any actions they perform.</label><Button variant="primary" disabled={busy||!source.trim()||!confirmed||Boolean(run)} onClick={()=>void start()}>{busy?'Working…':'Run workflow'}</Button><p className="hint">Up to 10 new runs per UTC day. Private templates share the 20-test daily limit. Keep this page open to advance through the steps. Refreshing never automatically repeats a step.</p>
        {run&&<RunResult run={run}/>} {run&&['completed','failed'].includes(run.status)&&<Button disabled={busy} onClick={()=>{requestKey.current=undefined;setRun(undefined);setConfirmed(false);}}>Prepare a new run</Button>} {run&&['ready','running'].includes(run.status)&&<Button disabled={busy||!confirmed} onClick={()=>void task(async()=>{const fresh=await hostedApi<HostedRun>(`workflows/runs/${run.id}`);setRun(fresh);if(fresh.status==='ready')await advance(fresh);else if(fresh.status==='running')setRun(await hostedApi<HostedRun>(`workflows/runs/${fresh.id}/advance`,{expectedStep:fresh.outputs.length,confirmExternalExecution:true}));})}>Refresh status / continue</Button>}
      </Card>}
      <ArchivedItems kind="workflows" onChanged={()=>void hostedApi<HostedWorkflow[]>('workflows').then(setWorkflows)}/><Card><h2>Your saved workflows</h2>{workflows.map(workflow=><article key={workflow.id}><h3>{workflow.definition.name}</h3><p>{workflow.definition.steps.length} steps · {workflow.visibility==='public'?'Public':'Private'} · {new Date(workflow.created_at).toLocaleString()}</p><Button disabled={busy} onClick={()=>open(workflow)}>Open workflow</Button><ArchiveButton kind="workflows" id={workflow.id} name={workflow.definition.name} onChanged={()=>{if(selected?.id===workflow.id){setSelected(undefined);setRun(undefined);setSteps([]);}void hostedApi<HostedWorkflow[]>('workflows').then(setWorkflows);}}/> <Button disabled={busy} onClick={()=>void toggleVisibility(workflow)}>{workflow.visibility==='public'?'Make private':'Publish'}</Button> <Link href={`/agents/${workflow.id}`}>View detail page →</Link></article>)}{!loading&&!workflows.length&&<p>No saved workflows yet.</p>}</Card>
    </>}
    {<Card><h2>Recent workflow runs</h2>{runs.map(savedRun=><article key={savedRun.id}><h3>{workflows.find(w=>w.id===savedRun.workflow_id)?.definition.name??'Workflow'}</h3><RunResult run={savedRun}/>{mode==='compose'?<Button disabled={busy} onClick={()=>{const w=workflows.find(w=>w.id===savedRun.workflow_id);if(w){open(w);setRun(savedRun);setSource(typeof savedRun.input.value==='string'?savedRun.input.value:JSON.stringify(savedRun.input.value));setInputFormat(savedRun.input.type);}}}>Review run</Button>:<Link href={`/create?workflow=${savedRun.workflow_id}`}>Open workflow →</Link>}</article>)}{!loading&&!runs.length&&<p>No workflow runs yet.</p>}</Card>}
  </PageShell>;
}
type FinderProps={
  source:FinderSource;setSource:(value:FinderSource)=>void;close:()=>void;
  query:string;setQuery:(value:string)=>void;search:(more?:boolean)=>Promise<void>;
  busy:boolean;loading:boolean;searched:boolean;hasMore:boolean;
  ansResults:Candidate[];myAgents:Candidate[];favorites?:PublicAgent[];favoritesError:string;
  full:boolean;add:(candidate:Candidate,skill:string)=>void;
};
// A temporary panel anchored to the graph's Find agents button. It is deliberately
// non-modal: it never covers the whole page and the graph stays readable behind it.
function AgentFinder({source,setSource,close,query,setQuery,search,busy,loading,searched,hasMore,ansResults,myAgents,favorites,favoritesError,full,add}:FinderProps){
  const panel=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    panel.current?.focus();
    function onKey(event:KeyboardEvent){if(event.key==='Escape')close();}
    // The trigger toggles on its own click, so ignore pointer events inside it.
    function onPointer(event:MouseEvent){const node=event.target;if(node instanceof Node&&panel.current&&!panel.current.contains(node)&&!(node instanceof Element&&node.closest('.workflow-graph-actions')))close();}
    document.addEventListener('keydown',onKey);document.addEventListener('mousedown',onPointer);
    return()=>{document.removeEventListener('keydown',onKey);document.removeEventListener('mousedown',onPointer);};
  },[close]);
  function row(key:string,name:string,provenance:string,description:string|null,skills:{id:string;name:string}[],use:(skill:string)=>void){
    return <article key={key}><h3>{name}</h3><p className="hint">{provenance}</p><p>{description||'No description provided by the agent owner.'}</p>
      {skills.map(skill=><Button size="sm" key={skill.id} disabled={busy||full} onClick={()=>use(skill.id)}>Use {skill.name}</Button>)}</article>;
  }
  return <div id="agent-finder" className="agent-finder" role="dialog" aria-label="Find agents" tabIndex={-1} ref={panel}>
    <div className="agent-finder-head">
      <SegmentedControl label="Agent source" value={source} onChange={setSource} options={[{value:'ans',label:'ANS search'},{value:'mine',label:'My agents'},{value:'saved',label:'Favorites'}]}/>
      <Button size="sm" variant="ghost" onClick={close}>Close</Button>
    </div>
    <div className="agent-finder-body">
      {full&&<p className="hint">A workflow holds at most eight steps. Remove one to add another.</p>}
      {source==='ans'&&<>
        <form className="hosted-search" onSubmit={e=>{e.preventDefault();void search();}}><label>ANS search<input value={query} maxLength={256} placeholder="e.g. Glorria or customer support" disabled={busy} onChange={e=>setQuery(e.target.value)}/></label><Button type="submit" variant="primary" disabled={busy}>{busy?'Searching…':'Search ANS'}</Button></form>
        <p className="hint">Live registry results are not identity-verified or guaranteed compatible. Up to 100 searches per UTC day.</p>
        {!!ansResults.length&&<div className="hosted-candidates">{ansResults.map(candidate=>row(candidate.agentId,candidate.name,'ANS registration · identity unverified',candidate.description,candidate.skills,skill=>add(candidate,skill)))}</div>}
        {!busy&&searched&&!ansResults.length&&<p className="empty">No matching active A2A agents. Try another capability.</p>}
        {!searched&&!ansResults.length&&<p className="hint">Search the live registry to add an agent discovered through ANS.</p>}
        {hasMore&&<Button disabled={busy} onClick={()=>void search(true)}>Load more ANS results</Button>}
      </>}
      {source==='mine'&&<>
        {loading&&<p role="status">Loading your agents…</p>}
        {!!myAgents.length&&<div className="hosted-candidates">{myAgents.map(candidate=>row(candidate.agentId,candidate.name,'Your private template',candidate.description,candidate.skills,skill=>add(candidate,skill)))}</div>}
        {!loading&&!myAgents.length&&<p className="hint">No agents yet. <Link href="/agent-preview">Create an agent</Link> to use it here.</p>}
      </>}
      {source==='saved'&&<>
        {favoritesError&&<p role="alert" className="alert">{favoritesError}</p>}
        {!favoritesError&&favorites===undefined&&<p role="status">Loading your favorites…</p>}
        {!!favorites?.length&&<div className="hosted-candidates">{favorites.map(agent=>{
          // Only a template agent advertises a single A2A skill; a composite workflow
          // is not itself a step, so it links to its own page instead of pretending.
          const skill=agent.kind==='template'?agent.skill:undefined;
          if(!skill)return <article key={`saved:${agent.id}`}><h3>{agent.name}</h3><p className="hint">Saved composite workflow · not a single step</p><p>{agent.description}</p><Link href={`/agents/${agent.id}`}>Open its page →</Link></article>;
          const candidate:Candidate={agentId:`template:${agent.id}`,name:agent.name,description:agent.description,source:'template',skills:[{id:skill.id,name:skill.name,tags:[]}]};
          return row(`saved:${agent.id}`,agent.name,`Saved agent · by ${agent.owner.displayName||`@${agent.owner.username}`}`,agent.description,candidate.skills,value=>add(candidate,value));
        })}</div>}
        {favorites&&!favorites.length&&<p className="hint">No favorites yet. Save an agent from <Link href="/discover">Discover</Link> to reuse it here.</p>}
      </>}
    </div>
  </div>;
}
function RunResult({run}:{run:HostedRun}){return <div className="hosted-run"><details><summary>Saved run input</summary><pre>{typeof run.input.value==='string'?run.input.value:JSON.stringify(run.input.value,null,2)}</pre></details><p role="status">{run.status} · {run.outputs.length} completed steps · {new Date(run.created_at).toLocaleString()}</p>{run.status==='running'&&<p className="hint">A step is in progress or awaiting status confirmation. After five minutes, check status to mark an interrupted run failed. External effects may have occurred.</p>}{run.error&&<p role="alert">{run.error}</p>}{run.outputs.map((output,index)=><details key={index} open={index===run.outputs.length-1}><summary>Step {index+1} output</summary><pre>{typeof output.value==='string'?output.value:JSON.stringify(output.value,null,2)}</pre></details>)}</div>;}
