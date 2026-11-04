import {BrowserRuleClient} from "./BrowserRuleClient.mjs";
import {runChallengeProbe} from "./challenge-probe.mjs";
const output=document.querySelector("#output");
let client=null;
let initAttempt=0;
const show=data => {output.textContent=JSON.stringify(data,null,2);};
const read=async name => {
  const response=await fetch(new URL(name,import.meta.url));
  if(!response.ok) throw new Error(`Failed loading ${name}`);
  return response.json();
};
const canonical=v => Array.isArray(v) ? v.map(canonical) :
  v && typeof v==="object" ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])) : v;
document.querySelector("#init").onclick=async()=>{
  const attempt=++initAttempt;
  client?.dispose();
  client=new BrowserRuleClient();  // Restart clears failed dynamic imports and the old WASM heap.
  const current=client;
  document.querySelector("#examples").disabled=true;
  document.querySelector("#challenge").disabled=true;
  try {
    output.textContent="正在加载运行时和依赖；失败不会显示未触发或通过。";
    const mode=new URL(location.href).searchParams.get("runtime");
    const config=await read(mode==="same-origin" ? "config.same-origin.json" : "config.json");
    if(attempt!==initAttempt) return;
    const ready=await current.initialize(config,new URL("./",import.meta.url).href);
    if(attempt!==initAttempt) return;
    show(ready);
    document.querySelector("#examples").disabled=false;
    document.querySelector("#challenge").disabled=false;
  }catch(e){if(attempt===initAttempt) show({error:e.message,details:e.details,retry:"修正配置或网络后，点击初始化按钮；会重建Worker并重置挑战。"});}
};
document.querySelector("#examples").onclick=async()=>{
  const current=client, attempt=initAttempt;
  try {
    const results=[];
    for(const name of ["before","conflict","improved"]) {
      const scene=await read(`examples/scene-${name}.json`);
      const expected=await read(`examples/assessment-${name}.json`);
      const response=await current.evaluate(scene,scene.revision);
      if(current!==client || attempt!==initAttempt) return;
      results.push({name,matches_expected:JSON.stringify(canonical(response.result))===JSON.stringify(canonical(expected)),
                    evaluation_ms:response.evaluation_ms});
    }
    show({browser:navigator.userAgent,results});
  }catch(e){if(current===client && attempt===initAttempt) show({error:e.message,details:e.details});}
};
document.querySelector("#challenge").onclick=async()=>{
  const current=client, attempt=initAttempt;
  const button=document.querySelector("#challenge");
  button.disabled=true;
  try {
    const states=await runChallengeProbe(current, name => read(`examples/scene-${name}.json`),
                                         () => current===client && attempt===initAttempt);
    if(states) show({notice:"诊断自动调用，不是实际3D拖拽演示",states});
  }catch(e){if(current===client && attempt===initAttempt) show({error:e.message,details:e.details});}
  finally{if(current===client && attempt===initAttempt) button.disabled=false;}
};
window.addEventListener("pagehide",()=>client?.dispose(),{once:true});
