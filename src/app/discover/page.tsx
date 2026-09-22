"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageShell from "../../components/layout/page-shell";
import PageHeader from "../../components/layout/page-header";
import Card, { CardHead } from "../../components/ui/card";
import Button from "../../components/ui/button";
import RegistryBrowser from "../../components/agent-glorria/registry-browser";
import TopologyGraph from "../../components/agent-glorria/topology-graph";

// The Discover tab: browse the registry without starting a composition.
export default function DiscoverPage() {
  return <PageShell className="screen-discovery">
    <PageHeader
      eyebrow="AUTONOMOUS PIPELINE DISCOVERY"
      title="Discover your next capability."
      description="Explore the ANS registry, inspect agent capabilities, and find the right collaborators for your workflow."
      action={<Link href="/dashboard"><Button variant="primary">Open dashboard <ArrowRight size={14} /></Button></Link>}
    />
    <div className="split-layout">
      <Card className="mesh-panel">
        <CardHead>Compose an agent</CardHead>
        <p className="hint" style={{ marginBottom: 16 }}>Have an outcome in mind? Describe it and Agent Glorria will decompose it into a capability plan, then resolve each capability against this same registry.</p>
        <TopologyGraph coreLabel="ANS Discovery" coreSublabel="Capability resolution" nodes={[
          { id: "directive", label: "Your directive", sublabel: "Describe an outcome", angle: 225, radius: 0.8 },
          { id: "registry", label: "Agent registry", sublabel: "Browse capabilities", angle: 45, radius: 0.8, tone: "violet" },
        ]} />
        <p className="hint">Illustrative topology · search results appear in the registry panel.</p>
        <Link href="/create"><Button variant="primary">Start composing <ArrowRight size={14} /></Button></Link>
      </Card>
      <RegistryBrowser />
    </div>
  </PageShell>;
}
