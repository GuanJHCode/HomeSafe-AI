# 资产目录
没有真实Lux3D模型已包含于此包；不得把占位几何计作Lux3D成果。
assets/raw/与data/为本地私有工作目录，Git忽略；真实家庭/账户证据放仓库外更稳妥。
assets/public/只放经审核的自包含GLB、公开截图和许可说明。
最终6–10件是质量目标，不是官方数量门槛；使用关系见feature_asset_map.json。
公共素材的manifest与SHA256要绑定实际场景和演示片段。`.gitignore`允许图片不等于授权已审核。

## 开发预览的手动导入路径

当前 `asset-manifest.json` 的 `assets` 为空，页面继续显示程序占位模型。收到真实材料后修改这份清单，不另建资产注册表。规范由 Python 的 `PublishedAsset` / `PublicAssetCatalog` 定义，并生成到 `contracts/`。

每条记录填写以下字段；没有材料时保留空清单，不能用示例值补齐：

| 字段 | 填写依据 |
| --- | --- |
| `asset_id` | 该模型的稳定资产 ID；多个实例共用一条资产记录 |
| `object_ids` | 绑定样例里的 `chair` 或 `cabinet`；保持业务对象 ID 不变 |
| `render_url` | 经审核的 `assets/public/<模型名>.glb` 相对路径，可用版本子目录 |
| `content_hash` | 对待发布 GLB 原始字节计算的 SHA-256 |
| `provenance_summary` | 真实网页导入填写 `lux3d_web`；程序生成夹具只能填写 `procedural` |
| `rights_scope` | 只有已核准公开分发的模型才能填写 `public` |
| `generation_evidence` | 已去除账户及私人信息的来源记录相对路径 `path`，以及记录文件的 `sha256` |
| `calibration` | 经人工复核的版本、四元数、旋转后底部中心偏移、包围盒、策略和说明；字段见生成契约 |

来源记录使用 [资产记录模板](../submission/templates/asset-record.md)，包含生成记录、使用素材的权利、分发决定、原件和优化件摘要、校准过程。哈希只绑定文件内容，不代替来源和权利审核。不要将原始账户截图或真实家庭影像放入仓库。

`runtime_axis_fit` 在运行时按审核的轴向和原点校准后匹配现有代理尺寸；`baked_standard_glb` 使用已烘焙校准的 GLB，并要求尺寸与代理一致。两种策略都不能修改规则使用的家具尺寸、属性或角色能力。预测尺寸仍不是实测。

激活项目 Python 环境后运行：

```bash
python scripts/stage_web_preview.py
npm --prefix apps/web run build
```

暂存会校验来源记录摘要、模型摘要、公开权利声明、校准标记、自包含 GLB 和对象绑定，再写入 `apps/web/public`。浏览器仅收到渲染描述、绑定后的场景和已核验 GLB，来源记录不会随构建公开。暂存目录出现旧模型或其他未列出的文件时会停止；先审核具体报错文件再处理，不能盲目清空目录。

页面显示实际加载状态。模型失败时保留占位对象，并明确标注失败。上述代码及合成夹具检查通过不代表真实 GLB 已加载；两件模型还须在真实浏览器验证方向、原点、比例、视觉与代理一致、移动、旋转、撤销和评估。
