# V6 实际验证记录
日期：2026-11-03。状态：BROWSER_FIRST_HANDOFF_CHECKED；**不是完成的参赛应用**。

## 本次实际运行
|检查|结果|边界|
|---|---|---|
|原V5完整测试|146项通过|先复跑原包，未删原回归|
|V6原生Python测试|170通过，0失败，0跳过|原146＋24项新增；合成输入和模拟SDK|
|单源Schema/TS/OpenAPI|3份生成契约一致|HTTP仅备用设计，不是上线接口|
|JSON/例子复算/引用/文档等包检查|8项通过|不是现实安全有效性|
|Node客户端测试|4通过，0失败，0跳过|FakeWorker，不加载Pyodide|
|TypeScript|5.8.3严格检查通过|仅当前契约类型，不是完整前端|
|Python编译/JS语法|通过|reference/scripts/tools及Worker/client/smoke脚本|
|浏览器core打包|10个允许模块，确定性ZIP/哈希|不含SDK、Key、release工具或第三方runtime|
|官方提交预检|按预期BLOCKED，exit=2|缺真实资产、完整应用、材料、URL及实机证据|
|目标远仓/官网提交|未操作|测试可能使用隔离临时Git样例，不写用户远仓|

## 明确未执行
- Pyodide314.0.6在真实Node或浏览器内加载本次V6代码：NOT_RUN。
- Pydantic2.12.5的V6兼容性：NOT_RUN。本机为2.13.5；目标WASM为官方2.12.5。
- 三维UI、真实GLB校准/画质、真实Lux3D生成、费用和账号权限：NOT_RUN。
- 魔搭/其他站点部署、无登录访问、冷启动、实际FPS、浏览器与iframe/CSP/MIME验证：NOT_RUN。
- Github Actions、真实用户试用、官方回执：NOT_RUN / NOT_SUBMITTED。

用户转述的Claude V5 Pyodide146项通过、35.7ms及启动时间，记录为USER_REPORTED。
本次未收到原始check-results/compat-results/pyodide-results/form-keys文件，不把这些数值当成本次实测。
诊断页和固定命令桥已提供，接手者须先完成T01再建设完整界面。

## 环境与可复现入口
Python3.13.5；Node22.16.0；TypeScript5.8.3；Pydantic2.13.5。
计划开发Node24；没有冒称本容器已跑Node24。依赖锁见requirements-validation.txt。
日志在logs/v6-*.txt；机器摘要见validation-summary.json。
主要命令见START_HERE.md。历史V5结果保留在history/v5-design/evidence，不是当前结果。

## 解读
代码测试证明参考实现对这些输入的行为，不证明儿童行为、产品安装或家庭安全；
自动文件/哈希检查不证明版权与陈述真实；
未运行外部环境不得填PASS，也不得把诊断页直接作为最终参赛Demo。
