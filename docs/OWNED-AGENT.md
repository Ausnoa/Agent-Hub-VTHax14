# Glorria Brief: first owned agent

Version 1.0.0, skill `summarize-text`. Accepts 1–12000 characters of supplied text and returns a brief, key points, and explicitly stated action items. It does not browse, fetch URLs, access orders, or execute tools. Facts are not independently verified. Model output can still be inaccurate; review important summaries.

## Local and Vercel configuration

The standalone Node route `POST /a2a` and card `GET /.well-known/agent-card.json` have no SQLite or worker dependency. The rest of the app still has local-runtime requirements. Do not claim the whole composer is serverless-ready.

Required server-side environment variables:

- `AGENT_PUBLIC_ORIGIN`: canonical HTTPS origin, planned `https://www.gloryforglorria.us`. Never inferred from client Host headers.
- `AGENT_ENABLED=true`: explicitly enables inference. Defaults off; leave off on unreviewed deployments.
- `OPENAI_API_KEY` and `OPENAI_MODEL`: existing structured generation configuration. Never use NEXT_PUBLIC variables for secrets.

The Vercel project currently deploys main. This branch must be selected for a preview or merged through review before these routes exist there. No branch setting or deployment has been changed by this implementation. Configure a 60-second function duration supported by the selected plan; the upstream model request times out after 45 seconds. Input body cap is 32 KB, combined source cap 12000 characters, model output cap 4000 tokens. No automatic model retry. Inference errors return generic JSON-RPC errors without credentials/provider response bodies.

Use the actual Vercel-provided DNS target when adding www.gloryforglorria.us in Porkbun. Verify HTTPS and the card before registration. Do not guess CNAME values or change unrelated DNS records.

## Smoke request

```json
{"jsonrpc":"2.0","id":"smoke-1","method":"message/send","params":{"message":{"kind":"message","role":"user","messageId":"smoke-input-1","parts":[{"kind":"text","text":"Maya will send the draft Friday. Leo will review it Monday. Launch date remains undecided."}]}}}
```

Send with Content-Type application/json. Expect a JSON-RPC agent message with text containing both explicit actions and the unresolved launch date. Empty, file/data, malformed, and oversized inputs are rejected. Calls are independent: no conversations, task polling, streaming, or persistent storage. Tests use synthetic model outputs; live quality results are recorded separately in PROGRESS-016.

## Security and ANS registration plan

ANS proves a registration's domain/identity through its verification flow. It does not authenticate callers, impose an inference budget, or prove answer quality. The current general client only supports unauthenticated agents. Before enabling an unrestricted public deployment, configure deployment-level request throttling and a spending/monitoring policy; an in-memory serverless counter would not enforce a global limit. If private access is required, add real caller authentication and extend the general client to support it before exposure. AGENT_ENABLED=false is the rollback switch. No claim of production abuse resistance is made yet.

Keep production GoDaddy credentials and private keys local, outside source control. The inference deployment needs no GoDaddy registration key. Use the ignored `.data/ans/<host>/<version>/` directory for registration materials and a fresh directory for new keys. CLI 0.1.18 is installed. Store `ANS_API_KEY` as key:secret in the local environment; use `ANS_BASE_URL=https://api.godaddy.com`. Do not pass credentials in CLI arguments or print verbose credential-bearing logs.

Once hosting, CSR organization, and the certificate path are confirmed:

1. Generate the identity CSR and, if using ANS-managed server issuance, a server CSR for www.gloryforglorria.us and version 1.0.0.
2. Resolve TLS certificate strategy for Vercel: managed platform TLS and ANS-issued server certificates are different. Confirm a supported BYOC certificate path/renewal process or compatible certificate installation before registration. Do not assume Vercel installs the ANS-issued certificate. Registration takes exactly one server CSR or server certificate.
3. Register name `Glorria Brief`, description matching the card, endpoint `https://www.gloryforglorria.us/a2a`, metadata `https://www.gloryforglorria.us/.well-known/agent-card.json`, protocol `A2A`, transport `JSON-RPC`, and function `summarize-text:Summarize supplied text:summarization,text,action-items`. CLI transport defaults must be overridden.
4. Publish the returned ACME challenge in Porkbun and run `ans-cli verify-acme <agentId>`.
5. Publish the required returned ANS DNS records, including _ans and _ans-badge for the supplied registration flow. Follow returned names and values; publish TLSA only with the appropriate DNSSEC setup.
6. Run `ans-cli verify-dns <agentId>` and `ans-cli status <agentId>`. Save nonsecret evidence of ACTIVE; pending is not completion.
7. Discover and resolve the new ID through the existing ANS adapter, inspect the card, then build and execute a one-step general workflow. Record output and run ID. Separately verify the identity certificate/badge before claiming cryptographic verification; current app identity remains not-verified.

Production registration was accepted on September 19, 2026 using Vercel's TLS-validated public server certificate (BYOC). Registration ID: `2076c6a9-5114-42c8-8d63-c76eabcea804`; name: `ans://v1.0.0.www.gloryforglorria.us`; current recorded state: `PENDING_DNS`. Identity key, CSR, server certificate, and response are stored in ignored `.data/ans/glorria-1.0.0/`. Do not create another registration or overwrite this identity key when continuing.

The user published the correct ACME TXT challenge. First verification failed because public validating resolvers report broken DNSSEC (parent DS without a matching published DNSKEY). The user enabled Porkbun DNSSEC; DNSSEC validation recovered and ANS domain verification succeeded at 22:04 UTC on September 19. The two required ANS TXT records remain to be published (see PROGRESS-017). Challenge expires September 20, 2026 at 21:52:29 UTC. Domain validation, final ANS records, certificate lifecycle, public throttling, and hosted invocation remain acceptance gates. Public agent routes still need this branch deployed; acceptance of registration does not prove endpoint availability.

## Created template agents

`/agent-preview` now offers summary, named-field extraction, and reference Q&A templates. Save an immutable named agent, test it, then choose **Use in workflow**. `/general` also lists saved agents and runs them sequentially alongside externally discovered steps. Definitions persist in the workspace SQLite database. Extraction rejects values absent from its source; Q&A requires literal reference evidence for supported answers, but this does not guarantee semantic correctness.

Created agents currently execute locally through the model API and are explicitly unregistered. The single public Glorria Brief A2A agent above is the registration trial; individual saved agents do not yet have public A2A endpoints or ANS identities. The hosted builder requires future authenticated accounts and durable storage; existing localhost API restrictions remain in place.

References: [ANS CLI](https://github.com/agentnameservice/ans-sdk-go/blob/main/cmd/ans-cli/README.md), [ANS registration](https://github.com/agentnameservice/ans-registry/blob/main/spec/ans-1-registration.md), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
