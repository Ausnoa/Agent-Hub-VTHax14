"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ShieldCheck } from "lucide-react";

const stages = [
  { key: "compose", label: "Compose", href: "/create" },
  { key: "discovery", label: "Discovery", href: "/discovery" },
  { key: "workflow", label: "Workflow", href: "/workflow" },
  { key: "interface", label: "Interface", href: "/agents" },
  { key: "execution", label: "Execution", href: "/agents" },
] as const;

export default function TopNav() {
  const pathname = usePathname();
  const isAgentDetail = pathname.startsWith("/agents/");
  const isMyAgents = pathname === "/agents" || pathname === "/";
  const activeStage = pathname.startsWith("/create") ? "compose"
    : pathname.startsWith("/discovery") ? "discovery"
    : pathname.startsWith("/workflow") ? "workflow"
    : pathname.startsWith("/execution") ? "execution"
    : isAgentDetail ? "interface"
    : "";

  return <header className="topnav">
    <Link href="/agents" className="topnav-brand">
      <Image src="/agent-emblem.svg" alt="" width={30} height={30} className="topnav-mark" priority />
      <span>Agent Hub<small>CORE EMBLEM</small></span>
    </Link>
    <span className="topnav-verified"><span className="live-dot" /><ShieldCheck size={12} /> ANS Verified A2A Network</span>
    <nav className="topnav-links" aria-label="Pipeline stages">
      {stages.map((stage) => (
        <Link key={stage.key} href={stage.href} className={`topnav-link${activeStage === stage.key ? " active" : ""}`}>
          {stage.label}
        </Link>
      ))}
    </nav>
    <div className="topnav-right">
      <div className="topnav-stat">Local workspace<strong>MVP EDITION</strong></div>
      <Link href="/agents" className={`topnav-agents-btn${isMyAgents ? " active" : ""}`}><LayoutGrid size={14} /> My Agents</Link>
    </div>
  </header>;
}
