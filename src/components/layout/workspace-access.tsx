"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import PageShell from "./page-shell";
import PageHeader from "./page-header";
import Card from "../ui/card";

// Presentation only. The API still enforces its own local-workspace restriction.
// Keep workspace children unmounted on hosted pages so their effects cannot call
// local-only APIs and display misleading load failures or empty personal data.
export default function WorkspaceAccess({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [local, setLocal] = useState<boolean>();
  useEffect(() => { setLocal(["localhost", "127.0.0.1"].includes(window.location.hostname)); }, []);
  if (pathname === "/agent-preview") return children;
  if (local === undefined) return <PageShell><p role="status">Loading workspace…</p></PageShell>;
  if (local) return children;
  return <PageShell narrow>
    <PageHeader eyebrow="HOSTED PREVIEW" title="Your workspace runs locally for now"
      description="Saved agents, registry browsing, workflow creation, and run history are available in the local workspace. This hosted preview is not connected to a personal workspace yet." />
    <Card>
      <h2>Explore the agent templates</h2>
      <p>Preview the Summarizer, Information extractor, and Document Q&A templates. Saving and testing agents currently require the local workspace.</p>
      <Link className="filter-chip" href="/agent-preview">Explore templates →</Link>
    </Card>
    <Card>
      <h2>Continue in your local workspace</h2>
      <p>If you have Agent Hub running on your computer, open the localhost address shown in your terminal. Your saved agents and workflows remain there.</p>
      <p>Hosted accounts, storage, and workflow execution are still being developed. ANS registration is separate from this workspace.</p>
    </Card>
  </PageShell>;
}
