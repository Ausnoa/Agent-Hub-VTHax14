import type { CatalogEntry } from "../lib/gateways/catalog";

export default function CatalogPanel({ entries }: { entries: CatalogEntry[] }) {
  return <section aria-label="Small indexed catalog">
    <div className="notice">{entries.filter((entry) => entry.source === "local-fixture").length} local test agents · {entries.filter((entry) => entry.source === "ans").length} ANS records. Only the local agents are tested against the pilot report contract. No identities are verified.</div>
    {(["local-fixture", "ans"] as const).map((source) => <section key={source}>
      <h2>{source === "ans" ? "ANS snapshot — adapter work needed" : "Pilot workflow agents — local services"}</h2>
      <div className="directory-list">{entries.filter((entry) => entry.source === source).map((entry) => <article className="directory-card" key={entry.id}>
        <span className="feature-icon">{source === "ans" ? "◎" : "⌘"}</span>
        <div><h3>{entry.name}</h3><p>{entry.description ?? "No description provided by the agent owner."}</p>
          <p>{entry.capabilities.join(" · ") || "No registered skills supplied"}</p>
          <details><summary>Catalog details</summary><dl><dt>Endpoint</dt><dd>{entry.endpoint}</dd><dt>Indexed</dt><dd>{new Date(entry.indexedAt).toLocaleString()}{entry.stale ? " · Stale; refresh required" : ""}</dd><dt>Compatibility</dt><dd>{entry.compatibility === "tested-local" ? "Tested local report adapter; start services before composing" : "Not tested; not automatically executable"}</dd><dt>Identity</dt><dd>Not verified</dd></dl></details>
        </div><span className="badge">{source === "ans" ? "ANS" : "LOCAL TEST"}</span>
      </article>)}</div>
    </section>)}
    {!entries.some((entry) => entry.source === "ans") && <p className="hint">No ANS snapshot has been seeded yet. The pilot local workflow remains available.</p>}
  </section>;
}
