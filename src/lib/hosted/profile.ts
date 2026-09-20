import { z } from 'zod';
import { HostedError, type Identity } from './server.ts';

export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/, 'Use 3-20 lowercase letters, numbers, or underscores');
export const profileUpdateSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().max(60).default(''),
  avatarUrl: z.string().trim().max(2000).refine((value) => value === '' || value.startsWith('https://'), 'Avatar must be an https:// URL').default(''),
  bio: z.string().trim().max(280).default(''),
});
const rowSchema = z.object({ user_id: z.uuid(), username: z.string(), display_name: z.string(), avatar_url: z.string().nullable(), bio: z.string(), created_at: z.string() });
export type Profile = { userId: string; username: string; displayName: string; avatarUrl: string | null; bio: string; createdAt: string };
export function asProfile(row: unknown): Profile {
  const value = rowSchema.parse(row);
  return { userId: value.user_id, username: value.username, displayName: value.display_name, avatarUrl: value.avatar_url, bio: value.bio, createdAt: value.created_at };
}
const columns = 'user_id,username,display_name,avatar_url,bio,created_at';

export function profileRepository({ client, userId }: Identity) {
  return {
    async me() {
      const { data, error } = await client.from('profiles').select(columns).eq('user_id', userId).maybeSingle();
      if (error) throw new HostedError(503, 'Profile is unavailable');
      if (data) return asProfile(data);
      // An account created before the profile trigger existed has no row yet. The
      // caller cannot insert one (no insert grant), so ask the definer function.
      const created = await client.rpc('ensure_profile');
      if (created.error || !created.data) throw new HostedError(404, 'Profile not found');
      return asProfile(created.data);
    },
    async update(input: unknown) {
      const value = profileUpdateSchema.parse(input);
      const { data, error } = await client.from('profiles')
        .update({ username: value.username, display_name: value.displayName, avatar_url: value.avatarUrl || null, bio: value.bio })
        .eq('user_id', userId).select(columns).single();
      if (error) {
        if (error.code === '23505') throw new HostedError(409, 'That username is taken');
        throw new HostedError(503, 'Could not save your profile');
      }
      return asProfile(data);
    },
    async byUsername(username: string) {
      const { data, error } = await client.from('profiles').select(columns).eq('username', username).maybeSingle();
      if (error) throw new HostedError(503, 'Profile is unavailable');
      if (!data) throw new HostedError(404, 'Profile not found');
      return asProfile(data);
    },
    async byUserIds(userIds: string[]) {
      if (!userIds.length) return new Map<string, Profile>();
      const { data, error } = await client.from('profiles').select(columns).in('user_id', userIds);
      if (error) throw new HostedError(503, 'Profiles are unavailable');
      return new Map((data ?? []).map(asProfile).map((profile) => [profile.userId, profile]));
    },
  };
}
export type ProfileRepository = ReturnType<typeof profileRepository>;
