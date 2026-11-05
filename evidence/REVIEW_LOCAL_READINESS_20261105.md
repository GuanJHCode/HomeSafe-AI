# 真实模型恢复与窄屏补充验收独立审查（2026-11-05 UTC）

**结论：PASS_SCOPED。** 本次新增的真实模型失败重试、375px 窄屏按钮操作、真实 WebGL 上下文丢失重建，以及真实模型绑定下的拖动导出保护，已经由独立 agent 重新运行并查看实际截图。未发现阻止这些验收子项关闭的具体缺陷。没有修改产品实现、模型、公开清单或安全设置；公开权利、正式托管、其他设备与赛事提交门禁仍保留。

基线为本地 `4203a3a9b7d1018417ae7ddcebcbf94c8996ab3c`。本审查覆盖该提交之后的三份验收脚本：

| 脚本 | 审查时 SHA-256 |
| --- | --- |
| `scripts/check_private_assets.mjs` | `2cb6af20aecabfd5964a008479704236f9ec86399b594ed4798922c7ffbfc957` |
| `scripts/check_private_asset_resilience.mjs` | `45caaaff6bff18da79bc9baf0e68845d778e1d61706713608f7d52010a7a22d7` |
| `scripts/check_web_draft_export.mjs` | `f23885b35730027862111badadb909e756e73210c01f6fdfa454986209abfd69` |

审查者另读了应用的模型失败重试、渲染器重建和状态更新实现，确认新增脚本直接测试现有应用行为，没有在测试中替换业务规则或伪造已加载模型。主私下 harness 的 `--resilience` 为可选项，默认仍只执行原来的私下完整交互；新增模式顺序执行完整交互、恢复/窄屏和拖动导出，任一子进程失败或输出解析失败都会拒绝 PASS 并保留证据。

## 独立实际运行

审查者使用自己在上一轮从原件独立重建、已获规范及字节审查的派生件，另开隔离 Chromium 和 loopback 服务：

```bash
CI=1 node scripts/check_private_assets.mjs \
  --chair evidence/private/reviewer-derived-chair-20261105/model.glb \
  --cabinet evidence/private/reviewer-derived-cabinet-20261105/model.glb \
  --chair-front +Z --cabinet-front +Z --provenance lux3d_web \
  --chrome /usr/bin/chromium \
  --driver /workspace/homesafe-private/browser-driver/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js \
  --resilience --output evidence/private/reviewer-real-resilience-20261105
```

完整结果 `result.json` 为 PASS，恢复子结果和拖动导出子结果也分别 PASS。运行浏览器为 Chromium 154.0.8037.57。实际输入 SHA 再次匹配：chair `296935f947dabf72026764d71d1df9f85d353d2062c7745b187ad21b417a07fc`；cabinet `92944741a7e9f2491f9220c9dff3f95d66190db80a2488a5d029fbe1b3de3350`。`lux3d_web` 表示这两件私下派生件的原始来源链，不把派生字节称为未修改的原始导出。

## 实际故障和结果

脚本通过 Chrome DevTools Protocol 在浏览器实际请求阶段注入故障；503 是实际返回 503，摘要不符是复制真实 GLB 响应并翻转一个字节后返回 200。未改原件/派生件文件、描述符 hash 或业务布局。后者若绕过 SRI 而仍接受，预期的失败占位断言就不能通过；不是仅修改界面文案或派发假的失败状态。

| 实际故障 | 重试后 chair 请求数 | 重试后 cabinet 请求数 | 独立结果 |
| --- | ---: | ---: | --- |
| chair HTTP 503 | 2 | 1 | PASS |
| chair 响应摘要不符 | 2 | 1 | PASS |
| cabinet HTTP 503 | 1 | 2 | PASS |
| cabinet 响应摘要不符 | 1 | 2 | PASS |

四例都先断言两个模型各只请求一次，没有在该观察阶段自动重试；浏览器显示一件已加载、一件失败并保留占位模型。选择失败家具后可见失败说明。显式点击“重试失败模型”后，仅失败件增加一个请求，成功件不重新下载；两件重新显示已加载，接受的输入摘要和所选位置与重试前相同。摘要保持 `6e7b888295fee7342f52cdf98b4c13e3a4028756ac19f9fa4f1d3ba9270cd63b`，不以重试偷偷改布局或重新建基线。

独立 `resilience/result.json` 包含四次实际注入及各件请求数；`chair-failed.png`、`cabinet-failed.png` 已实际 `view_image` 检查，确认失败件保留占位形体、另一件仍为真实木纹模型，且页面保留检查与行动清单。通过范围是这些有界故障窗口，不宣称对无限时长的所有网络故障完成证明。

## 窄屏和真实绘图恢复

375×812 CSS viewport 下先要求两件真实派生模型已加载，再用浏览器实际按钮 click 移动椅子和柜体。椅子 z 变为 3.05，柜体 x 变为 0.75，接受的输入摘要改变；页面没有水平溢出，两类角色摘要均保留。已实际查看 `resilience/narrow-real-models.png`：家具选择、移动/旋转/历史按钮折行，场景内两件模型和结果/输出内容可见。

随后调用正在使用的 canvas WebGL2 的 `WEBGL_lose_context.loseContext()`，实际触发上下文丢失。应用显示绘图失败提示，当前输入摘要保持。显式点击“重试 3D 显示”后重新加载两件模型，失败提示消失，新 canvas 与旧对象不同，输入摘要仍保持为窄屏操作后的版本。已实际查看 `resilience/renderer-recovered.png`，确认两件真实模型重新出现且位置延续窄屏修改。没有把人工派发一个 DOM 事件当作真实 context loss。

## 真实模型下的拖动导出保护

`check_web_draft_export.mjs` 新增门禁先等到实际两件模型加载，再执行原有指针和导出保护断言。独立回执 `draft-export.json` 明确记录 `expected_loaded_assets=2`、`source_kind=lux3d_web`。

实际按住家具和拖动预览期间，报告及全部输出入口隐藏；直接调用隐藏按钮也不产生 JSON/快照下载，打印入口调用计数保持 0。`pointercancel` 和切换视角后恢复原已接受报告。合法松手后摘要由 `6e7b888295fee7342f52cdf98b4c13e3a4028756ac19f9fa4f1d3ba9270cd63b` 变为 `47f85c67d9b717dc620657541aa113af8ad1d53cef83327efef43f26c1b6283d`，实际下载的报告 JSON 与场景快照引用同一个新输入 hash，打印入口计数恢复为 1。此专项用受控 `window.print` 计数检验入口门禁；完整主 harness 的真实 PDF 输出仍单独保留，不把调用计数声称为新的系统打印或打印机验收。

## 保留边界

主 harness 结束再次确认输入派生文件字节和公开资产清单未改变；审查者另外核对两份原件仍是交接 SHA。持久 `calibration.json` 两件候选均为 `reviewed=false`，公开 `assets/asset-manifest.json` 仍为空。截图、PDF、模型及完整浏览器回执仅在 `evidence/private`，不进入公开资料。

本次是隔离桌面 Chromium 的 loopback 和 375px viewport 实测，不是真实手机、Edge/Safari、另一设备/网络或正式 HTTPS 托管验收；没有新正式性能 p95。没有代用户接受中国站条款或认定公开再分发权利。父线程报告的 `a192d51184393187a9e1d98e9c92cd2da06b1dd7` 仍不可取得，本分支未读取、包含或合并其断网恢复/材料成果；本次故障回归不冒称已整合另一分支。没有推送、公开部署、原件上传或收费调用。

## 留存公开来源与最终交接复核

**有界结论：PASS。** 独立审查者实际读取了环境私下留存的官网 HTML、其直接引用的客户端脚本、协议原始响应及元数据；仅复核已有字节，没有重新 HTTP 获取、登录、运行来源浏览器或接受条款。HTML 中以 `//` 开头的 script URL 按官网 HTTPS 补全后与回执一致，活动 HTML/两份脚本及协议响应的 SHA 与来源摘要相符。协议客户端确实使用同站相对 GET `/aholo/api/app/agreement/info` 和 `type=pc_user_policy`；留存响应成功码为字符串 `"0"`，正文12982字符，更新日2026-03-05、发布日2025-12-08。其默认服务用途限制与另行协议/订单优先安排均有原文支持；这不证明该协议原样适用于具体 Lux3D 账号、套餐或订单，更不构成原/派生 GLB 站外再分发许可。

已核对活动客户端支持中国站2026-11-19 19:00（+08:00）截止、PDF/PPT类报告、Lux3D核心/API可选，以及在线Demo应至少覆盖2026-12-31并延续至实际获奖结果公布且公示完成后30日。维护以实际公示完成日计算，不能只用公布日或预计排期。全文仍留环境私下；本次只核实留存来源与项目摘要相符，不把公开文案当作已登录表单或提交回执。既有浏览器留存诊断为CA链错误，没有用该错误充作成功页面证据。

`LOCAL_READINESS`、三份 `local-readiness` 摘要、当前 HANDOFF/START_HERE/task-status、规则跟进记录和维护执行单一致保留五项本人/外部条件：可读a192恢复件、实际账号/模型及源码授权、获准托管入口与责任人、登录表单和本人声明、真实设备与第二网络。a192 Git 对象当前仍不存在，未被当作已取得或已合并；性能继续暂缓且OPEN_NOT_MET，许可/公网/正式提交门禁没有误关。私下使用摘要的两个场景 hash 和逐件检查状态另用当前 canonical RuleEngine 独立复算吻合，公开资产映射仍为空。这一结论只关闭本轮可独立事项的清点与交接，不把T00–T14整体标为完成，也不覆盖另一线程成果。
