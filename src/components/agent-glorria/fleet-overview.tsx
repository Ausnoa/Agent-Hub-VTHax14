"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Network, Plus, Sparkles } from "lucide-react";
import TopologyGraph from "./topology-graph";
import styles from "./fleet-overview.module.css";

/** A navigation overview, not an invented live execution or registry attestation. */
export default function FleetOverview({ hosted = false }: { hosted?: boolean }) {
  const [directive, setDirective] = useState("");
  const router = useRouter();
  const [error, setError] = useState("");
  return <section className={styles.overview} aria-labelledby="fleet-overview-title">
    <div className={styles.hero}>
      <p className="eyebrow"><span className="line" /> YOUR {hosted ? "HOSTED" : "LOCAL"} WORKSPACE · AUTONOMOUS PIPELINE DISCOVERY</p>
      <h1 id="fleet-overview-title">Your purpose. <em>Your agent.</em></h1>
      <div className={styles.heroBottom}>
        <p>Bring the right capabilities together. Discover agents, compose a workflow, and turn your next idea into something useful.</p>
        <Link className="btn btn-primary" href="/agent-preview"><Plus size={16} /> Create agent</Link>
      </div>
    </div>
    <div className={styles.workspace}>
      <div className={styles.graph}>
        <div className={styles.graphHead}><h2><Network size={14} /> WORKFLOW CONSTELLATION</h2><Link href="/discover">Find agents <ArrowUpRight size={14} /></Link></div>
        <TopologyGraph coreLabel="Your workflow" coreSublabel="Coordinator nexus" celestial nodes={[
          { id: "directive", label: "01. Your directive", sublabel: "Start with an outcome", angle: 200, radius: .95 },
          { id: "discovery", label: "02. Discover capabilities", sublabel: "Find agents with ANS", angle: 325, radius: .95, tone: "violet" },
          { id: "results", label: "03. Review results", sublabel: "Inspect every execution", angle: 65, radius: .95, tone: "green" },
        ]} />
        <p className={styles.caption}>Illustrative topology · your saved workflows retain their actual connections and execution status.</p>
      </div>
      <aside className={styles.guide}>
        <span className={styles.kicker}><Sparkles size={14} /> FROM IDEA TO WORKFLOW</span>
        <h2>A small team.<br />A bigger possibility.</h2>
        <p>Describe what you need, choose the agents, and review how their work connects.</p>
        <form className={styles.directive} onSubmit={event => {
          event.preventDefault();
          if (directive.trim().length < 10) return;
          try {
            sessionStorage.setItem("stitch-workflow-directive", directive.trim());
            router.push("/create");
          } catch { setError("Your browser could not keep this draft. Open the composer and paste your outcome there."); }
        }}>
          <label htmlFor="fleet-directive">Desired outcome</label>
          <textarea id="fleet-directive" value={directive} onChange={event => setDirective(event.target.value)} maxLength={2000} placeholder="e.g. Summarize meeting notes, extract action items, and prepare a weekly briefing." />
          <button type="button" className={styles.suggestion} onClick={() => setDirective("Summarize meeting notes, extract action items, and prepare a weekly briefing.")}><Sparkles size={14}/><span>Try a starting point<strong>Meeting brief + action items</strong></span></button>
          <button className="btn btn-primary btn-block" disabled={directive.trim().length < 10} type="submit">Compose a workflow <ArrowUpRight size={16}/></button>
          {error && <p role="alert">{error} <Link href="/create">Open composer</Link></p>}
        </form>
        <p className={styles.note}>You review the steps before execution.</p>
      </aside>
    </div>
  </section>;
}
