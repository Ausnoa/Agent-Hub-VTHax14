import { HostedError, asAgent, type Identity } from './server.ts';
import { templateFor } from '../owned-agent/templates.ts';
import { workflowRowSchema } from './workflow-contracts.ts';
import { profileRepository, type Profile } from './profile.ts';

export type PublicOwner = Pick<Profile, 'userId' | 'username' | 'displayName' | 'avatarUrl'>;
// `skill` is set only for template agents, whose single advertised skill is what a
// workflow step needs; composite workflows are not themselves an A2A skill.
export type PublicAgent = { kind: 'template' | 'workflow'; id: string; name: string; description: string; createdAt: string; owner: PublicOwner; skill?: { id: string; name: string } };
const unknownOwner = (ownerId: string): PublicOwner => ({ userId: ownerId, username: 'unknown', displayName: '', avatarUrl: null });

type Unowned = Omit<PublicAgent, 'owner'> & { ownerId: string };
async function fetchPublicAgents(client: Identity['client'], ownerId?: string): Promise<Unowned[]> {
  let templateQuery = client.from('template_agents').select('id,definition,created_at,visibility,owner_id').eq('archived',false).eq('visibility', 'public').order('created_at', { ascending: false }).limit(60);
  let workflowQuery = client.from('hosted_workflows').select('id,definition,created_at,visibility,owner_id').eq('archived',false).eq('visibility', 'public').order('created_at', { ascending: false }).limit(60);
  if (ownerId) { templateQuery = templateQuery.eq('owner_id', ownerId); workflowQuery = workflowQuery.eq('owner_id', ownerId); }
  const [templates, workflows] = await Promise.all([templateQuery, workflowQuery]);
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
  return [...templateAgents, ...workflowAgents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function discoverRepository(identity: Identity) {
  const { client } = identity;
  const profiles = profileRepository(identity);
  async function withOwners(agents: Unowned[]): Promise<PublicAgent[]> {
    const owners = await profiles.byUserIds([...new Set(agents.map((agent) => agent.ownerId))]);
    return agents.map(({ ownerId, ...agent }) => ({ ...agent, owner: owners.get(ownerId) ?? unknownOwner(ownerId) }));
  }
  return {
    async list(query: string) {
      const term = query.trim().toLowerCase();
      const agents = (await fetchPublicAgents(client)).filter((agent) => !term || `${agent.name} ${agent.description}`.toLowerCase().includes(term)).slice(0, 60);
      return withOwners(agents);
    },
    async byOwner(ownerId: string) {
      return withOwners(await fetchPublicAgents(client, ownerId));
    },
  };
}
export type DiscoverRepository = ReturnType<typeof discoverRepository>;
