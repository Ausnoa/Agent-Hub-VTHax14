"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ClipboardCheck, PlayCircle, ArrowRight } from "lucide-react";
import type { Proposal } from "../../lib/contracts/index";
import { api } from "../../lib/api-client";
import { useComposerFlow } from "../../lib/composer-flow";
import PageShell from "../../components/layout/page-shell";
import Card, { CardHead } from "../../components/ui/card";
import Button from "../../components/ui/button";
import StatusPill from "../../components/ui/status-pill";
import SegmentedControl from "../../components/ui/segmented-control";
import TopologyGraph from "../../components/agent-hub/topology-graph";

const example = "Research a company, identify important risks, and write an executive summary.";
const supportedCapabilities = ["company-research", "risk-analysis", "summarization"];
const modeCopy = {
  pilot: "Real LLM planning → small indexed catalog → local A2A test agents. Execution uses supplied notes, not live research.",
  demo: "Offline demo uses a fixed three-step template and deterministic test agents. No LLM request is made.",
  live: "Real LLM planning and indexed ANS records. Execution requires fresh records and explicitly tested adapters.",
};

export default function CreateAgentPage() {
  const router = useRouter();
  const { setProposal } = useComposerFlow();
  const [description, setDescription] = useState(example);
  const [mode, setMode] = useState<"live" | "demo" | "pilot">("pilot");
  const [plannerConfigured, setPlannerConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ plannerConfigured: boolean }>("status").then((status) => setPlannerConfigured(status.plannerConfigured)).catch(() => {});
  }, []);

  async function decompose() {
    setBusy(true); setError("");
    try {
      const proposal = await api<Proposal>("proposals", { description, mode });
      setProposal(proposal);
      router.push("/discovery");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return <PageShell>
    <div className="compose-hero">
      <div className="eyebrow"><span className="line" /> FROM IDEA TO ORCHESTRATION</div>
      <h1>Orchestrate Autonomous Intelligence</h1>
      <p>Describe the outcome. Find the right capabilities. Compose an agent that gets the whole job done.</p>
      <Link href="/general">Build a general workflow with arbitrary skills →</Link>
    </div>

    {error && <div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div>}

    <Card className="compose-card">
      <CardHead index="01" badge={<StatusPill tone="accent">New composition</StatusPill>}>What should your agent do?</CardHead>
      <label className="sr-only" htmlFor="description">Operational directive</label>
      <span className="field-label">Operational directive</span>
      <textarea id="description" className="prompt-area" value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} />
      <div className="prompt-footer"><span>Be specific about the outcome you want.</span><span>{description.length} / 2,000</span></div>

      <div className="compose-token-row">
        <span className="hint" style={{ alignSelf: "center", marginRight: 4 }}>Supported capabilities:</span>
        {supportedCapabilities.map((capability) => <span className="token-chip" key={capability}>{capability}</span>)}
      </div>

      <div className="compose-actions">
        <SegmentedControl
          label="Composition mode"
          value={mode}
          onChange={setMode}
          options={[{ value: "pilot", label: "Pilot catalog" }, { value: "demo", label: "Offline demo" }, { value: "live", label: "ANS catalog" }]}
        />
        <Button variant="primary" disabled={busy || description.trim().length < 10} onClick={decompose}>
          {busy ? "Decomposing…" : <>Decompose & Discover ANS Agents <ArrowRight size={14} /></>}
        </Button>
      </div>
      <p className="hint" style={{ marginTop: 14 }}>
        {modeCopy[mode]} {mode !== "demo" && `Planner ${plannerConfigured ? "configured" : "not configured"}.`}
      </p>
      {mode !== "demo" && !plannerConfigured && <p className="hint" style={{ marginTop: 6 }}>
        No LLM key on this workspace — decomposing a directive needs one. You can still <Link href="/discovery" style={{ color: "var(--accent)" }}>browse the ANS registry directly</Link> (no key required), or switch to Offline demo above.
      </p>}
    </Card>

    <div className="metric-row" style={{ marginTop: 32 }}>
      <Card tight><CardHead badge={<Search size={14} color="var(--accent)" />}>Discover with ANS</CardHead><p className="hint">Find registered agents and inspect where they come from.</p></Card>
      <Card tight><CardHead badge={<ClipboardCheck size={14} color="var(--accent)" />}>Review the composition</CardHead><p className="hint">See each capability and approve the agents working together.</p></Card>
      <Card tight><CardHead badge={<PlayCircle size={14} color="var(--accent)" />}>Run it. Reuse it.</CardHead><p className="hint">Follow each A2A step, then use your saved agent again.</p></Card>
    </div>

    <Card style={{ marginTop: 18 }}>
      <CardHead>Composition topology preview</CardHead>
      <p className="hint" style={{ marginBottom: 6 }}>Illustrative only — your directive is decomposed into capabilities, then resolved against the ANS mesh in the next step.</p>
      <TopologyGraph
        coreLabel="Composer Core"
        coreSublabel="Goal Decomposer"
        nodes={[
          { id: "input", label: "Input Spec", sublabel: "your directive", angle: 200, radius: 1 },
          { id: "mesh", label: "ANS Mesh", sublabel: "capability resolution", angle: -20, radius: 1, tone: "accent" },
        ]}
      />
    </Card>
  </PageShell>;
}
