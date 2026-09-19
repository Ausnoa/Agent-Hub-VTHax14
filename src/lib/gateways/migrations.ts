// Ordered schema migrations. Never edit an applied migration; append a new one.
// Kept as TypeScript strings rather than .sql files so the Next.js server bundle includes them.
// Schema design: docs/DECISION-003-DATABASE-SCHEMA.md.

export const migrations: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: "registry-index",
    sql: `
      CREATE TABLE sync_runs (
        id INTEGER PRIMARY KEY,
        trigger TEXT NOT NULL CHECK (trigger IN ('startup', 'interval', 'manual')),
        status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
        started_at TEXT NOT NULL,
        finished_at TEXT,
        pages INTEGER NOT NULL DEFAULT 0,
        agents_seen INTEGER NOT NULL DEFAULT 0,
        records_skipped INTEGER NOT NULL DEFAULT 0,
        error TEXT
      ) STRICT;
      CREATE UNIQUE INDEX sync_runs_one_running ON sync_runs(status) WHERE status = 'running';

      CREATE TABLE registry_agents (
        agent_id TEXT PRIMARY KEY,
        ans_name TEXT NOT NULL,
        host TEXT NOT NULL,
        version TEXT,
        provider_id TEXT,
        display_name TEXT NOT NULL,
        description TEXT,
        ans_status TEXT NOT NULL,
        expires_at TEXT,
        trust_score REAL,
        log_id TEXT,
        leaf_index INTEGER,
        ans_indexed_at TEXT,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        last_seen_sync_id INTEGER NOT NULL REFERENCES sync_runs(id),
        listed INTEGER NOT NULL DEFAULT 1 CHECK (listed IN (0, 1)),
        raw_json TEXT CHECK (raw_json IS NULL OR json_valid(raw_json))
      ) STRICT;
      CREATE INDEX registry_agents_host ON registry_agents(host);
      CREATE INDEX registry_agents_last_seen_sync ON registry_agents(last_seen_sync_id);

      CREATE TABLE registry_endpoints (
        id INTEGER PRIMARY KEY,
        agent_id TEXT NOT NULL REFERENCES registry_agents(agent_id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        protocol TEXT NOT NULL,
        url TEXT NOT NULL,
        metadata_url TEXT,
        documentation_url TEXT,
        transports TEXT NOT NULL CHECK (json_valid(transports)),
        UNIQUE (agent_id, protocol, url)
      ) STRICT;

      CREATE TABLE registry_functions (
        endpoint_id INTEGER NOT NULL REFERENCES registry_endpoints(id) ON DELETE CASCADE,
        function_id TEXT NOT NULL,
        name TEXT,
        tags TEXT NOT NULL CHECK (json_valid(tags)),
        PRIMARY KEY (endpoint_id, function_id)
      ) STRICT;

      -- rowid matches registry_agents.rowid, so rows are replaced by rowid instead of scanning.
      CREATE VIRTUAL TABLE registry_search USING fts5(
        display_name, description, functions, tags,
        tokenize = 'porter unicode61'
      );
    `,
  },
];
