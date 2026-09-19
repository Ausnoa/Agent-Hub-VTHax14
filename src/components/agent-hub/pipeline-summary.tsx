import { Network, ArrowRight, Shield } from "lucide-react";
import type { SelectedAgent } from "../../lib/contracts/index";

export default function PipelineSummary({ steps }: { steps: SelectedAgent[] }) {
  return <section className="pipeline-summary" aria-label="Pipeline architecture">
    <div className="section-kicker"><Network size={14} /> COMPOSITE ARCHITECTURE <span>{steps.length} NODES</span></div>
    <div className="architecture-route">{steps.map((step, index) => <span key={`${step.capability}-${index}`}>{index > 0 && <ArrowRight size={14} aria-hidden="true" />}<b>{step.name}</b></span>)}</div>
    <div className="architecture-nodes">{steps.map((step, index) => <div key={`${step.capability}-${index}`}><span className="mono">{String(index + 1).padStart(2, "0")}</span><strong>{step.name}</strong><span>{step.source === "ans" ? "ANS resolved" : "Local test agent"}</span></div>)}</div>
    <p className="architecture-note"><Shield size={16} /> Registry presence and protocol compatibility do not verify identity.</p>
  </section>;
}
