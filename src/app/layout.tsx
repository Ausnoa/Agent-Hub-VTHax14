import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Agent Composer — Make agents work together", description: "Discover A2A agents through ANS and compose reusable workflows." };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
