// Remembers the last agent opened in this browser, so the Interface tab can return to it.
// Best-effort only: storage can be unavailable (private windows, blocked site data).
const lastAgentKey = "agent-hub:last-agent";

export function rememberAgent(id: string) {
  try { localStorage.setItem(lastAgentKey, id); } catch { /* best-effort only */ }
}

export function lastAgent(): string | undefined {
  try { return localStorage.getItem(lastAgentKey) ?? undefined; } catch { return undefined; }
}
