# Decision 004 — Small replaceable pilot catalog

The current user direction is to index a handful of agents now and connect the comprehensive database later. This supersedes the full-registry background crawl scope for the current milestone.

## Scope

- A registry gateway exposes listing and capability lookup without exposing SQLite to callers.
- Seed a bounded selection from real ANS responses, preserving descriptions and discovery timestamps.
- Keep executable local test agents in a separate development catalog, never in the ANS registry table.
- Add a pilot composition mode: the real configured LLM plans capabilities and the small development catalog supplies tested A2A endpoints. The UI must state that execution uses local test services.
- Live ANS composition uses only indexed registry candidates with explicitly configured compatibility, and still re-resolves identities before execution.
- Do not pretend that a name match or registry entry proves semantic compatibility or verified identity.

## Replacement seam

Composition depends on an `AgentCatalog` interface. Replace its SQLite implementation with the future database gateway without changing planner, review, or worker contracts. No full crawl, scheduled sync, or comprehensive schema migration is introduced in this pilot.

## Configuration checkpoint

The supplied planner settings were found in the tracked example template, not `.env.local`. They were preserved in ignored `.env.local` with owner-only permissions, and the example was restored to placeholders before this checkpoint. No credentials were printed or committed.
