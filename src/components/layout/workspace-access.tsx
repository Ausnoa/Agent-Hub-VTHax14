"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import PageShell from "./page-shell";
import PageHeader from "./page-header";
import Card from "../ui/card";
import WorkflowPages from "../hosted/workflow-pages";
import AccountPages from "../hosted/account-pages";
import DiscoveryPage from "../hosted/discovery-page";
import AgentDetailPage from "../hosted/agent-detail-page";

// Presentation only. The API still enforces its own local-workspace restriction.
// Keep workspace children unmounted on hosted pages so their effects cannot call
// local-only APIs and display misleading load failures or empty personal data.
export default function WorkspaceAccess({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [local, setLocal] = useState<boolean>();
  useEffect(() => { setLocal(["localhost", "127.0.0.1"].includes(window.location.hostname) && !new URLSearchParams(window.location.search).has("hosted")); }, [pathname]);
  if (["/agent-preview", "/login"].includes(pathname) || pathname.startsWith("/profile/")) return children;
  if (local === undefined) return <PageShell><p role="status">Loading workspace…</p></PageShell>;
  if (local) return children;
  if (pathname === "/agents") return <AccountPages />;
  // /agents/[id] has no meaning on the local (single-tenant) workspace, so it
  // isn't in the always-passthrough list above; on a hosted deployment it's the
  // read-only detail/launch page for either an owned or a public agent.
  if (pathname.startsWith("/agents/")) return <AgentDetailPage />;
  if (pathname === "/execution") return <><WorkflowPages mode="history"/><AccountPages history /></>;
  // The old ANS/template component search that used to live at /discover is still
  // available inline inside /create; /discover is now the public agent marketplace.
  if (pathname === "/discover") return <DiscoveryPage/>;
  if (["/create", "/general"].includes(pathname)) return <WorkflowPages mode="compose"/>;
  return <PageShell narrow>
    <PageHeader eyebrow="HOSTED PREVIEW" title={pathname === "/available" ? "Registry discovery needs the local workspace" : "Hosted workflows are coming next"}
      description="You can create agents, save them to your account, and review test results online. Registry search and multi-agent workflow execution still use the local backend." />
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
