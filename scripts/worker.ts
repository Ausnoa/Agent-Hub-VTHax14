import { randomUUID } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";
import { Store } from "../src/lib/persistence/store.ts";
import { executeRun } from "../src/lib/workflows/runtime.ts";
import { openDatabase } from "../src/lib/gateways/db.ts";
import { createRegistryGateway, type SyncTrigger } from "../src/lib/gateways/registry.ts";
import { syncRegistry } from "../src/lib/registry/sync.ts";

const store = new Store();
const owner = randomUUID();
if (!store.acquireWorker(owner)) { store.close(); throw new Error("Another worker owns this database. After a crash, its lease expires within two minutes."); }
store.recoverInterruptedRuns();
let stopping = false;
const heartbeat = setInterval(() => { if (!store.acquireWorker(owner)) { console.error("Worker lease lost"); process.exit(1); } }, 10_000);
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

// Registry index sync runs beside the run loop, never blocking it. 0 minutes disables it.
const registryDb = openDatabase();
const registry = createRegistryGateway(registryDb);
registry.failInterruptedSyncs();
const syncAbort = new AbortController();
const syncMinutes = Number(process.env.ANS_SYNC_INTERVAL_MINUTES ?? "30");
let syncing: Promise<void> | undefined;
function startSync(trigger: SyncTrigger) {
  if (syncing) return;
  syncing = syncRegistry(registry, { trigger, baseUrl: process.env.ANS_BASE_URL, authorization: process.env.ANS_AUTHORIZATION, signal: syncAbort.signal })
    .then((sync) => console.log(`Registry sync ${sync.id} completed: ${sync.agentsSeen} agents, ${sync.recordsSkipped} skipped, ${sync.delisted} delisted`))
    .catch((error) => { if (!syncAbort.signal.aborted) console.error(`Registry sync failed: ${error instanceof Error ? error.message : error}`); })
    .finally(() => { syncing = undefined; });
}
const syncTimer = syncMinutes > 0 ? setInterval(() => startSync("interval"), syncMinutes * 60_000) : undefined;
if (syncMinutes > 0) startSync("startup");

console.log("Workflow worker ready");
try {
  while (!stopping) {
    const run = store.claim();
    if (run) await executeRun(store, run);
    else await pause(500);
  }
} finally {
  clearInterval(heartbeat); clearInterval(syncTimer);
  syncAbort.abort(); await syncing;
  registryDb.close(); store.releaseWorker(owner); store.close();
}
