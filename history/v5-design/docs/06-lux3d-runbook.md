# 06｜Lux3D 资产生产与代码结合

## P0主路径（不需要API权限）

1. 本人确认报名/团队/选题、当前积分与实际到期。3300与“16天”仅是2026-11-03截图观察，不写死为无限有效。
2. 先生成椅子与柜子。用自有/授权裁剪图或文字，不上传孩子、人脸、地址。
3. 记录模型、质量、预计扣分、实际扣分、等待时间、失败迭代。网页无taskId时留空，不编造。
4. 下载原始自包含GLB并保存；生成记录原图在仓库外，公开副本先脱敏审核。
5. `AssetService.import_manual`或管理员CLI做文件/来源校验，保留原件hash；完整glTF验证与真实浏览器测试不能被reference的有限结构检查替代。
6. 校准朝向、原点与bounds，实例尺寸另由人确认。保存AssetCalibration并刷新验证。
7. 绑定asset_id到原有SceneObject，不改变ID/规则/历史；执行冲突故事和至少另外两个布局。
8. 填feature_asset_map：功能→资产→hash→生成证据→视频时间段。

正式资源包要合法可复现；源码默认忽略GLB，需另交授权资产包及sha256和导入说明。不要让评委克隆后只看到占位物却以为是正式成品。

## 积分建议

先少量测费率再设预算。内部可以将3300分为小样300、核心1800、必要修复500、预留700，但这不是官方报价、赠送承诺或足额保证。重复查看、移动、规则计算和录屏不调用云生成。模型及时下载，避免依赖临时链接。

## P1在线生成（可裁）

前置：核心应用与真资产可用、本人确认API权限及积分适用、明确批准每次创建；默认`AHOLO_ENABLE_PAID_CALLS=false`。
当前选定接法：Aholo官方Python SDK，`create_lux3d_client(region='cn')`，Key只在服务端环境。官方文档有多套产品/skill示例的域名、鉴权和变量，不混抄不同接口；本项目以所锁定SDK及其当前参考为准。[S3]

主方法：`lux3d.img_to_3d.create(img=...,version='G1-Turbo',face_count=20000,output_format=['glb'],ai_predict_size=False)`；task ID对外十进制字符串；只在SDK调用边界转int。显式参数避免默认值漂移。参数权限需实测。
`lux3d.tasks.retrieve(int(task_id))`返回taskId必须匹配。状态0/1进行中、3供应商成功、4失败、6取消；未知/错ID/成功无输出进入人工核查，不认为资产完成。

生成状态机：queued→submitting→polling→downloading→validation_pending→completed。超时受理不明→submitting_unknown，禁止自动再次POST；已有taskId只查同一任务。
参考adapter仅测试fake边界，真实SDK的HTTP内部重试尚未验证。P1前读锁定源码并用本地故障服务器计数POST，必要时显式关闭创建重试；不能只凭fake调用一次就声明不重试。
任务提交/轮询与DB短事务分开；后台worker持久化lease与attempt；query可退避，创建需再次确认。

官方建议10–15秒级轮询，结果URL约2小时有效。[S3]成功及时下载至受控存储；重新查询是否刷新过期URL需实测，不能自动重新收费生成。输出按类型筛选并校验，不默认outputs[0]一定是GLB。

## 网络/隐私

官方上传包说明返回公开URL。[S3]因此默认只用授权演示素材；真实家庭影像不默认上传。输出下载只允许供应商配置域名，重新校验重定向/DNS、拒绝私网、限大小与超时。参考无下载实现，不宣称具备生产SSRF防护。
