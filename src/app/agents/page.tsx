"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, Network, Sparkles, ShieldCheck, Plus, Search } from "lucide-react";
import type { Composite } from "../../lib/contracts/index";
import { api } from "../../lib/api-client";
import PageShell from "../../components/layout/page-shell";
import PageHeader from "../../components/layout/page-header";
import Button from "../../components/ui/button";
import MetricTile from "../../components/ui/metric-tile";
import AgentCard from "../../components/agent-glorria/agent-card";
import FleetOverview from "../../components/agent-glorria/fleet-overview";
import WorkflowAgentCard, { workflowAgentTags } from "../../components/agent-glorria/workflow-agent-card";
import { latestRevisions, localAgent, type CapabilityAgent } from "../../components/agent-runtime/capability-runner";
import type { GeneralWorkflow } from "../../lib/general/contracts";

export default function MyAgentsPage() {
  const [agents, setAgents] = useState<Composite[]>();
  const [workflows, setWorkflows] = useState<CapabilityAgent[]>();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [capability, setCapability] = useState<string>("all");

  useEffect(() => {
    api<Composite[]>("agents").then(setAgents).catch(() => setError("Could not load your agent fleet"));
    // Agents created, enhanced, or hand-built through the capability pipeline: latest revision of each.
    api<GeneralWorkflow[]>("general").then((items) => setWorkflows(latestRevisions(items.map(localAgent)))).catch(() => setError("Could not load your agent fleet"));
  }, []);

  const capabilities = useMemo(() => Array.from(new Set([...(agents?.flatMap((agent) => agent.plan.capabilities as string[]) ?? []), ...(workflows?.flatMap(workflowAgentTags) ?? [])])), [agents, workflows]);
  const filteredWorkflows = useMemo(() => {
    if (!workflows) return undefined;
    const term = query.trim().toLowerCase();
    return workflows.filter((agent) => (capability === "all" || workflowAgentTags(agent).includes(capability))
      && (!term || [agent.name, agent.capability?.ui.title ?? "", agent.description ?? "", agent.id, ...workflowAgentTags(agent)].some((text) => text.toLowerCase().includes(term))));
  }, [workflows, query, capability]);

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

  const totalSteps = (agents?.reduce((sum, agent) => sum + agent.steps.length, 0) ?? 0) + (workflows?.reduce((sum, agent) => sum + agent.steps.length, 0) ?? 0);
  const fleetSize = (agents?.length ?? 0) + (workflows?.length ?? 0);
  const distinctCapabilities = capabilities.length;
  const ansResolvedSteps = (agents?.reduce((sum, agent) => sum + agent.steps.filter((step) => step.source === "ans").length, 0) ?? 0)
    + (workflows?.reduce((sum, agent) => sum + agent.steps.filter((step) => !step.geminiTask && !step.agentId.startsWith("owned:")).length, 0) ?? 0);

  return <PageShell className="screen-fleet">
    <FleetOverview />
    <PageHeader
      headingLevel={2}
      eyebrow="A2A DEPLOYMENT REGISTRY · LOCAL WORKSPACE"
      title="Your agent fleet"
      description="Supervise, monitor, and invoke your multi-agent workflows. One workspace for your entire fleet."
      action={<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/create"><Button variant="primary"><Plus size={14} /> Create agent</Button></Link>
      </div>}
    />
    {error && <div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div>}
    <div className="metric-row">
      <MetricTile label="Fleet nodes" value={agents && workflows ? String(fleetSize) : "—"} delta="Saved agents" icon={<Boxes size={16} />} />
      <MetricTile label="Connected agents" value={agents ? String(totalSteps) : "—"} delta="Across your pipelines" icon={<Network size={16} />} />
      <MetricTile label="Distinct capabilities" value={agents ? String(distinctCapabilities) : "—"} delta="Available in your fleet" icon={<Sparkles size={16} />} />
      <MetricTile label="Registry presence" value={agents ? String(ansResolvedSteps) : "—"} delta="ANS-resolved steps · identity unverified" icon={<ShieldCheck size={16} />} />
    </div>
    <section className="fleet-toolbar" aria-label="Filter your fleet">
    <div className="search-bar fleet-search">
      <Search size={16} aria-hidden="true" />
      <label className="sr-only" htmlFor="fleet-search">Search agents</label>
      <input id="fleet-search" placeholder="Search by agent name, capability, or ANS id" value={query} onChange={(event) => setQuery(event.target.value)} />
    </div>
    {!!capabilities.length && <div className="filter-bar">
      <button aria-pressed={capability === "all"} className={`filter-chip${capability === "all" ? " active" : ""}`} onClick={() => setCapability("all")}>All ({fleetSize})</button>
      {capabilities.map((cap) => <button aria-pressed={capability === cap} key={cap} className={`filter-chip${capability === cap ? " active" : ""}`} onClick={() => setCapability(cap)}>{cap}</button>)}
    </div>}
    </section>
    {filtered === undefined && !error && <p role="status" className="hint">Loading your fleet…</p>}
    {filtered && <div className="fleet-grid">
      {filteredWorkflows?.map((agent) => <WorkflowAgentCard agent={agent} key={agent.id} />)}
      {filtered.map((agent) => <AgentCard agent={agent} key={agent.id} />)}
      <Link href="/create" className="card add-agent-card">
        <span>＋</span>
        <h2>Create an agent</h2>
        <p className="hint">Describe what it should do.</p>
      </Link>
    </div>}
    {filtered && !filtered.length && !filteredWorkflows?.length && fleetSize ? <p className="empty">No agents match that search.</p> : null}
  </PageShell>;
}
