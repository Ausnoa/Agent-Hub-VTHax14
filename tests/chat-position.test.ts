import test from 'node:test';
import assert from 'node:assert/strict';
import {chatPosition} from '../src/lib/agent-ui/chat-position.ts';
test('chat follows its cat and clamps to viewport edges',()=>{
 const size={width:430,height:350},viewport={width:1200,height:900};
 const first=chatPosition({x:900,y:700},size,viewport),moved=chatPosition({x:800,y:650},size,viewport);
 assert.equal(moved.left-first.left,-100);assert.equal(moved.top-first.top,-50);
 for(const anchor of [{x:0,y:0},{x:1200,y:900},{x:0,y:850}]){const p=chatPosition(anchor,size,viewport);assert.ok(p.left>=12&&p.left+size.width<=1188);assert.ok(p.top>=72&&p.top+size.height<=888);}
 const mobile=chatPosition({x:8,y:8},{width:343,height:430},{width:375,height:600});assert.equal(mobile.left,12);assert.ok(mobile.top+430<=588);
});
