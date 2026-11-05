# 真实 Lux3D 私下验收独立审查（2026-11-05 UTC）

结论：**真实原件的方向、纹理、合成尺寸拟合、实际场景代理和交互子项 PASS；私下零法线派生修复工具及派生件的规范/浏览器复测 PASS。原件本身的完整 glTF 规范检查仍 FAIL（零法线），公开分发权利仍 PENDING。** 不据此关闭 T03 整体、公开部署、实物校准或赛事提交门禁。派生件有独立 SHA 和来源链，不能称为未经改动的原始导出。

本审查由独立 agent 在 `/workspace/homesafe-private/app` 的 `codex/real-lux3d-private-20261105` 分支执行。应用验收基线为 `ba21f54ace3218cfa2d695092b735165c923b1b9`。审查者没有修改应用实现、公开资产清单或原始模型，没有推送、部署或上传原件。已读取根 AGENTS、START_HERE、V6.1 总体方案、交付计划和私下接收文档；仓库 `.agents/skills` 未提供额外技能。

## 原件和独立方法

审查者分别在 Node 和浏览器中重新计算真实字节 SHA-256：

| 原件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| chair_lux3d_g1_30471.glb | 10352404 | `e2606d75f4ef91a7395b9447ca5d65d972fd38595bcf53d6c6ef11ee9462e71a` |
| cabinet_lux3d_g1_30475.glb | 8689480 | `a8398b16be4d4d2f0c7c703575d0679ce16cc3aeacc276af48c9d26379ad940b` |

独立探针 `evidence/private/reviewer-real-lux3d/probe.mjs` 只监听 `127.0.0.1`，原件经内存路由供隔离 Chromium 154.0.8037.57 使用。它直接导入应用的 `AssetLoader`、`candidateCalibration` 和 `SceneRuntime`，没有复制应用几何或代理生成实现。运行命令为 `node evidence/private/reviewer-real-lux3d/probe.mjs`；数值回执为同目录 `independent-result.json`。生成的 `front-back-comparison.png` 和 `actual-runtime-proxies.png` 均已通过 `view_image` 实际目视检查。截图和探针留在 Git 忽略的私下目录，不进入公开分发包。

探针最初遇到审查脚本的 `near` 函数作用域错误，保留 `probe-initial-tool-error.log` 后修正。随后主动加强父世界矩阵刷新和显式位姿/尺寸断言，避免仅比较两个未更新边界。最初的探针数值副本标为 `independent-result-initial-tool-probe.json`，不作为最终旋转/平移证据；最终回执包含柜体 90° 后宽深互换和两件模型平移至 `(2.5, 0, 1.5)` 的实际边界。

## 真实视觉与代理结果

| 检查 | 独立实际结果 |
| --- | --- |
| 源正面 +Z/-Z | PASS。原件 +Z 侧可见椅子坐面开口和柜体双门把手；-Z 侧为椅背后侧和柜体背板。两件原件均应声明 `+Z`。 |
| 映射至场景 -Z | PASS。明确声明 `+Z` 后 Y 旋转 π，负 Z 视角看见椅子正面和柜体把手。误声明 `-Z` 的同机对照明确显示背面，作为方向反例保留在对照图最后一列。 |
| 真实纹理解码 | PASS。基础色及金属度/粗糙度纹理在真实浏览器中解码为 2048×2048；实际木纹与柜门把手清晰可见，没有整件贴图缺失或大块模型缺失。该结论不等于生产级拓扑验收。 |
| 实际 SceneRuntime 代理 | PASS。直接检查实际创建的 `hitProxy` 和已载入 `visual`，0°、90°、180°及平移后的 min/max 六轴边界在 1e-5 内一致，落地 y=0，底部中心吻合。截图显示实际代理框包围真实模型。 |
| 包围盒代理语义 | 使用应用既有的整件长方体代理；椅腿间空隙仍被保守占据。这里只验证该既有代理与拟合模型外包围盒一致，不宣称逐三角形碰撞、人体导航或物理仿真。 |
| 原件保护与候选状态 | PASS。探针运行后原件 SHA 未变；持久候选 `reviewed=false`。`reviewed=true` 只用于内存中的加载门禁测试。公开 `assets/asset-manifest.json` 仍为空。 |

拟合数值经过独立重新测量，单位仅是原始模型坐标与合成场景输入：

| 对象 | 原始边界 W/H/D | 合成目标 W/H/D | 各轴缩放 W/H/D | 宽深比相对变化 |
| --- | --- | --- | --- | --- |
| chair | 0.488228 / 0.850000 / 0.577219 | 0.5 / 0.8 / 0.5 | 1.024111 / 0.941176 / 0.866223 | +18.227% |
| cabinet | 0.682270 / 1.800000 / 0.484481 | 0.7 / 1.6 / 0.5 | 1.025987 / 0.888889 / 1.032032 | -0.586% |

这是当前设计明确采用的非均匀样例拟合；椅子相对原件略宽浅，柜体略矮，目视仍保持可辨识的家具形态，满足本次合成教学场景范围。它不是等比例保真、原图忠实度、实物尺寸或人体工学校准通过；如后续要求保持原件比例，应另行调整已接受的场景尺寸及代理，不能把当前样例数值当真实测量。

## 独立完整浏览器重跑

审查者另行运行仓库现有私下 harness，未复用实施者浏览器：

```bash
CI=1 node scripts/check_private_assets.mjs \
  --chair '/workspace/homesafe-private/original-assets/Lux3D_家具原始模型交付包/01_原始模型/chair_lux3d_g1_30471.glb' \
  --cabinet '/workspace/homesafe-private/original-assets/Lux3D_家具原始模型交付包/01_原始模型/cabinet_lux3d_g1_30475.glb' \
  --chair-front +Z --cabinet-front +Z --provenance lux3d_web \
  --chrome /usr/bin/chromium \
  --driver /workspace/homesafe-private/browser-driver/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js \
  --output evidence/private/reviewer-real-lux3d-full-20261105
```

结果为 `PASS / PRIVATE_LOOPBACK_LUX3D_INPUTS`。`result.json` 中实际完成的项目包括椅子真实指针拖动与单次撤销、非法摆放回弹、双视角、布局冲突、重做/重置/旋转、挑战剩余检查与覆盖说明、JSON/打印清单、原生 Python 独立复算三种下载快照、柜体主挑战三种不同合法解及旋转、非法计数及固定对象、三个模式分别保存布局、刷新和真实 Worker 重建恢复。刷新及恢复后仍要求两件真实模型载入。三个快照均为 `MATCHES_CURRENT_CORE`；持久 `calibration.json` 两件均为 `reviewed=false`。审查者还实际查看该次 `real-models.png` 与 `challenge.png`，确认真实模型出现在完整界面、挑战保留剩余问题和未知覆盖说明。

这次 harness 的附带单次冷/热就绪时间不是严格性能 p95 或 3 秒预算通过证据；本审查没有执行正式性能、真实设备或外网托管验收。

## 原件规范缺陷与保留门禁

审查者先复核实施侧报告，随后独立实际运行 Khronos `gltf-validator@2.0.0-dev.3.10`，确认原件 chair **20** 个、cabinet **24** 个 `ACCESSOR_VECTOR3_NON_UNIT` 错误，两件各 **4** 个 `BUFFER_VIEW_TARGET_MISSING` hint、零 warning。浏览器可以载入不等于 GLB 完整符合规范；原件缺陷不被抹除，原件与来源 SHA 继续保留。独立实际输出位于忽略目录 `evidence/private/reviewer-real-lux3d/validator/{chair,cabinet}-original.json`。私下派生件修复和复验见下节。

公开再分发权利、适用账号条款、正式 HTTPS 托管、其他浏览器/设备/网络、最终同版材料和正式提交回执仍未完成。本审查没有代用户确认条款或创建收费生成任务。

## 私下派生修复工具复审

**结论：`scripts/repair_private_glb_normals.py` 在本批简单自包含单 primitive TRIANGLES GLB 的明确范围内 PASS。** 工具只生成新的 `evidence/private` 子目录，不改原件、不改公开 catalog；拒绝已有输出和输出路径中的符号链接。它只补零法线，优先复制精确同坐标的合法法线，没有同坐标供体时才按原始索引的邻接非零面求单位法线；无几何依据、非零非单位法线、sparse/stride/异常范围等不支持条件会拒绝，不重建整个模型。

审查者发现并保留了一个真实工具缺陷：若 POSITION 与 NORMAL accessor 共用同一 bufferView，旧检查会让零法线写入同时改动坐标，却报告受保护字节未变。独立反例 `evidence/private/reviewer-real-lux3d/overlapping-position-counterexample.json` 记录顶点从 `(0,0,0)` 变为 `(0,0,1)`。实施者把反例纳入 `test_position_cannot_share_the_normal_buffer_view` 并实际保留红灯 `normal-repair-overlap-red.log`；修复后拒绝所有其他 accessor 共用法线 bufferView。另有 image alias 与外链图像反例也被拒绝。审查者复读修复源码并独立执行 `.venv/bin/python -m pytest reference/tests/test_private_normal_repair.py -q`：**9/9 PASS**，日志为 `evidence/private/reviewer-real-lux3d/normal-repair-tests.log`。没有遗留阻止本工具子项关闭的问题。

当前已审查源码 SHA-256：

- `scripts/repair_private_glb_normals.py`：`922b0d390de098f475aca6468685e3b8f32b7de4067ba06b6fe9c2f2083ade84`
- `reference/tests/test_private_normal_repair.py`：`41fd7d9814a0e2bb728609612fd717ba637a6eae2fd2f7b90118324cc566ddd2`

## 独立重建与字节约束

审查者分别通过实际 CLI 从真实原件重建至 `evidence/private/reviewer-derived-{chair,cabinet}-20261105/model.glb`，再用独立编写的 JSON/BIN 解析和逐字节比较核验，没有依赖修复工具自己的 `protected_binary_bytes_unchanged` 声明。

| 对象 | 派生 SHA-256 | 修复的原零法线数 | BIN 实际变化字节 |
| --- | --- | ---: | ---: |
| chair | `296935f947dabf72026764d71d1df9f85d353d2062c7745b187ad21b417a07fc` | 20 | 240 |
| cabinet | `92944741a7e9f2491f9220c9dff3f95d66190db80a2488a5d029fbe1b3de3350` | 24 | 156 |

两件独立重建的完整文件都与实施者派生件逐字节相等。变化的法线向量索引恰好等于原件中全零向量索引；全部 BIN 差异均局限于这些向量各自的 12 字节区间。所有非零法线、POSITION、索引、UV、嵌入图片的原字节完全保持。新法线长度在 1e-6 内为 1。JSON 的语义变化只有四个 bufferView.target 及 NORMAL accessor 的 min/max 更新，其余完整 JSON 对象相等；原件源字节与 SHA 保持不变。详细回执为 `evidence/private/reviewer-real-lux3d/independent-derived-bytes.json`。此修复不处理退化三角形、非流形边或生产级拓扑，不改变物理尺寸或再分发权利。

## 独立规范与派生浏览器复验

审查者从已安装的官方 `gltf-validator/index.js` 实际对原件及独立重建派生件各运行一次 `validateBytes`，使用 `maxIssues:0`、拒绝外部资源，没有 `ignoredIssues`、`severityOverrides` 或问题降级。

| 文件 | errors | warnings | infos | hints |
| --- | ---: | ---: | ---: | ---: |
| chair 原件 | 20 | 0 | 0 | 4 |
| chair 派生件 | 0 | 0 | 0 | 0 |
| cabinet 原件 | 24 | 0 | 0 | 4 |
| cabinet 派生件 | 0 | 0 | 0 | 0 |

完整独立报告及汇总为 `evidence/private/reviewer-real-lux3d/validator/`。原件并没有因为派生件 PASS 而被重标为规范通过。

审查者以独立重建派生件为输入，再实际运行完整 `check_private_assets.mjs`：参数与原件重跑相同，仅 chair/cabinet 改为 `evidence/private/reviewer-derived-{chair,cabinet}-20261105/model.glb`，输出 `evidence/private/reviewer-derived-browser-20261105`。结果 **PASS**，输入回执正确记录两件派生 SHA；真实拖动、回弹、旋转/撤销、三种柜体解、挑战、JSON/打印、三种快照原生重算、刷新和 Worker 恢复均再次通过。`lux3d_web` 只表示从该 Lux3D 来源链派生，不表示其字节仍是原始导出。

派生件 `calibration.png`、`real-models.png` 和 `challenge.png` 均已实际 `view_image` 目视复核，正面方向、木纹和界面表现保持一致。进一步比较这三张独立原件/派生运行截图，其 PNG 字节分别完全相同；回执在 `evidence/private/reviewer-real-lux3d/derived-screenshot-comparison.json`。该结果支持当前相机、光照和姿态下无视觉退化，不外推为所有视角或生产级网格质量保证。持久校准仍为 `reviewed=false`，公开资产清单仍为空，所有原件、派生件、截图、PDF和完整回执均留在忽略的私下目录。
