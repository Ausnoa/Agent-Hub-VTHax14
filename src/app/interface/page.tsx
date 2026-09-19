"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Composite } from "../../lib/contracts/index";
import { api } from "../../lib/api-client";
import { lastAgent } from "../../lib/recent";
import PageShell from "../../components/layout/page-shell";
import PageHeader from "../../components/layout/page-header";
import Button from "../../components/ui/button";

// The Interface tab opens the last agent viewed in this browser, else the newest saved agent.
export default function InterfaceRedirectPage() {
  const router = useRouter();
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Composite[]>("agents").then((agents) => {
      const remembered = lastAgent();
      const target = agents.find((agent) => agent.id === remembered) ?? agents[0];
      if (target) router.replace(`/agents/${target.id}`);
      else setEmpty(true);
    }).catch(() => setError("Could not load your agents"));
  }, [router]);

  return <PageShell>
    <PageHeader eyebrow="GENERATED AGENT RUNTIME INTERFACE" title="Agent interface" />
    {error && <div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div>}
    {!empty && !error && <p className="hint">Opening your most recent agent…</p>}
    {empty && <div className="empty">
      <p>No saved agents yet. Compose one to get a runtime interface for it.</p>
      <Link href="/create"><Button variant="primary">Compose an agent</Button></Link>
    </div>}
  </PageShell>;
}
