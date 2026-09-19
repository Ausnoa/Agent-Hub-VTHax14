import { ArrowRight } from "lucide-react";
import type { PillTone } from "../ui/status-pill";
import StatusPill from "../ui/status-pill";

export default function PipelineStepCard({ index, name, ansId, statusLabel, statusTone, running, metrics, footer, active }: {
  index: number;
  name: string;
  ansId?: string;
  statusLabel: string;
  statusTone: PillTone;
  running?: boolean;
  metrics?: { label: string; value: string }[];
  footer?: React.ReactNode;
  active?: boolean;
}) {
  return <div className={`card pipeline-step${active ? " card--active" : ""}`}>
    <div className="pipeline-step-head">
      <span className="card-index">0{index + 1}</span>
      <StatusPill tone={statusTone} running={running}>{statusLabel}</StatusPill>
    </div>
    <h3>{name}</h3>
    {ansId && <span className="ans-id">{ansId}</span>}
    {!!metrics?.length && <div className="pipeline-step-metrics">
      {metrics.map((metric) => <div key={metric.label}>{metric.label}<strong>{metric.value}</strong></div>)}
    </div>}
    {footer}
  </div>;
}

export function PipelineConnector({ active }: { active?: boolean }) {
  return <div className={`pipeline-connector${active ? " active" : ""}`} aria-hidden="true"><ArrowRight size={16} /></div>;
}
