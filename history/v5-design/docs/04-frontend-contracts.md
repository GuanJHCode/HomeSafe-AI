# 04｜前端类、方法与校准细节

## 状态归属

SceneStore：可序列化草稿、server revision、dirty与command stack，不放Three.Mesh深度响应对象。
AssetStore只存metadata/loading；ResourceRegistry拥有GPU资源；AssessmentStore保存input_hash/revision、coverage与陈旧标记。

| 类 | 方法 | 合同 |
|---|---|---|
| SceneRuntime | mount(canvas), setSnapshot(scene), renderFrame(dt), resize(w,h,dpr), dispose() | WebGL2检查、按object_id更新；帧循环不调用API；清RAF/listener/GPU引用 |
| AssetLoader | load(dto), instantiate(assetId,objectId), normalize(root,calibration), release(assetId) | GLTFLoader；只受控同源URL；视觉更换不改语义ID |
| ProxyMeshFactory | create(obj), update(id,dimensions,transform) | 与已确认dimensions同源，代理只用于计算/调试 |
| ResourceRegistry | acquire(key,factory), release(key), disposeAll() | 共享geometry/material/texture最后一个引用才释放 |
| TransformController | beginDrag(id), previewTransform(t), commitDrag(), cancelDrag(), setEnabled(v) | 拖动中本地草稿；结束一次提交；地面物不随意改Y |
| WorkspaceController | open(id), execute(command), undo(), redo(), assess(), acceptAssessment(a), resetToTemplate() | 变更串行、CAS409不覆盖；只接受当前版本评估 |
| CameraController | setRoleView(profile), focusObjects(ids) | 相机高度不是风险算法；切角色还要切结果 |
| FindingOverlay | showFinding(f), showRoute(route,blockers), clearFinding() | 文本+图标+颜色，不仅颜色；写明指定通道 |
| CoveragePanel | render(coverage,unsupportedDomains) | 没评估不能隐藏成绿色通过 |
| ComparisonController | setBaseline(id), compareWithCurrent(), selectTradeoff(id), exportActions() | 范围变化解释，禁止简单总数下降=更安全 |
| AssetImportController（可后置） | selectFile, uploadManual, previewCalibration, confirmCalibration, insertIntoScene | 首版可CLI替代；来源不能伪造 |
| GenerationJobController（P1） | requestGeneration, startPolling, stopPolling, resumeFromStorage | 默认不出现；仅内部job_id，禁止前端保存Key |

## 精确变换链

runtime_axis_fit：对原件做R(orientation)，在旋转后的坐标系减去pivot_offset；其对应bounds记为normalized_bounds_m。按实例width/height/depth与bounds之比缩放，再乘场景yaw，再平移到底面中心position。

`p_world = T(instance.position) * R_y(instance.yaw) * S(instance_dimensions / normalized_bounds) * T(-pivot_offset_after_rotation) * R(asset.orientation) * p_raw`

baked_standard_glb：规范化已写入衍生GLB，orientation应identity、pivot应zero；记录新hash和原件hash，不再重复归一。两种策略必须明确，不能混用。
轴向独立缩放仅用于外观近似展示；若会明显变形，可选择更相近模型或重新生成。它不是重建真实结构。校准后可显示代理盒辅助核对。

AssetRenderDTO返回完整calibration；缓存用asset_id+content_hash+calibration.revision。刷新后仍能取得原校准，不能只存前端内存。实例使用模型.clone或SkeletonUtils等时按实际是否骨骼选择，不为普通家具引入动画系统。

## 交互验收

拖动到非法位置：本地提示/回弹，服务端仍再次拒绝；不能保存实体穿透再标改善。拖动到合法位置：提交→新revision→重算→丢弃旧响应。撤销产生新revision。
unknown、样例、模拟、现实自报常驻可见；任何“未触发”旁边保留覆盖限制。键盘数值输入+撤销按钮，桌面优先。

公开sandbox仅提交模板允许的变换，不让客户端改traits/thresholds/roles。无WebGL2时显示说明/实录入口，不显示空白页。

至少验证：真实GLB重载校准、两个相同资产实例互不影响、模型替换语义不变、旋转后代理一致、页面关闭后RAF和资源释放、快速编辑旧响应不覆盖、3种以上不同布局。
