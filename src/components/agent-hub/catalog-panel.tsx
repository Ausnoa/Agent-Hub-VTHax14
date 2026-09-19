import type { CatalogEntry } from "../../lib/gateways/catalog";
import StatusPill from "../ui/status-pill";

export default function CatalogPanel({ entries }: { entries: CatalogEntry[] }) {
  return <section aria-label="Small indexed catalog">
    <p className="notice">{entries.filter((entry) => entry.source === "local-fixture").length} local test agents · {entries.filter((entry) => entry.source === "ans").length} ANS records. Only the local agents are tested against the pilot report contract. No identities are verified.</p>
    {(["local-fixture", "ans"] as const).map((source) => <section key={source} style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>{source === "ans" ? "ANS snapshot — adapter work needed" : "Pilot workflow agents — local services"}</h3>
      <div className="registry-list">{entries.filter((entry) => entry.source === source).map((entry) => <article className="registry-item" key={entry.id}>
        <span className="registry-item-icon">{source === "ans" ? "◎" : "⌘"}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3>{entry.name}</h3>
          <p>{entry.description ?? "No description provided by the agent owner."}</p>
          <p className="mono" style={{ marginTop: 4 }}>{entry.capabilities.join(" · ") || "No registered skills supplied"}</p>
          <details><summary>Catalog details</summary><dl>
            <dt>Endpoint</dt><dd className="mono">{entry.endpoint}</dd>
            <dt>Indexed</dt><dd>{new Date(entry.indexedAt).toLocaleString()}{entry.stale ? " · Stale; refresh required" : ""}</dd>
            <dt>Compatibility</dt><dd>{entry.compatibility === "tested-local" ? "Tested local report adapter; start services before composing" : "Not tested; not automatically executable"}</dd>
            <dt>Identity</dt><dd>Not verified</dd>
          </dl></details>
        </div>
        <StatusPill tone={source === "ans" ? "violet" : "accent"}>{source === "ans" ? "ANS" : "Local test"}</StatusPill>
      </article>)}</div>
    </section>)}
    {!entries.some((entry) => entry.source === "ans") && <p className="hint">No ANS snapshot has been seeded yet. The pilot local workflow remains available.</p>}
  </section>;
}
