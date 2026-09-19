import { z } from "zod";
import { openDatabase } from "./db.ts";
import { createRegistryGateway, type RegistryGateway } from "./registry.ts";
import type { AgentCatalog, CatalogSource, CatalogEntry } from "./catalog.ts";
import type { Capability, SelectedAgent } from "../contracts/index.ts";

export class RegistryAgentCatalog implements AgentCatalog {
  private ownedDb;
  private registry: RegistryGateway;
  private now: () => number;
  constructor(registry?: RegistryGateway, now = () => Date.now()) {
    this.now = now;
    this.ownedDb = registry ? undefined : openDatabase();
    this.registry = registry ?? createRegistryGateway(this.ownedDb!);
  }
  async search(query: string, source?: CatalogSource): Promise<CatalogEntry[]> {
    if (source === "local-fixture") return [];
    return this.registry.searchCandidates(query, 50).flatMap((agent) => agent.endpoints.map((endpoint) => ({
      id: `${agent.agentId}|${endpoint.url}`, name: agent.displayName, description: agent.description,
      source: "ans" as const, capabilities: endpoint.functions.map((skill) => skill.name ?? skill.id),
      endpoint: endpoint.url, indexedAt: agent.lastSeenAt,
      stale: this.now() - Date.parse(agent.lastSeenAt) > 86_400_000,
      identityStatus: "not-verified" as const, compatibility: "needs-adapter" as const,
    })));
  }
  async candidates(capability: Capability, source: CatalogSource): Promise<SelectedAgent[]> {
    if (source !== "ans") return [];
    const allowlist = z.record(z.string(), z.array(z.string())).parse(JSON.parse(process.env.COMPATIBLE_AGENTS_JSON ?? "{}"));
    const approved = allowlist[capability] ?? [];
    if (!approved.length) return [];
    return this.registry.reportCandidates(capability, new Date(this.now())).filter((agent) => approved.includes(agent.ansId));
  }
  close() { this.ownedDb?.close(); }
}
