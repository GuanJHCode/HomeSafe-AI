# PR-4：CI 功能与性能结果分开显示

2026-11-04，工作分支 `codex/startup-profile-20261104`，基线 `64e166540495126f618dd65aa8dc88760ed70604`。本改动的远端 Actions 执行 **NOT_RUN**；旧提交的远端结果见 [CI_PUSH](CI_PUSH_64e1665_20261104.md)。[独立审查](REVIEW_STARTUP_PR4_20261104.md) PASS；仅关闭工作流步骤拆分子项，PR-4 稳定性验证及 3 秒目标仍未关闭。

`.github/workflows/reference-checks.yml` 把原有单一浏览器步骤拆为准备服务、功能检查、严格性能检查、始终清理和始终总结。仅构建/复制一次相同 dist，端口 4173/4174 服务贯穿功能和性能。所有浏览器命令串行；默认步骤条件使功能失败后性能 NOT_RUN。没有 `continue-on-error`。

保留原有功能命令与性能 CLI `URL CHROME DRIVER enforce`，不修改性能脚本的 3000/12000/150 ms 门槛、首次可编辑定义或逐样本真实移动/哈希验证。性能命令失败仍保存 JSON、写预算摘要并返回非零；报告缺失或无效不会变成 PASS。最终 summary 按 Actions 的实际 step outcome 分别报告 functional_validation 和 performance_budget；真实 Lux3D 与公网始终明确 NOT_RUN。artifact 仍 `if: always()` 保存构建、依赖锁和 ci-evidence。

启动服务前安装 EXIT 清理，准备阶段失败会终止已启动的服务；准备成功移除此 trap，让同一服务跨步骤使用。后续失败仍由 always 清理步骤根据本次 RUNNER_TEMP PID 文件终止服务。

验证：`python -m pytest reference/tests/test_ci_workflow_scopes.py -q` **8 passed**；`git diff --check` PASS。回归直接提取真实工作流的 Bash：语法/步骤顺序/单次构建复制，模拟成功和预算失败进程的 JSON/退出码/注解，功能失败→性能 NOT_RUN 的独立汇总，无效 JSON 不得通过，准备失败时终止两服务，以及后续清理仅处理记录的进程。测试使用明确合成数据和短生命周期进程，没有启动 Chrome、没有新性能采样，也不证明 GitHub Actions 本身已经运行。

保持 T07 首次可编辑 OPEN_NOT_MET、T03/T04/T09 外部验收阻断；工作流拆分不是性能改善或发布完成。
