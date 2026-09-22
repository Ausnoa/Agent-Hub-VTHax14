"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Rocket } from "lucide-react";
import type { Composite, Proposal } from "../../lib/contracts/index";
import { api } from "../../lib/api-client";
import { useComposerFlow } from "../../lib/composer-flow";
import { useAgentRuntime } from "../../components/agent-runtime/agent-provider";
import { specForComposite } from "../../lib/agent-ui/derive";
import PageShell from "../../components/layout/page-shell";
import PageHeader from "../../components/layout/page-header";
import ComposeSteps from "../../components/layout/compose-steps";
import Card, { CardHead } from "../../components/ui/card";
import Button from "../../components/ui/button";
import StatusPill from "../../components/ui/status-pill";
import PipelineStepCard, { PipelineConnector } from "../../components/agent-glorria/pipeline-step-card";
import GraphViewport from "../../components/agent-glorria/graph-viewport";
import PipelineSummary from "../../components/agent-glorria/pipeline-summary";

const modeNotice = {
  pilot: "Pilot catalog · Real LLM plan · Local test agents · Not registered with ANS",
  demo: "Offline demo · Fixed template · Fixture agents · Not registered with ANS",
  live: "Indexed ANS results · Real LLM plan · Identity has not been independently verified",
};

export default function WorkflowReviewPage() {
  const router = useRouter();
  const { proposal, setProposal, hydrated } = useComposerFlow();
  const { spawn } = useAgentRuntime();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Approval clears the draft before navigating to the saved agent. Do not let
    // the missing-draft fallback race that successful navigation.
    if (hydrated && !proposal && !busy) router.replace("/create");
  }, [hydrated, proposal, busy, router]);

  if (!hydrated || !proposal) return <PageShell><p className="hint">Loading…</p></PageShell>;

  async function approve(current: Proposal) {
    setBusy(true); setError("");
    try {
      const created = await api<Composite>("agents", { proposalId: current.id });
      setProposal(undefined);
      spawn(specForComposite(created), true);   // play the entrance animation
      router.push(`/agents/${created.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong");
      setBusy(false);
    }
  }

  return <PageShell className="screen-workflow">
    <ComposeSteps current={3} />
    <PageHeader
      eyebrow="A2A PIPELINE BUILDER"
      title={proposal.plan.name}
      description={proposal.plan.description}
      action={<StatusPill tone="accent">Serial pipeline</StatusPill>}
    />

    <p className="notice">{modeNotice[proposal.mode]}</p>
    {error && <div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div>}

    <Card className="pipeline-canvas">
      <CardHead badge={<StatusPill tone="accent">A2A 0.3.0</StatusPill>}>Composed pipeline</CardHead>
      <GraphViewport><div className="pipeline-row">
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

      </GraphViewport>
      <div className="metric-row">
        <div className="metric-tile"><div className="metric-tile-label">Pipeline steps</div><div className="metric-tile-value">{proposal.steps.length}</div></div>
        <div className="metric-tile"><div className="metric-tile-label">Protocol</div><div className="metric-tile-value" style={{ fontSize: 14 }}>A2A 0.3.0</div></div>
        <div className="metric-tile"><div className="metric-tile-label">Identity verification</div><div className="metric-tile-value" style={{ fontSize: 14, color: "var(--amber)" }}>Not verified</div></div>
      </div>
    </Card>
    <PipelineSummary steps={proposal.steps} />

    {!!proposal.blockers.length && <div className="alert" style={{ marginTop: 22 }}>
      <strong>This composition is incomplete</strong>
      <ul>{proposal.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
    </div>}

    <div className="screen-actionbar">
      <Button variant="secondary" onClick={() => router.push("/discovery")}><ArrowLeft size={14} /> Back to discovery</Button>
      <Button variant="primary" disabled={busy || !!proposal.blockers.length || !proposal.steps.length} onClick={() => approve(proposal)}>
        {busy ? "Deploying…" : <><Rocket size={14} /> Deploy & Generate Agent Interface <ArrowRight size={14} /></>}
      </Button>
    </div>
  </PageShell>;
}
