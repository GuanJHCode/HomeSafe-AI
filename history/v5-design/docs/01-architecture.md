# 01｜架构、目录与实现边界

## 运行基线

Python 3.11+ / FastAPI / Pydantic / SQLAlchemy + SQLite WAL，Vue3/TypeScript/Vite/Pinia/Three.js。Node24为计划应用基线，T00在实际Linux/Mac安装锁定；本包类型检查环境另见实测记录，不冒充已验证全部目标系统。
P0只有API、静态前端、SQLite、本地资产目录；不启动生成worker。P1在线生成才加入独立worker。

```text
apps/api/homesafe/
  bootstrap.py, settings.py
  api/v1/ scenes.py assets.py assessments.py comparisons.py reports.py
  application/ scene_service.py asset_service.py assessment_service.py remediation_service.py report_service.py
  domain/ models.py geometry.py placement.py rules.py comparison.py
  ports/ repositories.py storage.py lux3d.py
  infrastructure/db/ orm.py repositories.py uow.py
  infrastructure/storage/local_store.py
  infrastructure/lux3d/sdk_gateway.py               # P1
  workers/generation_worker.py                       # P1
apps/web/src/
  pages/WorkspacePage.vue
  components/ SceneCanvas InspectorPanel FindingsPanel ProfileSwitcher ComparisonPanel CoveragePanel
  application/WorkspaceController.ts ComparisonController.ts
  renderer/SceneRuntime.ts AssetLoader.ts TransformController.ts CameraController.ts FindingOverlay.ts ResourceRegistry.ts
  stores/sceneStore.ts assessmentStore.ts assetStore.ts
  api/client.ts generated.ts
```

上面是待建应用目录，当前参考实现位于reference。迁入应用时不可同时维护两套规则。

## 依赖与事务

API只处理协议/鉴权/输入；应用服务编排；领域只计算；基础设施经ports注入。单机单API、短事务。网络等待不占DB事务。SQLite不是多租户集群方案。
浏览器使用场景草稿；后端为正式结果权威。拖动结束→保存revision→固定快照评估→按input_hash/revision接收，不接受旧响应。

## 产品模式

local：完整编辑，默认localhost，导入/修改受信任管理员；仍校验Origin/路径/输入。
public_demo：只读展示，不声称可编辑。
public_sandbox（可选）：固定模板的临时变换与同一后端规则；无上传、无收费、无共享持久化、有限对象和请求限额。

## 性能目标（不是实测结果）

先用两件GLB测大小、面数、贴图、加载与帧率。目标30FPS、样例首屏5秒、20对象规则p95小于300ms；必须标明设备网络与样本量。逐步加载、共享几何、释放GPU资源优于添加复杂基础设施。
