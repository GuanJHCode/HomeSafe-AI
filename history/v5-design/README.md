# 安心屋 HomeSafe AI · V5 完整开发交接基线

日期：2026-11-03。**状态：可以开始实现；不是已完成的参赛软件，不是可直接交给官方的最终作品。**

本包合并 V3 详细方案和 V4 审查结论，替换已知有缺陷的参考代码与契约。只以本包 `docs/`、`reference/homesafe_core/models.py` 和生成契约为生效版本。`history/` 仅供追溯，不能覆盖当前设计。无需叠加下载旧包。

## 从这里开始

1. 阅读 [START_HERE.md](START_HERE.md)、[AGENTS.md](AGENTS.md)、[实施任务](docs/07-delivery-plan.md)。
2. 运行本地基线检查。**这些命令不调用任何收费服务，不要求 Aholo Key。**
3. 实现 T00–T02 的第一条可运行交互流程；真实 Lux3D 椅子/柜子小样与代码并行。
4. 每次更新任务状态、测试证据和 Git 提交；不要继续无止境改方案后才写应用。

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-validation.txt
python -m pytest reference/tests -q
python scripts/generate_contracts.py --check
python scripts/validate_package.py
python scripts/run_reference_demo.py
```

如果尚未安装依赖且网络不可用，明确记为未运行；不要跳过测试后宣称通过。应用依赖由 T00 另建并锁定，不能把验证环境当成已经安装了完整应用。

## 当前有什么、没有什么

| 已存在并可运行 | 待实现/待真人完成 |
|---|---|
| 多特征对象、来源观察值、几何及8条规则参考内核 | FastAPI API/SQLite持久化/完整Vue界面 |
| 合法布局、覆盖、比较基础和三态回归测试 | 真实Lux3D GLB生成、视觉校准、浏览器联调 |
| 单源生成Schema/TypeScript/OpenAPI | 真实SDK传输层/积分/权限验证（可选API） |
| 模拟SDK边界、发布负例检查、显式源码导出工具 | 完整录屏、报告、用户试用、官方最终提交 |
| 逐方法设计、任务与取证模板 | 官方报名授权条款的本人确认 |

**不要用参考测试数量当作真实用户验证、完整产品验收或获奖概率。**本轮结果详见 [REVIEW_V5.md](REVIEW_V5.md) 与 [BUILD_VALIDATION.md](evidence/BUILD_VALIDATION.md)。

## 核心目标

Lux3D家具 → 确认对象尺寸/属性 → 可操作客厅 → 两角色辅助检查 → 合法布局调整 → 同基础重新计算 → 明确待核查项的行动清单。

主要故事：移开窗边椅子后占用老人指定通道，再调整位置；窗口防护未知项一直保留。适用用户为成年照护者，不向幼儿演示真实伤害，不提供家庭安全认证。

## 目录

- `docs/00–12`：规则、架构、类与方法、前端、资产、任务、测试、提交操作。
- `reference/`：已运行测试的参考内核；后续移植不能复制成第二套分叉逻辑。
- `contracts/`：从 `models.py` 自动生成。`http/openapi.json` 所有接口仍为 DESIGN_ONLY。
- `examples/`：合成样例，不是真实家庭、不包含Lux3D模型。
- `assets/`：空的生产与发布台账；正式模型由你生成并核验许可。
- `submission/`：模板与DRAFT清单；当前预检必须 BLOCKED。
- `scripts/export_sources.py`：默认只预览，逐文件校验后可导出到独立Git目录，不执行push。

目标仓库：`https://github.com/GuanJHCode/HomeSafe-AI.git`。本轮没有读写远仓；由你在自己的授权环境维护。包内无 `.git`、无API Key、无真实家庭照片、无第三方字体文件。
