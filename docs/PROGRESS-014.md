# Milestone 014 — Available-agent browser

Add a paginated browser of fresh, active registry endpoints with card URLs and supported JSON-RPC transport. Do not call them verified or executable until a selected skill/format passes live card checks. Card checks do not invoke tasks. Link compatible selections into the general builder; preserve all runtime checks.

Implemented `/available`, searchable/paginated gateway queries, text/JSON selection, explicit per-skill card checks with failure reasons, and transfer to a new general workflow. Added navigation links. Checks re-resolve the registration and show the actual checked endpoint; they do not create workflows or invoke agents. Approval and runtime validation remain required. Check results are session-local, not permanent trust certifications.

Typecheck and targeted registry/general tests pass. Added a regression test for transport/card exclusion, skill search, and pagination.

Production build passed. Browser verification displayed the first 20 candidate endpoints, skills, format selector, compatibility buttons, and pagination with honest incomplete-sync and identity labels.
