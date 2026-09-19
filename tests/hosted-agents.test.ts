import test from "node:test";
import assert from "node:assert/strict";
import { hostedTarget, hostedCard, handleHosted, parseHostedInput } from "../src/lib/owned-agent/hosted.ts";
import { inspectGeneral, invokeGeneral } from "../src/lib/general/client.ts";
import { prepareGeneral, executeGeneral } from "../src/lib/general/service.ts";
import { GeneralStore } from "../src/lib/general/store.ts";

const origins = { summary: "https://www.example.com", extract: "https://extract.example.com", qa: "https://ask.example.com" };
test("host routing uses configured canonical identities and rejects unknown or ambiguous hosts", () => {
  for (const kind of ["summary", "extract", "qa"] as const) {
    const target = hostedTarget(new Request(origins[kind]+"/a2a"), origins)!;
    assert.equal(target.kind, kind);
    assert.equal(hostedCard(kind, target.origin).url, origins[kind]+"/a2a");
  }
  assert.equal(hostedTarget(new Request("https://attacker.example/a2a"), origins), undefined);
  assert.equal(hostedTarget(new Request(origins.extract), {...origins, qa: origins.extract}), undefined);
  assert.throws(()=>hostedCard("qa", "http://ask.example.com"));
});
test("input contracts reject empty or duplicate fields and missing reference before inference", async () => {
  assert.deepEqual(parseHostedInput("extract", "Fields: owner, deadline\nSource:\nMaya sends it Friday.").definition.fields, ["owner", "deadline"]);
  assert.equal(parseHostedInput("qa", "Question: Who?\nReference:\nMaya.").source, "Who?");
  for (const [kind, text] of [["extract", "Fields: owner, OWNER\nSource:\nMaya"], ["qa", "Who owns this?"], ["qa", "Question: Who?\nReference:   "]] as const) {
    const req = new Request(origins[kind]+"/a2a", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"message/send",params:{message:{role:"user",messageId:"test",parts:[{kind:"text",text}]}}})});
    const response = await handleHosted(req,kind,{enabled:true,run:async()=>{throw new Error("must not infer");}});
    assert.equal((await response.json()).error.code,-32602);
  }
});
test("orchestrator resolves both identities and executes extraction then Q&A through the actual A2A SDK", async () => {
  const kinds = ["extract", "qa"] as const;
  const calls: string[] = [];
  const resolve = async (id: string) => {
    const kind = kinds.find(k=>id===`test-${k}`)!;
    assert.ok(kind);
    return [{ansId:id,name:hostedCard(kind,origins[kind]).name,description:null,ansName:`ans://test.${kind}`,endpoint:origins[kind]+"/a2a",metadataUrl:origins[kind]+"/.well-known/agent-card.json",transports:["JSON-RPC"],discoveredAt:new Date().toISOString(),identityStatus:"not-verified" as const}];
  };
  const fetcher: typeof fetch = async (url, init) => {
    const request = new Request(String(url),init);
    const {kind,origin} = hostedTarget(request,origins)!;
    if(new URL(request.url).pathname.endsWith("agent-card.json")) return Response.json(hostedCard(kind,origin));
    return handleHosted(request,kind,{enabled:true,run:async(def,source)=>{
      calls.push(def.template);
      if(def.template==='extract') {assert.match(source,/Maya/); return '{"owner":"Maya","deadline":"Friday","decision":null}';}
      assert.match(source,/Who/); assert.match(def.reference,/"owner":"Maya"/);
      return 'Maya owns the draft.\n\nReference excerpts\n- Maya';
    }});
  };
  const store = new GeneralStore(":memory:");
  try {
    const proposal = await prepareGeneral({name:"Extract then answer",steps:[
      {agentId:"test-extract",skill:"extract-information",inputFrom:"original",format:"text",instruction:""},
      {agentId:"test-qa",skill:"answer-from-reference",inputFrom:"previous",format:"text",instruction:"Question: Who owns the draft?\nReference:"},
    ]},resolve,step=>inspectGeneral(step,fetcher));
    store.save(proposal); store.approve(proposal.id);
    store.enqueue(proposal.id,{type:"text",value:"Maya sends the draft Friday."});
    const run = store.claim()!;
    await executeGeneral(store,run,(step,input)=>invokeGeneral(step,input,fetcher),resolve);
    assert.equal(run.status,"completed",run.error ?? "Workflow should complete");
    assert.deepEqual(calls,["extract","qa"]);
    assert.match(String(run.outputs[1].value),/Maya owns/);
  } finally {store.close();}
});
