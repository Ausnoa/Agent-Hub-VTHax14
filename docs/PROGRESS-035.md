# Fix output-limit failures and split the model by task

Running a workflow failed on its first step with `Model generation unavailable (output-limit)`, intermittently, including on a two-step meeting-notes workflow.

## Cause

`OPENAI_MODEL` is `gpt-5-nano`, a reasoning model. Reasoning tokens are spent from `max_output_tokens` before any answer is emitted, and every call in `structuredPlan` was capped at 4000. Measured against the real summary task on ~1500 characters of input: 1984 reasoning tokens and 2307 total output tokens in 13.3 seconds — over half the budget consumed before the answer began. Reasoning length varies per call, so denser input crosses the cap and returns `status: incomplete`, `incomplete_details.reason: max_output_tokens`.

The same cause produced a second symptom: the A2A transport deadline was 20 seconds (`src/lib/a2a/network.ts`) while `invokeGeneral` already allowed 60. Agent steps measured 10–14 seconds, so a slightly slower call was cut off mid-generation and reported as a timeout.

## Change

- `max_output_tokens` raised 4000 to 12000 at all five call sites.
- A2A transport deadline raised 20s to 45s, within the 60s `invokeGeneral` budget and consistent with the documented 60-second task deadline.
- `OPENAI_REASONING_EFFORT` (optional): sent only when set, since non-reasoning models reject the field. Unset preserves existing behavior.
- `OPENAI_PLANNER_MODEL` (optional): `structuredPlan` accepts a model override, and only `suggestHosted` passes one. Unset means the planner uses `OPENAI_MODEL`.

## Why the model is split rather than simply swapped

Measured on the real code paths, same input:

| Model | extract | summary | Q&A | planner format correct |
| --- | --- | --- | --- | --- |
| gpt-5-nano | 9.9s / 13.1s | 13.8s | 10.0s | 2 of 3 |
| gpt-4.1-mini | 1.4s / 1.3s | 2.6s | 1.9s | 0 of 3 |
| gpt-4.1 | 0.7s / 0.6s | 1.7s | 1.2s | 0 of 3 |

The agent tasks are literal extraction and summarizing; the faster models pass the verbatim-excerpt check in `run.ts` and return `null` for absent fields exactly as the reasoning model does. Composing a workflow is the one task that needs reasoning: the faster models always chose `json` for the extractor's input format, which fails the compatibility check. Hence fast model for agents, reasoning model for the planner. `gpt-5-mini` returns HTTP 404 on this account and was not an option.

Lowering reasoning effort was tested and rejected: at `effort: low` the extractor paraphrases instead of quoting, failing `run.ts`'s requirement that every value be a literal source substring. That check is the anti-hallucination guarantee and is not worth trading for latency.

## Deployment

Set on the deployment, which serves both the app and the three public agents:

```
OPENAI_MODEL=gpt-4.1-mini
OPENAI_PLANNER_MODEL=gpt-5-nano
```

Verified after the change with that pairing: extractor 2.0s, summarizer 2.2s (from 13.4s and 9.4s), absent fields still `null`, and the planner still drafting an all-text three-agent workflow that passes the live compatibility check. `npm run typecheck`, all 84 tests, and `npm run build` pass.
