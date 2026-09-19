"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, Network, Sparkles, ShieldCheck, Plus } from "lucide-react";
import type { Composite } from "../../lib/contracts/index";
import { api } from "../../lib/api-client";
import PageShell from "../../components/layout/page-shell";
import PageHeader from "../../components/layout/page-header";
import Button from "../../components/ui/button";
import MetricTile from "../../components/ui/metric-tile";
import AgentCard from "../../components/agent-hub/agent-card";

export default function MyAgentsPage() {
  const [agents, setAgents] = useState<Composite[]>();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [capability, setCapability] = useState<string>("all");

  useEffect(() => {
    api<Composite[]>("agents").then(setAgents).catch(() => setError("Could not load your agent fleet"));
  }, []);

  const capabilities = useMemo(() => Array.from(new Set(agents?.flatMap((agent) => agent.plan.capabilities) ?? [])), [agents]);

  const filtered = useMemo(() => {
    if (!agents) return undefined;
    const term = query.trim().toLowerCase();
    return agents.filter((agent) => {
      const matchesCapability = capability === "all" || (agent.plan.capabilities as string[]).includes(capability);
      const matchesQuery = !term
        || agent.plan.name.toLowerCase().includes(term)
        || agent.plan.description.toLowerCase().includes(term)
        || agent.plan.capabilities.some((cap) => cap.toLowerCase().includes(term))
        || agent.id.toLowerCase().includes(term);
      return matchesCapability && matchesQuery;
    });
  }, [agents, query, capability]);

  const totalSteps = agents?.reduce((sum, agent) => sum + agent.steps.length, 0) ?? 0;
  const distinctCapabilities = capabilities.length;
  const ansResolvedSteps = agents?.reduce((sum, agent) => sum + agent.steps.filter((step) => step.source === "ans").length, 0) ?? 0;

  return <PageShell>
    <PageHeader
      eyebrow="SUPERVISE, MONITOR, AND INVOKE CRYPTOGRAPHIC ANS-CERTIFIED MULTI-AGENT WORKFLOWS"
      title="My Agent Fleet"
      action={<Link href="/create"><Button variant="primary"><Plus size={14} /> Compose New Agent</Button></Link>}
    />
    {error && <div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div>}
    <div className="metric-row">
      <MetricTile label="Fleet size" value={String(agents?.length ?? 0)} icon={<Boxes size={16} />} />
      <MetricTile label="Connected agents" value={String(totalSteps)} icon={<Network size={16} />} />
      <MetricTile label="Distinct capabilities" value={String(distinctCapabilities)} icon={<Sparkles size={16} />} />
      <MetricTile label="ANS-resolved steps" value={String(ansResolvedSteps)} icon={<ShieldCheck size={16} />} />
    </div>
    <div className="search-bar" style={{ marginBottom: 16 }}>
      <label className="sr-only" htmlFor="fleet-search">Search agents</label>
      <input id="fleet-search" placeholder="Search by agent name, capability, or ANS id" value={query} onChange={(event) => setQuery(event.target.value)} />
    </div>
    {!!capabilities.length && <div className="filter-bar" style={{ marginBottom: 24 }}>
      <button className={`filter-chip${capability === "all" ? " active" : ""}`} onClick={() => setCapability("all")}>All ({agents?.length ?? 0})</button>
      {capabilities.map((cap) => <button key={cap} className={`filter-chip${capability === cap ? " active" : ""}`} onClick={() => setCapability(cap)}>{cap}</button>)}
    </div>}
    {filtered === undefined && <p className="hint">Loading your fleet…</p>}
    {filtered && <div className="fleet-grid">
      {filtered.map((agent) => <AgentCard agent={agent} key={agent.id} />)}
      <Link href="/create" className="card add-agent-card">
        <span>＋</span>
        <h2>Compose something new</h2>
        <p className="hint">Start with an outcome.</p>
      </Link>
    </div>}
    {filtered && !filtered.length && agents?.length ? <p className="empty">No agents match that search.</p> : null}
  </PageShell>;
}
