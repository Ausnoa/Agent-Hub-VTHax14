import { z } from 'zod';
import { authenticate, HostedError } from './server.ts';
import { readBody, respond, checkOrigin } from './handler.ts';
import { profileRepository, usernameSchema } from './profile.ts';

export const profileDependencies = { authenticate, profiles: profileRepository };
export async function handleProfileApi(request: Request, path: string[], deps = profileDependencies) {
  try {
    checkOrigin(request);
    const identity = await deps.authenticate(request);
    const profiles = deps.profiles(identity);
    if (path.length === 1 && path[0] === 'profile') {
      if (request.method === 'GET') return respond(await profiles.me());
      if (request.method === 'POST') return respond(await profiles.update(await readBody(request)));
    }
    if (path.length === 3 && path[0] === 'profiles' && path[1] === 'by-id' && request.method === 'GET') {
      const targetUserId = z.uuid().parse(path[2]);
      const owners = await profiles.byUserIds([targetUserId]);
      const owner = owners.get(targetUserId);
      if (!owner) throw new HostedError(404, 'Profile not found');
      return respond(owner);
    }
    if (path.length === 2 && path[0] === 'profiles' && request.method === 'GET') {
      const username = usernameSchema.parse(path[1]);
      return respond(await profiles.byUsername(username));
    }
    throw new HostedError(404, 'Route not found');
  } catch (error) {
    if (error instanceof HostedError) return respond({ error: error.message }, error.status);
    if (error instanceof z.ZodError) return respond({ error: 'Invalid profile data' }, 400);
    return respond({ error: 'Profile request could not be completed' }, 503);
  }
}
