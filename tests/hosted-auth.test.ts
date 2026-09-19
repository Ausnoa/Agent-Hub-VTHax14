import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate } from '../src/lib/hosted/server.ts';

test('server authentication verifies bearer tokens with Supabase and requires confirmed email',async(t)=>{
  const oldUrl=process.env.NEXT_PUBLIC_SUPABASE_URL, oldKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://project.example';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_test-only';
  let response=Response.json({id:'00000000-0000-4000-8000-000000000001',email_confirmed_at:'2026-09-19T00:00:00Z'});
  const calls: string[]=[];
  t.mock.method(globalThis,'fetch',async(url:RequestInfo|URL,options?:RequestInit)=>{
    calls.push(String(url));
    assert.equal(new Headers(options?.headers).get('authorization'),'Bearer test-user-token');
    return response.clone();
  });
  try {
    const request=new Request('https://app.example/api/hosted/agents',{headers:{Authorization:'Bearer test-user-token'}});
    const identity=await authenticate(request);
    assert.equal(identity.userId,'00000000-0000-4000-8000-000000000001');
    assert.match(calls[0],/\/auth\/v1\/user$/);
    response=Response.json({id:identity.userId,email_confirmed_at:null});
    await assert.rejects(authenticate(request),/verified email/);
    response=Response.json({message:'Invalid JWT',code:'bad_jwt'},{status:401});
    await assert.rejects(authenticate(request),/verified email/);
    const before=calls.length;
    await assert.rejects(authenticate(new Request('https://app.example',{headers:{Cookie:'session=forged'}})),/Sign in/);
    assert.equal(calls.length,before);
  } finally {
    if(oldUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=oldUrl;
    if(oldKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=oldKey;
  }
});
