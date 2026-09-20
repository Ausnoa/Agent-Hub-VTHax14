import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSavedApi, savedDependencies } from '../src/lib/hosted/saved-handler.ts';
import { HostedError } from '../src/lib/hosted/server.ts';
import type { PublicAgent } from '../src/lib/hosted/discover.ts';

const agentId = '00000000-0000-4000-8000-000000000001';
const owner = { userId: 'alice', username: 'alice', displayName: '', avatarUrl: null };
const request = (path: string, body?: unknown, method?: string) => new Request(`https://hub.example/api/hosted/${path}`, {
  method: method ?? (body === undefined ? 'GET' : 'POST'), headers: { Authorization: 'Bearer alice', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
function setup() {
  const rows = new Map<string, PublicAgent>();
  return {
    deps: {
      ...savedDependencies,
      authenticate: async () => ({ userId: 'alice', client: {} as never }),
      saved: () => ({
        list: async () => [...rows.values()],
        save: async (input: unknown) => { const value = input as { kind: 'template' | 'workflow'; agentId: string }; rows.set(`${value.kind}:${value.agentId}`, { kind: value.kind, id: value.agentId, name: 'A', description: '', createdAt: '2026-01-01', owner }); },
        remove: async (kind: string, id: string) => { rows.delete(`${kind}:${id}`); },
      }),
    },
    rows,
  };
}
test('an agent can be bookmarked, listed, and removed', async () => {
  const { deps, rows } = setup();
  assert.equal((await handleSavedApi(request('saved', { kind: 'template', agentId }), ['saved'], deps)).status, 201);
  assert.equal(rows.size, 1);
  const listed = await handleSavedApi(request('saved'), ['saved'], deps);
  assert.equal((await listed.json()).length, 1);
  assert.equal((await handleSavedApi(request(`saved/template/${agentId}`, undefined, 'DELETE'), ['saved', 'template', agentId], deps)).status, 200);
  assert.equal(rows.size, 0);
});
test('saved routes require authentication', async () => {
  const { deps } = setup();
  const unauthenticated = { ...deps, authenticate: async () => { throw new HostedError(401, 'Sign in to continue'); } };
  assert.equal((await handleSavedApi(request('saved'), ['saved'], unauthenticated)).status, 401);
});
test('unknown saved routes are rejected', async () => {
  const { deps } = setup();
  assert.equal((await handleSavedApi(request('saved/extra'), ['saved', 'extra'], deps)).status, 404);
});
