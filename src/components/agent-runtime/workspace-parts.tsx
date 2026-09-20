"use client";

import { useState } from "react";
import { SendHorizonal } from "lucide-react";
import type { Run } from "../../lib/contracts/index";

/**
 * Every template carries this bar. It is not a chat: each send queues a NEW run whose
 * input is the agent's own form values plus this instruction and the previous output,
 * because the runtime executes one-shot runs with no conversation state.
 */
export function PromptBar({ label, placeholder, onPrompt, busy }: {
  label: string;
  placeholder: string;
  onPrompt: (instruction: string) => void;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  return <form
    className="agent-prompt-bar"
    onSubmit={(event) => { event.preventDefault(); if (text.trim()) { onPrompt(text.trim()); setText(""); } }}
  >
    <label className="sr-only" htmlFor="agent-prompt">{label}</label>
    <span className="agent-prompt-label">{label}</span>
    <input id="agent-prompt" value={text} maxLength={2000} placeholder={placeholder} onChange={(event) => setText(event.target.value)} />
    <button type="submit" disabled={busy || !text.trim()} aria-label="Send instruction">
      <SendHorizonal size={15} />
    </button>
    <small>Queues a new run with this instruction and the previous output — not a live chat.</small>
  </form>;
}

export function MetricCards({ latest, runs }: { latest?: Run; runs: Run[] }) {
  const report = latest?.output;
  const finished = runs.filter((run) => run.status === "completed" || run.status === "failed");
  const durations = finished
    .map((run) => (Date.parse(run.updatedAt) - Date.parse(run.createdAt)) / 1000)
    .filter((seconds) => Number.isFinite(seconds) && seconds >= 0);
  const average = durations.length ? durations.reduce((total, value) => total + value, 0) / durations.length : undefined;
  const cards = [
    { label: "Observations", value: report ? String(report.facts.length) : "—" },
    { label: "Risk signals", value: report ? String(report.risks.length) : "—", tone: report?.risks.length ? "amber" : undefined },
    { label: "Runs", value: String(runs.length) },
    { label: "Avg duration", value: average === undefined ? "—" : `${average.toFixed(1)}s` },
  ];
  return <div className="agent-metrics">
    {cards.map((card) => <div key={card.label} className={`agent-metric${card.tone ? ` tone-${card.tone}` : ""}`}>
      <span>{card.label}</span>
      <strong>{card.value}</strong>
    </div>)}
  </div>;
}

/**
 * Magnitude comparison of what the last run produced, and how long recent runs took.
 * One measure per chart, one hue, direct value labels, no legend (a single series names
 * itself in the title). Values come from real runs; nothing is synthesised.
 */
export function FindingsChart({ latest, runs }: { latest?: Run; runs: Run[] }) {
  const report = latest?.output;
  const counts = report ? [
    { label: "Observations", value: report.facts.length },
    { label: "Risk signals", value: report.risks.length },
  ] : [];
  const recent = runs
    .filter((run) => run.status === "completed" || run.status === "failed")
    .slice(0, 6)
    .map((run) => ({ label: new Date(run.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), value: (Date.parse(run.updatedAt) - Date.parse(run.createdAt)) / 1000 }))
    .reverse();

  if (!counts.length && !recent.length) return <p className="hint">Run the agent to chart its output.</p>;

  return <div className="agent-charts">
    {!!counts.length && <figure className="agent-chart">
      <figcaption>Findings in the latest run</figcaption>
      <Bars rows={counts} format={(value) => String(value)} />
    </figure>}
    {recent.length > 1 && <figure className="agent-chart">
      <figcaption>Run duration, most recent last (seconds)</figcaption>
      <Bars rows={recent} format={(value) => `${value.toFixed(1)}s`} />
    </figure>}
  </div>;
}

function Bars({ rows, format }: { rows: { label: string; value: number }[]; format: (value: number) => string }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return <div className="agent-bars">
    {rows.map((row) => <div className="agent-bar-row" key={row.label} title={`${row.label}: ${format(row.value)}`}>
      <span className="agent-bar-label">{row.label}</span>
      <span className="agent-bar-track">
        <span className="agent-bar-fill" style={{ width: `${Math.max((row.value / max) * 100, row.value ? 3 : 0)}%` }} />
      </span>
      <span className="agent-bar-value">{format(row.value)}</span>
    </div>)}
  </div>;
}
