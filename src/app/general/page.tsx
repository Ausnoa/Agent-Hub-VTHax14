"use client";

import { useEffect, useState } from "react";
import { templateFor, type OwnedAgent } from "../../lib/owned-agent/templates";
import Link from "next/link";
import PageShell from "../../components/layout/page-shell";
import Card from "../../components/ui/card";
import Button from "../../components/ui/button";
import { api } from "../../lib/api-client";
import type { RegistryCandidate } from "../../lib/gateways/registry";
import type { Selection, GeneralWorkflow, GeneralRun } from "../../lib/general/contracts";

export default function GeneralPage() {
  const [owned, setOwned] = useState<OwnedAgent[]>([]);
  useEffect(() => { api<OwnedAgent[]>("owned").then(setOwned).catch(reason => setError(reason.message)); }, []);
  const [ansId, setAnsId] = useState("");
  const [ansSkill, setAnsSkill] = useState("");
  const [query, setQuery] = useState("");
  const [description, setDescription] = useState("");
  const [candidates, setCandidates] = useState<RegistryCandidate[]>([]);
  const [steps, setSteps] = useState<Selection[]>([]);
  const [name, setName] = useState("My general workflow");
  const [proposal, setProposal] = useState<GeneralWorkflow>();
  const [saved, setSaved] = useState<GeneralWorkflow[]>([]);
  const [selected, setSelected] = useState<GeneralWorkflow>();
  const [input, setInput] = useState("");
  const [json, setJson] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [run, setRun] = useState<GeneralRun>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const selectedStep = sessionStorage.getItem("general-workflow-step");
    if (selectedStep) { try { setSteps([JSON.parse(selectedStep)]); } catch { setError("Could not load the selected skill"); } sessionStorage.removeItem("general-workflow-step"); }
    const pending = sessionStorage.getItem("general-workflow-description");
    if (pending) { setDescription(pending.slice(0, 2000)); sessionStorage.removeItem("general-workflow-description"); }
  }, []);
  useEffect(() => { api<GeneralWorkflow[]>("general").then(setSaved).catch((reason) => setError(reason.message)); }, []);
  useEffect(() => {
    if (!run || !["queued", "running"].includes(run.status)) return;
    const timer = setInterval(() => { api<GeneralRun>(`general/runs/${run.id}`).then(setRun).catch((reason) => setError(reason.message)); }, 1500);
    return () => clearInterval(timer);
  }, [run]);
  async function work(action: () => Promise<void>) {
    setBusy(true); setError(""); try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Request failed"); } finally { setBusy(false); }
  }
  function edit(index: number, update: Partial<Selection>) { setSteps((items) => items.map((step, position) => position === index ? { ...step, ...update } : step)); setProposal(undefined); }
  return <PageShell narrow>
    <div className="compose-hero"><div className="eyebrow">GENERAL A2A · EXPERIMENTAL</div><h1>Connect skills. Build a workflow.</h1>
      <p>One to eight steps. Arbitrary advertised skills. Text or JSON—not a fixed company report.</p>
      <Link href="/create">Back to report demo</Link></div>
    <Link href="/available">Browse available agents & check compatibility →</Link>
    <Card><h2>Your created agents</h2><Link href="/agent-preview">Create an agent from a template →</Link>
      {owned.map(agent => <div key={agent.id}><strong>{agent.name}</strong><p>{templateFor(agent.template).name} · Local execution · Not ANS registered</p><Button disabled={busy || steps.length >= 8} onClick={() => {setSteps([...steps, {agentId:agent.id,skill:templateFor(agent.template).skill,inputFrom:steps.length ? "previous" : "original",format:"text",instruction:""}]);setProposal(undefined);}}>Add {agent.name}</Button></div>)}
    </Card>
    <Card><h2>Connect a registered agent</h2><p>Add an ANS registration directly without waiting for the search index to refresh. Its registration and A2A card must resolve successfully.</p>
      <p>Our pilot registrations: select one, then check its live card. A submitted registration may still be awaiting DNS or deployment.</p>
      {[{name:"Glorria Brief",id:"2076c6a9-5114-42c8-8d63-c76eabcea804",skill:"summarize-text"},
        {name:"Glorria Extract",id:"39f5e2f3-7b54-4153-8757-0fe0733c5393",skill:"extract-information"},
        {name:"Glorria Answers",id:"51d689d3-146f-41d6-91dd-0966fc4d7aaa",skill:"answer-from-reference"}].map(agent => <Button key={agent.id} disabled={busy} onClick={() => { setAnsId(agent.id); setAnsSkill(agent.skill); }}>{agent.name}</Button>)}
      <label>ANS agent ID<input value={ansId} maxLength={200} onChange={event => setAnsId(event.target.value)} /></label>
      <label>Skill ID<input value={ansSkill} maxLength={200} onChange={event => setAnsSkill(event.target.value)} placeholder="extract-information or answer-from-reference" /></label>
      <Button disabled={busy || steps.length >= 8 || !ansId.trim() || !ansSkill.trim()} onClick={() => work(async () => {
        const selection: Selection = { agentId: ansId.trim(), skill: ansSkill.trim(), format: "text", inputFrom: steps.length ? "previous" : "original", instruction: ansSkill.trim() === "answer-from-reference" ? "Question: Who is the owner and what is the deadline?\nReference:" : "" };
        await api("general/check", { agentId: selection.agentId, skill: selection.skill, format: selection.format });
        setSteps([...steps, selection]); setProposal(undefined); setAnsId(""); setAnsSkill("");
      })}>Check card & add agent</Button>
    </Card>
    <Card><h2>Supported subset</h2><p>Created agents run locally through saved templates. External agents require public HTTPS, unauthenticated A2A 0.3 JSON-RPC. No files, streaming, or automatic retries. Identity is unverified. A compatible card does not guarantee useful outputs or safe behavior.</p></Card>
    {error && <div role="alert" className="alert">{error}</div>}
    <Card><h2>Optional: suggest steps with the LLM</h2><label>Desired outcome<textarea value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} /></label><p>Sends this description and indexed skill IDs to the configured planner. Suggestions do not execute agents or prove compatibility.</p>
      <Button disabled={busy || description.length < 10} onClick={() => work(async () => { const draft = await api<{ name: string; steps: Selection[] }>("general/suggest", { description }); setName(draft.name); setSteps(draft.steps); setProposal(undefined); })}>Suggest workflow</Button></Card>
    <Card><h2>1. Find skills in the local index</h2><label>Search<input value={query} maxLength={256} onChange={(event) => setQuery(event.target.value)} /></label>
      <Button disabled={busy || !query.trim()} onClick={() => work(async () => { const result = await api<{ candidates: RegistryCandidate[] }>("registry/search", { query, limit: 20 }); setCandidates(result.candidates); })}>Search agents</Button>
      <p>Results are discoveries, not verified connections. Card checks happen when you build the proposal.</p>
      {candidates.map((agent) => <article key={agent.agentId}><h3>{agent.displayName}</h3><p>{agent.description}</p>
        {[...new Map(agent.endpoints.flatMap((endpoint) => endpoint.functions).map((skill) => [skill.id, skill])).values()].slice(0, 20).map((skill) => <Button key={skill.id} disabled={busy || steps.length >= 8} onClick={() => { setSteps([...steps, { agentId: agent.agentId, skill: skill.id, inputFrom: steps.length ? "previous" : "original", format: "text", instruction: "" }]); setProposal(undefined); }}>Add {skill.name ?? skill.id}</Button>)}</article>)}
    </Card>
    <Card><h2>2. Map and review {steps.length}/8 steps</h2><label>Workflow name<input value={name} maxLength={100} onChange={(event) => { setName(event.target.value); setProposal(undefined); }} /></label>
      {steps.map((step, index) => <fieldset key={index}><legend>{index + 1}. {step.skill}</legend><p>Agent ID: {step.agentId}</p>
        <label>Input source<select value={step.inputFrom} onChange={(event) => edit(index, { inputFrom: event.target.value as Selection["inputFrom"] })}><option value="original">Original input</option>{index > 0 && <option value="previous">Previous step output</option>}</select></label>
        <label>Format<select value={step.format} onChange={(event) => edit(index, { format: event.target.value as Selection["format"], instruction: "" })}><option value="text">Text (JSON is serialized)</option><option value="json">JSON object unchanged</option></select></label>
        {step.format === "text" && <label>Instructions<textarea value={step.instruction} maxLength={2000} onChange={(event) => edit(index, { instruction: event.target.value })} /></label>}
        <Button disabled={busy} onClick={() => { setSteps(steps.filter((_, position) => position !== index).map((item, position) => position === 0 ? { ...item, inputFrom: "original" } : item)); setProposal(undefined); }}>Remove step</Button>
      </fieldset>)}
      <Button disabled={busy || !steps.length} onClick={() => work(async () => { setProposal(await api<GeneralWorkflow>("general/proposals", { name, steps })); })}>Validate steps & build proposal</Button>
      {proposal && <div><h3>Review execution steps</h3><ol>{proposal.steps.map((step, index) => <li key={index}>{step.name} · {step.skill} · {step.inputFrom} → {step.format}<br />{step.agentId.startsWith("owned:") ? "Local template execution · OpenAI" : step.endpoint}</li>)}</ol>
        <p>Saved only on this site. No ANS registration or identity verification.</p>
        <Button disabled={busy} onClick={() => work(async () => { const approved = await api<GeneralWorkflow>(`general/${proposal.id}/approve`, {}); setSelected(approved); setConfirmed(false); setSaved(await api<GeneralWorkflow[]>("general")); })}>Approve & save workflow</Button></div>}
    </Card>
    <Card><h2>3. Saved workflows & execution</h2>{saved.map((workflow) => <Button key={workflow.id} onClick={() => { setSelected(workflow); setConfirmed(false); setRun(undefined); }}>{workflow.name}</Button>)}
      {selected && <div><h3>{selected.name}</h3><ol>{selected.steps.map((step, index) => <li key={index}>{step.skill} → {step.agentId.startsWith("owned:") ? "Local template execution · OpenAI" : step.endpoint}</li>)}</ol>
        <label><input type="checkbox" checked={json} onChange={(event) => { setJson(event.target.checked); setConfirmed(false); }} /> Input is a JSON object</label>
        <label>Task input<textarea value={input} maxLength={20000} onChange={(event) => { setInput(event.target.value); setConfirmed(false); }} /></label>
        <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I authorize sending this input and intermediate outputs to OpenAI for local templates and the displayed external agents, including possible side effects. Do not include secrets.</label>
        <Button disabled={busy || !confirmed || !input || run?.status === "queued" || run?.status === "running"} onClick={() => work(async () => { setRun(await api<GeneralRun>(`general/${selected.id}/invoke`, { input: { type: json ? "json" : "text", value: json ? JSON.parse(input) : input }, confirmExternalExecution: true })); setConfirmed(false); })}>Run approved workflow</Button>
      </div>}
      {run && <div aria-live="polite"><h3>Run: {run.status}</h3><p>Run ID: {run.id}</p>{run.status === "queued" && <p>Waiting for the worker. Start or restart npm run worker.</p>}{run.error && <p role="alert">{run.error}</p>}{run.outputs.map((output, index) => <div key={index}><h4>Step {index + 1}</h4><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{output.type === "text" ? output.value : JSON.stringify(output.value, null, 2)}</pre></div>)}</div>}
    </Card>
  </PageShell>;
}
