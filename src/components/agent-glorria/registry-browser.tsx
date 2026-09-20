"use client";

import { useEffect, useState } from "react";
import { Radar, Search } from "lucide-react";
import type { DiscoveredAgent } from "../../lib/ans/client";
import type { CatalogEntry } from "../../lib/gateways/catalog";
import { api } from "../../lib/api-client";
import Card, { CardHead } from "../ui/card";
import Button from "../ui/button";
import StatusPill from "../ui/status-pill";
import CatalogPanel from "./catalog-panel";

// The pilot catalog plus a live ANS search. Shared by the Discover tab and step 2 of Compose.
export default function RegistryBrowser() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [query, setQuery] = useState("");
  const [discovered, setDiscovered] = useState<DiscoveredAgent[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<CatalogEntry[]>("catalog").then(setCatalog).catch(() => setError("Could not load the pilot catalog"));
  }, []);

  async function search() {
    setBusy(true); setError("");
    try {
      const result = await api<{ agents: DiscoveredAgent[] }>("discover", { query });
      setDiscovered(result.agents); setSearched(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return <Card className="registry-panel">
    <CardHead badge={<Radar size={16} />}>ANS capability resolution</CardHead>
    {error && <div role="alert" className="alert"><strong>Something needs attention</strong><p>{error}</p></div>}
    <CatalogPanel entries={catalog} />
    <h3 style={{ fontSize: 12, color: "var(--text-muted)", margin: "18px 0 10px" }}>Search the live ANS registry</h3>
    <p className="hint" style={{ marginBottom: 10 }}>Queries the registry directly — no LLM key required.</p>
    <form className="search-bar" onSubmit={(event) => { event.preventDefault(); search(); }}>
      <label className="sr-only" htmlFor="query">Search ANS</label>
      <input id="query" value={query} maxLength={256} onChange={(event) => setQuery(event.target.value)} placeholder="Search for a capability" />
      <Button variant="primary" disabled={busy}>{busy ? "Searching…" : <><Search size={14} /> Search</>}</Button>
    </form>
    <div className="registry-list" style={{ marginTop: 12 }}>
      {discovered.map((item, index) => <article className="registry-item" key={`${item.ansId}-${index}`}>
        <span className="registry-item-icon"><Radar size={15} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3>{item.name}</h3>
          <p>{item.ansName}</p>
          <details><summary>View discovery details</summary><dl>
            <dt>Endpoint</dt><dd className="mono">{item.endpoint}</dd>
            <dt>Transports</dt><dd>{item.transports.join(", ")}</dd>
            <dt>Identity check</dt><dd>Not verified</dd>
          </dl></details>
        </div>
        <StatusPill tone="violet">A2A</StatusPill>
      </article>)}
    </div>
    {searched && !discovered.length && <p className="empty">No matching active A2A agents. Try another capability.</p>}
  </Card>;
}
