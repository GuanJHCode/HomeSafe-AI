// Run on the user's machine with an unpacked pinned Pyodide distribution.
// node scripts/pyodide_smoke.mjs /absolute/path/to/pyodide
// This Node compatibility check does NOT measure a browser, iframe or CDN accessibility.
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import assert from "node:assert/strict";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const runtime=process.argv[2];
if(!runtime) throw new Error("Pass local Pyodide 314.0.6 runtime directory; no hidden npm installation.");
const {loadPyodide}=await import(pathToFileURL(path.resolve(runtime,"pyodide.mjs")));
const start=performance.now();
const py=await loadPyodide({indexURL:path.resolve(runtime)+path.sep});
assert.equal(py.version,"314.0.6");
await py.loadPackage("pydantic");
assert.equal(py.runPython("import pydantic; pydantic.__version__"),"2.12.5");
const loaded=performance.now();
py.FS.mkdirTree("/homesafe");
py.unpackArchive(new Uint8Array(await fs.readFile(path.join(root,"browser-spike/python/homesafe_core.zip"))),
                 "zip",{extractDir:"/homesafe"});
py.runPython("import sys; sys.path.insert(0, '/homesafe')\nfrom homesafe_core.browser_bridge import dispatch_json");
const dispatch=py.globals.get("dispatch_json"), results=[];
try {
  for(const name of ["before","conflict","improved"]) {
    const scene=JSON.parse(await fs.readFile(path.join(root,`examples/scene-${name}.json`),"utf8"));
    const expected=JSON.parse(await fs.readFile(path.join(root,`examples/assessment-${name}.json`),"utf8"));
    const stamp=performance.now();
    const out=JSON.parse(dispatch(JSON.stringify({op:"evaluate",payload:{scene}})));
    assert.equal(out.ok,true);assert.deepEqual(out.result,expected);
    results.push({name,matches_expected:true,evaluation_ms:performance.now()-stamp});
  }
} finally { dispatch.destroy(); }
console.log(JSON.stringify({scope:"NODE_COMPATIBILITY_NOT_BROWSER",pyodide:py.version,
                            pydantic:"2.12.5",ready_ms:loaded-start,results},null,2));
