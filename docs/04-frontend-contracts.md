# 04｜前端类、交互与加载体验
## 类名和方法
|类|方法|验收|
|---|---|---|
|SceneRuntime|mount/setSnapshot/renderFrame/resize/dispose|不每帧请求评估；GPU/监听器正确释放|
|AssetLoader|load/instantiate/normalize/release|登记资产URL、同源加载、统一校准、实例共享资源|
|TransformController|beginDrag/previewTransform/commitDrag/cancelDrag|操作结束发一次，非法返回高亮+回弹|
|RoleCameraController|setRoleView/animateTo/focusObjects|视角高度只是摄像机参数，与可触及高度无联动|
|BrowserRuleClient|initialize/request/evaluate/isCurrent/dispose|已有诊断实现；乱序/超时/销毁有测试|
|EvaluationController|ensureReady/evaluateDraft/acceptCurrentResult|当前revision/hash匹配才展示|
|WorkspaceController|execute/undo/redo/reset/exportJson|纯内存，不调用已延期CRUD API|
|ChallengeController|start/applyMove/acknowledgeLimits/renderProgress|教学目标与未解决项并列|
|FindingsPresenter|groupByObject/showFinding/showSetupItems/showCoverage|待确认属性汇总，不能隐藏遗漏|
|ReportBuilder|buildViewModel/print/exportJson|用text节点，打印样式，包含版本与局限|

## 页面组织
开屏：一句任务“给孩子留探索空间，也给老人留通道”；点击直接开始样例。
中心为3D，左右角色按钮，底部移动/撤销/重置；右侧不默认展开长审计表。
角色切换伴随同一布局不同检查解释；不是相机高度就被称作“行为预测”。
首次提示“教学样例，非安全认证”，之后常驻短标签；详细局限折叠，但未知/未评估/未完成状态不可藏。

## 冷启动
主线程先渲染外壳/房间，Worker并行准备；显示明确阶段（运行时、依赖、规则、模型）。
规则未就绪时可旋转观察，不准发布检查结论或计为挑战成功。
优先加载椅子/柜体/窗口；其他家具逐步加载。不要下载全套200MB Pyodide分发；选最小运行时和pydantic依赖。[S06]
运行时hash与模型hash用于缓存失效；不在同一版本URL悄悄替换内容。

## 输入错误
PlacementIssue.code对应：
SOLID_PENETRATION→两对象高亮；
FOOTPRINT_OUTSIDE_ROOM→边界高亮；
HEIGHT_OUTSIDE_CONTAINER→属性字段提示；
FLOOR_OBJECT_FLOATING→回弹。
不能将错误字符串正则拆分为对象ID。

## 挑战与资料编辑分离
公开挑战锁定profiles/routes/traits/尺寸和目标，仅移动/旋转允许对象。
“补充资料”另开模式，明确解除挑战并重建比较基线；不允许靠勾选完成。
Browser print可生成PDF清单，但正式报告按赛事表单另整理，不能把一页行动清单冒充项目报告。
