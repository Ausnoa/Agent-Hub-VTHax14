import { randomUUID } from "node:crypto";
import { openDatabase } from "../gateways/db.ts";
import { definitionSchema, type OwnedAgent } from "./templates.ts";
export class OwnedStore {
  private db;
  constructor(path?: string) {
    this.db = openDatabase(path);
    this.db.exec("CREATE TABLE IF NOT EXISTS owned_agents (id TEXT PRIMARY KEY, body TEXT NOT NULL)");
  }
  create(input: unknown): OwnedAgent {
    const agent = { ...definitionSchema.parse(input), id: `owned:${randomUUID()}`, createdAt:new Date().toISOString() };
    this.db.prepare("INSERT INTO owned_agents VALUES (?,?)").run(agent.id,JSON.stringify(agent)); return agent;
  }
  get(id: string): OwnedAgent | undefined {
    const row=this.db.prepare("SELECT body FROM owned_agents WHERE id=?").get(id);
    return row ? JSON.parse(String(row.body)) : undefined;
  }
  list(): OwnedAgent[] { return this.db.prepare("SELECT body FROM owned_agents ORDER BY rowid DESC LIMIT 100").all().map(row=>JSON.parse(String(row.body))); }
  close() { this.db.close(); }
}
export function getOwned(id: string) { const store=new OwnedStore(); try {return store.get(id);} finally {store.close();} }
