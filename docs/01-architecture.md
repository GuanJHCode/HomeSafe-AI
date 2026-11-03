# 01｜浏览器优先的运行架构
## 运行图
```text
访问者浏览器
  UI / Three.js主线程
    ├─房间/家具/视角/局部草稿/撤销/挑战计步/导出
    └─结构化消息（不发送Python源码）
           ↓ module Worker
       Pyodide 314.0.6 + pydantic 2.12.5
       同一个 homesafe_core：模型→校验→8规则→覆盖→比较→挑战
           ↓
       JSON结果 + client_revision/hash + PlacementIssue
静态托管
  已构建HTML/JS/CSS + 样例JSON + 核准GLB
  同源运行时/所需wheel + 版本锁定的Python源码包
```
无公网DB、账号、照片接收、付费调用。Worker不是后台服务器，也不是强安全隔离或防作弊系统。
静态文件加载仍有网络、体积、MIME、CSP、iframe及浏览器性能风险，必须实测。[S04/S06/S07]

## 开发目录
- `reference/homesafe_core/`：当前可运行并测试的单一规则内核。
- `browser-spike/`：本包提供的Worker/诊断页/客户端参考，不是完整3D应用。
- `apps/web/`：后续创建正式Vue3/TypeScript/Three.js工程；不能假称当前已经存在。
- `scripts/`：本地契约、bundle、资源、测试、可选生成和发布工具。
- `assets/public/`：只放经授权审核的正式公开资产；原始照片和未审截图在仓库外。
- `history/v5-design/`：历史，不执行其中的服务端优先方案。

## 六个边界
1 UI只调Worker Client；不重写Python安全规则。
2 renderer只处理视图、射线选择与变换，几何结果以核心校验为准。
3 domain无网络；只有可选本地Lux3D CLI持有Key。
4 每个提交操作产生本地client_revision；迟到结果不能覆盖当前草稿。**不再需要DB CAS。**
5 首屏先显示房间/加载反馈；引擎未就绪时禁止用伪结果显示绿色成功。
6 只做预先审查的教学数据，不开放任意Python、私人家庭照片和不受控URL输入。

## 核心时序
按下→草稿预览（不评估每帧）→松开→validate+evaluate→有效则commit并计一步→无效回弹并按PlacementIssue高亮。
同一拖动只计一次；无变化不计步；撤销也是一次显式操作，版本增加。
每次比较仍同场景/成员/范围/规则/参数基础；能力参数更改要重新建立基线。
公开挑战只允许移动/旋转白名单对象；资料编辑是另一个模式，不能用来过关。

## 部署失败兜底
先测试同源vendor与最小依赖，不使用运行时npm/pip安装。
若Pyodide在目标浏览器/创空间不可用，按ADR-0002启用薄HTTP评估fallback；保持同一个核心，不引入DB。
视频只是备用证据，不能伪装成“在线互动已成功”。
