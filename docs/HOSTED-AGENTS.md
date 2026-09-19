# Three hosted agents on one Vercel deployment

Each hostname uses `/a2a` and `/.well-known/agent-card.json`. Canonical URLs come from server environment configuration; unknown hosts return 503. All handlers are stateless and use the existing A2A 0.3 JSON-RPC `message/send` transport, text input/output, no streaming or task persistence.

| Agent | Server environment variable | Skill |
| --- | --- | --- |
| Glorria Brief | AGENT_PUBLIC_ORIGIN=https://www.gloryforglorria.us | summarize-text |
| Glorria Extract | EXTRACT_AGENT_PUBLIC_ORIGIN=https://extract.gloryforglorria.us | extract-information |
| Glorria Answers | QA_AGENT_PUBLIC_ORIGIN=https://ask.gloryforglorria.us | answer-from-reference |

Configure these on the Vercel deployment serving all three domains, plus OPENAI_API_KEY, OPENAI_MODEL, and AGENT_ENABLED=true when ready to enable inference. Production currently deploys main; domain configuration alone does not deploy this branch. Public callers are unauthenticated and inference consumes the owner's model budget; configure platform throttling and spending controls. No GoDaddy credentials belong in the hosted inference environment. Deployment previews on other hosts intentionally do not publish a canonical agent identity.

## Inputs

Extractor accepts plain source text and defaults to owner, deadline, decision. To choose fields, send:

```text
Fields: owner, deadline
Source:
Maya will send the draft Friday.
```

It returns a JSON object in a text part, with literal source values or null. Fields must be 1–12 distinct names.

Q&A requires a question and reference in the same text message:

```text
Question: Who owns the draft?
Reference:
Maya will send the draft Friday.
```

The answer includes literal reference excerpts or reports insufficient information. Literal evidence checks do not guarantee semantic correctness. Combined A2A text is limited to 12000 characters and request bodies to 32 KB.

## Workflow trial after registration and deployment

In `/general`, use **Connect a registered agent** with each actual ANS ID and the exact skill from the table. This checks real ANS resolution and the canonical card, and does not depend on local search-index freshness.

1. Add extractor with original input, text format, no instruction (default fields).
2. Add answers with previous output, text format, and instruction:

```text
Question: Who is the owner and what is the deadline?
Reference:
```

3. Validate, review destinations, approve, and run with `Maya will send the draft Friday.`
4. Expect extracted owner Maya/deadline Friday, then an answer grounded in that output. Missing decisions remain null.

A local in-process SDK test validates the transport/mapping, but is not proof of hosted reachability. Record a live workflow run with both real registrations before claiming the milestone complete. Locally created template instances remain separate, unregistered definitions.
