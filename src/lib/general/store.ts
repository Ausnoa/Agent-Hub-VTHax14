import { randomUUID } from "node:crypto";
import { openDatabase } from "../gateways/db.ts";
import type { GeneralRun, GeneralWorkflow, Value } from "./contracts.ts";

export class GeneralStore {
  private db;
  constructor(path?: string) {
    this.db = openDatabase(path);
    this.db.exec(`CREATE TABLE IF NOT EXISTS general_workflows (id TEXT PRIMARY KEY, approved INTEGER NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS general_runs (id TEXT PRIMARY KEY, status TEXT NOT NULL, body TEXT NOT NULL);`);
  }
  save(workflow: GeneralWorkflow) { this.db.prepare("INSERT INTO general_workflows VALUES(?,0,?)").run(workflow.id, JSON.stringify(workflow)); }
  get(id: string, approved = false): GeneralWorkflow | undefined {
    const row = this.db.prepare("SELECT body FROM general_workflows WHERE id=? AND (?=0 OR approved=1)").get(id, Number(approved));
    return row ? JSON.parse(String(row.body)) : undefined;
  }
  approve(id: string) {
    const workflow = this.get(id);
    if (!workflow || Date.now() - Date.parse(workflow.createdAt) > 3600000) throw new Error("Missing or expired proposal; build again");
    this.db.prepare("UPDATE general_workflows SET approved=1 WHERE id=?").run(id);
    return workflow;
  }
  list(): GeneralWorkflow[] { return this.db.prepare("SELECT body FROM general_workflows WHERE approved=1 ORDER BY rowid DESC LIMIT 50").all().map((row) => JSON.parse(String(row.body))); }
  enqueue(workflowId: string, input: Value): GeneralRun {
    if (!this.get(workflowId, true)) throw new Error("Approve a saved workflow first");
    const run: GeneralRun = { id: randomUUID(), workflowId, input, status: "queued", createdAt: new Date().toISOString(), outputs: [] };
    this.db.prepare("INSERT INTO general_runs VALUES(?,?,?)").run(run.id, run.status, JSON.stringify(run));
    return run;
  }
  run(id: string): GeneralRun | undefined { const row = this.db.prepare("SELECT body FROM general_runs WHERE id=?").get(id); return row ? JSON.parse(String(row.body)) : undefined; }
  update(run: GeneralRun) { this.db.prepare("UPDATE general_runs SET status=?,body=? WHERE id=?").run(run.status, JSON.stringify(run), run.id); }
  claim(): GeneralRun | undefined {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db.prepare("SELECT id FROM general_runs WHERE status='queued' ORDER BY rowid LIMIT 1").get();
      const run = row ? this.run(String(row.id)) : undefined;
      if (run) { run.status = "running"; this.update(run); }
      this.db.exec("COMMIT"); return run;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  recover() {
    for (const row of this.db.prepare("SELECT body FROM general_runs WHERE status='running'").all()) {
      const run: GeneralRun = JSON.parse(String(row.body));
      run.status = "failed"; run.error = "Worker interrupted. External effects are uncertain; do not rerun without review."; this.update(run);
    }
  }
  close() { this.db.close(); }
}
