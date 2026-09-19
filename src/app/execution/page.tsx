"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { Run } from "../../lib/contracts/index";
import { api } from "../../lib/api-client";
import PageShell from "../../components/layout/page-shell";
import PageHeader from "../../components/layout/page-header";
import Card, { CardHead } from "../../components/ui/card";
import Button from "../../components/ui/button";
import MetricTile from "../../components/ui/metric-tile";
import StatusPill, { toneForRunStatus } from "../../components/ui/status-pill";

type RunSummary = Run & { agentName: string };
const filters = ["all", "running", "completed", "failed"] as const;

export default function ExecutionIndexPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<RunSummary[]>();
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [error, setError] = useState("");

  // Refresh while any run is still in progress, so statuses update without a reload.
  const active = runs?.some((run) => run.status === "queued" || run.status === "running");
  useEffect(() => {
    let live = true;
    const load = () => api<RunSummary[]>("runs").then((loaded) => { if (live) setRuns(loaded); }).catch(() => { if (live) setError("Could not load run history"); });
    load();
    const timer = active ? setInterval(load, 2000) : undefined;
    return () => { live = false; if (timer) clearInterval(timer); };
  }, [active]);

  const shown = useMemo(() => runs?.filter((run) => filter === "all"
    || (filter === "running" ? run.status === "running" || run.status === "queued" : run.status === filter)), [runs, filter]);
  const count = (status: Run["status"]) => runs?.filter((run) => run.status === status).length ?? 0;

  return <PageShell>
    <PageHeader
      eyebrow="EVERY A2A RUN ACROSS YOUR AGENTS"
      title="Execution history"
      description="Open any run to see its pipeline, trace, and output. Failed runs can be retried from their page."
    />
    {error && <div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div>}
    <div className="metric-row">
      <MetricTile label="Total runs" value={String(runs?.length ?? 0)} icon={<Activity size={16} />} />
      <MetricTile label="In progress" value={String(count("queued") + count("running"))} icon={<Clock size={16} />} />
      <MetricTile label="Completed" value={String(count("completed"))} icon={<CheckCircle2 size={16} />} />
      <MetricTile label="Failed" value={String(count("failed"))} icon={<XCircle size={16} />} />
    </div>
    <div className="filter-bar" style={{ marginBottom: 16 }}>
      {filters.map((item) => <button key={item} className={`filter-chip${filter === item ? " active" : ""}`} onClick={() => setFilter(item)}>{item}</button>)}
    </div>
    {shown === undefined && <p className="hint">Loading runs…</p>}
    {shown && !!shown.length && <Card>
      <CardHead>Recent runs</CardHead>
      {shown.map((run) => <button className="history-item" key={run.id} onClick={() => router.push(`/execution/${run.id}`)}>
        <span><strong style={{ color: "var(--text)" }}>{run.agentName}</strong> · {run.input.company}</span>
        <time>{new Date(run.createdAt).toLocaleString()}</time>
        <span className="go"><StatusPill tone={toneForRunStatus(run.status)} running={run.status === "running"}>{run.status}</StatusPill> Open →</span>
      </button>)}
    </Card>}
    {shown && !shown.length && <div className="empty">
      <p>{runs?.length ? "No runs match this filter." : "No runs yet. Open an agent and run it to see its execution here."}</p>
      {!runs?.length && <Link href="/agents"><Button variant="secondary">Go to My Agents</Button></Link>}
    </div>}
  </PageShell>;
}
