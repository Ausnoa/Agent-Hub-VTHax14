"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Maximize2, Minimize2, X } from "lucide-react";
import type { AgentUISpec } from "../../lib/agent-ui/spec";
import type { Variant } from "../../lib/agent-ui/variant";
import type { GeneralWorkflow } from "../../lib/general/contracts";
import { api } from "../../lib/api-client";
import StatusPill from "../ui/status-pill";
import Mascot from "./mascot";
import type { RunStatus } from "./agent-avatar";
import { localAgent, type CapabilityAgent } from "./capability-runner";
import AgentInterface from "./generated-app";

// A local cat's window for a workflow agent: the same specialist-designed interface as its
// profile, compact beside the cat or full screen. Runs go through the real queue and worker.
export default function CapabilityCatWindow({ spec, mode, variant, status, onExpand, onMinimize, onClose, onStatus }: {
  spec: AgentUISpec;
  mode: "mini" | "full";
  variant: Variant;
  status: RunStatus;
  onExpand: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onStatus: (status: RunStatus) => void;
}) {
  const [agent, setAgent] = useState<CapabilityAgent>(), [error, setError] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    api<GeneralWorkflow>(`general/${spec.workflowId}`).then((found) => { if (live) setAgent(localAgent(found)); }).catch(() => { if (live) setError("This agent is no longer available."); });
    return () => { live = false; };
  }, [spec.workflowId]);
  useEffect(() => {
    if (mode !== "full") return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onMinimize(); };
    document.addEventListener("keydown", onKey); dialog.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [mode, onMinimize]);

  const body = <>
    {error && <p role="alert">{error}</p>}
    {!agent && !error && <p className="hint">Loading agent…</p>}
    {agent && <AgentInterface agent={agent} local mode={mode === "mini" ? "compact" : "full"} onStatus={onStatus} />}
    <Link href={`/agents/${spec.workflowId}`} onClick={onClose}>Open profile &amp; enhance →</Link>
  </>;

  if (mode === "mini") return <section className="agent-mini from-right above capability-cat" aria-label={`${spec.name} quick actions`}>
    <header className="agent-mini-head">
      <div><strong>{spec.name}</strong><small>{spec.capabilities.slice(0, 3).join(" · ")}</small></div>
      <button onClick={onExpand} aria-label="Expand to full screen"><Maximize2 size={14} /></button>
      <button onClick={onClose} aria-label="Close window"><X size={15} /></button>
    </header>
    <div className="agent-mini-body">{body}</div>
  </section>;

  return <div className="agent-full-backdrop" role="dialog" aria-modal="true" aria-label={`${spec.name} workspace`}>
    <div className="agent-full capability-cat-full" ref={dialog} tabIndex={-1}>
      <header className="agent-full-head">
        <button onClick={onMinimize} aria-label="Back to floating window"><ArrowLeft size={15} /></button>
        <span className="agent-full-mascot" style={{ "--mascot-accent": variant.accent } as React.CSSProperties}><Mascot width={26} variant={variant} /></span>
        <div><strong>{spec.name}</strong><small>{spec.description}</small></div>
        <StatusPill tone={status === "working" ? "accent" : status === "error" ? "red" : status === "done" ? "green" : "neutral"} running={status === "working"}>
          {status === "working" ? "Active" : status === "error" ? "Last run failed" : status === "done" ? "Ready" : "Idle"}
        </StatusPill>
        <button onClick={onMinimize} aria-label="Minimize"><Minimize2 size={15} /></button>
      </header>
      <div className="agent-full-main capability-workspace">{body}</div>
    </div>
  </div>;
}
