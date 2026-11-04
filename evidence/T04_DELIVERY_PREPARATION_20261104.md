# T04 / T09–T14 续作：许可证通知与交付准备

核对基线：57faf384d64e9770407b28086fdfeb5b193a6d6f。状态：实现与草稿已准备，等待独立审查；不关闭 T04/T09–T14。

## 代码范围与实际检查

新增 `scripts/dependency_notices.py`，在 `stage_web_preview.py` 暂存时收集实际 npm lock 生产闭包中的许可证、分发 wheel 内嵌许可证，以及固定版本 Pyodide/CPython 上游许可证。生成的全文与 JSON 清单一起纳入 dist 校验和摘要；缺失/篡改会失败。未修改官方 Pyodide lock、runtime pin 或 wheel。上游来源/摘要见 `licenses/upstream/sources.json`。

2026-11-04 本执行环境实际运行：

```
/workspace/homesafe-venv/bin/python -m pytest reference/tests/test_dependency_notices.py reference/tests/test_web_staging.py -q
11 passed
```

对真实已安装 npm 依赖及已暂存的官方 Pyodide runtime 执行 notice_files：32 条通知，全文 87712 字节。覆盖 Vue、Three.js、生产闭包内包、Pydantic/核心/annotated-types/typing-extensions/typing-inspection 五个 wheel、Pyodide 314.0.6、CPython 3.14.2。生产闭包是保守范围，可能包含未进入最终 JS 的组件。

回归覆盖依赖缺失许可、安装版本偏离 lock、上游许可篡改、wheel 字节变化、构建通知缺失/篡改。夹具明确为合成，不伪称真实依赖验收。浏览器/公网验证由本轮主任务另记，本子项没有自称执行。

该初轮范围随后扩展，见文末追加记录。项目自身源码许可和 Lux3D 原件再分发权利未确认。通知生成不等于整个许可门禁通过。

## 当前官方来源读取

2026-11-04 使用联网读取工具打开：

- https://www.aholo3d.cn/hackathon ：返回赛事页面标题，但正文无可读行。
- https://www.aholo.ai/hackathon ：返回赛事页面标题，但正文无可读行。
- https://www.aholo3d.cn/hackathon/my ：工具报告 Timeout fetching。

因此本轮不能确认当前账户报名/队伍/选题/字段规格、截止日期、复交规则或适用条款。既有 `rules-verification.json` 中用户此前核验保留为历史来源，没有删改或冒充本轮登录结果。解除条件为可访问的实际官方正文/表单和获准账户会话；未联系官方、未接受新条款。

## 已准备的材料与明确外部依赖

- `submission/drafts/report-20261104.md`：有实际项目内容的报告工作稿，区分历史基线、本轮待审和外部未完成；未生成参赛 PDF。
- `submission/drafts/recording-plan.md`：连续真实录屏分镜、版本及原片保存清单；尚未录制最终视频。用户试玩仅为执行方案，没有虚构参与者或结果。
- `submission/drafts/social-post.md`：符合当前占位预览状态的未发布草稿。
- `submission/drafts/release-runbook.md`：构建、校验、授权后部署、实际匿名/其他网络验证、回滚、G0–G4、正式提交及维护步骤。无已授权托管入口、无账户回执，不部署不提交。

T09 需功能与 G1/G3 证据才能冻结。T10 最终 PDF/真实视频必须绑定冻结版，当前只完成可执行草稿。T11 无正式提交授权与门禁，T12–T14 依实际提交、日期和结果后续推进，没有创建后台提醒。T08 明确延期，不重复生成模型。

## 同日追加：静态依赖审计与正确导出分类

不将能执行的依赖审计写成外部阻断：已进一步读取固定 Pyodide 构建材料，补齐 Emscripten 5.0.3、Rust 1.93.0、CPython 编译所用 libffi/hiwire/liblzma/zstd、Emscripten 的 zlib/bzip2、SQLite 与标准库附加许可。Pydantic-core 2.41.5 Cargo.lock 的101个 crates.io 依赖下载包均核对官方 lock checksum；99个读取内嵌许可，另2个用精确标签原文补齐。Rust 官方标准库/编译器归档均核对 .sha256，从中读取标准库通知和完整 COPYRIGHT-library.html，未安装或执行编译器。

现有195条上游通知原件加25条 npm 生产闭包通知及5条分发 wheel 通知，合计225条，生成全文1,579,147字节。完整源码关联清单与固定构建材料均在 licenses/upstream/sources.json；全 Cargo.lock 保守包含开发、构建及其他目标组件，不冒充精确链接二进制 SBOM。HTML 许可只转纯文本；所有原件保留来源/hash，目录不含模型、账户资料或编译器二进制。

增加4个反例测试：删除构建 pin、篡改构建元数据、移除静态库通知、移除 Cargo 依赖通知，均被阻止。新增 vendored_dependency_notice 导出分类，只限登记且摘要匹配的上游文本，拒绝目录外、private、脚本/GLB/账户JSON和无效UTF-8。先运行新导出用例，旧实现2失败/36通过；实现后许可证/暂存/导出共53项通过。

```
/workspace/homesafe-venv/bin/python -m pytest reference/tests/test_dependency_notices.py reference/tests/test_web_staging.py reference/tests/test_release_export.py -q
53 passed
```

两份 apps/web/public 下生成的通知被精确加入 .gitignore；提交的是审核输入，不提交派生副本。独立复审需覆盖本次扩展，初轮32条通知的PASS不能代替扩展后的复审。
