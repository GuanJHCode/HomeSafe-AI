# V6.1 实际验证与外部结果分层
日期2026-11-03。父包V6已在此环境复跑170项Python/4项JS通过；之后写反例再修复。

|检查|本轮实际结果|范围|
|---|---|---|
|Python参考回归|187 passed，0失败/0跳过|原生Python3.13.5，Pydantic2.13.5；含原V6的170项|
|JavaScript测试|13 passed，0失败/0跳过|FakeWorker、注入初始化器/消息、达标文案；不含真实Pyodide|
|契约生成漂移|3份一致|Schema/OpenAPI/TS仍一致；不是HTTP线上联调|
|包检查|8通过|样例复算、Schema、内部指针、活动文档链接|
|TypeScript|5.8.3 --strict通过|契约类型，不是完整Vue应用|
|Python编译/JS语法|通过|reference、scripts、tools与诊断mjs|
|浏览器Python ZIP|10模块重打包并核对hash|不含SDK、发布工具、密钥或字体|
|同源选择/复制|回归通过|匹配真实lock结构的合成夹具；无info.version、依赖闭包、哈希、拒绝不兼容/非空目录等|
|发布预检|BLOCKED，exit=2|缺真实应用/资产/材料，正确阻止假提交|

日志见evidence/logs/v6_1-*.txt，最初新增反例失败记录也保留，不能误读为最终测试失败。
本地环境Node22.16.0；GitHub配置的Node24未在本轮实际CI运行。

## 没有冒充的验证
本环境DNS解析失败，未下载官方Pyodide完整分发、官方JS原件或运行真实Chrome/Pyodide；web取得官方文档和公开索引。
所以同源脚本的真实官方文件端到端复验仍应在用户已有环境执行，不将合成夹具叫官方原件。
用户已补跑V6：Pydantic2.12.5下170测、Node和Chrome155 localhost诊断均通过；同源约1.6s、CDN约10.4s、单评估5–31ms，达标仍2触发/4待核查。
这些成绩记录为USER_VERIFIED_RUN并带V6版本，不标成当前V6.1亲验，也不反过来说用户没验证。

## 最终包验证
已将交付ZIP在独立新目录解压，重跑187项Python、13项JS、3份契约、8项包检查、TS严格检查、逐文件SHA、源码导出预览与预期BLOCKED检查，结果均符合预期。记录更新后再对最终ZIP做相同复验。
该过程日志保存在交付环境的独立final-verification目录；打包后不往包内追加日志，避免修改被校验的内容。
当前代码不是完整三维作品；不存在真实Lux3D生成或官方最终提交，远仓未触碰，付费调用为0。
