CREATE TABLE IF NOT EXISTS pilot_registry_agents (
  agent_key TEXT PRIMARY KEY,
  ans_id TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  record_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pilot_development_agents (
  agent_id TEXT PRIMARY KEY,
  capability TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  record_json TEXT NOT NULL
);
