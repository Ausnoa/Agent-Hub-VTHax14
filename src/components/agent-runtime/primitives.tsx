"use client";

import { Download, FileUp, Mic, MessageSquare, Pencil, Play, Table2, FileText, Type } from "lucide-react";
import type { Run } from "../../lib/contracts/index";
import type { Primitive, PrimitiveKind } from "../../lib/agent-ui/spec";
import Button from "../ui/button";

export const primitiveIcons: Record<PrimitiveKind, React.ComponentType<{ size?: number }>> = {
  text_input: Type, file_upload: FileUp, audio_recording: Mic, chat: MessageSquare,
  results: FileText, editor: Pencil, table: Table2, download: Download,
};

export type PrimitiveProps = {
  primitive: Primitive;
  compact?: boolean;
  values: { company: string; notes: string };
  onChange: (field: "company" | "notes", value: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  busy: boolean;
  latest?: Run;
};

function Unavailable({ primitive }: { primitive: Primitive }) {
  return <div className="primitive-unavailable">
    <strong>{primitive.label}</strong>
    <p>{primitive.unavailable}</p>
  </div>;
}

function TextInput({ values, onChange, onSubmit, submitLabel, busy, compact }: PrimitiveProps) {
  return <div className="primitive-form">
    <label className="field-label" htmlFor={`pin-company-${compact ? "c" : "f"}`}>Company</label>
    <input id={`pin-company-${compact ? "c" : "f"}`} value={values.company} maxLength={120} onChange={(event) => onChange("company", event.target.value)} />
    <label className="field-label" htmlFor={`pin-notes-${compact ? "c" : "f"}`}>Source notes</label>
    <textarea id={`pin-notes-${compact ? "c" : "f"}`} rows={compact ? 4 : 10} value={values.notes} maxLength={12000} onChange={(event) => onChange("notes", event.target.value)} />
    <p className="hint">These notes flow through the selected agents. Use non-sensitive information.</p>
    <Button variant="primary" block disabled={busy || !values.company.trim() || !values.notes.trim()} onClick={onSubmit}>
      <Play size={14} /> {busy ? "Queueing…" : submitLabel}
    </Button>
  </div>;
}

function Results({ latest, compact }: PrimitiveProps) {
  if (!latest) return <p className="hint">No runs yet. Start one from the input panel.</p>;
  if (latest.status !== "completed" || !latest.output) {
    return <p className="hint">Latest run is {latest.status}{latest.error ? ` — ${latest.error}` : "…"}</p>;
  }
  const report = latest.output;
  return <div className="primitive-results">
    <div className="eyebrow">COMPLETED BRIEFING {report.fixture && "· FIXTURE OUTPUT"}</div>
    <h3>{report.company}</h3>
    <p>{report.summary || "No summary produced."}</p>
    {!compact && !!report.sources.length && <div className="primitive-sources">
      <strong>Sources</strong>{report.sources.map((source, index) => <span key={index}>{source}</span>)}
    </div>}
  </div>;
}

function ResultTable({ latest }: PrimitiveProps) {
  const report = latest?.output;
  if (!report) return <p className="hint">Run the agent to populate this table.</p>;
  const rows = [...report.facts.map((value) => ({ kind: "Observation", value })), ...report.risks.map((value) => ({ kind: "Risk signal", value }))];
  if (!rows.length) return <p className="hint">The last run produced no rows.</p>;
  return <div className="primitive-table-wrap"><table className="primitive-table">
    <thead><tr><th>Type</th><th>Detail</th></tr></thead>
    <tbody>{rows.map((row, index) => <tr key={index}><td>{row.kind}</td><td>{row.value}</td></tr>)}</tbody>
  </table></div>;
}

function DownloadOutput({ latest }: PrimitiveProps) {
  const report = latest?.output;
  const href = report ? `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(report, null, 2))}` : undefined;
  return <div className="primitive-form">
    <p className="hint">Export the latest completed run as JSON.</p>
    {href
      ? <a className="btn btn-secondary" href={href} download={`${(report?.company ?? "report").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`}><Download size={14} /> Download JSON</a>
      : <p className="hint">No completed run to export yet.</p>}
  </div>;
}

const renderers: Partial<Record<PrimitiveKind, (props: PrimitiveProps) => React.ReactNode>> = {
  text_input: TextInput, results: Results, table: ResultTable, download: DownloadOutput,
};

export default function PrimitiveView(props: PrimitiveProps) {
  if (props.primitive.unavailable) return <Unavailable primitive={props.primitive} />;
  const render = renderers[props.primitive.kind];
  return <>{render ? render(props) : <p className="hint">No renderer for {props.primitive.kind}.</p>}</>;
}
