import { z } from 'zod';
import { authenticate, HostedError } from './server.ts';
import { readBody, respond, checkOrigin } from './handler.ts';
import { savedRepository } from './saved.ts';

export const savedDependencies = { authenticate, saved: savedRepository };
export async function handleSavedApi(request: Request, path: string[], deps = savedDependencies) {
  try {
    checkOrigin(request);
    const identity = await deps.authenticate(request);
    const saved = deps.saved(identity);
    if (path.length === 1 && path[0] === 'saved') {
      if (request.method === 'GET') return respond(await saved.list());
      if (request.method === 'POST') { await saved.save(await readBody(request)); return respond({ ok: true }, 201); }
    }
    if (path.length === 3 && path[0] === 'saved' && request.method === 'DELETE') {
      const kind = z.enum(['template', 'workflow']).parse(path[1]);
      const id = z.uuid().parse(path[2]);
      await saved.remove(kind, id);
      return respond({ ok: true });
    }
    throw new HostedError(404, 'Route not found');
  } catch (error) {
    if (error instanceof HostedError) return respond({ error: error.message }, error.status);
    if (error instanceof z.ZodError) return respond({ error: 'Invalid saved-agent request' }, 400);
    return respond({ error: 'Saved agents request could not be completed' }, 503);
  }
}
