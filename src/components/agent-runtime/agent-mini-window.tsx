"use client";

import Link from "next/link";
import { Maximize2, X } from "lucide-react";
import type { AgentUISpec } from "../../lib/agent-ui/spec";
import type { Run } from "../../lib/contracts/index";
import StatusPill, { toneForRunStatus } from "../ui/status-pill";
import PrimitiveView, { type PrimitiveProps } from "./primitives";

// The compact floating window: the agent's primary input, plus its recent runs.
export default function AgentMiniWindow({ spec, runs, onExpand, onClose, side, primitiveProps }: {
  spec: AgentUISpec;
  runs: Run[];
  onExpand: () => void;
  onClose: () => void;
  side: { horizontal: "left" | "right"; vertical: "above" | "below" };
  primitiveProps: Omit<PrimitiveProps, "primitive" | "compact">;
}) {
  const primary = spec.primitives.find((item) => item.kind === spec.primary) ?? spec.primitives[0];
  return <section className={`agent-mini ${side.horizontal === "right" ? "from-right" : "from-left"} ${side.vertical}`} aria-label={`${spec.name} quick actions`}>
    <header className="agent-mini-head">
      <div>
        <strong>{spec.name}</strong>
        <small>{spec.capabilities.slice(0, 3).join(" · ") || "composite agent"}</small>
      </div>
      <button onClick={onExpand} aria-label="Expand to full screen"><Maximize2 size={14} /></button>
      <button onClick={onClose} aria-label="Close window"><X size={15} /></button>
    </header>

    <div className="agent-mini-body">
      <h4>{primary.label}</h4>
      <PrimitiveView {...primitiveProps} primitive={primary} compact />

      <h4>Recent</h4>
      {!runs.length && <p className="hint">No runs yet.</p>}
      {runs.slice(0, 3).map((run) => <Link key={run.id} href={`/execution/${run.id}`} className="agent-mini-run">
        <StatusPill tone={toneForRunStatus(run.status)} running={run.status === "running"}>{run.status}</StatusPill>
        <span>{run.input.company}</span>
        <time>{new Date(run.createdAt).toLocaleTimeString()}</time>
      </Link>)}
    </div>
  </section>;
}
