import { z } from 'zod';
import { authenticate, HostedError } from './server.ts';
import { checkOrigin, respond } from './handler.ts';
import { discoverRepository } from './discover.ts';

export const discoverDependencies = { authenticate, discover: discoverRepository };
export async function handleDiscoverApi(request: Request, path: string[], deps = discoverDependencies) {
  try {
    checkOrigin(request);
    const identity = await deps.authenticate(request);
    if (path.length === 1 && path[0] === 'discover' && request.method === 'GET') {
      const query = new URL(request.url).searchParams.get('query') ?? '';
      return respond(await deps.discover(identity).list(query.slice(0, 256)));
    }
    if (path.length === 3 && path[0] === 'discover' && path[1] === 'by-owner' && request.method === 'GET') {
      return respond(await deps.discover(identity).byOwner(z.uuid().parse(path[2])));
    }
    throw new HostedError(404, 'Route not found');
  } catch (error) {
    if (error instanceof HostedError) return respond({ error: error.message }, error.status);
    if (error instanceof z.ZodError) return respond({ error: 'Invalid discovery request' }, 400);
    return respond({ error: 'Discovery request could not be completed' }, 503);
  }
}
