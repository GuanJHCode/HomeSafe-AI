# Edge 隔离验收准备：授权阻断

日期：2026-11-04 UTC。目标是按现有回归脚本运行真正的 Microsoft Edge，不把 Chromium 身份改写为 Edge，不使用用户本地浏览器。

## 已核实

执行环境为 Debian 13 x86_64。微软官方软件源的 [Packages.gz](https://packages.microsoft.com/repos/edge/dists/stable/main/binary-amd64/Packages.gz) 可读取；选定该元数据中最新的 `microsoft-edge-stable` amd64 条目：版本 `156.0.4314.58-1`，200144638 字节，SHA-256 `adcf4ce88e3eb276083a561efd0cb06b6801f09dcb6585f6cc23c59730414c3d`。这是元数据记录，不是已下载浏览器的字节核验。

[官方下载页面](https://www.microsoft.com/en-us/edge/download) 提供 Linux `.deb` 并注明：

> By downloading Edge, you agree to the Microsoft Edge Software License Terms.

当前任务不授权自动接受新条款，因此在下载浏览器二进制之前停止。只下载了软件包目录元数据，没有下载 `.deb`、解包、系统安装、启动浏览器或执行 Edge 回归；没有使用其他镜像绕过该条件。

## 状态

- Edge：**NOT_RUN / BLOCKED_LICENSE_ACCEPTANCE**。
- 网络：官方软件包元数据可访问；二进制下载链未尝试。
- 运行库兼容性：NOT_RUN；不能称缺失库或启动失败。
- Safari：本项未尝试，仍 NOT_RUN。
- 现有 Chromium 实测不受影响，也不能替代 Edge/Safari 证据。

解除条件：确认适用条款已获用户授权，或提供已有授权的 Edge 隔离测试环境，然后才执行真实浏览器回归。无需付费资源、系统安装或干扰用户浏览器。

机器回执：[edge-availability-20261104.json](edge-availability-20261104.json)。本项只是验证准备和阻断记录，不新增产品实现，也不将跨浏览器验收标记完成。
