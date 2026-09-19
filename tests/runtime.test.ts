import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Store } from "../src/lib/persistence/store.ts";
import { executeRun } from "../src/lib/workflows/runtime.ts";
import { compose, validatePlan } from "../src/lib/workflows/composer.ts";
import { transformFixture } from "../agents/fixture-agent.ts";

test("failed step stops downstream work; retry preserves completed results", async () => {
  const store = new Store(":memory:");
  try {
    const proposal = await compose("Demo", "demo");
    store.saveDocument("agent", { ...proposal, version: 1 });
    const created = store.createRun(proposal.id, { company: "Example", notes: "Supplier concentration risk" });
    let calls = 0;
    await executeRun(store, store.claim()!, async (agent, state) => {
      calls++;
      if (agent.capability === "risk-analysis") throw new Error("Temporary outage");
      return transformFixture(agent.capability, state);
    });
    assert.equal(calls, 2);
    assert.equal(store.run(created.id)?.status, "failed");
    store.retry(created.id);
    assert.throws(() => store.retry(created.id), /Only failed/);
    await executeRun(store, store.claim()!, async (agent, state) => { calls++; return transformFixture(agent.capability, state); });
    const completed = store.run(created.id)!;
    assert.equal(calls, 4);
    assert.equal(completed.status, "completed");
    assert.equal(completed.attempts.length, 4);
    assert.equal(completed.output?.risks.length, 1);
    assert.equal(store.claim(), undefined);
  } finally { store.close(); }
});

test("worker lease excludes a second worker and recovery marks interrupted attempts", () => {
  const store = new Store(":memory:");
  try {
    assert.equal(store.acquireWorker("first"), true);
    assert.equal(store.acquireWorker("second"), false);
    const created = store.createRun(randomUUID(), { company: "Example", notes: "Notes" });
    store.claim(); store.recoverInterruptedRuns();
    assert.equal(store.run(created.id)?.status, "failed");
    store.releaseWorker("first");
    assert.equal(store.acquireWorker("second"), true);
  } finally { store.close(); }
});

test("rejects unsupported and incorrectly ordered plans", () => {
  assert.ok(validatePlan({ name: "Test", description: "", capabilities: ["summarization", "company-research"], unsupported: ["audio"] }).length >= 2);
});
