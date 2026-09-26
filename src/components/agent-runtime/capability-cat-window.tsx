"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Maximize2, Minimize2, X } from "lucide-react";
import type { AgentUISpec } from "../../lib/agent-ui/spec";
import type { Variant } from "../../lib/agent-ui/variant";
import type { GeneralWorkflow } from "../../lib/general/contracts";
import { api } from "../../lib/api-client";
import Mascot from "./mascot";
import type { RunStatus } from "./agent-avatar";
import { localAgent, type CapabilityAgent } from "./capability-runner";
import AgentInterface from "./generated-app";
import { chatPosition } from "../../lib/agent-ui/chat-position";

// Keep the same interface mounted through resize and close/reopen transitions.
export default function CapabilityCatWindow({ spec, mode, hidden = false, variant, status, onExpand, onMinimize, onClose, onStatus }: {
  spec: AgentUISpec; mode: "mini" | "full"; hidden?: boolean; variant: Variant; status: RunStatus;
  onExpand: () => void; onMinimize: () => void; onClose: () => void; onStatus: (status: RunStatus) => void;
}) {
  const [agent, setAgent] = useState<CapabilityAgent>(), [error, setError] = useState("");
  const [launched, setLaunched] = useState(false);
  useEffect(() => { if (!hidden) setLaunched(true); }, [hidden]);
  const dialog = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{ left: number; top: number }>();
  useEffect(() => {
    if (hidden || mode !== 'mini') return;
    let frame: number;
    const position = () => {
      const cat = document.querySelector(`[data-agent-id="${CSS.escape(spec.agentId)}"]`);
      if (cat && dialog.current) {
        const anchor = cat.getBoundingClientRect(), size = dialog.current.getBoundingClientRect();
        const next = chatPosition({ x: anchor.x, y: anchor.y }, size, { width: innerWidth, height: innerHeight });
        setPlacement(old => old?.left === next.left && old?.top === next.top ? old : next);
      }
      frame = requestAnimationFrame(position);
    };
    position();
    return () => cancelAnimationFrame(frame);
  }, [spec.agentId, mode, hidden]);
  useEffect(() => {
    let live = true;
    api<GeneralWorkflow>(`general/${spec.workflowId}`).then(found => { if (live) { setAgent(localAgent(found)); setError(""); } }).catch(() => { if (live) setError("This agent is no longer available."); });
    return () => { live = false; };
  }, [spec.workflowId]);
  useEffect(() => {
    if (hidden) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") mode === "full" ? onMinimize() : onClose(); };
    document.addEventListener("keydown", onKey); dialog.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [mode, hidden, onMinimize, onClose]);
  return <div hidden={hidden} style={hidden ? { display: 'none' } : mode === 'mini' && placement ? { ...placement, right: 'auto', bottom: 'auto' } : undefined} className={mode === "full" ? "agent-full-backdrop" : "capability-floating-shell"}>
    <div className={mode === "full" ? "agent-full capability-cat-full" : "capability-floating-window"} ref={dialog} tabIndex={-1} role="dialog" aria-modal={mode === 'full' && !hidden ? true : undefined} aria-label={`${spec.name} workspace`}>
      <header className="agent-full-head">
        <Mascot width={26} variant={variant} />
        <div><strong>{spec.name}</strong><small>{status === 'working' ? 'Working…' : spec.capabilities.slice(0, 3).join(' · ')}</small></div>
        <button onClick={mode === 'full' ? onMinimize : onExpand} aria-label={mode === 'full' ? 'Minimize' : 'Expand to full screen'}>{mode === 'full' ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
        <button onClick={onClose} aria-label="Close window"><X size={15} /></button>
      </header>
      <div className="agent-full-main capability-workspace">
        {error && <p role="alert">{error}</p>}
        {!agent && !error && <p className="hint">Loading agent…</p>}
        {agent && launched && <AgentInterface agent={agent} local mode={mode === 'mini' ? 'compact' : 'full'} onStatus={onStatus} />}
        <Link href={`/agents/${spec.workflowId}`} onClick={onClose}>Open profile &amp; enhance →</Link>
      </div>
    </div>
  </div>;
}
