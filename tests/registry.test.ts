import test from "node:test";
import assert from "node:assert/strict";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase, schemaVersion, migrate } from "../src/lib/gateways/db.ts";
import { migrations } from "../src/lib/gateways/migrations.ts";
import { createRegistryGateway, searchTerms } from "../src/lib/gateways/registry.ts";
import { parseRegistryRecord, type RegistryPage } from "../src/lib/ans/client.ts";
import { syncRegistry } from "../src/lib/registry/sync.ts";

// Synthetic registry records shaped like live ANS responses. Never written to a real database.
function item(id: string, overrides: Record<string, unknown> = {}) {
  return {
    agentId: id,
    ansName: `ans://v1.0.0.${id}.example`,
    agentHost: `${id}.example`,
    agentDisplayName: `${id} agent`,
    agentDescription: `Synthetic ${id} agent`,
    agentVersion: "v1.0.0",
    indexedAt: "2026-09-18T07:52:32.212734855Z",
    expiresAt: "2027-01-01T00:00:00Z",
    leafIndex: 1,
    logId: "log",
    lifecycle: { status: "ACTIVE" },
    scores: { trustScore: 60, textScore: 0, relevance: 59.6 },
    endpoints: [{ protocol: "A2A", agentUrl: `https://${id}.example/a2a`, transports: ["JSON-RPC"], functions: [] }],
    ...overrides,
  };
}

const summarizer = item("summarizer", {
  agentDescription: "Research agent for technical documents",
  endpoints: [{ protocol: "A2A", agentUrl: "https://summarizer.example/a2a", transports: ["HTTP"],
    functions: [{ id: "summarize-content", name: "Summarize Technical Content", tags: ["summarization", "research"] }] }],
});

function page(items: unknown[], nextPageToken?: string, remaining = 50): RegistryPage {
  return { items, hasMore: Boolean(nextPageToken), nextPageToken, rateLimit: { remaining, resetSeconds: 30 } };
}

function withDb(work: (db: DatabaseSync) => Promise<void> | void) {
  return async () => {
    const db = openDatabase(":memory:");
    try { await work(db); } finally { db.close(); }
  };
}

const fixedNow = () => new Date("2026-09-19T12:00:00.000Z");

test("migrations apply once and record the schema version", withDb((db) => {
  assert.equal(schemaVersion(db), migrations.length);
  migrate(db);
  assert.equal(schemaVersion(db), migrations.length);
}));

test("parses live record shapes: nanosecond timestamps, missing transports, relative card URLs", () => {
  const parsed = parseRegistryRecord(item("stock", { endpoints: [
    { protocol: "A2A", agentUrl: "https://stock.example", metaDataUrl: "/.well-known/agent-card.json" },
    { protocol: "A2A", agentUrl: "https://stock.example" },
    { protocol: "MCP", agentUrl: "http://insecure.example/mcp" },
  ] }));
  assert.equal(parsed.indexedAt, "2026-09-18T07:52:32.212Z");
  assert.equal(parsed.endpoints.length, 1);
  assert.deepEqual(parsed.endpoints[0].transports, []);
  assert.equal(parsed.endpoints[0].metadataUrl, "https://stock.example/.well-known/agent-card.json");
  assert.throws(() => parseRegistryRecord({ agentId: "incomplete" }));
});

test("sync pages through ANS, skips invalid records, and respects the rate limit", withDb(async (db) => {
  const registry = createRegistryGateway(db, fixedNow);
  const tokens: (string | undefined)[] = [];
  const pauses: number[] = [];
  const pages = [page([item("alpha"), { agentId: "broken" }], "next", 0), page([summarizer])];
  const result = await syncRegistry(registry, {
    trigger: "manual",
    fetchPage: async (options) => { tokens.push(options.pageToken); assert.equal(options.pageSize, 100); return pages.shift()!; },
    pause: async (milliseconds) => { pauses.push(milliseconds); },
  });
  assert.deepEqual(tokens, [undefined, "next"]);
  assert.deepEqual(pauses, [31_000]);
  assert.equal(result.status, "completed");
  assert.equal(result.agentsSeen, 2);
  assert.equal(result.recordsSkipped, 1);
  assert.equal(registry.status().eligibleAgents, 2);
}));

test("a completed sync delists missing agents; a failed sync delists nothing", withDb(async (db) => {
  const registry = createRegistryGateway(db, fixedNow);
  await syncRegistry(registry, { trigger: "manual", fetchPage: async () => page([item("alpha"), item("beta")]) });
  await assert.rejects(syncRegistry(registry, { trigger: "manual", fetchPage: async () => { throw new Error("ANS discovery failed (HTTP 429)"); } }), /429/);
  assert.equal(registry.status().latest?.status, "failed");
  assert.equal(registry.status().listedAgents, 2);
  const second = await syncRegistry(registry, { trigger: "manual", fetchPage: async () => page([item("alpha")]) });
  assert.equal(second.delisted, 1);
  assert.equal(registry.status().listedAgents, 1);
}));

test("only one sync runs at a time, and interrupted syncs are failed on startup", withDb((db) => {
  const registry = createRegistryGateway(db, fixedNow);
  registry.startSync("startup");
  assert.throws(() => registry.startSync("interval"), /already running/);
  assert.equal(registry.failInterruptedSyncs(), 1);
  assert.doesNotThrow(() => registry.startSync("manual"));
}));

test("search matches skills by stem, excludes expired agents, and returns one registration per host", withDb(async (db) => {
  const registry = createRegistryGateway(db, fixedNow);
  await syncRegistry(registry, { trigger: "manual", fetchPage: async () => page([
    summarizer,
    item("expired", { agentDescription: "Summarizes risk", expiresAt: "2026-09-02T19:42:34Z" }),
    item("old", { agentHost: "shared.example", agentDescription: "Summarize reports", indexedAt: "2026-01-01T00:00:00Z" }),
    item("new", { agentHost: "shared.example", agentDescription: "Summarize reports", indexedAt: "2026-09-01T00:00:00Z" }),
  ]) });
  const found = registry.searchCandidates("summarize");
  assert.deepEqual(found.map((agent) => agent.agentId).sort(), ["new", "summarizer"]);
  const summary = found.find((agent) => agent.agentId === "summarizer")!;
  assert.equal(summary.description, "Research agent for technical documents");
  assert.deepEqual(summary.endpoints[0].functions[0].tags, ["summarization", "research"]);
  assert.deepEqual(registry.searchCandidates('" OR * NEAR('), []);
}));

test("search terms are quoted so user input cannot use FTS syntax", () => {
  assert.equal(searchTerms('risk" OR x*'), '"risk" OR "or" OR "x"');
  assert.equal(searchTerms("   "), null);
});
