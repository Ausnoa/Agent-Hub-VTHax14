import Link from "next/link";
import type { Composite } from "../../lib/contracts/index";
import Card from "../ui/card";
import StatusPill from "../ui/status-pill";
import Button from "../ui/button";

const modeLabel = { pilot: "LLM PILOT", demo: "OFFLINE DEMO", live: "ANS CATALOG" } as const;
const modeTone = { pilot: "accent", demo: "neutral", live: "violet" } as const;

export default function AgentCard({ agent }: { agent: Composite }) {
  return <Card className="agent-card">
    <div className="agent-card-art" aria-hidden="true" />
    <div className="agent-card-head">
      <div>
        <h2>{agent.plan.name}</h2>
        <span className="ans-id">agenthub://{agent.id}.agent.ans</span>
      </div>
      <StatusPill tone={modeTone[agent.mode]}>{modeLabel[agent.mode]}</StatusPill>
    </div>
    <p className="hint">{agent.plan.description}</p>
    <div className="agent-card-tags">
      {agent.plan.capabilities.map((capability) => <span className="token-chip" key={capability}>{capability}</span>)}
    </div>
    <div className="agent-card-stats">
      <div>Connected agents<strong>{agent.steps.length}</strong></div>
      <div>Protocol<strong>A2A {agent.steps[0]?.protocolVersion ?? "0.3.0"}</strong></div>
    </div>
    <div className="agent-card-footer">
      <Link href={`/agents/${agent.id}`} style={{ flex: 1 }}><Button variant="primary" block>Launch Interface</Button></Link>
    </div>
  </Card>;
}
