import test from "node:test";
import assert from "node:assert/strict";
import { rankBySkill } from "../src/lib/ans/ranking.ts";
import { normalizeAgents } from "../src/lib/ans/client.ts";

test("ranking tolerates absent skills and preserves registry trust metadata", () => {
  const [agent] = normalizeAgents({ items: [{ agentId: "test", agentDisplayName: "Research", ansName: "ans://test.example",
    lifecycle: { status: "ACTIVE" }, scores: { trustScore: 42 },
    endpoints: [{ protocol: "A2A", agentUrl: "https://test.example/a2a", functions: [{ id: "company-research", name: "Company research" }] }],
  }] });
  assert.equal(agent.trustScore, 42);
  assert.equal(rankBySkill([agent], "company research").length, 1);
  assert.deepEqual(rankBySkill([{ ...agent, skills: undefined }], "company research"), []);
});
