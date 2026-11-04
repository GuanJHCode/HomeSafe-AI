import test from "node:test";
import assert from "node:assert/strict";
import {BrowserRuleClient} from "./BrowserRuleClient.mjs";
class FakeWorker {
  listeners=new Map();sent=[];terminated=false;
  addEventListener(k,fn){this.listeners.set(k,fn);}
  removeEventListener(k){this.listeners.delete(k);}
  postMessage(m){this.sent.push(m);}
  emit(data){this.listeners.get("message")({data});}
  terminate(){this.terminated=true;}
}
test("request IDs route out-of-order replies without stale acceptance",async()=>{
  const worker=new FakeWorker(),client=new BrowserRuleClient(worker);
  const a=client.evaluate({},1),b=client.evaluate({},2);
  worker.emit({id:2,clientRevision:2,ok:true,result:{value:"new"}});
  worker.emit({id:1,clientRevision:1,ok:true,result:{value:"old"}});
  assert.equal(client.isCurrent(await b,2),true);
  assert.equal(client.isCurrent(await a,2),false);
  client.dispose();
});
test("structured placement failures propagate",async()=>{
  const worker=new FakeWorker(),client=new BrowserRuleClient(worker);
  const response=client.evaluate({},3);
  worker.emit({id:1,clientRevision:3,ok:false,error:{code:"INVALID_PLACEMENT",message:"collision",issues:[{object_id:"chair"}]}});
  await assert.rejects(response,e=>e.details.issues[0].object_id==="chair");client.dispose();
});
test("dispose rejects pending work and terminates worker",async()=>{
  const worker=new FakeWorker(),client=new BrowserRuleClient(worker);
  const response=client.evaluate({},1);client.dispose();
  await assert.rejects(response,/disposed/);
  assert.equal(worker.terminated,true);
  await assert.rejects(client.evaluate({},2),/disposed/);
});
test("timeouts never manufacture a success",async()=>{
  const worker=new FakeWorker(),client=new BrowserRuleClient(worker);
  await assert.rejects(client.request("evaluate",{},1,5),/timeout/);client.dispose();
});

test('synchronous postMessage failure rejects and clears pending request',async()=>{
  const worker=new FakeWorker(),client=new BrowserRuleClient(worker);
  worker.postMessage=()=>{throw new Error('DataCloneError');};
  await assert.rejects(client.evaluate({},1),/DataCloneError/);
  assert.equal(client.pending.size,0);client.dispose();
});

test('an idle Worker crash rejects the next request immediately without posting or replay',async()=>{
  const worker=new FakeWorker(),client=new BrowserRuleClient(worker);
  worker.listeners.get('error')();
  const result=client.request('evaluate',{},4,5);
  await assert.rejects(result,/Worker crashed/);
  assert.equal(worker.sent.length,0);
  client.dispose();
});
