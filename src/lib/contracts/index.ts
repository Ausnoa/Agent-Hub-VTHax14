import { z } from "zod";
import type { ReportForm } from "./ui.ts";

export const capabilities = ["company-research", "risk-analysis", "summarization"] as const;
export const capabilitySchema = z.enum(capabilities);
export type Capability = z.infer<typeof capabilitySchema>;
export const inputSchema = z.object({ company: z.string().trim().min(1).max(120), notes: z.string().trim().min(1).max(12000) });
export const reportSchema = z.object({
  company: z.string(), facts: z.array(z.string()), risks: z.array(z.string()), summary: z.string(),
  sources: z.array(z.string()), fixture: z.boolean(),
});
export type Report = z.infer<typeof reportSchema>;
export const stateSchema = z.object({
  originalInput: inputSchema,
  previousOutput: reportSchema.nullable(),
  results: z.record(z.string(), reportSchema),
});
export type WorkflowState = z.infer<typeof stateSchema>;
export const selectedAgentSchema = z.object({
  ansId: z.string(), name: z.string(), endpoint: z.string().url(), metadataUrl: z.string().url(),
  capability: capabilitySchema, source: z.enum(["ans", "local-fixture"]),
  identityStatus: z.literal("not-verified"), protocolVersion: z.literal("0.3.0"),
});
export type SelectedAgent = z.infer<typeof selectedAgentSchema>;
export const planSchema = z.object({
  name: z.string().min(1).max(100), description: z.string().max(500),
  capabilities: z.array(capabilitySchema).max(3), unsupported: z.array(z.string()).max(10),
});
export type Plan = z.infer<typeof planSchema>;
export const proposalSchema = z.object({
  id: z.string().uuid(), createdAt: z.string(), originalPrompt: z.string(),
  mode: z.enum(["live", "demo", "pilot"]), planner: z.enum(["llm", "demo-template"]),
  plan: planSchema, steps: z.array(selectedAgentSchema).max(3), blockers: z.array(z.string()),
});
export type Proposal = z.infer<typeof proposalSchema>;
export type Composite = Proposal & { version: 1; uiSchema?: ReportForm };
export type StepAttempt = { capability: Capability; attempt: number; status: "running" | "completed" | "failed"; startedAt: string; completedAt?: string; output?: Report; error?: string };
export type Run = {
  id: string; agentId: string; input: z.infer<typeof inputSchema>;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string; updatedAt: string; attempts: StepAttempt[]; error?: string; output?: Report;
};
