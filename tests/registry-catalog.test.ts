import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/lib/gateways/db.ts";
import { createRegistryGateway } from "../src/lib/gateways/registry.ts";
import { RegistryAgentCatalog } from "../src/lib/gateways/registry-catalog.ts";
import { parseRegistryRecord } from "../src/lib/ans/client.ts";
import { compose } from "../src/lib/workflows/composer.ts";

test("main registry selection requires approved, fresh, compatible records and never substitutes fixtures", async () => {
  const db = openDatabase(":memory:");
  const now = Date.now();
  const registry = createRegistryGateway(db, () => new Date(now));
  const catalog = new RegistryAgentCatalog(registry, () => now);
  const previous = process.env.COMPATIBLE_AGENTS_JSON;
  try {
    const sync = registry.startSync("manual");
    registry.recordPage(sync, [parseRegistryRecord({
      agentId: "synthetic", ansName: "ans://v1.test.example", agentDisplayName: "Company research",
      lifecycle: { status: "ACTIVE" }, endpoints: [{ protocol: "A2A", agentUrl: "https://test.example/a2a",
        metaDataUrl: "https://test.example/card", transports: ["JSON-RPC"],
        functions: [{ id: "company-research", name: "Company research" }] }],
    })], 0);
    registry.completeSync(sync);
    process.env.COMPATIBLE_AGENTS_JSON = "{}";
    assert.deepEqual(await catalog.candidates("company-research", "ans"), []);
    process.env.COMPATIBLE_AGENTS_JSON = JSON.stringify({ "company-research": ["synthetic"] });
    assert.equal((await catalog.candidates("company-research", "ans")).length, 1);
    assert.deepEqual(await catalog.candidates("company-research", "local-fixture"), []);
    const stale = new RegistryAgentCatalog(registry, () => now + 86_400_001);
    assert.deepEqual(await stale.candidates("company-research", "ans"), []);
    const proposal = await compose("Research company notes", "live", { catalog,
      planner: async () => ({ name: "Research", description: "Research notes", capabilities: ["company-research"], unsupported: [] }),
      inspect: async (agent) => ({ name: "Test", url: agent.endpoint, protocolVersion: "0.3.0", skills: [{ id: "company-research", name: "Research" }] }),
    });
    assert.equal(proposal.steps[0].ansId, "synthetic");
    assert.deepEqual(proposal.blockers, []);
    const blocked = await compose("Research company notes", "live", { catalog,
      planner: async () => proposal.plan, inspect: async () => { throw new Error("Unreachable"); },
    });
    assert.equal(blocked.steps.length, 0);
    assert.equal(blocked.blockers.length, 1);
  } finally {
    if (previous === undefined) delete process.env.COMPATIBLE_AGENTS_JSON;
    else process.env.COMPATIBLE_AGENTS_JSON = previous;
    db.close();
  }
});
