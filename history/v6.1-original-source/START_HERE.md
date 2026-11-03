# 从这里开始：V6.1部署与走查修复完整包
V6.1完整替代V6；不必合并V3/V4/V5。保持浏览器优先方向，不增加业务范围。
这是设计、规则参考内核和浏览器诊断源码，不是完整3D应用或正式参赛成品。

## 先读
1. [REVIEW_V6_1.md](REVIEW_V6_1.md)：本轮缺陷、修复与证据来源。
2. [AGENTS.md](AGENTS.md)：TDD、用户提交格式和边界。
3. [ADR-0002](docs/ADR-0002-browser-first-competition.md)与[日期计划](docs/07-delivery-plan.md)：继续实施，不重新设计后台。
4. [实际验证](evidence/BUILD_VALIDATION.md)：分清本轮原生测试与用户V6实机测试。

## 校验包
ZIP同目录下载的.sha256用于检查整个ZIP；它不能包含在它所校验的同一个ZIP里，否则产生自引用。
解压包内的CHECKSUMS.sha256用于逐文件校验（不含它自身），REVIEW_V6_1.md已经在包内，不依赖单独附件。
```bash
# Linux，ZIP下载所在目录执行；Mac可用 shasum -a 256 -c 同一文件
sha256sum -c HomeSafe-AI-V6.1-fixed-20261103.sha256
cd HomeSafe-AI
sha256sum -c CHECKSUMS.sha256
```
本机修改文件后校验会变化，这是正常现象；先提交修改再重建交付清单，不要把旧哈希当新代码证明。

## 原生回归
```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-validation.txt
python -m pytest reference/tests -q
python scripts/generate_contracts.py --check
python scripts/validate_package.py
node --test browser-spike/*.test.mjs
python scripts/check_submission.py
```
最后一条当前仍应BLOCKED/exit=2，真实资产、完整应用及正式材料尚未产生。
用户已在Pydantic2.12.5/Pyodide/本机Chrome验证V6，保留这项成果；当前补丁不冒称再次实测浏览器。

## 第一件事：复验修复后的同源路径
从官方固定版本完整分发取得文件到仓库外，不要手改lock添加version字段。
```bash
python scripts/vendor_pyodide_from_dir.py --source /absolute/path/to/official-distribution
python scripts/vendor_pyodide_from_dir.py --source /absolute/path/to/official-distribution --copy
python scripts/stage_browser_core.py
python -m http.server 8080 --bind 127.0.0.1 --directory browser-spike
```
浏览器访问 `http://localhost:8080/?runtime=same-origin`。
初始化→三样例→挑战；检查达标时仍显示2项已触发、4项待核查。
再用不存在的本地路径制造一次失败，恢复配置并点击初始化，确认无需刷新整页可恢复；该按钮会重建Worker并重置挑战。
脚本校验Python/ABI/arch与wheel哈希；有package.json时验证发布版本；Worker核对py.version。
可传 `--expected-lock-sha256` 加独立取得的完整64位哈希；不要使用3fdaef09…8ad4这种截断字符串。
本包不含Pyodide二进制/字体，也不需要任何收费调用。

## 给接手Agent
> 按V6.1和ADR-0002实施，不再重构产品方向。先复跑原生和JS测试，再验证修复后的官方同源分发、浏览器失败重试与目标托管。用户V6实机结果已有记录，不把它改写成本轮新测。通过后继续T02完整Three.js互动，T03真实Lux3D小样并行。保持同一Python规则、固定挑战目标、剩余已触发/待核查提示。Demo项优先填在线链接，视频放报告/社媒/允许的补充区，不假设同一字段可并交。提交格式按本机全局<type>: <desc>，不编造8类枚举或PUA配置。无授权不收费、不推送，不覆盖工作区；每任务记录真实结果和commit。

## Git
先读取目标仓库和工作区状态，再在分支上手动合并、提交与推送。没有自动远仓操作。
scripts/export_sources.py仍默认dry-run，只处理清单中的审核文件；新照片/GLB必须逐项审查。
