import test from 'node:test';
import assert from 'node:assert/strict';
import { EvaluationController, type WorkerConfig } from '../src/domain/EvaluationController.ts';
import { prepareStartup, type PreparedStartup } from '../src/domain/PreparedStartup.ts';
import { listenForPageExit, mountOwnedUi, startEntry } from '../src/domain/entry-lifecycle.ts';
import { StartupTrace, type TraceSnapshot } from '../../../browser-spike/startup-trace.mjs';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes,no) => { resolve=yes; reject=no; });
  return {promise,resolve,reject};
}
const config: WorkerConfig = {pyodideVersion:'0.29.3',pydanticVersion:'2.11.7',
  pyodideIndexURL:'vendor/pyodide/',coreBundle:'engine/core.zip',coreManifest:'engine/manifest.json'};
const metadata = {pyodide:'0.29.3',pydantic:'2.11.7',core_hash:'a'.repeat(64),startup_ms:1,packages_ms:1,total_ready_ms:3};
const tick = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
function fixture(generation = 1) {
  const configGate=deferred<WorkerConfig>();
  const clients: {gate:ReturnType<typeof deferred<unknown>>; disposed:number}[]=[];
  let reads=0;
  let evaluation: EvaluationController | undefined;
  let observe: ((trace: TraceSnapshot) => void) | undefined;
  const handle=prepareStartup({base:'https://example.test/nested/',generation,
    readConfig:() => {reads++;return configGate.promise;},
    createEvaluation:options => {
      observe=options.onStartupTrace;
      evaluation=new EvaluationController({...options,createClient:() => {
        const client={gate:deferred<unknown>(),disposed:0};clients.push(client);
        return {initialize:()=>client.gate.promise,request:async()=>({}),dispose:()=>{client.disposed++;}};
      }});
      return evaluation;
    },
  });
  return {handle,configGate,clients,get reads(){return reads;},get evaluation(){return evaluation;},
    emit:(trace:TraceSnapshot)=>observe?.(trace)};
}

test('pending config adoption retains same trace/abort and creates exactly one existing controller',async()=>{
  const f=fixture();const originalTrace=f.handle.trace;const originalAbort=f.handle.abort;
  assert.equal(f.reads,1);assert.equal(f.clients.length,0);assert.equal(f.handle.owner,'bootstrap');
  f.handle.claim();assert.equal(f.handle.owner,'ui');assert.throws(()=>f.handle.claim(),/重复接管/);
  f.configGate.resolve(config);await tick();assert.equal(f.clients.length,1);
  f.clients[0].gate.resolve({result:metadata});
  const result=await f.handle.ready;assert.equal(result.ok,true);
  if(result.ok) assert.equal(result.evaluation,f.evaluation);
  assert.equal(f.handle.trace,originalTrace);assert.equal(f.handle.abort,originalAbort);assert.equal(f.reads,1);
  f.handle.dispose();f.handle.dispose();assert.equal(f.handle.owner,'disposed');assert.equal(f.clients[0].disposed,1);
});

test('cancelled config resolution never creates a controller and preserves cancellation reason',async()=>{
  const f=fixture();const reason=new Error('cancelled before config');
  f.handle.dispose(reason);f.configGate.resolve(config);
  const result=await f.handle.ready;assert.equal(result.ok,false);
  if(!result.ok) assert.equal(result.error,reason);
  assert.equal(f.clients.length,0);assert.throws(()=>f.handle.claim(),/重复接管/);
  assert.equal(f.handle.trace.snapshot()?.status,'cancelled');
});

for(const claimFirst of [false,true]) test(`init rejection ${claimFirst?'after':'before'} claim is handled with original error`,async()=>{
  const f=fixture();f.configGate.resolve(config);await tick();
  if(claimFirst) f.handle.claim();
  const error=Object.assign(new Error('runtime init failed'),{details:{code:'EXACT_FAILURE'}});
  f.clients[0].gate.reject(error);
  const result=await f.handle.ready;assert.equal(result.ok,false);
  if(!result.ok) assert.equal(result.error,error);
  if(!claimFirst)f.handle.claim();
  assert.equal(f.clients[0].disposed,1);assert.equal(f.handle.trace.status,'failed');
  f.handle.dispose();assert.equal(f.clients[0].disposed,1);
});

test('diagnostics buffered before claim relay to current UI observer and stop after disposal',async()=>{
  const f=fixture();f.configGate.resolve(config);await tick();
  const worker=new StartupTrace({thread:'worker',generation:1,now:()=>1,timeOrigin:100});
  worker.finish('ready');f.emit(worker.snapshot());
  const seen:TraceSnapshot[]=[];f.handle.claim();f.handle.observe(trace=>seen.push(trace));
  assert.equal(seen.length,1);assert.equal(seen[0].generation,1);
  const next={...worker.snapshot(),generation:2};f.emit(next);
  assert.equal(seen.at(-1)?.generation,2,'Relay cannot remain bound to first generation');
  f.handle.dispose();f.emit(next);assert.equal(seen.length,2);
  f.clients[0].gate.resolve({result:metadata});await f.handle.ready;
});

test('UI restart keeps one owner and cleanup closes the replacement client only once',async()=>{
  const f=fixture();f.handle.claim();f.configGate.resolve(config);await tick();
  f.clients[0].gate.resolve({result:metadata});const result=await f.handle.ready;
  assert.equal(result.ok,true);if(!result.ok)return;
  const ready=result.evaluation.restart(config);assert.equal(f.clients.length,2);assert.equal(f.clients[0].disposed,1);
  f.clients[1].gate.resolve({result:metadata});await ready;
  f.handle.dispose();assert.deepEqual(f.clients.map(client=>client.disposed),[1,1]);
});

function entryFixture() {
  const starts:ReturnType<typeof fixture>[]=[];
  const imports:ReturnType<typeof deferred<string>>[]=[];
  const mounted:{ui:string;handle:PreparedStartup}[]=[];
  const states:string[]=[];
  let throwMount=false;
  const entry=startEntry({
    prepare:generation=>{const f=fixture(generation);starts.push(f);return f.handle;},
    loadUi:()=>{const gate=deferred<string>();imports.push(gate);return gate.promise;},
    mount:(ui,handle)=>{handle.claim();if(throwMount)throw new Error('mount failed after claim');mounted.push({ui,handle});},
    state:value=>states.push(value),
  });
  return {entry,starts,imports,mounted,states,setThrowMount:()=>{throwMount=true;}};
}

test('UI import begins while config is pending; late import cannot mount after cancellation',async()=>{
  const f=entryFixture();assert.equal(f.starts[0].reads,1);await tick();assert.equal(f.imports.length,1);
  assert.equal(f.starts[0].clients.length,0);
  f.entry.cancel();f.imports[0].resolve('old UI');await tick();
  assert.equal(f.mounted.length,0);assert.equal(f.starts[0].handle.owner,'disposed');assert.equal(f.states.at(-1),'cancelled');
  f.starts[0].configGate.resolve(config);await f.starts[0].handle.ready;assert.equal(f.starts[0].clients.length,0);
});

test('stale import and readiness rejection cannot mount or dispose a newer retry',async()=>{
  const f=entryFixture();await tick();f.starts[0].configGate.resolve(config);await tick();
  f.entry.retry();await tick();f.starts[1].configGate.resolve(config);await tick();
  f.starts[0].clients[0].gate.reject(new Error('old rejection'));await tick();
  assert.equal(f.starts[0].clients[0].disposed,1);assert.equal(f.starts[1].clients[0].disposed,0);
  f.imports[0].resolve('old UI');await tick();assert.equal(f.mounted.length,0);
  f.imports[1].resolve('new UI');await tick();assert.equal(f.mounted.length,1);assert.equal(f.mounted[0].ui,'new UI');
  f.entry.dispose();assert.equal(f.starts[1].clients[0].disposed,0,'Entry no longer owns adopted UI');
  f.mounted[0].handle.dispose();f.starts[1].clients[0].gate.resolve({result:metadata});await f.starts[1].handle.ready;
  assert.equal(f.starts[1].clients[0].disposed,1);
});

test('UI import failure disposes startup and late config cannot create a Worker',async()=>{
  const f=entryFixture();await tick();f.imports[0].reject(new Error('chunk unavailable'));await tick();
  assert.equal(f.states.at(-1),'failed');assert.equal(f.starts[0].handle.owner,'disposed');
  assert.equal(f.starts[0].handle.trace.status,'failed');
  f.starts[0].configGate.resolve(config);await f.starts[0].handle.ready;assert.equal(f.starts[0].clients.length,0);
});

test('mount exception after claim disposes adopted startup and is retryable',async()=>{
  const f=entryFixture();await tick();f.starts[0].configGate.resolve(config);await tick();
  f.setThrowMount();f.imports[0].resolve('failing UI');await tick();
  assert.equal(f.states.at(-1),'failed');assert.equal(f.starts[0].handle.owner,'disposed');
  assert.equal(f.starts[0].clients[0].disposed,1);assert.equal(f.mounted.length,0);
  f.entry.retry();await tick();assert.equal(f.starts.length,2);
  f.entry.dispose();for(const start of f.starts){start.configGate.resolve(config);start.clients[0]?.gate.resolve({result:metadata});}
  await Promise.all(f.starts.map(start=>start.handle.ready));
});

test('page exit before import completion leaves no late mount or Worker',async()=>{
  const f=entryFixture();await tick();f.entry.dispose();f.entry.retry();
  f.imports[0].resolve('late UI');f.starts[0].configGate.resolve(config);await tick();
  assert.equal(f.starts.length,1);assert.equal(f.mounted.length,0);assert.equal(f.starts[0].clients.length,0);
  await f.starts[0].handle.ready;
});

test('framework-reported mount failure disposes claimed owner and retains original error and handler',async()=>{
  const f=fixture();f.configGate.resolve(config);await tick();
  const error=Object.assign(new Error('setup failed'),{details:{code:'SETUP_ERROR'}});
  const previous=()=>{};
  const uiConfig:{errorHandler?:(error:unknown)=>void}={errorHandler:previous};
  let unmounted=0;
  assert.throws(()=>mountOwnedUi(f.handle,{config:uiConfig,mount:()=>{f.handle.claim();uiConfig.errorHandler?.(error);},
    unmount:()=>{unmounted++;throw new Error('secondary cleanup failure');}}),caught=>caught===error);
  assert.equal(uiConfig.errorHandler,previous);assert.equal(unmounted,1);assert.equal(f.handle.owner,'disposed');
  assert.equal(f.handle.trace.status,'failed');assert.equal(f.clients[0].disposed,1);
  f.clients[0].gate.resolve({result:metadata});await f.handle.ready;
});

test('pre-adoption pagehide leaves explicit retry usable on persisted return and rejects stale imports',async()=>{
  const target=new EventTarget();const f=entryFixture();await tick();
  const unlisten=listenForPageExit(target,()=>f.entry.cancel());
  target.dispatchEvent(new Event('pagehide'));
  assert.equal(f.states.at(-1),'cancelled');assert.equal(f.starts[0].handle.owner,'disposed');
  target.dispatchEvent(new Event('pageshow'));
  assert.equal(f.starts.length,1,'No automatic startup on persisted return');
  f.entry.retry();await tick();assert.equal(f.starts.length,2);
  f.imports[0].resolve('stale before pagehide');await tick();assert.equal(f.mounted.length,0);
  f.imports[1].resolve('explicit retry UI');await tick();assert.equal(f.mounted.length,1);
  unlisten();f.mounted[0].handle.dispose();
  for(const start of f.starts)start.configGate.resolve(config);
  await Promise.all(f.starts.map(start=>start.handle.ready));
});

test('pagehide ownership handover terminates active UI Worker and removes obsolete bootstrap listener',async()=>{
  const target=new EventTarget();const f=entryFixture();await tick();
  let bootstrapCalls=0;let uiCalls=0;
  const stopBootstrap=listenForPageExit(target,()=>{bootstrapCalls++;f.entry.cancel();});
  f.starts[0].configGate.resolve(config);await tick();
  f.starts[0].clients[0].gate.resolve({result:metadata});await f.starts[0].handle.ready;
  f.imports[0].resolve('UI');await tick();
  // Mirrors actual onMounted listener registration and main's mounted handover.
  const stopUi=listenForPageExit(target,()=>{uiCalls++;f.mounted[0].handle.dispose();});
  stopBootstrap();target.dispatchEvent(new Event('pagehide'));
  assert.equal(bootstrapCalls,0);assert.equal(uiCalls,1);assert.equal(f.starts[0].clients[0].disposed,1);
  target.dispatchEvent(new Event('pageshow'));assert.equal(f.starts.length,1);
  stopUi();target.dispatchEvent(new Event('pagehide'));assert.equal(uiCalls,1);
});
