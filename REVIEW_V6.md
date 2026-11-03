# HomeSafe AI V6｜历史复核记录

> 本文仅记录V6生成时的状态；当前修订、外部验证与交付以 [REVIEW_V6_1.md](REVIEW_V6_1.md) 为准。

# 原V6复核
日期：2026-11-03。对象：用户提供的V5 ZIP和转述的Claude走查，不是当前远仓。
结论：**主要方向正确，应按比赛体验调整；不是所有具体建议都应无条件照搬。**

## 一、独立核验边界
本次核对V5 SHA256，与文件一致；复跑原146项测试成功。
公开官方赛事页确认评分、70/30评委权重、50名玩家评委、Lux3D核心/API可选、截止/评审日期、积分发放原则。[S01/S02]
官方Pyodide314.0.6确有pydantic2.12.5，module Worker是官方推荐的线程隔离方式。[S04/S05]
官方SDK ai_predict_size默认True，create_from_file/wait_for能力存在。[S03]
**未收到**用户提到的form-keys.txt及三份原始日志，未独立取得指定JS文件全文；对其独有条款保留USER_REPORTED_PENDING，不擅自宣称已经逐字复核。
本次没有执行真实收费生成、Pyodide实际Node/浏览器加载、完整3D应用、魔搭部署或官网提交。诊断源码和FakeWorker测试不等于已上线。

## 二、H1–H6采用结论
|意见|判断|V6处理|
|---|---|---|
|H1在线可互动为主|采用；这是评分优化，不是公开规则新增硬门槛|P0在线互动+视频补充；Pyodide放module Worker；先浏览器/托管实测，不凭Node成绩承诺|
|H2按权重砍范围|采用主体|取消首版DB/UoW/CAS/生成worker；保留本地revision、hash和必要文件校验；本地ReleaseVerifier不扩建|
|H3玩法和视角|有条件采用|固定目标挑战、步数/冲突事件；相机0.9m仅教学视角；不能以全部未知清零为目标|
|H4加深Lux3D|采用资产迭代与整合；部分推断修正|V5已规划多件，2件只是小样；目标6–10统一风格，不硬凑数；预测尺寸仅待确认候选|
|H5日期与首交|采用|11/04–05先探针，11/06–07首部署，11/15首交，11/16–18修错|
|H6报名动作|公开发积分原则已确认；精确门禁待原文|先核对团队再选题，留回执；不因转述自动代操作|

## 三、不应原样照搬的细节
1. “前50名”不等于“50名玩家评委”。本次只确认后者，入围阶段待原JS/表单证据。
2. 链接维护精确条款待独立确认，但采用更严格项目计划max(12/31,结果日+30天)，不能12/31自动关停。
3. 纯静态减少后端成本，不消除WASM下载、WebWorker/iframe/CSP/MIME、平台带宽和首屏风险。
4. 0.9m镜头高度不能证明儿童够到什么；依旧使用独立确认的能力与几何。
5. 挑战成功不能要求所有规则not_triggered。固定本关目标、冻结资料，未知和未覆盖继续显示，防止“勾选过关”。
6. 新增儿童门栏隔离规则会引入区域连通/门状态/安装假设；首版不为故事扩展R009。现有R008只检查老人侧底框，不能证明门栏对儿童有效。
7. ai_predict_size默认True不等于测绘准确；不能自动确认dimensions，不保证接口返回独立真实尺寸字段。
8. 团队第二轮积分不能等同无限额度；3300可能已经包括一部分奖励，必须按到账核算。
9. CAS可砍，但本地revision/hash和异步结果筛选不可砍。安全/来源工具作为本地交付检查保留。
10. “剩余净宽”不能用通道宽减家具宽简算，P0保留指定区域相交，说明局限。
11. Kiro全局/PUA规范未提供，补TDD、提交与失败上报即可，不虚构私人配置或安装未经授权技能。

## 四、代码层实际修改
- `policy.py`：未知按对象聚合，类别仅给未确认候选，R001不再把所有家具都当未知窗口配对。
- `rules.py`：8条独立规则类；RuleEngine成为编排，保留多trait和原来146项回归。
- `models.py`：SetupItem、PlacementIssue、resolved_unknown、change_kinds、Rect中心说明、静态资产路径。
- `validation.py`：PlacementValidationError携带对象/关联对象/字段/code，仍兼容ValueError。
- `engine.py`：资料已补充与布局调整分开，不把unknown→false偷偷算改善。
- `challenge.py`：仅修改白名单pose，固定目标、合法布局、计步/冲突事件、撤销；目标完成时未知仍保留。
- `browser_bridge.py`：固定JSON命令，不接受Python代码/URL/私密文件；CPython测试可复现。
- `browser-spike/`：module Worker、客户端、诊断页、时序与错误处理；不是完整三维界面。
- `stage_browser_core.py`：只打包浏览器必需Python模块，不带SDK/发布工具。
- `vendor_pyodide_from_dir.py`：从本地官方分发选最小运行时及pydantic依赖，校验wheel hash；不打包字体。
- `tools/lux3d_local.py`：默认plan、显式批准才生成、先记未知提交意图、保存taskId后等待、失败不重新创建。
- `.gitignore`：改为私有/原始/构建目录忽略，允许审核过图标、截图、GLB；来源许可不因此自动通过。
- `docs/`：现行全部重排，旧设计归档history，ADR-0002明确覆盖旧冻结。
- 规则契约与三个样例重算，不混用V5结果。

## 五、已知修复的实测行为
原146项回归保留。新增组合覆盖未知降噪、确认变化、结构化错误、挑战边界、浏览器JSON适配、本地生成错误恢复与vendor选择。
原生3样例的目标机制仍保持：窗边关系变化→通道占用→再次调整，独立窗口未知不被消除。
新增6件全未知且无类别提示的家具时，参考结果卡数量不再成倍扩张；仍有6张对象资料卡和coverage缺信息提示，不静默当安全。
本次完整结果以evidence/BUILD_VALIDATION.md和日志为准，未执行的外部环境保留NOT_RUN。

## 六、下一步
T00真实表单核验与T01真实浏览器/创空间探针优先；T03两件真实Lux3D小样并行。
通过后建立apps/web并实现完整三维UI，不再连续扩大设计范围。
本包是完整接手基线，不是最终参赛成品，也没有写入用户远仓。

## 来源
- [S01] https://www.aholo3d.cn/hackathon
- [S02] https://www.aholo.ai/hackathon
- [S03] https://labs.aholo.ai/api-docs/sdk/python
- [S04] https://pyodide.org/en/314.0.6/usage/webworker.html
- [S05] https://pyodide.org/en/314.0.6/usage/packages-in-pyodide.html
- [S06] https://pyodide.org/en/314.0.6/usage/downloading-and-deploying.html
- [S07] https://github.com/modelscope/modelscope-skills/blob/main/skills/ms-studio-deploy/SKILL.md
- [S08] https://aholo.featurebase.app/zh-CN/help/articles/6916933-dashboardji-fen-yu-api-mi-yao
