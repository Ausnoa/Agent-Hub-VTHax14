"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageShell from "../../components/layout/page-shell";
import PageHeader from "../../components/layout/page-header";
import Card, { CardHead } from "../../components/ui/card";
import Button from "../../components/ui/button";
import RegistryBrowser from "../../components/agent-hub/registry-browser";

// The Discover tab: browse the registry without starting a composition.
export default function DiscoverPage() {
  return <PageShell>
    <PageHeader
      eyebrow="AUTONOMOUS PIPELINE DISCOVERY"
      title="Browse the ANS registry"
      description="Search indexed and live ANS records directly. This doesn't require an LLM key — that's only needed to decompose a natural-language directive into a capability plan."
    />
    <div className="split-layout">
      <Card>
        <CardHead>Compose an agent</CardHead>
        <p className="hint" style={{ marginBottom: 16 }}>Have an outcome in mind? Describe it and Agent Hub will decompose it into a capability plan, then resolve each capability against this same registry.</p>
        <Link href="/create"><Button variant="primary">Start composing <ArrowRight size={14} /></Button></Link>
      </Card>
      <RegistryBrowser />
    </div>
  </PageShell>;
}
