# V6.1 源码补齐记录与接手步骤

本文件随补齐包导入；目标基线为 master 提交 `01d48fca76f77856b5e9f31a37090bb1284e47db`。
导入工具只补齐指定文件，不执行 git add/commit/push，不修改原有21个文件。

## 原有资料与补齐资料的关系

- 原有 `docs/v6.1/` 是你重新整理的当前方案，继续作为概要导航。
- 新恢复的 `docs/00-scope-and-rules.md` 等明细、`reference/`、`contracts/`、`browser-spike/`、`scripts/` 是 V6.1 原包的实现基线，不再是“只存在于外部ZIP”的路径。
- 原仓库六份旧文档（docs/01-requirements.md 至 docs/06-import-record.md）保持历史身份；不能把现在新增的所有 docs 根目录文件都说成旧架构。
- 当前 README、START_HERE、AGENTS、evidence/HANDOFF、evidence/task-status 五个文件保持原样。原包同名版本在 [原始入口](../history/v6.1-original-source/START_HERE.md) 等路径供人工对照，不会倒退当前任务记录。
- 原包 CHECKSUMS 和 package-manifest 保存到 history/v6.1-original-source。根目录两份清单由导入器根据“保留的21文件＋精确补齐文件”生成；不是原ZIP的摘要。

## 导入后的人工收尾（仅改事实，不扩大方案）

1. 更新 README、START_HERE、AGENTS 中“源码尚未导入”的描述为“已导入参考基线，完整三维应用尚待实现”。
2. 修改 AGENTS 中“本轮已授权向master提交”的历史表述，后续每轮以用户当前授权为准。
3. 在 START_HERE 加入实际检查命令，并指向本文件与 docs/v6.1/；补充 docs 根目录恢复的明细不全是历史文档。
4. 把本机实际检查结果记入 evidence/HANDOFF.md 和 task-status.json；只更新导入/检查任务，不批量把 T00–T14 标为 DONE。
5. 明确上述文字与状态修改会改变根目录校验清单。编辑后旧清单只代表“刚导入时”快照；审核实际改动，再按精确白名单重建发布清单，不对整个目录自动放行。
6. 所有 history/ 和原包日志仅为追溯，不能把历史通过写成本机新通过。

## 在仓库根目录复跑

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-validation.txt
python -m pytest reference/tests -q
python scripts/generate_contracts.py --check
python scripts/validate_package.py
node --test browser-spike/*.test.mjs
python scripts/stage_browser_core.py
python scripts/check_submission.py
```

最后一项当前预期 BLOCKED、退出码2；这不是导入失败，而是应用、真实资产和最终材料尚未完成。
真实浏览器、同源Pyodide、目标托管仍需单独验收。通过后推进 T02 三维交互，T03 两件真实Lux3D小样并行。

## 本包不可能补出来的内容

真实Lux3D GLB与生成证据、完整 apps/web、官方Pyodide/WASM运行时、真实浏览器新日志、部署链接、正式视频报告、官网回执本来就不在V6.1原包里。
API Key、私人照片、登录凭据也不会提供，不应放进Git。
