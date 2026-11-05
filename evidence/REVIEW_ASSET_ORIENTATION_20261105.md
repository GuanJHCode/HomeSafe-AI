# T03 私下资产方向校准独立审查（2026-11-05）

**结论：方向校准工具子项 PASS；T03 真实 Lux3D 模型与公开分发权利仍 BLOCKED。** 此结论由独立审查 agent 在 `codex/continuation-after-download-20261105` 的未提交工作树上作出，基线提交为 `be32202bbaeafd9fcfde84601c22fb5a981fab6c`。审查只覆盖 `candidateCalibration`、两条私下 CLI、程序夹具、私下浏览器检查及对应 CI 参数和接收文档；未审查同轮 UI 功能、性能或发布。审查者未改实现、未推送、未部署，也未把原始模型放进公开目录。

## 审查发现与修复

1. 原实现固定单位四元数；仅以 bbox 验证会漏掉前后 180° 反转。[基线反例重放](continuation-next/orientation/red-identity.log)中，未修改的 `be32202` helper 把非对称 `+Z` 正面仍映到 `+Z`，测试按预期失败。修复后明确声明的 `+Z/-Z/+X/-X` 都映到场景 `-Z`；未知方向及每件缺失声明均拒绝。`+Z` 的 Y 旋转为 π，正面标记随后出现在场景相机所在的 `-Z` 侧。旋转后重新计算 bbox 与底部中心。
2. 审查时发现私下页面将仅供 runtime 门禁使用的 `reviewed=true` descriptor 原样写进 `calibration.json`。实现者保留该 descriptor 只在内存中供 `AssetLoader` 运行，并将写盘候选复制为 `reviewed=false`；脚本写后读回断言两个候选均为 false。审查者独立检查全套持久 JSON，没有 `"reviewed": true` 字段。
3. 审查时发现 Node 几何脚本将原 `source` 直接交给 `AssetLoader.normalize`，会改变其 parent，却报告源对象未变。实现者改为传入 `SkeletonUtils.clone(source)`，并对原对象 parent、序列化结构、bounds 与原始 GLB 字节做前后断言。独立复测通过。
4. 程序夹具截图底部的状态文案已明确写为“程序夹具 GLB”，并说明它不是实际 Lux3D、公开授权或 T03 整体验收。私下流程文档也保留了方向候选、视觉及权利待验的边界。公开 `assets/asset-manifest.json` 与 `apps/web/public/engine/assets.json` 无方向子项改动。

## 独立复测

| 检查 | 独立结果 |
| --- | --- |
| 临时 Node 几何探针，非居中 root、四种 `sourceFront`、正面 marker、旋转后 bounds/pivot、场景 0/90/180° yaw 与平移、两实例释放、源对象不变 | PASS；四种方向的 marker 均在 body 的 `-Z` 侧；6 个空值/非法方向被拒。记录：[independent-node-geometry.json](continuation-next/orientation-review/independent-node-geometry.json)。 |
| 两条私下 CLI 的逐件必填/非法方向 | 8 个拒绝用例 PASS，均未创建输出目录。记录：[cli-rejections.json](continuation-next/orientation-review/cli-rejections.json)。 |
| 独立程序 GLB，经 Node 私下几何脚本 | 两件 PASS；`geometry.json` 两个候选均 `reviewed=false`，`source_object_unchanged=true` 与 `raw_bytes_unchanged=true`。[stdout 摘要](continuation-next/orientation-review/independent-geometry-stdout.json)。该夹具有偏移 root 和独立红色 `+Z` 标记；SHA-256：chair `d8bbb6fe891bffa460f613fccf445f2d3a7830893bbd90478565c9f6cc0e4e83`，cabinet `8d4fa71402ad087e31067f4f54834c0cc149b5591a84a41e452495f78c4bc6e2`。 |
| 独立 Chromium 154 程序 GLB 浏览器探针 | PASS；真实 `GLTFLoader`、`AssetLoader` 与 WebGL 2 渲染；chair 与 cabinet 的 marker 世界 z 均为约 `-0.2483`，body 为约 `+0.0193`，截图目视可见红色标记在正面。JSON：[independent-chromium-procedural.json](continuation-next/orientation-review/independent-chromium-procedural.json)；截图仅在忽略的 `evidence/private/orientation-review-procedural-20261105/`。 |
| 完整私下 Chromium harness，另生成两件程序纹理 GLB | PASS；两件 marker、纹理解码、拟合、底部中心、旋转、多实例及完整应用交互通过；写盘 `calibration.json` 的 `reviewed` 为 `[false,false]`，`result.json` 保留 `rights_status=PENDING`，公开 catalog 未改。记录：[independent-harness-summary.json](continuation-next/orientation-review/independent-harness-summary.json)；完整私下回执位于忽略的 `evidence/private/orientation-review-independent-harness-20261105/`。 |
| 180° 反向反例 | PASS（按预期拒绝）：实际 `+Z` marker 的程序 chair 若声明 `--chair-front=-Z`，Chromium 返回 `Procedural +Z front did not rotate toward the scene camera at -Z`。记录：[wrong-front-rejection.json](continuation-next/orientation-review/wrong-front-rejection.json)。 |
| 定向测试与类型检查 | `node --test apps/web/tests/private-asset-calibration.test.ts scripts/private_asset_inputs.test.mjs`：7/7 PASS；`npm --prefix apps/web run typecheck`：PASS。 |

本审查的 Chromium 在独立 loopback 端口和隔离 profile 运行，未复用固定 `4173` 预览 host，也未进行性能计时。程序截图与 GLB 均位于 Git 忽略位置，未纳入证据正文、公开仓库或恢复包。实现者的另一次程序夹具回归摘要在 [fixture-summary.json](continuation-next/orientation/fixture-summary.json)，本结论以以上独立复测为主。

## 未覆盖与解除条件

本环境没有与交接 SHA-256 匹配的真实 chair `e2606d75f4ef91a7395b9447ca5d65d972fd38595bcf53d6c6ef11ee9462e71a` 和 cabinet `a8398b16be4d4d2f0c7c703575d0679ce16cc3aeacc276af48c9d26379ad940b` 原件字节。因此 `+Z` 对实际两件模型仍是另一环境六视图诊断支持的**待视觉确认候选**；本轮 Node/程序 Chromium PASS 不能替代真实 Lux3D 浏览器目视、完整交互和公开分发权利核验。取得原件并核对摘要后，须在可运行 Chromium 的私下环境重新执行两条 CLI、人工看正面/纹理/代理一致性、保留权利证据，并再次独立审查，方可推进 T03。

Node `parseArgs` 对以负号开头的选项值使用 `--chair-front=-Z` 或 `--cabinet-front=-X` 写法；带空格的 `--chair-front -Z` 会报参数歧义。接收文档现已明确该写法，四种方向都可显式传入。
