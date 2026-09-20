import test from 'node:test';
import assert from 'node:assert/strict';
import { handleDiscoverApi, discoverDependencies } from '../src/lib/hosted/discover-handler.ts';
import { HostedError } from '../src/lib/hosted/server.ts';

const request = (path: string, token = 'alice') => new Request(`https://hub.example/api/hosted/${path}`, { headers: { Authorization: `Bearer ${token}` } });

test('discovery requires authentication and forwards the search query', async () => {
  let seenQuery: string | undefined;
  const deps = { ...discoverDependencies, authenticate: async () => ({ userId: 'alice', client: {} as never }), discover: () => ({ list: async (query: string) => { seenQuery = query; return [{ kind: 'template' as const, id: '1', name: 'A', description: 'B', createdAt: '2026-01-01', owner: { userId: 'x', username: 'x', displayName: '', avatarUrl: null } }]; } }) };
  const response = await handleDiscoverApi(request('discover?query=summarize'), ['discover'], deps);
  assert.equal(response.status, 200);
  assert.equal(seenQuery, 'summarize');
  assert.equal((await response.json()).length, 1);

  const unauthenticated = { ...deps, authenticate: async () => { throw new HostedError(401, 'Sign in to continue'); } };
  assert.equal((await handleDiscoverApi(request('discover'), ['discover'], unauthenticated)).status, 401);
});
test('unknown discovery routes are rejected', async () => {
  const deps = { ...discoverDependencies, authenticate: async () => ({ userId: 'alice', client: {} as never }) };
  assert.equal((await handleDiscoverApi(request('discover/extra'), ['discover', 'extra'], deps)).status, 404);
});
