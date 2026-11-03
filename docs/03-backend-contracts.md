# 03｜核心类、Worker协议与可选本地CLI
本文件保留V5文件名便于旧链接；**不再要求开工先写后端服务**。

## 已有可运行核心
|模块/类|方法|执行合同|
|---|---|---|
|RuleEngine|evaluate(Scene/dict)→Assessment|先完整校验，8个独立SafetyRule类，不能异常后返回未触发|
|TraitCandidatePolicy|candidate/unknown_count/setup_items|已知trait优先；类别仅建议；未知仍在覆盖与对象资料|
|SafetyRule及8个实现|evaluate(scene,profile)|独立职责，R001只配对确认或疑似窗口，不对所有未知家具作笛卡尔积|
|PlacementValidator|validate_transform/find_solid_penetrations/validate_supported_height|2.5D合法性；错误含对象ID/字段/稳定code|
|ObservationValidator|validate_height_reference|高度参考系与容器、房间一致|
|CoverageService|summarize/for_rule|缺通道、缺角色、不完整资料明确显示|
|ComparisonGuard|build_basis/assert_same_basis|同检查基础；额外layout_hash/observation_hash区分变化来源|
|FindingDiffer|compare/classify/change_kinds|resolved_unknown≠现实已解决；删除对象仍removed_from_scope|
|ChallengeService|reset/apply_transform/undo/result|只改白名单pose；不许通过删对象、改阈值或勾属性完成目标|
|browser_bridge|dispatch/dispatch_json|固定操作、≤512KB、异常结构化，无任意代码/文件路径|
|AholoSdkGateway|create_image_task/retrieve_task|可选本地；真实请求次数/权限仍待实测|

## Worker消息
```json
{"id":17,"op":"evaluate","clientRevision":3,"payload":{"scene":"<canonical Scene>"}}
```
Worker持久化Python解释器与一个ChallengeService。前端逐操作提交，不逐帧提交。
固定操作：
- init：加载固定版本运行时、pydantic、hash验证的core zip。
- evaluate：payload={scene}。
- compare：payload={before,after}，由Python重算，不信客户端手填Assessment。
- challenge_start：{scene,movable_ids,goals}，只接受示例。
- challenge_move：{object_id,transform:{position,yaw_rad}}。
- challenge_undo/challenge_reset/challenge_state：空payload。
返回 `{id,clientRevision,ok,result,evaluation_ms}` 或 `{...,ok:false,error:{code,message,issues}}`。
修改字段失败、加载超时、Worker崩溃均不返回“未触发”。

## 后续应用服务（不必全部写成后台）
`WorkspaceController.commitTransform/undo/reset/exportScene`；
`EvaluationController.ensureReady/evaluateDraft/acceptCurrentResult`；
`ChallengeController.start/applyMove/checkGoals/showRemainingChecks`；
`ReportBuilder.buildViewModel/print/exportJson`。
保持职责，不用一个500行总管理类；每个类先测失败分支。

## 可选本地图生3D
`tools/lux3d_local.py`提供plan/run/resume式能力边界，正式UI不导入SDK。
CLI允许阻塞等待，因为它不阻塞网页；创建意图先写本地记录，拿到taskId立即保存，wait_for失败不重建任务。
严禁把AHOLO_API_KEY放进静态网页、Vite前缀变量或Worker里。SDK默认True不等于必须打开AI预测尺寸。
