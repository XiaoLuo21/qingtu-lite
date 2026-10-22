# progress.md｜轻图 Lite 执行进度（真实记录）

> 时区：北京时间（UTC+8）。记录原则：只写实际执行的命令与真实结果；未取得证据的事项标注 BLOCKED，不以计划代替结果。
> 执行方式：DeepSeek Harness Agent 无人值守执行；产品代码、测试、文档由 Agent 编写，最终作业签名与真人反馈由用户本人完成。

## 时间线

| 时间（北京时间） | 任务 | 动作与命令 | 结果 | 产物 / 证据 | 下一步 |
|---|---|---|---|---|---|
| 22:01 | TASK-00 | `pwd`、`node -v`、`npm -v`、`git --version`、`which gh`、浏览器与模板检索 | PASS（有缺口） | Node v22.23.4 / npm 10.9.9 / git 2.43.0 / Chrome 156；`gh` 未安装、无 GitHub 凭据；工作区**没有 index.html**；未找到两份课程 DOCX 模板 | 按 FRONTEND_REFERENCE.md + 预览图重建视觉，继续开发 |
| 22:02 | TASK-00 | Pillow 读取 preview-desktop/mobile/working.png 主色（模型无法直接读图） | PASS | 主色：深墨绿 #184038、翡翠绿 #0b9474、薄荷 #d9f2e9、浅背景 #f8faf8 | 建立设计变量 |
| 22:03 | TASK-01 | `npm init`、安装 `vite@8.3.5` `compressorjs@1.4.0` `@playwright/test@1.64.1`，写 `package.json` / `vite.config.js` / `.gitignore` | PASS | package-lock.json 已生成 | 写页面 |
| 22:04 | TASK-01 | `npm run build` 首次构建 | PASS | dist/index.html + assets（见 testing/build.log） | 继续 |
| 22:05–22:10 | TASK-02/03 | 编写 `index.html`、`src/style.css`、`src/lib.js`、`src/main.js`，实现上传/校验/压缩/下载/更换/响应式 | PASS（代码完成） | 4 个源文件 | 测试 |
| 22:10 | TASK-03 | `npm test`（node:test 13 条纯函数与隐私扫描） | PASS 13/13 | testing/unit-test.log | e2e |
| 22:11 | TASK-04 | 用本机 Chrome 生成夹具 `npm run fixtures`（JPG/透明 PNG/WebP/1×1/损坏/超 15MiB/txt） | PASS | tests/fixtures（git 忽略） | e2e |
| 22:12–22:16 | TASK-04 | 首轮 `npx playwright test` | FAIL 2/14：T06/T07 期望空状态下 `#download-button` 为 disabled，实际 enabled | 终端输出已复现问题；Playwright 清理了 test-results，截图未留存 | 修复 |
| 22:16 | TASK-04 | 修复：`index.html` 下载按钮加 `disabled`；`src/main.js` 的 `init()` 调用 `clearResult()` 归一化初始状态 | 已修改 | git diff（随后提交） | 回归 |
| 22:17–22:19 | TASK-04 | 全量 `npx playwright test` | PASS 14/14（2.1m） | 终端：T01–T14 全绿 | 生产验证 |
| 22:18–22:19 | TASK-04 | `npm run build` + `npx vite preview --port 4173` + `node tests/capture.mjs` | PASS | 9 张真实截图；production-check.json：JPG 172.2 KiB→38.2 KiB（-77.8%）、下载 `sample-qingtu.webp` 39158B 且 RIFF/WEBP 魔数正确、透明 PNG 保留透明、375/390/1440 横向溢出均 0、外部请求 0 | 视频 |
| 22:20–22:24 | TASK-08 | `npx playwright install ffmpeg` + `node tests/record-video.mjs` | PASS | qingtu-lite-demo.webm，1280×720，**59.88 秒**，4.9 MB；抽帧 2/10/25/40/55s 非空白 | 文档 |
| 22:25 | TASK-05 | 再次检查 `gh auth status` / `env | grep -i github` / `~/.config/gh` | BLOCKED | gh 不存在、无 token、无配置文件 | 标记 `PUBLISH_BLOCKED_AUTH`，交付本地可运行版本与工作流 |
| 22:24–22:27 | TASK-09/10 | 复制 AGENTS.md、TASK_EXECUTION_PLAN.md；`git init` + 5 次真实提交 | PASS | `git log`：feat / test / ci / docs / test config | 写交付文档 |
| 22:28 | TASK-10 | 编写 progress.md、README.md 完成；整理私有交付目录 | DOING | qingtu-lite-deliverables/ | 最终报告与作业草案 |

## 版本记录（只记录真实发生的修改）

| 版本 | 依据 | 实际改动 | 证据 |
|---|---|---|---|
| V1 | 内部测试首轮 | 完成上传、校验、压缩、预览、真实体积对比、下载的可用 MVP（首轮 e2e 14 项中 12 项通过） | 首轮 e2e 输出：T06/T07 失败，原因是空状态下下载按钮未禁用 |
| V2 | 内部测试 T06/T07 失败 | 下载按钮初始 `disabled`；`init()` 调用 `clearResult()` 清理初始态；输出 MIME 校验与失败文案已在 V1 内实现 | 21.3s 回归 T06/T07 通过（2 passed） |
| V3 | 全量回归 + 生产构建检查 | 375/390px 移动端验证、键盘操作验证、生产 `preview` 下截图与下载验证；README 与交付文档 | 全量 14 passed；capture.mjs 结果：0 溢出、0 外部请求 |

> 说明：V1/V2 的界面与最终版视觉一致（差异仅在按钮初始状态），因此首个可用版本没有单独留存页面截图；V1 的问题以首轮 e2e 终端输出为证据，不补拍、不伪造时间。

## 环境与阻塞

- **PUBLISH_BLOCKED_AUTH**：本机无 `gh` CLI、无 GitHub token、无 git 凭据，无法创建公开仓库/触发 Pages。已交付 `.github/workflows/deploy.yml`、`base: './'` 构建与本地生产验证；用户授权 GitHub 后 push 即可发布，最短恢复步骤见 FINAL_REPORT.md。
- **DOCX_BLOCKED**：未找到 `08_第5周_MVP搭建过程记录.docx` 与 `14_AI过程截图记录模板_通用.docx`，无法在原始模板上填写；改为交付 `作业待填写内容.md`，内容按模板栏目整理，不删改教师评阅区。
- **VIDEO_PUBLISH_BLOCKED**：视频已在本机生成并验证时长 59.88s，但无公网托管渠道（无视频平台账号、站点未上线），公开链接待补；未冒充已发布。
- **PENDING_REAL_USERS**：0/10 名真实用户，无反馈渠道；未用自动化测试冒充真人，邀请文案见 `user-testing-invite.txt`。
- **参考原型缺失**：任务书提到的 `index.html` 不在工作区，视觉按 `FRONTEND_REFERENCE.md` 文字 + 三张预览图取色重建，与参考布局的像素级一致性无法核对。
- 因 AGENTS.md 冻结「最长边 4096px」，未实现 FRONTEND_REFERENCE.md 提到的「最长边控制」交互，改为在结果说明中展示是否被缩放。

## 关键工程决策

1. `compressorjs` 必须设 `strict: false`（否则结果更大时静默回退原文件，掩盖真实体积）与 `convertSize: Infinity`（否则 >5MB 的 PNG 被库强制转 JPEG，破坏本项目自己的格式策略）。
2. 输出格式以 **实际 `blob.type`** 校验，不一致直接报错且不生成下载文件；下载扩展名由真实 MIME 决定。
3. WebP 能力用 1×1 Canvas `toDataURL('image/webp')` 前缀检测；不支持时 JPEG 兜底，`beforeDraw` 全画布填白。
4. 用 `requestId` 令牌防止快速换图时旧异步任务回写新状态。
5. 无 `fetch`/XHR/FormData/analytics，单元测试静态扫描守护；文件名一律 `textContent` 渲染。
