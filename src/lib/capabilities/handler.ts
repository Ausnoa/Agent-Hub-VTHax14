import { z } from 'zod';
import { gemini } from '../models/gemini.ts';
import { readBody, respond } from '../hosted/handler.ts';
import { HostedError } from '../hosted/server.ts';
import { resolveCapabilities, designInterface, defaultUI, validateUI, type CapabilityDraft, type PipelineServices } from './pipeline.ts';
import type { CapabilityProposal } from './store.ts';
import { designView } from './view-design.ts';
import { lintView } from '../agent-ui/view-bridge.ts';
import { draftSchema, type GeneralStep } from '../general/contracts.ts';

export type CapabilityContext = PipelineServices & {
  enabled: boolean;
  budget: () => Promise<void>;
  getAgent: (id: string) => Promise<CapabilityDraft>;
  put: (definition: CapabilityDraft, parentId?: string) => Promise<CapabilityProposal>;
  get: (id: string) => Promise<CapabilityProposal>;
  publish: (id: string) => Promise<unknown>;
};

export function asCapabilityDraft(value: { name: string; description?: string; steps: GeneralStep[]; capability?: CapabilityDraft['capability'] }): CapabilityDraft {
  return { ...value, description: value.description ?? '', capability: value.capability ?? { version: 1, intent: value.description || value.name, ui: defaultUI(value.name, value.steps), suggestions: [], unresolved: [], generation: 'fallback' } };
}

export async function handleCapabilities(request: Request, path: string[], context: CapabilityContext) {
  if (path.length === 1 && request.method === 'GET') return respond({ configured: context.enabled && Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL) });
  if (path[1] === 'proposal' && path.length === 3 && request.method === 'GET') return respond(await context.get(z.uuid().parse(path[2])));
  if (path[1] === 'plan' && path.length === 2 && request.method === 'POST') {
    if (!context.enabled) throw new HostedError(503, 'Capability generation is not enabled');
    const input = z.object({ description: z.string().trim().min(3).max(2000), baseId: z.uuid().optional(), proposalId: z.uuid().optional() }).refine(x => !(x.baseId && x.proposalId)).parse(await readBody(request));
    await context.budget();
    const proposal = input.proposalId ? await context.get(input.proposalId) : undefined;
    if (proposal && Date.now()-Date.parse(proposal.createdAt)>3600000) throw new HostedError(409, 'Proposal expired');
    const base = proposal ? asCapabilityDraft(proposal.definition) : input.baseId ? await context.getAgent(input.baseId) : undefined;
    const result = await resolveCapabilities(input.description, { generate: context.generate ?? gemini, search: context.search, prepare: context.prepare }, base);
    return respond(await context.put(result, proposal?.parentId ?? input.baseId), 201);
  }
  // A hand-built (or pre-capability) workflow keeps its steps; the specialists design its
  // interface, and it is published as a revision of the saved workflow.
  if (path[1] === 'adopt' && path.length === 2 && request.method === 'POST') {
    if (!context.enabled) throw new HostedError(503, 'Capability generation is not enabled');
    const { workflowId } = z.object({ workflowId: z.uuid() }).parse(await readBody(request));
    await context.budget();
    const base = await context.getAgent(workflowId);
    const generate = context.generate ?? gemini;
    const design = await designInterface({ intent: base.capability.intent, name: base.name, steps: base.steps, generate });
    const view = await designView({ intent: base.capability.intent, name: base.name, steps: base.steps, ui: design.ui, generate, base: base.capability.view });
    const { view: _previous, ...config } = base.capability;
    const draft: CapabilityDraft = { ...base, description: base.description || design.ui.description, capability: { ...config, ui: design.ui, suggestions: design.suggestions, generation: design.generation, unresolved: [], ...(view ? { view } : {}) } };
    draftSchema.parse(draft); validateUI(draft.capability.ui, draft.steps);
    return respond(await context.publish((await context.put(draft, workflowId)).id), 201);
  }
  if (path[1] === 'save' && path.length === 2 && request.method === 'POST') {
    const { proposalId } = z.object({ proposalId: z.uuid() }).parse(await readBody(request));
    const proposal = await context.get(proposalId);
    draftSchema.parse(proposal.definition);
    if (!proposal.definition.capability || proposal.definition.capability.unresolved.length) throw new HostedError(422, 'Resolve the missing capabilities before saving');
    validateUI(proposal.definition.capability.ui, proposal.definition.steps);
    // Stored proposals are rechecked: a generated app that fails lint is never published.
    if (proposal.definition.capability.view && lintView(proposal.definition.capability.view.html).length) throw new HostedError(422, 'The generated interface failed its safety checks. Generate a fresh proposal.');
    for (const step of proposal.definition.steps) {
      const current = await context.prepare(step);
      if (current.endpoint !== step.endpoint || current.metadataUrl !== step.metadataUrl) throw new HostedError(409, 'A capability changed since discovery. Generate a fresh proposal.');
    }
    return respond(await context.publish(proposalId), 201);
  }
  throw new HostedError(404, 'Capability route not found');
}
