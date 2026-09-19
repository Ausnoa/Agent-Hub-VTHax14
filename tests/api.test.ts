import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GET, POST } from "../src/app/api/[...path]/route.ts";

function request(path: string, value: unknown, origin = "http://127.0.0.1:3000", host = "127.0.0.1:3000") {
  return POST(new Request(`http://localhost:3000/api/${path}`, { method: "POST", headers: { host, origin, "Content-Type": "application/json" }, body: JSON.stringify(value) }), { params: Promise.resolve({ path: path.split("/") }) });
}

test("API rejects cross-origin writes and nonlocal hosts", async () => {
  assert.equal((await request("agents", {}, "https://untrusted.example")).status, 403);
  assert.equal((await request("agents", {}, "http://evil.example", "evil.example")).status, 403);
});

test("approval uses saved proposal, not injected endpoints; invocation validates input", async () => {
  const directory = mkdtempSync(join(tmpdir(), "composer-api-"));
  process.env.COMPOSER_DB = join(directory, "test.sqlite");
  try {
    const built = await request("proposals", { description: "Research and summarize supplied notes", mode: "demo" });
    assert.equal(built.status, 201);
    const proposal = await built.json();
    const approved = await request("agents", { proposalId: proposal.id, steps: [{ endpoint: "http://untrusted.example" }] });
    assert.equal(approved.status, 201);
    const agent = await approved.json();
    assert.equal(agent.steps[0].endpoint, "http://127.0.0.1:4311/a2a");
    assert.equal(agent.uiSchema.fields.length, 2);
    assert.equal((await request(`agents/${agent.id}/invoke`, { company: "", notes: "" })).status, 400);
    const invoked = await request(`agents/${agent.id}/invoke`, { company: "Test", notes: "A supplied observation" });
    assert.equal(invoked.status, 202);
    const run = await invoked.json();
    const read = await GET(new Request(`http://localhost:3000/api/runs/${run.id}`, { headers: { host: "127.0.0.1:3000" } }), { params: Promise.resolve({ path: ["runs", run.id] }) });
    assert.equal((await read.json()).status, "queued");
    assert.equal((await request(`runs/${run.id}/retry`, {})).status, 400);
  } finally { delete process.env.COMPOSER_DB; rmSync(directory, { recursive: true, force: true }); }
});
