import { invokeAgent } from "../a2a/client.ts";
import { reportSchema, type Composite, type Run, type SelectedAgent, type WorkflowState } from "../contracts/index.ts";
import { Store } from "../persistence/store.ts";
import { resolveAgent } from "../ans/client.ts";

export async function executeRun(store: Store, run: Run, invoke = invokeAgent) {
  const composite = store.document<Composite>("agent", run.agentId);
  if (!composite) { run.status = "failed"; run.error = "Saved workflow not found"; store.saveRun(run); return; }
  const state: WorkflowState = { originalInput: run.input, previousOutput: null, results: {} };
  for (const step of composite.steps) {
    const completed = run.attempts.find((attempt) => attempt.capability === step.capability && attempt.status === "completed");
    if (completed?.output) {
      state.previousOutput = completed.output; state.results[step.capability] = completed.output; continue;
    }
    const attempt: Run["attempts"][number] = { capability: step.capability, attempt: run.attempts.filter((item) => item.capability === step.capability).length + 1, status: "running", startedAt: new Date().toISOString() };
    run.attempts.push(attempt);
    store.saveRun(run);
    try {
      let selected: SelectedAgent = step;
      if (step.source === "ans") {
        const fresh = await resolveAgent(step.ansId);
        const matched = fresh.find((agent) => agent.endpoint === step.endpoint && agent.metadataUrl === step.metadataUrl);
        if (!matched) throw new Error("Agent endpoint changed or is no longer active. Create a new reviewed workflow.");
        selected = { ...step, endpoint: matched.endpoint };
      }
      const output = reportSchema.parse(await invoke(selected, state));
      if (composite.mode === "live" && output.fixture) throw new Error("A live agent returned fixture data");
      state.previousOutput = output; state.results[step.capability] = output;
      attempt.output = output; attempt.status = "completed";
    } catch (error) {
      attempt.status = "failed";
      attempt.error = error instanceof Error && error.name !== "ZodError" ? error.message.slice(0, 300) : "Agent output did not match the report contract";
      run.error = attempt.error; run.status = "failed";
    }
    attempt.completedAt = new Date().toISOString();
    store.saveRun(run);
    if (run.status === "failed") return;
  }
  run.status = "completed"; run.output = state.previousOutput ?? undefined; store.saveRun(run);
}
