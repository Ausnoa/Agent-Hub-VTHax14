import Link from "next/link";
import { Bot, FileSearch, ShieldAlert, FileText, Network, Terminal } from "lucide-react";
import type { Composite } from "../../lib/contracts/index";
import Card from "../ui/card";
import StatusPill from "../ui/status-pill";
import Button from "../ui/button";
import AgentDagPreview, { type DagNode } from "./agent-dag-preview";

const modeLabel = { pilot: "LLM PILOT", demo: "OFFLINE DEMO", live: "ANS CATALOG" } as const;
const modeTone = { pilot: "accent", demo: "neutral", live: "violet" } as const;
const capabilityIcon: Record<string, typeof Bot> = {
  "company-research": FileSearch,
  "risk-analysis": ShieldAlert,
  summarization: FileText,
};

function dagNodesFor(agent: Composite): DagNode[] {
  if (agent.steps.length) {
    return agent.steps.map((step, index) => ({
      id: step.ansId || `${agent.id}-step-${index}`,
      name: step.name,
      status: step.source === "ans" ? "active" : "standby",
      kind: step.capability,
    }));
  }
  if (agent.plan.capabilities.length) {
    return agent.plan.capabilities.map((capability, index) => ({
      id: `${agent.id}-cap-${index}`,
      name: capability,
      status: "standby",
      kind: capability,
    }));
  }
  return [{ id: agent.id, name: agent.plan.name, status: "standby" }];
}

function formatLatency(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export default function AgentCard({ agent }: { agent: Composite }) {
  const Icon = capabilityIcon[agent.plan.capabilities[0]] ?? Bot;
  const dagNodes = dagNodesFor(agent);
  const flowSummary = `DAG: ${dagNodes.map((node) => `[${node.name}]`).join(" → ")}`;
  const stats = agent.stats;
  const metricBadge = stats?.runCount
    ? `${stats.runCount} run${stats.runCount === 1 ? "" : "s"}${stats.avgLatencyMs != null ? ` · ${formatLatency(stats.avgLatencyMs)} avg` : ""}`
    : agent.steps.length
      ? `${agent.steps.filter((step) => step.source === "ans").length}/${agent.steps.length} ANS-resolved`
      : `${dagNodes.length} stage${dagNodes.length === 1 ? "" : "s"}`;

  return <Card className="agent-card">
    <div className="agent-card-head">
      <div className="agent-card-icon"><Icon size={20} /></div>
      <StatusPill tone={modeTone[agent.mode]}>{modeLabel[agent.mode]}</StatusPill>
    </div>
    <div>
      <h2>{agent.plan.name}</h2>
      <p className="agent-card-description">{agent.plan.description}</p>
    </div>
    <AgentDagPreview nodes={dagNodes} flowSummary={flowSummary} metricBadge={metricBadge} />
    <div className="agent-card-tags">
      {agent.plan.capabilities.map((capability) => <span className="token-chip" key={capability}>{capability}</span>)}
    </div>
    <div className="agent-card-stats">
      <div>Connected agents<strong>{agent.steps.length}</strong></div>
      <div>Protocol<strong>A2A {agent.steps[0]?.protocolVersion ?? "0.3.0"}</strong></div>
    </div>
    <div className="agent-card-verify">
      <span className="hint">ANS identity</span>
      <StatusPill tone="amber">Not verified</StatusPill>
    </div>
    <div className="agent-card-footer">
      <div className="agent-card-actions">
        <Link href={`/agents/${agent.id}#pipeline`}><Button variant="ghost" size="sm"><Network size={14} /> View DAG</Button></Link>
        <Link href={`/agents/${agent.id}#runs`}><Button variant="ghost" size="sm"><Terminal size={14} /> Logs</Button></Link>
      </div>
      <Link href={`/agents/${agent.id}`} style={{ flex: 1 }}><Button variant="primary" block>Launch Interface</Button></Link>
    </div>
  </Card>;
}
