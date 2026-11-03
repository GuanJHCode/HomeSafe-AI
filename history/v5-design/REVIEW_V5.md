# V5 最终整合复核与开工结论

日期：2026-11-03。审查对象是本次本地交接包；未读取或修改远仓新增代码，未使用真实API Key，未花积分，未向官方提交。

## 结论

可以把V5作为正式实施起点。本轮已将V4六类核心缺口落实到参考实现、契约或发布机制，并补回归测试，不再要求你叠加多个补丁包。并不意味着成品无缺陷或已经通过官方审核。

本包完整指设计、参考内核、契约、测试、交接、资料模板和实施路线齐备，不包含尚未开发的网页应用、数据库、真实Lux3D模型和成品视频。

## 旧问题的处理与证据

| V4反例 | V5处理 | 回归用例/验证 |
|---|---|---|
| R01 柜体危险品检查漏掉 | 非排他Traits；各规则独立检查 | test_multi_trait_cabinet_hazard_and_anchor |
| R02 柜体不能作为窗边支点 | possible_climb_support独立于category | test_cabinet_can_be_window_support |
| R03 把家具塞进柜体 | 2.5D实体正穿透检查，表面层允许重叠 | test_interpenetration_rejected / test_rug_can_be_under_chair |
| R04 百米收纳高度 | 明确world_floor/object_base并交叉验证 | test_invalid_storage_height / test_storage_coordinate_required |
| R05 缺通道静默通过 | Coverage逐规则/角色记录缺输入 | test_no_routes_explicit_coverage / test_no_profiles_explicit_coverage |
| R06 改通道算改善 | ComparisonGuard固定角色/房间/通道/参数及对象语义范围 | test_comparison_basis_change_blocked |
| C01 校准返回契约缺失 | AssetRenderDTO携带完整AssetCalibration | test_contract_has_calibration_and_observations / test_asset_calibration_roundtrip |
| C02 属性来源仅存在于文档 | canonical BoolObservation/NumberObservation生成所有契约 | test_observation_roundtrip / test_missing_provenance_rejected |
| I01 返回错误taskId仍成功 | 错ID/缺ID/空成功输出转manual_review | test_mismatching_id_manual_review / test_empty_success_output_manual_review |
| G01 空视频/模型可通过 | 逐文件/hash/格式/引用/版本/验收证据/权限核验 | test_empty_materials_fake_assets_rejected / test_commit_must_exist |
| S01 递归推送未审核证据 | 删除自动推送，显式文件清单+默认dry-run+哈希 | test_export_only_explicit_sources / test_changed_file_export_stops |

本轮额外补充：实体接触与实体穿透分开；落地物不能悬空；支撑关系及高度验证；缺角色不静默；示例数据不得直接伪装实测场景；删除对象不算已解决；私钥/私有目录即使列入导出清单也拒绝。

## 实际验证

原V3：62项测试、23项包检查通过，11项V4缺口全部再次复现。随后在V5采用schema2.0新内核与具名回归，不把旧V1测试简单套成新版本已经无差异。
V5实际结果与环境以 evidence/BUILD_VALIDATION.md 和日志为准。测试数量不是用户验证数量，也不是全覆盖证明。

## 设计上明确保留而非隐藏的实施事项

- 真Lux3D生成/扣分/准确到期/账号API权利必须实际确认。P0网页生成+手动导入不被API阻塞。
- 完整浏览器、API/DB事务、真实GLB校准/性能、安全、公开sandbox限流等仍需T00–T08实际开发。
- reference的GLB检查只是有限结构子集，不替代完整glTF验证与纹理解码/浏览器验收。
- SDK真实传输层内部重试尚未验证；I01已修正，但P1收费路径仍须锁定SDK、故障注入实测，不宣称绝不会重复收费。
- 自动预检不能证明版权或截图诚实，owner review和真实内容核查仍不可跳过。未取得官方登录态条款。
- CI文件已提供，本轮未在GitHub执行；本地复跑不等于远端CI通过。

以上未决项不需要再通过无限增加设计文档解决；按任务在真设备/账号/应用上核验。下一动作是T00–T02开发，真实椅子/柜子小样并行准备。

## 一套权威版本

不再携带V1活动契约和危险自动推送脚本。history仅保留审查文字/源包hash，不能控制实施。生成契约由models.py单源产生，所有公开HTTP接口标DESIGN_ONLY。
任务清单和交接指令已面向多会话/多agent分支协作，用户自行上传Git，不自动改远仓。
