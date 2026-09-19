import test from 'node:test';
import assert from 'node:assert/strict';
import { handleHostedApi } from '../src/lib/hosted/handler.ts';
import { HostedError, authenticate, repository } from '../src/lib/hosted/server.ts';
import { definitionSchema } from '../src/lib/owned-agent/templates.ts';

const id = '00000000-0000-4000-8000-000000000001';
const definition = { name: 'My summary', template: 'summary', instructions: '', fields: [], reference: '' };
const agent = { ...definitionSchema.parse(definition), id, createdAt: new Date().toISOString() };
const req = (value?: unknown, token = 'alice', origin?: string) => new Request('https://app.example/api/hosted/agents', {
  method: value === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
  ...(value === undefined ? {} : { body: JSON.stringify(value) }),
});
function setup() {
  const rows = new Map<string, typeof agent>();
  const calls: string[] = [];
  let budget = true;
  const dependencies = {
    authenticate: (async(request: Request) => {
      const who = request.headers.get('authorization')?.replace('Bearer ', '');
      if (!['alice','bob'].includes(who ?? '')) throw new HostedError(401,'Sign in to continue');
      return { userId: who!, client: {} };
    }) as typeof authenticate,
    repository: ((identity: {userId:string}) => ({
      list: async() => rows.has(identity.userId) ? [rows.get(identity.userId)!] : [],
      create: async(input: unknown) => {const saved = {...agent,...definitionSchema.parse(input)};rows.set(identity.userId,saved);return saved;},
      get: async() => {if (!rows.has(identity.userId)) throw new HostedError(404,'Agent not found');return rows.get(identity.userId)!;},
      reserve: async() => {calls.push('reserve');if(!budget)throw new HostedError(429,'Daily limit');return id;},
      finish: async(_id:string,status:string) => {calls.push(status);},
      history: async()=>[],
    })) as typeof repository,
    run: async()=>{calls.push('infer');return 'Summary';}, enabled:()=>true,
  };
  return {dependencies,rows,calls,exhaust:()=>{budget=false;}};
}
test('hosted creation persists for its verified owner and ignores supplied owner IDs',async()=>{
  const {dependencies}=setup();
  assert.equal((await handleHostedApi(req({...definition,owner_id:'bob'}),['agents'],dependencies)).status,201);
  assert.equal((await (await handleHostedApi(req(),['agents'],dependencies)).json()).length,1);
  assert.deepEqual(await (await handleHostedApi(req(undefined,'bob'),['agents'],dependencies)).json(),[]);
  assert.equal((await handleHostedApi(req({text:'source'},'bob'),['agents',id,'test'],dependencies)).status,404);
});
test('unauthenticated and cross-origin requests cannot reach inference',async()=>{
  const {dependencies,calls}=setup();
  assert.equal((await handleHostedApi(req(undefined,'invalid'),['agents'],dependencies)).status,401);
  assert.equal((await handleHostedApi(req(definition,'alice','https://attacker.example'),['agents'],dependencies)).status,403);
  assert.deepEqual(calls,[]);
});
test('tests reserve budget before inference and persist success or sanitized failure',async()=>{
  const state=setup();state.rows.set('alice',agent);
  assert.equal((await handleHostedApi(req({text:'Hello'}),['agents',id,'test'],state.dependencies)).status,200);
  assert.deepEqual(state.calls,['reserve','infer','completed']);
  state.exhaust();state.calls.length=0;
  assert.equal((await handleHostedApi(req({text:'Hello'}),['agents',id,'test'],state.dependencies)).status,429);
  assert.deepEqual(state.calls,['reserve']);
  const failed=setup();failed.rows.set('alice',agent);
  failed.dependencies.run=async()=>{throw new Error('private provider details');};
  const response=await handleHostedApi(req({text:'Hello'}),['agents',id,'test'],failed.dependencies);
  assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/private provider/);assert.deepEqual(failed.calls,['reserve','failed']);
});
test('invalid and oversized bodies and disabled testing consume no inference budget',async()=>{
  const state=setup();state.rows.set('alice',agent);
  assert.equal((await handleHostedApi(req({...definition,reference:'x'.repeat(65000)}),['agents'],state.dependencies)).status,413);
  assert.equal((await handleHostedApi(req({text:''}),['agents',id,'test'],state.dependencies)).status,400);
  state.dependencies.enabled=()=>false;
  assert.equal((await handleHostedApi(req({text:'Hello'}),['agents',id,'test'],state.dependencies)).status,503);
  assert.deepEqual(state.calls,[]);
});

test('same-origin browser writes accept the public Host when Next uses an internal URL',async()=>{
  const {dependencies}=setup();
  const request=new Request('http://localhost:3001/api/hosted/agents',{method:'POST',headers:{Host:'127.0.0.1:3001',Origin:'http://127.0.0.1:3001',Authorization:'Bearer alice','Content-Type':'application/json'},body:JSON.stringify(definition)});
  assert.equal((await handleHostedApi(request,['agents'],dependencies)).status,201);
});
