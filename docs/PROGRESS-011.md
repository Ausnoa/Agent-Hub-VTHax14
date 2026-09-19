# Milestone 011 — General A2A workflows

## Pre-implementation checkpoint

Add a separate versioned general-workflow path while retaining the report demo and saved report workflows. Support 1–8 sequential steps with arbitrary advertised skill IDs, explicit original/previous input mapping, text or JSON payloads, and bounded text/data outputs. Agents must expose public HTTPS, unauthenticated A2A 0.3 JSON-RPC cards. Unsupported authentication, files, streaming, and protocols fail closed.

General workflows remain site-owned. Require server-side discovery/card checks, review before saving, and explicit confirmation before sending inputs to external agents. Do not automatically invoke discovered services, auto-retry uncertain side effects, or claim ANS cryptographic identity verification. Persist queue state through the existing worker lease. Add UI, tests, and documented checkpoints.

## Backend checkpoint

Implemented separate proposal/approval/run APIs and durable storage, 1–8 arbitrary-skill steps, original/previous mappings, public unauthenticated A2A 0.3 text/JSON invocation, bounded outputs, runtime registration/card rechecks, and worker recovery without automatic retries. First step must use original input; JSON forwards an object unchanged, while text can prepend instructions. Mixed/file outputs fail explicitly. Existing report APIs and persistence are untouched.

Typecheck and eight targeted tests pass. Four-step execution is validated with injected synthetic responses, not a live public agent. UI and broader validation follow this checkpoint.

## Interface and planner

Added `/general` with discovery, arbitrary-skill step selection, explicit mappings, card-check proposal review, site-owned saved workflows, external-execution confirmation, and persisted output polling. `/create` links to it. Added constrained LLM draft suggestions using discovered skill IDs and shared structured-output plumbing; the model cannot supply endpoints or bypass card checks. Removed the misleading global "ANS Verified" label.

All 30 tests, typecheck, and production build pass. The general four-step test uses synthetic injected responses; no public task was invoked and no live success is claimed. See `GENERAL-WORKFLOWS.md` for the exact compatibility subset and remaining limitations. Planner request format follows the official structured outputs documentation: https://developers.openai.com/api/docs/guides/structured-outputs.

Browser validation found `Increole Translation Customer Support Agent` and its `answer-questions` skill. Its live registration/card passed the general text-mode checks and produced a reviewable endpoint without invoking a task. This demonstrates a compatible card outside the old three-skill report filter, not verified identity or successful task execution. Added an SDK-level mocked text-response test and authentication rejection test; all four general tests pass. The new LLM suggestion path was typechecked but has not been live-model validated in this milestone.
