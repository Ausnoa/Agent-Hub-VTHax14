"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Rocket } from "lucide-react";
import type { Composite, Proposal } from "../../lib/contracts/index";
import { api } from "../../lib/api-client";
import { useComposerFlow } from "../../lib/composer-flow";
import PageShell from "../../components/layout/page-shell";
import PageHeader from "../../components/layout/page-header";
import Card, { CardHead } from "../../components/ui/card";
import Button from "../../components/ui/button";
import StatusPill from "../../components/ui/status-pill";
import PipelineStepCard, { PipelineConnector } from "../../components/agent-hub/pipeline-step-card";

const modeNotice = {
  pilot: "Pilot catalog · Real LLM plan · Local test agents · Not registered with ANS",
  demo: "Offline demo · Fixed template · Fixture agents · Not registered with ANS",
  live: "Indexed ANS results · Real LLM plan · Identity has not been independently verified",
};

export default function WorkflowReviewPage() {
  const router = useRouter();
  const { proposal, setProposal, hydrated } = useComposerFlow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hydrated && !proposal) router.replace("/create");
  }, [hydrated, proposal, router]);

  if (!hydrated || !proposal) return <PageShell><p className="hint">Loading…</p></PageShell>;

  async function approve(current: Proposal) {
    setBusy(true); setError("");
    try {
      const created = await api<Composite>("agents", { proposalId: current.id });
      setProposal(undefined);
      router.push(`/agents/${created.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong");
      setBusy(false);
    }
  }

  return <PageShell>
    <PageHeader
      eyebrow="A2A PIPELINE BUILDER"
      title={proposal.plan.name}
      description={proposal.plan.description}
      action={<StatusPill tone="accent">Serial pipeline</StatusPill>}
    />

    <p className="notice">{modeNotice[proposal.mode]}</p>
    {error && <div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div>}

    <Card>
      <CardHead>Composed pipeline</CardHead>
      <div className="pipeline-row">
        {proposal.steps.map((step, index) => <Fragment key={step.capability}>
          {index > 0 && <PipelineConnector />}
          <PipelineStepCard
            index={index}
            name={step.name}
            ansId={step.ansId}
            statusLabel={step.source === "ans" ? "ANS resolved" : "Local test"}
            statusTone={step.source === "ans" ? "violet" : "accent"}
            metrics={[{ label: "Protocol", value: `A2A ${step.protocolVersion}` }]}
            footer={<details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", color: "var(--accent)", fontSize: 10.5 }}>Inspect agent</summary>
              <dl style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.8, marginTop: 8, overflowWrap: "anywhere" }}>
                <dt style={{ color: "var(--text-faint)", fontWeight: 600 }}>Endpoint</dt><dd className="mono">{step.endpoint}</dd>
                <dt style={{ color: "var(--text-faint)", fontWeight: 600, marginTop: 6 }}>Capability</dt><dd>{step.capability}</dd>
                <dt style={{ color: "var(--text-faint)", fontWeight: 600, marginTop: 6 }}>Identity</dt><dd>Not verified</dd>
              </dl>
            </details>}
          />
        </Fragment>)}
      </div>

      <div className="metric-row">
        <div className="metric-tile"><div className="metric-tile-label">Pipeline steps</div><div className="metric-tile-value">{proposal.steps.length}</div></div>
        <div className="metric-tile"><div className="metric-tile-label">Protocol</div><div className="metric-tile-value" style={{ fontSize: 14 }}>A2A 0.3.0</div></div>
        <div className="metric-tile"><div className="metric-tile-label">Identity verification</div><div className="metric-tile-value" style={{ fontSize: 14, color: "var(--amber)" }}>Not verified</div></div>
      </div>
    </Card>

    {!!proposal.blockers.length && <div className="alert" style={{ marginTop: 22 }}>
      <strong>This composition is incomplete</strong>
      <ul>{proposal.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
    </div>}

    <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 12 }}>
      <Button variant="secondary" onClick={() => router.push("/discovery")}><ArrowLeft size={14} /> Back to discovery</Button>
      <Button variant="primary" disabled={busy || !!proposal.blockers.length || !proposal.steps.length} onClick={() => approve(proposal)}>
        {busy ? "Deploying…" : <><Rocket size={14} /> Deploy & Generate Agent Interface <ArrowRight size={14} /></>}
      </Button>
    </div>
  </PageShell>;
}
