import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SqliteAgentCatalog, type AgentCatalog } from "../src/lib/gateways/catalog.ts";
import { compose } from "../src/lib/workflows/composer.ts";
import type { DiscoveredAgent } from "../src/lib/ans/client.ts";

function registryAgent(): DiscoveredAgent {
  return { ansId: randomUUID(), name: "Example public agent", description: "Declared public research capability", ansName: "ans://v1.0.0.agent.example", endpoint: "https://agent.example/a2a", metadataUrl: "https://agent.example/card.json", transports: ["JSON-RPC"], discoveredAt: new Date().toISOString(), identityStatus: "not-verified", skills: [{ id: "research", name: "Research", tags: [] }] };
}

test("catalog separates local services and registry records; import is idempotent", async () => {
  const catalog = new SqliteAgentCatalog(":memory:");
  try {
    assert.equal((await catalog.search("", "local-fixture")).length, 3);
    assert.equal((await catalog.search("", "ans")).length, 0);
    const agent = registryAgent();
    catalog.importRegistry([agent]); catalog.importRegistry([agent]);
    assert.equal((await catalog.search("declared research", "ans")).length, 1);
    assert.equal((await catalog.search("", "ans"))[0].compatibility, "needs-adapter");
    assert.throws(() => catalog.importRegistry([{ ...agent, ansId: "fixture:research", endpoint: "http://127.0.0.1:4311/a2a" }]));
    assert.equal((await catalog.search("", "ans")).length, 1);
    assert.equal((await catalog.candidates("company-research", "local-fixture")).length, 1);
    assert.equal((await catalog.candidates("company-research", "ans")).length, 0);
  } finally { catalog.close(); }
});

test("pilot composes planner-selected capabilities through the catalog interface", async () => {
  const catalog = new SqliteAgentCatalog(":memory:");
  try {
    const proposal = await compose("Research and summarize notes", "pilot", {
      catalog,
      planner: async () => ({ name: "Short briefing", description: "Two selected steps", capabilities: ["company-research", "summarization"], unsupported: [] }),
      inspect: async (agent) => ({ name: "Test card", url: agent.endpoint, protocolVersion: "0.3.0", skills: ["company-research", "summarization"].map((capability) => ({ id: capability, name: capability })) }),
    });
    assert.equal(proposal.planner, "llm");
    assert.deepEqual(proposal.steps.map((step) => step.capability), ["company-research", "summarization"]);
    assert.deepEqual(proposal.blockers, []);
    assert.ok(proposal.steps.every((step) => step.source === "local-fixture"));
    const emptyCatalog: AgentCatalog = { search: async () => [], candidates: async () => [] };
    const blocked = await compose("Research notes", "pilot", { catalog: emptyCatalog, planner: async () => proposal.plan });
    assert.equal(blocked.steps.length, 0);
    assert.equal(blocked.blockers.length, 2);
  } finally { catalog.close(); }
});

test("stale registry entries are visible but cannot be selected even when allowlisted", async () => {
  const catalog = new SqliteAgentCatalog(":memory:");
  const before = process.env.COMPATIBLE_AGENTS_JSON;
  try {
    const agent = { ...registryAgent(), discoveredAt: "2020-01-01T00:00:00.000Z" };
    process.env.COMPATIBLE_AGENTS_JSON = JSON.stringify({ "company-research": [agent.ansId] });
    catalog.importRegistry([agent]);
    assert.equal((await catalog.search("", "ans"))[0].stale, true);
    assert.deepEqual(await catalog.candidates("company-research", "ans"), []);
  } finally {
    if (before === undefined) delete process.env.COMPATIBLE_AGENTS_JSON;
    else process.env.COMPATIBLE_AGENTS_JSON = before;
    catalog.close();
  }
});
