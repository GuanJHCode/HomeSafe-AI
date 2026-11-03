// Fixed-op worker; no user-supplied Python code or paid SDK. Module worker required.
import {createWorkerController} from "./worker-controller.mjs";

async function initialize(config, base) {
  const started = performance.now();
  const indexURL = new URL(config.pyodideIndexURL, base).href;
  const { loadPyodide } = await import(new URL("pyodide.mjs", indexURL).href);
  const py = await loadPyodide({ indexURL });
  if (py.version !== config.pyodideVersion) throw new Error("Pyodide version mismatch");
  const booted = performance.now();
  await py.loadPackage("pydantic");
  const packageVersion = py.runPython("import pydantic; pydantic.__version__");
  if (packageVersion !== config.pydanticVersion) throw new Error("Pydantic version mismatch");
  const packagesReady = performance.now();
  const [manifestResponse, bundleResponse] = await Promise.all([
    fetch(new URL(config.coreManifest, base)), fetch(new URL(config.coreBundle, base))
  ]);
  if (!manifestResponse.ok || !bundleResponse.ok) throw new Error("Run stage_browser_core.py first");
  const manifest = await manifestResponse.json();
  const bytes = new Uint8Array(await bundleResponse.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2,"0")).join("");
  if (hex !== manifest.bundle_sha256) throw new Error("Python bundle hash mismatch");
  py.FS.mkdirTree("/homesafe");
  py.unpackArchive(bytes, "zip", { extractDir: "/homesafe" });
  py.runPython("import sys; sys.path.insert(0, '/homesafe')\nfrom homesafe_core.browser_bridge import dispatch_json");
  const dispatch = py.globals.get("dispatch_json");
  return { dispatch, metadata: { pyodide: py.version, pydantic: packageVersion, core_hash: hex,
    startup_ms: booted-started, packages_ms: packagesReady-booted,
    total_ready_ms: performance.now()-started } };
}

const controller = createWorkerController(initialize, response => self.postMessage(response));
self.onmessage = ({data}) => { void controller.enqueue(data); };
