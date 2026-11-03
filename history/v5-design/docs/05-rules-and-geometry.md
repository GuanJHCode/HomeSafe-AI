# 05｜规则、覆盖、布局与整改比较

reference是可运行简化内核，不是家庭安全效果验证。全部规则内容需本人按权威指南/产品说明逐条复核，来源支持一般原则，不支持本项目随意选择的数值。

| 规则 | 适用trait/角色 | 当前检查 | 必须保留的限制 |
|---|---|---|---|
| R001 | possible_climb_support × window_opening / child | 支点与窗区域的平面临近关系+已填can_climb | 未验证接近路线、攀爬行为；can_climb=false也不能否定未来发展和其他风险 |
| R002 | window_opening / child | protection_reported是否有待核查条件 | 用户报告不是安装可靠性验证 |
| R003 | requires_anchor_check / child | anchored是否有待核查条件 | 不计算重心、不证明不会倾倒 |
| R004 | contains_hazardous_items / child | 收纳高度、配置reach与locked条件 | 放高/上锁不自动证明全方位不可接近 |
| R005 | blocks_floor_route / elder | 足迹与指定通道区域相交 | 不是无障碍规范认证、不判断其他绕行路径 |
| R006 | rug / elder | 通道内地毯secured自报 | 不验证材料防滑效果 |
| R007 | loose_cord / child | accessible与secured自报 | 不声称自动识图或检查所有线缆 |
| R008 | child_gate / elder | 通道内raised_threshold_present | 不作产品合格认证或盲目建议移除隔离设施 |

Traits非排他。未知trait产生待核查，不因category不同漏掉危险品检查。独立规则之间不自动关闭：挪走椅子后R002仍保持未核查。

## 几何与布局

二维旋转矩形SAT，点-线段距离，结合垂直区间形成2.5D。路线边界接触按保守关注；实体碰撞只拒绝正体积穿透，不能把贴边当违规。floor不可悬空；supported要求明确支撑关系，不代表承重可行。
高度与坐标系明确。非法数据阻断评估并显示字段；未确认但仍合理的输入进入needs_review。缺通道、缺角色进入Coverage，未建模风险列在unsupported_domains。

## 规则状态与覆盖

finding三态不变。coverage是每rule/profile的执行范围，记录evaluated_count和pending_count。not_applicable只说明当前建模中无适用项，不表示现实中不存在相关对象。
near_window_m=0.6与reach示例值仅demo_heuristic，不是儿童年龄标准或法律标准。真实用户设置仍需说明局限；不能为了清除红点随意增减阈值。

## 比较基础

ComparisonGuard固定scene/room/profile语义/route/config/ruleset。修改这些参数必须显式重建基线，不统计为家具调整成效。
同对象traits/尺寸/层级变化是输入修订。删除对象只记录removed_from_scope。properties由false变null是became_unknown，不能算改善。
reference支持已确认属性变化产生条件变化，但UI/报告必须解释为自报/模拟更新，不表示现场完成。真实施工完成要单独记录Remediation状态。

## 不做

完整人体可达性、全屋路径规划、伤害概率、倾倒动力学和全局安全分。A*可在P1独立增加，并记录栅格近似/清障间距来源，不把它用于无依据的承诺。
