# Template builder and owned-agent workflows

User requested three templates in place of the preloaded preview, a real ANS registration attempt, and eventual orchestration of user-created agents in the existing general workflow builder.

Plan: immutable saved named agents with summary, extraction, and reference-Q&A templates; test inputs; local persistent storage; add-to-workflow handoff; owned-agent resolution/invocation in the existing sequential runtime. Keep remote ANS agents on their existing validation path. Local created agents are explicitly unregistered, not fixtures or verified public identities. Local saving uses the existing guarded workspace API; hosted multi-user persistence/accounts remain separate work.

Registration preflight: ANS CLI installed; no usable ANS_API_KEY or sso-key pair found in .env/.env.local (values not printed). User asked to supply a local credential location and confirm DNS availability. System DNS lookup failed for www.gloryforglorria.us, while dig returned a Vercel CNAME/IPs; investigate this separately from domain ownership. Do not submit duplicate registrations or claim ACTIVE without verification.
