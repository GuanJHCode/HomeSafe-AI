# V5 实际验证记录

日期：2026-11-03。状态：IMPLEMENTATION_BASELINE_CHECKED；**不是产品已完成**。

| 检查 | 实际结果 |
|---|---|
| 原V3参考测试 | 62项通过，见v3-baseline-unit.txt |
| 原V3包检查 | 23项通过；并不证明V3没有业务缺口 |
| V4反例重跑 | 11项全部再次复现，见v4-probes-reproduced.json |
| V5参考/回归/适配/发布负例/导出测试 | 146通过，0失败，0跳过 |
| 单源Schema/TS/OpenAPI生成漂移 | 3文件一致 |
| 包检查 | 8通过，0失败 |
| 计划OpenAPI操作 | 15项结构/引用检查；全部DESIGN_ONLY，非HTTP联调 |
| TypeScript | 5.8.3 --strict --noEmit --target ES2022通过 |
| Python编译 | reference和scripts通过 |
| 合成连续故事 | 窗边→通道→改良位置可复算，unknown保留 |
| 正式提交预检 | 按预期exit2/BLOCKED；真资产/应用/材料尚缺 |
| 真实SDK/积分/GLB/浏览器/数据库 | NOT_RUN / NOT_IMPLEMENTED |
| GitHub Actions / 远仓push / 官方提交 | NOT_RUN / NOT_TOUCHED / NOT_SUBMITTED |

环境：Python 3.13.5、v22.16.0、Pydantic 2.13.5、pytest 9.0.2。应用计划Node24尚未在本容器验证；本次TS检查使用当前Node，不冒充全栈兼容测试。

本轮一个贴边测试最初同时与第三个对象穿透，定位为测试场景未隔离，修正fixture后全量重跑；没有删除失败用例来维持绿灯。补充观察时间与烘焙校准检查后再次全量通过。

所有本轮日志在logs/，机器结果见validation-summary.json。SDK模拟不证明真实传输层行为；GLB结构负例不代替完整模型/浏览器验收；hash与文件解析不能证明内容诚实或版权；不声称真实家庭伤害预防效果。
