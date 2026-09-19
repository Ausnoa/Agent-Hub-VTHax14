"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import ThemeToggle from "./theme-toggle";

// Each tab owns the pages under it: Compose covers its three-step flow (and the general
// workflow builder); My Agents covers each agent's interface and its runs.
const tabs = [
  { key: "discover", label: "Discover", href: "/discover", paths: ["/discover"] },
  { key: "compose", label: "Compose", href: "/create", paths: ["/create", "/discovery", "/workflow", "/general"] },
  { key: "agents", label: "My Agents", href: "/agents", paths: ["/agents"] },
  { key: "execution", label: "Execution", href: "/execution", paths: ["/execution"] },
] as const;

function owns(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function TopNav() {
  const pathname = usePathname();
  const activeTab = pathname === "/" ? "agents" : tabs.find((tab) => tab.paths.some((path) => owns(pathname, path)))?.key;

  return <header className="topnav">
    <Link href="/agents" className="topnav-brand">
      <Image src="/agent-emblem.svg" alt="" width={30} height={30} className="topnav-mark" priority />
      <span>AGENT HUB<small>COMPOSER ENGINE</small></span>
    </Link>
    <span className="topnav-verified"><span className="live-dot" /><ShieldCheck size={12} /> ANS Discovery · Identity unverified</span>
    <nav className="topnav-links" aria-label="Main navigation">
      {tabs.map((tab) => (
        <Link key={tab.key} href={tab.href} className={`topnav-link${activeTab === tab.key ? " active" : ""}`} aria-current={activeTab === tab.key ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
    <div className="topnav-right">
      <div className="topnav-stat">Local workspace<strong>MVP EDITION</strong></div>
      <ThemeToggle />
    </div>
  </header>;
}
