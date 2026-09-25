import { getOwned } from "../owned-agent/store.ts";
import { templateFor } from "../owned-agent/templates.ts";
import { runDefinition } from "../owned-agent/run.ts";
import { randomUUID } from "node:crypto";
import { resolveAgent } from "../ans/client.ts";
import { inspectGeneral, invokeGeneral } from "./client.ts";
import { draftSchema, mapInput, type GeneralRun, type GeneralStep, type GeneralWorkflow } from "./contracts.ts";
import type { GeneralStore } from "./store.ts";
import { executeTask } from '../capabilities/tasks.ts';

export async function prepareGeneral(input: unknown, resolve = resolveAgent, inspect = inspectGeneral): Promise<GeneralWorkflow> {
  const draft = draftSchema.parse(input);
  const steps: GeneralStep[] = [];
  for (const selection of draft.steps) {
    if (selection.format === "json" && selection.instruction) throw new Error("JSON mappings cannot include text instructions");
    if (selection.geminiTask) {
      steps.push({ ...selection, name: selection.geminiTask, endpoint: selection.agentId, metadataUrl: selection.agentId });
      continue;
    }
    if (selection.agentId.startsWith("owned:")) {
      const agent = getOwned(selection.agentId);
      if (!agent || templateFor(agent.template).skill !== selection.skill || selection.format !== "text") throw new Error("Created agent or text skill is unavailable");
      steps.push({ ...selection, endpoint: agent.id, metadataUrl: agent.id, name: agent.name });
      continue;
    }
    const agents = await resolve(selection.agentId);
    let selected: GeneralStep | undefined;
    const failures: string[] = [];
    for (const agent of agents) {
      if (agent.ansId !== selection.agentId) continue;
      if (!agent.metadataUrl) { failures.push("Registry provides no usable card URL"); continue; }
      const step = { ...selection, endpoint: agent.endpoint, metadataUrl: agent.metadataUrl, name: agent.name };
      try { await inspect(step); selected = step; break; } catch (error) {
        failures.push(error instanceof Error && error.name !== "ZodError" ? error.message.slice(0, 140) : "Card schema or protocol is unsupported (requires A2A 0.3.0)");
      }
    }
    if (!selected) throw new Error(`Cannot use ${selection.skill}: ${[...new Set(failures)].slice(0, 2).join("; ") || "No active registration resolved"}. Choose another agent; execution was not started.`);
    steps.push(selected);
  }
  return { id: randomUUID(), version: 1, name: draft.name, createdAt: new Date().toISOString(), steps, identity: "not-verified" };
}

export async function executeGeneral(store: GeneralStore, run: GeneralRun, invoke = invokeGeneral, resolve = resolveAgent, runOwned = runDefinition, runCapability = executeTask) {
  try {
    const workflow = store.get(run.workflowId, true);
    if (!workflow) throw new Error("Approved workflow missing");
    for (const [index, step] of workflow.steps.entries()) {
      run.activeStep = index; store.update(run);
      if (step.geminiTask) {
        draftSchema.parse({ name: workflow.name, steps: workflow.steps });
        run.outputs.push(await runCapability(step.geminiTask, mapInput({ ...step, instruction: '' }, run.input, run.outputs.at(-1), run.outputs), step.instruction));
        store.update(run); continue;
      }
      if (step.agentId.startsWith("owned:")) {
        const agent = getOwned(step.agentId);
        if (!agent || step.endpoint !== agent.id || step.metadataUrl !== agent.id || step.skill !== templateFor(agent.template).skill || step.format !== "text") throw new Error("Created agent configuration no longer matches");
        const input = mapInput(step, run.input, run.outputs.at(-1), run.outputs);
        run.outputs.push({ type: "text", value: await runOwned(agent, String(input.value)) });
        store.update(run); continue;
      }
      const fresh = await resolve(step.agentId);
      if (!fresh.some((agent) => agent.ansId === step.agentId && agent.endpoint === step.endpoint && agent.metadataUrl === step.metadataUrl)) throw new Error("Agent registration changed; rebuild and review");
      const input = mapInput(step, run.input, run.outputs.at(-1), run.outputs);
      run.outputs.push(await invoke(step, input)); store.update(run);
    }
    run.status = "completed";
  } catch (error) {
    run.status = "failed"; run.error = error instanceof Error && error.name !== "ZodError" ? error.message.slice(0, 300) : "Unsupported agent response";
  }
  store.update(run);
}
