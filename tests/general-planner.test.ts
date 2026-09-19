import test from "node:test";
import assert from "node:assert/strict";
import { planningCandidates } from "../src/lib/general/planner.ts";
import type { RegistryCandidate } from "../src/lib/gateways/registry.ts";

test("planner excludes unsupported transports and missing cards while retaining domain context", () => {
  const candidate: RegistryCandidate = { agentId: "test", ansName: "ans://test", displayName: "Domain analyzer", description: "Domain takedown impact, not stock prices", host: "test.example", version: null, trustScore: null, expiresAt: null, lastSeenAt: new Date().toISOString(), endpoints: [{ url: "https://test.example", metadataUrl: "https://test.example/card", documentationUrl: null, transports: ["STREAMABLE-HTTP"], functions: [{ id: "analyze", name: "Domain Impact", tags: ["DNS"] }] }] };
  assert.deepEqual(planningCandidates([candidate]), []);
  candidate.endpoints[0].transports = ["JSON-RPC"];
  assert.equal(planningCandidates([candidate])[0].description, candidate.description);
  assert.equal(planningCandidates([candidate])[0].skills[0].name, "Domain Impact");
  candidate.endpoints[0].metadataUrl = null;
  assert.deepEqual(planningCandidates([candidate]), []);
});
