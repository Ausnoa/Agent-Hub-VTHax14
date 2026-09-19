import { z } from "zod";

export const selectionSchema = z.object({
  agentId: z.string().min(1).max(200), skill: z.string().min(1).max(200),
  inputFrom: z.enum(["original", "previous"]), format: z.enum(["text", "json"]),
  instruction: z.string().max(2000),
});
export const draftSchema = z.object({ name: z.string().trim().min(1).max(100), steps: z.array(selectionSchema).min(1).max(8) })
  .refine((draft) => draft.steps[0].inputFrom === "original", "First step must use original input");
export const valueSchema = z.union([z.object({ type: z.literal("text"), value: z.string().max(24000) }),
  z.object({ type: z.literal("json"), value: z.record(z.string(), z.unknown()) })])
  .refine((value) => JSON.stringify(value).length <= 24000, "Payload exceeds 24 KB");
export type Value = z.infer<typeof valueSchema>;
export type Selection = z.infer<typeof selectionSchema>;
export type GeneralStep = Selection & { endpoint: string; metadataUrl: string; name: string };
export type GeneralWorkflow = { id: string; version: 1; name: string; createdAt: string; steps: GeneralStep[]; identity: "not-verified" };
export type GeneralRun = { id: string; workflowId: string; input: Value; status: "queued" | "running" | "completed" | "failed";
  createdAt: string; outputs: Value[]; error?: string; activeStep?: number };

export function mapInput(step: Selection, original: Value, previous?: Value): Value {
  const source = step.inputFrom === "original" ? original : previous;
  if (!source) throw new Error("Previous step has no output");
  if (step.format === "text") return valueSchema.parse({ type: "text", value: [step.instruction, source.type === "text" ? source.value : JSON.stringify(source.value)].filter(Boolean).join("\n\n") });
  if (source.type !== "json") throw new Error("JSON mapping requires structured data; choose text or an agent returning JSON");
  if (step.instruction) throw new Error("JSON mapping forwards the object unchanged; instructions must be empty");
  return valueSchema.parse(source);
}
