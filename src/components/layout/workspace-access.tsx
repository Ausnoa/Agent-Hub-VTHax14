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
    <PageHeader eyebrow="HOSTED PREVIEW" title="Workflow execution runs locally for now"
      description="Registry browsing, multi-agent workflows, and their run history still require the local workspace. The template builder has a separate hosted account flow." />
    <Card>
      <h2>Create and test template agents</h2>
      <p>Open the template builder to sign in, save your agents, and test them once hosted accounts are configured. You can also explore the templates without signing in.</p>
      <Link className="filter-chip" href="/agent-preview">Open template builder →</Link>
    </Card>
    <Card>
      <h2>Continue in your local workspace</h2>
      <p>If you have Agent Hub running on your computer, open the localhost address shown in your terminal. Your saved agents and workflows remain there.</p>
      <p>Hosted workflow execution is a later milestone. Saving a template agent does not publish it or register it with ANS.</p>
    </Card>
  </PageShell>;
}
