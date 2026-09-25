import { z } from "zod";
import { taskSchema, type CapabilityConfig } from '../capabilities/contracts.ts';

export const selectionSchema = z.object({
  agentId: z.string().min(1).max(200), skill: z.string().min(1).max(200),
  inputFrom: z.enum(["original", "previous"]), format: z.enum(["text", "json", "audio"]),
  instruction: z.string().max(2000),
  inputStep: z.number().int().min(0).max(7).optional(),
  geminiTask: taskSchema.optional(),
});
export const draftSchema = z.object({ name: z.string().trim().min(1).max(100), steps: z.array(selectionSchema).min(1).max(8) })
  .superRefine((draft, ctx) => {
    if (draft.steps[0].inputFrom !== 'original') ctx.addIssue({ code: 'custom', message: 'First step must use original input' });
    const original = draft.steps.filter(step=>step.inputFrom==='original');
    if(original.some(step=>step.format==='audio')&&original.some(step=>step.format!=='audio'))ctx.addIssue({code:'custom',message:'An audio workflow must transcribe its source before using text capabilities'});
    for (const [index, step] of draft.steps.entries()) {
      if(step.format==='audio'&&step.inputFrom!=='original')ctx.addIssue({code:'custom',message:'Audio capabilities require original audio input'});
      if (step.inputStep !== undefined && (step.inputFrom !== 'previous' || step.inputStep >= index)) ctx.addIssue({ code: 'custom', message: 'Dependencies must reference an earlier step' });
      if (step.geminiTask && (step.agentId !== `gemini:${step.geminiTask}` || step.skill !== step.geminiTask || step.format !== (step.geminiTask === 'transcribe' ? 'audio' : 'text'))) ctx.addIssue({ code: 'custom', message: 'Invalid Gemini capability binding' });
      if (step.agentId.startsWith('gemini:') && !step.geminiTask) ctx.addIssue({ code: 'custom', message: 'Gemini task contract required' });
    }
  });
export const MAX_AUDIO_BYTES = 1_000_000;
export const audioSchema = z.object({ type: z.literal('audio'), mimeType: z.enum(['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/mp4']), value: z.string().min(4).max(1_333_336).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/) });
export const valueSchema = z.union([z.object({ type: z.literal("text"), value: z.string().max(24000) }),
  z.object({ type: z.literal("json"), value: z.record(z.string(), z.unknown()) }), audioSchema])
  .refine((value) => value.type === 'audio' ? value.value.length * 3 / 4 - (value.value.endsWith('==') ? 2 : value.value.endsWith('=') ? 1 : 0) <= MAX_AUDIO_BYTES : JSON.stringify(value).length <= 24000, 'Payload exceeds its size limit');
export type Value = z.infer<typeof valueSchema>;
export type Selection = z.infer<typeof selectionSchema>;
export type GeneralStep = Selection & { endpoint: string; metadataUrl: string; name: string };
export type GeneralWorkflow = { id: string; version: 1; name: string; createdAt: string; steps: GeneralStep[]; identity: "not-verified"; capability?: CapabilityConfig; revision?: { rootId: string; parentId?: string; number: number } };
export type GeneralRun = { id: string; workflowId: string; input: Value; status: "queued" | "running" | "completed" | "failed";
  createdAt: string; outputs: Value[]; error?: string; activeStep?: number };

export function mapInput(step: Selection, original: Value, previous?: Value, outputs: Value[] = []): Value {
  const source = step.inputFrom === "original" ? original : step.inputStep === undefined ? previous : outputs[step.inputStep];
  if (!source) throw new Error("Previous step has no output");
  if (step.format === 'audio') {
    if (source.type !== 'audio') throw new Error('This capability requires audio input');
    return valueSchema.parse(source);
  }
  if (source.type === 'audio') throw new Error('Audio must be transcribed before a text capability can use it');
  if (step.format === "text") return valueSchema.parse({ type: "text", value: [step.instruction, source.type === "text" ? source.value : JSON.stringify(source.value)].filter(Boolean).join("\n\n") });
  if (source.type !== "json") throw new Error("JSON mapping requires structured data; choose text or an agent returning JSON");
  if (step.instruction) throw new Error("JSON mapping forwards the object unchanged; instructions must be empty");
  return valueSchema.parse(source);
}
