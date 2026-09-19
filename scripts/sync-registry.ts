import { openDatabase } from "../src/lib/gateways/db.ts";
import { createRegistryGateway } from "../src/lib/gateways/registry.ts";
import { syncRegistry } from "../src/lib/registry/sync.ts";
import { discoveryAuthorization } from "../src/lib/ans/client.ts";

const db = openDatabase();
try {
  const result = await syncRegistry(createRegistryGateway(db), {
    trigger: "manual", baseUrl: process.env.ANS_BASE_URL, authorization: discoveryAuthorization(),
    signal: AbortSignal.timeout(60_000), maxPages: 100,
  });
  console.log(JSON.stringify({ status: result.status, agentsSeen: result.agentsSeen, skipped: result.recordsSkipped }));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Registry sync failed");
  process.exitCode = 1;
} finally { db.close(); }
