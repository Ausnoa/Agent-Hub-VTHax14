# Decision 003 — Database schema

Status: accepted, not yet implemented. Date: September 19, 2026.

## Context

`DECISION-001-ANS-REGISTRY-INDEX.md` introduced a local index of the ANS registry and `DECISION-002-GATEWAY-AND-DATA-ACCESS.md` put all database access behind gateways. Neither defined the application's own tables, and the index's first table list predates the registry field survey in `INTEGRATION-RESEARCH.md`. This record is the complete schema; it supersedes the table list in Decision 001.

Verified on Node 24.21.0 (`node:sqlite`, SQLite 3.53.4): FTS5 with the `porter unicode61` tokenizer, `PRAGMA user_version`, `STRICT` tables, partial unique indexes, and JSON functions all work.

## Conventions

- Every table is `STRICT`.
- Timestamps are `TEXT` in UTC ISO 8601 with milliseconds, exactly as `Date.prototype.toISOString()` produces (`2026-09-19T12:00:00.000Z`). ANS timestamps are normalized to this format before storage so string comparison orders correctly.
- JSON is stored as `TEXT` with a `CHECK (json_valid(column))` constraint.
- Booleans are `INTEGER` restricted to 0 and 1.
- ANS identifiers are stored as ANS returns them. Application identifiers that appear in URLs (proposals, composites, runs) are `crypto.randomUUID()` values.
- Every connection sets `PRAGMA foreign_keys = ON`, `PRAGMA journal_mode = WAL`, and `PRAGMA busy_timeout = 5000`. WAL lets API reads continue while a sync writes.
- Stored third-party documents (`raw_json`, agent card bodies) are capped at 256 KB. A larger document is not stored and its row records why.

## Gateway ownership

| Gateway | Tables |
| --- | --- |
| Registry | `sync_runs`, `registry_agents`, `registry_endpoints`, `registry_functions`, `agent_cards`, `card_skills`, `identity_checks`, `registry_search` |
| Composite | `proposals`, `composites`, `workflow_versions`, `workflow_steps` |
| Run | `runs`, `step_attempts` |

A gateway may read another area's tables for integrity checks, such as the composite gateway confirming a step's agent exists, but writes only its own.

## Registry index tables

### `sync_runs`

One row per sync attempt.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK | |
| `trigger` | TEXT | `startup`, `interval`, or `manual` |
| `status` | TEXT | `running`, `completed`, or `failed` |
| `started_at`, `finished_at` | TEXT | `finished_at` null while running |
| `pages` | INTEGER | Pages fetched |
| `agents_seen` | INTEGER | Records upserted |
| `records_skipped` | INTEGER | Records that failed validation |
| `error` | TEXT | Failure reason, null on success |

A partial unique index on `status` where `status = 'running'` allows only one sync at a time.

### `registry_agents`

One row per ANS registration (`agentId`). A host that re-registers a new version gets a new row.

| Column | Type | Notes |
| --- | --- | --- |
| `agent_id` | TEXT PK | ANS `agentId` |
| `ans_name` | TEXT | e.g. `ans://v1.0.1.host.example` |
| `host` | TEXT | `agentHost`; indexed |
| `version` | TEXT | `agentVersion` |
| `provider_id` | TEXT | Null when ANS omits it |
| `display_name` | TEXT | `agentDisplayName` |
| `description` | TEXT | `agentDescription`, null when absent |
| `ans_status` | TEXT | `lifecycle.status` as reported |
| `expires_at` | TEXT | `expiresAt` |
| `trust_score` | INTEGER | `scores.trustScore`, null when absent |
| `log_id`, `leaf_index` | TEXT, INTEGER | Transparency log entry |
| `ans_indexed_at` | TEXT | `indexedAt` |
| `first_seen_at`, `last_seen_at` | TEXT | When our syncs first and last saw it |
| `last_seen_sync_id` | INTEGER FK → `sync_runs` | |
| `listed` | INTEGER | 0 once a completed sync no longer returns it |
| `raw_json` | TEXT | The search record as returned, as evidence |

An agent is **eligible** for discovery only when `listed = 1`, `ans_status = 'ACTIVE'`, and `expires_at` is in the future. ANS can report `ACTIVE` after expiry, so status alone is not enough. Discovery shows at most one registration per host: the eligible one with the latest `ans_indexed_at`.

Registry rows are never deleted, because saved workflows reference them.

### `registry_endpoints`

Every endpoint ANS lists for an agent, including non-A2A ones. Only `A2A` endpoints are used for discovery and execution.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK | |
| `agent_id` | TEXT FK → `registry_agents` | |
| `position` | INTEGER | Order in the ANS response |
| `protocol` | TEXT | `A2A`, `HTTP-API`, `MCP`, … |
| `url` | TEXT | `agentUrl`; HTTPS only |
| `metadata_url` | TEXT | `metaDataUrl` resolved against `url` when relative; null if absent or invalid |
| `documentation_url` | TEXT | Null when absent |
| `transports` | TEXT (JSON array) | Empty array when ANS omits it |

Unique on `(agent_id, protocol, url)`. A sync replaces an agent's endpoints and functions in the same transaction as the agent upsert.

### `registry_functions`

Skills as ANS reports them, per endpoint.

| Column | Type | Notes |
| --- | --- | --- |
| `endpoint_id` | INTEGER FK → `registry_endpoints` | |
| `function_id` | TEXT | e.g. `summarize-content` |
| `name` | TEXT | |
| `tags` | TEXT (JSON array) | Empty array when absent |

Primary key `(endpoint_id, function_id)`.

### `agent_cards`

The latest fetch of an agent's card. Cards are fetched only for agents that appear as discovery candidates, then reused for 6 hours, instead of fetching thousands of cards during every sync.

| Column | Type | Notes |
| --- | --- | --- |
| `agent_id` | TEXT PK FK → `registry_agents` | |
| `card_url` | TEXT | URL actually fetched |
| `fetched_at` | TEXT | |
| `status` | TEXT | `ok`, `not_found`, `unreachable`, `invalid`, or `too_large` |
| `http_status` | INTEGER | Null when no response |
| `error` | TEXT | |
| `protocol_version` | TEXT | Card `protocolVersion` |
| `raw_json` | TEXT | Null unless `status = 'ok'` |

### `card_skills`

Skills declared by a fetched card. They add descriptions and input/output modes that ANS functions lack.

| Column | Type | Notes |
| --- | --- | --- |
| `agent_id` | TEXT FK → `agent_cards` | |
| `skill_id` | TEXT | |
| `name`, `description` | TEXT | |
| `tags`, `input_modes`, `output_modes` | TEXT (JSON arrays) | |

Primary key `(agent_id, skill_id)`. Replaced whenever the card is refetched.

### `identity_checks`

Checks our application performed itself. The UI may show an agent as identity-verified only when it has a `pass` row from the last 24 hours.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK | |
| `agent_id` | TEXT FK → `registry_agents` | |
| `check_type` | TEXT | e.g. `transparency-log` |
| `checked_at` | TEXT | |
| `result` | TEXT | `pass`, `fail`, or `error` |
| `details` | TEXT (JSON) | What was compared, such as the log's status and certificate fingerprints |

### `registry_search`

FTS5 table for discovery, tokenized with `porter unicode61` so "summarize" matches "summarization".

| Column | Source |
| --- | --- |
| `agent_id` | Unindexed key |
| `display_name` | `registry_agents.display_name` |
| `description` | `registry_agents.description` |
| `functions` | Names and IDs from `registry_functions` for A2A endpoints |
| `tags` | Tags from `registry_functions` |
| `skills` | Names and descriptions from `card_skills`, when a card was fetched |

Updated in the same transaction as the rows it copies. Ranking combines FTS5 `bm25()` with `trust_score`; the exact weighting is a tuning detail, not a schema decision.

## Application tables

### `proposals`

What the server proposed for a prompt. `POST /api/agents` accepts a proposal ID plus one chosen candidate per step and is validated against this row, so the browser cannot introduce agents or endpoints the server did not offer.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | UUID |
| `prompt` | TEXT | User's description |
| `plan` | TEXT (JSON) | Validated planner output |
| `candidates` | TEXT (JSON) | Offered `agent_id` values per step |
| `status` | TEXT | `open`, `approved`, or `expired` |
| `created_at`, `expires_at` | TEXT | Open proposals expire after 1 hour |

### `composites`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | UUID; used in the agent's URL |
| `name`, `description` | TEXT | |
| `original_prompt` | TEXT | |
| `current_version_id` | INTEGER FK → `workflow_versions` | |
| `published_ans_agent_id` | TEXT | Stretch goal; null unless published |
| `created_at` | TEXT | |

A composite and its first workflow version are created in one transaction.

### `workflow_versions`

Immutable once written. A `BEFORE UPDATE` trigger aborts any update.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK | |
| `composite_id` | TEXT FK → `composites` | |
| `version` | INTEGER | Unique per composite |
| `proposal_id` | TEXT FK → `proposals` | |
| `input_schema` | TEXT (JSON) | Validated input schema |
| `ui_config` | TEXT (JSON) | Validated form configuration |
| `created_at` | TEXT | |

### `workflow_steps`

Immutable, like its version.

| Column | Type | Notes |
| --- | --- | --- |
| `workflow_version_id` | INTEGER FK → `workflow_versions` | |
| `position` | INTEGER | Execution order, from 0 |
| `step_key` | TEXT | e.g. `research`; unique per version |
| `capability` | TEXT | Catalog capability ID |
| `agent_id` | TEXT FK → `registry_agents` | |
| `adapter_id`, `adapter_version` | TEXT | Adapter used to build this step's input |
| `input_from` | TEXT | `step_key` of an earlier step, or null for the original input |
| `approved_endpoint_url` | TEXT | A2A endpoint at approval time |
| `approved_snapshot` | TEXT (JSON) | Name, ANS name, version, and trust score at approval |

Primary key `(workflow_version_id, position)`. Before a run, the orchestrator compares live ANS against `approved_endpoint_url` and `approved_snapshot`. If the agent is no longer eligible, or its endpoint or version changed, the run stops and requires review. It never switches to a different registration automatically, even for the same host.

### `runs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | UUID; used in the run's URL |
| `workflow_version_id` | INTEGER FK → `workflow_versions` | Exact version executed |
| `status` | TEXT | `queued`, `running`, `completed`, or `failed` |
| `input` | TEXT (JSON) | Submitted input |
| `final_output` | TEXT (JSON) | Null until completed |
| `error` | TEXT | |
| `created_at`, `started_at`, `finished_at` | TEXT | |

Indexed on `(workflow_version_id, created_at)`.

### `step_attempts`

Run progress is read from this table; there is no separate event log.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK | |
| `run_id` | TEXT FK → `runs` | |
| `step_position` | INTEGER | |
| `attempt` | INTEGER | 1 for the first try, incremented by each retry |
| `status` | TEXT | `queued`, `running`, `completed`, or `failed` |
| `agent_id` | TEXT FK → `registry_agents` | |
| `resolved_endpoint_url` | TEXT | Endpoint actually called |
| `resolved_snapshot` | TEXT (JSON) | Live ANS re-check used for this attempt |
| `a2a_task_id` | TEXT | Remote task reference |
| `input`, `output` | TEXT (JSON) | Output capped at 1 MB |
| `error_code`, `error_message` | TEXT | |
| `started_at`, `finished_at` | TEXT | |

Unique on `(run_id, step_position, attempt)`. A partial unique index on `run_id` where `status IN ('queued', 'running')` allows only one active attempt per run. Because runs are sequential, this also blocks simultaneous retries at the database level.

## Sync behavior

1. Startup marks any `sync_runs` row left `running` by a crash as `failed`, then starts a new sync without waiting for it.
2. The sync requests `pageSize=100`, the API maximum. ANS allows 60 requests per rate-limit window and reports `ratelimit-remaining` and `ratelimit-reset`; the sync pauses until reset when remaining reaches zero instead of triggering HTTP 429.
3. Each page is written in one transaction. A record that fails validation is skipped and counted in `records_skipped`; it never fails the page.
4. When the last page is reached, one transaction marks every listed agent not seen in this sync as `listed = 0` and completes the sync row.
5. On any failure, including an expired page cursor, the sync is marked `failed`. Rows it already wrote stay, but nothing is delisted, because an incomplete sync cannot prove an agent is gone. The next sync starts from the first page.

## Schema creation and migrations

- Migrations are numbered SQL files in `src/lib/gateways/migrations/` (`001-initial.sql`, `002-….sql`).
- On startup, before serving requests, the server applies every migration numbered above `PRAGMA user_version`, each in its own transaction that also sets `user_version`.
- An applied migration is never edited; changes go in a new file.
- Tests use an in-memory database with the same migrations. Test fixtures are never written to the `DATABASE_PATH` database.

## Deferred

- Retention for delisted agents, old sync runs, and old runs.
- Storing the full per-signal ANS trust breakdown from the single-agent endpoint.
- Backups.
- Moving to a hosted database if the chosen host cannot provide a persistent filesystem.
