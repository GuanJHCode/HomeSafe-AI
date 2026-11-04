# T05/T07 双角色摘要、加载恢复和清单导出

日期：2026-11-04。基于 `codex/v6.1-browser-3d` / `57faf384d64e9770407b28086fdfeb5b193a6d6f` 后的工作树。

## 范围与实现

- 两角色始终以同一份 Python assessment 计算摘要，同时显示已触发、待核查、当前条件未触发及资料不足/错误覆盖数量。摘要按钮只切换展示焦点，不改变相机、成员能力或场景。原有检查卡定位、高亮、逐项依据、未知与覆盖继续保留。
- JSON 下载名保留 scene_revision / input_hash，加入时间戳和单页递增序号，重复下载不会覆盖同名清单；内容仍来自同一接受版本，不把下载时间冒充场景变化。
- 初始场景、模型目录和配置请求（含响应体）有 20 秒期限；加载中可取消，取消清理 Worker、使旧尝试失效。显式重试重新建 Worker，不重放失败操作。既有操作超时、迟到评估过滤和无旧清单导出门禁继续保留。
- GLB 下载及响应体有 45 秒期限。失败缓存条目移除；用户可只重试失败模型。成功模型、布局代理、场景版本及规则评估不改变；失败期间明确显示程序占位，不冒充已加载模型。

## 反例与验证

先运行新增断言，在改动前复现两个失败：旧 presenter 无双角色汇总入口；同一布局两次导出文件名相同。保留[失败日志](logs/ux-counterexamples-20261104.txt)。初始资源 deadline/abort 有独立模拟停滞响应体、忽略 abort 的迟到响应和已取消不发请求测试；模型测试验证超时后显式重试成功。

本轮定向 Node 回归 13 项 PASS，见[日志](logs/ux-regression-20261104.txt)。完整应用回归在该阶段 27 项 PASS，`npm --prefix apps/web run typecheck` PASS。其他 agent 后续增加挑战测试时总数可变化，不以此数字替代最终回归。

实际浏览器命令：

```bash
CI=1 node scripts/check_web_experience.mjs \
  http://127.0.0.1:4174/preview/ \
  /usr/bin/chromium \
  /workspace/homesafe-browser/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js \
  /workspace/scratch/ux-browser
```

Chrome 154.0.8037.57、隔离 Linux、loopback 子路径实测 PASS；[机器回执](ux-experience-20261104.json)。实际覆盖取消→迟到响应丢弃→重建重试；两摘要同时保留；检查焦点切换不改变相机/清单 hash；同一布局两次 JSON 文件名不同、内容一致；375px 无横向溢出、家具按钮移动；打印生成 PDF；procedural GLB 首次下载失败→按钮重试加载→hash 不变。

浏览器原始截图、PDF、回执位于本轮执行环境 `/workspace/scratch/ux-browser/`。截图已目视检查：375px 页面布局完整、两角色摘要与中文清单可见；仍是合成占位客厅，不是 Lux3D 目视验收。

测试脚本初稿使用 Puppeteer 全局 request interception，导致 Worker 启动停滞，60 秒超时；不是产品已确认缺陷。独立审查指向仓库既有 `browser_fault.mjs` 的限制说明后，改为只针对 page 的有限 CDP Fetch patterns，重跑通过。初次失败文本保留在私下工作目录 `failure.txt`，不删除失败历史。配置请求等待也增加 10 秒上限，防止前置资源失败时脚本无限等待。

## 边界与审查

- 本项只验证应用行为和 procedural 模型恢复；真实 Lux3D 模型的加载/目视/授权验收不由此证明。
- 公网、另一网络、Edge、Safari、真实手机设备、真实模型打印清单：NOT_RUN。
- 其他任务的性能目标及正式发布门禁由对应证据评估，未在此降低标准。
- 独立 agent `review_ux` 已独立复核代码、运行 27 项应用测试与严格类型检查、重跑浏览器并检查截图和两页打印 PDF，结论 PASS；见[独立审查](REVIEW_UX_RECOVERY_20261104.md)。通过范围仅限上述应用子项，不关闭 T03/T04 或全部 T05/T07。
