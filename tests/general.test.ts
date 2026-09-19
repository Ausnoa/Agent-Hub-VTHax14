import test from "node:test";
import assert from "node:assert/strict";
import { GeneralStore } from "../src/lib/general/store.ts";
import { draftSchema, mapInput, type GeneralStep } from "../src/lib/general/contracts.ts";
import { prepareGeneral, executeGeneral } from "../src/lib/general/service.ts";

const step = { agentId: "synthetic", skill: "translate", inputFrom: "original" as const, format: "text" as const, instruction: "Translate to French" };
const resolve = async () => [{ ansId: "synthetic", name: "Translator", description: null, ansName: "ans://test.example", endpoint: "https://test.example/a2a", metadataUrl: "https://test.example/card", transports: ["JSON-RPC"], discoveredAt: new Date().toISOString(), identityStatus: "not-verified" as const }];

test("general schema allows eight arbitrary skills and rejects invalid input mappings", () => {
  assert.equal(draftSchema.parse({ name: "Translate", steps: Array(8).fill(step) }).steps.length, 8);
  assert.throws(() => draftSchema.parse({ name: "Too long", steps: Array(9).fill(step) }));
  assert.throws(() => draftSchema.parse({ name: "Bad mapping", steps: [{ ...step, inputFrom: "previous" }] }));
  assert.throws(() => mapInput({ ...step, format: "json", instruction: "" }, { type: "text", value: "hello" }));
  assert.deepEqual(mapInput({ ...step, format: "json", instruction: "" }, { type: "json", value: { hello: 1 } }), { type: "json", value: { hello: 1 } });
});

test("general proposals use resolved endpoints; queue executes four steps without report schema", async () => {
  const store = new GeneralStore(":memory:");
  try {
    const proposal = await prepareGeneral({ name: "Four steps", steps: [step, ...Array(3).fill({ ...step, inputFrom: "previous", instruction: "" })] }, resolve, async () => {});
    store.save(proposal);
    assert.throws(() => store.enqueue(proposal.id, { type: "text", value: "hello" }));
    store.approve(proposal.id);
    const run = store.enqueue(proposal.id, { type: "text", value: "hello" });
    const claimed = store.claim()!;
    assert.equal(store.claim(), undefined);
    await executeGeneral(store, claimed, async (_step: GeneralStep, input) => ({ type: "text", value: `${input.value}!` }), resolve);
    assert.equal(store.run(run.id)?.status, "completed");
    assert.equal(store.run(run.id)?.outputs.length, 4);
    assert.match(String(store.run(run.id)?.outputs.at(-1)?.value), /hello!!!!/);
  } finally { store.close(); }
});

test("general execution stops on changed identity and recovery never auto-retries", async () => {
  const store = new GeneralStore(":memory:");
  try {
    const proposal = await prepareGeneral({ name: "Test", steps: [step] }, resolve, async () => {});
    store.save(proposal); store.approve(proposal.id);
    store.enqueue(proposal.id, { type: "text", value: "hello" });
    const run = store.claim()!;
    await executeGeneral(store, run, async () => { throw new Error("must not invoke"); }, async () => []);
    assert.equal(run.status, "failed"); assert.match(run.error!, /registration changed/);
    const next = store.enqueue(proposal.id, { type: "text", value: "hello" }); store.claim(); store.recover();
    assert.equal(store.run(next.id)?.status, "failed"); assert.equal(store.claim(), undefined);
  } finally { store.close(); }
});
