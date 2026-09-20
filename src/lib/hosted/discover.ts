import { HostedError, asAgent, type Identity } from './server.ts';
import { templateFor } from '../owned-agent/templates.ts';
import { workflowRowSchema } from './workflow-contracts.ts';
import { profileRepository, type Profile } from './profile.ts';

export type PublicOwner = Pick<Profile, 'userId' | 'username' | 'displayName' | 'avatarUrl'>;
export type PublicAgent = { kind: 'template' | 'workflow'; id: string; name: string; description: string; createdAt: string; owner: PublicOwner };
const unknownOwner = (ownerId: string): PublicOwner => ({ userId: ownerId, username: 'unknown', displayName: '', avatarUrl: null });

export function discoverRepository(identity: Identity) {
  const { client } = identity;
  const profiles = profileRepository(identity);
  return {
    async list(query: string) {
      const term = query.trim().toLowerCase();
      const [templates, workflows] = await Promise.all([
        client.from('template_agents').select('id,definition,created_at,visibility,owner_id').eq('visibility', 'public').order('created_at', { ascending: false }).limit(60),
        client.from('hosted_workflows').select('id,definition,created_at,visibility,owner_id').eq('visibility', 'public').order('created_at', { ascending: false }).limit(60),
      ]);
      if (templates.error || workflows.error) throw new HostedError(503, 'Discovery is unavailable');
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
      const merged = [...templateAgents, ...workflowAgents]
        .filter((agent) => !term || `${agent.name} ${agent.description}`.toLowerCase().includes(term))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 60);
      const owners = await profiles.byUserIds([...new Set(merged.map((agent) => agent.ownerId))]);
      return merged.map(({ ownerId, ...agent }): PublicAgent => ({ ...agent, owner: owners.get(ownerId) ?? unknownOwner(ownerId) }));
    },
  };
}
export type DiscoverRepository = ReturnType<typeof discoverRepository>;
