import { z } from 'zod';
import { HostedError, asAgent, type Identity } from './server.ts';
import { templateFor } from '../owned-agent/templates.ts';
import { workflowRowSchema } from './workflow-contracts.ts';
import { profileRepository } from './profile.ts';
import type { PublicAgent, PublicOwner } from './discover.ts';

export const saveInputSchema = z.object({ kind: z.enum(['template', 'workflow']), agentId: z.uuid() });
const unknownOwner = (ownerId: string): PublicOwner => ({ userId: ownerId, username: 'unknown', displayName: '', avatarUrl: null });

export function savedRepository(identity: Identity) {
  const { client, userId } = identity;
  const profiles = profileRepository(identity);
  return {
    async list(): Promise<PublicAgent[]> {
      const { data, error } = await client.from('saved_agents').select('agent_kind,agent_id,created_at').eq('owner_id', userId).order('created_at', { ascending: false }).limit(100);
      if (error) throw new HostedError(503, 'Saved agents are unavailable');
      const rows = data ?? [];
      const templateIds = rows.filter((row) => row.agent_kind === 'template').map((row) => row.agent_id);
      const workflowIds = rows.filter((row) => row.agent_kind === 'workflow').map((row) => row.agent_id);
      // A bookmark whose target was deleted, or made private by someone other than
      // this viewer, simply returns no matching row here -- RLS already prevents
      // reading it, so it silently drops out of the list instead of erroring.
      const [templates, workflows] = await Promise.all([
        templateIds.length ? client.from('template_agents').select('id,definition,created_at,visibility,owner_id').in('id', templateIds) : Promise.resolve({ data: [], error: null }),
        workflowIds.length ? client.from('hosted_workflows').select('id,definition,created_at,visibility,owner_id').in('id', workflowIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (templates.error || workflows.error) throw new HostedError(503, 'Saved agents are unavailable');
      const templateAgents = (templates.data ?? []).map(asAgent).map((agent) => ({
        kind: 'template' as const, id: agent.id, name: agent.name,
        description: agent.instructions || templateFor(agent.template).description,
        createdAt: agent.createdAt, ownerId: agent.ownerId,
      }));
      const workflowAgents = (workflows.data ?? []).map((row) => workflowRowSchema.parse(row)).map((workflow) => ({
        kind: 'workflow' as const, id: workflow.id, name: workflow.definition.name,
        description: workflow.definition.description || `${workflow.definition.steps.length} connected agent${workflow.definition.steps.length === 1 ? '' : 's'}`,
        createdAt: workflow.created_at, ownerId: workflow.owner_id,
      }));
      const merged = [...templateAgents, ...workflowAgents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const owners = await profiles.byUserIds([...new Set(merged.map((agent) => agent.ownerId))]);
      return merged.map(({ ownerId, ...agent }): PublicAgent => ({ ...agent, owner: owners.get(ownerId) ?? unknownOwner(ownerId) }));
    },
    async save(input: unknown) {
      const value = saveInputSchema.parse(input);
      const { error } = await client.from('saved_agents').insert({ agent_kind: value.kind, agent_id: value.agentId });
      if (error && error.code !== '23505') throw new HostedError(503, 'Could not save this agent');
    },
    async remove(kind: 'template' | 'workflow', agentId: string) {
      const { error } = await client.from('saved_agents').delete().eq('owner_id', userId).eq('agent_kind', kind).eq('agent_id', agentId);
      if (error) throw new HostedError(503, 'Could not remove this bookmark');
    },
  };
}
export type SavedRepository = ReturnType<typeof savedRepository>;
