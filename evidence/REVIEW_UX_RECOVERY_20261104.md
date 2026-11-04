# T05/T07 独立复审

日期：2026-11-04 UTC。独立审查 agent：`/root/review_ux`；实现 agent：`/root/ux_report`。基础提交 `57faf384d64e9770407b28086fdfeb5b193a6d6f`；逐文件审查摘要和独立浏览器回执见 [review-ux-20261104.json](review-ux-20261104.json)。审查没有修改产品实现。

## 结论

PASS，限于本轮占位/程序夹具体验子项：双角色摘要、重复下载命名、初始化取消/超时/重试、迟到响应隔离、失败模型显式重试。T05/T07 整体不关闭：真实 Lux3D、正式托管与跨设备/跨网络性能仍未验收。

## 独立检查

- 独立阅读 canonical 边界、应用 diff、资产缓存/释放及加载生命周期；未发现阻断性产品缺陷。没有在 TypeScript 重写判断规则。
- 独立运行 `npm --prefix apps/web test`：27 passed；`npm --prefix apps/web run typecheck`：PASS。测试包含旧 revision/hash 不可导出、迟到 Worker 回复、响应体超时、取消后传输仍晚到、GLB 下载超时后缓存清除与重试。
- 独立运行 `CI=1 node scripts/check_web_experience.mjs http://127.0.0.1:4174/preview/ /usr/bin/chromium /workspace/homesafe-browser/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js /workspace/scratch/independent-ux-review-fixed`：Chrome 154.0.8037.57 PASS，回执时间 `2026-11-04T06:58:27.949Z`。
- 浏览器实际检查：初始配置请求取消、迟到回复不显示报告、重试生成新规则状态；两角色摘要同时保留；切换摘要焦点不改相机和输入摘要；同一布局两次下载文件名不同而 JSON 内容相同；375px 宽度按钮移动重算且无横向溢出。
- 显式程序三角形 GLB 首次下载失败，页面标明占位；点击重试只发起一次新下载、成功显示程序模型且报告 hash 不变。它不是 Lux3D、纹理或外观质量验收。
- 独立查看窄屏截图和打印的两张 A4 页面，中文可读，布局版本、输入摘要、触发/待核查、覆盖与局限均保留；另用 `pdftotext` 核对中文文本。这里只证明该样例打印，不覆盖任意未来数据长度。

## 发现与复验

1. 原浏览器 harness 使用全局 Puppeteer request interception，重试后 Worker 初始化卡住；独立运行复现了 60 秒超时，日志位于 `/workspace/scratch/independent-ux-review.log`。仓库已有 `browser_fault.mjs` 明确记录该 Chrome/Worker 测试限制。改为页面 CDP、限定 URL 的 Fetch 后，完整浏览器复验通过；另独立最小复现确认关闭全局 interception 后恢复 READY。此项为测试工具缺陷，不将失败归咎于产品恢复逻辑。
2. 原 harness 等待配置请求无 deadline，现已限定 10 秒。
3. 首版模型重试只有单元测试、浏览器为 NOT_RUN；审查要求补程序 GLB 失败→重试→加载回归后才接受该子项。已补齐并独立运行通过。

## 未覆盖

真实模型文件下载在主任务中受阻；本审查没有读取实际 Lux3D。模型视觉校准、真实模型打印/性能、公开授权、匿名 HTTPS、正式平台 iframe、另一网络、Edge 与 Safari 均未因此获得通过。性能测量与 iframe harness 的独立审查另记，不混入本结论。
