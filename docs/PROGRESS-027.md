# Hosted Discover design parity

Matched the hosted Discover page to the local Discover layout using the existing PageShell, CardHead, TopologyGraph, registry rows, icons, status pills, and search bar. The left composition panel and right capability registry stack at the existing responsive breakpoint. Saved private agents replace the localhost-only pilot catalog. Live ANS results retain authenticated search, pagination, error feedback, and actions to add exact skills to Compose through expandable details.

No authentication, API, environment, database, or workflow execution behavior changed. Build and browser validation follow before deployment.

Production build passes. Authenticated local hosted-mode browser verified the desktop two-column design, saved-agent rows, live brewery search (20 results), and expanded Woodstock Brewery details with Answer Questions / Order Lookup actions. Deploying for final hosted navigation verification.
