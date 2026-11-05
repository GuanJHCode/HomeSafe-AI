# 真实 Lux3D 私下验收（2026-11-05 UTC）

已从官方 Library 流程取得两件匹配 SHA 的原件及代码恢复包，恢复到隔离目录并核实 `ba21f54ace3218cfa2d695092b735165c923b1b9`。原件真实浏览器完整交互通过；独立前后对照确认两件的来源正面均为 `+Z`，旋转 π 后映射到场景 `-Z`。原件不是完整 glTF 规范通过：零法线缺陷只在独立私下派生件修复。公开清单保持空，原件、派生 GLB、截图/PDF 和浏览器目录没有公开提交、上传或发布。

本轮分支为 `codex/real-lux3d-private-20261105`。实现和浏览器版本以本轮摘要及本地最终交付回执为准；[独立审查](REVIEW_REAL_LUX3D_20261105.md)区分原件与派生件的实际验证。T03 整体仍受公开分发权利阻断，不将私下通过写成公开发布或正式提交完成。

父线程告知另一线程已在 `ba21f54` 之后本地提交 `a192d51184393187a9e1d98e9c92cd2da06b1dd7`，包含受控断网恢复、开发报告与占位演示；其包当前不可跨环境取得。本轮没有读取、包含、覆盖或合并该提交，不能声称此分支拥有其成果。交付提供本轮独立分支完整 bundle 和仅相对 `ba21f54` 的补丁；取得另一分支后应将本轮提交 cherry-pick 到其隔离续作分支，合并 HANDOFF/task-status/START_HERE 及两份清单时保留两边已完成事项。未执行对不可读提交的猜测合并。

## 取得与恢复

- 当前环境 `environment_status`：`observations_current=true`，实例 `running/connected`，公网策略 `unrestricted/enforced`。本地 `/etc/codex/network-policy.json` 同样为 unrestricted；VPN 未配置。全程未改安全设置、代理或 TLS 信任。
- Library 原件包 `libfile_7d1a1032181c8191a7218b5e07a28102`、恢复包 `libfile_1f217667582c8191a9ccb23bb2c1beb5` 通过 `prepare_materialize` 和本轮技能随附的两份助手物化；完整 transfer 交给助手，身份 xattr 已保留。没有猜下载地址或绕过拒绝。
- 恢复包四项 SHA、完整 Git bundle/fsck、基线全部 853 项源码摘要通过。bundle 未声明默认 HEAD，克隆后显式切换其唯一恢复分支得到精确 `ba21f54`，未覆盖已有 `/workspace/HomeSafe-AI`。
- 根 AGENTS 和 V6.1 入口已读取；仓库 `.agents/skills` 未提供额外技能。使用 Python 3.13.5、Node 24.19.0、Chromium 154.0.8037.57、固定 puppeteer-core 24.15.0。
- 官方 Pyodide 314.0.6 首次下载收到 HTTP 503；同一固定摘要下载器一次重试成功，10 个官方文件均按原锁验证后暂存，没有修改版本或锁。Python venv 的 ensurepip 缺失通过 uv 安装至同一 Python 3.13 venv 解决；npm 缓存显式放在可写临时目录。

## 原件真实验收

| 对象 | 原件 SHA-256 | 原件三角形 | 合成目标 W/H/D |
| --- | --- | ---: | --- |
| chair | `e2606d75f4ef91a7395b9447ca5d65d972fd38595bcf53d6c6ef11ee9462e71a` | 99798 | 0.50 / 0.80 / 0.50 |
| cabinet | `a8398b16be4d4d2f0c7c703575d0679ce16cc3aeacc276af48c9d26379ad940b` | 99687 | 0.70 / 1.60 / 0.50 |

`node scripts/check_private_asset_geometry.ts` 及 `CI=1 node scripts/check_private_assets.mjs` 均显式传入上述原件、两项 `--*-front +Z`、`--provenance lux3d_web`、隔离 Chromium 和驱动。私下输出分别为 `evidence/private/lux3d-geometry-20261105` 与 `evidence/private/lux3d-browser-20261105`；独立审查另用新端口和输出目录重跑。

真实 WebGL/GLTFLoader 两件均解码基础色和金属度/粗糙度纹理。已实际查看校准、应用、挑战截图：椅子四腿、靠背及坐面开口可辨，柜体双门与把手和木纹可见，没有整件贴图丢失或明显整体缺件。独立 `+Z/-Z` 对照确认误声明 `-Z` 会显示后背，未仅以四元数映射断言代替目视。

尺寸拟合、底部中心、平移、0/90/180 度旋转、多实例及释放通过。独立探针直接检查实际 `SceneRuntime` 的已加载 visual 与 hitProxy，世界包围盒吻合；柜体 90° 宽深实际由 0.7/0.5 交换为 0.5/0.7。代理仍是整件长方体，保守占据椅腿间空隙，不是逐三角形碰撞或物理仿真。

当前设计采用非均匀样例拟合：椅子宽深比相对原件增加约 18.23%，柜体约减少 0.586%，两者高度也有不同程度缩放。视觉仍可用于本次合成教学场景；这不是等比例保真、实物测量或人体工学校准。没有为外观偷偷改变业务尺寸、traits、角色能力、规则或挑战输入。

完整应用实际通过：真实指针拖动与单次撤销、非法摆放回弹、双角色、布局冲突、重做/重置/旋转、挑战剩余问题、柜体三种不同合法解和非法计数、三个模式的独立布局、JSON、中文打印 PDF、三种场景快照原生 Python 独立重算、刷新及不刷新页面的真实 Worker 重建。刷新和恢复后仍要求两件真实模型已加载。原件和公开 catalog 字节未变；持久校准候选仍为 `reviewed=false`。

## 格式缺陷与私下派生修复

Khronos 官方 `gltf-validator@2.0.0-dev.3.10` 本轮实际验证原件，chair 为 20 个、cabinet 为 24 个 `ACCESSOR_VECTOR3_NON_UNIT` 错误，另各 4 个 `BUFFER_VIEW_TARGET_MISSING` hint；不能因浏览器载入成功将它们标为完整规范通过。零法线均关联退化或很小的三角形。原始完整报告仅在 `evidence/private/lux3d-validation-20261105`。

[私下修复工具](../scripts/repair_private_glb_normals.py)只支持本批简单、内嵌资源、单 primitive 的 indexed TRIANGLES GLB。它不修改原件，对零法线优先复制精确同位置顶点的合法法线；无此来源时按邻接面面积向量重建，无几何依据则拒绝。只替换零法线的字节并补齐 bufferView target 和法线 min/max 元数据；POSITION、索引、UV、图像、非零法线及场景变换保持原样。

运行方式：

```bash
.venv/bin/python scripts/repair_private_glb_normals.py \
  --input /absolute/path/to/original.glb \
  --output evidence/private/new-derived-object
```

输出为新目录中的 `model.glb` 和 `repair.json`，保留原件/派生件 SHA、逐顶点修复方法及权利状态。输出路径只允许 `evidence/private` 下不存在且无符号链接的新目录；不支持的布局和无证据法线拒绝。原件仍保留20/24格式错误，派生件通过不回写或替换来源记录。

专项回归先保留导入红灯、图片缓冲区别名/外链两项红灯。独立审查又发现 POSITION 与 NORMAL 共用同一 bufferView 会被误修，现已保留独立反例与红灯并明确拒绝所有共享法线 view；专项九项绿灯。不能把这个修复声称为原件已无缺陷或生产级拓扑修复。

实施侧两件私下派生件经无忽略项、无降级的完整 Khronos 验证，均为 **0 error / 0 warning / 0 info / 0 hint**。派生件使用原来源链，但有独立新哈希，不能标为未改写的 Lux3D 原始导出。派生件完整浏览器及独立复审结果见本轮汇总与审查，原件和派生件的实际证据分开保留。

独立复审已完成：重新生成的派生 GLB 与实施件逐字节一致；审查者独立实际运行四份 Khronos 原/派生验证并重跑派生完整浏览器流程。校准、应用和挑战三张 PNG 与其独立原件运行逐字节相同，当前镜头未见修复带来的视觉变化。只关闭私下方向/交互与派生修复子项，公开权利及 T03 整体不关闭。

本轮最终原生 Python **343/343**（包含新增9项修复测试）、应用 **39/39**、浏览器探针 JS **24/24** 和脚本 JS **24/24**、8项包检查通过；canonical 契约、严格 TS 契约检查、Vue 类型检查、构建分发校验及真实 Pyodide 一致性通过。机器可读结果见[本轮摘要](real-lux3d/validation-summary.json)。

## 保留限制

没有重跑正式性能 p95；功能 harness 附带的单次就绪时间不是首次可编辑预算证据。历史 4812.2 ms 及 3 秒 `OPEN_NOT_MET` 按既有用户优先级保留，CI 预算/enforce/失败传播逐字节未改。本轮没有新远端 CI、推送、master 合并、公开托管、原件上传、收费生成或正式赛事提交。

公开分发仍需要本次中国站账号适用条款及授权；正式 HTTPS、其他浏览器/设备/网络、固定同版最终报告/视频、账号表单及提交回执仍未完成。提交预检仍 `BLOCKED`、退出2。可核查的本地结果不替代这些外部门禁。
