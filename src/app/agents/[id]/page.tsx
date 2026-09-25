"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Network, SlidersHorizontal } from "lucide-react";
import type { Composite, Run } from "../../../lib/contracts/index";
import { reportForm } from "../../../lib/contracts/ui";
import { api } from "../../../lib/api-client";
import { useAgentRuntime } from "../../../components/agent-runtime/agent-provider";
import { specForCapability, specForComposite } from "../../../lib/agent-ui/derive";
import type { GeneralWorkflow } from "../../../lib/general/contracts";
import { localAgent, type CapabilityAgent } from "../../../components/agent-runtime/capability-runner";
import { CapabilityHeader, CapabilityProfileBody } from "../../../components/agent-runtime/capability-profile";
import PageShell from "../../../components/layout/page-shell";
import PageHeader from "../../../components/layout/page-header";
import Card, { CardHead } from "../../../components/ui/card";
import Button from "../../../components/ui/button";
import StatusPill from "../../../components/ui/status-pill";
import AgentInputs from "../../../components/agent-glorria/agent-inputs";
import ReportPanel from "../../../components/agent-glorria/report-panel";
import AgentDagPreview from "../../../components/agent-glorria/agent-dag-preview";

const modeLabel = { pilot: "LLM PILOT", demo: "OFFLINE DEMO", live: "ANS CATALOG" } as const;
const modeTone = { pilot: "accent", demo: "neutral", live: "violet" } as const;
const modeNotice = {
  live: "Live workflow: agents receive the notes you submit. Identity remains unverified.",
  pilot: "LLM-planned pilot: deterministic local agents analyze your supplied notes. No live research or verified identity is claimed.",
  demo: "Offline demo: deterministic local agents analyze your supplied notes. No live research or verified identity is claimed.",
};

export default function RuntimeInterfacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { spawn } = useAgentRuntime();
  const [agent, setAgent] = useState<Composite>();
  const [workflow, setWorkflow] = useState<CapabilityAgent>();
  const [history, setHistory] = useState<Run[]>([]);
  const [company, setCompany] = useState("Northstar (fictional)");
  const [notes, setNotes] = useState("Northstar makes warehouse inventory software.\nRevenue grew 18% in this fictional example.\nThe business depends on one cloud supplier.\nTwo customers account for 45% of revenue.\nNew product delivery has been delayed.");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ agent: Composite; runs: Run[] }>(`agents/${id}`)
      .then((data) => { setAgent(data.agent); setHistory(data.runs); spawn(specForComposite(data.agent)); })
      // Not a report composite: agents created or hand-built through the capability pipeline.
      .catch(() => api<GeneralWorkflow>(`general/${id}`).then((found) => { setWorkflow(localAgent(found)); spawn(specForCapability(found)); }))
      .catch(() => setError("Could not load this agent"));
  }, [id, spawn]);

  async function invoke() {
    setBusy(true); setError("");
    try {
      const run = await api<Run>(`agents/${id}/invoke`, { company, notes });
      router.push(`/execution/${run.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (workflow) return <PageShell className="capability-workspace"><CapabilityHeader agent={workflow} /><CapabilityProfileBody agent={workflow} local canEnhance /></PageShell>;
  if (error && !agent) return <PageShell><div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div></PageShell>;
  if (!agent) return <PageShell><p className="hint">Loading agent…</p></PageShell>;

  const schema = agent.uiSchema ?? reportForm;

  return <PageShell className="screen-runtime">
    <PageHeader
      eyebrow="GENERATED AGENT RUNTIME INTERFACE"
      title={agent.plan.name}
      description={agent.plan.description}
      action={<StatusPill tone={modeTone[agent.mode]}>{modeLabel[agent.mode]}</StatusPill>}
    />

    <p className="notice">{modeNotice[agent.mode]}</p>
    {error && <div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div>}

    <section className="runtime-node-strip" aria-label="Composite nodes">
      {agent.steps.map((step, index) => <div key={step.capability}><Network size={18} /><div><span>NODE {String(index + 1).padStart(2, "0")}</span><strong>{step.name}</strong></div><span className="node-source">{step.source === "ans" ? "ANS" : "LOCAL"}</span></div>)}
    </section>
    <div className="runtime-layout">
      <Card className="runtime-parameters">
        <CardHead badge={<SlidersHorizontal size={18} />}>Execution parameters</CardHead>
        <AgentInputs schema={schema} values={{ company, notes }} onChange={(name, value) => name === "company" ? setCompany(value) : setNotes(value)} />
        <p className="hint" style={{ margin: "14px 0" }}>These notes flow through the selected agents. Use non-sensitive information.</p>
        <Button variant="primary" block disabled={busy || !company.trim() || !notes.trim()} onClick={invoke}>
          {busy ? "Queueing run…" : <><Play size={14} /> {schema.submitLabel}</>}
        </Button>
      </Card>

      <div className="runtime-output">
      <ReportPanel report={history.find((item) => item.output)?.output} />
      <Card id="pipeline" className="runtime-pipeline">
        <CardHead>Nodes in composite workflow</CardHead>
        <AgentDagPreview nodes={agent.steps.map((step) => ({ id: step.ansId, name: step.name, kind: step.capability, status: "standby" }))} flowSummary={agent.steps.map((step) => step.name).join(" → ")} metricBadge={`${agent.steps.length} nodes`} />
        <div style={{ display: "grid", gap: 10 }}>
          {agent.steps.map((step, index) => <div className="registry-item" key={step.capability}>
            <span className="registry-item-icon">{index + 1}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3>{step.name}</h3>
              <p className="mono">{step.ansId}</p>
            </div>
            <StatusPill tone={step.source === "ans" ? "violet" : "accent"}>{step.source === "ans" ? "ANS" : "Local test"}</StatusPill>
          </div>)}
        </div>
      </Card>
      </div>
    </div>

    {!!history.length && <Card id="runs" style={{ marginTop: 20 }}>
      <CardHead>Recent runs</CardHead>
      {history.map((item) => <button className="history-item" key={item.id} onClick={() => router.push(`/execution/${item.id}`)}>
        <span>{item.input.company}</span>
        <time>{new Date(item.createdAt).toLocaleString()}</time>
        <span className="go">{item.status} · Open →</span>
      </button>)}
    </Card>}
  </PageShell>;
}
