# 四件审核文件

2026-11-09新增授权：八页[项目报告候选R1](project-report-R1/README.md)在独立子目录公开，使用用户已收到的保存副本原字节及Content Credentials。原四件文件和原manifest字节记录保持不变；R1中的制作时措辞由新README说明，不改写历史。源码aa7227a及CI42567382909已全37步骤成功，当前说明见[审核状态](CURRENT_STATUS.md)。

最新远端基线4ac423e的功能CI通过、首次可编辑p95=4027.4ms导致整体失败；旧PDF／下表29e测量只作历史。当前准确状态见[本轮审核状态](CURRENT_STATUS.md)。另有[从仓库原件完整复现的本地审核入口](../../docs/LOCAL_MODEL_REVIEW_20261109.md)，不依赖私有inputs或外置校准，不把候选reviewed／许可统一改为true。

此目录只收录本次明确指定共享的V3视频、四页PDF和两件原始GLB。仓库是公开的，这些文件可被任何人下载；特定账号/套餐的模型再分发许可仍未核实。本次分享不等于平台授予商用、再许可或任意再分发权，也不是正式比赛提交或网站发布。

完整字节数、SHA-256及Git blob SHA见[校验清单](manifest.json)。所有文件均使用现有字节，没有重录、重新生成、删改元数据或覆盖V2。

| 文件 | 内容与版本 |
| --- | --- |
| [V3视频](https://github.com/GuanJHCode/HomeSafe-AI/blob/codex/v6.1-browser-3d/review-assets/2026-11-09/HomeSafe-AI_V3_20261109.mp4) | 88.92秒，1920×1080、25fps，中文字幕、无音频。产品5826dab的真实模型交互；历史来源段10.96–25.96秒明确为保留静态证据，不是平台重新生成 |
| [四页PDF](https://github.com/GuanJHCode/HomeSafe-AI/blob/codex/v6.1-browser-3d/review-assets/2026-11-09/HomeSafe-AI_content-review_20261109.pdf) | 产品5826dab的推送前内容复验快照，保留制作时“私下审核稿”标记。29e9eae后续CI功能通过，仅首次可编辑p95=3066.4ms超过原3000ms门槛；这不是PDF中的历史6dc测量 |
| [椅子原始GLB](https://github.com/GuanJHCode/HomeSafe-AI/blob/codex/v6.1-browser-3d/review-assets/2026-11-09/chair_lux3d_g1_30471.glb) | 图生3D任务30471，原件10,352,404字节，保留20个零法线问题 |
| [柜体原始GLB](https://github.com/GuanJHCode/HomeSafe-AI/blob/codex/v6.1-browser-3d/review-assets/2026-11-09/cabinet_lux3d_g1_30475.glb) | 图生3D任务30475，原件8,689,480字节，保留24个零法线问题 |

模型来自原创AI单物体参考图，不是实物扫描、实测或真实家庭重建。任务完成与缩略图由保留截图支持，参数和任务/资产关联主要来自来源JSON；文件哈希不是平台签名。V3中可见的项目任务/资产编号已存在于此前公开说明，新的实际检查未见账号、邮箱、订单、支付、凭据或私有链接。

## 原件与视频运行件

V3实际使用单独的法线修复派生件，没有把它们冒称未改写原件。本次只上传两件原件，未额外上传派生GLB、独立截图、参考图、来源JSON或私人附件。可在本地复现视频运行件，输出保留在被忽略目录：

```bash
python scripts/repair_private_glb_normals.py --input review-assets/2026-11-09/chair_lux3d_g1_30471.glb --output evidence/private/reviewer-chair-derived
python scripts/repair_private_glb_normals.py --input review-assets/2026-11-09/cabinet_lux3d_g1_30475.glb --output evidence/private/reviewer-cabinet-derived
```

输出目录必须尚不存在。已用相同原件重新复现并匹配V3运行件SHA：椅子为 `296935f947dabf72026764d71d1df9f85d353d2062c7745b187ad21b417a07fc`，柜体为 `92944741a7e9f2491f9220c9dff3f95d66190db80a2488a5d029fbe1b3de3350`。不能把原件说成已通过完整严格glTF验收。

此审核目录不会自动加入网页运行时资产清单，也不改变持久校准的reviewed标志。公开网页资产目录仍为空；正式部署、账号声明、外部设备与比赛提交门禁保持原状。代码源码包的显式allowlist仍只导出源码/文字；取得这四件附件应使用Git仓库或本目录链接。
