import { discoverAgents, discoveryAuthorization } from "../src/lib/ans/client.ts";
import { SqliteAgentCatalog } from "../src/lib/gateways/catalog.ts";

const catalog = new SqliteAgentCatalog();
try {
  const result = await discoverAgents({ query: "", baseUrl: process.env.ANS_BASE_URL, authorization: discoveryAuthorization() });
  const unique = [...new Map(result.agents.map((agent) => [agent.ansId, agent])).values()].slice(0, 6);
  const imported = catalog.importRegistry(unique);
  console.log(JSON.stringify({ imported, skippedRecords: result.skippedRecords, localAgents: 3, registryAgents: unique.map((agent) => ({ name: agent.name, skills: agent.skills?.map((skill) => skill.name) ?? [] })), scope: "Small ANS snapshot; not the complete registry; compatibility unverified" }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Catalog seeding failed");
  process.exitCode = 1;
} finally { catalog.close(); }
