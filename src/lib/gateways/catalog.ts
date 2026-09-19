import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { selectedAgentSchema, type Capability, type SelectedAgent } from "../contracts/index.ts";
import type { DiscoveredAgent } from "../ans/client.ts";
import { developmentAgents } from "./development-agents.ts";

export type CatalogSource = "ans" | "local-fixture";
export interface CatalogEntry {
  id: string; name: string; description: string | null; source: CatalogSource;
  capabilities: string[]; endpoint: string; indexedAt: string; stale: boolean;
  identityStatus: "not-verified"; compatibility: "tested-local" | "needs-adapter";
}
export interface AgentCatalog {
  search(query: string, source?: CatalogSource): Promise<CatalogEntry[]>;
  candidates(capability: Capability, source: CatalogSource): Promise<SelectedAgent[]>;
}

const publicUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
});
const registryRecord = z.object({
  ansId: z.string().uuid(), name: z.string(), description: z.string().nullable(),
  ansName: z.string().startsWith("ans://"), endpoint: publicUrl, metadataUrl: publicUrl.optional(),
  transports: z.array(z.string()), discoveredAt: z.string().datetime(), identityStatus: z.literal("not-verified"),
  skills: z.array(z.object({ id: z.string(), name: z.string(), tags: z.array(z.string()) })).optional(),
});

export class SqliteAgentCatalog implements AgentCatalog {
  private db: DatabaseSync;
  constructor(path = process.env.PILOT_CATALOG_DB ?? ".data/pilot-catalog.sqlite") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    this.db.exec(readFileSync(join(process.cwd(), "src/lib/gateways/migrations/001-pilot-catalog.sql"), "utf8"));
    const insert = this.db.prepare("INSERT OR IGNORE INTO pilot_development_agents VALUES(?,?,?,?)");
    for (const agent of developmentAgents()) insert.run(agent.ansId, agent.capability, new Date().toISOString(), JSON.stringify(agent));
  }
  importRegistry(agents: DiscoveredAgent[]): number {
    const records = agents.map((agent) => registryRecord.parse(agent));
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const upsert = this.db.prepare("INSERT INTO pilot_registry_agents VALUES(?,?,?,?) ON CONFLICT(agent_key) DO UPDATE SET indexed_at=excluded.indexed_at, record_json=excluded.record_json");
      for (const agent of records) upsert.run(`${agent.ansId}|${agent.endpoint}`, agent.ansId, agent.discoveredAt, JSON.stringify(agent));
      this.db.exec("COMMIT");
      return records.length;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  async search(query: string, source?: CatalogSource): Promise<CatalogEntry[]> {
    const entries: CatalogEntry[] = [];
    if (source !== "ans") for (const row of this.db.prepare("SELECT * FROM pilot_development_agents ORDER BY rowid").all()) {
      const agent = selectedAgentSchema.parse(JSON.parse(row.record_json as string));
      entries.push({ id: agent.ansId, name: agent.name, description: "Deterministic local test service using supplied notes. Not registered with ANS.", source: "local-fixture", capabilities: [agent.capability], endpoint: agent.endpoint, indexedAt: row.indexed_at as string, stale: false, identityStatus: "not-verified", compatibility: "tested-local" });
    }
    if (source !== "local-fixture") for (const row of this.db.prepare("SELECT * FROM pilot_registry_agents ORDER BY rowid").all()) {
      const agent = registryRecord.parse(JSON.parse(row.record_json as string));
      entries.push({ id: `${agent.ansId}|${agent.endpoint}`, name: agent.name, description: agent.description, source: "ans", capabilities: agent.skills?.map((skill) => skill.name) ?? [], endpoint: agent.endpoint, indexedAt: row.indexed_at as string, stale: Date.now() - Date.parse(row.indexed_at as string) > 86_400_000, identityStatus: "not-verified", compatibility: "needs-adapter" });
    }
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return entries.filter((entry) => terms.every((term) => `${entry.name} ${entry.description ?? ""} ${entry.capabilities.join(" ")}`.toLowerCase().includes(term)));
  }
  async candidates(capability: Capability, source: CatalogSource): Promise<SelectedAgent[]> {
    if (source === "local-fixture") return this.db.prepare("SELECT record_json FROM pilot_development_agents WHERE capability=? ORDER BY agent_id").all(capability).map((row) => selectedAgentSchema.parse(JSON.parse(row.record_json as string)));
    const allowlist = z.record(z.string(), z.array(z.string())).parse(JSON.parse(process.env.COMPATIBLE_AGENTS_JSON ?? "{}"));
    const results: SelectedAgent[] = [];
    for (const row of this.db.prepare("SELECT * FROM pilot_registry_agents ORDER BY agent_key").all()) {
      if (Date.now() - Date.parse(row.indexed_at as string) > 86_400_000) continue;
      const agent = registryRecord.parse(JSON.parse(row.record_json as string));
      if (!agent.metadataUrl || !allowlist[capability]?.includes(agent.ansId)) continue;
      results.push({ ansId: agent.ansId, name: agent.name, endpoint: agent.endpoint, metadataUrl: agent.metadataUrl, capability, source: "ans", identityStatus: "not-verified", protocolVersion: "0.3.0" });
    }
    return results;
  }
  close() { this.db.close(); }
}
