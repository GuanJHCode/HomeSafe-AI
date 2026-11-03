import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkerController} from './worker-controller.mjs';
import {formatChallengeSummary} from './challenge-summary.mjs';

const response = () => ({metadata:{pyodide:'314.0.6'}, dispatch:raw => JSON.stringify({ok:true,result:JSON.parse(raw)})});
const init = id => ({id,op:'init',payload:{config:{},base:'http://localhost/'},clientRevision:0});
const evaluate = id => ({id,op:'evaluate',payload:{scene:{}},clientRevision:3});

test('rejected initialization is cleared and a second attempt can succeed', async () => {
  let calls=0;const messages=[];
  const worker=createWorkerController(async()=>{if(++calls===1) throw new Error('network unavailable');return response();},m=>messages.push(m));
  await worker.enqueue(init(1));
  await worker.enqueue(init(2));
  await worker.enqueue(evaluate(3));
  assert.equal(calls,2);assert.equal(messages[0].ok,false);
  assert.equal(messages[1].ok,true);assert.equal(messages[2].ok,true);
});

test('evaluation after failed init cannot turn into success', async () => {
  const messages=[];const worker=createWorkerController(async()=>{throw new Error('failure');},m=>messages.push(m));
  await worker.enqueue(init(1));await worker.enqueue(evaluate(2));
  assert.equal(messages[1].ok,false);assert.match(messages[1].error.message,/not initialized/);
});

test('successful initialization is reused and queued evaluation waits for it', async () => {
  let calls=0;const messages=[];
  const worker=createWorkerController(async()=>{++calls;await new Promise(r=>setTimeout(r,5));return response();},m=>messages.push(m));
  await Promise.all([worker.enqueue(init(1)),worker.enqueue(evaluate(2)),worker.enqueue(init(3))]);
  assert.equal(calls,1);assert.deepEqual(messages.map(m=>m.id),[1,2,3]);
  assert.ok(messages.every(m=>m.ok));
});

test('dispatch failure does not poison subsequent commands', async () => {
  let calls=0;const messages=[];
  const worker=createWorkerController(async()=>({metadata:{},dispatch:()=>{if(++calls===1) throw new Error('bad command');return '{"ok":true,"result":1}';}}),m=>messages.push(m));
  await worker.enqueue(init(1));await worker.enqueue(evaluate(2));await worker.enqueue(evaluate(3));
  assert.equal(messages[1].ok,false);assert.equal(messages[2].ok,true);
});

test('oversized message is rejected before calling Python', async () => {
  let calls=0;const messages=[];
  const worker=createWorkerController(async()=>({metadata:{},dispatch:()=>{++calls;return '{}';}}),m=>messages.push(m));
  await worker.enqueue(init(1));await worker.enqueue({id:2,op:'evaluate',payload:'x'.repeat(512001)});
  assert.equal(calls,0);assert.match(messages[1].error.message,/too large/);
});

test('malformed message remains structured and the queue recovers', async () => {
  const messages=[];const worker=createWorkerController(async()=>response(),m=>messages.push(m));
  await worker.enqueue(null);await worker.enqueue(init(2));
  assert.equal(messages[0].ok,false);assert.equal(messages[1].ok,true);
});

test('goal-met summary never omits outstanding triggered findings',()=>{
  const text=formatChallengeSummary({status:'goal_met',remaining_triggered:2,remaining_needs_review:4});
  assert.match(text,/本关布局目标已完成/);assert.match(text,/2项已触发/);assert.match(text,/4项待核查/);
  assert.match(text,/不表示家庭安全/);
});

test('missing summary counts cannot masquerade as zero',()=>{
  assert.match(formatChallengeSummary({status:'goal_met'}),/状态不完整/);
});
