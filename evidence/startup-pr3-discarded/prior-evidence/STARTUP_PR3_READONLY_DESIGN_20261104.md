# PR-3 lightweight entry: read-only proposal

Status: design only; not implemented. Parent decision after PR-2 is required before applying. Inspected the PR-1 frozen source graph and raw profile `/workspace/scratch/pr1-traced-baseline-performance.json` on 2026-11-04. This proposal changes startup scheduling, so it requires a controlled experiment; no performance benefit is claimed.

## Evidence and uncertainty

Across the five PR-1 cold samples, document-to-Worker creation is 137.6–468.8 ms (median 196.1 ms), and init-send-to-enqueue is 22.3–326.9 ms. The five warm samples have Worker creation at 70.6–113.5 ms (median 73.3 ms). Those intervals include scheduling and module loading; they do not isolate network or compilation.

The slowest cold sample is trial 3: actual editable 4128.5 ms. Its config resource `responseEnd` is 131.2 ms, while the application `config_fetch` span completes at 467.1 ms and creates the Worker at 468.8 ms. Renderer creation runs 177.5–282.0 ms (104.5 ms); an unattributed long task runs 283.5–466.5 ms (183 ms). These timings justify testing whether earlier startup can reduce waiting behind main-thread work. They do not prove shader compilation, JavaScript compilation or a particular callback caused the delay. An earlier Worker might instead compete for CPU and regress overall readiness.

## Current reference graph

```text
index.html
  main.ts
    Vue createApp
    App.vue
      useLivingRoom.ts
        SceneRuntime → Three + AssetLoader → GLTFLoader
        TransformController / scene geometry
        EvaluationController → BrowserRuleClient + layout-result + trace helper
        workspace/challenge/report/observation controllers
    style.css
  mount App → onMounted initialize
    parallel: config fetch → EvaluationController.ensureReady → Worker init
              scene/catalog/challenge fetch → renderer construction
    join → first evaluation → accept/report → existing edit controls
```

The scene fetch and rules startup already run in parallel. Repeating that change would not address the static entry graph or delay before config processing. `EvaluationController` has no runtime Vue/Three dependency; its contract imports are type-only, and `layout-result` is a small predicate. This makes it a plausible lightweight entry dependency without a second Worker implementation.

## Smallest candidate to evaluate

1. Keep `main.ts` as a small explicit bootstrap: resolve the same relative Vite base, start config loading and one existing `EvaluationController`, and dynamically import a mount module containing Vue/App/Three. Keep the same CSS and visible loading meaning. Do not add a proxy Worker, second controller or new rule engine.
2. Represent early startup as an explicit single-owner handle. It contains the first trace generation, AbortController, handled readiness outcome, and the existing controller. Pass the handle into App and `useLivingRoom` via a prop/parameter. Transfer ownership exactly once; no module-global mutable singleton or implicit lookup. Initial `initialize(false)` adopts this controller instead of creating/restarting another Worker.
3. Observe readiness rejection immediately, before App import finishes. Store an explicit success/failure outcome so early failures cannot become unhandled promise rejections. Buffer only the bounded latest diagnostic snapshot until the UI registers its observer. Transfer or update the observer so later retries cannot continue publishing through a stale generation-1 callback.
4. Bootstrap retains cleanup responsibility until adoption; App retains it afterward. App import failure, config timeout, pre-adoption cancellation and page exit must abort fetches and dispose any Worker immediately. Delayed config resolution must not create a Worker after cancellation. A minimal loading/error surface can offer explicit retry if App import itself fails; it must never satisfy the actual editable predicate. Once App owns the handle, existing cancel/retry, accepted-layout preservation and challenge-reset semantics remain authoritative.
5. Initial scene fetch and renderer creation stay in the UI path and remain parallel with the adopted startup. First canonical evaluation still waits for both valid scene state and ready Worker. Keep subpath URLs resolved from the same base; preserve actual DOM/edit gates and all performance targets.

Possible touched files: `main.ts`, new lightweight startup owner and mount module, App prop and initial `useLivingRoom` adoption, focused owner lifecycle tests, browser startup/recovery trace checks. Avoid modifying Python schemas, Worker bootstrap/cache behavior, business payloads or renderer internals in this experiment.

## Required acceptance before keeping the candidate

Unit counterexamples: delayed config resolves after cancellation; init fails before UI import; App import fails while Worker is active; double adoption; failure/retry observer receives a stale generation; page exit before and after adoption. Every terminal path must leave zero unintended Workers, and successful adoption must create exactly one Worker.

Run the existing experience/recovery checks and independent startup trace checks, including actual accepted edits and nested-path loading. Verify the built entry graph truly excludes Three/App from its static dependency closure; a nominal dynamic import that is pulled back through another import does not satisfy the design.

Use the same controlled profile/harness and exact editable predicate against the appropriate PR-2 baseline, with fixed sample/order policy set before sampling. Compare all cold/warm samples, startup generations, actual accepted edit checks, resource sizes, document-to-Worker and end-to-end editable times. Earlier Worker creation alone is insufficient; reject the change if it only shifts timing or worsens actual readiness/recovery. Keep 3000/12000/150 ms gates unchanged and distinguish observation from causal inference.
