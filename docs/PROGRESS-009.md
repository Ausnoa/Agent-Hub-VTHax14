# Milestone 009 — Connect composition to the main registry

## Scope checkpoint

Workflows remain saved in this site's existing composite store; no ANS registration or publishing is added.

Connect ANS-mode composition to the full registry gateway while retaining explicitly selected pilot/demo modes. Preserve freshness, active/expiry filtering, compatibility allowlisting, card inspection, and runtime re-resolution. Registry text matches alone must never authorize execution.

Validation will cover the new gateway and regression suite. A real public-agent execution remains contingent on a tested report-compatible endpoint; do not substitute local fixtures silently or claim unverified execution.

## Implementation and validation

- ANS-mode composition now opens `RegistryAgentCatalog` against the main `COMPOSER_DB` registry. Pilot and offline demo keep their existing explicit local paths.
- Candidate selection uses the gateway's active, listed, unexpired search results (bounded to 50 matches), then requires a capability allowlist entry, exact declared skill, JSON-RPC transport, card URL, and last-seen age no greater than 24 hours. Existing card checks and runtime re-resolution remain in place.
- Added `npm run registry:sync` for a manual sync bounded to 60 seconds / 100 pages. Worker sync now shares the public-discovery authorization opt-in, avoiding the previously observed invalid-credential failure.
- All 24 non-port-binding tests passed, including main-registry composition, stale exclusion, explicit allowlisting, and unreachable-agent blockers. These tests use synthetic records and do not prove public endpoint compatibility.
- Production compilation succeeded with network access, but typecheck and build remain blocked by existing `src/lib/ans/ranking.ts` references to missing `AnsSkill`/`trustScore` and optional `skills`. This unrelated type mismatch was not modified.
- The local registry was empty and no compatible-agent allowlist entries were configured when inspected. No live public-agent workflow is claimed; configure a tested report-compatible endpoint before expecting ANS-mode approval to succeed.
- Manual public sync imported 8,200 records across 82 pages before its 60-second safety timeout. The sync is correctly marked failed/incomplete, retains imported rows, and does not delist unseen agents. This is not a complete registry snapshot. The worker's longer-running synchronization can finish a subsequent full refresh.
