# 09｜静态部署、运行时资源与维护
## 主部署路径
本地锁定Vue/Vite/Three.js版本并构建dist；ModelScope Static需要**已经有index.html的构建产物**，不现场跑npm build。[S07]
魔搭作为优先入口，不是唯一强制平台。模型/运行时最好同源，路径必须兼容子目录，使用hash router或单页无路由。
`browser-spike`是诊断，不是完整作品；上线主域最终指向apps/web构建产物。

## Pyodide
锁314.0.6与其pydantic2.12.5。[S04/S05] 不称它为当前最新版本。
最小运行时：pyodide.mjs、pyodide.asm.mjs、pyodide.asm.wasm、python_stdlib.zip、pyodide-lock.json；
加pydantic及lock依赖闭包的WASM wheels。不能拿pip的本机pydantic_core wheel塞给浏览器。[S06]
初始探针允许官方CDN；最终优先同源托管并记录冷启动。不要把数百MB完整包、matplotlib字体等无关文件全部发布。
本包不含外部运行时文件；用scripts/vendor_pyodide_from_dir.py从本机已下载的官方完整分发中选择最小集合。
V6.1不再读取不存在的info.version：校验Python3.14.2、ABI2026_0和wasm32；若有package.json，还核对314.0.6；实际启动再次检查py.version。
可用--expected-lock-sha256传入独立取得的完整64位哈希，不可把3fdaef09…8ad4当完整值。ABI匹配不是分发真实性证明。
逐wheel验hash，复制后再验hash，记录lock_sha256和实际info；目录非空时拒绝混装。不复制字体或无关wheel。
本地用户V6测试：同源约1.6s、CDN约10.4s；这是用户Chrome155 localhost记录，不是公网SLA，也不是本轮V6.1测量。
发布优先同源；CDN仍保留为诊断选项，不自动悄悄fallback。
依赖许可证需保留，部署前审核分发与平台体积限制。

## 安全和隐私
无公开上传、任意代码、模型生成、个人家庭信息输入。无API Key、账号Token或带隐私的证据进入dist。
JSON导入只用于受控合成样例且需要schema/大小验证；不要在首版提供“上传真实家庭档案”功能。
所有文案textContent/Vue插值；禁止未经清洗v-html。模型为核准的自包含GLB，外部资源URI策略继续遵守。
只读文件发布并不意味着内容安全：仍须资产授权审核、hash、第三方许可证。
浏览器挑战不做强反作弊，也没有公共排名；开发者工具可改本地状态，不将本地记录当权威评审分。

## 加载和故障
静态站仍可能被平台休眠/限流/域名策略影响；要用无登录窗口实际验证。
首屏加载分阶段；错误时清楚标不可用，不伪造结果。模型丢失可用显式占位，但正式提交前必须恢复核心资产。
发布Python核心hash、场景hash、资产hash；同一URL版本内容不混用。
不默认启用service worker，以免评审期缓存旧代码；有必要才实现显式缓存版本更新。

## 维护日期
按更严格项目计划维护至max(2026-12-31,实际结果公布日+30天)，结果未发布不安排关停。
例如若实际12/05公布，至少到2027/01/04，而不是12/31。
此精确期限已纳入用户本地Claude对官方JS的复核记录，来源身份单独标注；本轮未重新取得JS原件。登录时核对任何更新，不再把已核实事实重新列成未知。
不承诺平台永久免费。保留备用站点和真实视频；发生故障先修链接，再按规则更新提交入口。
