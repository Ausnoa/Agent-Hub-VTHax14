import type { Composite } from "../contracts/index";
import type { GeneralWorkflow } from "../general/contracts";
import type { AgentUISpec, Primitive, PrimitiveKind } from "./spec";

// The execution layer carries text and JSON only, so these primitives are shown but disabled
// rather than pretending to work. See docs/STATUS.md for the runtime's real limits.
const UNSUPPORTED: Partial<Record<PrimitiveKind, string>> = {
  file_upload: "This runtime sends text and JSON only — no file is carried to the agents.",
  audio_recording: "No agent in this workflow advertises audio input.",
  chat: "Each run is one-shot; there is no conversation state between runs yet.",
  editor: "Outputs are read-only until an agent advertises an editable document.",
};

function primitive(kind: PrimitiveKind, label: string): Primitive {
  return UNSUPPORTED[kind] ? { kind, label, unavailable: UNSUPPORTED[kind] } : { kind, label };
}

/** Report-contract composites: the fixed company/notes form, a report, and an export. */
export function specForComposite(agent: Composite): AgentUISpec {
  const capabilities = agent.plan.capabilities as string[];
  const primitives: Primitive[] = [
    primitive("text_input", "Execution parameters"),
    primitive("results", "Report"),
    primitive("table", "Observations & risks"),
    primitive("download", "Export JSON"),
    primitive("file_upload", "Upload source"),
    primitive("audio_recording", "Record notes"),
    primitive("chat", "Ask a follow-up"),
  ];
  return {
    agentId: agent.id,
    name: agent.plan.name,
    description: agent.plan.description,
    primary: "text_input",
    primaryAction: agent.uiSchema?.submitLabel ?? "Run agent",
    primitives,
    capabilities,
    variantSeed: agent.id,
  };
}

/** General workflows: free text or JSON in, step outputs out. */
export function specForGeneralWorkflow(workflow: GeneralWorkflow): AgentUISpec {
  const json = workflow.steps.some((step) => step.format === "json");
  const primitives: Primitive[] = [
    primitive("text_input", json ? "Task input (text or JSON)" : "Task input"),
    primitive("results", "Step outputs"),
    ...(json ? [primitive("table", "Structured output")] : []),
    primitive("download", "Export outputs"),
    primitive("file_upload", "Upload source"),
    primitive("chat", "Ask a follow-up"),
  ];
  return {
    agentId: workflow.id,
    name: workflow.name,
    description: `${workflow.steps.length} chained skill${workflow.steps.length > 1 ? "s" : ""} discovered through ANS. Identity unverified.`,
    primary: "text_input",
    primaryAction: "Run workflow",
    primitives,
    capabilities: workflow.steps.map((step) => step.skill),
    variantSeed: workflow.id,
  };
}
