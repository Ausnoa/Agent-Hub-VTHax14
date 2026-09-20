import test from 'node:test';
import assert from 'node:assert/strict';
import { handleProfileApi, profileDependencies } from '../src/lib/hosted/profile-handler.ts';
import { HostedError } from '../src/lib/hosted/server.ts';

const aliceId = '00000000-0000-4000-8000-000000000001', strangerId = '00000000-0000-4000-8000-000000000002';
const profile = { userId: aliceId, username: 'alice', displayName: 'Alice', avatarUrl: null, bio: '', createdAt: '2026-01-01' };
const request = (path: string, body?: unknown, token = 'alice') => new Request(`https://hub.example/api/hosted/${path}`, {
  method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
function setup() {
  return {
    ...profileDependencies,
    authenticate: async () => ({ userId: aliceId, client: {} as never }),
    profiles: () => ({
      me: async () => profile,
      update: async (input: unknown) => ({ ...profile, ...(input as object) }),
      byUsername: async (username: string) => { if (username !== profile.username) throw new HostedError(404, 'Profile not found'); return profile; },
      byUserIds: async (ids: string[]) => new Map(ids.filter((id) => id === profile.userId).map((id) => [id, profile])),
    }),
  };
}
test('own profile can be read and updated', async () => {
  const deps = setup();
  assert.deepEqual(await (await handleProfileApi(request('profile'), ['profile'], deps)).json(), profile);
  const updated = await handleProfileApi(request('profile', { username: 'alice', displayName: 'New name', avatarUrl: '', bio: '' }), ['profile'], deps);
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).displayName, 'New name');
});
test('public profile lookup by username or user id works, and unknown lookups 404', async () => {
  const deps = setup();
  assert.equal((await handleProfileApi(request('profiles/alice'), ['profiles', 'alice'], deps)).status, 200);
  assert.equal((await handleProfileApi(request('profiles/nobody'), ['profiles', 'nobody'], deps)).status, 404);
  assert.equal((await handleProfileApi(request(`profiles/by-id/${aliceId}`), ['profiles', 'by-id', aliceId], deps)).status, 200);
  assert.equal((await handleProfileApi(request(`profiles/by-id/${strangerId}`), ['profiles', 'by-id', strangerId], deps)).status, 404);
});
test('profile routes require authentication', async () => {
  const deps = { ...setup(), authenticate: async () => { throw new HostedError(401, 'Sign in to continue'); } };
  assert.equal((await handleProfileApi(request('profile'), ['profile'], deps)).status, 401);
});
