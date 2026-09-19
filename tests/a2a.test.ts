import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { startFixtureAgent } from "../agents/fixture-agent.ts";
import { invokeAgent } from "../src/lib/a2a/client.ts";
import { isPublicAddress } from "../src/lib/a2a/network.ts";
import { capabilities, type WorkflowState } from "../src/lib/contracts/index.ts";

test("network policy rejects private, loopback, link-local, and mapped addresses", () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "::1", "::ffff:127.0.0.1", "fc00::1"]) assert.equal(isPublicAddress(address), false);
  assert.equal(isPublicAddress("8.8.8.8"), true);
});

test("official SDK exchanges A2A messages across three local agents", async () => {
  const servers = capabilities.map((capability, index) => startFixtureAgent(capability, 4311 + index));
  try {
    await Promise.all(servers.map((server) => once(server, "listening")));
    const state: WorkflowState = { originalInput: { company: "Northstar (fictional)", notes: "Revenue grew.\nHigh dependence on one supplier." }, previousOutput: null, results: {} };
    for (const [index, capability] of capabilities.entries()) {
      const output = await invokeAgent({ ansId: `fixture:${capability}`, name: capability, endpoint: `http://127.0.0.1:${4311 + index}/a2a`, metadataUrl: `http://127.0.0.1:${4311 + index}/.well-known/agent-card.json`, capability, source: "local-fixture", identityStatus: "not-verified", protocolVersion: "0.3.0" }, state);
      state.results[capability] = output;
      state.previousOutput = output;
    }
    assert.equal(state.previousOutput?.risks.length, 1);
    assert.match(state.previousOutput!.summary, /one supplier/);
    assert.equal(state.previousOutput?.fixture, true);
    assert.deepEqual(state.previousOutput?.sources, state.results["company-research"].sources);
  } finally {
    await Promise.all(servers.map((server) => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); })));
  }
});
