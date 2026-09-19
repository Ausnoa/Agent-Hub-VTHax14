"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageShell from "../../components/layout/page-shell";
import Card from "../../components/ui/card";
import Button from "../../components/ui/button";
import { api } from "../../lib/api-client";
import type { RegistryCandidate } from "../../lib/gateways/registry";
import type { Selection, GeneralWorkflow, GeneralRun } from "../../lib/general/contracts";

export default function GeneralPage() {
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
    <Card><h2>Supported subset</h2><p>Public HTTPS, unauthenticated A2A 0.3 JSON-RPC. No files, streaming, or automatic retries. Identity is unverified. A compatible card does not guarantee useful outputs or safe behavior.</p></Card>
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
      <Button disabled={busy || !steps.length} onClick={() => work(async () => { setProposal(await api<GeneralWorkflow>("general/proposals", { name, steps })); })}>Check cards & build proposal</Button>
      {proposal && <div><h3>Review destination endpoints</h3><ol>{proposal.steps.map((step, index) => <li key={index}>{step.name} · {step.skill} · {step.inputFrom} → {step.format}<br />{step.endpoint}</li>)}</ol>
        <p>Saved only on this site. No ANS registration or identity verification.</p>
        <Button disabled={busy} onClick={() => work(async () => { const approved = await api<GeneralWorkflow>(`general/${proposal.id}/approve`, {}); setSelected(approved); setConfirmed(false); setSaved(await api<GeneralWorkflow[]>("general")); })}>Approve & save workflow</Button></div>}
    </Card>
    <Card><h2>3. Saved workflows & execution</h2>{saved.map((workflow) => <Button key={workflow.id} onClick={() => { setSelected(workflow); setConfirmed(false); setRun(undefined); }}>{workflow.name}</Button>)}
      {selected && <div><h3>{selected.name}</h3><ol>{selected.steps.map((step, index) => <li key={index}>{step.skill} → {step.endpoint}</li>)}</ol>
        <label><input type="checkbox" checked={json} onChange={(event) => { setJson(event.target.checked); setConfirmed(false); }} /> Input is a JSON object</label>
        <label>Task input<textarea value={input} maxLength={20000} onChange={(event) => { setInput(event.target.value); setConfirmed(false); }} /></label>
        <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I authorize sending this input and intermediate outputs to the displayed external agents, including possible side effects. Do not include secrets.</label>
        <Button disabled={busy || !confirmed || !input || run?.status === "queued" || run?.status === "running"} onClick={() => work(async () => { setRun(await api<GeneralRun>(`general/${selected.id}/invoke`, { input: { type: json ? "json" : "text", value: json ? JSON.parse(input) : input }, confirmExternalExecution: true })); setConfirmed(false); })}>Run approved workflow</Button>
      </div>}
      {run && <div aria-live="polite"><h3>Run: {run.status}</h3><p>Run ID: {run.id}</p>{run.status === "queued" && <p>Waiting for the worker. Start or restart npm run worker.</p>}{run.error && <p role="alert">{run.error}</p>}{run.outputs.map((output, index) => <div key={index}><h4>Step {index + 1}</h4><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{output.type === "text" ? output.value : JSON.stringify(output.value, null, 2)}</pre></div>)}</div>}
    </Card>
  </PageShell>;
}
