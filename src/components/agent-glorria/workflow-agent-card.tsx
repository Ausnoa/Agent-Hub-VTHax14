import Link from "next/link";
import type { ReactNode } from "react";
import { Network } from "lucide-react";
import { variantFor } from "../../lib/agent-ui/variant";
import Card from "../ui/card";
import StatusPill from "../ui/status-pill";
import Button from "../ui/button";
import Mascot from "../agent-runtime/mascot";
import AgentDagPreview, { type DagNode } from "./agent-dag-preview";
import { agentRootId, stepSource, type CapabilityAgent } from "../agent-runtime/capability-runner";

/** Search terms and filter chips shared by the local and hosted fleets. */
export const workflowAgentTags = (agent: CapabilityAgent) => agent.steps.map((step) => step.geminiTask ?? step.skill);

// Same card anatomy as the composite fleet card, for agents made through the capability
// pipeline or the workflow builder. Its cat, profile, and launchable interface share one id.
export default function WorkflowAgentCard({ agent, badge, actions }: { agent: CapabilityAgent; badge?: ReactNode; actions?: ReactNode }) {
  const ui = agent.capability?.ui;
  const variant = variantFor(agentRootId(agent));
  const nodes: DagNode[] = agent.steps.map((step, index) => ({ id: `${agent.id}-${index}`, name: step.name, status: stepSource(step) === "ANS" ? "active" : "standby", kind: stepSource(step) }));
  const sources = agent.steps.map(stepSource);
  return <Card className="agent-card">
    <div className="agent-card-head">
      <div className="agent-card-icon" style={{ "--mascot-accent": variant.accent } as React.CSSProperties}><Mascot width={30} variant={variant} /></div>
      {badge ?? <StatusPill tone={agent.capability?.generation === "specialists" ? "violet" : "neutral"}>{agent.capability ? "GLORRIA AGENT" : "WORKFLOW"}</StatusPill>}
    </div>
    <div>
      <h2>{ui?.title ?? agent.name}</h2>
      <p className="agent-card-description">{ui?.description ?? agent.description ?? `${agent.steps.length} connected capabilities`}</p>
    </div>
    <AgentDagPreview nodes={nodes} flowSummary={`Flow: ${agent.steps.map((step) => `[${step.name}]`).join(" → ")}`} metricBadge={`Revision ${agent.revision?.number ?? 1}`} />
    <div className="agent-card-tags">{[...new Set(workflowAgentTags(agent))].map((tag) => <span className="token-chip" key={tag}>{tag}</span>)}</div>
    <div className="agent-card-stats">
      <div>ANS agents<strong>{sources.filter((source) => source === "ANS").length}</strong></div>
      <div>Gemini steps<strong>{sources.filter((source) => source === "Gemini").length}</strong></div>
    </div>
    <div className="agent-card-verify">
      <span className="hint">Interface</span>
      <StatusPill tone={agent.capability?.generation === "specialists" ? "green" : "neutral"}>{agent.capability?.generation === "specialists" ? "Specialist-designed" : agent.capability ? "Standard layout" : "Not designed yet"}</StatusPill>
    </div>
    <div className="agent-card-footer">
      <div className="agent-card-actions">
        <Link href={`/agents/${agent.id}#enhance`}><Button variant="ghost" size="sm"><Network size={14} /> Enhance</Button></Link>
        {actions}
      </div>
      <Link href={`/agents/${agent.id}#launch`} style={{ flex: 1 }}><Button variant="primary" block>Launch Interface</Button></Link>
    </div>
  </Card>;
}
