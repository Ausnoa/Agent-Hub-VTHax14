import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { hostedWorkflowSchema, workflowRowSchema } from '../hosted/workflow-contracts.ts';
import { HostedError, type Identity } from '../hosted/server.ts';

export const capabilityProposalSchema = z.object({ id: z.uuid(), definition: hostedWorkflowSchema, parentId: z.uuid().optional(), createdAt: z.string() });
export type CapabilityProposal = z.infer<typeof capabilityProposalSchema>;
export function capabilityRepository({ client, userId }: Identity) {
  return {
    async put(definition: unknown, parentId?: string) {
      const proposal = capabilityProposalSchema.parse({ id: randomUUID(), definition, parentId, createdAt: new Date().toISOString() });
      const { error } = await client.from('capability_proposals').insert({ id: proposal.id, owner_id: userId, body: proposal });
      if (error) throw new HostedError(503, 'Capability storage is unavailable. Apply the capability workflow migration.');
      return proposal;
    },
    async get(id: string) {
      const { data, error } = await client.from('capability_proposals').select('body').eq('id', id).eq('owner_id', userId).maybeSingle();
      if (error || !data) throw new HostedError(404, 'Proposal not found');
      return capabilityProposalSchema.parse(data.body);
    },
    async publish(id: string) {
      const { data, error } = await client.rpc('publish_capability_proposal', { proposal_id: id });
      if (error || !data) throw new HostedError(409, 'Proposal expired, incomplete, or based on an older revision. Refresh and review again.');
      return workflowRowSchema.parse(data);
    },
  };
}
