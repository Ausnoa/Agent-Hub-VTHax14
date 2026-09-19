# Site-owned workflows using the main index

Composed workflows are saved and reused on this site. Nothing registers them with ANS.

1. Run `npm run registry:sync` to refresh the main registry in `COMPOSER_DB`. The pilot seed command is separate and is no longer the source for ANS-mode composition.
2. Test candidate endpoints against the structured report contract, A2A 0.3.0 JSON-RPC, and exact capability IDs (`company-research`, `risk-analysis`, `summarization`). Registration, descriptive text, and trust scores do not establish compatibility.
3. Put tested IDs in the capability-to-ID-array `COMPATIBLE_AGENTS_JSON` mapping in ignored `.env.local`, then restart the web app. Never add arbitrary agents merely to bypass a blocker.
4. Select ANS mode, generate and approve a plan, and run it. Approval saves a site-owned composite; invocation queues work for `npm run worker`.

An empty, stale, incompatible, or unreachable selection returns a blocker instead of silently using fixtures. Pilot/demo mode remains available when explicitly selected. Identity is still unverified; public deployment and accounts are outside this milestone.

The main gateway currently searches up to 50 ranked registrations per capability. Broader candidate pagination and additional report adapters can be added separately.
