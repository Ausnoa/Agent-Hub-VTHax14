import { randomUUID } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";
import { Store } from "../src/lib/persistence/store.ts";
import { executeRun } from "../src/lib/workflows/runtime.ts";

const store = new Store();
const owner = randomUUID();
if (!store.acquireWorker(owner)) { store.close(); throw new Error("Another worker owns this database. After a crash, its lease expires within two minutes."); }
store.recoverInterruptedRuns();
let stopping = false;
const heartbeat = setInterval(() => { if (!store.acquireWorker(owner)) { console.error("Worker lease lost"); process.exit(1); } }, 10_000);
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });
console.log("Workflow worker ready");
try {
  while (!stopping) {
    const run = store.claim();
    if (run) await executeRun(store, run);
    else await pause(500);
  }
} finally { clearInterval(heartbeat); store.releaseWorker(owner); store.close(); }
