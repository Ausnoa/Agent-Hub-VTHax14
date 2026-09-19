"use client";

import { useEffect, useState } from "react";
import type { Composite, Proposal, Run } from "../lib/contracts/index";
import type { DiscoveredAgent } from "../lib/ans/client";

async function api<T>(path: string, value?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, value === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "The request could not be completed");
  return data as T;
}

const example = "Research a company, identify important risks, and write an executive summary.";
const sampleNotes = "Northstar makes warehouse inventory software.\nRevenue grew 18% in this fictional example.\nThe business depends on one cloud supplier.\nTwo customers account for 45% of revenue.\nNew product delivery has been delayed.";
const stepLabels = { "company-research": "Research", "risk-analysis": "Analyze risks", summarization: "Summarize" };

export default function Composer() {
  const [tab, setTab] = useState("builder");
  const [description, setDescription] = useState(example);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [proposal, setProposal] = useState<Proposal>();
  const [agent, setAgent] = useState<Composite>();
  const [saved, setSaved] = useState<Composite[]>([]);
  const [run, setRun] = useState<Run>();
  const [history, setHistory] = useState<Run[]>([]);
  const [company, setCompany] = useState("Northstar (fictional)");
  const [notes, setNotes] = useState(sampleNotes);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("company research");
  const [discovered, setDiscovered] = useState<DiscoveredAgent[]>([]);
  const [searched, setSearched] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string>();
  const [hasMore, setHasMore] = useState(false);
  const [plannerConfigured, setPlannerConfigured] = useState(false);

  useEffect(() => {
    api<Composite[]>("agents").then(setSaved).catch(() => setError("Could not load saved agents"));
    api<{ plannerConfigured: boolean }>("status").then((status) => setPlannerConfigured(status.plannerConfigured)).catch(() => {});
    const id = new URLSearchParams(window.location.search).get("agent");
    if (id) openAgent(id).catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    if (!run || !["queued", "running"].includes(run.status)) return;
    let active = true;
    const timer = setInterval(() => {
      api<Run>(`runs/${run.id}`).then((updated) => { if (active) setRun(updated); }).catch(() => { if (active) setError("Progress connection lost. Reload to reconnect to the saved run."); });
    }, 900);
    return () => { active = false; clearInterval(timer); };
  }, [run?.id, run?.status]);

  async function action(label: string, callback: () => Promise<void>) {
    setBusy(label); setError("");
    try { await callback(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Something went wrong"); }
    finally { setBusy(""); }
  }
  async function openAgent(id: string) {
    const data = await api<{ agent: Composite; runs: Run[] }>(`agents/${id}`);
    setAgent(data.agent); setProposal(undefined); setHistory(data.runs); setRun(data.runs[0]); setTab("builder");
    window.history.replaceState({}, "", `?agent=${id}`);
  }
  function reset() { setAgent(undefined); setProposal(undefined); setRun(undefined); setError(""); setTab("builder"); window.history.replaceState({}, "", "/"); }
  async function search(more = false) {
    const result = await api<{ agents: DiscoveredAgent[]; hasMore: boolean; nextPageToken?: string }>("discover", { query, ...(more ? { pageToken: nextPageToken } : {}) });
    setDiscovered((prior) => more ? [...prior, ...result.agents] : result.agents); setSearched(true); setHasMore(result.hasMore); setNextPageToken(result.nextPageToken);
  }

  return <div className="shell">
    <aside className="sidebar">
      <button className="brand" onClick={reset}><span className="brand-mark">a<span>↗</span></span><span>agent<span className="brand-light">composer</span></span></button>
      <div className="workspace-label">WORKSPACE <span>LOCAL</span></div>
      <nav aria-label="Main navigation">
        <button className={tab === "builder" ? "nav-item active" : "nav-item"} onClick={() => setTab("builder")}><span>⌘</span> Composer <span className="nav-arrow">↗</span></button>
        <button className={tab === "saved" ? "nav-item active" : "nav-item"} onClick={() => { setTab("saved"); action("Loading", async () => setSaved(await api<Composite[]>("agents"))); }}><span>▦</span> My agents <small>{saved.length}</small></button>
        <button className={tab === "discover" ? "nav-item active" : "nav-item"} onClick={() => setTab("discover")}><span>◎</span> Discover agents</button>
      </nav>
      <div className="sidebar-note"><span className="tiny-dot" /> BUILT TO CONNECT<p>Independent agents.<br />One shared outcome.</p><div className="protocol-tags"><span>ANS discovery</span><span>A2A execution</span></div></div>
      <div className="sidebar-footer"><div className="avatar">AC</div><div>Local workspace<small>Hackathon edition</small></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><span>Workspace <span className="slash">/</span> <strong>{tab === "discover" ? "Agent directory" : tab === "saved" ? "My agents" : "Composer"}</strong></span><span className="topbar-status"><span className="tiny-dot" /> A2A ready · local runtime</span></header>
      <main>
        {error && <div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p><button onClick={() => setError("")}>Dismiss</button></div>}
        {tab === "builder" && !proposal && !agent && <>
          <div className="hero"><div className="eyebrow"><span className="line" /> FROM IDEA TO ORCHESTRATION</div><h1>Good agents.<br /><em>Better together.</em></h1><p>Describe the outcome. Find the right capabilities.<br />Compose an agent that gets the whole job done.</p><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><span className="art-node node-one">◎</span><span className="art-node node-two">✳</span><span className="art-node node-three">≋</span><span className="art-core">a↗</span><span className="art-caption">MANY CAPABILITIES. ONE AGENT.</span></div></div>
          <section className="builder-card"><div className="card-heading"><span className="number-label">01</span><h2>What should your agent do?</h2><span className="badge">NEW COMPOSITION</span></div>
            <label className="sr-only" htmlFor="description">Agent description</label><textarea id="description" className="prompt" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} />
            <div className="prompt-footer"><span>Be specific about the outcome you want.</span><span>{description.length} / 2,000</span></div>
            <div className="mode-row"><div className="mode-toggle" aria-label="Composition mode"><button className={mode === "demo" ? "selected" : ""} onClick={() => setMode("demo")}>Local demo</button><button className={mode === "live" ? "selected" : ""} onClick={() => setMode("live")}>Live ANS</button></div><button className="primary" disabled={!!busy || description.trim().length < 10} onClick={() => action("Planning capabilities", async () => setProposal(await api<Proposal>("proposals", { description, mode })))}>{busy || "Build my agent"}<span>↗</span></button></div>
            <p className="mode-note">{mode === "demo" ? "Local demo uses a fixed three-step template and deterministic test agents. No ANS discovery or LLM planning is simulated." : plannerConfigured ? "Uses LLM planning and real ANS discovery. Only configured, compatible agents can be selected." : "Live discovery is available in the directory. Composition needs a configured LLM planner and compatible agents."}</p>
          </section>
          <section className="how-it-works"><div className="section-label">A LITTLE DIRECTION. A LOT OF POSSIBILITY.</div><div className="feature-grid"><article><span className="feature-icon">◎</span><h3>Discover with ANS</h3><p>Find registered agents and inspect where they come from.</p></article><article><span className="feature-icon">⌘</span><h3>Review the composition</h3><p>See each capability and approve the agents working together.</p></article><article><span className="feature-icon">↗</span><h3>Run it. Reuse it.</h3><p>Follow each A2A step, then use your saved agent again.</p></article></div></section>
        </>}
        {tab === "builder" && proposal && <>
          <button className="back" onClick={reset}>← Back to composer</button><div className="page-heading"><div className="eyebrow">REVIEW YOUR COMPOSITION</div><h1>{proposal.plan.name}</h1><p>{proposal.plan.description}</p></div>
          <div className="notice">{proposal.mode === "demo" ? "Local demo · Fixed template · Fixture agents · Not registered with ANS" : "Live ANS results · Identity has not been independently verified"}</div>
          <div className="workflow-list">{proposal.steps.map((step, index) => <article className="workflow-card" key={step.capability}><span className="step-index">0{index + 1}</span><div><span className="section-label">{stepLabels[step.capability]}</span><h2>{step.name}</h2><p>{step.source === "ans" ? "Discovered through ANS" : "Local test service"} · A2A {step.protocolVersion}</p><details><summary>Inspect agent</summary><dl><dt>Endpoint</dt><dd>{step.endpoint}</dd><dt>Identity</dt><dd>Not verified</dd><dt>Capability</dt><dd>{step.capability}</dd></dl></details></div><span className="badge">A2A</span></article>)}</div>
          {!!proposal.blockers.length && <div className="alert"><strong>This composition is incomplete</strong><ul>{proposal.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div>}
          <button className="primary" disabled={!!busy || !!proposal.blockers.length || !proposal.steps.length} onClick={() => action("Saving agent", async () => { const created = await api<Composite>("agents", { proposalId: proposal.id }); setSaved(await api<Composite[]>("agents")); await openAgent(created.id); })}>{busy || "Approve & create agent"}<span>↗</span></button>
        </>}
        {tab === "builder" && agent && <>
          <button className="back" onClick={reset}>← Compose another agent</button><div className="page-heading"><div className="eyebrow">YOUR REUSABLE AGENT</div><h1>{agent.plan.name}</h1><p>{agent.plan.description}</p></div>
          <div className="notice">{agent.mode === "demo" ? "Local demo: deterministic agents analyze your supplied notes. No live research or verified identity is claimed." : "Live workflow: agents receive the notes you submit. Identity remains unverified."}</div>
          <div className="run-layout"><section className="panel"><h2>Start a new briefing</h2><label htmlFor="company">Company</label><input id="company" value={company} onChange={(event) => setCompany(event.target.value)} maxLength={120} /><label htmlFor="notes">Source notes</label><textarea id="notes" rows={8} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={12000}/><p className="hint">These notes flow through the selected agents. Use non-sensitive information.</p><button className="primary full" disabled={!!busy || run?.status === "running" || run?.status === "queued" || !company.trim() || !notes.trim()} onClick={() => action("Queueing run", async () => { const created = await api<Run>(`agents/${agent.id}/invoke`, { company, notes }); setRun(created); setHistory((prior) => [created, ...prior]); })}>{busy || "Run agent"}<span>↗</span></button></section>
          <section className="panel trace"><div className="card-heading"><h2>Execution trace</h2><span className="badge">{run?.status ?? "READY"}</span></div><p className="hint">Real A2A messages. One step at a time.</p>{agent.steps.map((step, index) => { const attempts = run?.attempts.filter((attempt) => attempt.capability === step.capability); const latest = attempts?.at(-1); return <div className={`trace-step ${latest?.status ?? "waiting"}`} key={step.capability}><span className="trace-dot">{latest?.status === "completed" ? "✓" : latest?.status === "failed" ? "!" : index + 1}</span><div><h3>{step.name}</h3><p>{latest?.status ?? "Waiting"}{latest?.completedAt ? ` · ${((Date.parse(latest.completedAt) - Date.parse(latest.startedAt)) / 1000).toFixed(1)}s` : ""}{latest && latest.attempt > 1 ? ` · attempt ${latest.attempt}` : ""}</p>{latest?.error && <p className="error-text">{latest.error}</p>}{latest?.output && <details><summary>View step output</summary><pre>{JSON.stringify(latest.output, null, 2)}</pre></details>}</div></div>; })}
          {run?.status === "queued" && <p className="hint">Waiting for the local worker. Start it using the setup guide if the queue does not advance.</p>}
          {run?.status === "failed" && <><p className="error-text">{run.error}</p><button className="secondary" disabled={!!busy} onClick={() => action("Retrying", async () => setRun(await api<Run>(`runs/${run.id}/retry`, {})))}>Retry failed step</button></>}
          </section></div>
          {run?.output && <section className="report panel"><div className="eyebrow">COMPLETED BRIEFING {run.output.fixture && "· FIXTURE OUTPUT"}</div><h2>{run.output.company}</h2><p className="summary-text">{run.output.summary}</p><div className="report-columns"><div><h3>Observations</h3><ul>{run.output.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul></div><div><h3>Possible risk signals</h3><ul>{run.output.risks.map((risk, index) => <li key={index}>{risk}</li>)}</ul>{!run.output.risks.length && <p>No signals matched this adapter.</p>}</div></div><div className="sources"><strong>Sources</strong>{run.output.sources.map((source, index) => <p key={index}>{source}</p>)}</div></section>}
          {!!history.length && <section className="history"><h3>Recent runs</h3>{history.map((item) => <button className="history-item" key={item.id} onClick={() => action("Loading run", async () => setRun(await api<Run>(`runs/${item.id}`)))}><span>{item.input.company}</span><time>{new Date(item.createdAt).toLocaleString()}</time><span>Open ↗</span></button>)}</section>}
        </>}
        {tab === "saved" && <><div className="page-heading"><div className="eyebrow">YOUR WORKSPACE</div><h1>My agents<span className="heading-count">{saved.length}</span></h1><p>Compositions you can come back to.</p></div><div className="saved-grid">{saved.map((item) => <button className="saved-card" key={item.id} onClick={() => action("Opening agent", () => openAgent(item.id))}><span className="feature-icon">⌘</span><span className="badge">{item.mode === "demo" ? "LOCAL DEMO" : "LIVE ANS"}</span><h2>{item.plan.name}</h2><p>{item.plan.description}</p><div>{item.steps.length} connected agents <span>Open ↗</span></div></button>)}<button className="saved-card add-card" onClick={reset}><span>＋</span><h2>Compose something new</h2><p>Start with an outcome.</p></button></div></>}
        {tab === "discover" && <><div className="page-heading"><div className="eyebrow">THE OPEN AGENT DIRECTORY</div><h1>Find a capability.</h1><p>Search real ANS records. Inspect first, compose with confidence.</p></div><form className="search-bar" onSubmit={(event) => { event.preventDefault(); action("Searching ANS", () => search()); }}><label className="sr-only" htmlFor="query">Search ANS</label><input id="query" value={query} maxLength={256} onChange={(event) => { setQuery(event.target.value); setNextPageToken(undefined); setHasMore(false); }} placeholder="Search for a capability"/><button className="primary" disabled={!!busy}>{busy || "Search ANS"} <span>↗</span></button></form><p className="hint">Live registry results. Registration does not prove compatibility or independently verified identity.</p><div className="directory-list">{discovered.map((item, index) => <article className="directory-card" key={`${item.ansId}-${index}`}><span className="feature-icon">◎</span><div><h2>{item.name}</h2><p>{item.ansName}</p><details><summary>View discovery details</summary><dl><dt>Endpoint</dt><dd>{item.endpoint}</dd><dt>Transports</dt><dd>{item.transports.join(", ")}</dd><dt>Identity check</dt><dd>Not verified</dd></dl></details></div><span className="badge">A2A</span></article>)}</div>{searched && !discovered.length && <p className="empty">No matching active A2A agents on this page. Try another capability.</p>}{hasMore && nextPageToken && <button className="secondary" disabled={!!busy} onClick={() => action("Loading more", () => search(true))}>Load more results</button>}{hasMore && !nextPageToken && <p className="hint">ANS indicates more results, but did not provide a usable cursor.</p>}</>}
        <footer className="page-footer"><span>COMPOSE WITH INTENTION.</span><span>ANS for discovery <span>·</span> A2A for connection</span></footer>
      </main>
    </div>
  </div>;
}
