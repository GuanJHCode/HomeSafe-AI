# 02｜数据模型、内存状态与版本
唯一模型来源 `reference/homesafe_core/models.py`；脚本同步Schema/TypeScript/OpenAPI。
首版正式通信是Worker消息；OpenAPI为**延期fallback设计**，不是必须实现的15个接口。
V5的schema_version=2.0场景可读；V6规则版本demo-rules-3.0、结果新增字段，旧结果必须重算。

|实体|作用|
|---|---|
|Scene/SceneObject|米制，Y向上，XZ地面，位置为底面中心；非排他traits|
|BoolObservation/NumberObservation|value/source_kind/observed_at/verification_state；未知不填false|
|AssetCalibration|局部纠偏、原点、包围盒、revision；不是实测证明|
|AssetRenderDTO|兼容旧URL；正式静态路径`assets/public/<name>.glb`，校验防穿越|
|PlacementIssue|object_id/related_object_ids/field/code/message，不能解析拼接字符串做UI|
|Assessment|结果三态、coverage、setup_items、input_hash和比较基础|
|SetupItem|每个资料不完整的对象一项；列未知traits和未确认建议，不复制成大量危险卡|
|Comparison|新增resolved_unknown/change_kinds；资料确认不冒充移动家具效果|

## 存储
内存 SceneDraft、CommandHistory、ChallengeSession；刷新默认重置，可下载JSON和浏览器打印清单。
不建SQLite、UoW、后端账号。存储局部进度可后做，但不是首版依赖。
本地client_revision单调增，只用于事件关联；不是多人并发锁。场景hash继续检查结果和导出的对应关系。
无服务器就没有云端同步，文案不得暗示已保存到账号。

## 坐标与通道
Rect.x/z明确为**轴对齐矩形中心**；width沿X，depth沿Z。家具yaw绕Y。
R005目前是指定矩形通道是否占用，不等于“真实最小净宽”或无障碍规范验收。
剩余净宽要定义通道中心线、方向、沿线截面、多个障碍和转弯假设；不能简单用宽度减家具宽度。首版不提供误导数值。

## 观察值和尺寸估计
相机视角高度、配置触及高度、Lux3D模型尺寸三者独立。
ai_predict_size=True可作为小样实验；生成输出与bbox只记录为未确认候选，不自动改dimensions_confirmed或measurement。
本次未见保证返回独立尺寸置信度字段，不能杜撰SDK字段；待真实产物验证单位后再决定是否填校准初值。

## 信息更新
unknown→not_triggered进入resolved_unknown，并显示“资料已补充（自报/样例/模拟）”。
unknown→triggered进入new_triggered，不能当作程序退化或需要隐藏。
layout和observation同时改变时显示混合变化；trait、角色、范围变化必须rebaseline，不计普通整改改善。
