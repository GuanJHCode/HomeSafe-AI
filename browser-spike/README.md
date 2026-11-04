# 浏览器兼容性诊断页
这是开工前探针，不是最终Three.js应用。加载module Worker和同一Python核心，验证三样例与挑战结果。
本包**未包含**Pyodide二进制；config.json默认固定CDN用于首次验证。主站部署应先测同源vendor。

```bash
python scripts/stage_browser_core.py
python -m http.server 8080 --bind 127.0.0.1 --directory browser-spike
```
需要浏览器可访问运行时URL；无桌面Linux可由另一设备访问所提供的安全入口。
按按钮初始化→验证三样例→挑战。挑战依次记录初始、冲突、达标、撤销和重置，并保留覆盖与未解决事项。记录真实浏览器版本、设备、网络、冷/热耗时和错误。
网络加载失败后可直接再次点击初始化；页面会销毁旧Worker并重建，清除失败的模块缓存和WASM状态，挑战进度将重置。
同一Worker的控制器也会清除失败的初始化Promise；Node回归覆盖此机制，不等于本轮已经跑真实浏览器。
超时/崩溃时也使用显式重建，不自动重放挑战移动或收费操作。失败绝不当检查通过。
本诊断自动移动样例只证明规则路径，不证明3D拖拽UI已实现。

## 同源vendor
从官方Pyodide版本页取得314.0.6完整分发到仓库外，解压后找到pyodide-lock.json所在目录。
```bash
python scripts/vendor_pyodide_from_dir.py --source /path/to/full-distribution
python scripts/vendor_pyodide_from_dir.py --source /path/to/full-distribution --copy
```
确认清单与许可证后访问 `http://localhost:8080/?runtime=same-origin`，页面选择config.same-origin.json，不改写CDN探针配置。
也可在正式应用中使用同源配置。URL选项只有cdn/same-origin两种固定配置，不接受任意外部资源地址。
V6.1校验lock的Python3.14.2/ABI2026_0/wasm32，存在package.json时还校验314.0.6；实际加载再次核对版本。
精确锁定需提供从可信分发独立取得的完整64位SHA，参数为 `--expected-lock-sha256`；省略时记录实际SHA但不冒称它已被权威签名验证。
复制脚本只选择运行时与pydantic闭包，不复制fonts或全部wheel。
这里的脚本仅本地文件操作，无下载和付费；真正部署时必须上传完整最小运行时集合。

已安装 Chrome 和 Puppeteer Core 时，可执行真实浏览器探针。使用目标子路径 URL 重跑可验证同源路径与 MIME。脚本会拦截一次本页运行时配置，复现加载失败并在同页重建 Worker。

```bash
node scripts/check_browser_spike.mjs http://127.0.0.1:8080/ /absolute/path/to/chrome /absolute/path/to/puppeteer-core.js
```

## Node兼容探针（不是浏览器性能）
```bash
node scripts/pyodide_smoke.mjs /path/to/pyodide
```
此目录须是带所需依赖的官方分发；缺依赖时Pyodide可能请求其配置源，先离线vendor核验。
结果只证明Node中的语义一致，不证明创空间、Safari、冷启动或国内网络。
