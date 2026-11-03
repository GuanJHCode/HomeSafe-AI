# 08｜验收：核心正确性与评审体验分开
## 已有测试层
CPython参考内核、结构化错误、未知降噪、比较变化来源、挑战不篡改数据、SDK模拟、发布检查。
JS客户端测试仅用FakeWorker验证乱序/失败/销毁/超时；**不是浏览器Pyodide实测**。
本次自己的实际日志见evidence/BUILD_VALIDATION.md。用户转述Claude的V5 Node/Pyodide成绩独立标user_reported。

## 必须由接手Agent完成的浏览器探针
1 原生Python与浏览器三样例语义JSON完全一致。
2 真实Chrome/Edge与Safari至少覆盖实际评审设备；WebGL2、module Worker、WASM MIME、iframe可用。
3 首次冷启动、缓存后重载、断网重载（只在全部资源本地化后）分别记录。
4 Worker工作时场景仍响应；加载失败不显示绿色结果；可明确重试和恢复。
5 Pyodide/Pydantic/核心hash与构建记录相符；不使用latest CDN别名。
6 CSP/CORS仅按部署实况判断，不盲目要求COOP/COEP。本方案不使用SharedArrayBuffer。
7 模型替换/校准/纹理/缓存，客户端旧响应丢弃。
8 无登录/手机热点或另一网络访问正式链接；不能用本机localhost冒充上线。

## 玩法验收
5分钟内成年体验者能完成“观察两角色→找出冲突→尝试调整→解释变化→导出清单”。
挑战只记录操作步数和冲突事件；不是安全分、事故概率或现实安全排名。
未知不能通过折叠被隐藏；完成后显示目标完成与仍未核查事项并存。
至少3种布局，不能只在before/conflict/improved三个预设点演戏。
10次连续无阻断仅稳定性，不是全面安全有效性。

## 发布门禁
G0 核心/契约/CLI检查；G1 Lux3D核心资产来源；G2浏览器真实互动与模型；
G3正式链接匿名访问/加载及维持计划；G4报告视频与代码版本一致、授权/隐私/条款已由本人确认。
READY_FOR_SUBMISSION不需要未来回执；SUBMITTED才需要真实回执。
保留旧ReleaseVerifier作为文件检查，不再扩建成大型发布平台。
本包诊断页面、占位素材、模板报告均不能通过正式G1/G2/G4。

## V6.1补丁验收
同源脚本不修改官方lock；无info.version也可选择依赖。检查Python/ABI/arch、wheel哈希、可选完整lock哈希和运行时版本。
模拟首轮初始化失败后，再次初始化及评估可成功；界面显式重建Worker处理缓存/超时。深层JSON返回INPUT_TOO_DEEP。
用户V6 Chrome155实测已通过，仅标USER_VERIFIED_RUN；本轮原生/模拟Worker不冒充真实浏览器，也不承诺1.6秒公网性能。
目标达标文案必须包含剩余triggered和needs_review，不能只显示待核查数。
