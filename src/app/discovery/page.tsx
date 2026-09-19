"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Radar, Search } from "lucide-react";
import type { DiscoveredAgent } from "../../lib/ans/client";
import type { CatalogEntry } from "../../lib/gateways/catalog";
import { api } from "../../lib/api-client";
import { useComposerFlow } from "../../lib/composer-flow";
import PageShell from "../../components/layout/page-shell";
import PageHeader from "../../components/layout/page-header";
import Card, { CardHead } from "../../components/ui/card";
import Button from "../../components/ui/button";
import StatusPill from "../../components/ui/status-pill";
import TopologyGraph, { type TopologyNode } from "../../components/agent-hub/topology-graph";
import CatalogPanel from "../../components/agent-hub/catalog-panel";

export default function DiscoveryPage() {
  const router = useRouter();
  const { proposal, hydrated } = useComposerFlow();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [query, setQuery] = useState("");
  const [discovered, setDiscovered] = useState<DiscoveredAgent[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<CatalogEntry[]>("catalog").then(setCatalog).catch(() => setError("Could not load the pilot catalog"));
  }, []);

  async function search() {
    setBusy(true); setError("");
    try {
      const result = await api<{ agents: DiscoveredAgent[] }>("discover", { query });
      setDiscovered(result.agents); setSearched(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!hydrated) return <PageShell><p className="hint">Loading…</p></PageShell>;

  const registryPanel = <Card>
    <CardHead>ANS capability resolution</CardHead>
    <CatalogPanel entries={catalog} />
    <h3 style={{ fontSize: 12, color: "var(--text-muted)", margin: "18px 0 10px" }}>Search the live ANS registry</h3>
    <p className="hint" style={{ marginBottom: 10 }}>Queries the registry directly — no LLM key required.</p>
    <form className="search-bar" onSubmit={(event) => { event.preventDefault(); search(); }}>
      <label className="sr-only" htmlFor="query">Search ANS</label>
      <input id="query" value={query} maxLength={256} onChange={(event) => setQuery(event.target.value)} placeholder="Search for a capability" />
      <Button variant="primary" disabled={busy}>{busy ? "Searching…" : <><Search size={14} /> Search</>}</Button>
    </form>
    <div className="registry-list" style={{ marginTop: 12 }}>
      {discovered.map((item, index) => <article className="registry-item" key={`${item.ansId}-${index}`}>
        <span className="registry-item-icon"><Radar size={15} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3>{item.name}</h3>
          <p>{item.ansName}</p>
          <details><summary>View discovery details</summary><dl>
            <dt>Endpoint</dt><dd className="mono">{item.endpoint}</dd>
            <dt>Transports</dt><dd>{item.transports.join(", ")}</dd>
            <dt>Identity check</dt><dd>Not verified</dd>
          </dl></details>
        </div>
        <StatusPill tone="violet">A2A</StatusPill>
      </article>)}
    </div>
    {searched && !discovered.length && <p className="empty">No matching active A2A agents. Try another capability.</p>}
  </Card>;

  if (!proposal) return <PageShell>
    <PageHeader
      eyebrow="AUTONOMOUS PIPELINE DISCOVERY"
      title="Browse the ANS registry"
      description="Search indexed and live ANS records directly. This doesn't require an LLM key — that's only needed to decompose a natural-language directive into a capability plan."
    />
    {error && <div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div>}
    <div className="split-layout">
      <Card>
        <CardHead>Compose an agent</CardHead>
        <p className="hint" style={{ marginBottom: 16 }}>Have an outcome in mind? Describe it and Agent Hub will decompose it into a capability plan, then resolve each capability against this same registry.</p>
        <Link href="/create"><Button variant="primary">Start composing <ArrowRight size={14} /></Button></Link>
      </Card>
      {registryPanel}
    </div>
  </PageShell>;

  const nodes: TopologyNode[] = proposal.steps.map((step, index) => ({
    id: step.capability,
    label: step.name,
    sublabel: step.ansId,
    angle: (360 / Math.max(proposal.steps.length, 1)) * index - 90,
    radius: 1,
    tone: step.source === "ans" ? "violet" : "accent",
  }));

  return <PageShell>
    <PageHeader
      eyebrow="AUTONOMOUS PIPELINE DISCOVERY"
      title={`Decomposing Prompt: "${proposal.plan.name}"`}
      description={proposal.plan.description}
      action={<StatusPill tone={proposal.blockers.length ? "amber" : "green"}>{proposal.blockers.length ? "Needs attention" : "Decomposition complete"}</StatusPill>}
    />

    {error && <div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div>}

    <div className="split-layout">
      <Card>
        <CardHead>Goal decomposition</CardHead>
        <TopologyGraph coreLabel="Goal Decomposer" coreSublabel="+ Data Provisioning" nodes={nodes} animated />
        <div className="metric-row" style={{ marginTop: 4 }}>
          <div className="metric-tile"><div className="metric-tile-label">Resolved capabilities</div><div className="metric-tile-value">{proposal.steps.length}</div></div>
          <div className="metric-tile"><div className="metric-tile-label">Planner</div><div className="metric-tile-value" style={{ fontSize: 14 }}>{proposal.planner === "llm" ? "LLM" : "Template"}</div></div>
          <div className="metric-tile"><div className="metric-tile-label">Blockers</div><div className="metric-tile-value">{proposal.blockers.length}</div></div>
        </div>
      </Card>

      {registryPanel}
    </div>

    {!!proposal.blockers.length && <div className="alert" style={{ marginTop: 22 }}>
      <strong>This composition is incomplete</strong>
      <ul>{proposal.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
    </div>}

    <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
      <Button variant="primary" disabled={!!proposal.blockers.length || !proposal.steps.length} onClick={() => router.push("/workflow")}>
        Proceed to Workflow Review <ArrowRight size={14} />
      </Button>
    </div>
  </PageShell>;
}
