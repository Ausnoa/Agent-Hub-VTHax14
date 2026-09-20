# ANS showcase and judge demo

Added a prominent three-agent showcase to Dashboard and Discover, reusing the cat artwork with distinct colors. Each card links to its ANS transparency entry and public A2A card, offers an example and a workflow starting point, and reports a separate live-card check. A fixed-host, read-only health route validates advertised endpoint, protocol, and skill with short timeouts. It does not claim certificate verification or model health.

The prepared fictional brewery-menu demo loads Extract → Brief → Answers into the existing reviewed Compose flow. Brief consumes extraction output; Answers consumes the original menu so evidence is not lost. Each agent can also be tried independently. Opening cards does not save or execute anything. Existing compatibility checks, authenticated budgets, execution confirmation, persistence, graph status, and result panels remain in use. No new migration or environment variables.

Regression test validates exact registered skills and preservation of original reference text. Build and live A2A/browser validation follow.

Validation: all 80 tests and production build pass. Browser inspected the three-card desktop showcase, live-card statuses, and all three prepared Compose steps. Live A2A smoke invoked all three public agents after registry resolution/compatibility checks: Extract returned menu facts, Brief summarized them, Answers returned reference excerpts for Orchard Cider and 9 PM. The synthetic input contains no user data. Health checks remain clearly distinct from this one-time inference verification.
