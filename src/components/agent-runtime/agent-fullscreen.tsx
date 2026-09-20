"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Minimize2 } from "lucide-react";
import type { AgentUISpec, PrimitiveKind } from "../../lib/agent-ui/spec";
import type { Run } from "../../lib/contracts/index";
import type { Variant } from "../../lib/agent-ui/variant";
import StatusPill, { toneForRunStatus } from "../ui/status-pill";
import Mascot from "./mascot";
import PrimitiveView, { primitiveIcons, type PrimitiveProps } from "./primitives";

// The full-canvas workspace: capability rail on the left, the selected primitive in the centre,
// run history on the right. Escape or Minimize returns to the mini window.
export default function AgentFullScreen({ spec, runs, variant, status, onMinimize, primitiveProps }: {
  spec: AgentUISpec;
  runs: Run[];
  variant: Variant;
  status: string;
  onMinimize: () => void;
  primitiveProps: Omit<PrimitiveProps, "primitive" | "compact">;
}) {
  const [active, setActive] = useState<PrimitiveKind>(spec.primary);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onMinimize(); };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onMinimize]);

  const primitive = spec.primitives.find((item) => item.kind === active) ?? spec.primitives[0];

  return <div className="agent-full-backdrop" role="dialog" aria-modal="true" aria-label={`${spec.name} workspace`}>
    <div className="agent-full" ref={dialogRef} tabIndex={-1}>
      <header className="agent-full-head">
        <button onClick={onMinimize} aria-label="Back to floating window"><ArrowLeft size={15} /></button>
        <span className="agent-full-mascot" style={{ "--mascot-accent": variant.accent } as React.CSSProperties}><Mascot width={26} variant={variant} /></span>
        <div>
          <strong>{spec.name}</strong>
          <small>{spec.description}</small>
        </div>
        <StatusPill tone={status === "working" ? "accent" : status === "error" ? "red" : status === "done" ? "green" : "neutral"} running={status === "working"}>
          {status === "working" ? "Active" : status === "error" ? "Last run failed" : status === "done" ? "Ready" : "Idle"}
        </StatusPill>
        <button onClick={onMinimize} aria-label="Minimize"><Minimize2 size={15} /></button>
      </header>

      <div className="agent-full-body">
        <nav className="agent-full-rail" aria-label="Capabilities">
          {spec.primitives.map((item) => {
            const Icon = primitiveIcons[item.kind];
            return <button
              key={item.kind}
              className={`agent-rail-item${item.kind === active ? " active" : ""}${item.unavailable ? " muted" : ""}`}
              onClick={() => setActive(item.kind)}
            >
              <Icon size={15} /> {item.label}
            </button>;
          })}
        </nav>

        <main className="agent-full-main">
          <h3>{primitive.label}</h3>
          <PrimitiveView {...primitiveProps} primitive={primitive} />
        </main>

        <aside className="agent-full-side">
          <h4>Run history</h4>
          {!runs.length && <p className="hint">No runs yet.</p>}
          {runs.slice(0, 8).map((run) => <Link key={run.id} href={`/execution/${run.id}`} className="agent-mini-run">
            <StatusPill tone={toneForRunStatus(run.status)} running={run.status === "running"}>{run.status}</StatusPill>
            <span>{run.input.company}</span>
            <time>{new Date(run.createdAt).toLocaleTimeString()}</time>
          </Link>)}
        </aside>
      </div>
    </div>
  </div>;
}
