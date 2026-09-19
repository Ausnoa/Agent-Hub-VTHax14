# Milestone 012 — Correct the composition entry point

The stock-workflow error came from `/create` calling the legacy report-only proposal API even when ANS mode was selected. The general builder existed but was only a secondary link.

`/create` now defaults to General workflow, hands the user's description to `/general` through per-tab session storage, and does not invoke the report planner on that path. LLM suggestions remain an explicit button in the general builder. Report pilot/offline modes remain available and clearly labeled. Existing legacy API workflows are preserved; no allowlist or compatibility gates were weakened.

This fixes the wrong three-capability error, not a guarantee that any particular stock-analysis agent is reachable or supported. No external task is executed by navigation.
