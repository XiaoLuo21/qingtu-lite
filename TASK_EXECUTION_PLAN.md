# TASK_EXECUTION_PLAN.md | 轻图 Lite 六小时无人值守任务执行书

> 适用对象：Codex / Claude Code / Gemini CLI / DeepSeek Harness 等能读写文件和调用终端的 Agent。
> 执行模式：**无需中途确认，自主推进；局部阻塞记录并跳过；禁止造假；保护既有用户资产。**
> 先读同目录 `AGENTS.md`。本任务书是具体执行顺序，冲突时以 `AGENTS.md` 的安全、真实性和范围约束为准。

## 一、固定项目参数（无需提问）

| 项目 | 固定值 |
|---|---|
| 产品名称 | 轻图 Lite（Qingtu Lite） |
| 定位 | 不上传服务器的在线图片压缩工具 |
| 路径 | HW08 **B：网页 MVP** |
| 新 GitHub 仓库名首选 | `qingtu-lite`（冲突自动改 `qingtu-lite-hw08`） |
| 技术 | Vanilla JS + Vite + `compressorjs` + CSS |
| 部署 | GitHub Pages、公开 HTTPS，不用自定义域名 |
| 压缩选项 | JPG/PNG/WebP 输入；优先 WebP 输出；不支持则 JPEG |
| 质量滑块 | 默认 70%；40%～90%；步长 5% |
| 上传大小限制 | 单张 ≤15 MiB；最大输出边长 4096px |
| 主要界面语言 | 简体中文 |
| 交付 | 网站 + GitHub URL + 90 秒内视频 + 2 个作业 DOCX + 真正证据 |
| 时间上限 | 6 小时 |
| 成本限制 | 免费，禁止开通收费服务 |

核心假设，可直接用于 HW08：

> “只要首次访问的用户能在没有指导的情况下完成上传、调整质量、压缩并下载图片，就说明轻量网页工具可满足用户一次性图片压缩的基本需求。”

**注意：**这是待验证假设，不得直接写为“已经被 10 名用户验证”。

## 二、任务状态与执行原则

- 状态：`TODO`、`DOING`、`PASS`、`BLOCKED`、`FAIL`、`SKIPPED`。
- 每个任务必须有独立**验收标准**、**真实证据**和**失败兜底**；不能靠主观觉得完成。
- 除授权/安全问题外，不让用户选择技术栈、配色、仓库名、功能优先级；直接按本文参数实现。
- 按顺序推进 `TASK-00` 至 `TASK-10`，每个 P0 子任务完成即提交代码。P1 失败不回滚可用 P0。
- 每阶段更新 `progress.md`，用北京时间绝对时间戳，不能补写虚假步骤。

## 三、六小时执行时间箱

| 时间箱 | 任务 | 可见产物 |
|---|---|---|
| 00:00～00:25 | TASK-00 环境与输入 | 环境检查、模板存在性、进度文件 |
| 00:25～01:00 | TASK-01 初始化 | 可构建工程、依赖锁定、README |
| 01:00～02:15 | TASK-02 页面与 TASK-03 压缩逻辑 | 初版可用产品 V1 |
| 02:15～02:50 | TASK-04 测试和修正 | V2、测试截图与问题记录 |
| 02:50～03:35 | TASK-05 公开部署 | GitHub Pages URL、Actions 记录 |
| 03:35～04:20 | TASK-06 用户验证准备/收集 | 测试任务、真人反馈记录（若可取得） |
| 04:20～05:05 | TASK-07 AI 留痕、TASK-08 视频 | 过程截图、短演示视频与链接 |
| 05:05～05:50 | TASK-09 作业 DOCX | 两份基于原表的文件 |
| 05:50～06:00 | TASK-10 验收交付 | FINAL_REPORT、文件核查 |

若任务提前完成，继续下一项；若有步骤阻塞超过规定时限，**立即转向下一个独立任务**。用户没有要求在六小时内持续报告，本规则是内部优先级，不等于后台定时承诺。

---

## TASK-00｜发现环境与原始课程模板（25 分钟）

**操作：**
1. 获取工作目录；若当前已有项目，不侵入修改，另建 `qingtu-lite/`。
2. 检查 `node -v`、`npm -v`、`git --version`、`gh --version`、`gh auth status`、浏览器/Playwright、是否能联网安装 npm 包。
3. 寻找两个上传作业文件：`08_第5周_MVP搭建过程记录.docx`、`14_AI过程截图记录模板_通用.docx`，路径优先 `/mnt/data/` 和工作区。只复制到私有交付目录，不放公开 repo。
4. 把 `AGENTS.md`、`TASK_EXECUTION_PLAN.md` 放进新的 repo 根目录，建立 `progress.md` 并记第一条**真实**日志。
5. 如 GitHub 未授权，标记部署权限风险，**继续开发**。

**验收：** 输出环境检查结果；两模板存在/不存在状态；项目目录与进度文件确实创建。

## TASK-01｜初始化稳定的原生前端项目（35 分钟）

**操作：**
1. 使用 npm 初始化最小 Vite Vanilla JS 项目。添加生产依赖 `compressorjs`，开发依赖 `vite`；以 `package-lock.json` 锁定版本。
2. 添加脚本 `dev`、`build`、`preview`、`test`（测试脚本可以是自写检查 + Playwright，有条件才安装完整浏览器）。
3. 确保 `vite.config.js` 使用相对 `base: './'`。不使用需密钥的服务。
4. 添加 `.gitignore`：至少 `node_modules/`, `dist/`, `.env*`, `playwright-report/`, `test-results/`, `*.log`、课程个人敏感证据目录。
5. 添加 `README.md`：功能、运行方式、隐私声明、第三方库许可、公开链接位置（未部署前留“待验证”）。
6. `npm run build` 首次构建并保存终端真实输出。

**验收：** 首次安装与构建成功；`npm ci` 可以重现依赖安装；不得有密钥或个人数据。

## TASK-02｜完成漂亮、直观且不臃肿的网页（45 分钟）

**必须有的 UI 元素（建议 DOM ID）**：

- 标题 `轻图 Lite` + 副标题 `免费在线压缩图片，图片只在浏览器内处理`。
- 文件输入 `#file-input`，拖拽区域 `#drop-zone`，格式/大小要求说明。
- 原图预览 `#original-preview`，文件名、原始大小和分辨率。
- 质量范围滑块 `#quality-range` 和数值 `#quality-value`，初始为 `70%`。
- 压缩按钮 `#compress-button`，加载状态文字。
- 结果预览 `#result-preview`，新格式、输出大小、体积变化率。
- 下载按钮 `#download-button`，只在压缩成功、格式验证完成后启用。
- 状态信息 `#status-message`，错误使用 `role="alert"` / `aria-live`。
- 隐私和许可说明；可选 `复制反馈模板` 按钮。

**交互状态机：**
`EMPTY → SELECTED → COMPRESSING → SUCCESS`；其他路径 `ERROR`；更换图片回到 `SELECTED` 并清理上一张对象 URL 和 result。

**样式：** 手机 375px 无横向溢出，桌面 1440px 双栏前后预览；拖拽有高亮；可见键盘焦点；按钮可用性清楚。

**验收：** 不加载图片时页面完整；拖拽/文件选择均可展示图片；手机与桌面布局可用，至少保存 V1 页面截图到私有交付区。

## TASK-03｜压缩引擎与异常路径（30 分钟）

**必须遵守的伪代码/处理算法：**

```text
onNewFile(file):
  revoke old original/output object URLs; clear old result
  check real MIME in ['image/jpeg','image/png','image/webp']
  check size <= 15*1024*1024 and > 0
  try decoding image and reading dimensions; reject corrupted data
  make original preview URL; set SELECTED

onCompressClick():
  require valid selected file and not already running
  set COMPRESSING, disable repeated clicks
  use 1x1 canvas to detect WebP encoding
  targetMime = WebP supported ? 'image/webp' : 'image/jpeg'
  if JPEG fallback: use beforeDraw to fill background WHITE
  new Compressor(file, {
      quality: quality / 100,
      mimeType: targetMime,
      maxWidth: 4096,
      maxHeight: 4096,
      strict: false,
      retainExif: false,
      success(blob) { inspect blob.type; if unexpected, fail clearly;
          create object URL; compute actual bytes; render true delta;
          show alpha-to-white note for JPEG fallback; enable download; },
      error(e) { show a clear Chinese failure message; }
  })
  end COMPRESSING in both success and error

onDownloadClick():
  require valid Blob with verified result MIME
  create an object URL link and trigger user-initiated download
  filename = sanitized original stem + '-qingtu.' + actual extension
  keep/revoke object URLs appropriately
```

**注意的工程细节：**
- 选新图片时，新旧异步任务可能竞争。用 `requestId` 或显式 abort 避免旧任务异步回写新图片。
- `Blob.type` 可能为空，不能随意瞎猜。必要时检查输出文件字节签名/重新解码，失败显示错误。
- 若用户选 WebP 但环境不能解码，中文解释不支持。
- WebP 模式保留透明背景需以测试为准；不支持 WebP 的降级 JPEG 清楚标注白色填充。
- 结果大于原图显示“体积增加”，不要自动换数字或欺骗用户。
- 下载按钮只使用当前有效结果；文件下载后仍可再次下载。
- 禁止把图片发送到任何远端。

**验收：** JPEG、含透明的 PNG、WebP 各一张完成压缩和实际下载；真实输出格式与扩展名一致；可换图、重新压缩、报错。

## TASK-04｜测试、失败修复、形成 V1/V2/V3 记录（35 分钟）

运行并记录以下测试，不可把“计划运行”填成“已通过”：

| 编号 | 测试动作 | 期待结果 |
|---|---|---|
| T01 | 上传普通 JPG，70% 压缩 | 输出可预览/下载，尺寸变化真实 |
| T02 | 上传带透明背景 PNG | WebP 时透明保留；JPEG 降级时有说明 |
| T03 | 上传 WebP | 成功转换/下载，格式与扩展名正确 |
| T04 | 质量从 40% 改 90% 分别压缩 | 数值更新，输出取实际大小 |
| T05 | 上传 `.txt` 或 SVG | 拒绝，清晰中文错误，无页面崩溃 |
| T06 | 上传 >15MiB 文件 | 被拒绝，无强行解码 |
| T07 | 选择损坏的 .jpg | 明确报错，下载按钮不激活 |
| T08 | 快速切换两张图片 | 结果始终对应最新图片 |
| T09 | 上传较小且已高度压缩的图片 | 如果体积变大，正确说明 |
| T10 | 375px 手机、1440px 桌面 | 无横向溢出，所有按钮可交互 |
| T11 | Tab/Enter/Space 操作 | 可完成关键功能，焦点清晰 |
| T12 | `npm run build` 和本地 `preview` | 构建与访问均通过 |

在 `progress.md` 标记三个**真实**产品版本，建议：
- V1：上传、压缩、下载。
- V2：修复实际遇到的格式/异常/指标错误。
- V3：手机适配、可读性和提示文案优化。

只有真正发生修改才记版本；没有用户反馈就把依据标成“内部测试 Txx”，禁止写“用户反馈”。提供截图 `V1.png`、`V2.png`、`V3.png`（实际截图时间与文件时间保留）。

## TASK-05｜GitHub Pages 公开发布（45 分钟）

**优先执行，无需询问：**

1. `gh auth status` 确认账号。`gh api user --jq .login` 获取真实 GitHub 用户名，不凭记忆推断。
2. 检查 `gh repo view <login>/qingtu-lite`；没有则 `gh repo create qingtu-lite --public --source . --remote origin --push`。若已存在，**绝不覆盖**，依次采用 `qingtu-lite-hw08` / 带日期后缀。
3. 为 `main` 创建 `.github/workflows/deploy.yml`，GitHub Actions job 必须有 `contents: read`、`pages: write`、`id-token: write`；构建使用 `npm ci && npm run build`；配合 `actions/configure-pages`、`actions/upload-pages-artifact` 上传 `dist`，以及 `actions/deploy-pages` 部署。
4. GitHub 仓库 `Settings → Pages → Source` 选择 `GitHub Actions`。能使用 API/命令自动设置就自动做；无法自动设置则记具体手工点击步骤，不要宣称已上线。
5. git commit & push，查看 `gh run list`、`gh run view` 确认工作流实际成功。优先使用 GitHub 官方当前稳定 Actions major 版本或固定 SHA，不盲用陈旧教程。
6. 查看部署输出实际 `page_url`；使用 `curl -I` 或浏览器访问网站，加载静态资源、执行压缩和下载操作。
7. 将**实际已验证**的 URL 写入 README、私有作业信息和最终报告。

**典型 URL**：`https://<github-login>.github.io/<created-repo>/`，只是模板，不能替代验证。

**验收：** GitHub 仓库公开，Actions 成功、页面可公网访问，手机与桌面可操作。如果账号授权缺失，写 `PUBLISH_BLOCKED_AUTH`，继续 TASK-06～TASK-10。

## TASK-06｜真实用户测试与产品反馈（45 分钟）

**目标：** 至少 **10 名真实用户**，每人独立打开网址、上传、压缩、下载，并简要回答是否易用。**Agent 不可替人完成此项**。

在页面中加入“复制体验反馈模板”或在私有交付目录提供以下标准文字：

```text
【轻图 Lite 体验测试，约 1 分钟】
网站：<实际公网网址>
1. 你能否独立上传、压缩并下载一张图片？（能/不能）
2. 最不方便的地方是什么？
3. 你愿意下次需要时继续使用吗？（愿意/不确定/不愿意）
可选：提供关键步骤截图。请不要发送含私人信息的图片。
```

**具体动作：**
1. 建立私有 `user-testing.csv`：`编号,日期时间,来源(匿名),是否完整使用,核心反馈,证据文件,用户是否同意记录`。
2. 对已有真实回复进行匿名整理；至少三条直接来自原话的简短反馈（不得假想）。
3. 统计真实人数/独立使用人数；没有渠道/回复就保留“0 或未确认”，并交付上述邀请文字供用户自行发给同学。
4. 对收到的反馈进行最少一处合理产品修正（时间不够则记录为未来迭代，不伪写 V3 依据）。

**验收：** 真正得到 10 名才标 `PASS`；不足则 `BLOCKED_REAL_USERS` 并写已确认人数与还差人数。私聊截图只放私有目录。

## TASK-07｜AI 过程证据整理（30 分钟）

按第 5 周 `AI-5-01`～`AI-5-04` 建立四个协作记录，建议主题：

1. `AI-5-01`：确定图片压缩 MVP 的功能/技术方案。
2. `AI-5-02`：生成第一版页面/交互。
3. `AI-5-03`：根据真实错误测试修复压缩流程。
4. `AI-5-04`：部署与 UX 优化、验收复盘。

**真实取证：** 截图必须出现实际 AI 工具标识、用户真实发送的提示词、AI 真实回复、时间；长对话按顺序连续截图，不裁剪或涂改。Agent 能看到的本轮任务输入可作为真实提示词，无法取得原始 UI 截图时需**保留证据缺口**；终端截图/代码生成记录是辅助证据，但不能冒充 ChatGPT 对话截图。

每条填写“我的判断与修改”，须以实际发生的修改和对应提交证据为准，例如“检测输出格式与浏览器兼容性后，决定由固定 JPG 改为 WebP 优先、JPEG 兜底”，且只有真的改过才可这样描述。

**验收：** 模板中 4 条条目均有真实文字来源；完整截图缺失则对应条目明确“待提供原始完整对话截图”，不得生成虚构图片。

## TASK-08｜录制 ≤90 秒演示视频并获取公开链接（15～30 分钟）

**视频拍摄素材必须是真实可运行网页，不可用静态效果图冒充完整操作。**

建议时长 **60～75 秒**，实际按功能录制：
- 00–08 秒：展示网站 URL 与“轻图 Lite”首页。
- 08–20 秒：上传测试 JPG，看到原图文件大小和预览。
- 20–35 秒：调节质量，压缩，展示前后实际大小变化（不可编数字）。
- 35–45 秒：点击下载，在本地打开结果。
- 45–58 秒：用 PNG 演示或展示格式说明。
- 58–70 秒：展示手机端页面及“不上传服务器”的说明。

优先 Playwright/浏览器原生屏幕录制；如需转码用已安装 ffmpeg，不能为安装转码链条牺牲上线与作业时间。文件名 `qingtu-lite-demo.webm` 或 `.mp4`，视频 ≤90 秒。只使用无个人信息的测试图片。

**发布视频**：能安全公开发布时放入静态站点 `public/demo.webm` 并重新构建部署，或使用有权限的公开视频托管；实际点击 URL 验证播放且可访问。不要公开含私人文件名、学生信息、账号令牌的录屏。若未能发布，报告中注明“视频文件已生成，公开链接待补”，不能冒充可用视频链接。

## TASK-09｜填写两份原始 DOCX 作业（45 分钟）

> 只允许基于上传的原始两个 DOCX 模板修改：不能删标题、不能删除教师评阅区，不能偷换成全新排版表格。需要时安装 python-docx 或使用已有 Word 编辑能力。输出放私有交付目录。

### 文件 A：`HW08_MVP搭建过程记录_待本人核验.docx`

按原文填写：
1. 基础信息：项目名“轻图 Lite”、路径选 B、真公网链接、真演示视频链接、上述核心假设；姓名/学号/联系方式不确定则 `【本人填写】`。
2. 搭建日志：日期、动作、工具、`AI-5-xx`、真实结果/问题，内容映射实际 `progress.md` 和 git 记录。
3. V1/V2/V3 迭代：实际改动 + 真实依据（内部测试或真实反馈，标识清楚）。
4. 真实用户测试：填写实际人数和来源、最多三条有原始证据的反馈、证据编号；没数据就明确“尚未完成真人测试，待补”，不虚构 10 人。
5. 成本自查：GitHub Pages、GitHub Actions（在免费额度内则填“未超额”，应核实用量）、Vite、Compressor.js 等；不得承诺无限免费额度。
6. 可用性自查：仅勾真实测过的项目。比如未实测陌生人使用时不能勾最后一项。
7. 困难与求助：只写真实发生的问题和处理；AI 使用声明不得替用户勾选未证实的真实性条款；签名与日期由本人确认。
8. 保存为 Word、打开检查表格未错位/截断；不能修改老师评阅栏。

### 文件 B：`AI_过程截图记录_第5周_HW08_待本人核验.docx`

- 至少 4 个**真实协作环节**的文字内容、日期/时间、AI 工具名、核心提示词原文、AI 输出结论、个人判断与修改及结果用途。
- 真实原始 AI 对话截图可用则按顺序粘贴；无原始截图则保留明显 `【待粘贴真实 AI 对话完整截图】`，并在最终报告逐条说明缺口。
- 记录编号 `AI-5-01`、`AI-5-02`、`AI-5-03`、`AI-5-04`；不足四个真实 AI 协作环节时不可虚构条目。
- 不触碰“教师评阅区”或替学生签名。

**验收：** 2 个 `.docx` 能打开，保留原结构，状态明确；不将私人作业文件 push 到 public repo。若环境里没有原模板或 python-docx，改输出内容填表草案并标注 `DOCX_BLOCKED`。

## TASK-10｜最终验收、交付和自动复盘（10 分钟）

按顺序检查：

- [ ] 网站公网 HTTPS 可访问，能从手机和桌面进入。
- [ ] 普通人能单张上传、调整参数、压缩、查看真实大小并下载。
- [ ] 代码已 push，新仓库公开，Actions `success`。
- [ ] 不涉及后台、收费、个人文件传输，开源许可有致谢。
- [ ] 真实演示视频 ≤90 秒，并有**访问验证通过**的视频 URL。
- [ ] 两份基于模板的课程 DOCX 文件真实存在，并且可以打开。
- [ ] AI 过程记录至少 4 条真实来源，截图缺失已标注。
- [ ] 真人测试实际人数准确；不足 10 人不宣称达到 B 路径良好层级。
- [ ] 没有敏感文件进入 GitHub 提交历史。
- [ ] 报告附所有真实截图/日志/测试结果及失败项。

**最终交付文件目录：**

```text
qingtu-lite/                          # 可公开的项目仓库
  (网站源码 + AGENTS.md + TASK_EXECUTION_PLAN.md + README.md + deploy workflow)
qingtu-lite-deliverables/             # 私有交付目录，不进入 git
  FINAL_REPORT.md
  HW08_MVP搭建过程记录_待本人核验.docx
  AI_过程截图记录_第5周_HW08_待本人核验.docx
  qingtu-lite-demo.webm 或 .mp4        # 如果成功录制
  screenshots/                         # 截图（严禁杜撰）
  testing/                             # 私密用户反馈、自动化测试记录
```

**FINAL_REPORT.md 最终输出模板：**

```markdown
# 轻图 Lite 最终交付报告
- 执行结束时间（北京时间）：
- GitHub 仓库：[实际 URL 或 未授权]
- MVP 公网链接：[已打开验证的实际 URL 或 未上线]
- 演示视频链接：[已验证的实际 URL 或 待补]
- 任务状态：TASK-00 PASS ... TASK-10 ...
- 构建/测试：PASS x / FAIL y；真实证据文件路径
- 已完成真实用户数：n/10；证据路径；缺失情况
- AI 协作记录：n/4；原始完整截图 n/4
- DOCX 1：文件路径 + 可打开与否
- DOCX 2：文件路径 + 可打开与否
- 费用：实际开支；未经核实的费用填“未知”
- 阻塞项：原因、已尝试操作、最短可恢复步骤
- 用户仅需亲自完成的动作：例如粘贴私密截图、邀请真人、签名/交作业
- 安全自查：无个人敏感文件公开、无密钥泄漏
```

**终止条件：** 全部可做事项已尝试，阻塞均记录且已生成阶段性文件。只报告亲自完成和验证的内容，不承诺事后无监督继续工作。
