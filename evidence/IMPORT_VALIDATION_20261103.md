# V6.1 源码导入与本机验证

日期：2026-11-03（Asia/Shanghai）。基线 master：`01d48fca76f77856b5e9f31a37090bb1284e47db`，tree：`e0943b6781c2f09a8a5fa01bb4e21cb459210075`。

## 来源与恢复完整性

从用户本机 Downloads 读取补齐 ZIP，实际 SHA-256 为 `81b72b3dd0d61cfe6854414bf92a4dfd90a4cf2ef2358b019f43566a424a47ea`，与所附校验文件一致。检查 ZIP 路径和符号链接后解压至独立临时目录，195 条包内摘要全部匹配。

同目录原始 V6.1 ZIP 实际 SHA-256 为 `b6c674f532fd30ff7ab086b08c814b086e94e2aa0f12cff80c1b6d94b96d3752`。导入后将原始 181 文件逐一与恢复位置比较，字节全部一致，包括五份冲突原文和两份原清单的归档。重新打包的浏览器 Python ZIP 仍与原包一致。

原有 21 个本地文件在导入前与远端完整树逐文件 Git blob/大小匹配。因为工作目录无 .git，未运行需要本地 HEAD 的 CLI；用实际远端 HEAD/tree 验证相同前置条件后调用未经修改的 prepare 与 apply_plan。预览通过后新增 186 文件、覆盖 0 文件。随后更新当前入口/状态/概要中的事实描述，保留所有旧文件。

## 本次实际结果

环境：macOS arm64，CPython 3.14.3，Node 24.13.0，pytest 9.0.2，TypeScript 5.8.3。复用本机已安装的两个验证虚拟环境，无新依赖下载；没有声称使用 CI 的 Python 3.13。

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| Python / Pydantic 2.13.5 | python -m pytest reference/tests -q | 187 passed |
| Python / Pydantic 2.12.5 | 同上，使用兼容环境 | 187 passed |
| 导入器 | python -m unittest -v test_import_missing（补齐包临时目录） | 15 passed |
| JavaScript | node --test browser-spike/*.test.mjs | 13 passed |
| 契约 | python scripts/generate_contracts.py --check | 3 份一致 |
| 包检查 | python scripts/validate_package.py | 8 passed，含活动 Markdown 链接 |
| TypeScript | tsc --strict --noEmit --target ES2022 contracts/frontend/domain.ts | exit 0 |
| 浏览器核心包 | python scripts/stage_browser_core.py | 10 模块，原包字节一致 |
| 提交预检 | python scripts/check_submission.py | 预期 BLOCKED / exit 2 |

原始输出见[本次日志](logs/source-import-20261103.txt)。旧 evidence/BUILD_VALIDATION.md 与 v6_1-* 日志保留原样，是原交付环境的历史证据。

## 发布清单与范围

在导入器精确白名单基础上，仅增加本记录和本次日志。入口编辑后重新计算 package-manifest.json 和 CHECKSUMS.sha256，不扫描并纳入本机旧 ZIP、核验目录、依赖缓存或个人文件。原始清单保存在 history/v6.1-original-source/。

本次只导入已有参考实现并更新交接事实，没有改动规则或浏览器实现。T01 的源码恢复与原生回归已完成，真实同源运行时/浏览器/托管部分仍待验证；其余开发任务未被标 DONE。

NOT_RUN：真实 Chrome/Pyodide、官方运行时端到端、公开部署、Lux3D 生成、账号与正式赛事提交。CI 是否通过需另看 GitHub 实际运行结果。无收费调用。
