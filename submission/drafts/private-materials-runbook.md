# 真实模型私下材料复现与交接

状态：PRIVATE_DRAFT_WORKFLOW。此流程只生成私下开发材料，不批准模型公开分发、网站发布或正式提交。当前产品App/Core锚点为5001222413937586604e8d944ba83787c7cb06fa；捕获工具冻结提交为c1d794b6ba548b450cce7e1a4dffe107500c591d。完整材料由该工具提交实际生成，最终证据另见[材料记录](../../evidence/PRIVATE_REAL_MATERIALS_20261105.md)。

## 现有产物与前置条件

当前隔离工作区的完整产物在 `evidence/private/development-materials-real-full-c1d794b-20261105/`：4页开发报告PDF、221.72秒/5543帧H264视频、原WebM、实际JSON/快照/打印清单、原件→派生来源与五项覆盖收据。该目录不进入Git、源码包或公开CI artifact。恢复代码bundle不会恢复这些私下媒体或模型；不要把文件缺失误判为已有产物损坏。

在同一现存环境可直接验证已有manifest，无需重复录制。跨环境复现时，按START_HERE恢复完整Git历史、固定Python/Node/Chromium/puppeteer-core、官方Pyodide与FFmpeg/ffprobe、Poppler、Noto CJK字体。通过官方Library流程取回自己的模型包，保持原件私下不变，不猜下载地址。模型原/派生和依赖目录不能加入source allowlist。

两件原件SHA为chair `e2606d75f4ef91a7395b9447ca5d65d972fd38595bcf53d6c6ef11ee9462e71a`、cabinet `a8398b16be4d4d2f0c7c703575d0679ce16cc3aeacc276af48c9d26379ad940b`。使用已审的私下零法线修复流程，分别保存新派生GLB与repair.json；本次派生SHA是chair `296935f947dabf72026764d71d1df9f85d353d2062c7745b187ad21b417a07fc`、cabinet `92944741a7e9f2491f9220c9dff3f95d66190db80a2488a5d029fbe1b3de3350`。不要覆盖原件或用其他模型冒充。既有修复和真实方向/代理审查见[真实模型记录](../../evidence/REAL_LUX3D_PRIVATE_20261105.md)。

## 准备私下输入

在当前代码/运行时下运行既有private intake，显式声明两件source-front均为+Z。它的GLTFLoader校准、纹理解码/拟合/原点及场景绑定必须通过；保留输出calibration.json，其持久候选reviewed仍为false。方向的视觉确认与公开授权分开。本次实际复用了前阶段匹配同一派生SHA、相同App/Core的已审校准。

在ignored `evidence/private/` 新目录写inputs.json，结构如下。路径替换为本人的实际私下文件，SHA从实际文件与repair记录读取；不是照抄示例就算通过。

```json
{
  "provenance": "lux3d_web",
  "calibration_file": "/absolute/private/calibration.json",
  "models": [
    {"id": "chair", "path": "/absolute/private/chair-derived.glb", "sha256": "ACTUAL_DERIVED_SHA256", "original_path": "/absolute/private/chair-original.glb", "original_sha256": "ACTUAL_ORIGINAL_SHA256", "repair_record": "/absolute/private/chair-repair.json"},
    {"id": "cabinet", "path": "/absolute/private/cabinet-derived.glb", "sha256": "ACTUAL_DERIVED_SHA256", "original_path": "/absolute/private/cabinet-original.glb", "original_sha256": "ACTUAL_ORIGINAL_SHA256", "repair_record": "/absolute/private/cabinet-repair.json"}
  ]
}
```

生成器支持当前两件Y-up/+Z→场景-Z、居中底部原点的runtime_axis_fit校准；不同姿态或数据需要另行校准/审查，不能只改PASS字段。临时runtime reviewed=true仅测试现有门禁，输入候选、public catalog、dist均不被修改。

## 捕获与核验

先按START_HERE生成普通占位dist。仅在loopback静态服务上提供它的 `/preview/` 入口，服务目录不包含模型或私下输出。检查当前Git/App/Core干净且与500锚点一致。私下GLB只经主页面精确5条CDP请求覆盖，其他Worker请求不暂停；不要恢复全局Puppeteer透传拦截，已有实际挂起反例。

命令中的浏览器/driver/Python及输入配置为真实本机路径，输出必须是尚不存在的 `evidence/private/development-materials-*` 目录：

```bash
CI=1 node scripts/create_development_materials.mjs \
  --url http://127.0.0.1:42731/preview/ --chrome /path/to/chromium \
  --driver /path/to/puppeteer-core.js --python /path/to/venv/bin/python \
  --output evidence/private/development-materials-real-new \
  --expected-head "$(git rev-parse HEAD)" --mode full \
  --private-models evidence/private/private-inputs/inputs.json
```

首次配置可用新目录和 `--mode trial` 验证，不把短试当完整片。工具检查完整片180–240秒、两模型加载、实际操作/回弹/未知保留、真实下载、canonical快照复算、11输出与6工具摘要，输出materials-manifest.json和五项private-binding.json。录制在规则与模型就绪后开始，没有音频，不是冷启动性能测试。FFmpeg包装器只调整压缩工作量preset，保留输入、FPS、时间与质量参数；不承诺不同preset逐像素相同。

独立审查须实际查看全部PDF页、足够操作阶段视频实帧，核对纹理/椅子开口/柜门把手/方向及两角色取舍；检查原/压缩全部帧的相对PTS、时长/帧数、same revision/hash/ruleset、原件派生与覆盖摘要。发生失败保留整个目录，修复后用新目录，不覆盖失败产物。结束后关闭自己启动的浏览器与loopback服务器。

## 提交准备与真正外部条件

本机另有ignored `evidence/private/submission-preparation-c1d794b-20261105/`，包含实际源码/文件descriptor、canonical最终场景、两件私下GLB与来源链、功能到视频阶段的近似映射、如实限定的私下验收。按原检查器运行该private-draft-manifest.json仍应BLOCKED/退出2；它不修改正式submission-manifest，也不批准public rights。

技术准备已核对文件可读、SHA、PDF/视频解析和场景/模型映射，不应再交本人重新整理这些字段。仍需本人/权利方确认账号适用条款与源码/模型公开许可，指定获准托管/主备用URL/维护责任并授权发布，核对本人表单声明与提交授权，提供实际Edge/Safari/另一网络条件。Agent可在条件具备后继续目标站验收与最终材料冻结。维护到至少max(2026-12-31,实际公示完成日+30天)，公布/公示完成日期均未知时不安排关停。
