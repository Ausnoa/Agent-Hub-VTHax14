import { z } from 'zod';
import { authenticate, repository, HostedError } from './server.ts';
import { ModelProviderError,ModelServiceError } from '../planner/index.ts';
import { runDefinition } from '../owned-agent/run.ts';

export async function readBody(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new HostedError(415, 'Use application/json');
  const reader = request.body?.getReader();
  if (!reader) throw new HostedError(400, 'JSON body required');
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 64000) throw new HostedError(413, 'Request exceeds 64 KB');
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new HostedError(400, 'Invalid JSON'); }
  } finally { await reader.cancel(); }
}
export const respond = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'Vary': 'Authorization', 'X-Content-Type-Options': 'nosniff' } });
export function checkOrigin(request: Request) {
    // Bearer-only auth: cookies do not authorize requests, and no CORS is enabled.
    const origin = request.headers.get('origin');
    if (request.method !== 'GET' && origin) {
      // Next can expose an internal localhost URL behind its HTTP server/proxy.
      // Compare the browser Origin with the actual request Host, not forwarded headers.
      const browserOrigin = new URL(origin);
      const host = request.headers.get('host') ?? new URL(request.url).host;
      if (!['http:', 'https:'].includes(browserOrigin.protocol) || browserOrigin.host !== host || browserOrigin.origin !== origin) throw new HostedError(403, 'Cross-origin writes are not allowed');
    }
}
export async function handleHostedApi(request: Request, path: string[], dependencies = { authenticate, repository, run: runDefinition, enabled: () => process.env.HOSTED_AGENT_TESTS_ENABLED === 'true' }) {
  try {
    checkOrigin(request);
    const identity = await dependencies.authenticate(request);
    const store = dependencies.repository(identity);
    if (path.length === 1 && path[0] === 'tests' && request.method === 'GET') return respond(await store.history());
    if (path.length === 1 && path[0] === 'agents') {
      if (request.method === 'GET') return respond(await store.list());
      if (request.method === 'POST') return respond(await store.create(await readBody(request)), 201);
    }
    if (path[0] === 'agents' && path.length >= 2 && path.length <= 3) {
      const id = z.uuid().parse(path[1]);
      if (path[2] === 'visibility' && request.method === 'POST') {
        const { visibility } = z.object({ visibility: z.enum(['public', 'private']) }).parse(await readBody(request));
        return respond(await store.setVisibility(id, visibility));
      }
      const agent = await store.get(id);
      if (path.length === 2 && request.method === 'GET') return respond(agent);
      if (path[2] === 'tests' && request.method === 'GET') return respond(await store.history(id));
      if (path[2] === 'test' && request.method === 'POST') {
        if (!dependencies.enabled()) throw new HostedError(503, 'Hosted testing is not enabled yet');
        const { text } = z.object({ text: z.string().trim().min(1).max(12000) }).parse(await readBody(request));
        const runId = await store.reserve(id, text);
        let output: string;
        try { output = z.string().max(24000).parse(await dependencies.run(agent, text)); }
        catch (error) {
          const message=error instanceof ModelProviderError || error instanceof ModelServiceError ? error.message : 'Generation failed; no result was produced.';
          await store.finish(runId, 'failed', message);
          return respond({ error: message, runId }, 502);
        }
        await store.finish(runId, 'completed', output);
        return respond({ output, runId });
      }
    }
    throw new HostedError(404, 'Route not found');
  } catch (error) {
    if (error instanceof HostedError) return respond({ error: error.message }, error.status);
    if (error instanceof z.ZodError) return respond({ error: 'Invalid agent configuration or input' }, 400);
    return respond({ error: 'Hosted request could not be completed' }, 503);
  }
}
