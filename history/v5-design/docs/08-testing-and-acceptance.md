# 08｜检查、验收和剩余风险

## 开发基线检查

```bash
python -m pytest reference/tests -q
python scripts/generate_contracts.py --check
python scripts/validate_package.py
```

TypeScript严格检查由开发环境执行 `tsc --strict --noEmit --target ES2022 contracts/frontend/domain.ts`。没有tsc时是未运行，不伪造结果。参考测试覆盖单对象多trait、几何、无通道、范围改变、校准契约、任务身份、发布负例、逐文件导出。

V3的62项测试在原包上重跑；V4的11项缺口再次复现。V5是schema2.0，不假装原V1测试无修改就能运行；新的具名回归用例及映射见REVIEW_V5.md。

## 产品必须补的验收

- 正式DB事务/CAS/rollback、权限、生成幂等、异常HTTP映射。
- 真实Lux3D GLB完整glTF校验（reference仅检查结构子集）、浏览器实际渲染、规范化/实例代理一致。
- 至少3种布局与边界，连续10次操作只是稳定性，不是正确性或安全效果证明。
- 缺模型有明确标记，不伪装真实生成；网络/积分失败不阻塞预生成体验。
- 秘密扫描、路径穿越/外部资源/XSS/CSRF、公开模板不能篡改角色和规则。
- 个人信息、版权和规则内容的人工复核；程序无法替代法律/安装/专业判断。

## 发布预检

`python scripts/check_submission.py` 当前必须exit2/BLOCKED，因为应用和真资产不存在。
验证真实文件、hash、唯一资产ID/内容、场景引用、功能映射、来源证据、分发范围、现存Git commit、同版本产品验收记录。报告采用本项目PDF+视频配置，需pdfinfo与ffprobe；缺解析工具视为未验证，不能自动通过。
官方允许视频或Demo链接；本工具为了离线可验证默认选择视频，不是在增加官方要求。采用PPT/纯在线链接时要有明确扩展验证与人工无登录访问记录，不能删检查直接宣称ready。

READY_FOR_SUBMISSION不要求未来回执；SUBMITTED才要求回执。本地检查永远不推断官方接受/入围/获奖。

## 自动化边界

hash可证明文件一致，不能证明截图真实或版权合法；PDF能解析不代表内容正确；SDK mock不证明实际传输重试；参考正确不等于临床有效。这些限制保留到最终报告。
