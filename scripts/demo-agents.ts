import { spawn } from "node:child_process";
import { capabilities } from "../src/lib/contracts/index.ts";

const children = capabilities.map((capability, index) => spawn(process.execPath, ["agents/fixture-agent.ts", capability, String(4311 + index)], { stdio: "inherit" }));
let stopping = false;
function stop() { stopping = true; children.forEach((child) => child.kill("SIGTERM")); }
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children.forEach((child) => child.on("exit", (code) => { if (!stopping) { process.exitCode = code || 1; stop(); } }));
