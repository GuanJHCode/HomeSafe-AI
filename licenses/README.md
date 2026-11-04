# 分发依赖许可证

`npm run build` 的暂存阶段读取实际安装的 npm 生产依赖闭包、官方 Pyodide lock 中 Pydantic 的五个 wheel，以及本目录固定版本的上游许可证和构建依赖通知，生成：

- `THIRD_PARTY_NOTICES.txt`：原文许可通知，包括 Pyodide 源码获取链接。
- `dependency-notices.json`：组件、版本、原始文件位置、通知摘要、覆盖范围与待审事项。

这两个文件进入构建清单与 CHECKSUMS；缺失、版本漂移、许可证摘要不符或产物被改写会阻止验收。npm 生产依赖闭包是保守范围，可能包括最终被 Vite 摇树移除的包，不宣称全部都进入浏览器 JS。开发工具不因为出现在本机而自动纳入分发。按 npm lock 的实际生产标记决定范围。

上游原文从固定标签获取，来源和摘要在 `upstream/sources.json`。没有改动 Pyodide 官方 lock 或运行时字节。wheel 的通知从被分发的 wheel 内读取，不从本机 Python 安装替代。

静态依赖审计按 Pyodide 314.0.6 的 Makefile.envs、cpython/Makefile、Setup.local 及 Emscripten 5.0.3 ports 固定版本展开，包含 Emscripten、musl、libcxx/libcxxabi/compiler-rt、libffi、hiwire、liblzma、zstd、zlib、bzip2、SQLite，以及 CPython 附加许可（含 mpdecimal/HACL 等）。Pydantic-core 2.41.5 的 Cargo.lock 中 101 个注册表依赖的下载包均经 Cargo checksum 验证；99 个包读取内嵌许可，r-efi 与 wit-bindgen-rt 从对应版本标签补齐 AUTHORS/许可原文。保守保留整个 Cargo.lock，包括开发、构建及其他目标平台条目，不声称这些条目都进入最终 WASM。

Rust 1.93.0 标准库原始通知取自官方 rust-std 包；完整 COPYRIGHT-library.html 取自同版本 rustc 分发，两包均与官方 .sha256 核对。该文档覆盖标准库各目标的原始声明，构建时只将 HTML 转为纯文本，无网页脚本执行。所有原件保留源 URL、原文摘要、包摘要（如适用），构建材料也固定摘要。代码拒绝静态必需项或 Cargo 依赖声明被删、构建材料被改及版本漂移。

本轮实际输出 225 条通知、1,579,147 字节全文，其中上游原件 195 条，另有实际 npm 生产包 25 条、分发 wheel 5 条。范围是保守的源码关联清单，不是精确链接二进制 SBOM，也不是法务结论。最终发布复核应保留上述范围，不作更强保证。项目自身源码尚未指定统一开源许可证；第三方许可不授予项目或 Lux3D 模型权利。两件模型仍需中国站实际适用条款及公开 GLB 再分发确认。

导出源码使用 `vendored_dependency_notice` 分类保留 `licenses/upstream/` 的审核原文/构建材料，避免称其为项目生成源码。此分类只接受该目录直接子文件中的 UTF-8 `.txt`/`.rst`/`.lock` 及 `sources.json`，且必须匹配登记的摘要；不成为二进制、私密文件或任意第三方源码的导出通道。

重现检查：先按 START_HERE 安装固定依赖和同源运行时，再运行 `npm --prefix apps/web run build`。无需网络即可重新生成通知。
