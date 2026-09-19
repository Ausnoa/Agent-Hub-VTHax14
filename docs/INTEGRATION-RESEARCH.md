# Integration findings — September 19, 2026

## ANS

The [official agent API reference](https://developer.godaddy.com/en/docs/references/rest/ans/agents) documents a registered-agent list operation, query filters, endpoint metadata, and pagination. The initial probe follows that operation and locally excludes inactive or non-A2A endpoints.

Discovery is not an application-performed identity check. Normalized results explicitly remain unverified. The probe never follows registry-provided URLs or sends registry credentials to agents.

The [API introduction](https://developer.godaddy.com/en/docs/api-users) names the production API origin. Access and authentication requirements must still be validated against the actual hackathon environment. Do not assume the example server URLs in generated reference examples are deployable services.

## A2A

The [official JavaScript SDK](https://github.com/a2aproject/a2a-js) supports clients and servers and documents current protocol compatibility. Pin a released version after inspecting actual candidate agent cards. Do not assume an older tutorial's methods match the selected release.

## Remaining integration gate

Public registry access was confirmed with HTTP 200, and the implemented search probe succeeded without credentials. Registration access remains untested. Next, inspect actual agent cards, select compatible transports, and invoke two independently running agents. Until then, the Phase 1 acceptance criterion remains incomplete.
