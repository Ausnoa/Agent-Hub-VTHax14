import type { DatabaseSync } from "node:sqlite";
import type { RegistryRecord } from "../ans/client.ts";
import { transaction } from "./db.ts";
import type { Capability, SelectedAgent } from "../contracts/index.ts";

// Registry gateway: the only code that reads or writes the local ANS index.
// Design: docs/DECISION-001-ANS-REGISTRY-INDEX.md and docs/DECISION-003-DATABASE-SCHEMA.md.

export type SyncTrigger = "startup" | "interval" | "manual";

export interface SyncSummary {
  id: number;
  status: "running" | "completed" | "failed";
  trigger: SyncTrigger;
  startedAt: string;
  finishedAt: string | null;
  pages: number;
  agentsSeen: number;
  recordsSkipped: number;
  error: string | null;
}

export interface RegistryStatus {
  lastCompleted: SyncSummary | null;
  latest: SyncSummary | null;
  listedAgents: number;
  eligibleAgents: number;
}

export interface RegistryCandidate {
  agentId: string;
  ansName: string;
  displayName: string;
  description: string | null;
  host: string;
  version: string | null;
  trustScore: number | null;
  expiresAt: string | null;
  lastSeenAt: string;
  endpoints: {
    url: string;
    metadataUrl: string | null;
    documentationUrl: string | null;
    transports: string[];
    functions: { id: string; name: string | null; tags: string[] }[];
  }[];
}

const RAW_JSON_LIMIT = 256 * 1024;

function summary(row: Record<string, unknown> | undefined): SyncSummary | null {
  if (!row) return null;
  return {
    id: Number(row.id), status: row.status as SyncSummary["status"], trigger: row.trigger as SyncTrigger,
    startedAt: String(row.started_at), finishedAt: row.finished_at as string | null,
    pages: Number(row.pages), agentsSeen: Number(row.agents_seen), recordsSkipped: Number(row.records_skipped),
    error: row.error as string | null,
  };
}

/** Converts free text into an FTS5 query of quoted terms, so user input cannot use FTS syntax. */
export function searchTerms(query: string): string | null {
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].slice(0, 16);
  return terms.length ? terms.map((term) => `"${term}"`).join(" OR ") : null;
}

export function createRegistryGateway(db: DatabaseSync, now: () => Date = () => new Date()) {
  const statements = {
    startSync: db.prepare("INSERT INTO sync_runs(trigger, status, started_at) VALUES (?, 'running', ?)"),
    countPage: db.prepare("UPDATE sync_runs SET pages = pages + 1, agents_seen = agents_seen + ?, records_skipped = records_skipped + ? WHERE id = ? AND status = 'running'"),
    upsertAgent: db.prepare(`
      INSERT INTO registry_agents(agent_id, ans_name, host, version, provider_id, display_name, description, ans_status,
        expires_at, trust_score, log_id, leaf_index, ans_indexed_at, first_seen_at, last_seen_at, last_seen_sync_id, listed, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(agent_id) DO UPDATE SET
        ans_name = excluded.ans_name, host = excluded.host, version = excluded.version, provider_id = excluded.provider_id,
        display_name = excluded.display_name, description = excluded.description, ans_status = excluded.ans_status,
        expires_at = excluded.expires_at, trust_score = excluded.trust_score, log_id = excluded.log_id,
        leaf_index = excluded.leaf_index, ans_indexed_at = excluded.ans_indexed_at, last_seen_at = excluded.last_seen_at,
        last_seen_sync_id = excluded.last_seen_sync_id, listed = 1, raw_json = excluded.raw_json
      RETURNING rowid`),
    deleteEndpoints: db.prepare("DELETE FROM registry_endpoints WHERE agent_id = ?"),
    insertEndpoint: db.prepare("INSERT INTO registry_endpoints(agent_id, position, protocol, url, metadata_url, documentation_url, transports) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id"),
    insertFunction: db.prepare("INSERT INTO registry_functions(endpoint_id, function_id, name, tags) VALUES (?, ?, ?, ?)"),
    deleteSearch: db.prepare("DELETE FROM registry_search WHERE rowid = ?"),
    insertSearch: db.prepare("INSERT INTO registry_search(rowid, display_name, description, functions, tags) VALUES (?, ?, ?, ?, ?)"),
    delist: db.prepare("UPDATE registry_agents SET listed = 0 WHERE listed = 1 AND last_seen_sync_id != ?"),
    finishSync: db.prepare("UPDATE sync_runs SET status = ?, finished_at = ?, error = ? WHERE id = ? AND status = 'running'"),
    failInterrupted: db.prepare("UPDATE sync_runs SET status = 'failed', finished_at = ?, error = 'Interrupted before completion' WHERE status = 'running'"),
    sync: db.prepare("SELECT * FROM sync_runs WHERE id = ?"),
    lastCompleted: db.prepare("SELECT * FROM sync_runs WHERE status = 'completed' ORDER BY id DESC LIMIT 1"),
    latest: db.prepare("SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1"),
    counts: db.prepare(`
      SELECT count(*) FILTER (WHERE listed = 1) AS listed,
        count(*) FILTER (WHERE listed = 1 AND ans_status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > ?)) AS eligible
      FROM registry_agents`),
    search: db.prepare(`
      WITH eligible AS (
        SELECT a.rowid AS rid, a.*,
          row_number() OVER (PARTITION BY a.host ORDER BY a.ans_indexed_at DESC, a.last_seen_at DESC) AS host_rank
        FROM registry_agents a
        WHERE a.listed = 1 AND a.ans_status = 'ACTIVE' AND (a.expires_at IS NULL OR a.expires_at > ?)
          AND EXISTS (SELECT 1 FROM registry_endpoints e WHERE e.agent_id = a.agent_id AND e.protocol = 'A2A')
      )
      SELECT e.*, bm25(registry_search) AS rank
      FROM registry_search JOIN eligible e ON e.rid = registry_search.rowid
      WHERE registry_search MATCH ? AND e.host_rank = 1
      ORDER BY rank, e.trust_score DESC
      LIMIT ?`),
    endpoints: db.prepare("SELECT * FROM registry_endpoints WHERE agent_id = ? AND protocol = 'A2A' ORDER BY position"),
    functions: db.prepare("SELECT * FROM registry_functions WHERE endpoint_id = ? ORDER BY function_id"),
  };
  const timestamp = () => now().toISOString();

  function upsert(syncId: number, agent: RegistryRecord, seenAt: string) {
    const raw = JSON.stringify(agent.raw);
    const { rowid } = statements.upsertAgent.get(
      agent.agentId, agent.ansName, agent.host, agent.version, agent.providerId, agent.displayName, agent.description,
      agent.status, agent.expiresAt, agent.trustScore, agent.logId, agent.leafIndex, agent.indexedAt, seenAt, seenAt, syncId,
      raw.length <= RAW_JSON_LIMIT ? raw : null,
    ) as { rowid: number };
    statements.deleteEndpoints.run(agent.agentId);
    agent.endpoints.forEach((endpoint, position) => {
      const { id } = statements.insertEndpoint.get(agent.agentId, position, endpoint.protocol, endpoint.url, endpoint.metadataUrl, endpoint.documentationUrl, JSON.stringify(endpoint.transports)) as { id: number };
      for (const fn of endpoint.functions) statements.insertFunction.run(id, fn.id, fn.name, JSON.stringify(fn.tags));
    });
    const a2aFunctions = agent.endpoints.filter((endpoint) => endpoint.protocol === "A2A").flatMap((endpoint) => endpoint.functions);
    statements.deleteSearch.run(rowid);
    statements.insertSearch.run(rowid, agent.displayName, agent.description ?? "",
      a2aFunctions.map((fn) => `${fn.id.replaceAll(/[-_]/g, " ")} ${fn.name ?? ""}`).join("\n"),
      a2aFunctions.flatMap((fn) => fn.tags).join(" "));
  }

  return {
    reportCandidates(capability: Capability, current = now()): SelectedAgent[] {
      const rows = db.prepare(`
        SELECT DISTINCT a.agent_id, a.display_name, e.url, e.metadata_url
        FROM registry_agents a JOIN registry_endpoints e ON e.agent_id = a.agent_id
        JOIN registry_functions f ON f.endpoint_id = e.id
        WHERE a.listed = 1 AND a.ans_status = 'ACTIVE'
          AND (a.expires_at IS NULL OR a.expires_at > ?)
          AND a.last_seen_at >= ? AND a.last_seen_at <= ?
          AND e.protocol = 'A2A' AND e.metadata_url IS NOT NULL
          AND f.function_id = ?
          AND EXISTS (SELECT 1 FROM json_each(e.transports) WHERE value IN ('JSON-RPC', 'JSONRPC'))
        ORDER BY a.agent_id, e.url
      `).all(current.toISOString(), new Date(current.getTime() - 86_400_000).toISOString(), current.toISOString(), capability);
      return rows.map((row) => ({ ansId: String(row.agent_id), name: String(row.display_name),
        endpoint: String(row.url), metadataUrl: String(row.metadata_url), capability,
        source: "ans", identityStatus: "not-verified", protocolVersion: "0.3.0" }));
    },
    /** Starts a sync run; throws if another sync is already running. */
    startSync(trigger: SyncTrigger): number {
      try {
        return Number(statements.startSync.run(trigger, timestamp()).lastInsertRowid);
      } catch (error) {
        if (error instanceof Error && /UNIQUE/.test(error.message)) throw new Error("A registry sync is already running");
        throw error;
      }
    },

    /** Writes one page of records in a single transaction. Skipped records are only counted. */
    recordPage(syncId: number, agents: RegistryRecord[], skipped: number) {
      const seenAt = timestamp();
      transaction(db, () => {
        if (!Number(statements.countPage.run(agents.length, skipped, syncId).changes)) throw new Error("Sync run is not running");
        for (const agent of agents) upsert(syncId, agent, seenAt);
      });
    },

    /** Marks agents missing from this completed sync as delisted and closes the run. */
    completeSync(syncId: number): { delisted: number } {
      return transaction(db, () => {
        const delisted = Number(statements.delist.run(syncId).changes);
        if (!Number(statements.finishSync.run("completed", timestamp(), null, syncId).changes)) throw new Error("Sync run is not running");
        return { delisted };
      });
    },

    /** Records a failed sync. Rows it already wrote stay; nothing is delisted. */
    failSync(syncId: number, error: string) {
      statements.finishSync.run("failed", timestamp(), error.slice(0, 500), syncId);
    },

    /** Called once at worker startup: a sync left running belongs to a process that no longer exists. */
    failInterruptedSyncs(): number {
      return Number(statements.failInterrupted.run(timestamp()).changes);
    },

    sync(id: number): SyncSummary | null {
      return summary(statements.sync.get(id) as Record<string, unknown> | undefined);
    },

    status(): RegistryStatus {
      const counts = statements.counts.get(timestamp()) as { listed: number; eligible: number };
      return {
        lastCompleted: summary(statements.lastCompleted.get() as Record<string, unknown> | undefined),
        latest: summary(statements.latest.get() as Record<string, unknown> | undefined),
        listedAgents: Number(counts.listed),
        eligibleAgents: Number(counts.eligible),
      };
    },

    /** Eligible agents matching the query, at most one registration per host, best match first. */
    searchCandidates(query: string, limit = 20): RegistryCandidate[] {
      const match = searchTerms(query);
      if (!match) return [];
      const rows = statements.search.all(timestamp(), match, Math.min(Math.max(limit, 1), 50)) as Record<string, unknown>[];
      return rows.map((row) => ({
        agentId: String(row.agent_id), ansName: String(row.ans_name), displayName: String(row.display_name),
        description: row.description as string | null, host: String(row.host), version: row.version as string | null,
        trustScore: row.trust_score as number | null, expiresAt: row.expires_at as string | null, lastSeenAt: String(row.last_seen_at),
        endpoints: (statements.endpoints.all(row.agent_id as string) as Record<string, unknown>[]).map((endpoint) => ({
          url: String(endpoint.url), metadataUrl: endpoint.metadata_url as string | null,
          documentationUrl: endpoint.documentation_url as string | null, transports: JSON.parse(String(endpoint.transports)),
          functions: (statements.functions.all(endpoint.id as number) as Record<string, unknown>[]).map((fn) => ({
            id: String(fn.function_id), name: fn.name as string | null, tags: JSON.parse(String(fn.tags)),
          })),
        })),
      }));
    },
  };
}

export type RegistryGateway = ReturnType<typeof createRegistryGateway>;
