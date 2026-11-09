# 从仓库原件复现 V3 的本地审核

当前准备方向为“项目报告候选稿＋真实运行视频”，并提供源码本地复现；没有公开部署或正式参赛提交。本轮基线为 `4ac423e90e106541bd706e62f6f3815ea3cce8a3`。旧四页PDF、V3的5826dab捕获版本及原审核manifest中的29e9eae历史基线不改写。

## 一次完整启动

需要完整Git checkout（不是排除了四件二进制的代码导出包）、Python3.13/3.14、Node24、npm与可用浏览器。先按[开工入口](../START_HERE.md)安装`requirements-validation.txt`、执行`npm --prefix apps/web ci`，并下载及暂存摘要固定的官方Pyodide运行时；这些是公开依赖，不需要任何Lux3D账号、Key、私有来源包或`inputs.json`。

激活上述Python环境，在仓库根目录运行，输出目录须尚不存在：

```bash
python scripts/serve_local_asset_review.py --output evidence/private/local-review-01
```

该命令校验两件[原始GLB](../review-assets/2026-11-09/README.md)、生成法线修复件并核对固定派生SHA，读取随库提供的[校准候选](../review-assets/2026-11-09/local-review.json)，正常构建、验证普通分发，再仅在`http://127.0.0.1:4174/preview/`服务明确的模型审核模式。终止用Ctrl+C。已有同版构建时可加`--no-build`，此时回执明确标为复用构建：分发验证不会独立证明Vite的JS由当前App源码编译，正式捕获使用默认重新构建。仅准备原件到派生件可加`--prepare-only`。已有输出不会被覆盖，重跑请选择新的输出目录。

打开该地址，点击“从初始状态开始窗边案例”：椅子从(5.3,3.3)移至(3,2)，再撤销／重新开始并移至(3,0.6)；前一次移动使儿童窗边条件不再触发但新增老人通道占用，后一次两项目标不触发。切换柜体主挑战，将柜体从(5.3,3.3)移至(4.5,3.2)、旋转45°，再尝试越界；合法输入保留，非法次数增加。目标完成仍显示窗口防护、柜体固定等未知资料及其他已触发／未覆盖事项，最后导出JSON与场景快照。

同一服务的`/preview/review/models.html`实际加载两件原始GLB与修复件，分别显示源+Z正面、修复后正面、校准后场景−Z正面和侧面。它用于技术／视觉审核，不是产品导入功能或平台重新生成。

## 与普通构建、许可状态的区别

- 正式`assets/asset-manifest.json`仍为`assets: []`；普通`npm run build`继续是标明占位的预览，不会自动加载审核模型。
- 本地服务只覆盖当前审核所需的场景、资源描述及配置，服务内的文件均来自明确allowlist；不把派生模型写入public或dist，不开放私人目录，不对外监听。
- `calibration.reviewed`始终为`false`；新渲染路径仅在HTTP loopback、有显式审核模式且asset_id与hash匹配时允许查看候选，不改写正式发布门禁。
- 来源标签`lux3d_web`对应保留记录，不是平台签名。保留旧asset_id中的`private-`前缀，是为复现V3的canonical输入hash，不表示模型在平台设为私有。
- Y-up源+Z经Y轴180°旋转映射到场景−Z，以旋转后的底部中心为原点；非等比拟合椅子0.50×0.80×0.50m、柜体0.70×1.60×0.50m。这是手工合成场景参数，不是实物测量或比例保真声明。
- 用户此前同意四件文件公开上传，不等于Lux3D账号适用条款已核实。当前公开PC协议存在默认非商业服务使用、另行订单优先、用户生成成果所有权及平台社区公开等不同条款；仅据这些条文不能断言本账号站外GLB再分发已获许可或已被明确禁止。平台账号／订单及最终参赛声明仍须核实。[协议入口](https://www.aholo3d.cn/agreement/termsofuse)、[实际公开文本](https://www.aholo3d.cn/aholo/api/app/agreement/info?type=pc_user_policy)、[资产库功能说明](https://aholo.featurebase.app/en/help/articles/3388459-asset-library)。

## 自动化完整案例

保持上述审核服务运行，安装独立测试驱动（目录被忽略，不使用个人浏览器配置）：

```bash
npm install --prefix evidence/private/review-driver puppeteer-core@24.15.0
node scripts/check_web_risk_case.mjs --local-review \
  --url http://127.0.0.1:4174/preview/ \
  --chrome /path/to/chromium \
  --driver evidence/private/review-driver/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js \
  --python /path/to/active-venv/bin/python \
  --expected-head "$(git rev-parse HEAD)" \
  --output evidence/private/local-review-case-01
```

只在CI容器确需时沿用既有`CI=1`启动配置；不关闭网络TLS或浏览器安全设置诊断访问。脚本核验当前服务所有allowlist字节，确认两模型加载，执行真实鼠标拖动与按钮操作，逐阶段下载并用Python重算全部finding、检查375px重启及真实打印／同字节导出预览。`result.json`记录HEAD和未提交源码摘要；有未提交改动会如实标注，不能当已冻结版本。

## 当前验证状态

本轮实际结果和独立审查见[执行记录](../evidence/LOCAL_REVIEW_REPORT_20261109.md)。4ac423e对应[CI42558752605](https://github.com/GuanJHCode/HomeSafe-AI/actions/runs/42558752605)功能通过，整体失败：首次可编辑p95=4027.4ms超过3000ms，冷规则4027.4ms<12000ms、热评估14.9ms<150ms。这个CI测的是该提交的合成占位场景，不证明本轮本地改动性能；门槛保留，没有重跑远端CI。

V3保持原88.92秒，没有在本轮重录。重新抽帧发现来源段文字较密、柜体回弹完整画面停留极短；新报告将用本轮真实截图补充说明，不把旧视频审查或单个相机视角当全部三维穿插／跨设备验收。
