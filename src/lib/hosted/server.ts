import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { hostedConfig } from './config.ts';
import { definitionSchema, type OwnedAgent } from '../owned-agent/templates.ts';

export class HostedError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export async function authenticate(request: Request) {
  const config = hostedConfig();
  if (!config) throw new HostedError(503, 'Hosted accounts are not configured yet');
  const token = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) throw new HostedError(401, 'Sign in to continue');
  const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || !data.user.email_confirmed_at) throw new HostedError(401, 'Sign in with a verified email to continue');
  return { client, userId: data.user.id };
}
export type Identity = Awaited<ReturnType<typeof authenticate>>;
const columns = 'id,definition,created_at,visibility,owner_id';
const rowSchema = z.object({ id: z.uuid(), definition: definitionSchema, created_at: z.string(), visibility: z.enum(['public', 'private']), owner_id: z.uuid() });
export function asAgent(row: unknown): OwnedAgent {
  const value = rowSchema.parse(row);
  return { ...value.definition, id: value.id, createdAt: value.created_at, visibility: value.visibility, ownerId: value.owner_id };
}
export function repository({ client, userId }: Identity) {
  return {
    async list() {
      const { data, error } = await client.from('template_agents').select(columns).eq('owner_id', userId).order('created_at', { ascending: false }).limit(100);
      if (error) throw new HostedError(503, 'Agent storage is unavailable');
      return (data ?? []).map(asAgent);
    },
    async create(input: unknown) {
      const definition = definitionSchema.parse(input);
      const { data, error } = await client.from('template_agents').insert({ owner_id: userId, definition }).select(columns).single();
      if (error) throw new HostedError(503, 'Could not save the agent');
      return asAgent(data);
    },
    async get(id: string) {
      // Not scoped to owner_id: RLS already allows the owner or any signed-in
      // user when the agent is public, which is what makes launching another
      // user's public agent possible.
      const { data, error } = await client.from('template_agents').select(columns).eq('id', id).maybeSingle();
      if (error) throw new HostedError(503, 'Agent storage is unavailable');
      if (!data) throw new HostedError(404, 'Agent not found');
      return asAgent(data);
    },
    async setVisibility(id: string, visibility: 'public' | 'private') {
      const { data, error } = await client.from('template_agents').update({ visibility }).eq('owner_id', userId).eq('id', id).select(columns).maybeSingle();
      if (error) throw new HostedError(503, 'Could not update visibility');
      if (!data) throw new HostedError(404, 'Agent not found');
      return asAgent(data);
    },
    async reserve(id: string, text: string): Promise<string> {
      const { data, error } = await client.rpc('reserve_agent_test', { target_agent: id, source_text: text });
      if (error) throw new HostedError(503, 'Could not start the test');
      if (!data) throw new HostedError(429, 'Daily test limit reached (20 attempts). Try again tomorrow UTC.');
      return z.uuid().parse(data);
    },
    async finish(id: string, status: 'completed' | 'failed', output: string) {
      const { data, error } = await client.from('agent_test_runs').update({ status, output }).eq('owner_id', userId).eq('id', id).select('id').single();
      if (error || !data) throw new HostedError(503, 'The test result could not be saved. Check history before running again.');
    },
    async history(id?: string) {
      let query = client.from('agent_test_runs').select('id,agent_id,input,status,output,created_at').eq('owner_id', userId);
      if (id) query = query.eq('agent_id', id);
      const { data, error } = await query.order('created_at', { ascending: false }).limit(20);
      if (error) throw new HostedError(503, 'Test history is unavailable');
      return data;
    },
  };
}
