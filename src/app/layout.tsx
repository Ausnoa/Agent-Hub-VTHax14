import type { Metadata } from "next";
import "./globals.css";
import TopNav from "../components/layout/top-nav";
import { ComposerFlowProvider } from "../lib/composer-flow";

export const metadata: Metadata = { title: "Agent Hub — Orchestrate autonomous agents", description: "Discover A2A agents through ANS and compose reusable workflows." };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>
    <ComposerFlowProvider>
      <div className="app-shell">
        <TopNav />
        {children}
      </div>
    </ComposerFlowProvider>
  </body></html>;
}
