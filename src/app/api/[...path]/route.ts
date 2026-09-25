import { OwnedStore } from "../../../lib/owned-agent/store.ts";
import { runDefinition } from "../../../lib/owned-agent/run.ts";
import { z } from "zod";
import { Store } from "../../../lib/persistence/store.ts";
import { compose, validatePlan } from "../../../lib/workflows/composer.ts";
import { discoverAgents, discoveryAuthorization } from "../../../lib/ans/client.ts";
import { inputSchema, proposalSchema, type Composite, type Proposal } from "../../../lib/contracts/index.ts";
import { reportForm } from "../../../lib/contracts/ui.ts";
import { SqliteAgentCatalog } from "../../../lib/gateways/catalog.ts";
import { openDatabase } from "../../../lib/gateways/db.ts";
import { createRegistryGateway, type RegistryGateway } from "../../../lib/gateways/registry.ts";
import { GeneralStore } from "../../../lib/general/store.ts";
import { prepareGeneral } from "../../../lib/general/service.ts";
import { valueSchema } from "../../../lib/general/contracts.ts";
import { suggestGeneral } from "../../../lib/general/planner.ts";
import { handleCapabilities, asCapabilityDraft } from '../../../lib/capabilities/handler.ts';
import { gemini } from '../../../lib/models/gemini.ts';

function withRegistry<T>(work: (registry: RegistryGateway) => T): T {
  const db = openDatabase();
  try { return work(createRegistryGateway(db)); } finally { db.close(); }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function body(request: Request, limit = 32_000): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request body is required");
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) throw new Error("Request exceeds its size limit");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await reader.cancel(); }
}

function json(value: unknown, status = 200) { return Response.json(value, { status, headers: { "Cache-Control": "no-store" } }); }

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const host = request.headers.get("host") ?? "";
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return json({ error: "This MVP API is available only through the local workspace" }, 403);
  const origin = request.headers.get("origin");
  if (request.method !== "GET" && origin && origin !== `http://${host}` && origin !== `https://${host}`) return json({ error: "Cross-origin writes are not allowed" }, 403);
  const { path } = await context.params;
  const store = new Store();
  try {
    if(path[0]==='capabilities'){
      const general=new GeneralStore();
      try{return await handleCapabilities(request,path,{
        enabled:true,generate:gemini,budget:async()=>{},
        search:async query=>{
          const page=await discoverAgents({query,baseUrl:process.env.ANS_BASE_URL,authorization:discoveryAuthorization()});
          return page.agents.filter(a=>a.metadataUrl&&a.skills?.length).map(a=>({agentId:a.ansId,name:a.name,description:a.description,skills:a.skills!}));
        },
        prepare:async step=>{const checked=await prepareGeneral({name:'Capability check',steps:[{...step,inputFrom:'original',inputStep:undefined}]});return {...checked.steps[0],inputFrom:step.inputFrom,...(step.inputStep===undefined?{}:{inputStep:step.inputStep})};},
        getAgent:async id=>{const agent=general.get(id,true);if(!agent)throw new Error('Agent not found');return asCapabilityDraft(agent);},
        put:async(definition,parentId)=>general.putCapability(definition,parentId),get:async id=>general.capabilityProposal(id),publish:async id=>general.publishCapability(id),
      });}finally{general.close();}
    }
    if (path[0] === "owned") {
      const owned = new OwnedStore();
      try {
        if (path.length === 1 && request.method === "GET") return json(owned.list());
        if (path.length === 1 && request.method === "POST") return json(owned.create(await body(request)), 201);
        if (path.length === 3 && path[2] === "test" && request.method === "POST") {
          const agent = owned.get(path[1]);
          if (!agent) return json({ error: "Created agent not found" }, 404);
          const input = z.object({ text: z.string().trim().min(1).max(12000) }).parse(await body(request));
          return json({ output: await runDefinition(agent, input.text) });
        }
        return json({ error: "Route not found" }, 404);
      } finally { owned.close(); }
    }
    if (path[0] === "general") {
      const general = new GeneralStore();
      try {
        if (request.method === "GET" && path.length === 1) return json(general.list());
        if(request.method==='GET'&&path.length===2&&z.uuid().safeParse(path[1]).success){const agent=general.get(path[1],true);return agent?json(agent):json({error:'Agent not found'},404);}
        if (request.method === "GET" && path[1] === "available" && path.length === 2) {
          const params = new URL(request.url).searchParams;
          const query = z.string().max(256).parse(params.get("query") ?? "");
          const offset = z.coerce.number().int().min(0).max(100000).parse(params.get("offset") ?? 0);
          return json(withRegistry((registry) => ({ ...registry.available(query, offset), status: registry.status() })));
        }
        if (request.method === "POST" && path[1] === "check" && path.length === 2) {
          const selection = z.object({ agentId: z.string().max(200), skill: z.string().max(200), format: z.enum(["text", "json"]) }).parse(await body(request));
          const checked = await prepareGeneral({ name: "Compatibility check", steps: [{ ...selection, inputFrom: "original", instruction: "" }] });
          return json({ step: checked.steps[0], checkedAt: new Date().toISOString() });
        }
        if (request.method === "POST" && path[1] === "suggest" && path.length === 2) {
          const input = z.object({ description: z.string().trim().min(10).max(2000) }).parse(await body(request));
          return json(await suggestGeneral(input.description));
        }
        if (request.method === "POST" && path[1] === "proposals" && path.length === 2) {
          const proposal = await prepareGeneral(await body(request));
          general.save(proposal); return json(proposal, 201);
        }
        if (path[1] === "runs" && path[2] && path.length === 3 && request.method === "GET") {
          const run = general.run(z.string().uuid().parse(path[2]));
          return run ? json(run) : json({ error: "Run not found" }, 404);
        }
        if(path[1] && path[2]==='runs' && path.length===3 && request.method==='GET')return json(general.runs(z.uuid().parse(path[1])));
        if (path[1] && path.length === 3 && request.method === "POST") {
          const id = z.string().uuid().parse(path[1]);
          if (path[2] === "approve") return json(general.approve(id));
          if (path[2] === "invoke") {
            const input = z.object({ input: valueSchema, confirmExternalExecution: z.literal(true) }).parse(await body(request,1_340_000));
            return json(general.enqueue(id, input.input), 202);
          }
        }
        return json({ error: "Route not found" }, 404);
      } finally { general.close(); }
    }
    if (request.method === "GET" && path.join("/") === "status") return json({ plannerConfigured: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL) });
    if (request.method === "GET" && path.join("/") === "catalog") {
      const params = new URL(request.url).searchParams;
      const query = z.string().max(256).parse(params.get("query") ?? "");
      const source = z.enum(["ans", "local-fixture"]).optional().parse(params.get("source") ?? undefined);
      const catalog = new SqliteAgentCatalog();
      try { return json(await catalog.search(query, source)); }
      finally { catalog.close(); }
    }
    if (request.method === "POST" && path.join("/") === "proposals") {
      const input = z.object({ description: z.string().trim().min(10).max(2000), mode: z.enum(["live", "demo", "pilot"]) }).parse(await body(request));
      const proposal = await compose(input.description, input.mode);
      store.saveDocument("proposal", proposal);
      return json(proposal, 201);
    }
    if (request.method === "POST" && path.join("/") === "discover") {
      const input = z.object({ query: z.string().max(256), pageToken: z.string().max(4000).optional() }).parse(await body(request));
      return json(await discoverAgents({ ...input, baseUrl: process.env.ANS_BASE_URL, authorization: discoveryAuthorization() }));
    }
    if (request.method === "GET" && path.join("/") === "registry/status") return json(withRegistry((registry) => registry.status()));
    if (request.method === "POST" && path.join("/") === "registry/search") {
      const input = z.object({ query: z.string().trim().min(1).max(256), limit: z.number().int().min(1).max(50).optional() }).parse(await body(request));
      return json(withRegistry((registry) => ({
        source: "local-ans-index",
        indexedAt: registry.status().lastCompleted?.finishedAt ?? null,
        candidates: registry.searchCandidates(input.query, input.limit),
      })));
    }
    if (request.method === "GET" && path.join("/") === "agents") {
      const stats = store.runStats();
      return json(store.agents().map((agent) => ({ ...agent, stats: stats.get(agent.id) })));
    }
    if (request.method === "POST" && path.join("/") === "agents") {
      const input = z.object({ proposalId: z.string().uuid() }).parse(await body(request));
      const found = store.document<Proposal>("proposal", input.proposalId);
      if (!found) return json({ error: "Proposal not found" }, 404);
      const proposal = proposalSchema.parse(found);
      const existing = store.document<Composite>("agent", proposal.id);
      if (existing) return json(existing);
      if (Date.now() - Date.parse(proposal.createdAt) > 3_600_000) return json({ error: "Proposal expired. Build a new proposal." }, 409);
      if (proposal.blockers.length || validatePlan(proposal.plan).length || proposal.steps.length !== proposal.plan.capabilities.length) return json({ error: "Resolve the proposal's missing capabilities before saving" }, 409);
      const composite: Composite = { ...proposal, version: 1, uiSchema: reportForm };
      store.saveDocument("agent", composite);
      return json(composite, 201);
    }
    if (path[0] === "agents" && path[1]) {
      const id = z.string().uuid().parse(path[1]);
      const agent = store.document<Composite>("agent", id);
      if (!agent) return json({ error: "Agent not found" }, 404);
      if (request.method === "GET" && path.length === 2) return json({ agent, runs: store.runs(id) });
      if (request.method === "POST" && path[2] === "invoke" && path.length === 3) return json(store.createRun(id, inputSchema.parse(await body(request))), 202);
    }
    if (request.method === "GET" && path.join("/") === "runs") {
      const names = new Map<string, string>();
      return json(store.recentRuns().map((run) => {
        if (!names.has(run.agentId)) names.set(run.agentId, store.document<Composite>("agent", run.agentId)?.plan.name ?? "Deleted agent");
        return { ...run, agentName: names.get(run.agentId) };
      }));
    }
    if (path[0] === "runs" && path[1]) {
      const id = z.string().uuid().parse(path[1]);
      const run = store.run(id);
      if (!run) return json({ error: "Run not found" }, 404);
      if (request.method === "GET" && path.length === 2) return json(run);
      if (request.method === "POST" && path[2] === "retry" && path.length === 3) return json(store.retry(id), 202);
    }
    return json({ error: "Route not found" }, 404);
  } catch (error) {
    if (error instanceof z.ZodError) return json({ error: "Invalid input or incompatible response", details: error.issues.map((issue) => issue.message).slice(0, 5) }, 400);
    return json({ error: error instanceof Error ? error.message.slice(0, 300) : "Unexpected error" }, 400);
  } finally { store.close(); }
}

export const GET = handle;
export const POST = handle;
