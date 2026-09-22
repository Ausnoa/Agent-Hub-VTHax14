"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AgentUISpec } from "../../lib/agent-ui/spec";
import { paletteCount } from "../../lib/agent-ui/variant";

// avatar → mini → full are the view states of the *active* agent; "spawning" is the brief
// entrance animation played right after an agent is generated, before it joins the pack.
export type AgentView = "hidden" | "spawning" | "avatar" | "mini" | "full";

type AgentRuntimeValue = {
  pack: AgentUISpec[];            // newest first, capped at PACK_LIMIT
  active?: AgentUISpec;
  view: AgentView;
  hydrated: boolean;
  spawn: (spec: AgentUISpec, animate?: boolean) => void;
  open: (agentId: string, view?: AgentView) => void;
  setView: (view: AgentView) => void;
  remove: (agentId: string) => void;
};

const storageKey = "agent-glorria:runtime-pack";
const legacyStorageKey = "agent-hub:runtime-pack";   // TODO: drop once no sessions still hold this
const PACK_LIMIT = 4;             // how many robocats may share the screen
const SPAWN_MS = 2400;   // pop in, hold so the user sees the new agent, then fly to the corner
const AgentRuntimeContext = createContext<AgentRuntimeValue | undefined>(undefined);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [pack, setPack] = useState<AgentUISpec[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [view, setView] = useState<AgentView>("hidden");
  const [hydrated, setHydrated] = useState(false);
  const known = useRef(new Set<string>());

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey) ?? sessionStorage.getItem(legacyStorageKey);
      if (stored) {
        const saved = JSON.parse(stored) as { pack: AgentUISpec[]; activeId?: string; view: AgentView };
        // Packs stored before colours were assigned get one now, so restored cats still differ.
        setPack((saved.pack ?? []).map((spec, index) => ({ ...spec, accentIndex: spec.accentIndex ?? index % paletteCount })));
        setActiveId(saved.activeId);
        for (const spec of saved.pack ?? []) known.current.add(spec.agentId);
        // Never restore into "spawning": the entrance only plays on a fresh generation.
        setView(saved.pack?.length ? (saved.view === "spawning" || saved.view === "hidden" ? "avatar" : saved.view) : "hidden");
      }
    } catch { /* best-effort only */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (pack.length) sessionStorage.setItem(storageKey, JSON.stringify({ pack, activeId, view }));
      else sessionStorage.removeItem(storageKey);
    } catch { /* best-effort only */ }
  }, [pack, activeId, view, hydrated]);

  const spawn = useCallback((next: AgentUISpec, animate = false) => {
    const isNew = !known.current.has(next.agentId);
    known.current.add(next.agentId);
    // Newest first, no duplicates, oldest cats leave the pack once it is full.
    setPack((current) => {
      const others = current.filter((spec) => spec.agentId !== next.agentId);
      // Keep a colour the agent already had, else take the first one no other cat is using.
      const kept = current.find((spec) => spec.agentId === next.agentId)?.accentIndex;
      const used = new Set(others.map((spec) => spec.accentIndex));
      const free = Array.from({ length: paletteCount }, (_, index) => index).find((index) => !used.has(index));
      const accentIndex = kept ?? free ?? others.length % paletteCount;
      return [{ ...next, accentIndex }, ...others].slice(0, PACK_LIMIT);
    });
    setActiveId(next.agentId);
    setView((current) => {
      if (animate && isNew) return "spawning";
      if (current === "spawning") return "spawning";   // let an entrance already playing finish
      return current === "hidden" ? "avatar" : current;
    });
  }, []);

  const open = useCallback((agentId: string, next: AgentView = "mini") => {
    setActiveId(agentId);
    setView(next);
  }, []);

  const remove = useCallback((agentId: string) => {
    known.current.delete(agentId);
    setPack((current) => {
      const rest = current.filter((spec) => spec.agentId !== agentId);
      setActiveId((id) => (id === agentId ? rest[0]?.agentId : id));
      setView(rest.length ? "avatar" : "hidden");
      return rest;
    });
  }, []);

  useEffect(() => {
    if (view !== "spawning") return;
    const timer = setTimeout(() => setView("avatar"), SPAWN_MS);
    return () => clearTimeout(timer);
  }, [view]);

  const active = pack.find((spec) => spec.agentId === activeId);
  const value = useMemo(() => ({ pack, active, view, hydrated, spawn, open, setView, remove }), [pack, active, view, hydrated, spawn, open, remove]);
  return <AgentRuntimeContext.Provider value={value}>{children}</AgentRuntimeContext.Provider>;
}

export function useAgentRuntime(): AgentRuntimeValue {
  const value = useContext(AgentRuntimeContext);
  if (!value) throw new Error("useAgentRuntime must be used within AgentProvider");
  return value;
}
