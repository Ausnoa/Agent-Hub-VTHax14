import test from 'node:test';
import assert from 'node:assert/strict';
import { loginTarget } from '../src/lib/hosted/login-target.ts';
test('login destinations are limited to supported internal workspace pages',()=>{
  for(const path of ['/agents','/agent-preview','/discover','/create','/general'])assert.equal(loginTarget(path),path);
  for(const path of [null,'/execution','https://attacker.example','//attacker.example','/login','/agents?redirect=https://attacker.example'])assert.equal(loginTarget(path),'/dashboard');
});
