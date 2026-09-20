"use client";

import { useCallback, useEffect, useState } from "react";
import type { Run } from "../../lib/contracts/index";
import { api } from "../../lib/api-client";

export type RunStatus = "idle" | "working" | "done" | "error";
const RECENT_MS = 5 * 60_000;   // how long a finished run keeps colouring an avatar

// One poller for every cat in the pack: /api/runs already returns runs for all agents.
export function useRunFeed() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try { setRuns(await api<Run[]>("runs")); } catch { /* keep the previous list */ }
  }, []);

  const active = runs.some((run) => run.status === "queued" || run.status === "running");
  useEffect(() => {
    if (document.hidden) return;
    reload();
    const timer = setInterval(() => { if (!document.hidden) reload(); }, active ? 1500 : 12_000);
    return () => clearInterval(timer);
  }, [active, reload]);

  const runsFor = useCallback((agentId: string) => runs.filter((run) => run.agentId === agentId), [runs]);

  const statusFor = useCallback((agentId: string): RunStatus => {
    const mine = runs.filter((run) => run.agentId === agentId);
    if (mine.some((run) => run.status === "queued" || run.status === "running")) return "working";
    const latest = mine[0];
    // Old outcomes fade back to idle so a stale failure never leaves a cat red forever.
    if (!latest || Date.now() - Date.parse(latest.updatedAt) > RECENT_MS) return "idle";
    return latest.status === "failed" ? "error" : latest.status === "completed" ? "done" : "idle";
  }, [runs]);

  const invoke = useCallback(async (agentId: string, input: { company: string; notes: string }) => {
    setBusy(true); setError("");
    try {
      await api<Run>(`agents/${agentId}/invoke`, input);
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start the run");
    } finally { setBusy(false); }
  }, [reload]);

  return { runs, runsFor, statusFor, invoke, busy, error, reload };
}
