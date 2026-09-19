"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

  useEffect(() => {
    api<Composite[]>("agents").then(setAgents).catch(() => setError("Could not load your agent fleet"));
  }, []);

  const filtered = useMemo(() => {
    if (!agents) return undefined;
    const term = query.trim().toLowerCase();
    if (!term) return agents;
    return agents.filter((agent) =>
      agent.plan.name.toLowerCase().includes(term) ||
      agent.plan.description.toLowerCase().includes(term) ||
      agent.plan.capabilities.some((capability) => capability.toLowerCase().includes(term)) ||
      agent.id.toLowerCase().includes(term)
    );
  }, [agents, query]);

  const totalSteps = agents?.reduce((sum, agent) => sum + agent.steps.length, 0) ?? 0;
  const distinctCapabilities = new Set(agents?.flatMap((agent) => agent.plan.capabilities)).size;

  return <PageShell>
    <PageHeader
      eyebrow="SUPERVISE, MONITOR, AND INVOKE CRYPTOGRAPHIC AMS-CERTIFIED MULTI-AGENT WORKFLOWS"
      title="My Agent Fleet"
      action={<Link href="/create"><Button variant="primary">Compose New Agent</Button></Link>}
    />
    {error && <div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div>}
    <div className="metric-row">
      <MetricTile label="Fleet size" value={String(agents?.length ?? 0)} />
      <MetricTile label="Connected agents" value={String(totalSteps)} />
      <MetricTile label="Distinct capabilities" value={String(distinctCapabilities)} />
    </div>
    <div className="search-bar" style={{ marginBottom: 24 }}>
      <label className="sr-only" htmlFor="fleet-search">Search agents</label>
      <input id="fleet-search" placeholder="Search by agent name, capability, or ANS id" value={query} onChange={(event) => setQuery(event.target.value)} />
    </div>
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
