# Hosted workspace error state

Confirmed on the production domain: GET /api/agents and /api/catalog return HTTP 403 with the intended local-workspace-only restriction. Fleet and registry UI mounted anyway and replaced that explanation with generic load failures.

Added a shared presentation boundary in the app layout. On non-workspace hostnames, local-only pages do not mount and cannot issue their initial API requests. A hosted-preview page explains that saved agents, registry browsing, composition, and execution need the local workspace; links lead to the existing template preview. Localhost/127.0.0.1 pages retain normal behavior. This is a UX correction, not hosted persistence or authentication. API authorization and public A2A routes are unchanged.

Validation: production build/typecheck passed. Browser test on an IPv6 loopback hostname (classified as non-workspace by the existing API policy) confirmed fleet and discovery show the explanation without load-error alerts, and template navigation remains available with creation disabled. No public storage, empty fake fleet, or access-control bypass was introduced.
