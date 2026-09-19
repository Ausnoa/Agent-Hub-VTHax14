import { openDatabase } from "../src/lib/gateways/db.ts";
import { createRegistryGateway } from "../src/lib/gateways/registry.ts";
import { capabilities } from "../src/lib/contracts/index.ts";
import { developmentAgents } from "../src/lib/gateways/development-agents.ts";
import { inspectAgent } from "../src/lib/a2a/client.ts";
import { z } from "zod";

const db = openDatabase();
try {
  const registry = createRegistryGateway(db);
  const allowed = z.record(z.string(), z.array(z.string())).parse(JSON.parse(process.env.COMPATIBLE_AGENTS_JSON ?? "{}"));
  const status = registry.status();
  const candidates = capabilities.flatMap((capability) => registry.reportCandidates(capability));
  const results = [];
  const probe = process.argv.includes("--probe");
  if (probe) for (const agent of [...developmentAgents(), ...candidates.slice(0, 12)]) {
    try {
      const card = await inspectAgent(agent);
      results.push({ id: agent.ansId, capability: agent.capability, source: agent.source,
        cardCompatible: card.skills.some((skill) => skill.id === agent.capability) });
    } catch {
      results.push({ id: agent.ansId, capability: agent.capability, source: agent.source, cardCompatible: false });
    }
  }
  console.log(JSON.stringify({ indexed: status.listedAgents, eligible: status.eligibleAgents,
    latestSync: status.latest?.status ?? "never", localTestServices: 3,
    publicReportCandidates: new Set(candidates.map((agent) => agent.ansId)).size,
    approvedPublicCandidates: new Set(candidates.filter((agent) => allowed[agent.capability]?.includes(agent.ansId)).map((agent) => agent.ansId)).size,
    byCapability: Object.fromEntries(capabilities.map((capability) => [capability, candidates.filter((agent) => agent.capability === capability).length])),
    probes: results, note: "Card-only probes; not execution or identity verification. At most 12 public candidate endpoints are probed." }, null, 2));
} finally { db.close(); }
