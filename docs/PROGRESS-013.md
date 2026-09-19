# Milestone 013 — Prevent incompatible planner suggestions

Diagnosis: Agent Harbor (`e53daa73-280b-4d35-af08-6bf291531afa`) resolves without a usable metadata URL and advertises STREAMABLE-HTTP. Domain Impact Analyzer (`f406507d-2185-4d34-b667-95eac772f2af`) also advertises STREAMABLE-HTTP and fails the A2A 0.3 card check; its actual purpose is domain-takedown impact, not stock analysis.

The suggestion planner received only IDs and skill names, without domain descriptions, and did not filter transport/card availability. Fix those selection inputs and expose concrete preparation failures without weakening protocol/network checks. No public agent tasks were invoked.
