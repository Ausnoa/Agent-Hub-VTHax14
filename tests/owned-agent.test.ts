import test from "node:test";
import assert from "node:assert/strict";
import { agentCard, handleSummary } from "../src/lib/owned-agent/summary.ts";
import { invokeGeneral } from "../src/lib/general/client.ts";
const origin = "https://agent.example.com";
const fixture = { brief: "Launch date undecided.", keyPoints: ["Launch date undecided."], actionItems: ["Maya will send the draft Friday."] };
function request(body: unknown) { return new Request(`${origin}/a2a`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
const rpc = { jsonrpc: "2.0", id: "test", method: "message/send", params: { message: { role: "user", messageId: "input", parts: [{ kind: "text", text: "Maya will send the draft Friday. Launch date undecided." }] } } };
test("existing SDK client inspects and invokes our card and text endpoint", async () => {
  const step = { agentId: "test-only", name: "Glorria Brief", skill: "summarize-text", inputFrom: "original" as const, format: "text" as const, instruction: "", endpoint: `${origin}/a2a`, metadataUrl: `${origin}/.well-known/agent-card.json` };
  const fetcher: typeof fetch = async (url, init) => String(url) === step.metadataUrl ? Response.json(agentCard(origin)) : handleSummary(new Request(String(url), init), { enabled: true, summarize: async (text) => { assert.match(text, /Maya/); return fixture; } });
  const result = await invokeGeneral(step, { type: "text", value: rpc.params.message.parts[0].text }, fetcher);
  assert.equal(result.type, "text"); assert.match(String(result.value), /Maya will send/);
});
test("rejects invalid requests before calling inference", async () => {
  for (const [body, code] of [[[], -32600], [{...rpc, method: "tasks/get"}, -32601], [{...rpc, params: { message: {...rpc.params.message, parts: [{kind:"file", file:{uri:"https://example.com"}}]} }}, -32602], [{...rpc, params: { message: {...rpc.params.message, parts: [{kind:"text",text:"   "}]} }}, -32602]] as const) {
    const response = await handleSummary(request(body), {enabled:true, summarize: async () => { throw new Error("must not call"); }});
    assert.equal((await response.json()).error.code, code);
  }
  const oversized = await handleSummary(request({...rpc, extra:"x".repeat(33000)}), {enabled:true});
  assert.equal(oversized.status, 413);
  const disabled = await handleSummary(request(rpc), {enabled:false}); assert.equal(disabled.status,503);
});
test("no actions are invented by renderer and upstream errors do not leak", async () => {
  const ok = await handleSummary(request(rpc), {enabled:true, summarize:async()=>({...fixture,actionItems:[]})});
  assert.match((await ok.json()).result.parts[0].text,/None explicitly stated/);
  const fail = await handleSummary(request(rpc), {enabled:true,summarize:async()=>{throw new Error("secret-provider-detail");}});
  const output = await fail.text(); assert.match(output, /-32603/); assert.doesNotMatch(output,/secret-provider-detail/);
});
test("card rejects unsafe origins and malformed model outputs become errors", async () => {
  for (const origin of ["http://example.com","https://example.com/path","https://user:pass@example.com"]) assert.throws(()=>agentCard(origin));
  const response = await handleSummary(request(rpc), {enabled:true,summarize:async()=>({...fixture,brief:""})});
  assert.equal((await response.json()).error.code,-32603);
});
