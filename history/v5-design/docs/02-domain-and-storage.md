# 02｜统一领域模型与存储

## 唯一契约源

`reference/homesafe_core/models.py` → `scripts/generate_contracts.py` → JSON Schema / TypeScript / OpenAPI。当前场景schema_version=2.0。拒绝V1输入，不静默把缺失trait补成false。已有V1数据的迁移需要显示source=demo或unknown并逐项确认，原文件保留。

## 对象与观察值

SceneObject.category只作显示，不用于排他规则分支。Traits是非排他观察值：possible_climb_support、requires_anchor_check、contains_hazardous_items、blocks_floor_route、window_opening、loose_cord、rug、child_gate。未填value保持null。
BoolObservation/NumberObservation存 value/source_kind/observed_at/verification_state/evidence_ref；数值可额外带coordinate_reference。已知值需来源，user_reported与measurement不能冒充专业认证。simulated不能被记录为现实已完成。公开DTO需剔除私人evidence_ref；公共沙箱只用合成模板。
PropertyObservation是V3旧叫法，V5以具体BoolObservation/NumberObservation为准。

## 统一几何

米、Y向上、XZ地面，家具实例原点在底面中心。yaw采用右手旋转；宽高深必须正且有限，不接受bool当数值。
collision_layer：solid实体 / surface地毯等可重叠表面 / fixture墙窗固定件 / marker辅助标记。
placement_mode：floor在地面；wall固定挂件；surface非实体辅助表面；supported明确supported_by。
P0实体只允许floor或supported；支撑必须存在、无环、底面在父物体顶面且足迹在父支撑范围内。这只是2.5D摆放一致性，不证明承重或稳定。
收纳高度选择object_base或world_floor，并校验落在所属对象和房间范围；非法数据阻断评估，不输出未触发。

## 模型与校准

VisualAsset原件hash、来源、权限和人工修改记录独立保存。AssetRenderDTO只给受控同源URL、content_hash、provenance_summary、AssetCalibration。
AssetCalibration存方向四元数、旋转后的pivot_offset、规范化bounds、revision、strategy。runtime_axis_fit先旋转/归一原点，再按实例尺寸匹配；baked_standard_glb使用已规范化衍生件，不再重复纠偏。场景实例姿态在最外层。具体矩阵、已缩放标记和测试见04。
资产校准不是实际家庭家具尺寸证明；实例dimensions仍需确认。

## 评估与比较

Finding.status三态；Coverage独立存evaluated/missing_input/not_applicable/unsupported/error。零finding不等于全部通过。
Assessment引用scene_revision、input_hash、ruleset_version、ComparisonBasis和覆盖局限。
比较基础固定scene_id、room、profiles及能力观察、routes、config、ruleset。对象traits/尺寸/层级改变属于输入修订，先重新建基线；仅移动位置、旋转、替换外观不改变基础。
新增/删除对象显示added_to_scope/removed_from_scope，不计普通改善。检查信息由已知变未知显示became_unknown。

## 持久化设计（待实现）

表：scenes、scene_snapshots、assets、asset_files、observations/evidence、assessments、remediation_sessions、reports；P1另有generation_jobs/credit_reservations。
scene_snapshots主键(scene_id,revision)，payload_json不可变+sha256。CAS更新scenes.current_revision与插入快照在同事务。undo/redo产生更高revision，不回退版本计数。
AssetFiles只存相对受控路径/hash；文件和DB导出不包含API Key或带签名云端URL。
缓存键基于规范化输入、角色、规则和参数；数组排序不改变语义hash。名称/视觉变更可能使完整输入hash变化，但不应改变安全规则结果；需要优化缓存时另定义semantic_hash，不能偷换现有hash意义。

删除/隐私：原照片默认仓库外，证据公开需单独批准；删除场景要说明报告留存范围。本人确认的内容仍是自报，不得在UI写“专业核验通过”。
