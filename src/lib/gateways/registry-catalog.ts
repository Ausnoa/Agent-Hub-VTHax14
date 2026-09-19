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
    return this.registry.searchCandidates(capability.replaceAll("-", " "), 50).flatMap((agent) => {
      const age = this.now() - Date.parse(agent.lastSeenAt);
      if (!approved.includes(agent.agentId) || !Number.isFinite(age) || age < 0 || age > 86_400_000) return [];
      return agent.endpoints.filter((endpoint) => endpoint.metadataUrl &&
        endpoint.transports.some((transport) => ["JSON-RPC", "JSONRPC"].includes(transport)) &&
        endpoint.functions.some((skill) => skill.id === capability)).map((endpoint) => ({
          ansId: agent.agentId, name: agent.displayName, endpoint: endpoint.url,
          metadataUrl: endpoint.metadataUrl!, capability, source: "ans" as const,
          identityStatus: "not-verified" as const, protocolVersion: "0.3.0",
        }));
    });
  }
  close() { this.ownedDb?.close(); }
}
