"use client";

import { Fragment, use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, ArrowLeft } from "lucide-react";
import type { Composite, Run } from "../../../lib/contracts/index";
import { api } from "../../../lib/api-client";
import PageShell from "../../../components/layout/page-shell";
import PageHeader from "../../../components/layout/page-header";
import Card, { CardHead } from "../../../components/ui/card";
import Button from "../../../components/ui/button";
import StatusPill, { toneForRunStatus } from "../../../components/ui/status-pill";
import PipelineStepCard, { PipelineConnector } from "../../../components/agent-hub/pipeline-step-card";
import TerminalLogFeed, { type LogLine } from "../../../components/agent-hub/terminal-log-feed";
import RunReceiptPanel from "../../../components/agent-hub/run-receipt-panel";

export default function ExecutionPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const router = useRouter();
  const [run, setRun] = useState<Run>();
  const [agent, setAgent] = useState<Composite>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Run>(`runs/${runId}`)
      .then(async (loaded) => { setRun(loaded); setAgent((await api<{ agent: Composite }>(`agents/${loaded.agentId}`)).agent); })
      .catch(() => setError("Could not load this run"));
  }, [runId]);

  useEffect(() => {
    if (!run || !["queued", "running"].includes(run.status)) return;
    let active = true;
    const timer = setInterval(() => {
      api<Run>(`runs/${runId}`).then((updated) => { if (active) setRun(updated); }).catch(() => { if (active) setError("Progress connection lost. Reload to reconnect."); });
    }, 900);
    return () => { active = false; clearInterval(timer); };
  }, [runId, run?.status]);

  async function retry() {
    setBusy(true); setError("");
    try { setRun(await api<Run>(`runs/${runId}/retry`, {})); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Something went wrong"); }
    finally { setBusy(false); }
  }

  if (error && !run) return <PageShell><div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div></PageShell>;
  if (!run || !agent) return <PageShell><p className="hint">Loading run…</p></PageShell>;

  const steps = agent.steps;
  const completedCount = steps.filter((step) => run.attempts.some((attempt) => attempt.capability === step.capability && attempt.status === "completed")).length;
  const logs: LogLine[] = run.attempts.map((attempt) => ({
    time: new Date(attempt.startedAt).toLocaleTimeString(),
    emphasis: attempt.capability,
    text: attempt.status === "completed"
      ? `completed in ${((Date.parse(attempt.completedAt ?? attempt.startedAt) - Date.parse(attempt.startedAt)) / 1000).toFixed(1)}s`
      : attempt.status === "failed" ? `failed — ${attempt.error ?? "unknown error"}` : `attempt ${attempt.attempt} running…`,
  }));

  return <PageShell>
    <PageHeader
      eyebrow="LIVE A2A EXECUTION"
      title={agent.plan.name}
      description={`Step ${Math.min(completedCount + 1, steps.length)} of ${steps.length}`}
    />

    <div className={`card panel execution-banner${run.status === "failed" ? " fault" : ""}`}>
      <div className="execution-banner-left">
        <StatusPill tone={toneForRunStatus(run.status)} running={run.status === "running"}>{run.status}</StatusPill>
        <span className="hint">Run {run.id.slice(0, 8)} · started {new Date(run.createdAt).toLocaleTimeString()}</span>
      </div>
      {run.status === "failed" && <Button variant="secondary" disabled={busy} onClick={retry}><RotateCcw size={14} className={busy ? "spin" : undefined} /> {busy ? "Retrying…" : "Retry failed step"}</Button>}
    </div>

    {error && <div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div>}
    {run.status === "failed" && run.error && <div className="alert"><strong>Execution failed</strong><p>{run.error}</p></div>}

    <Card>
      <CardHead>Pipeline sequencer</CardHead>
      <div className="pipeline-row">
        {steps.map((step, index) => {
          const attempts = run.attempts.filter((attempt) => attempt.capability === step.capability);
          const latest = attempts.at(-1);
          const status = latest?.status ?? "waiting";
          return <Fragment key={step.capability}>
            {index > 0 && <PipelineConnector active={!!latest} />}
            <PipelineStepCard
              index={index}
              name={step.name}
              ansId={step.ansId}
              statusLabel={status}
              statusTone={status === "completed" ? "green" : status === "failed" ? "red" : status === "running" ? "accent" : "neutral"}
              running={status === "running"}
              active={status === "running"}
              metrics={latest?.completedAt ? [{ label: "Duration", value: `${((Date.parse(latest.completedAt) - Date.parse(latest.startedAt)) / 1000).toFixed(1)}s` }] : undefined}
              footer={latest?.output && <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer", color: "var(--accent)", fontSize: 10.5 }}>View output</summary>
                <pre style={{ fontSize: 10, background: "var(--bg-inset)", padding: 10, borderRadius: 6, marginTop: 8, overflow: "auto", maxHeight: 160 }}>{JSON.stringify(latest.output, null, 2)}</pre>
              </details>}
            />
          </Fragment>;
        })}
      </div>
    </Card>

    <div className="split-layout" style={{ marginTop: 20 }}>
      <Card>
        <CardHead>Execution trace</CardHead>
        <TerminalLogFeed lines={logs} />
      </Card>
      <Card>
        <CardHead>Run receipt</CardHead>
        <RunReceiptPanel rows={[
          { label: "Run id", value: run.id },
          { label: "Agent id", value: run.agentId },
          { label: "Status", value: run.status },
          { label: "Created", value: new Date(run.createdAt).toLocaleString() },
          { label: "Updated", value: new Date(run.updatedAt).toLocaleString() },
        ]} />
      </Card>
    </div>

    {run.output && <Card style={{ marginTop: 20 }}>
      <div className="eyebrow">COMPLETED BRIEFING {run.output.fixture && "· FIXTURE OUTPUT"}</div>
      <h2 style={{ fontSize: 20, margin: "6px 0 12px" }}>{run.output.company}</h2>
      <p className="hint" style={{ fontSize: 12.5 }}>{run.output.summary}</p>
      <div className="split-layout" style={{ marginTop: 16 }}>
        <div><h3 style={{ fontSize: 12 }}>Observations</h3><ul style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.9 }}>{run.output.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul></div>
        <div>
          <h3 style={{ fontSize: 12 }}>Possible risk signals</h3>
          <ul style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.9 }}>{run.output.risks.map((risk, index) => <li key={index}>{risk}</li>)}</ul>
          {!run.output.risks.length && <p className="hint">No signals matched this adapter.</p>}
        </div>
      </div>
    </Card>}

    <div style={{ marginTop: 24 }}>
      <Button variant="secondary" onClick={() => router.push(`/agents/${agent.id}`)}><ArrowLeft size={14} /> Back to agent interface</Button>
    </div>
  </PageShell>;
}
