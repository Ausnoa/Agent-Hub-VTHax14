import test from "node:test";
import assert from "node:assert/strict";
import { GeneralStore } from "../src/lib/general/store.ts";
import { draftSchema, mapInput, type GeneralStep } from "../src/lib/general/contracts.ts";
import { prepareGeneral, executeGeneral } from "../src/lib/general/service.ts";
import { inspectGeneral, invokeGeneral } from "../src/lib/general/client.ts";

const step = { agentId: "synthetic", skill: "translate", inputFrom: "original" as const, format: "text" as const, instruction: "Translate to French" };
const resolve = async () => [{ ansId: "synthetic", name: "Translator", description: null, ansName: "ans://test.example", endpoint: "https://test.example/a2a", metadataUrl: "https://test.example/card", transports: ["JSON-RPC"], discoveredAt: new Date().toISOString(), identityStatus: "not-verified" as const }];

test("general SDK transports text and rejects authenticated cards", async () => {
  const selected = { ...step, endpoint: "https://test.example/a2a", metadataUrl: "https://test.example/card", name: "Test" };
  const card = { url: selected.endpoint, protocolVersion: "0.3.0", defaultInputModes: ["text/plain"], defaultOutputModes: ["text/plain"], skills: [{ id: step.skill }] };
  const fetcher: typeof fetch = async (url, init) => {
    if (String(url) === selected.metadataUrl) return Response.json(card);
    const request = JSON.parse(String(init?.body));
    assert.equal(request.method, "message/send");
    assert.equal(request.params.message.parts[0].text, "Hello");
    return Response.json({ jsonrpc: "2.0", id: request.id, result: { kind: "message", messageId: "reply", role: "agent", parts: [{ kind: "text", text: "Bonjour" }] } });
  };
  assert.deepEqual(await invokeGeneral(selected, { type: "text", value: "Hello" }, fetcher), { type: "text", value: "Bonjour" });
  await assert.rejects(inspectGeneral(selected, async () => Response.json({ ...card, security: [{ oauth: [] }] })), /authentication/);
});

test("general schema allows eight arbitrary skills and rejects invalid input mappings", () => {
  assert.equal(draftSchema.parse({ name: "Translate", steps: Array(8).fill(step) }).steps.length, 8);
  assert.throws(() => draftSchema.parse({ name: "Too long", steps: Array(9).fill(step) }));
  assert.throws(() => draftSchema.parse({ name: "Bad mapping", steps: [{ ...step, inputFrom: "previous" }] }));
  assert.throws(() => mapInput({ ...step, format: "json", instruction: "" }, { type: "text", value: "hello" }));
  assert.deepEqual(mapInput({ ...step, format: "json", instruction: "" }, { type: "json", value: { hello: 1 } }), { type: "json", value: { hello: 1 } });
});

test("completed tasks decode agent status messages without echoing user history", async () => {
  const selected = { ...step, endpoint: "https://test.example/a2a", metadataUrl: "https://test.example/card", name: "Test" };
  let role = "agent";
  const fetcher: typeof fetch = async (url, init) => {
    if (String(url) === selected.metadataUrl) return Response.json({ url: selected.endpoint, protocolVersion: "0.3.0", defaultInputModes: ["text/plain"], defaultOutputModes: ["text/plain"], skills: [{ id: step.skill }] });
    const request = JSON.parse(String(init?.body));
    return Response.json({ jsonrpc: "2.0", id: request.id, result: { kind: "task", id: "remote-task", contextId: "context", status: { state: "completed", message: { kind: "message", role, messageId: "completion", parts: [{ kind: "text", text: "Completed answer" }] } }, history: [{ kind: "message", role: "user", messageId: "input", parts: [{ kind: "text", text: "Do not echo me" }] }] } });
  };
  assert.deepEqual(await invokeGeneral(selected, { type: "text", value: "Hello" }, fetcher), { type: "text", value: "Completed answer" });
  role = "user";
  await assert.rejects(invokeGeneral(selected, { type: "text", value: "Hello" }, fetcher), /no output parts/);
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
