import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import "./stitch-ui.css";
import WorkspaceFooter from "../components/layout/workspace-footer";
import TopNav from "../components/layout/top-nav";
import { themeScript } from "../lib/theme";
import InlineScript from "../components/layout/inline-script";
import { ComposerFlowProvider } from "../lib/composer-flow";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", weight: ["400", "500", "600", "700"] });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", weight: ["400", "500", "600", "700"] });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", weight: ["400", "600"], style: ["normal", "italic"] });

export const metadata: Metadata = { title: "Agent Hub — Orchestrate autonomous agents", description: "Discover A2A agents through ANS and compose reusable workflows." };
export default function Layout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning: the theme script may set data-theme on <html> before React hydrates.
  return <html lang="en" className={`${jakarta.variable} ${jetbrainsMono.variable} ${playfair.variable}`} suppressHydrationWarning><head>
    <InlineScript html={themeScript} />
  </head><body>
    <ComposerFlowProvider>
      <div className="app-shell">
        <TopNav />
        {children}
        <WorkspaceFooter />
      </div>
    </ComposerFlowProvider>
  </body></html>;
}
