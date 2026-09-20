# Demo prompts

Inputs for a live demo, grounded in each feature's real format. Everything here is fictional and safe to send to the model provider and the public A2A endpoints.

Daily budgets per account (UTC): 100 ANS searches, 10 workflow suggestions, 10 new workflow runs, 20 template tests. Rehearse on a second account if you can.

## The source text

One passage drives every feature below. It is deliberately missing one fact, so the agents can show an honest "unknown" instead of inventing one.

```
VTHax Demo Day — logistics notice (fictional)
Check-in opens at 8:30 AM in the Owens Hall atrium.
Team Riverlight presents third, at 11:15 AM, on stage B.
Judging weights: 40% technical depth, 30% originality, 30% demo quality.
Lunch is vegetarian by default; label allergies at the desk.
The Wi-Fi password will be announced on the day.
```

## 1. ANS search (Find agents, on the workflow graph)

```
Glorria
```

Returns Glorria Answers, Glorria Brief and Glorria Extract as the top three live registry results, ahead of unrelated registrations. This is the shot worth pausing on: your own registered agents, discovered through the real registry, not hardcoded.

A second query that lands Glorria Brief first:

```
summarize
```

Avoid `extract information` — page one is all unrelated customer-support registrations and Glorria Extract does not appear.

## 2. Describe your workflow (suggested composition)

Search ANS for `Glorria` **first**. The planner chooses only from your saved templates plus the first page of ANS results for that query, so describing an outcome before searching leaves it nothing to pick.

Tested description:

```
Extract the exact times, locations and prices stated in a notice, write a short plain-language brief of that notice, and answer attendee questions using the original notice as the reference so every answer quotes it.
```

It drafts the three-agent topology — Glorria Extract, then Glorria Brief, then Glorria Answers — and that draft passes the live compatibility check against all three registered endpoints.

**The suggestion is not deterministic, and the raw draft does not run.** Two things must be fixed in the step list before saving, both measured, not assumed:

1. **Format.** In three runs of this description the planner chose `text` twice and `json` once. A JSON draft fails on save: either `JSON mappings must have empty instructions` or `No compatible A2A 0.3 JSON-RPC endpoint`. If any step shows JSON, set its Format dropdown to Text. Do this **before** typing instructions — changing format clears the instruction field.
2. **Instructions.** The planner emits empty instructions for this description. Accepting the draft as-is gives Extract its default fields (owner, deadline, decision — all null here), a brief summarizing nothing, and a hard failure on the third step: `Use Question: your question followed by a newline, Reference: and reference text`. Paste the two instructions from section 4 into steps 1 and 3.

A description that names the fields and question explicitly does make the planner write the instructions, but it also pushes every step to JSON, which fails the same check. Fixing two instruction boxes is the cheaper path.

Re-suggesting costs one of 10 daily suggestions; editing the steps costs nothing.

If a live suggestion is too risky in front of judges, `/create?showcase=all` (section 5) loads a correct three-agent draft deterministically.

## 3. Workflow input (running a saved workflow)

Paste the source text above as the run input. Expect extraction first, then a grounded answer.

## 4. The three public agents, invoked directly over A2A

These are the literal step instructions. Extract and Answers parse their own labelled format; Brief takes a plain instruction.

**Glorria Extract** (`extract-information`) — step instruction:

```
Fields: check-in time, presentation time, stage, wifi password
Source:
```

The Wi-Fi password comes back `null`. Say that out loud — it is the difference between an agent that reports and one that guesses.

**Glorria Brief** (`summarize-text`) — step instruction:

```
Summarize the supplied details. Do not add facts.
```

**Glorria Answers** (`answer-from-reference`) — step instruction:

```
Question: When does Team Riverlight present, and on which stage?
Reference:
```

Answers should be pointed at the original notice, not at the previous step's output, so the evidence excerpts stay checkable.

## 5. Prepared one-click demo

The brewery showcase is already wired and was verified end to end in production:

- `/create?showcase=all` — Extract → Brief → Answers, prefilled with the fictional menu
- `/create?showcase=extract`, `?showcase=brief`, `?showcase=answers` — one agent at a time
- add `&blank` to load the steps with an empty input box

## 6. Create agent (`/agent-preview`)

**Summarizer** — instructions:

```
Write a three-line brief, then list only the action items the text states.
```

**Information extractor** — fields (1–12, distinct):

```
owner, deadline, decision, location
```

**Document Q&A** — reference text: paste the source text above. Then test with:

```
What are the judging weights?
```

## 7. Agent detail "Try it" and template tests

Paste the source text. For a Q&A agent the input is the question alone; the reference comes from the saved definition.

## What to claim, and what not to

Real: the ANS discovery, the registry metadata shown, the A2A messages between three independently deployed agents, and the workflow execution.

Not real: cryptographic identity verification. Every identity is labelled unverified in the UI, and the registry entry alone proves neither compatibility nor that the service is live. Saying so before a judge asks is stronger than being asked.
