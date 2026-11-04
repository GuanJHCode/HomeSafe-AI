# T03 原始材料与私下校准

日期：2026-11-04，Asia/Shanghai。基线：功能分支 5e0afa1，master 2f562a3。本轮不公开模型、参考图或账号材料。

## 材料与检查

交付包 18 个文件摘要复算一致（不含清单自身）。椅子任务30471/资产53424；柜体任务30475/资产53430。来源记录及截图已查看，官网预览黑屏的限制已披露。中国站适用条款和公开分发权利仍待确认。

| 模型 | SHA-256 | 字节数 | 三角形 |
| --- | --- | --- | --- |
| 椅子 | e2606d75f4ef91a7395b9447ca5d65d972fd38595bcf53d6c6ef11ee9462e71a | 10352404 | 99798 |
| 柜体 | a8398b16be4d4d2f0c7c703575d0679ce16cc3aeacc276af48c9d26379ad940b | 8689480 | 99687 |

两个实际原件通过 Node/Three.js GLTFLoader 几何读取及应用 AssetLoader 拟合。目标宽×高×深分别为0.50×0.80×0.50与0.70×1.60×0.50，是合成示例尺寸。底部中心、平移、旋转、多实例释放通过，原件字节、对象ID和业务尺寸未改。

[数值回执](lux3d-geometry-20261104.json)仅证明几何检查；纹理未解码，候选 reviewed=false，真实尺度与最终视觉校准未审核。

当前云工作环境的独立 Chromium 138.0.7204.168 启动失败：`process_singleton_posix.cc:292 socket() failed: Operation not permitted (1)`。没有进入模型页，没有操作用户Mac/Dia/Chrome。真实模型浏览器仍 BLOCKED/NOT_RUN。

本地 Python228、探针JS15、应用21、私下输入工具3项通过，类型检查、契约和生产构建通过；生产包仍为0件真实模型。

## 独立审查

首审发现校准页相对路径错误、来源硬编码、刷新/恢复后模型检查缺失、柜体操作覆盖不足。已补根地址回归、显式来源模式、重复加载检查和柜体操作。首审为需修复，未提前关闭任务。

独立 agent 复审代码 PASS，并自行重跑3项输入、21项应用、类型检查和两件原件的Node几何检查。随后独立核对 [CI 41785654240](https://github.com/GuanJHCode/HomeSafe-AI/actions/runs/41785654240) 全部通过，批准关闭 T03-private-intake-tooling。CI 包含 Python228、探针15、工具3、应用21；带纹理 procedural 夹具的隔离浏览器流程和原有子路径Chrome回归均通过。

远端源码提交9cf76600与本地dc7eaaa文件树7b643f13一致；[CI与审查回执](ci-private-intake-9cf7660.json)记录完整状态。工具子项 DONE；T03 整体仍 BLOCKED。合成CI只验证工具，不能替代实际模型浏览器验收。用法见[私下接收流程](../docs/v6.1/08-private-asset-intake.md)。公开清单保持为空，T04仍缺获准托管入口。
