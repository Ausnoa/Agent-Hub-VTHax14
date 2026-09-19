import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentStats, Composite, Proposal, Run } from "../contracts/index.ts";
import { databasePath } from "../gateways/db.ts";

export class Store {
  db: DatabaseSync;
  constructor(path = databasePath()) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS documents (kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, status TEXT NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS worker_lease (id INTEGER PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL);`);
  }
  saveDocument(kind: "proposal" | "agent", document: Proposal | Composite) {
    this.db.prepare("INSERT INTO documents(kind,id,body) VALUES(?,?,?)").run(kind, document.id, JSON.stringify(document));
  }
  document<T extends Proposal | Composite>(kind: "proposal" | "agent", id: string): T | undefined {
    const row = this.db.prepare("SELECT body FROM documents WHERE kind=? AND id=?").get(kind, id);
    return row ? JSON.parse(row.body as string) as T : undefined;
  }
  agents(): Composite[] {
    return this.db.prepare("SELECT body FROM documents WHERE kind='agent' ORDER BY rowid DESC LIMIT 50").all().map((row) => JSON.parse(row.body as string));
  }
  createRun(agentId: string, input: Run["input"]): Run {
    const now = new Date().toISOString();
    const run: Run = { id: randomUUID(), agentId, input, status: "queued", createdAt: now, updatedAt: now, attempts: [] };
    this.db.prepare("INSERT INTO runs VALUES(?,?,?)").run(run.id, run.status, JSON.stringify(run));
    return run;
  }
  run(id: string): Run | undefined {
    const row = this.db.prepare("SELECT body FROM runs WHERE id=?").get(id);
    return row ? JSON.parse(row.body as string) : undefined;
  }
  runs(agentId: string): Run[] {
    return this.db.prepare("SELECT body FROM runs WHERE json_extract(body,'$.agentId')=? ORDER BY rowid DESC LIMIT 20").all(agentId).map((row) => JSON.parse(row.body as string));
  }
  recentRuns(limit = 50): Run[] {
    return this.db.prepare("SELECT body FROM runs ORDER BY rowid DESC LIMIT ?").all(limit).map((row) => JSON.parse(row.body as string));
  }
  // Real run-count and average wall-clock latency per agent, computed from stored runs
  // (createdAt -> updatedAt for finished runs) so the fleet UI never has to show invented numbers.
  runStats(): Map<string, AgentStats> {
    const rows = this.db.prepare(`
      SELECT json_extract(body,'$.agentId') AS agentId,
             COUNT(*) AS runCount,
             AVG(CASE WHEN status IN ('completed','failed')
                      THEN (julianday(json_extract(body,'$.updatedAt')) - julianday(json_extract(body,'$.createdAt'))) * 86400000 END) AS avgLatencyMs
      FROM runs GROUP BY agentId
    `).all();
    const stats = new Map<string, AgentStats>();
    for (const row of rows) {
      stats.set(row.agentId as string, {
        runCount: Number(row.runCount),
        avgLatencyMs: row.avgLatencyMs == null ? null : Number(row.avgLatencyMs),
      });
    }
    return stats;
  }
  saveRun(run: Run) {
    run.updatedAt = new Date().toISOString();
    this.db.prepare("UPDATE runs SET status=?,body=? WHERE id=?").run(run.status, JSON.stringify(run), run.id);
  }
  claim(): Run | undefined {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db.prepare("SELECT id FROM runs WHERE status='queued' ORDER BY rowid LIMIT 1").get();
      const run = row ? this.run(row.id as string) : undefined;
      if (run) { run.status = "running"; this.saveRun(run); }
      this.db.exec("COMMIT");
      return run;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  retry(id: string): Run {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const run = this.run(id);
      if (!run || run.status !== "failed") throw new Error("Only failed runs can be retried");
      run.status = "queued";
      delete run.error;
      this.saveRun(run);
      this.db.exec("COMMIT");
      return run;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  acquireWorker(owner: string): boolean {
    return Number(this.db.prepare("INSERT INTO worker_lease VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE worker_lease.expires < ? OR worker_lease.owner = ?").run(owner, Date.now() + 120_000, Date.now(), owner).changes) === 1;
  }
  releaseWorker(owner: string) { this.db.prepare("DELETE FROM worker_lease WHERE owner=?").run(owner); }
  recoverInterruptedRuns() {
    for (const row of this.db.prepare("SELECT body FROM runs WHERE status='running'").all()) {
      const run: Run = JSON.parse(row.body as string);
      run.status = "failed";
      run.error = "Worker stopped before completion. Review the step before retrying.";
      for (const attempt of run.attempts) if (attempt.status === "running") {
        attempt.status = "failed"; attempt.error = run.error; attempt.completedAt = new Date().toISOString();
      }
      this.saveRun(run);
    }
  }
  close() { this.db.close(); }
}
