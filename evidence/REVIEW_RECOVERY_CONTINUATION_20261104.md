# 恢复功能独立审查

日期：2026-11-04 UTC。基线 `f6245e1`，工作树 `/workspace/HomeSafe-AI-continuation`。实现 agent `/root/ux_report`；独立审查 agent `/root/review_ux`。审查未修改产品实现。

结论：**PASS，仅本轮恢复子项**。逐文件摘要及独立浏览器回执见 [review-recovery-continuation-20261104.json](review-recovery-continuation-20261104.json)。不代表 T07 整体、公网或真实模型验收完成。

## 范围与独立结果

- 检查 `BrowserRuleClient` 的终止错误保留：pending 请求被拒绝，空闲 error 后下一次操作立即拒绝且不再 postMessage；dispose 清除监听并终止 Worker。
- 检查 `SceneRuntime` 的 contextlost/绘制异常通道、停止帧调度、事件与模型释放，以及 `mountRenderer` 对业务状态和显示状态的分离。
- 检查重新建立画面时恢复当前 snapshot、相机角色、选择、高亮和放置反馈，且不重建 Workspace/Challenge、不清除合法布局历史。
- 独立运行 `node --test browser-spike/client.test.mjs apps/web/tests/evaluation.test.ts apps/web/tests/transform.test.ts apps/web/tests/workspace.test.ts`：**16 passed**。另独立执行 pending challenge 请求遇到 error、后续 state 请求不得发送、dispose 清空监听的生命周期反例：PASS。
- 独立运行 `npm --prefix apps/web run typecheck`：PASS（包含该轮集成代码）。
- 独立执行 `CI=1 node scripts/check_web_recovery.mjs http://127.0.0.1:4175/preview/ /usr/bin/chromium /workspace/homesafe-browser/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js /workspace/scratch/independent-recovery-continuation`：**PASS**，Chromium 154.0.8037.57，`2026-11-04T08:49:58.127Z`。加入下述并行启动失败反例后，将输出目录换为 `/workspace/scratch/independent-recovery-continuation-final` 独立重跑完整九项流程，`2026-11-04T08:57:04.978Z` 再次 **PASS**。最新[实际回执](recovery-continuation-20261104.json)为这轮独立执行；没有将功能回归耗时用作性能测量。
- 浏览器验证了 context lost 可见提示、按钮继续评估、显式重建新 canvas、保持报告 hash/选择/观察角色/撤销重做；Worker 错误后的失败提案不接受、不发送或重放，自由布置重试保留场景和撤销历史；挑战重试有明确说明并恢复初始布局及零计数；首次无法创建 WebGL 时仍能按钮操作，解除故障后显式重试不改变输入 hash。
- 独立查看 context-lost 截图：故障提示、重试入口、家具按钮及当前清单均可见，未把空画布伪称正常渲染。

## 反例与审查要求

实现者已保留旧版本空闲 Worker 下一请求等到 timeout 的单元失败，以及旧构建实际 WebGL context lost 后没有故障提示的浏览器失败；本审查逐一阅读相关日志，随后运行当前回归。

审查要求区分故障注入与自然故障。当前回执已说明：WebGL 使用真实上下文的 `WEBGL_lose_context`；Worker 通过终止实际 Worker 后派发测试 error 事件注入，未宣称自然浏览器崩溃；初始 WebGL 失败通过测试替换 getContext 返回 null。所有注入仅在验收脚本，未进入产品。

原八项恢复审查未发现需要修改产品实现的阻断缺陷。随后集成审查 agent `/root/review_delivery` 发现并行初始化的新边界：场景响应在 Worker 创建后返回 503，旧代码虽显示错误且隐藏报告，却仍留有一个活动 Worker。其保留反例为 created=1/terminated=0/active=1；主 agent 在 initialize catch 中释放评估控制器和挑战控制器，复验变为 created=1/terminated=1/active=0。

本审查独立阅读上述前后记录及修复，要求新增 harness 的 held-scene 等待有期限，并在最终完整浏览器重跑中再次验证：503 后活动 Worker 为 0、busy=false、无报告；显式重试后总创建数为 2、仅一个新 Worker 活动且当前评估可用。最新 source hash 已更新在独立 JSON 回执。观察资料编辑与场景快照各有另行审查，本报告不把它们纳入恢复功能批准范围。

## 未覆盖

实际 Lux3D 加载/释放恢复、公开入口、其他网络、Edge/Safari：NOT_RUN。绘制异常 catch 分支已静态检查，但浏览器本轮实际注入的是 context loss 和初始 getContext 失败，未单独制造 renderer.render 抛出异常。
