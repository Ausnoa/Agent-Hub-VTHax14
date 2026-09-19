"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Proposal } from "./contracts/index";

const storageKey = "agent-hub:composer-flow";

type ComposerFlowValue = {
  proposal?: Proposal;
  setProposal: (proposal: Proposal | undefined) => void;
  hydrated: boolean;
};

const ComposerFlowContext = createContext<ComposerFlowValue | undefined>(undefined);

export function ComposerFlowProvider({ children }: { children: React.ReactNode }) {
  const [proposal, setProposalState] = useState<Proposal | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) setProposalState(JSON.parse(stored));
    } catch { /* best-effort only */ }
    setHydrated(true);
  }, []);

  function setProposal(next: Proposal | undefined) {
    setProposalState(next);
    try {
      if (next) sessionStorage.setItem(storageKey, JSON.stringify(next));
      else sessionStorage.removeItem(storageKey);
    } catch { /* best-effort only */ }
  }

  return <ComposerFlowContext.Provider value={{ proposal, setProposal, hydrated }}>
    {children}
  </ComposerFlowContext.Provider>;
}

export function useComposerFlow(): ComposerFlowValue {
  const value = useContext(ComposerFlowContext);
  if (!value) throw new Error("useComposerFlow must be used within ComposerFlowProvider");
  return value;
}
