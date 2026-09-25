import { randomUUID } from "node:crypto";
import { openDatabase } from "../gateways/db.ts";
import type { GeneralRun, GeneralWorkflow, Value } from "./contracts.ts";
import { capabilityProposalSchema, type CapabilityProposal } from '../capabilities/store.ts';

export class GeneralStore {
  private db;
  constructor(path?: string) {
    this.db = openDatabase(path);
    this.db.exec(`CREATE TABLE IF NOT EXISTS general_workflows (id TEXT PRIMARY KEY, approved INTEGER NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS general_runs (id TEXT PRIMARY KEY, status TEXT NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS capability_proposals (id TEXT PRIMARY KEY, body TEXT NOT NULL, published_id TEXT);
      CREATE TABLE IF NOT EXISTS capability_heads (root_id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL);`);
  }
  putCapability(definition: unknown, parentId?: string): CapabilityProposal {
    const proposal = capabilityProposalSchema.parse({ id: randomUUID(), definition, parentId, createdAt: new Date().toISOString() });
    this.db.prepare('INSERT INTO capability_proposals(id,body) VALUES(?,?)').run(proposal.id, JSON.stringify(proposal));
    return proposal;
  }
  capabilityProposal(id: string): CapabilityProposal {
    const row = this.db.prepare('SELECT body FROM capability_proposals WHERE id=?').get(id);
    if (!row) throw new Error('Proposal not found');
    return capabilityProposalSchema.parse(JSON.parse(String(row.body)));
  }
  publishCapability(id: string): GeneralWorkflow {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare('SELECT published_id FROM capability_proposals WHERE id=?').get(id);
      if (row?.published_id) { const existing = this.get(String(row.published_id), true)!; this.db.exec('COMMIT'); return existing; }
      const proposal = this.capabilityProposal(id);
      if (!proposal.definition.capability || proposal.definition.capability.unresolved.length || Date.now()-Date.parse(proposal.createdAt)>3600000) throw new Error('Proposal incomplete or expired');
      const parent = proposal.parentId ? this.get(proposal.parentId, true) : undefined;
      if (proposal.parentId && !parent) throw new Error('Parent agent not found');
      const newId = randomUUID(), rootId = parent?.revision?.rootId ?? parent?.id ?? newId;
      const head = this.db.prepare('SELECT workflow_id FROM capability_heads WHERE root_id=?').get(rootId);
      if (parent && head && head.workflow_id !== parent.id) throw new Error('A newer revision exists. Refresh and enhance that revision.');
      const workflow: GeneralWorkflow = { ...proposal.definition, id: newId, version: 1, createdAt: new Date().toISOString(), identity: 'not-verified', revision: { rootId, number: parent ? (parent.revision?.number ?? 1)+1 : 1, ...(parent ? { parentId: parent.id } : {}) } };
      this.db.prepare('INSERT INTO general_workflows VALUES(?,1,?)').run(newId, JSON.stringify(workflow));
      this.db.prepare('INSERT INTO capability_heads VALUES(?,?) ON CONFLICT(root_id) DO UPDATE SET workflow_id=excluded.workflow_id').run(rootId,newId);
      this.db.prepare('UPDATE capability_proposals SET published_id=? WHERE id=?').run(newId,id);
      this.db.exec('COMMIT'); return workflow;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
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
  runs(workflowId: string): GeneralRun[] { return this.db.prepare("SELECT body FROM general_runs WHERE json_extract(body,'$.workflowId')=? ORDER BY rowid DESC LIMIT 20").all(workflowId).map(row=>JSON.parse(String(row.body))); }
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
