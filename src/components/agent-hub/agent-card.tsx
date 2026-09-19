import Link from "next/link";
import { Bot, FileSearch, ShieldAlert, FileText } from "lucide-react";
import type { Composite } from "../../lib/contracts/index";
import Card from "../ui/card";
import StatusPill from "../ui/status-pill";
import Button from "../ui/button";

const modeLabel = { pilot: "LLM PILOT", demo: "OFFLINE DEMO", live: "ANS CATALOG" } as const;
const modeTone = { pilot: "accent", demo: "neutral", live: "violet" } as const;
const capabilityIcon: Record<string, typeof Bot> = {
  "company-research": FileSearch,
  "risk-analysis": ShieldAlert,
  summarization: FileText,
};

export default function AgentCard({ agent }: { agent: Composite }) {
  const Icon = capabilityIcon[agent.plan.capabilities[0]] ?? Bot;

  return <Card className="agent-card">
    <div className="agent-card-head">
      <div className="agent-card-icon"><Icon size={20} /></div>
      <StatusPill tone={modeTone[agent.mode]}>{modeLabel[agent.mode]}</StatusPill>
    </div>
    <div>
      <h2>{agent.plan.name}</h2>
      <span className="ans-id">agenthub://{agent.id}.agent.ans</span>
    </div>
    <p className="hint">{agent.plan.description}</p>
    {!!agent.steps.length && <div className="agent-card-art">
      <span>{agent.steps.map((step) => step.name).join(" → ")}</span>
    </div>}
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
      <Link href={`/agents/${agent.id}`} style={{ flex: 1 }}><Button variant="primary" block>Launch Interface</Button></Link>
    </div>
  </Card>;
}
