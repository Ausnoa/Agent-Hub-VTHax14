"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useComposerFlow } from "../../lib/composer-flow";
import PageShell from "../../components/layout/page-shell";
import PageHeader from "../../components/layout/page-header";
import ComposeSteps from "../../components/layout/compose-steps";
import Card, { CardHead } from "../../components/ui/card";
import Button from "../../components/ui/button";
import StatusPill from "../../components/ui/status-pill";
import TopologyGraph, { type TopologyNode } from "../../components/agent-hub/topology-graph";
import RegistryBrowser from "../../components/agent-hub/registry-browser";

// Step 2 of Compose. Browsing the registry without a composition lives at /discover.
export default function DiscoveryPage() {
  const router = useRouter();
  const { proposal, hydrated } = useComposerFlow();

  useEffect(() => {
    if (hydrated && !proposal) router.replace("/discover");
  }, [hydrated, proposal, router]);

  if (!hydrated || !proposal) return <PageShell><p className="hint">Loading…</p></PageShell>;

  const nodes: TopologyNode[] = proposal.steps.map((step, index) => ({
    id: step.capability,
    label: step.name,
    sublabel: step.ansId,
    angle: (360 / Math.max(proposal.steps.length, 1)) * index - 90,
    radius: 1,
    tone: step.source === "ans" ? "violet" : "accent",
  }));

  return <PageShell>
    <ComposeSteps current={2} />
    <PageHeader
      eyebrow="AUTONOMOUS PIPELINE DISCOVERY"
      title={`Decomposing Prompt: "${proposal.plan.name}"`}
      description={proposal.plan.description}
      action={<StatusPill tone={proposal.blockers.length ? "amber" : "green"}>{proposal.blockers.length ? "Needs attention" : "Decomposition complete"}</StatusPill>}
    />

    <div className="split-layout">
      <Card>
        <CardHead>Goal decomposition</CardHead>
        <TopologyGraph coreLabel="Goal Decomposer" coreSublabel="+ Data Provisioning" nodes={nodes} animated />
        <div className="metric-row" style={{ marginTop: 4 }}>
          <div className="metric-tile"><div className="metric-tile-label">Resolved capabilities</div><div className="metric-tile-value">{proposal.steps.length}</div></div>
          <div className="metric-tile"><div className="metric-tile-label">Planner</div><div className="metric-tile-value" style={{ fontSize: 14 }}>{proposal.planner === "llm" ? "LLM" : "Template"}</div></div>
          <div className="metric-tile"><div className="metric-tile-label">Blockers</div><div className="metric-tile-value">{proposal.blockers.length}</div></div>
        </div>
      </Card>

      <RegistryBrowser />
    </div>

    {!!proposal.blockers.length && <div className="alert" style={{ marginTop: 22 }}>
      <strong>This composition is incomplete</strong>
      <ul>{proposal.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
    </div>}

    <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
      <Button variant="primary" disabled={!!proposal.blockers.length || !proposal.steps.length} onClick={() => router.push("/workflow")}>
        Proceed to Workflow Review <ArrowRight size={14} />
      </Button>
    </div>
  </PageShell>;
}
