import Link from "next/link";
import { FileText, FileSearch, HelpCircle, Network, Play } from "lucide-react";
import type { OwnedAgent } from "../../lib/owned-agent/templates";
import { templateFor } from "../../lib/owned-agent/templates";
import Card from "../ui/card";
import StatusPill from "../ui/status-pill";
import Button from "../ui/button";
import AgentDagPreview, { type DagNode } from "../agent-hub/agent-dag-preview";
import { ArchiveButton } from "./archive-controls";

type Run = { id: string; agent_id: string; status: string; output: string | null; created_at: string };

const templateIcon = { summary: FileText, extract: FileSearch, qa: HelpCircle } as const;

// Same card as the local fleet (Card / DAG preview / tag row / stats row / footer), but every
// field is true of a hosted template: one OpenAI-backed skill, not a resolved A2A pipeline, so
// this never claims "connected agents" or an A2A protocol version it doesn't have.
export default function HostedAgentCard({ agent, runs, busy, onToggleVisibility, onArchived }: {
  agent: OwnedAgent;
  runs: Run[];
  busy: string;
  onToggleVisibility: (agentId: string, next: "public" | "private") => void;
  onArchived?: () => void;
}) {
  const template = templateFor(agent.template);
  const Icon = templateIcon[agent.template];
  const runCount = runs.filter((run) => run.agent_id === agent.id).length;
  const dagNodes: DagNode[] = [{ id: agent.id, name: template.name, status: "standby" }];

  return <Card className="agent-card">
    <div className="agent-card-head">
      <div className="agent-card-icon"><Icon size={20} /></div>
      <StatusPill tone={agent.visibility === "public" ? "violet" : "neutral"}>{agent.visibility === "public" ? "PUBLIC" : "PRIVATE"}</StatusPill>
    </div>
    <div>
      <h2>{agent.name}</h2>
      <p className="agent-card-description">{agent.instructions || template.description}</p>
    </div>
    <AgentDagPreview nodes={dagNodes} flowSummary={`Template: [${template.name}]`} metricBadge={runCount ? `${runCount} run${runCount === 1 ? "" : "s"}` : "Not yet run"} />
    <div className="agent-card-tags">
      <span className="token-chip">{template.skill}</span>
    </div>
    <div className="agent-card-stats">
      <div>Runs<strong>{runCount}</strong></div>
      <div>Backend<strong>OpenAI template</strong></div>
    </div>
    <div className="agent-card-verify">
      <span className="hint">ANS identity</span>
      <StatusPill tone="amber">Not ANS registered</StatusPill>
    </div>
    <div className="agent-card-footer">
      <div className="agent-card-actions">
        <Link href={`/agents/${agent.id}`}><Button variant="ghost" size="sm"><Network size={14} /> View detail page</Button></Link>
        <Button variant="ghost" size="sm" disabled={busy === agent.id} onClick={() => onToggleVisibility(agent.id, agent.visibility === "public" ? "private" : "public")}>
          {busy === agent.id ? "Saving…" : agent.visibility === "public" ? "Make private" : "Publish"}
        </Button>
        <ArchiveButton kind="agents" id={agent.id} name={agent.name} onChanged={onArchived} />
      </div>
      <Link href={`/agent-preview?agent=${agent.id}`} style={{ flex: 1 }}><Button variant="primary" block><Play size={14} /> Open and test</Button></Link>
    </div>
  </Card>;
}
