# T03 私下模型接收与校准

用于已取得文件、但公开分发权利待确认的两件模型。本流程不修改公开 manifest，不复制模型到 assets/public 或 apps/web/public，不构成公开发布。

## 几何检查

按 START_HERE 安装前端依赖。输出必须是 evidence/private 下不存在的新目录：

```bash
node scripts/check_private_asset_geometry.ts \
  --chair /absolute/path/chair-original.glb \
  --cabinet /absolute/path/cabinet-original.glb \
  --output evidence/private/geometry-run-1
```

实际 GLTFLoader 读取原始几何，调用应用 AssetLoader.normalize / instantiate，检查示例尺寸拟合、底部中心、平移、0/90/180 度旋转、多实例与释放及源对象不变。Node 跳过纹理解码，结果只能记为 NODE_GEOMETRY_ONLY。

候选输出 reviewed=false。Y 向上、正面 +Z 是这批文件待视觉确认的假设；原始坐标范围与示例适配不是实物尺寸。不得将候选直接当作已审核公开资产。

## 私下浏览器流程

按 START_HERE 准备官方同源运行时并执行 stage_web_preview.py。公开清单须为空。工具只绑定 127.0.0.1，读取两个显式原件，在内存中覆盖测试请求，结束关停。使用隔离 Chromium，不使用个人浏览器配置目录。

```bash
node scripts/check_private_assets.mjs \
  --chair /absolute/path/chair-original.glb \
  --cabinet /absolute/path/cabinet-original.glb \
  --provenance lux3d_web \
  --chrome /absolute/path/to/isolated-chromium \
  --driver /absolute/path/to/puppeteer-core.js \
  --output evidence/private/browser-run-1
```

provenance 必填。lux3d_web 是基于来源材料的操作者声明，工具不自动证明作者或授权。CI 使用 procedural 带纹理盒体，只验证工具，不上传真实模型。CI 容器沿用 CI=1 的隔离 Chrome 启动配置。

测试内 reviewed=true 仅用于调用现有加载器，不写入发布清单。截图须经实施者与独立 agent 复核，确认方向、形态、纹理和视觉/代理一致；数值 PASS 不自动关闭 T03。

流程检查嵌入纹理解码、摘要、尺寸与原点、旋转和多实例，再运行应用的椅子拖动/回弹、双角色、柜体移动/旋转/撤销、挑战、JSON、打印、刷新和 Worker 恢复；刷新和恢复后再次要求两件模型已加载。输出只在 evidence/private，Git 忽略，不纳入公共 artifact。

启动失败保留失败证据，真实模型浏览器标 BLOCKED/NOT_RUN；Node 或 procedural CI 不能替代。公开分发权利、实际模型视觉及交互通过后，才转入既有公开资产流程，不另建产品资产注册表。
