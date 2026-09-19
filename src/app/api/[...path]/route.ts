import { z } from "zod";
import { Store } from "../../../lib/persistence/store.ts";
import { compose, validatePlan } from "../../../lib/workflows/composer.ts";
import { discoverAgents } from "../../../lib/ans/client.ts";
import { inputSchema, proposalSchema, type Composite, type Proposal } from "../../../lib/contracts/index.ts";
import { reportForm } from "../../../lib/contracts/ui.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function body(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request body is required");
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 32_000) throw new Error("Request exceeds the 32 KB limit");
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
    if (request.method === "GET" && path.join("/") === "status") return json({ plannerConfigured: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL) });
    if (request.method === "POST" && path.join("/") === "proposals") {
      const input = z.object({ description: z.string().trim().min(10).max(2000), mode: z.enum(["live", "demo"]) }).parse(await body(request));
      const proposal = await compose(input.description, input.mode);
      store.saveDocument("proposal", proposal);
      return json(proposal, 201);
    }
    if (request.method === "POST" && path.join("/") === "discover") {
      const input = z.object({ query: z.string().max(256), pageToken: z.string().max(4000).optional() }).parse(await body(request));
      return json(await discoverAgents({ ...input, baseUrl: process.env.ANS_BASE_URL, authorization: process.env.ANS_AUTHORIZATION }));
    }
    if (request.method === "GET" && path.join("/") === "agents") return json(store.agents());
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
