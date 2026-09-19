import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { capabilitySchema, stateSchema, type Capability, type Report } from "../src/lib/contracts/index.ts";

export function transformFixture(capability: Capability, input: unknown): Report {
  const state = stateSchema.parse(input);
  const prior = state.previousOutput;
  if (capability !== "company-research" && !prior) throw new Error("This step requires the previous report");
  if (capability === "company-research") return {
    company: state.originalInput.company,
    facts: state.originalInput.notes.split(/\n+/).map((line) => line.trim()).filter(Boolean),
    risks: [], summary: "", sources: ["User-supplied notes; not independently verified"], fixture: true,
  };
  if (capability === "risk-analysis") return {
    ...prior!, fixture: true,
    risks: prior!.facts.filter((fact) => /risk|depend|debt|delay|concentrat|loss|declin/i.test(fact)),
  };
  return { ...prior!, fixture: true, summary: `${prior!.company}: ${prior!.facts.length} supplied observations and ${prior!.risks.length} possible risk signals. ${prior!.risks.length ? prior!.risks.join(" ") : "No keyword-based risk signals found; this is not evidence of no risk."} Local deterministic fixture, not live research or investment advice.` };
}

export function startFixtureAgent(capability: Capability, port: number) {
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.method === "GET" && req.url === "/.well-known/agent-card.json") {
      res.end(JSON.stringify({ name: `Local ${capability} fixture`, description: "Deterministic local test agent; not registered with ANS", url: `http://127.0.0.1:${port}/a2a`, protocolVersion: "0.3.0", version: "1.0.0", preferredTransport: "JSONRPC", capabilities: {}, defaultInputModes: ["application/json"], defaultOutputModes: ["application/json"], skills: [{ id: capability, name: capability, description: "Transforms supplied test notes", tags: ["local-fixture"] }] }));
      return;
    }
    if (req.method !== "POST" || req.url !== "/a2a") { res.writeHead(404).end(JSON.stringify({ error: "Not found" })); return; }
    let id: string | number | null = null;
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 100_000) throw new Error("Request too large");
      }
      const rpc = JSON.parse(body);
      id = rpc.id ?? null;
      if (rpc.jsonrpc !== "2.0" || rpc.method !== "message/send") {
        res.end(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } })); return;
      }
      const data = rpc.params?.message?.parts?.find((part: { kind?: string }) => part.kind === "data")?.data;
      const result = transformFixture(capability, data);
      res.end(JSON.stringify({ jsonrpc: "2.0", id, result: { kind: "message", role: "agent", messageId: randomUUID(), parts: [{ kind: "data", data: result }] } }));
    } catch {
      res.end(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid fixture input" } }));
    }
  });
  server.listen(port, "127.0.0.1");
  return server;
}

if (process.argv[1]?.endsWith("fixture-agent.ts")) {
  const capability = capabilitySchema.parse(process.argv[2]);
  const port = Number(process.argv[3]);
  if (![4311, 4312, 4313].includes(port)) throw new Error("Unsupported fixture port");
  startFixtureAgent(capability, port);
  console.log(`Local fixture ${capability} listening on ${port}; not ANS registered`);
}
