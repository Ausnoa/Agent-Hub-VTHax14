import { randomUUID } from "node:crypto";
import { resolveAgent } from "../ans/client.ts";
import { inspectGeneral, invokeGeneral } from "./client.ts";
import { draftSchema, mapInput, type GeneralRun, type GeneralStep, type GeneralWorkflow } from "./contracts.ts";
import type { GeneralStore } from "./store.ts";

export async function prepareGeneral(input: unknown, resolve = resolveAgent, inspect = inspectGeneral): Promise<GeneralWorkflow> {
  const draft = draftSchema.parse(input);
  const steps: GeneralStep[] = [];
  for (const selection of draft.steps) {
    if (selection.format === "json" && selection.instruction) throw new Error("JSON mappings cannot include text instructions");
    const agents = await resolve(selection.agentId);
    let selected: GeneralStep | undefined;
    for (const agent of agents) {
      if (agent.ansId !== selection.agentId || !agent.metadataUrl) continue;
      const step = { ...selection, endpoint: agent.endpoint, metadataUrl: agent.metadataUrl, name: agent.name };
      try { await inspect(step); selected = step; break; } catch { continue; }
    }
    if (!selected) throw new Error(`No supported, reachable card for skill ${selection.skill}. Requires public unauthenticated A2A 0.3 JSON-RPC with matching text/JSON modes.`);
    steps.push(selected);
  }
  return { id: randomUUID(), version: 1, name: draft.name, createdAt: new Date().toISOString(), steps, identity: "not-verified" };
}

export async function executeGeneral(store: GeneralStore, run: GeneralRun, invoke = invokeGeneral, resolve = resolveAgent) {
  try {
    const workflow = store.get(run.workflowId, true);
    if (!workflow) throw new Error("Approved workflow missing");
    for (const [index, step] of workflow.steps.entries()) {
      run.activeStep = index; store.update(run);
      const fresh = await resolve(step.agentId);
      if (!fresh.some((agent) => agent.ansId === step.agentId && agent.endpoint === step.endpoint && agent.metadataUrl === step.metadataUrl)) throw new Error("Agent registration changed; rebuild and review");
      const input = mapInput(step, run.input, run.outputs.at(-1));
      run.outputs.push(await invoke(step, input)); store.update(run);
    }
    run.status = "completed";
  } catch (error) {
    run.status = "failed"; run.error = error instanceof Error && error.name !== "ZodError" ? error.message.slice(0, 300) : "Unsupported agent response";
  }
  store.update(run);
}
