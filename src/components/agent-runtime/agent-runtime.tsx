"use client";

import { useEffect, useState } from "react";
import { variantFor } from "../../lib/agent-ui/variant";
import { useAgentRuntime } from "./agent-provider";
import { useRunFeed } from "./use-agent-runs";
import AgentAvatar from "./agent-avatar";
import AgentMiniWindow from "./agent-mini-window";
import AgentFullScreen from "./agent-fullscreen";
import Mascot from "./mascot";

const sampleNotes = "Northstar makes warehouse inventory software.\nRevenue grew 18% in this fictional example.\nThe business depends on one cloud supplier.\nTwo customers account for 45% of revenue.\nNew product delivery has been delayed.";

// Host for every generated agent's interface. Mounted once in the root layout, so the pack of
// robocats and their windows survive route changes.
export default function AgentRuntime() {
  const [local,setLocal]=useState(false);
  useEffect(()=>{setLocal(['localhost','127.0.0.1'].includes(location.hostname) && !new URLSearchParams(location.search).has('hosted'));},[]);
  // The report-pilot mascot uses SQLite APIs; do not mount its poller on Vercel.
  return local ? <LocalAgentRuntime/> : null;
}
function LocalAgentRuntime() {
  const { pack, active, view, hydrated, open, setView, remove } = useAgentRuntime();
  const { runsFor, statusFor, invoke, busy } = useRunFeed();
  const [company, setCompany] = useState("Northstar (fictional)");
  const [notes, setNotes] = useState(sampleNotes);

  if (!hydrated || !pack.length || view === "hidden") return null;

  const values = { company, notes };
  const onChange = (field: "company" | "notes", value: string) => (field === "company" ? setCompany(value) : setNotes(value));
  const propsFor = (agentId: string) => ({
    values, onChange, busy,
    latest: runsFor(agentId)[0],
    submitLabel: pack.find((spec) => spec.agentId === agentId)?.primaryAction ?? "Run agent",
    onSubmit: () => invoke(agentId, values),
  });

  // The newest agent plays its entrance in the centre before joining the pack.
  if (view === "spawning" && active) {
    const variant = variantFor(active.variantSeed, active.accentIndex);
    return <div className="agent-spawn" aria-live="polite">
      <div className="agent-spawn-card" style={{ "--mascot-accent": variant.accent } as React.CSSProperties}>
        <span className="agent-spawn-halo" />
        <Mascot width={96} variant={variant} />
        <span className="agent-spawn-kicker">Agent created</span>
        <strong>{active.name}</strong>
        <div className="agent-spawn-tags">{active.capabilities.slice(0, 3).map((capability) => <span key={capability}>{capability}</span>)}</div>
        <small>Heading to the corner — click it any time to open this agent.</small>
      </div>
    </div>;
  }

  return <>
    {view === "full" && active && <AgentFullScreen
      spec={active} runs={runsFor(active.agentId)} variant={variantFor(active.variantSeed, active.accentIndex)} status={statusFor(active.agentId)}
      onMinimize={() => setView("mini")} primitiveProps={propsFor(active.agentId)}
    />}

    {pack.map((spec, index) => {
      const isActive = spec.agentId === active?.agentId;
      return <AgentAvatar
        key={spec.agentId}
        agentId={spec.agentId}
        name={spec.name}
        variant={variantFor(spec.variantSeed, spec.accentIndex)}
        status={statusFor(spec.agentId)}
        slot={index}
        dimmed={view === "mini" && !isActive}
        onOpen={() => (isActive && view === "mini" ? setView("avatar") : open(spec.agentId, "mini"))}
        onRemove={() => remove(spec.agentId)}
      >
        {isActive && view === "mini" && <AgentMiniWindow
          spec={spec}
          runs={runsFor(spec.agentId)}
          onExpand={() => setView("full")}
          onClose={() => setView("avatar")}
          side={{ horizontal: "right", vertical: "above" }}
          primitiveProps={propsFor(spec.agentId)}
        />}
      </AgentAvatar>;
    })}
  </>;
}
