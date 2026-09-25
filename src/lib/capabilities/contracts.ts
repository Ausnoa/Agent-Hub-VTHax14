import { z } from 'zod';

export const taskKinds = ['summarize', 'flashcards', 'quiz', 'extract', 'classify', 'transform', 'answer', 'transcribe'] as const;
export const taskSchema = z.enum(taskKinds);
export type TaskKind = z.infer<typeof taskSchema>;
export const panelSchema = z.object({ step: z.number().int().min(0).max(7), title: z.string().min(1).max(80), component: z.enum(['text', 'table', 'flashcards', 'quiz']), description: z.string().max(200).optional() });
/** Supporting sections the renderer implements natively. Specialists may only choose from this list. */
export const extraKinds = ['history', 'export', 'capabilities'] as const;
// Fields after panels are optional so interfaces saved before they existed stay valid.
export const interfaceSchema = z.object({ title: z.string().min(1).max(100), description: z.string().max(300), layout: z.enum(['tabs', 'stack', 'columns']), inputLabel: z.string().min(1).max(100), actionLabel: z.string().min(1).max(80), panels: z.array(panelSchema).min(1).max(8),
  inputHint: z.string().max(200).optional(), emptyState: z.string().max(200).optional(),
  primaryPanel: z.number().int().min(0).max(7).optional().describe('Zero-based step index shown first in the compact cat window.'),
  extras: z.array(z.enum(extraKinds)).max(3).optional() });
/** Largest generated app stored with an agent; keeps hosted definitions under their 64 KB cap. */
export const VIEW_HTML_LIMIT = 34_000;
// Local shape (not general/contracts valueSchema, which imports this module): previews never carry audio.
const sampleValueSchema = z.union([z.object({ type: z.literal('text'), value: z.string().max(3000) }), z.object({ type: z.literal('json'), value: z.record(z.string(), z.unknown()) })]);
/** A Gemini-generated, sandboxed app that is the agent's whole interface (see agent-ui/view-bridge). */
export const viewSchema = z.object({
  version: z.literal(1), html: z.string().min(1).max(VIEW_HTML_LIMIT), generatedAt: z.string().max(40),
  /** Illustrative outputs for the pre-save preview only; never shown as results. */
  sample: z.array(sampleValueSchema).max(8).refine(items => JSON.stringify(items).length <= 6000, 'Sample outputs are too large'),
});
export type CapabilityView = z.infer<typeof viewSchema>;
export const capabilityConfigSchema = z.object({
  version: z.literal(1), intent: z.string().min(1).max(4000), ui: interfaceSchema,
  suggestions: z.array(z.string().min(1).max(160)).max(3),
  unresolved: z.array(z.object({ capability: z.string().max(160), reason: z.string().max(300) })).max(8),
  generation: z.enum(['specialists', 'fallback']),
  view: viewSchema.optional(),
});
export type CapabilityConfig = z.infer<typeof capabilityConfigSchema>;
export type CapabilityUI = z.infer<typeof interfaceSchema>;
export const revisionSchema = z.object({ rootId: z.uuid(), parentId: z.uuid().optional(), number: z.number().int().min(1) });
