# T10 本地开发材料回执

本目录只归档可公开审查的文本与合成场景 JSON。实际 4 页中文报告 PDF、198.52 秒 H.264 连续录屏、原始 WebM、打印 PDF、HTML 与抽帧仍在 `evidence/private/development-materials-final-20261105-2/`，不得加入 Git 或恢复包。PDF 为 `DRAFT_NOT_SUBMITTABLE`，视频为 `LOCALHOST_PLACEHOLDER_DEVELOPMENT_RECORDING`，无音频；二者均非正式参赛提交。

录制绑定源码 HEAD `ba21f54ace3218cfa2d695092b735165c923b1b9`。录制时项目工作树有未提交的工具和文档改动，App/Core 相关源码与该 HEAD 一致。Chromium `154.0.8037.57` 操作的是 `http://127.0.0.1:4173/preview/`，本地 HTTP 资源与 dist 文件字节一致。输出仅使用合成客厅和程序占位家具。`materials-manifest.json` 记录场景版本、输入摘要、规则集、来源状态、步骤、浏览器、文件哈希与限制；`final-audit.json` 保存事后只读验证命令的实际 stdout、stderr 和退出码。原始完整录制命令的独立 stdout/stderr 未另存，不能从事后核验伪造。

用户可审阅的实际软件流程包括儿童/老人两种视角、检查依据、合法移动引出的取舍、撤销和重新摆位、挑战达标后的未决项，以及同版行动清单 JSON、场景快照与打印清单。快照由当前 Python 内核复算匹配。报告和视频的 SHA-256、时长、PDF 页数见 `materials-manifest.json`；本目录 `action-list.json` 和 `scene-snapshot.json` 是对应的合成导出。

`failure-counterexamples.json` 保留首次试录 TDZ 错误、首轮长录 241.92 秒超时及打印清单混入录屏注释的真实反例。8 秒计时短试确认 25fps 原片与单调壁钟相差 0.0885 秒；重录无裁剪、加速或替换帧。最终打印清单文字检查不含录屏注释。

真实 Lux3D 原件在本环境不可用；一次有界取材重试返回 `download failed`，HTTP 状态未知。真实模型浏览器视觉验收、公开 HTTPS、授权确认、正式提交仍待完成。首个可操作界面 ≤3 秒仅为工程目标，仍为 OPEN；本材料流程未重测性能，也未修改 CI 门槛。

可执行入口为 `node scripts/create_development_materials.mjs`，要求显式提供 `--url`、`--chrome`、`--driver`、`--python`、`--output`、`--expected-head` 和 `--mode=trial|full`；输出目录必须为 `evidence/private/development-materials-*`。完整模式会重新录制真实浏览器操作，需保持 App 与本地 dist 冻结。
