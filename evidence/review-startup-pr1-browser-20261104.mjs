import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import puppeteer from '/workspace/homesafe-browser/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import {analyzeStartupTrace} from '/workspace/HomeSafe-AI-startup/scripts/startup-trace-analysis.mjs';
const url='http://127.0.0.1:4200/candidate/';
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const receipts=[];
async function pageSetup(mode){
 const page=await browser.newPage();await page.setViewport({width:1280,height:1000});page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluateOnNewDocument(mode=>{
  window.__review={attempts:[],metadata:[],created:0,active:0};
  window.addEventListener('homesafe-startup-trace',({detail})=>{
   const generation=detail.window_trace?.generation;if(!generation)return;
   let attempt=window.__review.attempts.find(x=>x.generation===generation);
   if(!attempt){attempt={generation};window.__review.attempts.push(attempt)}
   attempt.window_trace=detail.window_trace;if(detail.worker_trace)attempt.worker_trace=detail.worker_trace;
  });
  const Native=window.Worker;window.Worker=class extends Native{
   constructor(...args){super(...args);window.__review.created++;window.__review.active++;this.addEventListener('message',({data})=>{if(data?.ok&&data.result?.core_hash)window.__review.metadata.push(data.result)})}
   terminate(){window.__review.active--;return super.terminate()}
  };
  if(mode==='diagnostic-throw'){
   const original=window.dispatchEvent.bind(window);window.dispatchEvent=event=>{if(event.type==='homesafe-startup-trace')throw Error('injected diagnostic publication failure');return original(event)};
  }
 },mode);return {page,errors};
}
async function ready(page){await page.waitForFunction(()=>document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy')==='false'&&!!document.querySelector('.report .hash')?.textContent?.trim()&&!document.querySelector('[data-testid="renderer-failure"]'));await page.select('.toolbar select','chair');await page.waitForFunction(()=>!document.querySelector('[aria-label="向前移动"]')?.disabled)}
async function move(page){const before=await page.$eval('.report .hash',e=>e.textContent);await page.click('[aria-label="向前移动"]');await page.waitForFunction(before=>document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy')==='false'&&document.querySelector('.report .hash')?.textContent!==before,{},before);const after=await page.$eval('.report .hash',e=>e.textContent);assert.notEqual(before,after);return{before,after}}
async function click(page,text){await page.evaluate(text=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent===text);if(!b)throw Error('Missing '+text);b.click()},text)}
try{
 {
  const {page,errors}=await pageSetup('normal');await page.goto(url,{waitUntil:'domcontentloaded'});await ready(page);const snapshot=await page.evaluate(()=>window.__review);assert.equal(snapshot.created,1);assert.equal(snapshot.active,1);
  const analysis=analyzeStartupTrace(snapshot.attempts.at(-1),snapshot.metadata.at(-1),true);
  assert.ok(analysis.measured_span_union_ms<=analysis.initialization_wall_ms+.01);
  const actualEdit=await move(page);assert.deepEqual(errors,[]);receipts.push({case:'normal',analysis,actual_edit:actualEdit,worker_count:1,page_errors:errors});await page.close();
 }
 {
  const {page,errors}=await pageSetup('failure-retry');const session=await page.createCDPSession();let corrupted=false;
  session.on('Fetch.requestPaused',async event=>{try{if(!corrupted){corrupted=true;const response=await fetch(event.request.url);const config=await response.json();config.pyodideVersion='0.0.0';await session.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(config)).toString('base64')})}else await session.send('Fetch.continueRequest',{requestId:event.requestId})}catch(e){errors.push(String(e))}});
  await session.send('Fetch.enable',{patterns:[{urlPattern:'*/engine/config.json',requestStage:'Request'}]});
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.textContent.includes('Pyodide version mismatch'));
  const failed=await page.evaluate(()=>window.__review);assert.equal(failed.active,0);assert.equal(failed.attempts[0].window_trace.status,'failed');assert.equal(failed.attempts[0].worker_trace.status,'failed');const prior=JSON.stringify(failed.attempts[0]);
  assert.equal(await page.$('.report .hash'),null);await click(page,'重建 Worker 并重试');await ready(page);const retried=await page.evaluate(()=>window.__review);assert.equal(retried.created,2);assert.equal(retried.active,1);assert.equal(JSON.stringify(retried.attempts[0]),prior);assert.equal(retried.attempts.at(-1).generation,2);assert.equal(retried.attempts.at(-1).worker_trace.generation,2);assert.equal(retried.attempts.at(-1).window_trace.status,'ready');assert.equal(retried.attempts.at(-1).worker_trace.status,'ready');
  const analysis=analyzeStartupTrace(retried.attempts.at(-1),retried.metadata.at(-1));const actualEdit=await move(page);assert.deepEqual(errors,[]);receipts.push({case:'failed-version-then-explicit-retry',fault:'Only first config response has pyodideVersion 0.0.0; actual runtime is unchanged.',failed:failed.attempts[0],retry_analysis:analysis,old_attempt_unchanged:true,created:2,active:1,actual_edit:actualEdit,page_errors:errors});await page.close();
 }
 {
  const {page,errors}=await pageSetup('diagnostic-throw');await page.goto(url,{waitUntil:'domcontentloaded'});await ready(page);const state=await page.evaluate(()=>window.__review);assert.equal(state.attempts.length,0);assert.equal(state.created,1);const actualEdit=await move(page);assert.deepEqual(errors,[]);receipts.push({case:'diagnostic-publication-throws',fault:'window.dispatchEvent throws only for homesafe-startup-trace',business_ui_ready:true,actual_edit:actualEdit,created:1,page_errors:errors});await page.close();
 }
 const result={status:'PASS',scope:'INDEPENDENT_PR1_LOCAL_CHROMIUM_FUNCTIONAL_TRACE_CHECKS_NOT_PERFORMANCE_SAMPLE',url,browser:await browser.version(),executed_at:new Date().toISOString(),cases:receipts,limits:['Functional tests may overlap other functional browsers; no latency effect or budget conclusions.','No real assets/public network/other browsers tested.']};
 await writeFile('/workspace/scratch/review-startup-pr1-browser.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,cases:receipts.map(x=>x.case),executed_at:result.executed_at}));
}catch(error){await writeFile('/workspace/scratch/review-startup-pr1-browser-failure.json',JSON.stringify({error:String(error),stack:error.stack,completed:receipts},null,2)+'\n');throw error}finally{await browser.close()}
